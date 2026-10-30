// DayScript — `billing-checkout`: start a Stripe Checkout session for DayScript Pro.
//
// POST { interval: "month" | "year" }  with the user's Supabase session token.
// → { url } to redirect the browser to Stripe's hosted checkout.
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, APP_ORIGIN.
// Deploy: supabase functions deploy billing-checkout
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { stripe, corsHeaders, json } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405, cors);
  if (!cors["Access-Control-Allow-Origin"] || cors["Access-Control-Allow-Origin"] !== origin) return json({ error: "origin" }, 403, cors);

  const auth = req.headers.get("authorization") ?? "";
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error } = await anon.auth.getUser();
  if (error || !user?.email) return json({ error: "sign in first" }, 401, cors);

  let interval = "month";
  try { const b = await req.json(); if (b?.interval === "year") interval = "year"; } catch { /* default */ }
  const price = interval === "year" ? Deno.env.get("STRIPE_PRICE_YEARLY") : Deno.env.get("STRIPE_PRICE_MONTHLY");
  if (!price) return json({ error: "billing not configured" }, 503, cors);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: sub } = await admin.from("subscriptions").select("stripe_customer_id, status").eq("user_id", user.id).maybeSingle();
  if (sub && ["active", "trialing", "past_due"].includes(sub.status)) return json({ error: "already pro", portal: true }, 409, cors);

  // Reuse the Stripe customer if we have one; otherwise create and remember it.
  let customer = sub?.stripe_customer_id as string | undefined;
  if (!customer) {
    const c = await stripe<{ id: string }>("/customers", { email: user.email, metadata: { user_id: user.id } }, "POST", `cust-${user.id}`);
    customer = c.id;
    await admin.from("subscriptions").upsert({ user_id: user.id, stripe_customer_id: customer, plan: "free", status: "none" }, { onConflict: "user_id" });
  }

  const appOrigin = origin!;
  const session = await stripe<{ url: string }>("/checkout/sessions", {
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: `${appOrigin}/?billing=success`,
    cancel_url: `${appOrigin}/?billing=cancel`,
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    customer_update: { address: "auto" },
    subscription_data: { metadata: { user_id: user.id } },
    metadata: { user_id: user.id },
  });
  return json({ url: session.url }, 200, cors);
});
