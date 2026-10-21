-- DayScript — migration 0002: size limits
--
-- A planner document is small (a busy year of pages plus handwriting strokes is well
-- under 1 MB). Cap it so one account can't fill the database or make every sync slow,
-- and cap the client id the browser sends.

alter table public.planners
  drop constraint if exists planners_state_size_chk,
  add  constraint planners_state_size_chk check (pg_column_size(state) <= 4 * 1024 * 1024);

alter table public.planners
  drop constraint if exists planners_client_id_len_chk,
  add  constraint planners_client_id_len_chk check (client_id is null or length(client_id) <= 64);

-- Belt and braces: never let the browser roles touch the snapshot pruning function directly.
revoke all on function public.planners_snapshot() from anon, authenticated;
