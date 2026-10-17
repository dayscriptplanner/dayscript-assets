/**
 * GET /api/count?key=<ADMIN_KEY>            -> {ok:true, count, bySource:{web:n, pdf:n, ...}}
 * GET /api/count?key=<ADMIN_KEY>&list=1     -> same, plus the full list of signups (newest first)
 *
 * For Katie only. The key is compared to the ADMIN_KEY environment variable set on the Pages project.
 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: JSON_HEADERS });
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestGet({ request, env }) {
  if (!env.ADMIN_KEY) return json({ ok: false, error: 'ADMIN_KEY is not set on this Pages project.' }, 503);
  if (!env.WAITLIST) return json({ ok: false, error: 'WAITLIST KV namespace is not bound.' }, 503);

  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  if (!safeEqual(key, env.ADMIN_KEY)) return json({ ok: false, error: 'Nope.' }, 401);

  const wantList = url.searchParams.get('list') === '1';

  // Recount from the keys themselves so the number is always true, even if the counter drifts.
  const entries = [];
  let cursor;
  do {
    const page = await env.WAITLIST.list({ prefix: 'email:', cursor, limit: 1000 });
    for (const k of page.keys) entries.push(k.name);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const bySource = {};
  const list = [];
  if (wantList || entries.length <= 2000) {
    for (const name of entries) {
      const raw = await env.WAITLIST.get(name);
      if (!raw) continue;
      try {
        const rec = JSON.parse(raw);
        bySource[rec.source || 'web'] = (bySource[rec.source || 'web'] || 0) + 1;
        if (wantList) list.push(rec);
      } catch (_) { /* skip malformed */ }
    }
    list.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }

  const out = { ok: true, count: entries.length, bySource, asOf: new Date().toISOString() };
  if (wantList) out.signups = list;
  return json(out);
}
