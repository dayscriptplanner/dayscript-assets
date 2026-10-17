/**
 * DayScript sync — framework-free ES module.
 *
 * Drops into a page that already owns a `state` object and a `save()` that
 * autosaves it to localStorage (`margin.planner.v1`). This module never
 * reshapes the state: it reads it with `getState()`, hands a server copy back
 * with `applyState(serverState)`, and otherwise treats it as opaque JSON.
 *
 *   import { createSync } from './sync.js';
 *   const sync = createSync({
 *     supabaseUrl, supabaseAnonKey,
 *     getState:   () => state,
 *     applyState: (s) => { state = s; save({ fromSync: true }); render(); },
 *     onStatus:   (status, detail) => { ... },
 *   });
 *   // in save():  sync.scheduleSave();
 *   // instead of aiFetch(body):  sync.ai(body)
 *
 * Rules the module follows (see dayscript-app-architecture.md):
 *   - Local autosave stays the source of truth; the server is a mirror.
 *   - Newer-wins on `state.meta.updatedAt` vs the server row's `updated_at`.
 *   - Pushes are debounced (1.5 s) and use `version` for optimistic concurrency:
 *     `update … where user_id = me and version = <seen>`. 0 rows affected means
 *     another device wrote first → pull, newer-wins, re-push once.
 *   - Flush on `visibilitychange` → hidden and on `pagehide`. We use an awaited
 *     fetch (with `keepalive` when the body is small enough), NOT
 *     `navigator.sendBeacon`: sendBeacon can't set an Authorization header, so
 *     the request would be rejected by RLS. Worst case a tab is killed mid-flush:
 *     the local copy is intact and the next sync pushes it.
 *   - Offline: failed pushes retry with exponential backoff (2 s … 5 min).
 *   - Fully usable signed out: every method is a no-op until there's a session.
 *
 * Status events (onStatus(name, detail)):
 *   'signed-out' | 'syncing' | 'synced' | 'offline' | 'conflict-resolved' | 'error'
 */

const SUPABASE_ESM = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
const TABLE = 'planners';
const KEEPALIVE_MAX_BYTES = 60_000; // browsers reject keepalive bodies over 64 KB
const BACKOFF_MIN_MS = 2_000;
const BACKOFF_MAX_MS = 5 * 60_000;

function defaultClientId() {
  try {
    const k = 'dayscript.clientId';
    let id = globalThis.localStorage?.getItem(k);
    if (!id) {
      id = (globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2));
      globalThis.localStorage?.setItem(k, id);
    }
    return id;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2, 10);
  }
}

function tsOf(iso) {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : 0;
}

function localUpdatedAt(state) {
  return state && state.meta && typeof state.meta.updatedAt === 'string' ? state.meta.updatedAt : null;
}

function isNetworkError(err) {
  if (!err) return false;
  const msg = String(err.message ?? err);
  return err.name === 'TypeError' || /fetch|network|Failed to fetch|Load failed|ECONN|ENOTFOUND|offline/i.test(msg);
}

/**
 * @param {object} opts
 * @param {string}   opts.supabaseUrl
 * @param {string}   opts.supabaseAnonKey
 * @param {() => any} opts.getState           returns the live planner state object
 * @param {(s:any) => void} opts.applyState   replaces local state with a server copy (caller should save + re-render)
 * @param {(status:string, detail?:any) => void} [opts.onStatus]
 * @param {string}   [opts.clientId]
 * @param {number}   [opts.debounceMs=1500]
 * @param {string}   [opts.aiFunction='ai']   edge function name
 * @param {string}   [opts.redirectTo]        where magic links / OAuth land (default: current page)
 * @param {object}   [opts._deps]             test hooks: { createClient, fetch, now, setTimeout, clearTimeout, target }
 */
export function createSync(opts) {
  const {
    supabaseUrl,
    supabaseAnonKey,
    getState,
    applyState,
    onStatus = () => {},
    clientId = defaultClientId(),
    debounceMs = 1500,
    aiFunction = 'ai',
    redirectTo,
    _deps = {},
  } = opts;

  if (!supabaseUrl || !supabaseAnonKey) throw new Error('createSync: supabaseUrl and supabaseAnonKey are required');
  if (typeof getState !== 'function' || typeof applyState !== 'function') {
    throw new Error('createSync: getState and applyState are required');
  }

  const now = _deps.now ?? (() => Date.now());
  const setT = _deps.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearT = _deps.clearTimeout ?? ((id) => clearTimeout(id));
  const target = _deps.target ?? (typeof document !== 'undefined' ? document : null);
  const winTarget = _deps.winTarget ?? (typeof window !== 'undefined' ? window : null);
  const rawFetch = _deps.fetch ?? ((...a) => globalThis.fetch(...a));

  let client = null;
  let session = null;
  let status = 'signed-out';
  let localVersion = null;   // the planners.version we last saw for this user
  let dirty = false;         // local changes not yet confirmed on the server
  let pushing = null;        // in-flight push promise
  let debounceTimer = null;
  let retryTimer = null;
  let backoff = BACKOFF_MIN_MS;
  let flushing = false;      // true while flushing on hide/unload → fetch keepalive

  const log = [];
  function setStatus(next, detail) {
    status = next;
    log.push({ status: next, detail, at: now() });
    if (log.length > 50) log.shift();
    try { onStatus(next, detail); } catch (e) { console.warn('onStatus threw', e); }
  }

  // fetch wrapper handed to supabase-js: adds keepalive during an unload flush.
  function fetchImpl(url, init = {}) {
    const body = init.body;
    const small = typeof body === 'string' ? body.length < KEEPALIVE_MAX_BYTES : !body;
    return rawFetch(url, flushing && small ? { ...init, keepalive: true } : init);
  }

  // ---------------------------------------------------------------------------
  // init: load supabase-js (CDN) unless injected, wire auth + lifecycle hooks
  // ---------------------------------------------------------------------------
  const ready = (async () => {
    const createClient = _deps.createClient ?? (await import(/* @vite-ignore */ SUPABASE_ESM)).createClient;
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      global: { fetch: fetchImpl, headers: { 'x-dayscript-client': clientId } },
    });

    client.auth.onAuthStateChange((event, s) => {
      const had = !!session;
      session = s ?? null;
      if (session && !had && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        localVersion = null;
        pullAndReconcile().catch((e) => setStatus('error', { phase: 'initial-pull', message: e.message }));
      } else if (!session && (event === 'SIGNED_OUT' || had)) {
        localVersion = null;
        dirty = false;
        setStatus('signed-out');
      }
    });

    // Some supabase-js versions don't emit INITIAL_SESSION synchronously; ask once.
    const { data } = await client.auth.getSession();
    if (data?.session && !session) {
      session = data.session;
      pullAndReconcile().catch((e) => setStatus('error', { phase: 'initial-pull', message: e.message }));
    } else if (!session) {
      setStatus('signed-out');
    }

    const onHide = () => { if (target && target.visibilityState === 'hidden') flush(); };
    target?.addEventListener?.('visibilitychange', onHide);
    winTarget?.addEventListener?.('pagehide', () => flush());
    winTarget?.addEventListener?.('online', () => { if (dirty && session) pushNow().catch(() => {}); });
    return client;
  })();

  // ---------------------------------------------------------------------------
  // pull → compare → apply or push
  // ---------------------------------------------------------------------------
  async function fetchRow() {
    const { data, error } = await client
      .from(TABLE)
      .select('state, updated_at, version')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { cause: error });
    return data ?? null;
  }

  async function insertRow(state) {
    const updatedAt = localUpdatedAt(state) ?? new Date(now()).toISOString();
    const { data, error } = await client
      .from(TABLE)
      .insert({ user_id: session.user.id, state, updated_at: updatedAt, client_id: clientId })
      .select('version')
      .single();
    if (error) throw Object.assign(new Error(error.message), { cause: error });
    return data.version;
  }

  /**
   * Compare server row with local state. Newer `updatedAt` wins.
   * Returns 'applied-server' | 'pushed-local' | 'in-sync' | 'created'.
   */
  async function pullAndReconcile({ reason = 'pull' } = {}) {
    if (!session) return 'signed-out';
    setStatus('syncing', { reason });
    try {
      const row = await fetchRow();
      const local = getState();
      if (!row) {
        localVersion = await insertRow(local);
        dirty = false;
        setStatus('synced', { reason, outcome: 'created', version: localVersion });
        return 'created';
      }
      const serverTs = tsOf(row.updated_at);
      const localTs = tsOf(localUpdatedAt(local));
      localVersion = row.version;

      if (serverTs > localTs) {
        applyState(row.state);
        dirty = false;
        setStatus('synced', { reason, outcome: 'applied-server', version: localVersion });
        return 'applied-server';
      }
      if (localTs > serverTs) {
        await pushNow({ reason, _allowRetryOnConflict: true });
        return 'pushed-local';
      }
      dirty = false;
      setStatus('synced', { reason, outcome: 'in-sync', version: localVersion });
      return 'in-sync';
    } catch (e) {
      if (isNetworkError(e)) { setStatus('offline', { reason, message: e.message }); scheduleRetry(); }
      else setStatus('error', { reason, message: e.message });
      throw e;
    }
  }

  // ---------------------------------------------------------------------------
  // push with optimistic concurrency
  // ---------------------------------------------------------------------------
  async function pushNow({ reason = 'push', _allowRetryOnConflict = true } = {}) {
    if (!session) return 'signed-out';
    if (pushing) { dirty = true; return pushing; }
    pushing = (async () => {
      setStatus('syncing', { reason });
      try {
        if (localVersion == null) {
          // We don't know the server version yet (fresh sign-in or after sign-out) → reconcile first.
          pushing = null;
          return pullAndReconcile({ reason });
        }
        const state = getState();
        const updatedAt = localUpdatedAt(state) ?? new Date(now()).toISOString();
        dirty = false; // changes made during the request re-set this
        const seen = localVersion;
        const { data, error } = await client
          .from(TABLE)
          .update({ state, updated_at: updatedAt, client_id: clientId })
          .eq('user_id', session.user.id)
          .eq('version', seen)
          .select('version');
        if (error) throw Object.assign(new Error(error.message), { cause: error });

        if (!data || data.length === 0) {
          // Conflict: someone else bumped the version (or the row vanished).
          return await resolveConflict({ reason, retry: _allowRetryOnConflict });
        }
        localVersion = data[0].version;
        backoff = BACKOFF_MIN_MS;
        if (dirty) { pushing = null; return pushNow({ reason: 'push-again' }); }
        setStatus('synced', { reason, outcome: 'pushed', version: localVersion });
        return 'pushed';
      } catch (e) {
        dirty = true;
        if (isNetworkError(e)) { setStatus('offline', { reason, message: e.message }); scheduleRetry(); }
        else setStatus('error', { reason, message: e.message });
        throw e;
      } finally {
        pushing = null;
      }
    })();
    return pushing;
  }

  async function resolveConflict({ reason, retry }) {
    const row = await fetchRow();
    const local = getState();
    if (!row) {
      localVersion = await insertRow(local);
      setStatus('conflict-resolved', { reason, outcome: 'recreated', version: localVersion });
      return 'recreated';
    }
    const serverTs = tsOf(row.updated_at);
    const localTs = tsOf(localUpdatedAt(local));
    localVersion = row.version;
    if (serverTs >= localTs) {
      // Server is newer (or same instant): server wins, local is replaced.
      applyState(row.state);
      dirty = false;
      setStatus('conflict-resolved', { reason, outcome: 'server-won', version: localVersion });
      return 'server-won';
    }
    // Local is newer: re-push exactly once against the fresh version.
    if (!retry) {
      dirty = true;
      setStatus('error', { reason, message: 'conflict persisted after retry' });
      return 'conflict-unresolved';
    }
    pushing = null;
    const r = await pushNow({ reason: 'conflict-repush', _allowRetryOnConflict: false });
    if (r === 'pushed') setStatus('conflict-resolved', { reason, outcome: 'local-won', version: localVersion });
    return r === 'pushed' ? 'local-won' : r;
  }

  // ---------------------------------------------------------------------------
  // scheduling: debounce, flush, retry
  // ---------------------------------------------------------------------------
  function scheduleSave() {
    dirty = true;
    if (!session) return;
    if (debounceTimer) clearT(debounceTimer);
    debounceTimer = setT(() => {
      debounceTimer = null;
      pushNow({ reason: 'debounced' }).catch(() => {});
    }, debounceMs);
  }

  async function flush() {
    if (debounceTimer) { clearT(debounceTimer); debounceTimer = null; }
    if (!session || !dirty) return;
    flushing = true;
    try { await pushNow({ reason: 'flush' }); } catch { /* local copy is safe; retry later */ } finally { flushing = false; }
  }

  function scheduleRetry() {
    if (retryTimer) return;
    const wait = backoff;
    backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
    retryTimer = setT(() => {
      retryTimer = null;
      if (!session) return;
      const op = localVersion == null ? pullAndReconcile({ reason: 'retry' }) : (dirty ? pushNow({ reason: 'retry' }) : Promise.resolve());
      op.catch(() => {});
    }, wait);
  }

  // ---------------------------------------------------------------------------
  // auth
  // ---------------------------------------------------------------------------
  function landing() {
    return redirectTo ?? (typeof location !== 'undefined' ? location.origin + location.pathname : undefined);
  }

  async function signInWithEmail(email) {
    await ready;
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: landing() } });
    if (error) throw error;
    return true;
  }

  async function signInWithOAuth(provider) {
    await ready;
    if (provider !== 'apple' && provider !== 'google') throw new Error('provider must be "apple" or "google"');
    const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: landing() } });
    if (error) throw error;
    return true; // browser navigates away
  }

  async function signOut() {
    await ready;
    await flush();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  function user() {
    return session?.user ?? null;
  }

  // ---------------------------------------------------------------------------
  // ai(body) — drop-in for the prototype's aiFetch(body)
  // ---------------------------------------------------------------------------
  async function ai(body) {
    await ready;
    if (!session) {
      const e = new Error('Sign in to use AI features.');
      e.code = 'signed-out';
      throw e;
    }
    // Refresh if the token is about to expire; supabase-js handles rotation.
    const { data } = await client.auth.getSession();
    const token = data?.session?.access_token ?? session.access_token;
    const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${aiFunction}`;
    const res = await rawFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { error: 'non_json_response', body: text }; }
    if (!res.ok) {
      const e = new Error(json?.message ?? json?.error?.message ?? json?.error ?? `AI request failed (${res.status})`);
      e.status = res.status;
      e.code = json?.error ?? (res.status === 429 ? 'daily_ai_budget_exceeded' : 'ai_error');
      e.body = json;
      throw e;
    }
    return json;
  }

  return {
    ready,
    signInWithEmail,
    signInWithOAuth,
    signOut,
    user,
    scheduleSave,
    flush,
    pull: () => pullAndReconcile({ reason: 'manual' }),
    push: () => pushNow({ reason: 'manual' }),
    ai,
    get status() { return status; },
    get version() { return localVersion; },
    get dirty() { return dirty; },
    get clientId() { return clientId; },
    get client() { return client; },
    _log: log,
  };
}

export default createSync;
