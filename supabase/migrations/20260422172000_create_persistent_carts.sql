create table if not exists public.carritos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid,
  buyer_user_id uuid,
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  estado text not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  constraint carritos_estado_check check (estado in ('activo', 'convertido', 'abandonado')),
  constraint carritos_owner_check check (session_id is not null or buyer_user_id is not null)
);

create table if not exists public.carrito_items (
  id uuid primary key default gen_random_uuid(),
  carrito_id uuid not null references public.carritos(id) on delete cascade,
  prenda_id uuid not null references public.prendas(id) on delete cascade,
  cantidad integer not null default 1,
  created_at timestamptz not null default now(),
  constraint carrito_items_cantidad_check check (cantidad = 1),
  constraint carrito_items_unique unique (carrito_id, prenda_id)
);

create unique index if not exists carritos_session_active_unique
  on public.carritos (session_id)
  where estado = 'activo' and session_id is not null;

create unique index if not exists carritos_buyer_active_unique
  on public.carritos (buyer_user_id)
  where estado = 'activo' and buyer_user_id is not null;

create index if not exists carritos_expires_at_idx
  on public.carritos (expires_at)
  where estado = 'activo';

create index if not exists carrito_items_carrito_id_idx
  on public.carrito_items (carrito_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists carritos_set_updated_at on public.carritos;
create trigger carritos_set_updated_at
  before update on public.carritos
  for each row
  execute function public.set_updated_at();

alter table public.carritos enable row level security;
alter table public.carrito_items enable row level security;

create index if not exists carritos_tienda_id_idx
  on public.carritos (tienda_id);

create index if not exists carrito_items_prenda_id_idx
  on public.carrito_items (prenda_id);

drop policy if exists "No direct cart access" on public.carritos;
create policy "No direct cart access"
  on public.carritos
  for all
  using (false)
  with check (false);

drop policy if exists "No direct cart item access" on public.carrito_items;
create policy "No direct cart item access"
  on public.carrito_items
  for all
  using (false)
  with check (false);
