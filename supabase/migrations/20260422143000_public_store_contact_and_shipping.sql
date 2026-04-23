alter table public.anotaciones
  add column if not exists nombre text,
  add column if not exists apellido text;

alter table public.anotaciones
  alter column telefono drop not null;

alter table public.tiendas
  add column if not exists contact_email text;

update public.tiendas
set contact_email = auth_users.email
from auth.users as auth_users
where auth_users.id = tiendas.user_id
  and tiendas.contact_email is null;

create unique index if not exists tiendas_user_id_unique_idx
  on public.tiendas (user_id);

create unique index if not exists tiendas_username_lower_unique_idx
  on public.tiendas (lower(username));

create index if not exists tiendas_contact_email_lower_idx
  on public.tiendas (lower(contact_email))
  where contact_email is not null;

drop policy if exists "Métodos de envío activos visibles" on public.metodos_envio;
create policy "Métodos de envío activos visibles"
  on public.metodos_envio for select
  using (activo = true);

drop policy if exists "Ver pedido por número" on public.pedidos;
drop policy if exists "Items visibles" on public.pedido_items;
drop policy if exists comprobantes_public_insert on public.comprobantes;

create policy "Compradora ve sus pedidos"
  on public.pedidos for select
  to authenticated
  using (
    comprador_email is not null
    and lower(comprador_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "Dueña ve items de sus pedidos"
  on public.pedido_items for select
  using (
    exists (
      select 1
      from public.pedidos
      join public.tiendas on tiendas.id = pedidos.tienda_id
      where pedidos.id = pedido_items.pedido_id
        and tiendas.user_id = auth.uid()
    )
  );

create policy "Compradora ve items de sus pedidos"
  on public.pedido_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.pedidos
      where pedidos.id = pedido_items.pedido_id
        and pedidos.comprador_email is not null
        and lower(pedidos.comprador_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "Anotaciones visibles" on public.anotaciones;
drop policy if exists "Anotaciones públicas insert" on public.anotaciones;

create policy "Anotaciones públicas insert seguras"
  on public.anotaciones for insert
  to public
  with check (
    exists (
      select 1
      from public.drops
      join public.tiendas on tiendas.id = drops.tienda_id
      where drops.id = anotaciones.drop_id
        and tiendas.activa = true
        and drops.estado in ('programado', 'activo')
    )
    and length(coalesce(nombre, '')) <= 120
    and length(coalesce(apellido, '')) <= 120
    and length(coalesce(telefono, '')) <= 40
    and length(coalesce(email, '')) <= 180
    and (
      nullif(trim(coalesce(email, '')), '') is not null
      or nullif(trim(coalesce(telefono, '')), '') is not null
    )
  );

drop policy if exists "Fotos públicas visibles" on storage.objects;

create or replace function public.compute_cierra_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  new.cierra_at := new.inicia_at + (new.duracion_minutos || ' minutes')::interval;
  return new;
end;
$function$;

create or replace function public.sync_drop_counters()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.drop_id is not null then
    update public.drops
    set
      vendidas_count = (
        select count(*)
        from public.prendas
        where drop_id = new.drop_id and estado = 'vendida'
      ),
      recaudado_total = (
        select coalesce(sum(precio), 0)
        from public.prendas
        where drop_id = new.drop_id and estado = 'vendida'
      )
    where id = new.drop_id;
  end if;

  return new;
end;
$function$;

alter table public.compradores
  drop constraint if exists compradores_nombre_length_check,
  drop constraint if exists compradores_telefono_length_check,
  drop constraint if exists compradores_email_format_check,
  drop constraint if exists compradores_direccion_length_check,
  drop constraint if exists compradores_ciudad_length_check;

alter table public.compradores
  add constraint compradores_nombre_length_check
    check (nombre is null or (char_length(nombre) between 2 and 120)),
  add constraint compradores_telefono_length_check
    check (telefono is null or char_length(telefono) <= 40),
  add constraint compradores_email_format_check
    check (
      email is null
      or (
        char_length(email) <= 180
        and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    ),
  add constraint compradores_direccion_length_check
    check (direccion is null or char_length(direccion) <= 240),
  add constraint compradores_ciudad_length_check
    check (ciudad is null or char_length(ciudad) <= 90);

notify pgrst, 'reload schema';
