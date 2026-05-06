-- Multi-talla: vender una talla no debe marcar toda la prenda como vendida
-- mientras otra talla tenga stock. El checkout ya descuenta cantidad total y
-- cantidades_por_talla dentro de crear_checkout_publico_seguro.

create or replace function public.mark_comprobante_prendas_sold()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_pedido public.pedidos%rowtype;
  v_items_count integer := 0;
  v_prenda_nombre text := 'Prenda';
  v_prenda_marca text;
  v_talla text;
  v_nombre_corto text;
  v_producto text;
  v_texto text;
begin
  if new.estado = 'pendiente' then
    select *
    into v_pedido
    from public.pedidos
    where id = new.pedido_id
      and tienda_id = new.tienda_id;

    if found and v_pedido.drop_id is not null then
      select
        count(*),
        max(p.nombre),
        max(p.marca),
        max(pi.talla_seleccionada)
      into v_items_count, v_prenda_nombre, v_prenda_marca, v_talla
      from public.pedido_items pi
      join public.prendas p on p.id = pi.prenda_id
      where pi.pedido_id = new.pedido_id;

      v_nombre_corto := trim(
        split_part(coalesce(v_pedido.comprador_nombre, 'Cliente'), ' ', 1) ||
        case
          when split_part(coalesce(v_pedido.comprador_nombre, ''), ' ', 2) <> ''
            then ' ' || upper(substr(split_part(v_pedido.comprador_nombre, ' ', 2), 1, 1)) || '.'
          else ''
        end
      );

      v_producto := case
        when coalesce(v_items_count, 0) > 1 then v_items_count::text || ' prendas'
        else trim(coalesce(v_prenda_nombre, 'Prenda') || ' ' || coalesce(v_prenda_marca, ''))
      end;

      v_texto := v_nombre_corto || ' · ' || v_producto ||
        case when nullif(trim(coalesce(v_talla, '')), '') is not null then ' · ' || trim(v_talla) else '' end;

      if not exists (
        select 1
        from public.actividad a
        where a.drop_id = v_pedido.drop_id
          and a.tipo = 'compra'
          and a.texto = v_texto
          and a.created_at > now() - interval '5 minutes'
      ) then
        insert into public.actividad (drop_id, tipo, texto)
        values (v_pedido.drop_id, 'compra', v_texto);
      end if;
    end if;
  end if;

  return new;
end;
$function$;

-- Corrige prendas multi-talla que quedaron con estado vendida aunque todavia
-- tienen unidades disponibles por talla.
update public.prendas
set estado = 'disponible'
where estado = 'vendida'
  and coalesce(cantidad, 0) > 0;

-- Limpia actividad duplicada creada por la combinacion checkout + trigger.
with ordered as (
  select
    id,
    lag(created_at) over (
      partition by drop_id, tipo, texto
      order by created_at
    ) as previous_created_at
  from public.actividad
  where tipo = 'compra'
)
delete from public.actividad a
using ordered o
where a.id = o.id
  and o.previous_created_at is not null
  and a.created_at <= o.previous_created_at + interval '5 minutes';
