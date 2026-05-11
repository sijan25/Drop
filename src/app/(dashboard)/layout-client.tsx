'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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

export default function DashboardLayoutClient({
  tienda,
  children,
}: {
  tienda: Tienda;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [counts, setCounts] = useState<Counts>({ drops: 0, pedidos: 0, comprobantes: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const refreshCounts = useCallback(async () => {
    const supabase = createClient();
    const [{ count: dropsCount }, { count: pedidosCount }, { count: comprobantesCount }] = await Promise.all([
      supabase.from('drops').select('*', { count: 'exact', head: true })
        .eq('tienda_id', tienda.id as never).in('estado', ['activo', 'programado']),
      supabase.from('pedidos').select('*', { count: 'exact', head: true })
        .eq('tienda_id', tienda.id as never).in('estado', ['por_verificar', 'pagado', 'empacado']),
      supabase.from('comprobantes').select('*', { count: 'exact', head: true })
        .eq('tienda_id', tienda.id as never).eq('estado', 'pendiente' as never),
    ]);
    setCounts({
      drops: dropsCount ?? 0,
      pedidos: pedidosCount ?? 0,
      comprobantes: comprobantesCount ?? 0,
    });
  }, [tienda.id]);

  useEffect(() => { refreshCounts(); }, [refreshCounts]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    const handleRefresh = () => refreshCounts();
    const handleVisibility = () => { if (document.visibilityState === 'visible') refreshCounts(); };
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('fd-dashboard-counts-refresh', handleRefresh);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('fd-dashboard-counts-refresh', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshCounts]);

  const initiales = tienda.nombre
    ? tienda.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '..';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.home, href: '/dashboard', badge: 0 },
    { id: 'drops', label: 'Drops', icon: Icons.sparkle, href: '/drops', badge: counts.drops },
    { id: 'inventario', label: 'Inventario', icon: Icons.grid, href: '/inventario', badge: 0 },
    { id: 'pedidos', label: 'Pedidos', icon: Icons.bag, href: '/pedidos', badge: counts.pedidos },
    { id: 'comprobantes', label: 'Comprobantes', icon: Icons.inbox, href: '/comprobantes', badge: counts.comprobantes },
    { id: 'analiticas', label: 'Analíticas', icon: Icons.chart, href: '/analiticas', badge: 0 },
    { id: 'configuracion', label: 'Configuración', icon: Icons.settings, href: '/configuracion', badge: 0 },
    { id: 'billing', label: 'Suscripción', icon: Icons.card, href: '/billing', badge: 0 },
  ];

  function isActive(item: typeof navItems[number]) {
    if (item.id === 'dashboard') return pathname.startsWith('/dashboard');
    if (item.id === 'drops') return pathname.startsWith('/drops');
    if (item.id === 'billing') return pathname.startsWith('/billing');
    if (item.id === 'analiticas') return pathname.startsWith('/analiticas');
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
    ['analiticas'],
    ['configuracion', 'billing'],
  ];

  const activeLabel = navItems.find(n => isActive(n))?.label ?? '';

  return (
    <div className="dash-root flex h-screen overflow-x-visible overflow-y-hidden bg-[radial-gradient(circle_at_top_center,rgba(201,100,66,0.08)_0%,transparent_32%),linear-gradient(180deg,#fffdfa_0%,var(--bg)_44%,#f5efe8_100%)]">      {/* Mobile overlay */}
      <div
        className={`dash-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Mobile top bar */}
      <div className="dash-mobile-topbar">
        <button
          className="dash-hamburger-btn"
          onClick={() => setSidebarOpen(v => !v)}
          aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {sidebarOpen ? (
            <Icons.close width={18} height={18} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
        <span className="dash-mobile-topbar-title">{activeLabel}</span>
      </div>

      {/* Sidebar */}
      <aside
        className={`dash-sidebar${sidebarOpen ? ' open' : ''} w-[216px] bg-[rgba(255,255,255,0.78)] border-r border-[rgba(26,23,20,0.08)] flex flex-col shrink-0 shadow-[0_24px_60px_rgba(26,23,20,0.06)] backdrop-blur-[18px]`}
      >
        {/* Tienda info */}
        <div className="px-3 pt-4 pb-[14px]">
          <div className="px-3 py-[10px] flex items-center gap-[10px] bg-[linear-gradient(180deg,rgba(255,250,245,0.96)_0%,rgba(245,236,228,0.96)_100%)] rounded-[14px] border border-[rgba(201,100,66,0.12)] shadow-[0_12px_28px_rgba(26,23,20,0.05)]">
            {tienda.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" src={tienda.logo_url} alt={tienda.nombre} className="w-7 h-7 rounded-[14px] object-cover shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-[14px] bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-3)_100%)] flex items-center justify-center text-[10px] font-extrabold text-white shrink-0">
                {initiales}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                {tienda.nombre}
              </div>
              <div className="text-[10px] text-[var(--accent)] font-semibold capitalize">
                Plan {tienda.plan ?? '…'}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-[var(--ink-3)] p-1 rounded-[5px] leading-none shrink-0">
                  <Icons.more width={13} height={13} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px] z-[200]">
                <DropdownMenuItem onSelect={() => router.push('/configuracion')}>
                  <Icons.settings width={13} height={13} /> Configuración tienda
                </DropdownMenuItem>
                {tienda.username && (
                  <DropdownMenuItem onSelect={() => window.open(`/${tienda.username}`, '_blank')}>
                    <Icons.external width={13} height={13} /> Ver tienda pública
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Nav */}
        <nav className="px-3 flex-1 flex flex-col gap-[6px] overflow-y-auto">
          {GROUPS.map((group, gi) => (
            <div key={gi} className="grid gap-[2px]">
              {group.map(id => {
                const it = navItems.find(n => n.id === id)!;
                const Ic = it.icon;
                const on = isActive(it);
                return (
                  <button
                    key={it.id}
                    onClick={() => router.push(it.href)}
                    className={`relative flex items-center gap-[10px] px-[10px] py-2 rounded-[12px] text-[13px] text-left w-full transition-[background,color] duration-100 overflow-hidden ${on ? 'font-bold bg-[rgba(201,100,66,0.10)] text-[var(--accent-3)]' : 'font-medium text-[var(--ink-2)]'}`}
                  >
                    {on && <span aria-hidden className="absolute inset-y-0 left-0 w-[4px] rounded-r-[3px] bg-[var(--accent)]" />}
                    <Ic width={15} height={15} className={`shrink-0 ${on ? 'opacity-100' : 'opacity-70'}`} />
                    <span className="flex-1">{it.label}</span>
                    {it.badge > 0 && (
                      <span className={`min-w-[18px] h-[18px] rounded-[5px] px-[5px] text-[10px] font-bold flex items-center justify-center font-[var(--font-mono)] ${it.id === 'comprobantes' ? 'bg-[var(--urgent)] text-white' : on ? 'bg-[var(--accent)] text-white' : 'bg-[var(--line)] text-[var(--ink-3)]'}`}>
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
        <div className="p-3 border-t border-[var(--line)] grid gap-2">
          <button onClick={handleLogout} className="btn btn-ghost btn-sm btn-block text-[var(--ink-3)] text-[12px]">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="dash-main flex-1 overflow-hidden flex flex-col bg-transparent">
        {children}
      </main>
    </div>
  );
}
