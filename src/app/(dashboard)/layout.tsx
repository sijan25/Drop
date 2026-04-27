'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/shared/logo';
import { Icons } from '@/components/shared/icons';
import { createClient } from '@/lib/supabase/client';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

interface Tienda {
  id: string;
  nombre: string;
  username: string;
  plan: string | null;
  logo_url: string | null;
}

interface Counts {
  drops: number;
  pedidos: number;
  comprobantes: number;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [counts, setCounts] = useState<Counts>({ drops: 0, pedidos: 0, comprobantes: 0 });
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    async function cargarTienda() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data, error } = await supabase
        .from('tiendas')
        .select('id, nombre, username, plan, logo_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) return; // el dashboard page maneja la redirección a onboarding
      setTienda(data);

      const [{ count: dropsCount }, { count: pedidosCount }, { count: comprobantesCount }] = await Promise.all([
        supabase.from('drops').select('*', { count: 'exact', head: true })
          .eq('tienda_id', data.id).in('estado', ['activo', 'programado']),
        supabase.from('pedidos').select('*', { count: 'exact', head: true })
          .eq('tienda_id', data.id).not('estado', 'in', '(entregado,cancelado)'),
        supabase.from('pedidos').select('*', { count: 'exact', head: true })
          .eq('tienda_id', data.id).eq('estado', 'por_verificar'),
      ]);

      setCounts({
        drops: dropsCount ?? 0,
        pedidos: pedidosCount ?? 0,
        comprobantes: comprobantesCount ?? 0,
      });
    }
    cargarTienda();
  }, [router]);

  const initiales = tienda?.nombre
    ? tienda.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '..';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.home, href: '/dashboard', badge: 0 },
    { id: 'drops', label: 'Drops', icon: Icons.sparkle, href: '/drops', badge: counts.drops },
    { id: 'inventario', label: 'Inventario', icon: Icons.grid, href: '/inventario', badge: 0 },
    { id: 'pedidos', label: 'Pedidos', icon: Icons.bag, href: '/pedidos', badge: counts.pedidos },
    { id: 'comprobantes', label: 'Comprobantes', icon: Icons.inbox, href: '/comprobantes', badge: counts.comprobantes },
    { id: 'configuracion', label: 'Configuración', icon: Icons.settings, href: '/configuracion', badge: 0 },
    { id: 'billing', label: 'Suscripción', icon: Icons.card, href: '/billing', badge: 0 },
  ];

  function isActive(item: typeof navItems[number]) {
    if (item.id === 'dashboard') return pathname.startsWith('/dashboard');
    if (item.id === 'drops') return pathname.startsWith('/drops');
    if (item.id === 'billing') return pathname.startsWith('/billing');
    return pathname === item.href || pathname.startsWith(item.href + '/');
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const GROUPS = [
    ['dashboard', 'drops'],
    ['inventario', 'pedidos', 'comprobantes'],
    ['configuracion', 'billing'],
  ];

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background:
        'radial-gradient(circle at top center, rgba(201,100,66,0.08) 0%, transparent 32%), linear-gradient(180deg, #fffdfa 0%, var(--bg) 44%, #f5efe8 100%)',
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 236,
        background: 'rgba(255,255,255,0.78)',
        borderRight: '1px solid rgba(26,23,20,0.08)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        boxShadow: '0 24px 60px rgba(26,23,20,0.06)',
        backdropFilter: 'blur(18px)',
      }}>

        {/* Header: logo */}
        <div style={{ padding: '16px 16px 14px', display: 'flex', alignItems: 'center' }}>
          <Logo size={18}/>
        </div>

        {/* Tienda info */}
        <div style={{ padding: '0 12px 14px' }}>
          <div style={{
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'linear-gradient(180deg, rgba(255,250,245,0.96) 0%, rgba(245,236,228,0.96) 100%)',
            borderRadius: 14,
            border: '1px solid rgba(201,100,66,0.12)',
            boxShadow: '0 12px 28px rgba(26,23,20,0.05)',
          }}>
            {tienda?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tienda.logo_url} alt={tienda.nombre} style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: 14, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-3) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {initiales}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tienda?.nombre ?? 'Cargando…'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, textTransform: 'capitalize' }}>
                Plan {tienda?.plan ?? '…'}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button style={{ color: 'var(--ink-3)', padding: 4, borderRadius: 5, lineHeight: 1, flexShrink: 0 }}>
                  <Icons.more width={13} height={13}/>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" style={{ minWidth: 160 }}>
                <DropdownMenuItem onSelect={() => router.push('/configuracion')}>
                  <Icons.settings width={13} height={13}/> Configuración tienda
                </DropdownMenuItem>
                {tienda?.username && (
                  <DropdownMenuItem onSelect={() => window.open(`/${tienda.username}`, '_blank')}>
                    <Icons.external width={13} height={13}/> Ver tienda pública
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '0 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto' }}>
          {GROUPS.map((group, gi) => (
            <div key={gi} style={{ display: 'grid', gap: 2 }}>
              {group.map(id => {
                const it = navItems.find(n => n.id === id)!;
                const Ic = it.icon;
                const on = isActive(it);
                return (
                  <button key={it.id} onClick={() => router.push(it.href)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderRadius: 12,
                    color: on ? 'var(--accent-3)' : 'var(--ink-2)',
                    background: on ? 'rgba(201,100,66,0.10)' : 'transparent',
                    borderLeft: `2.5px solid ${on ? 'var(--accent)' : 'transparent'}`,
                    fontSize: 13, fontWeight: on ? 700 : 500, textAlign: 'left', width: '100%',
                    transition: 'background .1s, color .1s',
                  }}>
                    <Ic width={15} height={15} style={{ flexShrink: 0, opacity: on ? 1 : 0.7 }}/>
                    <span style={{ flex: 1 }}>{it.label}</span>
                    {it.badge > 0 && (
                      <span style={{
                        minWidth: 18, height: 18, borderRadius: 5, padding: '0 5px',
                        background: it.id === 'comprobantes' ? 'var(--urgent)' : on ? 'var(--accent)' : 'var(--line)',
                        color: it.id === 'comprobantes' || on ? '#fff' : 'var(--ink-3)',
                        fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {it.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: 12, borderTop: '1px solid var(--line)', display: 'grid', gap: 8 }}>
          <button onClick={() => router.push('/drops/nuevo')} className="btn btn-accent btn-sm btn-block" style={{ fontWeight: 700 }}>
            <Icons.plus width={13} height={13}/> Nuevo drop
          </button>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm btn-block" style={{ color: 'var(--ink-3)', fontSize: 12 }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
      }}>
        {children}
      </main>
    </div>
  );
}
