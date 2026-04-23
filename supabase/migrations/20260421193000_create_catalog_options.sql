alter table public.prendas
  add column if not exists cantidad integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prendas_cantidad_non_negative'
  ) then
    alter table public.prendas
      add constraint prendas_cantidad_non_negative check (cantidad >= 0);
  end if;
end;
$$;

alter table public.tiendas
  add column if not exists facebook text,
  add column if not exists tiktok text;

create table if not exists public.opciones_catalogo (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  tipo text not null check (tipo in ('categoria', 'talla')),
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists opciones_catalogo_tienda_tipo_nombre_idx
  on public.opciones_catalogo (tienda_id, tipo, lower(nombre));

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

drop trigger if exists opciones_catalogo_set_updated_at on public.opciones_catalogo;
create trigger opciones_catalogo_set_updated_at
  before update on public.opciones_catalogo
  for each row
  execute function public.set_updated_at();

alter table public.opciones_catalogo enable row level security;

drop policy if exists "Store owners can read catalog options" on public.opciones_catalogo;
create policy "Store owners can read catalog options"
  on public.opciones_catalogo for select
  using (
    exists (
      select 1 from public.tiendas
      where tiendas.id = opciones_catalogo.tienda_id
        and tiendas.user_id = auth.uid()
    )
  );

drop policy if exists "Store owners can insert catalog options" on public.opciones_catalogo;
create policy "Store owners can insert catalog options"
  on public.opciones_catalogo for insert
  with check (
    exists (
      select 1 from public.tiendas
      where tiendas.id = opciones_catalogo.tienda_id
        and tiendas.user_id = auth.uid()
    )
  );

drop policy if exists "Store owners can update catalog options" on public.opciones_catalogo;
create policy "Store owners can update catalog options"
  on public.opciones_catalogo for update
  using (
    exists (
      select 1 from public.tiendas
      where tiendas.id = opciones_catalogo.tienda_id
        and tiendas.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tiendas
      where tiendas.id = opciones_catalogo.tienda_id
        and tiendas.user_id = auth.uid()
    )
  );

drop policy if exists "Store owners can delete catalog options" on public.opciones_catalogo;
create policy "Store owners can delete catalog options"
  on public.opciones_catalogo for delete
  using (
    exists (
      select 1 from public.tiendas
      where tiendas.id = opciones_catalogo.tienda_id
        and tiendas.user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
