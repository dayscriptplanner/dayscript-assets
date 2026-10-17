// DayScript — `ai` edge function (Deno / Supabase Edge Runtime)
//
// The ONLY place the Anthropic key lives. The browser calls this with the
// user's Supabase session token; we verify it, meter per user per day,
// forward to the Anthropic Messages API, and return the JSON unchanged.
//
// Drop-in for the prototype's `aiFetch(body)`: the body you'd have sent to
// https://api.anthropic.com/v1/messages is exactly what you POST here
// (model/max_tokens are capped server-side; the handwriting PNG image block
// from `inkPng()` passes straight through).
//
// Secrets (set with `supabase secrets set ...`):
//   ANTHROPIC_API_KEY   required
//   APP_ORIGIN          comma-separated list of allowed browser origins,
//                       e.g. "https://app.dayscriptplanner.org,http://localhost:5173"
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY  are injected by Supabase.
//
// Deploy:  supabase functions deploy ai --no-verify-jwt=false
// (verify_jwt on means the gateway already rejects requests without a valid
//  JWT; we verify again here with getUser() so we also get the user id.)

import { createClient } from "npm:@supabase/supabase-js@2.49.4";

// ---- limits -----------------------------------------------------------------
const DAILY_CALLS = Number(Deno.env.get("AI_DAILY_CALLS") ?? 60);
const DAILY_INPUT_TOKENS = Number(Deno.env.get("AI_DAILY_INPUT_TOKENS") ?? 40_000);
const MAX_TOKENS_CAP = 400;
const DEFAULT_MODEL = Deno.env.get("AI_MODEL") ?? "claude-sonnet-5-5";
const ALLOWED_MODEL_PREFIX = "claude-"; // refuse anything that isn't an Anthropic model id
const MAX_BODY_BYTES = 1_500_000; // ~1.1 MB base64 PNG + text
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// ---- CORS -------------------------------------------------------------------
const allowedOrigins = (Deno.env.get("APP_ORIGIN") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req: Request, status: number, body: unknown, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      ...extra,
    },
  });
}

// ---- types (just enough to validate the shape we forward) -------------------
type ContentBlock =
  | { type: "text"; text: string }
  | {
    type: "image";
    source: { type: "base64"; media_type: string; data: string };
  };
interface MessagesBody {
  model?: string;
  max_tokens?: number;
  system?: string;
  temperature?: number;
  messages: { role: "user" | "assistant"; content: string | ContentBlock[] }[];
  stream?: boolean;
}

function roughInputTokens(body: MessagesBody): number {
  // Cheap pre-flight estimate so we can refuse before calling Anthropic.
  // Text ≈ 4 chars/token; an image is ~1.5k tokens at planner-page size.
  let chars = (body.system ?? "").length;
  let images = 0;
  for (const m of body.messages) {
    if (typeof m.content === "string") chars += m.content.length;
    else {
      for (const b of m.content) {
        if (b.type === "text") chars += b.text.length;
        else if (b.type === "image") images++;
      }
    }
  }
  return Math.ceil(chars / 4) + images * 1500;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---- handler ----------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, 405, { error: "method_not_allowed" });
  }

  const origin = req.headers.get("origin");
  if (origin && allowedOrigins.length && !allowedOrigins.includes(origin)) {
    return json(req, 403, { error: "origin_not_allowed", origin });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(req, 500, { error: "server_misconfigured", detail: "ANTHROPIC_API_KEY missing" });

  // 1. Who is calling? Verify the Supabase JWT.
  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(req, 401, { error: "unauthorized", detail: "missing bearer token" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !user) {
    return json(req, 401, { error: "unauthorized", detail: userErr?.message ?? "invalid token" });
  }

  // 2. Parse + sanity-check the body.
  const lenHeader = Number(req.headers.get("content-length") ?? 0);
  if (lenHeader > MAX_BODY_BYTES) return json(req, 413, { error: "payload_too_large" });
  let body: MessagesBody;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json(req, 413, { error: "payload_too_large" });
    body = JSON.parse(text);
  } catch {
    return json(req, 400, { error: "bad_json" });
  }
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return json(req, 400, { error: "bad_request", detail: "messages[] required" });
  }
  for (const m of body.messages) {
    if (Array.isArray(m.content)) {
      for (const b of m.content) {
        if (b.type === "image") {
          if (b.source?.type !== "base64" || !/^image\/(png|jpeg|webp|gif)$/.test(b.source.media_type)) {
            return json(req, 400, { error: "bad_request", detail: "image must be base64 png/jpeg/webp/gif" });
          }
        } else if (b.type !== "text") {
          return json(req, 400, { error: "bad_request", detail: `unsupported block type ${(b as { type: string }).type}` });
        }
      }
    }
  }

  const model = typeof body.model === "string" && body.model.startsWith(ALLOWED_MODEL_PREFIX)
    ? body.model
    : DEFAULT_MODEL;
  const maxTokens = Math.min(
    Math.max(1, Number(body.max_tokens) || MAX_TOKENS_CAP),
    MAX_TOKENS_CAP,
  );
  const estInput = roughInputTokens(body);

  // 3. Budget check (service role bypasses RLS — clients can only read ai_usage).
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const day = todayUtc();
  const { data: usage, error: usageErr } = await admin
    .from("ai_usage")
    .select("calls, input_tokens, output_tokens")
    .eq("user_id", user.id)
    .eq("day", day)
    .maybeSingle();
  if (usageErr) return json(req, 500, { error: "usage_lookup_failed", detail: usageErr.message });

  const calls = usage?.calls ?? 0;
  const inTok = usage?.input_tokens ?? 0;
  const outTok = usage?.output_tokens ?? 0;

  if (calls >= DAILY_CALLS || inTok + estInput > DAILY_INPUT_TOKENS) {
    const resetAt = new Date(`${day}T00:00:00Z`);
    resetAt.setUTCDate(resetAt.getUTCDate() + 1);
    return json(req, 429, {
      error: "daily_ai_budget_exceeded",
      message: "You've used today's AI allowance. It resets at midnight UTC.",
      limits: { calls: DAILY_CALLS, input_tokens: DAILY_INPUT_TOKENS },
      used: { calls, input_tokens: inTok, output_tokens: outTok },
      resets_at: resetAt.toISOString(),
    }, { "Retry-After": String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))) });
  }

  // 4. Forward to Anthropic (no streaming).
  const upstream = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: body.system,
      temperature: body.temperature,
      messages: body.messages,
      stream: false,
      metadata: { user_id: user.id }, // lets Anthropic-side abuse detection key on our user id
    }),
  });

  const text = await upstream.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { error: "upstream_non_json", body: text.slice(0, 500) };
  }

  // 5. Meter — count the call whether or not Anthropic succeeded, so a client
  //    can't burn budget by triggering errors for free; use real token usage if present.
  const u = (payload as { usage?: { input_tokens?: number; output_tokens?: number } })?.usage;
  const addIn = u?.input_tokens ?? estInput;
  const addOut = u?.output_tokens ?? 0;
  //    `ai_usage_increment` is an atomic upsert (see migration 0001), so two
  //    overlapping calls can't lose a count.
  const { data: metered, error: meterErr } = await admin.rpc("ai_usage_increment", {
    p_user_id: user.id,
    p_day: day,
    p_input_tokens: addIn,
    p_output_tokens: addOut,
  });
  if (meterErr) console.error("ai_usage_increment failed", meterErr.message);
  const callsNow = (metered as { calls?: number } | null)?.calls ?? calls + 1;

  return json(req, upstream.status, payload, {
    "X-DayScript-AI-Calls-Remaining": String(Math.max(0, DAILY_CALLS - callsNow)),
  });
});
