'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { agregarItemCarrito, limpiarCarrito, obtenerCarrito, quitarItemCarrito } from '@/lib/cart/actions';

export type ItemCarrito = {
  prendaId: string;
  nombre: string;
  marca: string | null;
  talla: string | null;
  precio: number;
  foto: string | null;
  tiendaUsername: string;
  tiendaId: string;
  cantidad: number; // siempre 1 por ahora, cada prenda es única
};

type CarritoCtx = {
  items: ItemCarrito[];
  total: number;
  count: number;
  hidratado: boolean;
  errorHidratacion: boolean;
  agregarItem: (item: Omit<ItemCarrito, 'cantidad'>) => void;
  quitarItem: (prendaId: string, talla?: string | null) => void;
  tieneItem: (prendaId: string, talla?: string | null) => boolean;
  limpiar: () => void;
  drawerAbierto: boolean;
  abrirDrawer: () => void;
  cerrarDrawer: () => void;
};

const CarritoContext = createContext<CarritoCtx | null>(null);
const MAX_ITEMS = 20;

export function carritoItemKey(prendaId: string, talla?: string | null) {
  return `${prendaId}::${(talla ?? '__none__').toLowerCase()}`;
}

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [errorHidratacion, setErrorHidratacion] = useState(false);
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const itemsRef = useRef<ItemCarrito[]>([]);
  const mutationVersion = useRef(0);
  const addQueueRef = useRef<Promise<void>>(Promise.resolve());

  const commitItems = useCallback((next: ItemCarrito[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  useEffect(() => {
    let cancelado = false;

    queueMicrotask(() => {
      if (cancelado) return;
      void obtenerCarrito()
        .then(res => {
          if (!cancelado && mutationVersion.current === 0) commitItems(res.items);
        })
        .catch(() => {
          if (!cancelado) setErrorHidratacion(true);
        })
        .finally(() => {
          if (!cancelado) setHidratado(true);
        });
    });

    return () => { cancelado = true; };
  }, [commitItems]);

  const agregarItem = useCallback((item: Omit<ItemCarrito, 'cantidad'>) => {
    const version = ++mutationVersion.current;
    const previous = itemsRef.current;
    const optimisticItem: ItemCarrito = { ...item, cantidad: 1 };
    const variantKey = carritoItemKey(item.prendaId, item.talla);

    const optimisticItems = (() => {
      if (previous.find(i => carritoItemKey(i.prendaId, i.talla) === variantKey)) return previous;
      const sameStoreItems = previous[0]?.tiendaId === item.tiendaId ? previous : [];
      return [...sameStoreItems, optimisticItem].slice(0, MAX_ITEMS);
    })();

    commitItems(optimisticItems);
    setDrawerAbierto(true);

    addQueueRef.current = addQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const res = await agregarItemCarrito({ prendaId: item.prendaId, tiendaId: item.tiendaId, talla: item.talla });
        if (version !== mutationVersion.current) return;

        if (res.error) {
          console.warn('[carrito]', res.error);
          commitItems(previous);
          return;
        }

        if (res.items.some(i => carritoItemKey(i.prendaId, i.talla) === variantKey)) {
          commitItems(res.items);
        }
      })
      .catch(error => {
        console.warn('[carrito]', error);
      });
  }, [commitItems]);

  const quitarItem = useCallback((prendaId: string, talla?: string | null) => {
    const version = ++mutationVersion.current;
    const previous = itemsRef.current;
    const variantKey = carritoItemKey(prendaId, talla);
    commitItems(previous.filter(i => carritoItemKey(i.prendaId, i.talla) !== variantKey));

    void quitarItemCarrito({ prendaId, talla: talla ?? null })
      .then(res => {
        if (version === mutationVersion.current) commitItems(res.items);
      })
      .catch(() => commitItems(previous));
  }, [commitItems]);

  const tieneItem = useCallback((prendaId: string, talla?: string | null) => {
    if (typeof talla === 'undefined') return items.some(i => i.prendaId === prendaId);
    return items.some(i => carritoItemKey(i.prendaId, i.talla) === carritoItemKey(prendaId, talla));
  }, [items]);

  const limpiar = useCallback(() => {
    mutationVersion.current += 1;
    commitItems([]);
    void limpiarCarrito().catch(() => {});
  }, [commitItems]);

  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const count = items.length;

  return (
    <CarritoContext.Provider value={{
      items, total, count, hidratado, errorHidratacion,
      agregarItem, quitarItem, tieneItem, limpiar,
      drawerAbierto,
      abrirDrawer: () => setDrawerAbierto(true),
      cerrarDrawer: () => setDrawerAbierto(false),
    }}>
      {children}
    </CarritoContext.Provider>
  );
}

export function useCarrito() {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de CarritoProvider');
  return ctx;
}
