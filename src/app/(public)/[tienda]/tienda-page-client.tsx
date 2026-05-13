'use client';

import Image from 'next/image';
import { getTiendaConfig } from '@/lib/config/platform';

import { cld } from '@/lib/cloudinary/client';
import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ORDER_STATUS } from '@/lib/ui/order-status';
import { Icons } from '@/components/shared/icons';
import { PublicProductCard } from '@/components/shared/public-product-card';
import { PhoneInput } from '@/components/shared/phone-input';
import { useCountdown, pad } from '@/hooks/use-countdown';
import {
  cerrarSesionComprador,
  guardarPerfilComprador,
  obtenerPedidosComprador,
  obtenerPerfilComprador,
  type CompradorPedidoResumen,
} from '@/lib/buyer/actions';
import { BuyerAuthModal } from '@/components/buyer/buyer-auth-modal';
import { createClient } from '@/lib/supabase/client';
import { getPrimaryProductSize, getProductSizes, getProductTotalQuantity } from '@/lib/product-sizes';
import type { Tienda } from '@/types/tienda';
import type { Prenda as PrendaRow } from '@/types/prenda';
import type { Drop as DropRow } from '@/types/drop';
import { useCarrito } from '@/hooks/use-carrito';

type Drop = Pick<DropRow, 'id' | 'nombre' | 'descripcion' | 'estado' | 'inicia_at' | 'cierra_at' | 'duracion_minutos' | 'foto_portada_url' | 'vendidas_count' | 'viewers_count'> & { prendas?: { count: number }[] };
type Prenda = Pick<PrendaRow, 'id' | 'nombre' | 'precio' | 'cantidad' | 'cantidades_por_talla' | 'categoria' | 'talla' | 'tallas' | 'marca' | 'fotos' | 'estado' | 'drop_id' | 'created_at'>;
type PrendaDrop = Pick<PrendaRow, 'id' | 'drop_id' | 'talla' | 'tallas' | 'cantidad' | 'cantidades_por_talla' | 'estado' | 'nombre' | 'precio' | 'fotos' | 'marca'>;
type Comprador = { nombre: string; email: string; telefono?: string | null; direccion?: string | null; ciudad?: string | null };
type BuyerPedido = CompradorPedidoResumen;

const PEDIDO_LABELS = ORDER_STATUS;

const BUYER_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BUYER_PHONE_RE = /^[+\d][\d\s().-]{6,39}$/;
const MAX_VISIBLE_CATEGORIES = 4;

/* ── Countdown inline ── */
function CountdownBlocks({ target }: { target: number }) {
  const { h, m, s, d, ready } = useCountdown(target);
  const blocks = d > 0
    ? [
      { v: pad(d), l: 'DÍAS' },
      { v: pad(h), l: 'HORAS' },
      { v: pad(m), l: 'MIN' },
    ]
    : [
      { v: pad(h), l: 'HORAS' },
      { v: pad(m), l: 'MIN' },
      { v: pad(s), l: 'SEG' },
    ];
  if (!ready) return (
    <div className="flex gap-[6px] items-center">
      {blocks.map(b => (
        <div key={b.l} className="text-center">
          <div className="store-countdown-block text-[28px] font-black font-[var(--font-mono)] leading-none text-white min-w-[44px] bg-[rgba(255,255,255,0.12)] rounded-[6px] px-[10px] py-[6px]">--</div>
          <div className="text-[9px] text-[rgba(255,255,255,0.55)] mt-1 tracking-[0.08em] font-[var(--font-mono)]">{b.l}</div>
        </div>
      ))}
    </div>
  );
  return (
    <div className="flex gap-[6px] items-center">
      {blocks.map((b, i) => (
        <div key={b.l} className="flex items-center gap-[6px]">
          <div className="text-center">
            <div className="store-countdown-block text-[28px] font-black font-[var(--font-mono)] leading-none text-white min-w-[44px] bg-[rgba(255,255,255,0.12)] rounded-[6px] px-[10px] py-[6px]">{b.v}</div>
            <div className="text-[9px] text-[rgba(255,255,255,0.55)] mt-1 tracking-[0.08em] font-[var(--font-mono)]">{b.l}</div>
          </div>
          {i < blocks.length - 1 && <div className="store-countdown-sep text-[22px] font-black text-[rgba(255,255,255,0.5)] mb-[14px]">:</div>}
        </div>
      ))}
    </div>
  );
}

function CountdownInline({ target }: { target: number }) {
  const { d, h, m, s, ready } = useCountdown(target);
  return (
    <span className="mono tnum font-bold">
      {ready ? `${d > 0 ? `${d}d ` : ''}${pad(h)}:${pad(m)}:${pad(s)}` : '--:--:--'}
    </span>
  );
}

/* ── Live Drop Hero ─── */
function LiveDropHero({
  drop, prendas, closeTarget, availableUnits, viewers,
  onVerDrop, onVerPrenda,
}: {
  drop: Drop;
  prendas: PrendaDrop[];
  closeTarget: number;
  availableUnits: number;
  viewers: number;
  onVerDrop: () => void;
  onVerPrenda: (id: string) => void;
}) {
  const disponibles = prendas.filter(p => !p.estado || p.estado === 'disponible' || p.estado === 'remanente');
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (disponibles.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % disponibles.length), 3500);
    return () => clearInterval(t);
  }, [disponibles.length]);

  const featured = disponibles.length > 0 ? disponibles[idx] : null;

  return (
    <div
      className="relative overflow-hidden bg-[var(--dark)] cursor-pointer"
      onClick={onVerDrop}
    >
      {drop.foto_portada_url && (
        <div className="absolute inset-0">
          <Image src={cld(drop.foto_portada_url, 'cover')} alt={drop.nombre} fill sizes="100vw" className="object-cover opacity-[0.12]" />
        </div>
      )}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(42,28,22,0.96)_0%,rgba(58,39,32,0.80)_100%)]" />

      <div className="relative max-w-[1100px] mx-auto px-5">
        <div className="grid items-stretch" style={{ gridTemplateColumns: featured ? '1fr auto' : '1fr' }}>

          {/* LEFT: info */}
          <div className="py-7 pb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-[6px] bg-[var(--accent)] rounded-[20px] px-[11px] py-1 text-[10px] font-extrabold text-white tracking-[0.1em] uppercase">
                <span className="w-[5px] h-[5px] rounded-full bg-white inline-block animate-pulse" />
                EN VIVO
              </span>
            </div>
            <div className="text-[28px] font-black text-white tracking-[-0.01em] leading-[1.08] mb-[10px]">
              {drop.nombre}
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-5">
              <span className="inline-flex items-center gap-[5px] rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.80)] px-[11px] py-[5px] text-[12px] font-semibold">
                <Icons.box width={12} height={12} />{availableUnits} disponibles
              </span>
              <span className="inline-flex items-center gap-[5px] rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.80)] px-[11px] py-[5px] text-[12px] font-semibold">
                <Icons.eye width={12} height={12} />{viewers} viendo
              </span>
            </div>
            <div className="flex items-center gap-5 flex-wrap">
              <div>
                <div className="text-[10px] text-[rgba(255,255,255,0.44)] uppercase tracking-[0.1em] font-[var(--font-mono)] mb-[6px]">Cierra en</div>
                <CountdownBlocks target={closeTarget} />
              </div>
              <button
                onClick={e => { e.stopPropagation(); onVerDrop(); }}
                className="h-[46px] rounded-[10px] bg-white text-[var(--dark)] border-none px-6 text-[14px] font-extrabold cursor-pointer whitespace-nowrap mt-5"
              >
                Entrar al drop
              </button>
            </div>

            {/* Indicator dots */}
            {disponibles.length > 1 && (
              <div className="flex gap-[5px] mt-[22px]">
                {disponibles.slice(0, 8).map((_, i) => (
                  <button
                    key={i}
                    onClick={e => { e.stopPropagation(); setIdx(i); }}
                    className="h-[6px] rounded-[3px] border-none p-0 cursor-pointer transition-all duration-[250ms]"
                    style={{ width: i === idx % Math.min(disponibles.length, 8) ? 18 : 6, background: i === idx % Math.min(disponibles.length, 8) ? '#fff' : 'rgba(255,255,255,0.22)' }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: featured product card cycling */}
          {featured && (
            <div
              className="hidden sm:flex items-center pl-6 py-4"
              onClick={e => { e.stopPropagation(); onVerPrenda(featured.id); }}
            >
              <div
                className="w-[160px] bg-[rgba(255,255,255,0.05)] rounded-[14px] overflow-hidden border border-[rgba(255,255,255,0.10)] cursor-pointer transition-[border-color] duration-[250ms]"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,100,66,0.6)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)'; }}
              >
                <div className="relative aspect-[3/4] bg-[var(--dark-2)]">
                  {featured.fotos?.[0]
                    ? <Image src={cld(featured.fotos[0], 'thumb')} alt={featured.nombre ?? ''} fill sizes="160px" className="object-cover" />
                    : <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--dark-3)_0%,var(--dark-2)_100%)]" />
                  }
                  <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(30,18,13,0.7)_0%,transparent_50%)]" />
                  <div className="absolute bottom-[10px] left-[10px] right-[10px]">
                    <div className="inline-flex items-center gap-1 bg-[rgba(201,100,66,0.9)] rounded-[6px] px-2 py-[3px] text-[10px] font-extrabold text-white">
                      Disponible
                    </div>
                  </div>
                </div>
                <div className="px-3 pt-[10px] pb-3">
                  {featured.marca && <div className="text-[10px] text-[rgba(255,255,255,0.45)] font-bold uppercase tracking-[0.06em] mb-[3px]">{featured.marca}</div>}
                  <div className="text-[13px] font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis mb-[6px]">{featured.nombre}</div>
                  <div className="mono tnum text-[15px] font-black text-white">{tiendaConfig.simbolo_moneda} {featured.precio.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDropDate(value: string | null) {
  if (!value) return 'Fecha por anunciar';
  return new Intl.DateTimeFormat('es-HN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatShortDate(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-HN', { day: 'numeric', month: 'short' }).format(new Date(value));
}

/* ─── Modal suscripción ─────────────────────────────────── */
function SubscribeModal({ drop, tienda, onClose, onViewDrop }: { drop: Drop; tienda: Tienda; onClose: () => void; onViewDrop: () => void }) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const target = new Date(drop.inicia_at).getTime();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!nombre.trim() || !email.trim()) { setError('Completá tu nombre y correo.'); return; }
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.from('anotaciones').insert({
      drop_id: drop.id, nombre: nombre.trim(), apellido: apellido.trim() || null,
      email: email.trim(), telefono: telefono.trim() || null,
    } as any);
    if (err) { setError('No pudimos registrarte. Intentá de nuevo.'); setLoading(false); return; }
    setDone(true);
    setLoading(false);
  }

  return (
    <div
      className="fixed inset-0 z-[320] bg-[rgba(42,28,22,0.52)] flex items-center justify-center p-[18px] backdrop-blur-[10px]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[min(920px,100%)] max-h-[calc(100vh-36px)] overflow-y-auto bg-[#fffaf5] border border-[rgba(201,100,66,0.18)] rounded-[20px] shadow-[0_34px_100px_rgba(26,23,20,0.20)] relative"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Cerrar" className="absolute top-[14px] right-[14px] w-[34px] h-[34px] rounded-[17px] border border-[rgba(26,23,20,0.08)] bg-[rgba(255,255,255,0.74)] text-[var(--ink)] flex items-center justify-center cursor-pointer z-[3]">
          <Icons.close width={18} height={18} />
        </button>
        {done ? (
          <div className="text-center px-6 pt-[56px] pb-[50px]">
            <div className="w-[58px] h-[58px] rounded-full bg-[var(--accent)] text-white flex items-center justify-center mx-auto mb-[18px]">
              <Icons.check width={28} height={28} />
            </div>
            <h2 className="mt-0 mb-[10px] font-black text-[34px] text-[var(--ink)]">Ya estás en la lista</h2>
            <p className="mt-0 mx-auto mb-6 max-w-[420px] text-[15px] text-[var(--ink-2)] leading-[1.55]">Te avisamos cuando {drop.nombre} esté por abrir.</p>
            <button onClick={onViewDrop} className="btn btn-primary h-[46px] rounded-[10px] px-[18px] bg-[var(--accent)] text-white">Ver detalle del drop</button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
            <div className="min-h-[390px] relative bg-[linear-gradient(145deg,#6a4738_0%,#3f2a22_100%)] overflow-hidden">
              {drop.foto_portada_url
                ? <Image src={cld(drop.foto_portada_url, 'card')} alt={drop.nombre} fill sizes="(max-width: 920px) 100vw, 460px" className="object-cover" />
                : <div className="absolute inset-0 bg-[linear-gradient(135deg,#181818_0%,#2a211f_100%)]" />}
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(35,22,17,0.08),rgba(35,22,17,0.72))]" />
              <div className="absolute left-[22px] right-[22px] top-[22px] flex justify-between gap-[10px] items-center">
                <span className="inline-flex items-center gap-[7px] rounded-[20px] border border-[rgba(255,255,255,0.22)] bg-[rgba(255,255,255,0.14)] text-white px-3 py-[6px] text-[10px] font-black tracking-[0.08em]">
                  <Icons.bell width={13} height={13} />PRÓXIMO DROP
                </span>
                <span className="text-[rgba(255,255,255,0.82)] text-[13px] font-bold">{formatDropDate(drop.inicia_at)}</span>
              </div>
              <div className="absolute left-[22px] right-[22px] bottom-[22px]">
                <div className="text-[38px] leading-none font-black text-white mb-[14px]">{drop.nombre}</div>
                <div className="grid gap-4 items-end grid-cols-[1fr_auto]">
                  <div>
                    <div className="text-[10px] text-[rgba(255,255,255,0.52)] uppercase tracking-[0.1em] font-[var(--font-mono)] mb-[5px]">Abre en</div>
                    <div className="text-white text-[20px]"><CountdownInline target={target} /></div>
                  </div>
                  <button onClick={onViewDrop} className="h-[44px] rounded-lg border border-[rgba(255,255,255,0.28)] bg-[rgba(255,255,255,0.12)] text-white px-[15px] text-[13px] font-extrabold cursor-pointer">Ver detalle</button>
                </div>
              </div>
            </div>
            <div className="px-7 pt-[42px] pb-[30px] bg-[linear-gradient(180deg,#fffaf5_0%,#f4ece4_100%)]">
              <div className="mb-[22px]">
                <div className="text-[12px] uppercase tracking-[0.12em] font-black text-[var(--accent)] mb-[10px]">Aviso anticipado · {tienda.nombre}</div>
                <h2 className="mt-0 mb-[10px] text-[28px] leading-[1.05] font-black text-[var(--ink)]">Entrá al drop apenas abra</h2>
                <p className="m-0 text-[14px] text-[var(--ink-2)] leading-[1.6]">{drop.descripcion || 'Dejá tus datos y te avisamos antes del lanzamiento.'}</p>
                <div className="mt-[14px] flex gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-[6px] text-[var(--accent-3)] bg-[rgba(201,100,66,0.10)] border border-[rgba(201,100,66,0.14)] rounded-[20px] px-[10px] py-[6px] text-[12px] font-bold">
                    <Icons.clock width={13} height={13} />{drop.duracion_minutos} min de drop
                  </span>
                  <span className="inline-flex items-center gap-[6px] text-[var(--accent-3)] bg-[rgba(201,100,66,0.10)] border border-[rgba(201,100,66,0.14)] rounded-[20px] px-[10px] py-[6px] text-[12px] font-bold">
                    <Icons.mail width={13} height={13} />Aviso por correo
                  </span>
                </div>
              </div>
              <form onSubmit={submit} className="grid gap-3">
                <div className="grid gap-[10px] grid-cols-[repeat(auto-fit,minmax(130px,1fr))]">
                  <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="h-[48px] min-w-0 rounded-[10px] border border-[rgba(26,23,20,0.10)] bg-[rgba(255,255,255,0.82)] text-[var(--ink)] px-[13px] text-[14px] outline-none" />
                  <input placeholder="Apellido" value={apellido} onChange={e => setApellido(e.target.value)} className="h-[48px] min-w-0 rounded-[10px] border border-[rgba(26,23,20,0.10)] bg-[rgba(255,255,255,0.82)] text-[var(--ink)] px-[13px] text-[14px] outline-none" />
                </div>
                <input type="email" placeholder="Correo electrónico*" value={email} onChange={e => setEmail(e.target.value)} className="h-[48px] rounded-[10px] border border-[rgba(26,23,20,0.10)] bg-[rgba(255,255,255,0.82)] text-[var(--ink)] px-[13px] text-[14px] outline-none" />
                <PhoneInput size="lg" value={telefono} onChange={setTelefono} placeholder="WhatsApp opcional" inputStyle={{ height: 48, borderRadius: '0 10px 10px 0', border: '1px solid rgba(26,23,20,0.10)', background: 'rgba(255,255,255,0.82)', color: 'var(--ink)', padding: '0 13px', fontSize: 14, outline: 'none' }} selectStyle={{ height: 48, borderRadius: '10px 0 0 10px', border: '1px solid rgba(26,23,20,0.10)', background: 'rgba(255,255,255,0.82)' }} />
                {error && <div className="text-[#b91c1c] bg-[#fff1ee] border border-[rgba(185,28,28,0.12)] rounded-[10px] px-3 py-[10px] text-[13px]">{error}</div>}
                <button className="btn btn-primary btn-block h-[50px] rounded-[10px] text-[15px] mt-[2px] bg-[var(--accent)] text-white" disabled={loading}>
                  {loading ? 'Registrando...' : 'Avisarme del drop'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Profile sheet ──────────────────────────────────────── */
function BuyerProfileSheet({
  comprador,
  onClose,
  onLogout,
  onProfileUpdate,
}: {
  comprador: Comprador;
  onClose: () => void;
  onLogout: () => void;
  onProfileUpdate: (comprador: Comprador) => void;
}) {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<BuyerPedido[]>([]);
  const [pedidosCursor, setPedidosCursor] = useState<string | undefined>(undefined);
  const [hayMasPedidos, setHayMasPedidos] = useState(false);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [loadingMasPedidos, setLoadingMasPedidos] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'profile'>('orders');
  const [profileForm, setProfileForm] = useState({
    nombre: comprador.nombre,
    telefono: comprador.telefono ?? '',
    direccion: comprador.direccion ?? '',
    ciudad: comprador.ciudad ?? '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await obtenerPedidosComprador();
      if (!active) return;
      if (res.blockedOwner) {
        onLogout();
        return;
      }
      setPedidos(res.pedidos ?? []);
      setPedidosCursor(res.nextCursor);
      setHayMasPedidos(!!res.nextCursor);
      setLoadingPedidos(false);
    })();
    return () => { active = false; };
  }, [comprador.email, onLogout]);

  async function cargarMasPedidos() {
    if (!pedidosCursor || loadingMasPedidos) return;
    setLoadingMasPedidos(true);
    const res = await obtenerPedidosComprador(pedidosCursor);
    if (res.blockedOwner) { onLogout(); return; }
    setPedidos(prev => [...prev, ...(res.pedidos ?? [])]);
    setPedidosCursor(res.nextCursor);
    setHayMasPedidos(!!res.nextCursor);
    setLoadingMasPedidos(false);
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError('');
    setProfileMsg('');
    setSavingProfile(true);

    const res = await guardarPerfilComprador(profileForm);
    if (res.error || !res.comprador) {
      setProfileError(res.error ?? 'No pudimos guardar tu perfil.');
      if (res.blockedOwner) onLogout();
      setSavingProfile(false);
      return;
    }

    onProfileUpdate(res.comprador);
    setProfileMsg('Perfil actualizado');
    setSavingProfile(false);
  }

  const totalGastado = pedidos.reduce((sum, pedido) => sum + Number(pedido.monto_total ?? 0), 0);
  const direccionCompleta = [comprador.direccion, comprador.ciudad].filter(Boolean).join(', ');
  const datosGuardados = [comprador.telefono, comprador.direccion, comprador.ciudad].filter(Boolean).length;
  const initial = (comprador.nombre || comprador.email || 'C').charAt(0).toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-[rgba(8,8,8,0.62)] backdrop-blur-[10px] p-[18px]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[min(720px,calc(100vw-32px))] max-h-[calc(100vh-36px)] overflow-hidden bg-white rounded-[18px] shadow-[0_30px_90px_rgba(0,0,0,0.28)] border border-[rgba(255,255,255,0.7)] animate-[slideUp_.22s_ease]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-[22px] pb-[18px] border-b border-[rgba(0,0,0,0.07)] bg-[linear-gradient(180deg,#fbfbfb_0%,#fff_100%)]">
          <div className="flex justify-between gap-4 items-start">
            <div className="flex items-center gap-[15px] min-w-0">
              <div className="w-[58px] h-[58px] rounded-[18px] bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-3)_100%)] text-white flex items-center justify-center text-[24px] font-black shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <div className="mono text-[10px] uppercase tracking-[0.1em] text-[#999] mb-[5px]">Cuenta de compradora</div>
                <div className="text-[22px] font-black text-[#111] tracking-[-0.03em] whitespace-nowrap overflow-hidden text-ellipsis">{comprador.nombre}</div>
                <div className="flex items-center gap-[6px] text-[#777] text-[13px] mt-1 min-w-0">
                  <Icons.mail width={13} height={13} className="shrink-0" />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">{comprador.email}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="w-9 h-9 rounded-[18px] flex items-center justify-center border border-[rgba(0,0,0,0.08)] bg-white text-[#555] cursor-pointer shrink-0">
              <Icons.close width={17} height={17} />
            </button>
          </div>

          <div className="grid gap-[10px] mt-[18px] grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
            <div className="border border-[rgba(0,0,0,0.08)] rounded-[12px] px-[13px] py-3 bg-white">
              <div className="text-[11px] text-[#999] font-extrabold uppercase tracking-[0.07em]">Pedidos</div>
              <div className="mono tnum text-[22px] font-black text-[#111] mt-[5px]">{loadingPedidos ? '--' : pedidos.length}</div>
            </div>
            <div className="border border-[rgba(0,0,0,0.08)] rounded-[12px] px-[13px] py-3 bg-white">
              <div className="text-[11px] text-[#999] font-extrabold uppercase tracking-[0.07em]">Compras</div>
              <div className="mono tnum text-[22px] font-black text-[#111] mt-[5px]">{tiendaConfig.simbolo_moneda} {loadingPedidos ? '--' : totalGastado.toLocaleString()}</div>
            </div>
            <div className="border border-[rgba(0,0,0,0.08)] rounded-[12px] px-[13px] py-3 bg-white">
              <div className="text-[11px] text-[#999] font-extrabold uppercase tracking-[0.07em]">Perfil</div>
              <div className={`text-[13px] font-extrabold mt-[9px] ${datosGuardados >= 3 ? 'text-[#065f46]' : 'text-[#92400e]'}`}>
                {datosGuardados >= 3 ? 'Completo' : 'Por completar'}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pt-[14px]">
          <div className="grid grid-cols-2 gap-[6px] bg-[#f3f3f3] rounded-[12px] p-1">
            {[
              { id: 'orders' as const, label: 'Pedidos', icon: Icons.bag },
              { id: 'profile' as const, label: 'Perfil', icon: Icons.settings },
            ].map(tab => {
              const Ic = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`h-10 rounded-[9px] flex items-center justify-center gap-[7px] text-[13px] font-extrabold cursor-pointer ${selected ? 'border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_1px_5px_rgba(0,0,0,0.06)] text-[#111]' : 'border border-transparent bg-transparent text-[#777]'}`}>
                  <Ic width={15} height={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 max-h-[calc(100vh-360px)] min-h-[280px] overflow-y-auto">
          {activeTab === 'orders' && (
            <div>
              {direccionCompleta && (
                <div className="flex items-start gap-[10px] bg-[#f7f7f7] rounded-[12px] px-[14px] py-3 mb-[14px]">
                  <Icons.pin width={16} height={16} className="text-[#777] shrink-0 mt-[1px]" />
                  <div>
                    <div className="text-[12px] font-extrabold text-[#333]">Dirección guardada</div>
                    <div className="text-[12px] text-[#777] leading-[1.45] mt-[2px]">{direccionCompleta}</div>
                  </div>
                </div>
              )}
              {loadingPedidos ? (
                <div className="border border-[rgba(0,0,0,0.08)] rounded-[14px] p-[18px] text-[13px] text-[#888] bg-white">Cargando pedidos...</div>
              ) : pedidos.length === 0 ? (
                <div className="border border-dashed border-[rgba(0,0,0,0.16)] rounded-[16px] px-[22px] py-[34px] text-center bg-white">
                  <div className="w-12 h-12 rounded-[16px] bg-[#f4f4f4] flex items-center justify-center mx-auto mb-[14px] text-[#555]">
                    <Icons.bag width={22} height={22} />
                  </div>
                  <div className="text-[16px] font-black mb-[6px]">Aún no tenés pedidos con esta cuenta</div>
                  <div className="text-[13px] text-[#777] leading-[1.5] max-w-[380px] mx-auto mb-4">Cuando compres usando {comprador.email}, tu seguimiento aparecerá aquí.</div>
                  <button onClick={onClose} className="btn btn-primary h-[40px] rounded-[10px] px-[15px]">Seguir comprando</button>
                </div>
              ) : (
                <div className="grid gap-[10px]">
                  {pedidos.map(pedido => {
                    const estado = PEDIDO_LABELS[pedido.estado ?? 'apartado'] ?? PEDIDO_LABELS.apartado;
                    const item = pedido.items?.[0];
                    const prenda = item?.prenda;
                    return (
                      <button key={pedido.id} onClick={() => { onClose(); router.push(`/pedido/${pedido.numero}`); }}
                        className="w-full border border-[rgba(0,0,0,0.08)] rounded-[14px] bg-white p-3 grid grid-cols-[58px_1fr_auto] gap-3 text-left cursor-pointer items-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                      >
                        <div className="w-[58px] h-[66px] rounded-[10px] overflow-hidden bg-[#f1f1f1] relative">
                          {prenda?.fotos?.[0]
                            ? <Image src={cld(prenda.fotos[0], 'mini')} alt="" fill sizes="58px" className="object-cover" />
                            : <div className="w-full h-full bg-[linear-gradient(135deg,#eeeeee,#dddddd)]" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-[7px] mb-1 flex-wrap">
                            <span className="mono tnum text-[12px] font-black text-[#111]">{pedido.numero}</span>
                            <span className="text-[10px] font-black rounded-[20px] px-2 py-[3px] whitespace-nowrap" style={{ color: estado.tone, background: estado.bg }}>{estado.label}</span>
                          </div>
                          <div className="text-[14px] font-extrabold text-[#222] whitespace-nowrap overflow-hidden text-ellipsis">{prenda?.nombre ?? pedido.drop?.nombre ?? 'Pedido'}</div>
                          <div className="text-[12px] text-[#999] mt-[2px] whitespace-nowrap overflow-hidden text-ellipsis">{[pedido.drop?.nombre, (item?.talla_seleccionada ?? prenda?.talla) && `T. ${item?.talla_seleccionada ?? prenda?.talla}`, formatShortDate(pedido.created_at)].filter(Boolean).join(' · ')}</div>
                        </div>
                        <div className="text-right">
                          <div className="mono tnum text-[14px] font-black text-[#111]">{tiendaConfig.simbolo_moneda} {pedido.monto_total.toLocaleString()}</div>
                          <Icons.arrow width={15} height={15} className="text-[#aaa] mt-2" />
                        </div>
                      </button>
                    );
                  })}
                  {hayMasPedidos && (
                    <button onClick={cargarMasPedidos} disabled={loadingMasPedidos} className="w-full mt-[10px] h-10 rounded-[10px] border border-[rgba(0,0,0,0.1)] bg-white text-[13px] font-bold cursor-pointer text-[#555]">
                      {loadingMasPedidos ? 'Cargando...' : 'Cargar más pedidos'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="grid gap-[14px]">
              <div>
                <div className="text-[16px] font-black text-[#111] mb-[3px]">Datos de compra</div>
                <div className="text-[12px] text-[#777] leading-[1.45]">Guardamos estos datos para rellenar tus próximos checkouts.</div>
              </div>

              <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
                <div>
                  <label className="label">Nombre completo</label>
                  <input className="input input-lg" value={profileForm.nombre} onChange={e => { setProfileForm(f => ({ ...f, nombre: e.target.value })); setProfileError(''); setProfileMsg(''); }} placeholder="Karla Morales" />
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <PhoneInput size="lg" value={profileForm.telefono} onChange={v => { setProfileForm(f => ({ ...f, telefono: v })); setProfileError(''); setProfileMsg(''); }} />
                </div>
              </div>

              <div>
                <label className="label">Correo de acceso</label>
                <div className="relative">
                  <input className="input input-lg bg-[#f6f6f6] text-[#777] pl-[42px]" value={comprador.email} readOnly />
                  <Icons.mail width={16} height={16} className="absolute left-[15px] top-[17px] text-[#999]" />
                </div>
              </div>

              <div>
                <label className="label">Dirección</label>
                <input className="input input-lg" value={profileForm.direccion} onChange={e => { setProfileForm(f => ({ ...f, direccion: e.target.value })); setProfileError(''); setProfileMsg(''); }} placeholder="Colonia, calle, casa o referencia" />
              </div>

              <div>
                <label className="label">Ciudad</label>
                <input className="input input-lg" value={profileForm.ciudad} onChange={e => { setProfileForm(f => ({ ...f, ciudad: e.target.value })); setProfileError(''); setProfileMsg(''); }} placeholder="Tu ciudad" />
              </div>

              {profileError && <div className="text-[13px] text-[#b91c1c] bg-[#fef2f2] rounded-[10px] px-3 py-[10px]">{profileError}</div>}
              {profileMsg && <div className="text-[13px] text-[#047857] bg-[#ecfdf5] rounded-[10px] px-3 py-[10px] flex items-center gap-[7px]"><Icons.check width={15} height={15} />{profileMsg}</div>}

              <button className="btn btn-primary btn-block h-[48px] rounded-[12px] text-[14px] font-extrabold" disabled={savingProfile || !profileForm.nombre.trim()}>
                {savingProfile ? 'Guardando...' : 'Guardar perfil'}
              </button>
            </form>
          )}
        </div>

        <div className="px-6 pt-[14px] pb-[22px] border-t border-[rgba(0,0,0,0.07)] bg-[#fafafa] flex justify-end gap-[10px] items-center">
          <button onClick={onLogout} className="h-[38px] rounded-[10px] border border-[rgba(0,0,0,0.1)] bg-white text-[#111] px-[14px] text-[13px] font-extrabold cursor-pointer">
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Componente principal ──────────────────────────────── */
export function TiendaPageClient(props: {
  tienda: Tienda;
  drops: Drop[];
  stats: { drops: number; prendas: number };
  prendasDisponibles: Prenda[];
  prendasDrops: PrendaDrop[];
  categoriasCatalogo: string[];
  tiendaEmail: string;
  isOwnerPreview?: boolean;
}) {
  const { tienda, drops, prendasDisponibles, prendasDrops, categoriasCatalogo, tiendaEmail, isOwnerPreview = false } = props;
  const tiendaConfig = getTiendaConfig(tienda);
  const router = useRouter();
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const [showAuth, setShowAuth] = useState(false);
  const [subscribeDrop, setSubscribeDrop] = useState<Drop | null>(null);
  const [comprador, setComprador] = useState<Comprador | null>(null);
  const [showBag] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [categoryMenuRect, setCategoryMenuRect] = useState<{ left: number; top: number } | null>(null);
  const { count: carritoCount, abrirDrawer } = useCarrito();
  const [viewerCounts, setViewerCounts] = useState<Record<string, number | null>>({});
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tallaFilter, setTallaFilter] = useState<string | null>(null);
  const [marcaFilter, setMarcaFilter] = useState<string | null>(null);
  const [precioMin, setPrecioMin] = useState('');
  const [precioMax, setPrecioMax] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc'>('newest');
  const [openSections, setOpenSections] = useState({ categoria: true, talla: false, precio: false, marca: false });

  // Realtime: observar viewers de cada drop usando Broadcast (mismo canal que drop-page-client).
  useEffect(() => {
    if (drops.length === 0) return;

    const supabase = createClient();
    const STALE_MS = 15_000;
    const cleanupTimers: ReturnType<typeof setInterval>[] = [];

    const channels = drops.map(drop => {
      const peers = new Map<string, number>();
      const channel = supabase.channel(`viewers-v2-${drop.id}`);

      const recount = () => {
        const now = Date.now();
        for (const [id, ts] of peers) {
          if (now - ts > STALE_MS) peers.delete(id);
        }
        const total = peers.size;
        setViewerCounts(prev => prev[drop.id] === total ? prev : { ...prev, [drop.id]: total });
      };

      channel
        .on('broadcast', { event: 'hb' }, ({ payload }) => {
          const sid = (payload as { s?: string })?.s;
          if (!sid) return;
          peers.set(sid, Date.now());
          recount();
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            channel.send({ type: 'broadcast', event: 'ping', payload: {} }).catch(() => { });
          }
        });

      cleanupTimers.push(setInterval(recount, STALE_MS));
      return channel;
    });

    return () => {
      cleanupTimers.forEach(t => clearInterval(t));
      channels.forEach(channel => void supabase.removeChannel(channel));
    };
  }, [drops]);

  useEffect(() => {
    const refreshClock = () => setNowMs(Date.now());
    const initial = window.setTimeout(refreshClock, 0);
    const interval = window.setInterval(refreshClock, 30000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  const dropsWithLiveState = drops.map(d => (
    viewerCounts[d.id] === undefined ? d : { ...d, viewers_count: viewerCounts[d.id] }
  ));
  const hasClock = nowMs !== null;
  const isFutureDrop = (drop: Drop) => hasClock && new Date(drop.inicia_at).getTime() > nowMs;
  const isOpenDrop = (drop: Drop) => (
    hasClock &&
    drop.estado === 'activo' &&
    (!drop.cierra_at || new Date(drop.cierra_at).getTime() > nowMs)
  );
  const liveDrops = dropsWithLiveState.filter(isOpenDrop);
  const scheduledDrops = dropsWithLiveState.filter(d => d.estado === 'programado' && isFutureDrop(d));
  const popupDrop = scheduledDrops[0] ?? null;
  const popupSeenKey = popupDrop ? `fardodrops:drop-popup-seen:${tienda.id}:${popupDrop.id}` : null;
  const liveDrop = liveDrops.length === 1 ? liveDrops[0] : null;
  const liveDropTarget = liveDrop ? new Date(liveDrop.cierra_at ?? liveDrop.inicia_at).getTime() : 0;
  const liveDropAvailableUnits = liveDrop
    ? prendasDrops
      .filter(prenda => prenda.drop_id === liveDrop.id)
      .reduce((sum, prenda) => sum + getProductTotalQuantity(prenda), 0)
    : 0;

  // Carrusel de drops programados
  const [sliderIdx, setSliderIdx] = useState(0);
  const safeSliderIdx = scheduledDrops.length > 0 ? sliderIdx % scheduledDrops.length : 0;
  const sliderDrop = scheduledDrops[safeSliderIdx] ?? null;
  const sliderTarget = sliderDrop ? new Date(sliderDrop.inicia_at).getTime() : 0;
  function prevSlide() {
    if (scheduledDrops.length < 2) return;
    setSliderIdx(i => (i - 1 + scheduledDrops.length) % scheduledDrops.length);
  }
  function nextSlide() {
    if (scheduledDrops.length < 2) return;
    setSliderIdx(i => (i + 1) % scheduledDrops.length);
  }

  const productCategoryCounts = prendasDisponibles.reduce<Record<string, number>>((acc, prenda) => {
    const category = prenda.categoria?.trim();
    if (!category) return acc;
    acc[category] = (acc[category] ?? 0) + getProductTotalQuantity(prenda);
    return acc;
  }, {});
  const productCategoryNames = Object.keys(productCategoryCounts);
  const configuredCategoryNames = categoriasCatalogo.map(c => c.trim()).filter(Boolean);
  const orderedCategoryNames = Array.from(new Set([...configuredCategoryNames, ...productCategoryNames]))
    .filter(category => (productCategoryCounts[category] ?? 0) > 0);
  const selectedCategory = catFilter && catFilter !== 'Todo' ? catFilter : null;
  const defaultVisibleCategories = orderedCategoryNames.slice(0, MAX_VISIBLE_CATEGORIES);
  const visibleCategoryNames = selectedCategory && !defaultVisibleCategories.includes(selectedCategory)
    ? [selectedCategory, ...defaultVisibleCategories.slice(0, MAX_VISIBLE_CATEGORIES - 1)]
    : defaultVisibleCategories;
  const overflowCategoryNames = orderedCategoryNames.filter(category => !visibleCategoryNames.includes(category));
  const hasMoreCategories = overflowCategoryNames.length > 0;
  const allTallas = Array.from(new Set(
    prendasDisponibles.flatMap(p => {
      const sizes = getProductSizes(p);
      return sizes.length > 0 ? sizes : (p.talla ? [p.talla] : []);
    })
  )).sort();
  const allMarcas = Array.from(new Set(
    prendasDisponibles.map(p => p.marca?.trim()).filter((m): m is string => Boolean(m))
  )).sort();
  const prendasFiltradas = prendasDisponibles
    .filter(p => {
      if (catFilter && catFilter !== 'Todo') {
        if ((p.categoria ?? '').trim().toLowerCase() !== catFilter.trim().toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!p.nombre?.toLowerCase().includes(q) && !p.marca?.toLowerCase().includes(q)) return false;
      }
      if (tallaFilter) {
        const sizes = getProductSizes(p);
        if (!sizes.includes(tallaFilter) && p.talla !== tallaFilter) return false;
      }
      if (marcaFilter) {
        if ((p.marca ?? '').trim().toLowerCase() !== marcaFilter.toLowerCase()) return false;
      }
      const minVal = precioMin ? parseFloat(precioMin) : null;
      const maxVal = precioMax ? parseFloat(precioMax) : null;
      if (minVal !== null && p.precio < minVal) return false;
      if (maxVal !== null && p.precio > maxVal) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'oldest') return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
      if (sortOrder === 'price_asc') return a.precio - b.precio;
      if (sortOrder === 'price_desc') return b.precio - a.precio;
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });
  const prendasVisibles = prendasFiltradas.slice(0, visibleCount);
  const hayMasPrendas = prendasFiltradas.length > visibleCount;
  const NUEVO_THRESHOLD_MS = 72 * 60 * 60 * 1000;
  const totalUnidades = prendasDisponibles.reduce((s, p) => s + getProductTotalQuantity(p), 0);
  const unidadesFiltradas = prendasFiltradas.reduce((s, p) => s + getProductTotalQuantity(p), 0);
  const { agregarItem, tieneItem, abrirDrawer: abrirCarrito } = useCarrito();
  const showNoDropBanner = hasClock && liveDrops.length === 0 && scheduledDrops.length === 0;
  const scrollToCatalog = () => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const selectCategory = (category: string | null) => {
    setCatFilter(category);
    setVisibleCount(12);
    setShowCategoryMenu(false);
    setCategoryMenuRect(null);
  };
  const toggleCategoryMenu = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setCategoryMenuRect({ left: Math.min(rect.left, window.innerWidth - 280), top: rect.bottom + 8 });
    setShowCategoryMenu(open => !open);
  };
  const hasActiveFilters = Boolean(catFilter || searchQuery.trim() || tallaFilter || marcaFilter || precioMin || precioMax);
  const clearAllFilters = () => {
    setCatFilter(null);
    setSearchQuery('');
    setTallaFilter(null);
    setMarcaFilter(null);
    setPrecioMin('');
    setPrecioMax('');
    setVisibleCount(12);
  };

  useEffect(() => {
    if (isOwnerPreview) return;
    (async () => {
      const res = await obtenerPerfilComprador();
      if (res.comprador) setComprador(res.comprador);
      if (res.blockedOwner) setComprador(null);
    })();
  }, [isOwnerPreview]);

  useEffect(() => {
    if (!popupDrop || !popupSeenKey) return;
    try { if (window.localStorage.getItem(popupSeenKey) === '1') return; } catch { return; }
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(popupSeenKey, '1'); } catch { return; }
      setSubscribeDrop(current => current ?? popupDrop);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [popupDrop, popupSeenKey]);

  async function handleLogout() {
    await cerrarSesionComprador();
    setComprador(null);
    setShowAuth(false);
  }

  function closeSubscribeModal() {
    if (subscribeDrop) {
      try { window.localStorage.setItem(`fardodrops:drop-popup-seen:${tienda.id}:${subscribeDrop.id}`, '1'); } catch { }
    }
    setSubscribeDrop(null);
  }

  const initials = tienda.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const footerAddressParts = [tienda.ubicacion, tienda.ciudad, tienda.departamento]
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part));
  const footerAddress = footerAddressParts.reduce<string[]>((parts, part) => {
    const normalizedPart = part.toLowerCase();
    const alreadyIncluded = parts.some(existing => {
      const normalizedExisting = existing.toLowerCase();
      return normalizedExisting.includes(normalizedPart) || normalizedPart.includes(normalizedExisting);
    });
    return alreadyIncluded ? parts : [...parts, part];
  }, []).join(', ');

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_center,rgba(201,100,66,0.08)_0%,transparent_28%),linear-gradient(180deg,#fffdfa_0%,#faf7f1_48%,#f3eee7_100%)] font-[var(--font-sans)]">
      {isOwnerPreview && (
        <div className="sticky top-0 z-[999] bg-[linear-gradient(135deg,#4a332a_0%,#2f211a_100%)] text-[#fff7f2] flex items-center justify-between px-5 py-[10px] gap-3 text-[13px]">
          <span className="opacity-70">Vista previa de tu tienda — los clientes no ven este aviso</span>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-[#fff7f2] text-[var(--accent-3)] border-none rounded-[10px] px-[14px] py-[6px] font-bold text-[12px] cursor-pointer shrink-0"
          >
            ← Volver al dashboard
          </button>
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="bg-[rgba(255,253,250,0.82)] border-b border-[var(--line)] sticky top-0 z-[100] backdrop-blur-[18px]">
        <div className="store-header-inner">
          {/* Avatar + info tienda */}
          <div className="store-header-store flex items-center gap-3 flex-1 min-w-0">
            <div className="store-header-logo relative shrink-0">
              {tienda.logo_url
                ? <Image src={cld(tienda.logo_url, 'logo')} alt={tienda.nombre} width={44} height={44} className="rounded-[22px] object-cover border-2 border-[#eee]" />
                : <div className="w-[44px] h-[44px] rounded-[22px] bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-3)_100%)] flex items-center justify-center text-[14px] font-extrabold text-white border-2 border-[rgba(255,255,255,0.9)]">{initials}</div>}
              {liveDrops.length > 0 && (
                <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#C96442] border-2 border-white [animation:pulse_1.4s_ease-in-out_infinite]" />
              )}
            </div>
            <div className="store-header-info min-w-0">
              <div className="text-[15px] font-bold text-[#111] whitespace-nowrap overflow-hidden text-ellipsis">{tienda.nombre}</div>
              <div className="store-header-meta">
                {(tienda.ciudad || tienda.ubicacion) && (
                  <span className="text-[12px] text-[#888] flex items-center gap-[3px] shrink-0">
                    <Icons.pin width={11} height={11} />{tienda.ciudad ?? tienda.ubicacion}
                  </span>
                )}
                {tienda.instagram && (
                  <a
                    href={`https://instagram.com/${tienda.instagram.replace('@', '')}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[12px] text-[#888] flex items-center gap-[3px] no-underline">
                    <Icons.ig width={11} height={11} />{tienda.instagram}
                  </a>
                )}
                {tiendaEmail && (
                  <a
                    className="store-header-email text-[12px] text-[#888] flex items-center gap-[3px] no-underline"
                    href={`mailto:${tiendaEmail}`}
                    onClick={e => e.stopPropagation()}>
                    <Icons.mail width={11} height={11} />{tiendaEmail}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="store-header-actions flex gap-2 items-center shrink-0">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: tienda.nombre, url: window.location.href }).catch(() => { });
                } else {
                  navigator.clipboard?.writeText(window.location.href);
                }
              }}
              className="store-header-share flex items-center gap-[6px] h-[38px] px-[14px] rounded-[20px] border border-[var(--line)] bg-[rgba(255,255,255,0.78)] text-[var(--ink)] text-[13px] font-medium cursor-pointer">
              <Icons.arrow width={14} height={14} className="-rotate-45" />
              Compartir
            </button>
            {!isOwnerPreview && (
              <button
                className="store-header-account flex items-center gap-[6px] h-[38px] px-[14px] rounded-[20px] bg-[var(--accent)] text-white text-[13px] font-semibold cursor-pointer border-none shadow-[0_10px_24px_rgba(201,100,66,0.22)]"
                onClick={() => setShowAuth(true)}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <path d="M3 16a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                {comprador ? comprador.nombre.split(' ')[0] : 'Mi cuenta'}
              </button>
            )}
            <button
              className={`store-header-cart relative flex items-center justify-center w-[38px] h-[38px] rounded-[20px] border border-[var(--line)] cursor-pointer ${carritoCount > 0 ? 'bg-[var(--accent-3)] text-white' : 'bg-white text-[var(--accent-3)]'}`}
              onClick={abrirDrawer}
              title="Ver carrito"
            >
              <Icons.bag width={16} height={16} />
              {carritoCount > 0 && (
                <span className="absolute top-[-4px] right-[-4px] w-[18px] h-[18px] rounded-[9px] bg-[#C96442] text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
                  {carritoCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── BANNER DROP EN VIVO (1 solo) o CARRUSEL DROPS PROGRAMADOS ── */}
      {liveDrop && (
        <LiveDropHero
          drop={liveDrop}
          prendas={prendasDrops.filter(p => p.drop_id === liveDrop.id)}
          closeTarget={liveDropTarget}
          availableUnits={liveDropAvailableUnits}
          viewers={liveDrop.viewers_count ?? 0}
          onVerDrop={() => router.push(`/${tienda.username}/drop/${liveDrop.id}`)}
          onVerPrenda={(prendaId) => router.push(`/${tienda.username}/drop/${liveDrop.id}/prenda/${prendaId}`)}
        />
      )}

      {/* ── SECCIÓN DROPS EN VIVO (2+) ── */}
      {liveDrops.length > 1 && (
        <div className="bg-[linear-gradient(135deg,#5b3d31_0%,#3c2720_55%,#2a1c16_100%)] px-5 py-4">
          <div className="max-w-[1100px] mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#C96442] inline-block [animation:pulse_1.4s_ease-in-out_infinite]" />
              <span className="text-[11px] font-extrabold text-[#C96442] uppercase tracking-[0.1em] font-[var(--font-mono)]">DROPS EN VIVO</span>
            </div>
            <div className="grid gap-[10px] grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {liveDrops.map(d => {
                const target = new Date(d.cierra_at ?? d.inicia_at).getTime();
                return (
                  <div key={d.id}
                    onClick={() => router.push(`/${tienda.username}/drop/${d.id}`)}
                    className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-[12px] px-4 py-[14px] cursor-pointer flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{d.nombre}</div>
                      <div className="text-[12px] text-[rgba(255,255,255,0.5)] mt-[3px] flex items-center gap-2 flex-wrap">
                        <span>Cierra en <CountdownInline target={target} /></span>
                        <span className="inline-flex items-center gap-1">
                          <Icons.eye width={12} height={12} />
                          {d.viewers_count ?? 0} viendo
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/${tienda.username}/drop/${d.id}`); }}
                      className="h-[34px] rounded-[8px] bg-[#ef4444] text-white border-none px-[14px] text-[12px] font-bold cursor-pointer shrink-0">
                      Ver
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CARRUSEL DROPS PROGRAMADOS ── */}
      {!liveDrop && liveDrops.length === 0 && scheduledDrops.length > 0 && (
        <div className="bg-[linear-gradient(135deg,#5b3d31_0%,#3c2720_55%,#2a1c16_100%)] px-5 py-[14px]">
          <div className="max-w-[1100px] mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Flechas solo si hay más de 1 drop */}
              {scheduledDrops.length > 1 && (
                <button onClick={prevSlide}
                  className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.15)] text-white flex items-center justify-center cursor-pointer shrink-0">
                  <Icons.back width={14} height={14} />
                </button>
              )}
              <div className="w-[38px] h-[38px] rounded-full bg-[rgba(255,255,255,0.12)] flex items-center justify-center shrink-0">
                <Icons.bell width={16} height={16} className="text-white" />
              </div>
              <div onClick={() => router.push(`/${tienda.username}/drop/${sliderDrop!.id}`)} className="cursor-pointer min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold text-[rgba(255,255,255,0.55)] uppercase tracking-[0.1em] font-[var(--font-mono)] bg-[rgba(255,255,255,0.08)] px-2 py-[2px] rounded-[4px]">PRÓXIMO DROP</span>
                  {scheduledDrops.length > 1 && (
                    <span className="text-[10px] text-[rgba(255,255,255,0.4)] font-[var(--font-mono)]">{safeSliderIdx + 1}/{scheduledDrops.length}</span>
                  )}
                </div>
                <div className="text-[15px] font-bold text-white mt-[2px] whitespace-nowrap overflow-hidden text-ellipsis">
                  {sliderDrop!.nombre}
                </div>
                {(() => {
                  const n = sliderDrop!.prendas?.[0]?.count ?? 0;
                  if (n === 0) return null;
                  return <div className="text-[12px] text-[rgba(255,255,255,0.5)] mt-[2px]">{n} {n === 1 ? 'prenda' : 'prendas'}</div>;
                })()}
              </div>
              {scheduledDrops.length > 1 && (
                <button onClick={nextSlide}
                  className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.15)] text-white flex items-center justify-center cursor-pointer shrink-0">
                  <Icons.arrow width={14} height={14} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <CountdownBlocks target={sliderTarget} />
              <button
                onClick={() => setSubscribeDrop(sliderDrop)}
                className="h-10 rounded-[8px] bg-white text-[#111] border-none px-5 text-[13px] font-bold cursor-pointer whitespace-nowrap">
                Notificarme
              </button>
            </div>
          </div>
          {/* Dots indicadores */}
          {scheduledDrops.length > 1 && (
            <div className="max-w-[1100px] mx-auto mt-[10px] flex gap-[5px] justify-center">
              {scheduledDrops.map((_, i) => (
                <button key={i} onClick={() => setSliderIdx(i)}
                  className="h-[6px] rounded-[3px] border-none cursor-pointer p-0 transition-all duration-200"
                  style={{ width: i === safeSliderIdx ? 18 : 6, background: i === safeSliderIdx ? '#fff' : 'rgba(255,255,255,0.25)' }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ESTADO SIN DROP ACTIVO O PROGRAMADO ── */}
      {showNoDropBanner && (
        <div className="store-no-drop-banner bg-[linear-gradient(135deg,#5b3d31_0%,#3c2720_55%,#2a1c16_100%)] px-5 py-4">
          <div className="store-no-drop-inner max-w-[1100px] mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="store-no-drop-copy-row flex items-center gap-3 min-w-0 flex-1">
              <div className="store-no-drop-icon w-[38px] h-[38px] rounded-full bg-[rgba(255,255,255,0.12)] text-white flex items-center justify-center shrink-0">
                <Icons.box width={16} height={16} />
              </div>
              <div className="store-no-drop-text min-w-0">
                <span className="text-[10px] font-extrabold text-[rgba(255,255,255,0.55)] uppercase tracking-[0.1em] font-[var(--font-mono)] bg-[rgba(255,255,255,0.08)] px-2 py-[2px] rounded-[4px]">SIN DROP PROGRAMADO</span>
                <div className="store-no-drop-title text-[15px] font-bold text-white mt-[5px]">
                  {totalUnidades > 0 ? 'Por ahora comprá desde el catálogo' : 'Nuevos drops próximamente'}
                </div>
                <div className="text-[12px] text-[rgba(255,255,255,0.5)] mt-[2px] leading-[1.45]">
                  {totalUnidades > 0
                    ? 'Cuando la tienda programe otro drop, aparecerá aquí con su contador.'
                    : 'La tienda todavía no tiene piezas disponibles ni un lanzamiento agendado.'}
                </div>
              </div>
            </div>
            {totalUnidades > 0 ? (
              <button
                className="store-no-drop-action h-10 rounded-[8px] bg-white text-[#111] border-none px-5 text-[13px] font-bold cursor-pointer whitespace-nowrap"
                onClick={scrollToCatalog}>
                Ver catálogo
              </button>
            ) : tienda.instagram ? (
              <a
                className="store-no-drop-action h-10 rounded-[8px] bg-white text-[#111] no-underline px-5 text-[13px] font-bold inline-flex items-center gap-[7px] whitespace-nowrap"
                href={`https://instagram.com/${tienda.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer">
                <Icons.ig width={14} height={14} />
                Seguir tienda
              </a>
            ) : null}
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div id="catalogo" className="store-catalog">
        <div className="flex gap-6 items-start">

          {/* ── SIDEBAR FILTROS ── */}
          <div className="store-sidebar w-[260px] shrink-0 bg-white rounded-[16px] border border-[#E8E4DF] overflow-hidden sticky top-[72px]">

            {/* Search */}
            <div className="px-[14px] pt-[14px] pb-3 border-b border-[#E8E4DF]">
              <div className="relative">
                <svg className="absolute left-[11px] top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" /><path d="M14 14l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  className="input pl-8 pr-[10px] h-[38px] text-[13px] rounded-[10px]"
                  placeholder="Buscar prenda, marca..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setVisibleCount(12); }}
                />
              </div>
            </div>

            {/* CATEGORÍA */}
            <div className="border-b border-[#E8E4DF]">
              <button
                onClick={() => setOpenSections(s => ({ ...s, categoria: !s.categoria }))}
                className="w-full px-[18px] py-[15px] flex items-center justify-between bg-none border-none cursor-pointer"
              >
                <span className="text-[12px] font-extrabold tracking-[0.08em] text-[#111] uppercase">Categoría</span>
                <svg className={`shrink-0 transition-transform duration-200 ${openSections.categoria ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M5 7.5l5 5 5-5" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {openSections.categoria && orderedCategoryNames.length > 0 && (
                <div className="px-2 pb-[10px]">
                  {orderedCategoryNames.map(cat => (
                    <button key={cat}
                      onClick={() => { setCatFilter(catFilter === cat ? null : cat); setVisibleCount(12); }}
                      className={`w-full px-[10px] py-[7px] rounded-[8px] border-none text-[13px] cursor-pointer text-left flex justify-between items-center ${catFilter === cat ? 'bg-[#f7efe7] text-[var(--accent)] font-bold' : 'bg-transparent text-[#333] font-medium'}`}>
                      <span>{cat}</span>
                      <span className={`text-[11px] font-semibold ${catFilter === cat ? 'text-[var(--accent)]' : 'text-[#bbb]'}`}>{productCategoryCounts[cat] ?? 0}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* TALLA */}
            <div className="border-b border-[#E8E4DF]">
              <button
                onClick={() => setOpenSections(s => ({ ...s, talla: !s.talla }))}
                className="w-full px-[18px] py-[15px] flex items-center justify-between bg-none border-none cursor-pointer"
              >
                <span className="text-[12px] font-extrabold tracking-[0.08em] text-[#111] uppercase">Talla</span>
                <svg className={`shrink-0 transition-transform duration-200 ${openSections.talla ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M5 7.5l5 5 5-5" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {openSections.talla && allTallas.length > 0 && (
                <div className="px-[10px] pb-3 flex flex-wrap gap-[6px]">
                  {allTallas.map(talla => (
                    <button key={talla}
                      onClick={() => { setTallaFilter(tallaFilter === talla ? null : talla); setVisibleCount(12); }}
                      className={`px-3 py-[5px] rounded-[8px] text-[12px] font-semibold cursor-pointer ${tallaFilter === talla ? 'bg-[var(--accent)] text-white border-none' : 'bg-white text-[#444] border border-[#E8E4DF]'}`}>
                      {talla}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PRECIO */}
            <div className="border-b border-[#E8E4DF]">
              <button
                onClick={() => setOpenSections(s => ({ ...s, precio: !s.precio }))}
                className="w-full px-[18px] py-[15px] flex items-center justify-between bg-none border-none cursor-pointer"
              >
                <span className="text-[12px] font-extrabold tracking-[0.08em] text-[#111] uppercase">Precio</span>
                <svg className={`shrink-0 transition-transform duration-200 ${openSections.precio ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M5 7.5l5 5 5-5" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {openSections.precio && (
                <div className="px-[14px] pb-[14px] flex gap-2 items-center">
                  <input
                    className="input flex-1 h-9 text-[13px] rounded-[8px] min-w-0"
                    type="number"
                    placeholder="Min"
                    value={precioMin}
                    onChange={e => { setPrecioMin(e.target.value); setVisibleCount(12); }}
                  />
                  <span className="text-[#ccc] text-[12px]">—</span>
                  <input
                    className="input flex-1 h-9 text-[13px] rounded-[8px] min-w-0"
                    type="number"
                    placeholder="Max"
                    value={precioMax}
                    onChange={e => { setPrecioMax(e.target.value); setVisibleCount(12); }}
                  />
                </div>
              )}
            </div>

            {/* MARCA */}
            <div>
              <button
                onClick={() => setOpenSections(s => ({ ...s, marca: !s.marca }))}
                className="w-full px-[18px] py-[15px] flex items-center justify-between bg-none border-none cursor-pointer"
              >
                <span className="text-[12px] font-extrabold tracking-[0.08em] text-[#111] uppercase">Marca</span>
                <svg className={`shrink-0 transition-transform duration-200 ${openSections.marca ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M5 7.5l5 5 5-5" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {openSections.marca && allMarcas.length > 0 && (
                <div className="px-2 pb-[10px]">
                  {allMarcas.map(marca => (
                    <button key={marca}
                      onClick={() => { setMarcaFilter(marcaFilter === marca ? null : marca); setVisibleCount(12); }}
                      className={`w-full px-[10px] py-[7px] rounded-[8px] border-none text-[13px] cursor-pointer text-left ${marcaFilter === marca ? 'bg-[#f7efe7] text-[var(--accent)] font-bold' : 'bg-transparent text-[#333] font-medium'}`}>
                      {marca}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Limpiar filtros */}
            {hasActiveFilters && (
              <div className="px-[14px] pt-[10px] pb-[14px] border-t border-[#E8E4DF]">
                <button onClick={clearAllFilters} className="w-full h-9 rounded-[9px] border border-[#E8E4DF] bg-white text-[#888] text-[12px] font-bold cursor-pointer">
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>

          {/* ── CONTENIDO PRINCIPAL ── */}
          <div className="flex-1 min-w-0">

            {/* Header: título + sort */}
            <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
              <div>
                <div className="text-[22px] font-black text-[#111] tracking-[-0.02em] leading-[1.2]">
                  {catFilter ? catFilter : 'Todas las prendas'}
                </div>
                <div className="text-[13px] text-[#888] mt-[3px]">
                  {prendasFiltradas.length} {prendasFiltradas.length === 1 ? 'prenda' : 'prendas'}
                </div>
              </div>
              <div className="relative">
                <select
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value as typeof sortOrder)}
                  className="appearance-none pr-9 pl-[14px] h-10 rounded-[12px] border border-[#E8E4DF] bg-white text-[13px] font-semibold cursor-pointer text-[#333]"
                >
                  <option value="newest">Más recientes</option>
                  <option value="oldest">Más antiguos</option>
                  <option value="price_asc">Menor precio</option>
                  <option value="price_desc">Mayor precio</option>
                </select>
                <svg className="absolute right-[10px] top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <path d="M5 7.5l5 5 5-5" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Grid de productos */}
            {prendasFiltradas.length === 0 ? (
              <div className="text-center py-[80px] text-[#999]">
                <div className="w-[48px] h-[48px] rounded-[12px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-center mx-auto mb-[14px] text-[var(--ink-3)]">
                  <Icons.grid width={19} height={19} />
                </div>
                <div className="text-[16px] font-semibold text-[#444] mb-[6px]">{catFilter ? `Sin prendas en ${catFilter}` : 'Sin prendas disponibles'}</div>
                <div className="text-[13px]">El inventario de esta tienda aparecerá aquí.</div>
              </div>
            ) : (
              <>
                <div className="store-product-grid">
                  {prendasVisibles.map((p, i) => {
                    const vistas = p.drop_id ? (dropsWithLiveState.find(d => d.id === p.drop_id)?.viewers_count ?? 0) : null;
                    const esNueva = nowMs !== null && p.created_at ? (nowMs - new Date(p.created_at).getTime() < NUEVO_THRESHOLD_MS) : false;
                    const tallaCarrito = getPrimaryProductSize(p);
                    const tieneVariantes = getProductSizes(p).length > 1;
                    const enCarrito = tallaCarrito ? tieneItem(p.id, tallaCarrito) : tieneItem(p.id);
                    const href = `/${tienda.username}/prenda/${p.id}`;

                    return (
                      <PublicProductCard
                        key={p.id}
                        product={p}
                        tone={(['rose', 'sand', 'sage'] as const)[i % 3]}
                        isNew={esNueva}
                        views={vistas}
                        cartActive={!tieneVariantes && enCarrito}
                        cartTitle={tieneVariantes ? 'Elegir talla' : enCarrito ? 'Ver carrito' : 'Añadir al carrito'}
                        simbolo={tiendaConfig.simbolo_moneda}
                        onOpen={() => router.push(href)}
                        onBuy={() => router.push(href)}
                        onCart={() => {
                          if (tieneVariantes) {
                            router.push(href);
                          } else if (enCarrito) {
                            abrirCarrito();
                          } else {
                            agregarItem({
                              prendaId: p.id,
                              nombre: p.nombre,
                              marca: p.marca ?? null,
                              talla: tallaCarrito,
                              precio: p.precio,
                              foto: p.fotos?.[0] ?? null,
                              tiendaUsername: tienda.username,
                              tiendaId: tienda.id,
                            });
                          }
                        }}
                      />
                    );
                  })}
                </div>

                {/* Ver más */}
                {hayMasPrendas && (
                  <div className="text-center mt-8">
                    <button onClick={() => setVisibleCount(c => c + 12)} className="h-11 px-8 rounded-[22px] border border-[#E8E4DF] bg-white text-[14px] font-semibold cursor-pointer inline-flex items-center gap-2 text-[#4A4540]">
                      Ver más productos ({prendasFiltradas.length - visibleCount} restantes)
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M3 10l7 7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    </button>
                  </div>
                )}
              </>
            )}

          </div>{/* fin columna principal */}
        </div>{/* fin flex sidebar+main */}

        {/* ── BENEFICIOS ── */}
        <div className="mt-12 bg-white rounded-[16px] border border-[#E8E4DF] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          {[
            {
              svg: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 8h14l-1.5 9H6.5L5 8z" />
                  <path d="M5 8l-.75-3H2" />
                  <circle cx="9" cy="20" r="1" />
                  <circle cx="15" cy="20" r="1" />
                </svg>
              ),
              title: 'Envío Rápido',
              desc: `Recibe tu compra en cualquier parte de ${tiendaConfig.pais}`,
            },
            {
              svg: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                </svg>
              ),
              title: 'Calidad Garantizada',
              desc: 'Todas las prendas en excelente estado',
            },
            {
              svg: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21C12 21 3 15.5 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12z" />
                </svg>
              ),
              title: '100% Auténtico',
              desc: 'Piezas originales verificadas',
            },
          ].map((b, i, arr) => (
            <div key={i} className={`text-center px-6 py-7 flex flex-col items-center gap-[10px] ${i < arr.length - 1 ? 'border-r border-[#E8E4DF]' : ''}`}>
              <div className="w-[44px] h-[44px] rounded-[12px] bg-[#F2F0EC] flex items-center justify-center text-[#1A1714]">
                {b.svg}
              </div>
              <div className="text-[14px] font-bold text-[#111]">{b.title}</div>
              <div className="text-[12px] text-[#888] leading-[1.6] max-w-[180px]">{b.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="bg-[linear-gradient(180deg,#fffaf5_0%,#f4ede6_100%)] text-[var(--ink)] px-5 pt-8 pb-6 border-t border-[var(--line)]">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex items-start justify-between gap-6 flex-wrap mb-6 pb-6 border-b border-[var(--line)]">
            <div>
              <div className="text-[18px] font-extrabold mb-[6px]">{tienda.nombre}</div>
              <div className="text-[13px] text-[var(--ink-3)] max-w-[280px] leading-[1.55]">
                {tienda.bio || 'Tu tienda de moda sostenible'}
              </div>
              <div className="store-footer-contact-row flex items-center flex-wrap mt-3 max-w-[620px] gap-x-[14px] gap-y-[10px]">
                {footerAddress && (
                  <div className="store-footer-address inline-flex items-start gap-[6px] text-[13px] text-[var(--ink-2)] leading-[1.45]">
                    <Icons.pin width={14} height={14} className="mt-[2px] shrink-0" />
                    <span>{footerAddress}</span>
                  </div>
                )}
                {tienda.instagram && (
                  <a href={`https://instagram.com/${tienda.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-[6px] text-[13px] text-[var(--ink-2)] no-underline">
                    <Icons.ig width={14} height={14} />
                    {tienda.instagram}
                  </a>
                )}
                {tiendaEmail && (
                  <a href={`mailto:${tiendaEmail}`}
                    className="inline-flex items-center gap-[6px] text-[13px] text-[var(--ink-2)] no-underline">
                    <Icons.mail width={14} height={14} />
                    {tiendaEmail}
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-[12px] text-[var(--ink-3)]">© {new Date().getFullYear()} - {tienda.nombre} · Tecnología de Droppi</div>
            {(tienda.instagram || tienda.facebook || tienda.tiktok) && (
              <div className="store-footer-socials flex flex-col items-end gap-2">
                <div className="text-[11px] text-[var(--ink-3)] uppercase tracking-[0.08em]">Seguínos en nuestras redes</div>
                <div className="flex items-center gap-2">
                  {tienda.instagram && (
                    <a href={`https://instagram.com/${tienda.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                      title="Instagram"
                      className="flex items-center justify-center w-[34px] h-[34px] rounded-full border border-[var(--line)] text-[var(--ink-2)] no-underline bg-[rgba(255,255,255,0.72)]">
                      <Icons.ig width={16} height={16} />
                    </a>
                  )}
                  {tienda.facebook && (
                    <a href={tienda.facebook.startsWith('http') ? tienda.facebook : `https://facebook.com/${tienda.facebook}`} target="_blank" rel="noopener noreferrer"
                      title="Facebook"
                      className="flex items-center justify-center w-[34px] h-[34px] rounded-full border border-[var(--line)] text-[var(--ink-2)] no-underline bg-[rgba(255,255,255,0.72)]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                    </a>
                  )}
                  {tienda.tiktok && (
                    <a href={tienda.tiktok.startsWith('http') ? tienda.tiktok : `https://tiktok.com/@${tienda.tiktok.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                      title="TikTok"
                      className="flex items-center justify-center w-[34px] h-[34px] rounded-full border border-[var(--line)] text-[var(--ink-2)] no-underline bg-[rgba(255,255,255,0.72)]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" /></svg>
                    </a>
                  )}
                  {tienda.whatsapp && (
                    <a href={`https://wa.me/${tienda.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      title="WhatsApp"
                      className="flex items-center justify-center w-[34px] h-[34px] rounded-full border border-[var(--line)] text-[#25d366] no-underline bg-[rgba(255,255,255,0.72)]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </footer>

      {/* ── MODALS ── */}
      {subscribeDrop && (
        <SubscribeModal
          drop={subscribeDrop}
          tienda={tienda}
          onClose={closeSubscribeModal}
          onViewDrop={() => {
            const dropId = subscribeDrop.id;
            closeSubscribeModal();
            router.push(`/${tienda.username}/drop/${dropId}`);
          }}
        />
      )}
      {!isOwnerPreview && showAuth && !comprador && <BuyerAuthModal onClose={() => setShowAuth(false)} onSuccess={c => { setComprador(c); setShowAuth(false); }} />}
      {!isOwnerPreview && showAuth && comprador && (
        <BuyerProfileSheet
          comprador={comprador}
          onClose={() => setShowAuth(false)}
          onLogout={handleLogout}
          onProfileUpdate={setComprador}
        />
      )}
      {showBag && <div className="hidden" />}
    </div>
  );
}
