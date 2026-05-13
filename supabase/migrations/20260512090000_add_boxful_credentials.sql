alter table public.tiendas
  add column if not exists boxful_email text,
  add column if not exists boxful_password text,
  add column if not exists boxful_enabled boolean not null default false;
