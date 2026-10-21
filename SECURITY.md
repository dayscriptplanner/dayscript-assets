# DayScript — security

What protects people's pages, what it costs them (nothing visible), and the handful of
switches only Katie can flip. Reviewed 2026-10-21. Re-read before every launch.

## The shape of the risk

DayScript stores one thing worth protecting: a person's planner. It is personal (plans,
moods, gratitude, handwriting), not regulated (no payments, no health records, no children's
accounts). The threats that matter, in order:

1. **Someone reads or changes another person's planner.** Prevented by Postgres row-level
   security: every table is `force row level security`, and every policy is `auth.uid() = user_id`.
   The service-role key, which bypasses RLS, exists only inside the Supabase edge function.
2. **Someone burns our Anthropic bill.** The key never reaches a browser. The `ai` edge
   function requires a valid session, meters 60 calls / 40k input tokens per user per day,
   caps `max_tokens` at 400, refuses non-Anthropic model ids, streaming, oversized bodies,
   long transcripts and odd content blocks.
3. **Account takeover.** Sign-in is magic link or Google (no passwords to leak). Redirects
   are allow-listed in Supabase. Anyone who gets into the Supabase, Cloudflare or GitHub
   dashboards owns everything, so those four accounts carry the real weight (see "Katie's
   switches").
4. **Script injection in the app.** Every user-typed string passes through `esc()` before it
   is put on the page; the only HTML the page builds from data is its own. A strict
   Content-Security-Policy (no inline scripts, scripts only from self + jsDelivr for
   supabase-js, connections only to self + Supabase) is set in `app/_headers` and mirrored
   as a `<meta>` so it holds even on a plain static host.
5. **The waitlist.** Emails sit in Cloudflare KV, written only by the Pages Function, with a
   10-per-IP-per-hour brake. Reading the list needs `ADMIN_KEY` (constant-time compare,
   sent as a Bearer header). The site has no third-party scripts or fonts at all.

## What is in the code

| Where | Control |
|---|---|
| `app/supabase/migrations/0001_planners.sql` | RLS on + forced on all three tables; owner-only CRUD on `planners`; read-only history; `ai_usage` written only by service role; `ai_usage_increment` executable only by `service_role`; snapshot trigger is `security definer` with pinned `search_path` |
| `app/supabase/migrations/0002_limits.sql` | 4 MB cap on a planner document; `client_id` ≤ 64 chars |
| `app/supabase/functions/ai/index.ts` | JWT verified twice (gateway + `getUser`); origin allow-list; 1.5 MB body cap; ≤ 24 messages; system ≤ 8k chars; temperature clamped 0–1; image blocks must be base64 png/jpeg/webp/gif; calls counted even when upstream fails |
| `app/sync.js` | Only the anon key ships; every request carries the user's JWT so RLS applies; flush uses `fetch keepalive` (never `sendBeacon`, which can't carry auth); offline backoff capped at 5 min |
| `app/planner.html` + `app/_headers` | CSP, HSTS, `frame-ancestors 'none'`, `nosniff`, referrer policy, permissions policy; no inline script (`planner.js`) |
| `app/config.js` | Holds only the project URL and anon key. The service-role key must never be committed; GitHub secret-scanning + push protection are on for this public repo |
| `site/public/_headers` | CSP `default-src 'self'` with no exceptions; HSTS; frame-ancestors none |
| `site/functions/api/waitlist.js` | Email validated server-side; per-IP hourly brake; dedupes; stores email, time, source and a trimmed user-agent only |
| `site/functions/api/count.js` | `Authorization: Bearer <ADMIN_KEY>`; constant-time compare; `cache-control: no-store` |

## Katie's switches (dashboard-only, ~25 minutes once)

Do these the same day the Supabase and Cloudflare projects are created.

**Every account that can reach production: turn on two-factor.** Supabase, Cloudflare,
GitHub (`dayscriptplanner`), the Google account behind the OAuth client, Anthropic Console,
Etsy. Use an authenticator app, not SMS. Store recovery codes in the password manager.

**Supabase**
- Authentication → Rate Limits: leave the defaults (they cap magic-link emails per hour).
- Authentication → URL Configuration: Site URL `https://app.dayscriptplanner.org`, redirect
  list exactly as `app/README.md` step 6. Nothing with a wildcard host.
- Project Settings → API: never copy the `service_role` key anywhere but
  `supabase secrets set`. If it is ever pasted into a chat, file or screenshot, rotate it
  (Project Settings → API → Reset).
- Project Settings → Auth → SMTP: add Resend before the Nov 24 soft launch (the built-in
  mailer is rate-limited and its links are easy to mistake for phishing).
- Database → Backups: free tier keeps daily backups for 7 days; that plus `planner_snapshots`
  is enough for launch.

**Cloudflare (both Pages projects + the domain)**
- SSL/TLS → Edge Certificates: **Always Use HTTPS** on, **HSTS** on (the `_headers` files
  also send it), minimum TLS 1.2.
- DNS: **DNSSEC** on.
- Security → Bots: **Bot Fight Mode** on. If the waitlist ever gets junk signups, add
  Turnstile to the form (one line in `app.js`, one in the function).
- Pages → Settings → Environment variables: `ADMIN_KEY` as a *secret*, 32+ random characters
  (`openssl rand -base64 32`). Rotate if shared.

**GitHub**
- Settings → Code security: secret scanning and push protection are already on. Turn on
  **Dependabot security updates** too (one toggle).
- The repo is public on purpose (it hosts the social images). That is fine as long as no
  key is ever committed; the scanners above are the safety net.

**Anthropic Console**
- Make a key named `dayscript-prod` used only by the edge function. Set a monthly spend
  limit on the organization (Settings → Limits) so a bug can't run up a bill overnight.

## Rules for Claude (and anyone else who edits this repo)

- Never commit a secret. `config.js` gets the anon key only.
- Never add a script, font or stylesheet from a new host without widening the CSP on
  purpose and saying why in the commit.
- Every string a person typed goes through `esc()` before it touches `innerHTML`.
- RLS policies are written as `auth.uid() = user_id`. No policy is ever `using (true)`.
- Edge functions deploy with JWT verification on. `--no-verify-jwt` is never used.
- When in doubt, the planner must keep working signed-out and offline; security features
  fail closed on the server and fail *open* for local-only use.

## Before launch (Nov 17 freeze)

- [ ] Privacy page live at `/privacy` on both sites (what we store, that pages are yours,
      how to delete: "sign out and delete" wipes the row; email us for anything else).
- [ ] Account deletion path tested: `delete from planners` via the owner policy + Supabase
      user deletion.
- [ ] `curl -I https://app.dayscriptplanner.org` shows every header in `app/_headers`.
- [ ] Mozilla Observatory (observatory.mozilla.org) grade A on both hostnames.
- [ ] Rotate `ADMIN_KEY` and the Anthropic key once, so launch keys never appeared in a chat.
