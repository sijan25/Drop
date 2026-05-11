-- PixelPay multi-tenant credentials per tienda
alter table tiendas
  add column if not exists pixelpay_endpoint   text,
  add column if not exists pixelpay_key_id     text,
  add column if not exists pixelpay_secret_key text,
  add column if not exists pixelpay_sandbox    boolean not null default true,
  add column if not exists pixelpay_enabled    boolean not null default false;

-- Pedidos: store payment reference
alter table pedidos
  add column if not exists pixelpay_payment_uuid text,
  add column if not exists pixelpay_payment_hash text,
  add column if not exists pixelpay_order_id text,
  add column if not exists pixelpay_transaction_id text,
  add column if not exists pixelpay_response jsonb not null default '{}'::jsonb;
