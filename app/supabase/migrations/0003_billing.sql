-- DayScript — migration 0003: billing (Stripe subscriptions, entitlements, account deletion audit)
--
-- Principles
--   * Stripe is the source of truth for money. This table is a cache written ONLY by the
--     `stripe-webhook` edge function (service role). Clients can read their own row, never write.
--   * The app decides features from `public.entitlements` (a view), not from Stripe objects.
--   * Free tier exists without a row: no row == plan 'free'.

-- ---------------------------------------------------------------------------
-- 1. subscriptions — one row per user, mirrors the Stripe subscription
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id   text unique,
  stripe_subscription_id text unique,
  plan                 text not null default 'free' check (plan in ('free','pro')),
  status               text not null default 'none'
                       check (status in ('none','trialing','active','past_due','canceled','unpaid','incomplete','incomplete_expired','paused')),
  price_id             text,
  interval             text check (interval in ('month','year')),
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at           timestamptz not null default now()
);

comment on table public.subscriptions is 'Cache of the user''s Stripe subscription. Written only by the stripe-webhook edge function. No row = free plan.';

create index if not exists subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

-- ---------------------------------------------------------------------------
-- 2. billing_events — idempotency log for Stripe webhooks (replay-safe)
-- ---------------------------------------------------------------------------
create table if not exists public.billing_events (
  id          text primary key,            -- Stripe event id (evt_…)
  type        text not null,
  received_at timestamptz not null default now()
);

comment on table public.billing_events is 'Every Stripe event id we have processed, so a replayed webhook is a no-op.';

-- ---------------------------------------------------------------------------
-- 3. account_deletions — audit trail (no personal data kept beyond the hash)
-- ---------------------------------------------------------------------------
create table if not exists public.account_deletions (
  id           bigint generated always as identity primary key,
  email_hash   text not null,               -- sha256(lower(email)); lets us answer "did you delete me?" without keeping the email
  requested_at timestamptz not null default now(),
  reason       text
);

comment on table public.account_deletions is 'Audit row written by the delete-account function right before the auth user is removed. Hash only.';

-- ---------------------------------------------------------------------------
-- 4. entitlements — what the app reads. One row per user, computed.
-- ---------------------------------------------------------------------------
create or replace view public.entitlements as
select
  u.id as user_id,
  coalesce(s.plan, 'free') as plan,
  coalesce(s.status, 'none') as status,
  -- "pro" is live while Stripe says so, including the grace window of past_due
  (coalesce(s.plan,'free') = 'pro' and coalesce(s.status,'none') in ('trialing','active','past_due')) as is_pro,
  s.current_period_end,
  s.cancel_at_period_end,
  case when coalesce(s.plan,'free') = 'pro' and coalesce(s.status,'none') in ('trialing','active','past_due')
       then 200 else 15 end as ai_daily_calls,          -- free: 15/day, pro: 200/day
  true  as can_sync,                                     -- sync is free at launch (decision 10-30); flip here if that changes
  (coalesce(s.plan,'free') = 'pro' and coalesce(s.status,'none') in ('trialing','active','past_due')) as can_calendar,
  (coalesce(s.plan,'free') = 'pro' and coalesce(s.status,'none') in ('trialing','active','past_due')) as can_share_cards
from auth.users u
left join public.subscriptions s on s.user_id = u.id
-- clients (auth.uid() set) see only their own row; the service role (auth.uid() null) sees all
where auth.uid() is null or u.id = auth.uid();

comment on view public.entitlements is 'Feature flags per user derived from the subscription cache. Definer view (needs auth.users) but self-filtering: a signed-in client only ever sees its own row.';

-- ---------------------------------------------------------------------------
-- 5. RLS — users read their own subscription; nobody writes from the client
-- ---------------------------------------------------------------------------
alter table public.subscriptions    enable row level security;
alter table public.billing_events   enable row level security;
alter table public.account_deletions enable row level security;

drop policy if exists "subscriptions: read own" on public.subscriptions;
create policy "subscriptions: read own" on public.subscriptions
  for select using (auth.uid() = user_id);
-- (no insert/update/delete policies: only the service role, used by edge functions, can write)

-- billing_events / account_deletions: service role only (no policies at all).

-- entitlements is a view; grant select so the anon/authenticated roles can query it (RLS of the
-- underlying table still filters). Clients must query `where user_id = auth.uid()`.
grant select on public.entitlements to authenticated;
revoke all on public.entitlements from anon;

-- ---------------------------------------------------------------------------
-- 6. helper for the AI function: today's remaining calls for a user
-- ---------------------------------------------------------------------------
create or replace function public.ai_calls_remaining(p_user uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select greatest(0,
    (select ai_daily_calls from public.entitlements where user_id = p_user)
    - coalesce((select calls from public.ai_usage where user_id = p_user and day = (now() at time zone 'utc')::date), 0)
  );
$$;

revoke all on function public.ai_calls_remaining(uuid) from public;
grant execute on function public.ai_calls_remaining(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7. touch trigger
-- ---------------------------------------------------------------------------
create or replace function public.subscriptions_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.subscriptions_touch();
