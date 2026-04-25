-- Precio no puede ser negativo ni cero
alter table public.prendas
  add constraint prendas_precio_positivo check (precio > 0);

-- Monto total de pedido siempre positivo
alter table public.pedidos
  add constraint pedidos_monto_total_positivo check (monto_total > 0);

-- cantidades_por_talla debe ser un objeto JSON (no array, string, etc.)
alter table public.prendas
  add constraint prendas_cantidades_por_talla_is_object
  check (cantidades_por_talla is null or jsonb_typeof(cantidades_por_talla) = 'object');

-- Índice en pedidos.created_at (usado en ORDER BY en casi todas las queries)
create index if not exists pedidos_created_at_idx on public.pedidos (created_at desc);

-- Índice en pedidos.estado (filtrado frecuente en dashboard)
create index if not exists pedidos_estado_idx on public.pedidos (estado);
