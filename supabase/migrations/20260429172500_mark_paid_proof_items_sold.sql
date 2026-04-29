-- Cuando el comprador sube comprobante, la prenda ya debe salir del inventario público.
-- Si la tienda rechaza el pago, restaurarInventarioPedido vuelve a marcarla disponible.

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
    update public.prendas p
    set estado = 'vendida'
    from public.pedido_items pi
    where pi.pedido_id = new.pedido_id
      and p.id = pi.prenda_id
      and p.tienda_id = new.tienda_id
      and p.estado is distinct from 'vendida';

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

drop trigger if exists comprobantes_mark_prendas_sold on public.comprobantes;

create trigger comprobantes_mark_prendas_sold
after insert or update of estado
on public.comprobantes
for each row
when (new.estado = 'pendiente')
execute function public.mark_comprobante_prendas_sold();

-- Corrige comprobantes pendientes que se hayan creado antes de esta migración.
update public.prendas p
set estado = 'vendida'
from public.pedido_items pi
join public.comprobantes c on c.pedido_id = pi.pedido_id
where p.id = pi.prenda_id
  and p.tienda_id = c.tienda_id
  and c.estado = 'pendiente'
  and p.estado is distinct from 'vendida';
