-- DayScript — migration 0001: planners, snapshots, AI metering
--
-- The whole planner is ONE opaque JSON document per user (see dayscript-spec §6 / §Persistence).
-- The server never reshapes `state`; it only stores it, versions it, and keeps a short history.
--
-- Run in the Supabase SQL editor, or `supabase db push`. Idempotent where practical.

-- ---------------------------------------------------------------------------
-- 1. planners — one row per user, the live state document
-- ---------------------------------------------------------------------------
create table if not exists public.planners (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  version    integer     not null default 1,
  client_id  text                                      -- which device wrote last (diagnostics only)
);

comment on table  public.planners           is 'One opaque JSON planner document per user. Last-write-wins on updated_at; version is for optimistic concurrency.';
comment on column public.planners.version   is 'Incremented by trigger on every update. Clients send `where version = <seen>`; 0 rows affected means someone else wrote first.';
comment on column public.planners.client_id is 'Opaque per-device id the client sends. Helps debug which device last pushed.';

-- ---------------------------------------------------------------------------
-- 2. planner_snapshots — last ~10 versions per user, written only by trigger
-- ---------------------------------------------------------------------------
create table if not exists public.planner_snapshots (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  state      jsonb       not null,
  version    integer     not null,
  created_at timestamptz not null default now()
);

create index if not exists planner_snapshots_user_created_idx
  on public.planner_snapshots (user_id, created_at desc);

comment on table public.planner_snapshots is 'History of planner states (previous value captured on each update). Pruned to the newest 10 per user by trigger.';

-- ---------------------------------------------------------------------------
-- 3. ai_usage — per-user, per-day metering for the AI edge function
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  user_id       uuid    not null references auth.users (id) on delete cascade,
  day           date    not null default (now() at time zone 'utc')::date,
  calls         integer not null default 0,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  primary key (user_id, day)
);

comment on table public.ai_usage is 'Daily AI call/token counters per user. Written only by the `ai` edge function via the service role.';

-- ---------------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------------

-- 4a. planners: bump version + updated_at on every UPDATE.
--     Clients MAY send updated_at (their local meta.updatedAt) so the server
--     keeps the client's clock for last-write-wins; if they don't, we stamp now().
create or replace function public.planners_touch()
returns trigger
language plpgsql
as $$
begin
  new.version := old.version + 1;
  if new.updated_at is null or new.updated_at = old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists planners_touch_trg on public.planners;
create trigger planners_touch_trg
  before update on public.planners
  for each row execute function public.planners_touch();

-- 4b. planners: after every UPDATE, archive the PREVIOUS state as a snapshot,
--     then prune to the newest 10 per user.
--     SECURITY DEFINER so the owner's RLS (no INSERT on snapshots) doesn't block it.
create or replace function public.planners_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip no-op writes (same document pushed twice).
  if old.state is not distinct from new.state then
    return new;
  end if;

  insert into public.planner_snapshots (user_id, state, version, created_at)
  values (old.user_id, old.state, old.version, old.updated_at);

  delete from public.planner_snapshots s
  using (
    select id
    from public.planner_snapshots
    where user_id = old.user_id
    order by created_at desc, id desc
    offset 10
  ) stale
  where s.id = stale.id;

  return new;
end;
$$;

revoke all on function public.planners_snapshot() from public;

drop trigger if exists planners_snapshot_trg on public.planners;
create trigger planners_snapshot_trg
  after update on public.planners
  for each row execute function public.planners_snapshot();

-- 4c. ai_usage: atomic increment used by the `ai` edge function (service role only).
--     Returns the row after increment so the function can report remaining budget.
create or replace function public.ai_usage_increment(
  p_user_id uuid,
  p_day date,
  p_input_tokens integer,
  p_output_tokens integer
)
returns public.ai_usage
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage (user_id, day, calls, input_tokens, output_tokens)
  values (p_user_id, p_day, 1, greatest(p_input_tokens, 0), greatest(p_output_tokens, 0))
  on conflict (user_id, day) do update
    set calls         = ai_usage.calls + 1,
        input_tokens  = ai_usage.input_tokens  + greatest(excluded.input_tokens, 0),
        output_tokens = ai_usage.output_tokens + greatest(excluded.output_tokens, 0)
  returning *;
$$;

-- Only the service role (edge function) may call it — never browsers.
revoke all on function public.ai_usage_increment(uuid, date, integer, integer) from public, anon, authenticated;
grant execute on function public.ai_usage_increment(uuid, date, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.planners         enable row level security;
alter table public.planner_snapshots enable row level security;
alter table public.ai_usage          enable row level security;

-- Belt and braces: force RLS even for the table owner (not the service role,
-- which bypasses RLS by design).
alter table public.planners         force row level security;
alter table public.planner_snapshots force row level security;
alter table public.ai_usage          force row level security;

-- ---- planners: owner has full CRUD on exactly their own row ----------------

drop policy if exists "planners: owner can read own row" on public.planners;
-- A signed-in user can read only the planners row whose user_id is their own auth uid.
create policy "planners: owner can read own row"
  on public.planners for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "planners: owner can create own row" on public.planners;
-- A signed-in user can create a planners row only for themselves (first sync after sign-up).
create policy "planners: owner can create own row"
  on public.planners for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "planners: owner can update own row" on public.planners;
-- A signed-in user can update only their own row, and cannot move it to another user_id.
create policy "planners: owner can update own row"
  on public.planners for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "planners: owner can delete own row" on public.planners;
-- A signed-in user may wipe their own cloud copy (account deletion / "stop syncing").
create policy "planners: owner can delete own row"
  on public.planners for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---- planner_snapshots: owner can read; nobody but the trigger writes ------

drop policy if exists "snapshots: owner can read own history" on public.planner_snapshots;
-- A signed-in user can list their own snapshot history (for a future "restore" UI).
create policy "snapshots: owner can read own history"
  on public.planner_snapshots for select
  to authenticated
  using (auth.uid() = user_id);

-- No insert/update/delete policies on purpose: with RLS enabled and no policy,
-- those statements are denied for `authenticated`/`anon`. Rows are written only by
-- the SECURITY DEFINER trigger `planners_snapshot()` and by the service role.

-- ---- ai_usage: owner can see their own counters; only service role writes ---

drop policy if exists "ai_usage: owner can read own counters" on public.ai_usage;
-- A signed-in user can read their own daily AI usage (so the app can show "x of 60 today").
create policy "ai_usage: owner can read own counters"
  on public.ai_usage for select
  to authenticated
  using (auth.uid() = user_id);

-- No insert/update/delete policies on purpose: the `ai` edge function writes with
-- the service role key, which bypasses RLS. Clients can never inflate or reset counters.

-- ---------------------------------------------------------------------------
-- 6. Grants (Supabase defaults usually cover these; explicit for clarity)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.planners          to authenticated;
grant select                         on public.planner_snapshots to authenticated;
grant select                         on public.ai_usage          to authenticated;
revoke all on public.planners, public.planner_snapshots, public.ai_usage from anon;
