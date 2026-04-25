-- El trigger sync_drop_counters existía como función pero nunca se adjuntó a ninguna tabla.
-- Además solo recalcula contadores cuando estado = 'vendida', sin manejar cancelaciones.
-- Esta migración crea el trigger correctamente en prendas para INSERT y UPDATE.

create or replace function public.sync_drop_counters()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_drop_id uuid;
begin
  -- Determinar qué drop_id afectar (puede cambiar en UPDATE)
  if TG_OP = 'DELETE' then
    v_drop_id := OLD.drop_id;
  else
    v_drop_id := NEW.drop_id;
    -- Si el drop_id cambió en un UPDATE, recalcular también el drop anterior
    if TG_OP = 'UPDATE' and OLD.drop_id is distinct from NEW.drop_id and OLD.drop_id is not null then
      update public.drops
      set
        vendidas_count = (select count(*) from public.prendas where drop_id = OLD.drop_id and estado = 'vendida'),
        recaudado_total = (select coalesce(sum(precio), 0) from public.prendas where drop_id = OLD.drop_id and estado = 'vendida')
      where id = OLD.drop_id;
    end if;
  end if;

  if v_drop_id is not null then
    update public.drops
    set
      vendidas_count = (select count(*) from public.prendas where drop_id = v_drop_id and estado = 'vendida'),
      recaudado_total = (select coalesce(sum(precio), 0) from public.prendas where drop_id = v_drop_id and estado = 'vendida')
    where id = v_drop_id;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$function$;

-- Crear el trigger en prendas (no existía antes — la función era dead code)
drop trigger if exists prendas_sync_drop_counters on public.prendas;

create trigger prendas_sync_drop_counters
  after insert or update of estado, drop_id or delete
  on public.prendas
  for each row
  execute function public.sync_drop_counters();
