-- Permite extender manualmente el cierre de un drop en vivo.
-- Antes, el trigger recalculaba cierra_at en cada UPDATE y pisaba el valor
-- elegido desde el dashboard.

create or replace function public.compute_cierra_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if TG_OP = 'INSERT' then
    if NEW.cierra_at is null then
      NEW.cierra_at := NEW.inicia_at + (NEW.duracion_minutos || ' minutes')::interval;
    end if;
    return NEW;
  end if;

  if NEW.cierra_at is distinct from OLD.cierra_at then
    return NEW;
  end if;

  if NEW.inicia_at is distinct from OLD.inicia_at
    or NEW.duracion_minutos is distinct from OLD.duracion_minutos then
    NEW.cierra_at := NEW.inicia_at + (NEW.duracion_minutos || ' minutes')::interval;
  end if;

  return NEW;
end;
$function$;
