create table if not exists public.security_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.security_rate_limits enable row level security;

drop policy if exists "No direct security rate limit access" on public.security_rate_limits;
create policy "No direct security rate limit access"
  on public.security_rate_limits
  for all
  using (false)
  with check (false);

create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  if p_key is null or length(trim(p_key)) < 16 then
    return false;
  end if;

  if p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.security_rate_limits as limits (
    key,
    window_start,
    count,
    updated_at
  ) values (
    p_key,
    v_now,
    1,
    v_now
  )
  on conflict (key) do update
  set
    window_start = case
      when limits.window_start <= v_now - make_interval(secs => p_window_seconds) then v_now
      else limits.window_start
    end,
    count = case
      when limits.window_start <= v_now - make_interval(secs => p_window_seconds) then 1
      else limits.count + 1
    end,
    updated_at = v_now
  returning count into v_count;

  delete from public.security_rate_limits
  where updated_at < v_now - interval '24 hours';

  return v_count <= p_limit;
end;
$function$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
