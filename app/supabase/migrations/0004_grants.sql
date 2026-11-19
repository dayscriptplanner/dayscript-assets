-- DayScript — migration 0004: explicit grants
--
-- The Supabase project was created with "Grant API access to new tables automatically" OFF,
-- so nothing reaches a table unless it is granted here. Least privilege:
--   * anon (signed-out browser): nothing.
--   * authenticated (signed-in browser): what 0001 granted, plus read-own subscription (RLS filters).
--   * service_role (edge functions only): full access to the tables the functions write.
-- Safe to re-run.

grant usage on schema public to authenticated, service_role;

-- signed-in clients may read their own subscription row (policy "subscriptions: read own")
grant select on public.subscriptions to authenticated;

-- edge functions (service role)
grant select, insert, update, delete on
  public.planners, public.planner_snapshots, public.ai_usage,
  public.subscriptions, public.billing_events, public.account_deletions
  to service_role;
grant select on public.entitlements to service_role;
grant usage, select on all sequences in schema public to service_role;

-- signed-out browsers get nothing, whatever the project defaults were
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- helper functions are for the service role / triggers only
revoke all on function public.ai_calls_remaining(uuid) from public, anon, authenticated;
revoke all on function public.ai_usage_increment(uuid, date, integer, integer) from public, anon, authenticated;
revoke all on function public.planners_snapshot() from public, anon, authenticated;
revoke all on function public.planners_touch() from public, anon, authenticated;
revoke all on function public.subscriptions_touch() from public, anon, authenticated;
grant execute on function public.ai_calls_remaining(uuid) to service_role;
grant execute on function public.ai_usage_increment(uuid, date, integer, integer) to service_role;
