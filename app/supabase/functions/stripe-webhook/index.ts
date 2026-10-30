// DayScript — `stripe-webhook`: the ONLY writer of public.subscriptions.
//
// Stripe → POST here (no JWT; verified by signature instead).
// Deploy with JWT verification OFF for this one function:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (whsec_…).
// Stripe dashboard → Developers → Webhooks → endpoint = this function URL, events:
//   checkout.session.completed, customer.subscription.created, customer.subscription.updated,
//   customer.subscription.deleted, invoice.payment_failed, invoice.paid
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { stripe, verifyStripeSignature, json } from "../_shared/stripe.ts";

type Sub = {
  id: string; customer: string; status: string; cancel_at_period_end: boolean;
  current_period_end: number; metadata?: { user_id?: string };
  items: { data: Array<{ price: { id: string; recurring?: { interval?: string } } }> };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return json({ error: "webhook secret missing" }, 503);
  const payload = await req.text();
  if (payload.length > 1_000_000) return json({ error: "too large" }, 413);
  if (!(await verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret))) return json({ error: "bad signature" }, 400);

  const event = JSON.parse(payload) as { id: string; type: string; data: { object: Record<string, unknown> } };
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Idempotency: insert the event id first; a duplicate means we've handled it.
  const { error: dup } = await admin.from("billing_events").insert({ id: event.id, type: event.type });
  if (dup) return json({ ok: true, duplicate: true });

  const obj = event.data.object;
  let sub: Sub | null = null;
  if (event.type.startsWith("customer.subscription.")) sub = obj as unknown as Sub;
  else if (event.type === "checkout.session.completed" && obj["subscription"]) sub = await stripe<Sub>(`/subscriptions/${obj["subscription"]}`, {}, "GET");
  else if ((event.type === "invoice.payment_failed" || event.type === "invoice.paid") && obj["subscription"]) sub = await stripe<Sub>(`/subscriptions/${obj["subscription"]}`, {}, "GET");
  if (!sub) return json({ ok: true, ignored: event.type });

  // Find the user: metadata first, then by customer id.
  let userId = sub.metadata?.user_id;
  if (!userId) {
    const { data } = await admin.from("subscriptions").select("user_id").eq("stripe_customer_id", sub.customer).maybeSingle();
    userId = data?.user_id;
  }
  if (!userId) { console.error("webhook: no user for customer", sub.customer); return json({ ok: true, orphan: true }); }

  const price = sub.items?.data?.[0]?.price;
  const live = ["trialing", "active", "past_due"].includes(sub.status);
  const row = {
    user_id: userId,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    plan: live ? "pro" : "free",
    status: sub.status,
    price_id: price?.id ?? null,
    interval: price?.recurring?.interval ?? null,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
  };
  const { error } = await admin.from("subscriptions").upsert(row, { onConflict: "user_id" });
  if (error) { console.error("webhook upsert", error); return json({ error: "db" }, 500); }
  return json({ ok: true });
});
