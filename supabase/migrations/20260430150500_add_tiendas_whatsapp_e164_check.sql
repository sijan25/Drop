alter table public.tiendas
  drop constraint if exists tiendas_whatsapp_e164_check;

alter table public.tiendas
  add constraint tiendas_whatsapp_e164_check
  check (
    whatsapp is null
    or whatsapp ~ '^\+[1-9][0-9]{7,14}$'
  ) not valid;
