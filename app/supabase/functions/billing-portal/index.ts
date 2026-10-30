// DayScript — `billing-portal`: open Stripe's customer portal (change card, cancel, invoices).
// POST (no body) with the user's session token → { url }.
// Secrets: STRIPE_SECRET_KEY, APP_ORIGIN.   Deploy: supabase functions deploy billing-portal
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { stripe, corsHeaders, json } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405, cors);
  if (!cors["Access-Control-Allow-Origin"] || cors["Access-Control-Allow-Origin"] !== origin) return json({ error: "origin" }, 403, cors);

  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("authorization") ?? "" } } });
  const { data: { user }, error } = await anon.auth.getUser();
  if (error || !user) return json({ error: "sign in first" }, 401, cors);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: sub } = await admin.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (!sub?.stripe_customer_id) return json({ error: "no billing account yet" }, 404, cors);

  const portal = await stripe<{ url: string }>("/billing_portal/sessions", { customer: sub.stripe_customer_id, return_url: `${origin}/?billing=portal` });
  return json({ url: portal.url }, 200, cors);
});
