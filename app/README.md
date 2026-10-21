# DayScript app — accounts, sync, and the AI proxy

This folder is build-order **step 2** (Supabase backend) and the client half of **step 3** (sync + AI proxy) for the DayScript web app. `planner.html` is the planner itself (decided 2026-10-21: the cloud-built prototype is the app; the older v11 artifact on the Mac is no longer on the critical path). It runs fully signed-out from a plain static server and switches sync on by itself once `config.js` holds real values.

```
app/
├── planner.html + planner.js         ← THE APP: cover, today, week, month, year, lists, clearing, archive, pen, companion
├── _headers                          ← CSP + HSTS etc. for the app.dayscriptplanner.org Pages project
├── make-demo.py                      ← builds dayscript-demo.html (single file, no sync) for sharing
├── dayscript-demo.html               ← the shareable demo (generated; don't edit by hand)
├── config.js                         ← the one file Katie edits (Supabase URL + anon key)
├── sync.js                           ← ES module: createSync({...}) — auth, pull/push, offline queue, ai()
├── sync.iife.js                      ← loader for a classic <script> page (the single-file prototype)
├── sync-demo.html                    ← throwaway test page to prove it against a real project
├── sync.test.mjs                     ← node --test app/sync.test.mjs
└── supabase/
    ├── migrations/0001_planners.sql  ← tables, triggers, RLS
    ├── migrations/0002_limits.sql    ← document size caps (run right after 0001)
    └── functions/ai/index.ts         ← Deno edge function: JWT check → daily budget → Anthropic
```

Ground rules baked in:

- **The planner works fully signed-out.** Free tier = one device, local autosave only. Nothing in `sync.js` runs a network call until there's a session, and every method is a safe no-op without one.
- **Local autosave is the source of truth.** The server is a mirror. If a push fails, the local copy is intact and gets retried.
- **State is opaque JSON.** The server stores `state jsonb` and never looks inside it. Newer-wins uses `state.meta.updatedAt` (client) vs `planners.updated_at` (server).
- **The Anthropic key never reaches the browser.** The app calls the `ai` edge function with the user's Supabase session; the function holds the key and meters usage per user per day.

---

## Katie's click-through (10 steps)

1. **Create the project.** Go to [supabase.com](https://supabase.com) → New project (free tier is fine). Name it `dayscript`, pick a strong database password (save it in your password manager — you only need it for CLI work), region **US East**. Wait ~2 minutes for it to provision.

2. **Run the migrations.** In the dashboard open **SQL Editor → New query**, paste the whole contents of `app/supabase/migrations/0001_planners.sql`, click **Run**. You should see "Success. No rows returned". Then do the same with `0002_limits.sql`. (CLI alternative: `supabase link --project-ref <ref>` then `supabase db push`.) Check **Table Editor** — you should now see `planners`, `planner_snapshots`, `ai_usage`, each with a shield icon (RLS on).

3. **Turn on Email magic links.** **Authentication → Providers → Email**: *Enable Email provider* ON, leave *Confirm email* at its default, and make sure the sign-in method is **Magic Link / OTP** (we never use passwords). You don't need to toggle anything else. Optional but recommended: **Authentication → Email Templates → Magic Link** — change the subject to "Your DayScript sign-in link". (Supabase's built-in mailer is rate-limited to a few emails/hour; before launch, add a custom SMTP under **Project Settings → Auth → SMTP** — Resend's free tier is the easiest.)

4. **Turn on Google.** In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create **OAuth client ID** (Web application). Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback` (copy it from the Google provider card in Supabase). Paste the **Client ID** and **Client secret** into **Authentication → Providers → Google**, enable, save. You'll also need an OAuth consent screen (External, app name "DayScript", your email, add your domain).

5. **Apple — can wait.** Sign in with Apple needs a paid Apple Developer account ($99/yr) and three things you paste into **Authentication → Providers → Apple**: a **Services ID** (e.g. `org.dayscriptplanner.web`, with the same Supabase callback URL as a Return URL), your **Team ID**, and a **Sign in with Apple key** (`.p8` file + its Key ID) which Supabase uses to generate the client secret. It is required by App Store rules *only once there is an iOS wrapper that offers any other social login*, so skip it for the December web launch; the Apple button in the app can be hidden until then.

6. **Set redirect URLs.** **Authentication → URL Configuration**: set **Site URL** to `https://app.dayscriptplanner.org`. Under **Redirect URLs** add:
   - `https://app.dayscriptplanner.org/**`
   - `http://localhost:5173/**` and `http://localhost:8000/**` (whichever local server you use)
   - `http://127.0.0.1:5500/**` if you use VS Code Live Server

7. **Deploy the AI edge function.** Install the CLI once (`brew install supabase/tap/supabase`), then from the repo root:
   ```sh
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase functions deploy ai --no-verify-jwt=false      # JWT verification ON (it's the default; the flag just makes it explicit)
   ```
   `--no-verify-jwt=false` means "do verify JWTs at the gateway". Never deploy this function with `--no-verify-jwt`.

8. **Set the function's secrets.** Still in the terminal:
   ```sh
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...            # from console.anthropic.com → API Keys (make a key named "dayscript-prod")
   supabase secrets set APP_ORIGIN=https://app.dayscriptplanner.org,http://localhost:5173
   ```
   Optional overrides: `AI_DAILY_CALLS` (default 60), `AI_DAILY_INPUT_TOKENS` (default 40000), `AI_MODEL` (default `claude-sonnet-5-5`). `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do not set them.

9. **Paste the two public values into the app.** **Project Settings → API**: copy **Project URL** and the **anon public** key into `app/config.js`. That's the only file you edit. **Never** paste the `service_role` key anywhere in `app/` — it bypasses all row security. It lives only inside Supabase.

10. **Prove it works.** Serve the `app/` folder locally (`python3 -m http.server 8000` inside `app/`, or Live Server), open `http://localhost:8000/sync-demo.html`, type your email, click *Email me a magic link*, click the link, and watch the status go `syncing → synced`. Edit the textarea; 1.5 s later it says `synced` again and the row appears in **Table Editor → planners**. Open the same page in a second browser, sign in with the same email, and confirm it pulls your edits. Click *Test AI* — you should get a JSON array back and a row in `ai_usage`.

---

## How it plugs into the prototype (for Claude)

The prototype is one HTML file with a global `state` object, a `save()` that writes `margin.planner.v1` to localStorage (1.2 s debounce + 20 s sweep + flush on hide/unload), `aiFetch(body)` as the single Anthropic caller, and `readTheDay()` as the one AI seam. Keep all of that; add sync beside it.

### 1. Load the module

Classic-script page (the prototype today):

```html
<script type="module" src="./config.js"></script>
<script src="./sync.iife.js"></script>
<script>
  window.addEventListener('dayscript-sync-ready', () => {
    window.sync = createSync({
      supabaseUrl: DAYSCRIPT_CONFIG.SUPABASE_URL,
      supabaseAnonKey: DAYSCRIPT_CONFIG.SUPABASE_ANON_KEY,
      getState: () => state,
      applyState: (s) => { state = s; save({ fromSync: true }); renderAll(); },
      onStatus: (s, d) => setSyncBadge(s, d),
    });
  });
</script>
```

If the page is ever converted to `<script type="module">`, import `createSync` from `./sync.js` directly and skip the IIFE.

### 2. `save()` → also `sync.scheduleSave()`

```js
function save({ fromSync = false } = {}) {
  if (!fromSync) state.meta.updatedAt = new Date().toISOString();   // prototype already does this
  /* existing localStorage / IndexedDB write */
  if (!fromSync && window.sync) sync.scheduleSave();                  // ← add
}
```

- `fromSync` prevents a server pull from re-stamping `updatedAt` and bouncing straight back up.
- `state.meta.updatedAt` **must** be an ISO string; it is the newer-wins key. If it's missing the module falls back to "now", which makes local always win on first sign-in — fine, but set it.
- Nothing else in `save()` changes. The 1.2 s local debounce and the 20 s sweep stay; `sync.scheduleSave()` has its own 1.5 s debounce on top, and its own flush on `visibilitychange`/`pagehide` (the prototype's existing flush can call `sync.flush()` too, harmlessly).

### 3. `aiFetch(body)` → `sync.ai(body)`

```js
async function aiFetch(body) {
  if (!window.sync || !sync.user()) throw Object.assign(new Error('Sign in to use AI'), { code: 'signed-out' });
  return sync.ai(body);   // same request body, same Messages-API JSON back
}
```

- `body` is exactly what the prototype already builds: `{ model?, max_tokens?, system?, messages:[...] }`, including the `image` block from `inkPng()` (base64 PNG). The edge function caps `max_tokens` at 400 and forces the model to `claude-sonnet-5-5` unless a `claude-*` id is sent.
- `parseLines()` and `readTheDay()` don't change — they still receive the Messages-API response.
- Errors: `e.code === 'signed-out'` → show the sign-in affordance; `e.status === 429` (`e.code === 'daily_ai_budget_exceeded'`, `e.body.resets_at`) → show "You've used today's AI allowance" and disable the AI button until then. Signed-out users simply don't get AI (it's a paid feature); the planner itself keeps working.

### 4. Sign-in affordance on the cover page

Add a small "Sync across devices" link/button on the cover. It opens a sheet with an email field (→ `sync.signInWithEmail(email)` then "check your email"), a Google button (→ `sync.signInWithOAuth('google')`), and an Apple button hidden behind a flag until the iOS wrapper. Show `sync.user()?.email` and a *Sign out* (→ `sync.signOut()`, which flushes first) when signed in. Drive a tiny status dot from `onStatus`:

| status | meaning | UI |
|---|---|---|
| `signed-out` | no session; local only | no dot / "Sync off" |
| `syncing` | request in flight | pulsing dot |
| `synced` | server == local | green dot |
| `offline` | network failed; retrying with backoff (2 s → 5 min) | grey dot "offline, will retry" |
| `conflict-resolved` | another device wrote first; newer copy kept (`detail.outcome` = `server-won` / `local-won`) | brief toast "Updated from your other device" when `server-won` |
| `error` | non-network failure (RLS, bad config) | red dot; log `detail.message` |

Also call `sync.pull()` on `visibilitychange → visible` so returning to a tab picks up the other device's writes.

### 5. Sync semantics (what the module actually does)

- **After sign-in:** `select state, updated_at, version` for me. No row → insert local. Server `updated_at` newer than local `meta.updatedAt` → `applyState(server)`. Local newer → push. Equal → in sync.
- **Push:** `update planners set state, updated_at, client_id where user_id = me and version = <last seen>`; the DB trigger bumps `version`. 0 rows affected → someone else wrote: pull, compare timestamps, server-newer → `applyState`, local-newer → re-push **once** against the fresh version.
- **Flush on hide/unload:** awaited `fetch` with `keepalive: true` when the body is < 60 KB. Not `navigator.sendBeacon`: it cannot send the `Authorization` header, so RLS would reject it. If the tab dies mid-flush the local copy is intact and the next session pushes it.
- **Offline:** any network failure sets `offline`, keeps `dirty = true`, retries with doubling backoff capped at 5 minutes, and immediately on the `online` event.
- **Snapshots:** every state-changing update archives the previous document into `planner_snapshots` (last 10 per user) server-side. There's no restore UI yet; `select * from planner_snapshots where user_id = auth.uid() order by created_at desc` is readable by the owner for a future "restore" feature.

### 6. Running the tests

```sh
node --test app/sync.test.mjs                   # 11 tests: newer-wins both ways, debounce, both conflict paths, offline backoff, flush, sign-out, ai()
deno check app/supabase/functions/ai/index.ts   # typecheck the edge function
```

The SQL was verified against Postgres 16 with a stubbed `auth` schema (RLS isolation, trigger version bump, snapshot prune to 10, service-role-only metering).
