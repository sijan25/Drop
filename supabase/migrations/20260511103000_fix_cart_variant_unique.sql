alter table public.carrito_items
  drop constraint if exists carrito_items_unique;

drop index if exists public.carrito_items_unique_by_variant;

create unique index if not exists carrito_items_unique_by_variant
  on public.carrito_items (carrito_id, prenda_id, coalesce(talla_seleccionada, ''));
