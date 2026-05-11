create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  provider text not null,
  status text not null default 'created',
  idempotency_key text not null,
  order_id text not null,
  payment_uuid text,
  transaction_id text,
  amount numeric(12, 2) not null,
  currency text not null default 'HNL',
  sandbox boolean not null default true,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_attempts_provider_check check (provider in ('pixelpay')),
  constraint payment_attempts_status_check check (
    status in ('created', 'processing', 'approved', 'failed', 'sync_pending', 'synced', 'voided')
  )
);

create unique index if not exists payment_attempts_idempotency_key_unique
  on public.payment_attempts (idempotency_key);

create index if not exists payment_attempts_reconcile_idx
  on public.payment_attempts (provider, status, created_at)
  where status in ('approved', 'sync_pending', 'processing');

drop trigger if exists payment_attempts_set_updated_at on public.payment_attempts;
create trigger payment_attempts_set_updated_at
  before update on public.payment_attempts
  for each row
  execute function public.set_updated_at();

alter table public.payment_attempts enable row level security;

drop policy if exists "No direct payment attempt access" on public.payment_attempts;
create policy "No direct payment attempt access"
  on public.payment_attempts
  for all
  using (false)
  with check (false);
