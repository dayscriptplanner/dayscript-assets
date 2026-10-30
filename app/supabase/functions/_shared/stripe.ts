// DayScript — tiny Stripe client for Deno edge functions (no SDK; fetch + form encoding).
// Shared by billing-checkout, billing-portal and stripe-webhook.

const STRIPE_URL = "https://api.stripe.com/v1";
const STRIPE_VERSION = "2024-06-20";

export function stripeKey(): string {
  const k = Deno.env.get("STRIPE_SECRET_KEY");
  if (!k) throw new Error("STRIPE_SECRET_KEY is not set");
  return k;
}

/** Encode nested objects the way Stripe's form API expects: a[b][c]=v, arrays as a[0]=v. */
export function form(params: Record<string, unknown>, prefix = ""): URLSearchParams {
  const out = new URLSearchParams();
  const walk = (v: unknown, key: string) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${key}[${i}]`));
    else if (typeof v === "object") Object.entries(v as Record<string, unknown>).forEach(([k, x]) => walk(x, key ? `${key}[${k}]` : k));
    else out.append(key, String(v));
  };
  walk(params, prefix);
  return out;
}

export async function stripe<T = Record<string, unknown>>(
  path: string,
  params: Record<string, unknown> = {},
  method: "POST" | "GET" | "DELETE" = "POST",
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${stripeKey()}`,
    "Stripe-Version": STRIPE_VERSION,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const body = method === "POST" ? form(params).toString() : undefined;
  const url = method !== "POST" && Object.keys(params).length ? `${STRIPE_URL}${path}?${form(params)}` : `${STRIPE_URL}${path}`;
  const res = await fetch(url, { method, headers, body });
  const json = await res.json();
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message ?? `Stripe ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

/** Verify a Stripe-Signature header (v1 scheme, HMAC-SHA256) with a 5-minute tolerance. */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string]));
  const t = parts["t"];
  const v1s = header.split(",").filter((p) => p.trim().startsWith("v1=")).map((p) => p.trim().slice(3));
  if (!t || v1s.length === 0) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  if (!Number.isFinite(age) || age > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // constant-time compare against each v1 candidate
  return v1s.some((v) => v.length === expected.length && timingSafeEqual(v, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ---- CORS + auth helpers shared with the ai function's conventions -------------
export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (Deno.env.get("APP_ORIGIN") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = origin && allowed.includes(origin) ? origin : allowed[0] ?? "";
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...extra } });
}
