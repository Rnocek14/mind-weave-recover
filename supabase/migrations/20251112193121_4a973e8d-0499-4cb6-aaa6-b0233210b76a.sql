-- Optional: Server-trusty end session RPC to prevent client clock drift
create or replace function end_session_server(p_session_id uuid, p_summary jsonb)
returns void 
language sql 
security definer 
set search_path = public
as $$
  update sessions
  set ended_at = now(),
      duration_sec = extract(epoch from (now() - coalesce(started_at, now())))::integer,
      summary = p_summary
  where id = p_session_id and user_id = auth.uid();
$$;