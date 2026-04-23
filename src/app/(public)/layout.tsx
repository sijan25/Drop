'use client';

import { CarritoProvider } from '@/hooks/use-carrito';
import { CarritoDrawer } from '@/components/shared/carrito-drawer';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <CarritoProvider>
      {children}
      <CarritoDrawer />
    </CarritoProvider>
  );
}
