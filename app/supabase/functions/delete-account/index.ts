// DayScript — `delete-account`: the "Delete my account" button.
//
// POST { confirm: "delete" } with the user's session token.
// 1. cancels any live Stripe subscription immediately (no further charges),
// 2. writes an audit row (email hash only),
// 3. deletes the auth user — planners, snapshots, ai_usage, subscriptions cascade.
// The client then clears localStorage and signs out.
// Secrets: STRIPE_SECRET_KEY (optional — skipped if unset), APP_ORIGIN.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { stripe, corsHeaders, json } from "../_shared/stripe.ts";

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405, cors);
  if (!cors["Access-Control-Allow-Origin"] || cors["Access-Control-Allow-Origin"] !== origin) return json({ error: "origin" }, 403, cors);

  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("authorization") ?? "" } } });
  const { data: { user }, error } = await anon.auth.getUser();
  if (error || !user) return json({ error: "sign in first" }, 401, cors);

  let body: { confirm?: string; reason?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  if (body.confirm !== "delete") return json({ error: "confirmation required" }, 400, cors);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1. stop billing
  if (Deno.env.get("STRIPE_SECRET_KEY")) {
    const { data: sub } = await admin.from("subscriptions").select("stripe_subscription_id, status").eq("user_id", user.id).maybeSingle();
    if (sub?.stripe_subscription_id && ["trialing", "active", "past_due", "unpaid"].includes(sub.status)) {
      try { await stripe(`/subscriptions/${sub.stripe_subscription_id}`, { prorate: false }, "DELETE"); }
      catch (e) { console.error("stripe cancel failed", e); /* continue — the user asked to leave */ }
    }
  }

  // 2. audit (hash only)
  await admin.from("account_deletions").insert({ email_hash: await sha256((user.email ?? "").toLowerCase()), reason: (body.reason ?? "").slice(0, 200) || null });

  // 3. delete the user; FKs cascade everything else
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) { console.error("deleteUser", delErr); return json({ error: "could not delete" }, 500, cors); }
  return json({ ok: true }, 200, cors);
});
