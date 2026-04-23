create extension if not exists pgcrypto;

alter table public.prendas
  add column if not exists tallas text[] not null default '{}';

update public.prendas
set tallas = array[talla]
where cardinality(tallas) = 0
  and talla is not null
  and btrim(talla) <> '';

alter table public.prendas
  drop constraint if exists prendas_tallas_max_check;

alter table public.prendas
  add constraint prendas_tallas_max_check
  check (cardinality(tallas) <= 40);

alter table public.carrito_items
  add column if not exists talla_seleccionada text;

alter table public.carrito_items
  drop constraint if exists carrito_items_talla_seleccionada_check;

alter table public.carrito_items
  add constraint carrito_items_talla_seleccionada_check
  check (talla_seleccionada is null or length(btrim(talla_seleccionada)) between 1 and 40);

alter table public.pedido_items
  add column if not exists talla_seleccionada text;

alter table public.pedido_items
  drop constraint if exists pedido_items_talla_seleccionada_check;

alter table public.pedido_items
  add constraint pedido_items_talla_seleccionada_check
  check (talla_seleccionada is null or length(btrim(talla_seleccionada)) between 1 and 40);

alter table public.prendas
  add column if not exists cantidades_por_talla jsonb not null default '{}'::jsonb;

update public.prendas
set cantidades_por_talla = '{}'::jsonb
where cantidades_por_talla is null;

update public.prendas p
set cantidades_por_talla = case
  when coalesce(array_length(p.tallas, 1), 0) = 0 then '{}'::jsonb
  else (
    select coalesce(
      jsonb_object_agg(
        size,
        case
          when coalesce(p.cantidad, 0) <= 0 then 0
          when coalesce(array_length(p.tallas, 1), 0) = 1 then greatest(coalesce(p.cantidad, 0), 0)
          when ord = 1 then 1 + greatest(coalesce(p.cantidad, 0) - least(coalesce(p.cantidad, 0), coalesce(array_length(p.tallas, 1), 0)), 0)
          when ord <= coalesce(p.cantidad, 0) then 1
          else 0
        end
      ),
      '{}'::jsonb
    )
    from unnest(p.tallas) with ordinality as tallas(size, ord)
  )
end
where coalesce(array_length(p.tallas, 1), 0) > 0
  and coalesce(p.cantidades_por_talla, '{}'::jsonb) = '{}'::jsonb;

alter table public.carrito_items
  drop constraint if exists carrito_items_unique;

drop index if exists public.carrito_items_unique_by_variant;

create unique index if not exists carrito_items_unique_by_variant
  on public.carrito_items (carrito_id, prenda_id, coalesce(talla_seleccionada, ''));

alter table public.tiendas
  add column if not exists order_prefix text,
  add column if not exists next_order_number integer not null default 1;

create or replace function public.normalize_order_prefix(raw_value text)
returns text
language plpgsql
immutable
as $function$
declare
  cleaned text;
begin
  cleaned := upper(regexp_replace(coalesce(raw_value, ''), '[^A-Za-z0-9]+', '', 'g'));

  if cleaned = '' then
    cleaned := 'DRP';
  end if;

  if length(cleaned) < 3 then
    cleaned := rpad(cleaned, 3, 'X');
  end if;

  return left(cleaned, 4);
end;
$function$;

create or replace function public.ensure_unique_order_prefix(base_prefix text, store_id uuid default null)
returns text
language plpgsql
stable
as $function$
declare
  candidate text := public.normalize_order_prefix(base_prefix);
  suffix integer := 0;
begin
  while exists (
    select 1
    from public.tiendas
    where order_prefix = candidate
      and (store_id is null or id <> store_id)
  ) loop
    suffix := suffix + 1;
    candidate := left(public.normalize_order_prefix(base_prefix), greatest(3, 5 - length(suffix::text))) || suffix::text;
  end loop;

  return candidate;
end;
$function$;

create or replace function public.tiendas_set_order_fields()
returns trigger
language plpgsql
as $function$
begin
  new.order_prefix := public.ensure_unique_order_prefix(
    coalesce(nullif(trim(new.order_prefix), ''), nullif(trim(new.username), ''), 'DRP'),
    new.id
  );
  new.next_order_number := greatest(coalesce(new.next_order_number, 1), 1);
  return new;
end;
$function$;

drop trigger if exists tiendas_set_order_fields on public.tiendas;

create trigger tiendas_set_order_fields
before insert or update of username, order_prefix, next_order_number
on public.tiendas
for each row
execute function public.tiendas_set_order_fields();

update public.tiendas
set order_prefix = public.ensure_unique_order_prefix(username, id)
where coalesce(trim(order_prefix), '') = '';

update public.tiendas t
set next_order_number = greatest(coalesce(stats.total_pedidos, 0) + 1, 1)
from (
  select tienda_id, count(*)::integer as total_pedidos
  from public.pedidos
  group by tienda_id
) as stats
where t.id = stats.tienda_id;

alter table public.tiendas
  alter column order_prefix set not null;

alter table public.tiendas
  drop constraint if exists tiendas_order_prefix_check;

alter table public.tiendas
  add constraint tiendas_order_prefix_check
    check (order_prefix ~ '^[A-Z0-9]{3,5}$');

alter table public.tiendas
  drop constraint if exists tiendas_next_order_number_check;

alter table public.tiendas
  add constraint tiendas_next_order_number_check
    check (next_order_number >= 1);

create unique index if not exists tiendas_order_prefix_key
  on public.tiendas (order_prefix);

drop function if exists public.crear_checkout_publico_seguro(
  uuid,
  uuid,
  uuid[],
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text
);

create or replace function public.crear_checkout_publico_seguro(
  p_tienda_id uuid,
  p_drop_id uuid,
  p_items jsonb,
  p_comprador_nombre text,
  p_comprador_email text,
  p_comprador_telefono text,
  p_direccion text,
  p_ciudad text,
  p_metodo_envio_id uuid,
  p_metodo_pago_id uuid,
  p_comprobante_url text default null
)
returns table (
  pedido_id uuid,
  numero text,
  monto_total numeric,
  tienda_username text,
  tienda_nombre text,
  tienda_user_id uuid,
  tienda_contact_email text,
  metodo_pago_tipo text,
  metodo_pago_nombre text,
  metodo_envio_nombre text,
  metodo_envio_precio numeric,
  prenda_nombre text,
  prenda_marca text,
  prenda_talla text,
  prendas_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_tienda public.tiendas%rowtype;
  v_envio public.metodos_envio%rowtype;
  v_pago public.metodos_pago%rowtype;
  v_prenda public.prendas%rowtype;
  v_requested jsonb;
  v_requested_prenda_id uuid;
  v_requested_talla text;
  v_talla_normalizada text;
  v_qty_actual integer;
  v_qty_restante integer;
  v_item_count integer := 0;
  v_unique_count integer := 0;
  v_null_count integer := 0;
  v_found_count integer := 0;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_numero text;
  v_pedido_id uuid;
  v_direccion_completa text;
  v_comprobante_url text := nullif(trim(coalesce(p_comprobante_url, '')), '');
  v_first_nombre text := 'Prenda';
  v_first_marca text;
  v_first_talla text;
  v_map jsonb := '{}'::jsonb;
  v_order_prefix text;
  v_order_sequence integer;
begin
  if p_tienda_id is null then
    raise exception 'La tienda no está disponible.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Seleccioná al menos una prenda válida.';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 20 then
    raise exception 'Seleccioná al menos una prenda válida.';
  end if;

  select
    count(distinct format('%s:%s', coalesce(item->>'prendaId', ''), coalesce(lower(nullif(trim(item->>'talla'), '')), '__none__'))),
    count(*) filter (where coalesce(item->>'prendaId', '') = '')
  into v_unique_count, v_null_count
  from jsonb_array_elements(p_items) as item;

  if v_null_count > 0 or v_unique_count <> v_item_count then
    raise exception 'Hay variantes duplicadas o inválidas en el pedido.';
  end if;

  if length(trim(coalesce(p_comprador_nombre, ''))) < 2 then
    raise exception 'Ingresá tu nombre completo.';
  end if;

  if length(trim(coalesce(p_comprador_telefono, ''))) < 7 then
    raise exception 'Ingresá un WhatsApp válido.';
  end if;

  if length(trim(coalesce(p_direccion, ''))) < 4 or length(trim(coalesce(p_ciudad, ''))) < 2 then
    raise exception 'Ingresá una dirección de entrega válida.';
  end if;

  select *
  into v_tienda
  from public.tiendas
  where id = p_tienda_id
    and activa = true
  for update;

  if not found then
    raise exception 'La tienda no está disponible.';
  end if;

  select *
  into v_envio
  from public.metodos_envio
  where id = p_metodo_envio_id
    and tienda_id = p_tienda_id
    and activo = true;

  if not found then
    raise exception 'Seleccioná un método de envío válido.';
  end if;

  select *
  into v_pago
  from public.metodos_pago
  where id = p_metodo_pago_id
    and tienda_id = p_tienda_id
    and activo = true;

  if not found then
    raise exception 'Seleccioná un método de pago válido.';
  end if;

  if v_pago.tipo = 'transferencia' and v_comprobante_url is null then
    raise exception 'Debés subir el comprobante de transferencia.';
  end if;

  if p_drop_id is not null and not exists (
    select 1
    from public.drops
    where id = p_drop_id
      and tienda_id = p_tienda_id
      and estado = 'activo'
  ) then
    raise exception 'Este drop no está abierto para compras.';
  end if;

  for v_requested in
    select value
    from jsonb_array_elements(p_items)
  loop
    begin
      v_requested_prenda_id := (v_requested->>'prendaId')::uuid;
    exception
      when others then
        raise exception 'Seleccioná al menos una prenda válida.';
    end;

    v_requested_talla := nullif(trim(coalesce(v_requested->>'talla', '')), '');

    select p.*
    into v_prenda
    from public.prendas p
    where p.tienda_id = p_tienda_id
      and p.id = v_requested_prenda_id
    for update;

    if not found then
      raise exception 'Una de las prendas ya no está disponible.';
    end if;

    if (p_drop_id is null and v_prenda.drop_id is not null)
      or (p_drop_id is not null and v_prenda.drop_id is distinct from p_drop_id) then
      raise exception 'Una de las prendas no pertenece a esta compra.';
    end if;

    if v_prenda.estado <> 'disponible' or coalesce(v_prenda.cantidad, 0) <= 0 then
      raise exception '% ya no tiene unidades disponibles.', v_prenda.nombre;
    end if;

    v_talla_normalizada := null;
    v_map := coalesce(v_prenda.cantidades_por_talla, '{}'::jsonb);

    if coalesce(array_length(v_prenda.tallas, 1), 0) > 0 then
      select size
      into v_talla_normalizada
      from unnest(v_prenda.tallas) as tallas(size)
      where lower(size) = lower(coalesce(v_requested_talla, ''))
      limit 1;

      if v_talla_normalizada is null then
        raise exception 'Seleccioná una talla disponible para cada prenda.';
      end if;

      v_qty_actual := coalesce(
        nullif(v_map ->> v_talla_normalizada, '')::integer,
        case when coalesce(array_length(v_prenda.tallas, 1), 0) = 1 then coalesce(v_prenda.cantidad, 0) else 0 end
      );

      if coalesce(v_qty_actual, 0) <= 0 then
        raise exception '% ya no tiene stock en talla %.', v_prenda.nombre, v_talla_normalizada;
      end if;

      v_map := jsonb_set(
        v_map,
        array[v_talla_normalizada],
        to_jsonb(greatest(v_qty_actual - 1, 0)),
        true
      );
    end if;

    v_found_count := v_found_count + 1;
    if v_found_count = 1 then
      v_first_nombre := v_prenda.nombre;
      v_first_marca := v_prenda.marca;
      v_first_talla := coalesce(v_talla_normalizada, v_prenda.talla);
    end if;

    v_subtotal := v_subtotal + v_prenda.precio;
  end loop;

  if v_found_count <> v_item_count then
    raise exception 'Una de las prendas ya no está disponible.';
  end if;

  v_order_prefix := coalesce(nullif(trim(v_tienda.order_prefix), ''), public.normalize_order_prefix(v_tienda.username));
  v_order_sequence := greatest(coalesce(v_tienda.next_order_number, 1), 1);

  loop
    v_numero := format('%s-%s', v_order_prefix, lpad(v_order_sequence::text, 6, '0'));
    exit when not exists (
      select 1
      from public.pedidos
      where numero = v_numero
    );
    v_order_sequence := v_order_sequence + 1;
  end loop;

  update public.tiendas
  set next_order_number = v_order_sequence + 1
  where id = v_tienda.id;

  v_total := v_subtotal + v_envio.precio;
  v_direccion_completa := trim(p_direccion) || ', ' || trim(p_ciudad);

  insert into public.pedidos (
    tienda_id,
    drop_id,
    numero,
    comprador_nombre,
    comprador_email,
    comprador_telefono,
    direccion,
    metodo_pago,
    metodo_envio,
    monto_total,
    estado,
    comprobante_url,
    comprobante_estado,
    apartado_expira_at
  ) values (
    p_tienda_id,
    p_drop_id,
    v_numero,
    trim(p_comprador_nombre),
    nullif(lower(trim(coalesce(p_comprador_email, ''))), ''),
    trim(p_comprador_telefono),
    v_direccion_completa,
    v_pago.tipo,
    case when v_envio.precio = 0 then 'pickup' else 'domicilio' end,
    v_total,
    case when v_comprobante_url is not null then 'por_verificar' else 'apartado' end,
    v_comprobante_url,
    case when v_comprobante_url is not null then 'pendiente' else null end,
    now() + interval '48 hours'
  )
  returning id into v_pedido_id;

  for v_requested in
    select value
    from jsonb_array_elements(p_items)
  loop
    v_requested_prenda_id := (v_requested->>'prendaId')::uuid;
    v_requested_talla := nullif(trim(coalesce(v_requested->>'talla', '')), '');

    select p.*
    into v_prenda
    from public.prendas p
    where p.tienda_id = p_tienda_id
      and p.id = v_requested_prenda_id
    for update;

    v_talla_normalizada := null;
    v_map := coalesce(v_prenda.cantidades_por_talla, '{}'::jsonb);

    if coalesce(array_length(v_prenda.tallas, 1), 0) > 0 then
      select size
      into v_talla_normalizada
      from unnest(v_prenda.tallas) as tallas(size)
      where lower(size) = lower(coalesce(v_requested_talla, ''))
      limit 1;

      v_qty_actual := coalesce(
        nullif(v_map ->> v_talla_normalizada, '')::integer,
        case when coalesce(array_length(v_prenda.tallas, 1), 0) = 1 then coalesce(v_prenda.cantidad, 0) else 0 end
      );

      v_map := jsonb_set(
        v_map,
        array[v_talla_normalizada],
        to_jsonb(greatest(v_qty_actual - 1, 0)),
        true
      );
    end if;

    v_qty_restante := greatest(coalesce(v_prenda.cantidad, 0) - 1, 0);

    update public.prendas
    set
      cantidad = v_qty_restante,
      cantidades_por_talla = case
        when coalesce(array_length(v_prenda.tallas, 1), 0) > 0 then v_map
        else '{}'::jsonb
      end,
      estado = case when v_qty_restante > 0 then 'disponible' else 'vendida' end
    where id = v_prenda.id;

    insert into public.pedido_items (pedido_id, prenda_id, precio, talla_seleccionada)
    values (v_pedido_id, v_prenda.id, v_prenda.precio, v_talla_normalizada);
  end loop;

  if v_comprobante_url is not null then
    insert into public.comprobantes (
      pedido_id,
      tienda_id,
      imagen_url,
      estado,
      monto_declarado
    ) values (
      v_pedido_id,
      p_tienda_id,
      v_comprobante_url,
      'pendiente',
      v_total
    );
  end if;

  return query
  select
    v_pedido_id,
    v_numero,
    v_total,
    v_tienda.username,
    v_tienda.nombre,
    v_tienda.user_id,
    v_tienda.contact_email,
    v_pago.tipo,
    v_pago.nombre,
    v_envio.nombre,
    v_envio.precio,
    v_first_nombre,
    v_first_marca,
    v_first_talla,
    v_item_count;
end;
$function$;

revoke all on function public.crear_checkout_publico_seguro(
  uuid,
  uuid,
  jsonb,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text
) from public;

grant execute on function public.crear_checkout_publico_seguro(
  uuid,
  uuid,
  jsonb,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text
) to anon, authenticated;
