alter table pedidos
  add column if not exists pixelpay_order_id text,
  add column if not exists pixelpay_transaction_id text,
  add column if not exists pixelpay_response jsonb not null default '{}'::jsonb;
