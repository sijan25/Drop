alter table public.tiendas
  add column if not exists username_changed_at timestamptz,
  add column if not exists username_change_count integer not null default 0;

alter table public.tiendas
  drop constraint if exists tiendas_username_format_check,
  drop constraint if exists tiendas_username_change_count_check;

alter table public.tiendas
  add constraint tiendas_username_format_check
    check (
      username ~ '^[A-Za-z0-9_-]{3,32}$'
      or username ~ '^[a-z0-9-]{3,32}$'
    ),
  add constraint tiendas_username_change_count_check
    check (username_change_count >= 0 and username_change_count <= 3);

create table if not exists public.tienda_username_redirects (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  old_username text not null,
  new_username text not null,
  created_at timestamptz not null default now(),
  constraint tienda_username_redirects_format_check
    check (
      old_username ~ '^[A-Za-z0-9_-]{3,32}$'
      and new_username ~ '^[a-z0-9-]{3,32}$'
      and lower(old_username) <> lower(new_username)
    )
);

create unique index if not exists tienda_username_redirects_old_lower_unique_idx
  on public.tienda_username_redirects (lower(old_username));

create index if not exists tienda_username_redirects_tienda_id_idx
  on public.tienda_username_redirects (tienda_id);

create index if not exists tienda_username_redirects_new_lower_idx
  on public.tienda_username_redirects (lower(new_username));

alter table public.tienda_username_redirects enable row level security;

drop policy if exists "No direct username redirect access" on public.tienda_username_redirects;
create policy "No direct username redirect access"
  on public.tienda_username_redirects
  for all
  using (false)
  with check (false);
