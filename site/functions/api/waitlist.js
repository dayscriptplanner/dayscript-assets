/**
 * POST /api/waitlist[?src=web|pdf|...]
 * Cloudflare Pages Function. Appends a waitlist signup to the KV namespace bound as WAITLIST.
 *
 * KV layout:
 *   email:<lowercased email>  -> JSON {email, ts, source, ua}   (one record per address; dedupes)
 *   count                      -> integer as string            (incremented on new signups only)
 *
 * Body: JSON {email, source?} or form-encoded email=...
 * Response: JSON {ok:true, already?:true} | {ok:false, error}
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function cleanSource(raw) {
  const s = String(raw || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 32);
  return s || 'web';
}

export async function onRequestPost({ request, env }) {
  if (!env.WAITLIST) {
    // KV not bound yet: tell the page honestly so it shows its fallback.
    return json({ ok: false, error: 'Waitlist storage is not configured.' }, 503);
  }

  const url = new URL(request.url);
  let email = '';
  let source = url.searchParams.get('src');

  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      const body = await request.json();
      email = body && body.email;
      if (!source && body && body.source) source = body.source;
    } else {
      const form = await request.formData();
      email = form.get('email');
      if (!source) source = form.get('source');
    }
  } catch (_) {
    return json({ ok: false, error: 'Could not read the request.' }, 400);
  }

  email = String(email || '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'That doesn’t look like an email address yet.' }, 400);
  }

  // Light abuse brake: 10 signups per IP per hour.
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const rlKey = `rl:${ip}:${Math.floor(Date.now() / 3600000)}`;
  const hits = parseInt((await env.WAITLIST.get(rlKey)) || '0', 10);
  if (hits >= 10) return json({ ok: false, error: 'Too many signups from this connection.' }, 429);
  await env.WAITLIST.put(rlKey, String(hits + 1), { expirationTtl: 3700 });

  const key = `email:${email}`;
  const existing = await env.WAITLIST.get(key);
  if (existing) return json({ ok: true, already: true });

  const record = {
    email,
    ts: new Date().toISOString(),
    source: cleanSource(source),
    ua: (request.headers.get('user-agent') || '').slice(0, 300),
  };
  await env.WAITLIST.put(key, JSON.stringify(record));

  // Best-effort counter (KV is eventually consistent; count.js can also recount from keys).
  const count = parseInt((await env.WAITLIST.get('count')) || '0', 10);
  await env.WAITLIST.put('count', String(count + 1));

  return json({ ok: true });
}

export async function onRequestGet() {
  return json({ ok: false, error: 'POST an email to join the waitlist.' }, 405);
}
