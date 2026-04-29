-- El checkout estaba fallando con:
--   record "new" has no field "drop_id"
--
-- Eso pasa cuando public.sync_drop_counters queda conectado por accidente a una
-- tabla que no es public.prendas, por ejemplo public.comprobantes. Esta
-- migración hace dos cosas:
-- 1. Vuelve la función defensiva para no leer NEW.drop_id fuera de prendas.
-- 2. Elimina cualquier trigger mal conectado y recrea el trigger correcto.

create or replace function public.sync_drop_counters()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_drop_id uuid;
begin
  if TG_TABLE_SCHEMA <> 'public' or TG_TABLE_NAME <> 'prendas' then
    if TG_OP = 'DELETE' then
      return OLD;
    end if;
    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    v_drop_id := OLD.drop_id;
  else
    v_drop_id := NEW.drop_id;

    if TG_OP = 'UPDATE' and OLD.drop_id is distinct from NEW.drop_id and OLD.drop_id is not null then
      update public.drops
      set
        vendidas_count = (
          select count(*)
          from public.prendas
          where drop_id = OLD.drop_id and estado = 'vendida'
        ),
        recaudado_total = (
          select coalesce(sum(precio), 0)
          from public.prendas
          where drop_id = OLD.drop_id and estado = 'vendida'
        )
      where id = OLD.drop_id;
    end if;
  end if;

  if v_drop_id is not null then
    update public.drops
    set
      vendidas_count = (
        select count(*)
        from public.prendas
        where drop_id = v_drop_id and estado = 'vendida'
      ),
      recaudado_total = (
        select coalesce(sum(precio), 0)
        from public.prendas
        where drop_id = v_drop_id and estado = 'vendida'
      )
    where id = v_drop_id;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  return NEW;
end;
$function$;

do $$
declare
  r record;
begin
  for r in
    select
      trigger_schema.nspname as schema_name,
      trigger_table.relname as table_name,
      trigger_def.tgname as trigger_name
    from pg_trigger trigger_def
    join pg_class trigger_table on trigger_table.oid = trigger_def.tgrelid
    join pg_namespace trigger_schema on trigger_schema.oid = trigger_table.relnamespace
    join pg_proc trigger_function on trigger_function.oid = trigger_def.tgfoid
    join pg_namespace function_schema on function_schema.oid = trigger_function.pronamespace
    where not trigger_def.tgisinternal
      and function_schema.nspname = 'public'
      and trigger_function.proname = 'sync_drop_counters'
      and not (trigger_schema.nspname = 'public' and trigger_table.relname = 'prendas')
  loop
    execute format(
      'drop trigger if exists %I on %I.%I',
      r.trigger_name,
      r.schema_name,
      r.table_name
    );
  end loop;
end $$;

drop trigger if exists trg_sync_drop_counters on public.prendas;
drop trigger if exists prendas_sync_drop_counters on public.prendas;

create trigger prendas_sync_drop_counters
  after insert or delete or update of estado, drop_id
  on public.prendas
  for each row
  execute function public.sync_drop_counters();
