// node --test app/sync.test.mjs
//
// Exercises sync.js against an in-memory fake of the `planners` table with the
// same semantics as the real one (version bump on update, `eq('version', n)`
// optimistic concurrency, newer-wins). No network, no supabase-js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSync } from './sync.js';

const USER = { id: 'u-1' };

// ---------------------------------------------------------------------------
// Fake Supabase: just enough of the PostgREST builder + auth surface.
// ---------------------------------------------------------------------------
function fakeSupabase({ row = null, failNext = 0 } = {}) {
  const db = { row: row ? { ...row } : null };
  const auth = { listeners: [], session: null };
  let failures = failNext;
  const calls = [];

  function builder() {
    const q = { op: null, payload: null, filters: [], single: false, maybe: false };
    const b = {
      select: (cols) => { if (!q.op) q.op = 'select'; q.cols = cols; return b; },
      insert: (p) => { q.op = 'insert'; q.payload = p; return b; },
      update: (p) => { q.op = 'update'; q.payload = p; return b; },
      eq: (k, v) => { q.filters.push([k, v]); return b; },
      maybeSingle: () => { q.maybe = true; return b; },
      single: () => { q.single = true; return b; },
      then: (res, rej) => Promise.resolve().then(run).then(res, rej),
    };
    function run() {
      calls.push({ op: q.op, filters: [...q.filters] });
      if (failures > 0) { failures--; throw new TypeError('Failed to fetch'); }
      const match = (r) => r && q.filters.every(([k, v]) => r[k] === v);
      if (q.op === 'select') {
        const r = match(db.row) ? db.row : null;
        return { data: r ? { state: r.state, updated_at: r.updated_at, version: r.version } : null, error: null };
      }
      if (q.op === 'insert') {
        if (db.row) return { data: null, error: { message: 'duplicate key' } };
        db.row = { ...q.payload, version: 1 };
        return { data: { version: 1 }, error: null };
      }
      if (q.op === 'update') {
        if (!match(db.row)) return { data: [], error: null }; // 0 rows affected
        db.row = { ...db.row, ...q.payload, version: db.row.version + 1 };
        return { data: [{ version: db.row.version }], error: null };
      }
      throw new Error('unknown op');
    }
    return b;
  }

  const client = {
    from: (t) => { assert.equal(t, 'planners'); return builder(); },
    auth: {
      onAuthStateChange: (fn) => { auth.listeners.push(fn); return { data: { subscription: { unsubscribe() {} } } }; },
      getSession: async () => ({ data: { session: auth.session } }),
      signOut: async () => { auth.session = null; auth.listeners.forEach((l) => l('SIGNED_OUT', null)); return { error: null }; },
      signInWithOtp: async () => ({ error: null }),
      signInWithOAuth: async () => ({ error: null }),
    },
  };
  function signIn() {
    auth.session = { user: USER, access_token: 'tok' };
    auth.listeners.forEach((l) => l('SIGNED_IN', auth.session));
  }
  // External writer (another device) bumping the row behind our back.
  function serverWrite(state, updated_at) {
    db.row = { ...db.row, state, updated_at, version: (db.row?.version ?? 0) + 1 };
  }
  return { client, db, calls, signIn, serverWrite, failMore: (n) => { failures += n; } };
}

// Manual timers so debounce/backoff are deterministic.
function fakeTimers() {
  let t = 0, id = 0;
  const q = [];
  return {
    now: () => t,
    setTimeout: (fn, ms) => { q.push({ id: ++id, at: t + ms, fn }); return id; },
    clearTimeout: (i) => { const k = q.findIndex((x) => x.id === i); if (k >= 0) q.splice(k, 1); },
    async advance(ms) {
      const until = t + ms;
      while (true) {
        q.sort((a, b) => a.at - b.at);
        if (!q.length || q[0].at > until) break;
        const n = q.shift(); t = n.at; n.fn();
        await new Promise((r) => setImmediate(r));
      }
      t = until;
      await new Promise((r) => setImmediate(r));
    },
    pending: () => q.length,
  };
}

function harness(fakeOpts, local) {
  const sb = fakeSupabase(fakeOpts);
  const timers = fakeTimers();
  let state = local;
  const statuses = [];
  const applied = [];
  const sync = createSync({
    supabaseUrl: 'https://x.supabase.co',
    supabaseAnonKey: 'anon',
    getState: () => state,
    applyState: (s) => { applied.push(s); state = s; },
    onStatus: (s, d) => statuses.push([s, d?.outcome ?? d?.reason ?? null]),
    clientId: 'test-device',
    _deps: {
      createClient: () => sb.client,
      fetch: async () => { throw new Error('ai fetch not mocked'); },
      now: timers.now,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
      target: null,
      winTarget: null,
    },
  });
  return { sb, timers, sync, statuses, applied, setState: (s) => { state = s; }, getState: () => state };
}

const flushMicro = () => new Promise((r) => setImmediate(r));

// ---------------------------------------------------------------------------
test('signed out: no network, scheduleSave is a no-op, status signed-out', async () => {
  const h = harness({}, { meta: { updatedAt: '2026-10-01T00:00:00Z' }, a: 1 });
  await h.sync.ready;
  h.sync.scheduleSave();
  await h.timers.advance(5000);
  assert.equal(h.sync.status, 'signed-out');
  assert.equal(h.sb.calls.length, 0);
  assert.equal(h.sync.dirty, true);
  await assert.rejects(h.sync.ai({ messages: [] }), /Sign in/);
});

test('first sign-in with no server row inserts local state', async () => {
  const local = { meta: { updatedAt: '2026-10-01T00:00:00Z' }, a: 1 };
  const h = harness({}, local);
  await h.sync.ready;
  h.sb.signIn();
  await flushMicro(); await flushMicro();
  assert.deepEqual(h.sb.db.row.state, local);
  assert.equal(h.sb.db.row.client_id, 'test-device');
  assert.equal(h.sync.version, 1);
  assert.equal(h.sync.status, 'synced');
  assert.equal(h.applied.length, 0);
});

test('newer-wins: server newer than local → applyState(server)', async () => {
  const server = { meta: { updatedAt: '2026-10-05T00:00:00Z' }, from: 'server' };
  const h = harness(
    { row: { user_id: 'u-1', state: server, updated_at: '2026-10-05T00:00:00Z', version: 7 } },
    { meta: { updatedAt: '2026-10-01T00:00:00Z' }, from: 'local' },
  );
  await h.sync.ready;
  h.sb.signIn();
  await flushMicro(); await flushMicro();
  assert.deepEqual(h.applied, [server]);
  assert.deepEqual(h.getState(), server);
  assert.equal(h.sync.version, 7);
  assert.equal(h.sb.db.row.version, 7, 'no push happened');
});

test('newer-wins: local newer than server → push local, version bumps', async () => {
  const local = { meta: { updatedAt: '2026-10-09T00:00:00Z' }, from: 'local' };
  const h = harness(
    { row: { user_id: 'u-1', state: { from: 'server' }, updated_at: '2026-10-05T00:00:00Z', version: 7 } },
    local,
  );
  await h.sync.ready;
  h.sb.signIn();
  await flushMicro(); await flushMicro(); await flushMicro();
  assert.equal(h.applied.length, 0);
  assert.deepEqual(h.sb.db.row.state, local);
  assert.equal(h.sb.db.row.version, 8);
  assert.equal(h.sync.version, 8);
  assert.equal(h.sync.status, 'synced');
});

test('scheduleSave debounces 1.5s and pushes once', async () => {
  const h = harness(
    { row: { user_id: 'u-1', state: { n: 0 }, updated_at: '2026-10-01T00:00:00Z', version: 1 } },
    { meta: { updatedAt: '2026-10-01T00:00:00Z' }, n: 0 },
  );
  await h.sync.ready;
  h.sb.signIn();
  await flushMicro(); await flushMicro();
  const before = h.sb.calls.length;
  h.setState({ meta: { updatedAt: '2026-10-02T00:00:00Z' }, n: 1 }); h.sync.scheduleSave();
  await h.timers.advance(1000);
  h.setState({ meta: { updatedAt: '2026-10-02T00:00:01Z' }, n: 2 }); h.sync.scheduleSave();
  await h.timers.advance(1000);
  assert.equal(h.sb.calls.length, before, 'nothing pushed before debounce elapses');
  await h.timers.advance(600);
  const updates = h.sb.calls.slice(before).filter((c) => c.op === 'update');
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].filters, [['user_id', 'u-1'], ['version', 1]]);
  assert.equal(h.sb.db.row.state.n, 2);
  assert.equal(h.sync.version, 2);
  assert.equal(h.sync.dirty, false);
});

test('conflict: another device wrote a NEWER state → server wins, conflict-resolved', async () => {
  const h = harness(
    { row: { user_id: 'u-1', state: { n: 0 }, updated_at: '2026-10-01T00:00:00Z', version: 1 } },
    { meta: { updatedAt: '2026-10-01T00:00:00Z' }, n: 0 },
  );
  await h.sync.ready;
  h.sb.signIn();
  await flushMicro(); await flushMicro();
  // other device writes later-dated state; our version (1) is now stale.
  const other = { meta: { updatedAt: '2026-10-03T00:00:00Z' }, n: 'other' };
  h.sb.serverWrite(other, '2026-10-03T00:00:00Z'); // version → 2
  h.setState({ meta: { updatedAt: '2026-10-02T00:00:00Z' }, n: 'mine' }); h.sync.scheduleSave();
  await h.timers.advance(1600);
  assert.deepEqual(h.applied, [other]);
  assert.equal(h.sb.db.row.state.n, 'other', 'our stale write was rejected');
  assert.equal(h.sync.version, 2);
  assert.ok(h.statuses.some(([s, o]) => s === 'conflict-resolved' && o === 'server-won'), JSON.stringify(h.statuses));
});

test('conflict: another device wrote an OLDER state → re-push once, local wins', async () => {
  const h = harness(
    { row: { user_id: 'u-1', state: { n: 0 }, updated_at: '2026-10-01T00:00:00Z', version: 1 } },
    { meta: { updatedAt: '2026-10-01T00:00:00Z' }, n: 0 },
  );
  await h.sync.ready;
  h.sb.signIn();
  await flushMicro(); await flushMicro();
  h.sb.serverWrite({ n: 'other' }, '2026-10-02T00:00:00Z'); // version → 2
  const mine = { meta: { updatedAt: '2026-10-04T00:00:00Z' }, n: 'mine' };
  h.setState(mine); h.sync.scheduleSave();
  await h.timers.advance(1600);
  const updates = h.sb.calls.filter((c) => c.op === 'update');
  assert.equal(updates.length, 2, 'stale update then one re-push');
  assert.deepEqual(updates[0].filters[1], ['version', 1]);
  assert.deepEqual(updates[1].filters[1], ['version', 2]);
  assert.equal(h.applied.length, 0);
  assert.deepEqual(h.sb.db.row.state, mine);
  assert.equal(h.sb.db.row.version, 3);
  assert.equal(h.sync.version, 3);
  assert.ok(h.statuses.some(([s, o]) => s === 'conflict-resolved' && o === 'local-won'));
});

test('offline: failed push → status offline, retries with backoff, local stays dirty', async () => {
  const h = harness(
    { row: { user_id: 'u-1', state: { n: 0 }, updated_at: '2026-10-01T00:00:00Z', version: 1 } },
    { meta: { updatedAt: '2026-10-01T00:00:00Z' }, n: 0 },
  );
  await h.sync.ready;
  h.sb.signIn();
  await flushMicro(); await flushMicro();
  h.sb.failMore(2); // next two requests fail
  h.setState({ meta: { updatedAt: '2026-10-02T00:00:00Z' }, n: 1 }); h.sync.scheduleSave();
  await h.timers.advance(1600);
  assert.equal(h.sync.status, 'offline');
  assert.equal(h.sync.dirty, true);
  assert.equal(h.sb.db.row.state.n, 0);
  await h.timers.advance(2000); // first retry (2s) also fails
  assert.equal(h.sync.status, 'offline');
  await h.timers.advance(4000); // second retry (4s) succeeds
  assert.equal(h.sync.status, 'synced');
  assert.equal(h.sb.db.row.state.n, 1);
  assert.equal(h.sync.dirty, false);
});

test('flush pushes pending changes immediately (hide/pagehide path)', async () => {
  const h = harness(
    { row: { user_id: 'u-1', state: { n: 0 }, updated_at: '2026-10-01T00:00:00Z', version: 1 } },
    { meta: { updatedAt: '2026-10-01T00:00:00Z' }, n: 0 },
  );
  await h.sync.ready;
  h.sb.signIn();
  await flushMicro(); await flushMicro();
  h.setState({ meta: { updatedAt: '2026-10-02T00:00:00Z' }, n: 5 }); h.sync.scheduleSave();
  await h.sync.flush();
  assert.equal(h.sb.db.row.state.n, 5);
  assert.equal(h.timers.pending(), 0, 'debounce timer was cancelled');
});

test('sign out → signed-out, scheduleSave no longer hits the network', async () => {
  const h = harness(
    { row: { user_id: 'u-1', state: { n: 0 }, updated_at: '2026-10-01T00:00:00Z', version: 1 } },
    { meta: { updatedAt: '2026-10-01T00:00:00Z' }, n: 0 },
  );
  await h.sync.ready;
  h.sb.signIn();
  await flushMicro(); await flushMicro();
  await h.sync.signOut();
  assert.equal(h.sync.status, 'signed-out');
  assert.equal(h.sync.user(), null);
  const n = h.sb.calls.length;
  h.sync.scheduleSave();
  await h.timers.advance(3000);
  assert.equal(h.sb.calls.length, n);
});

test('ai(body) posts to the edge function with the session token; 429 surfaces a clear error', async () => {
  const seen = [];
  const sb = fakeSupabase({ row: { user_id: 'u-1', state: {}, updated_at: '2026-10-01T00:00:00Z', version: 1 } });
  let nextStatus = 200;
  const sync = createSync({
    supabaseUrl: 'https://x.supabase.co/',
    supabaseAnonKey: 'anon',
    getState: () => ({ meta: { updatedAt: '2026-10-01T00:00:00Z' } }),
    applyState: () => {},
    clientId: 'c',
    _deps: {
      createClient: () => sb.client,
      target: null, winTarget: null,
      fetch: async (url, init) => {
        seen.push({ url, init });
        const body = nextStatus === 200
          ? { content: [{ type: 'text', text: '["Call the dentist"]' }], usage: { input_tokens: 10, output_tokens: 5 } }
          : { error: 'daily_ai_budget_exceeded', message: "You've used today's AI allowance." };
        return { ok: nextStatus === 200, status: nextStatus, text: async () => JSON.stringify(body) };
      },
    },
  });
  await sync.ready;
  sb.signIn();
  await flushMicro(); await flushMicro();
  const out = await sync.ai({ messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(out.content[0].text, '["Call the dentist"]');
  assert.equal(seen[0].url, 'https://x.supabase.co/functions/v1/ai');
  assert.equal(seen[0].init.headers.Authorization, 'Bearer tok');
  assert.equal(seen[0].init.headers.apikey, 'anon');
  nextStatus = 429;
  await assert.rejects(sync.ai({ messages: [] }), (e) => e.status === 429 && e.code === 'daily_ai_budget_exceeded' && /allowance/.test(e.message));
});
