'use client';

import Image from 'next/image';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Ph } from '@/components/shared/image-placeholder';
import { Icons } from '@/components/shared/icons';
import { useCountdown, pad } from '@/hooks/use-countdown';
import {
  cerrarSesionComprador,
  guardarPerfilComprador,
  iniciarSesionComprador,
  obtenerPedidosComprador,
  obtenerPerfilComprador,
  registrarComprador,
  type CompradorPedidoResumen,
} from '@/lib/buyer/actions';
import { createClient } from '@/lib/supabase/client';
import { formatProductSizes, getPrimaryProductSize, getProductSizes, getProductTotalQuantity } from '@/lib/product-sizes';
import type { Database } from '@/types/database';
import { useCarrito } from '@/hooks/use-carrito';

type Tienda = Database['public']['Tables']['tiendas']['Row'];
type Drop = Pick<Database['public']['Tables']['drops']['Row'], 'id' | 'nombre' | 'descripcion' | 'estado' | 'inicia_at' | 'cierra_at' | 'duracion_minutos' | 'foto_portada_url' | 'vendidas_count' | 'viewers_count'> & { prendas?: { count: number }[] };
type Prenda = Pick<Database['public']['Tables']['prendas']['Row'], 'id' | 'nombre' | 'precio' | 'cantidad' | 'cantidades_por_talla' | 'categoria' | 'talla' | 'tallas' | 'marca' | 'fotos' | 'estado' | 'drop_id'>;
type PrendaDrop = Pick<Database['public']['Tables']['prendas']['Row'], 'id' | 'drop_id' | 'talla' | 'tallas' | 'cantidad' | 'cantidades_por_talla' | 'estado'>;
type Comprador = { nombre: string; email: string; telefono?: string | null; direccion?: string | null; ciudad?: string | null };
type BuyerPedido = CompradorPedidoResumen;

const PEDIDO_LABELS: Record<string, { label: string; tone: string; bg: string }> = {
  apartado:    { label: 'Apartado',       tone: '#92400e', bg: '#fffbeb' },
  por_verificar:{ label: 'Pago en revisión', tone: '#7c2d12', bg: '#fff7ed' },
  pagado:      { label: 'Pagado',         tone: '#065f46', bg: '#ecfdf5' },
  empacado:    { label: 'Empacado',       tone: '#1d4ed8', bg: '#eff6ff' },
  en_camino:   { label: 'En camino',      tone: '#3730a3', bg: '#eef2ff' },
  enviado:     { label: 'Enviado',        tone: '#3730a3', bg: '#eef2ff' },
  entregado:   { label: 'Entregado',      tone: '#166534', bg: '#f0fdf4' },
  cancelado:   { label: 'Cancelado',      tone: '#991b1b', bg: '#fef2f2' },
};

const BUYER_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BUYER_PHONE_RE = /^[+\d][\d\s().-]{6,39}$/;
const MAX_VISIBLE_CATEGORIES = 4;

/* ── Countdown inline ── */
function CountdownBlocks({ target }: { target: number }) {
  const { h, m, s, d, ready } = useCountdown(target);
  const hours = d * 24 + h;
  const blocks = [
    { v: pad(hours), l: 'HORAS' },
    { v: pad(m),     l: 'MIN' },
    { v: pad(s),     l: 'SEG' },
  ];
  if (!ready) return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {blocks.map(b => (
        <div key={b.l} style={{ textAlign: 'center' }}>
          <div className="store-countdown-block" style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-mono)', lineHeight: 1, color: '#fff', minWidth: 44, background: 'rgba(255,255,255,0.12)', borderRadius: 6, padding: '6px 10px' }}>--</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 4, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>{b.l}</div>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {blocks.map((b, i) => (
        <div key={b.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="store-countdown-block" style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-mono)', lineHeight: 1, color: '#fff', minWidth: 44, background: 'rgba(255,255,255,0.12)', borderRadius: 6, padding: '6px 10px' }}>{b.v}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 4, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>{b.l}</div>
          </div>
          {i < blocks.length - 1 && <div className="store-countdown-sep" style={{ fontSize: 22, fontWeight: 900, color: 'rgba(255,255,255,0.5)', marginBottom: 14 }}>:</div>}
        </div>
      ))}
    </div>
  );
}

function CountdownInline({ target }: { target: number }) {
  const { d, h, m, s, ready } = useCountdown(target);
  return (
    <span className="mono tnum" style={{ fontWeight: 700 }}>
      {ready ? `${d > 0 ? `${d}d ` : ''}${pad(h)}:${pad(m)}:${pad(s)}` : '--:--:--'}
    </span>
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
    });
    if (err) { setError('No pudimos registrarte. Intentá de nuevo.'); setLoading(false); return; }
    setDone(true);
    setLoading(false);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(42,28,22,0.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 'min(920px, 100%)', maxHeight: 'calc(100vh - 36px)', overflowY: 'auto', background: '#fffaf5', border: '1px solid rgba(201,100,66,0.18)', borderRadius: 20, boxShadow: '0 34px 100px rgba(26,23,20,0.20)', position: 'relative' }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Cerrar" style={{ position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: 17, border: '1px solid rgba(26,23,20,0.08)', background: 'rgba(255,255,255,0.74)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 3 }}>
          <Icons.close width={18} height={18} />
        </button>
        {done ? (
          <div style={{ textAlign: 'center', padding: '56px 24px 50px' }}>
            <div style={{ width: 58, height: 58, borderRadius: 29, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <Icons.check width={28} height={28} />
            </div>
            <h2 style={{ margin: '0 0 10px', fontWeight: 900, fontSize: 34, color: 'var(--ink)' }}>Ya estás en la lista</h2>
            <p style={{ margin: '0 auto 24px', maxWidth: 420, fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.55 }}>Te avisamos cuando {drop.nombre} esté por abrir.</p>
            <button onClick={onViewDrop} className="btn btn-primary" style={{ height: 46, borderRadius: 10, padding: '0 18px', background: 'var(--accent)', color: '#fff' }}>Ver detalle del drop</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <div style={{ minHeight: 390, position: 'relative', background: 'linear-gradient(145deg, #6a4738 0%, #3f2a22 100%)', overflow: 'hidden' }}>
              {drop.foto_portada_url
                ? <Image src={drop.foto_portada_url} alt={drop.nombre} fill sizes="(max-width: 920px) 100vw, 460px" style={{ objectFit: 'cover' }} />
                : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #181818 0%, #2a211f 100%)' }} />}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(35,22,17,0.08), rgba(35,22,17,0.72))' }} />
              <div style={{ position: 'absolute', left: 22, right: 22, top: 22, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 20, border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.14)', color: '#fff', padding: '6px 12px', fontSize: 10, fontWeight: 900, letterSpacing: '0.08em' }}>
                  <Icons.bell width={13} height={13} />PRÓXIMO DROP
                </span>
                <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: 700 }}>{formatDropDate(drop.inicia_at)}</span>
              </div>
              <div style={{ position: 'absolute', left: 22, right: 22, bottom: 22 }}>
                <div style={{ fontSize: 38, lineHeight: 1, fontWeight: 900, color: '#fff', marginBottom: 14 }}>{drop.nombre}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'end' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.52)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: 5 }}>Abre en</div>
                    <div style={{ color: '#fff', fontSize: 20 }}><CountdownInline target={target} /></div>
                  </div>
                  <button onClick={onViewDrop} style={{ height: 44, borderRadius: 8, border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.12)', color: '#fff', padding: '0 15px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Ver detalle</button>
                </div>
              </div>
            </div>
            <div style={{ padding: '42px 28px 30px', background: 'linear-gradient(180deg, #fffaf5 0%, #f4ece4 100%)' }}>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 900, color: 'var(--accent)', marginBottom: 10 }}>Aviso anticipado · {tienda.nombre}</div>
                <h2 style={{ margin: '0 0 10px', fontSize: 28, lineHeight: 1.05, fontWeight: 900, color: 'var(--ink)' }}>Entrá al drop apenas abra</h2>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>{drop.descripcion || 'Dejá tus datos y te avisamos antes del lanzamiento.'}</p>
                <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-3)', background: 'rgba(201,100,66,0.10)', border: '1px solid rgba(201,100,66,0.14)', borderRadius: 20, padding: '6px 10px', fontSize: 12, fontWeight: 700 }}>
                    <Icons.clock width={13} height={13} />{drop.duracion_minutos} min de drop
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-3)', background: 'rgba(201,100,66,0.10)', border: '1px solid rgba(201,100,66,0.14)', borderRadius: 20, padding: '6px 10px', fontSize: 12, fontWeight: 700 }}>
                    <Icons.mail width={13} height={13} />Aviso por correo
                  </span>
                </div>
              </div>
              <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                  <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} style={{ height: 48, minWidth: 0, borderRadius: 10, border: '1px solid rgba(26,23,20,0.10)', background: 'rgba(255,255,255,0.82)', color: 'var(--ink)', padding: '0 13px', fontSize: 14, outline: 'none' }} />
                  <input placeholder="Apellido" value={apellido} onChange={e => setApellido(e.target.value)} style={{ height: 48, minWidth: 0, borderRadius: 10, border: '1px solid rgba(26,23,20,0.10)', background: 'rgba(255,255,255,0.82)', color: 'var(--ink)', padding: '0 13px', fontSize: 14, outline: 'none' }} />
                </div>
                <input type="email" placeholder="Correo electrónico*" value={email} onChange={e => setEmail(e.target.value)} style={{ height: 48, borderRadius: 10, border: '1px solid rgba(26,23,20,0.10)', background: 'rgba(255,255,255,0.82)', color: 'var(--ink)', padding: '0 13px', fontSize: 14, outline: 'none' }} />
                <input placeholder="WhatsApp opcional" value={telefono} onChange={e => setTelefono(e.target.value)} style={{ height: 48, borderRadius: 10, border: '1px solid rgba(26,23,20,0.10)', background: 'rgba(255,255,255,0.82)', color: 'var(--ink)', padding: '0 13px', fontSize: 14, outline: 'none' }} />
                {error && <div style={{ color: '#b91c1c', background: '#fff1ee', border: '1px solid rgba(185,28,28,0.12)', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>{error}</div>}
                <button className="btn btn-primary btn-block" disabled={loading} style={{ height: 50, borderRadius: 10, fontSize: 15, marginTop: 2, background: 'var(--accent)', color: '#fff' }}>
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

/* ─── Auth modal comprador ──────────────────────────────── */
function BuyerAuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (c: Comprador) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanNombre = nombre.trim();
    const cleanTelefono = telefono.trim();

    if (!cleanEmail || !password) { setError('Completá correo y contraseña.'); return; }
    if (!BUYER_EMAIL_RE.test(cleanEmail)) { setError('Ingresá un correo válido.'); return; }
    if (mode === 'register' && cleanNombre.length < 2) { setError('Ingresá tu nombre completo.'); return; }
    if (mode === 'register' && cleanNombre.length > 120) { setError('El nombre es demasiado largo.'); return; }
    if (mode === 'register' && cleanTelefono && !BUYER_PHONE_RE.test(cleanTelefono)) { setError('Ingresá un WhatsApp válido.'); return; }
    if (mode === 'register' && password.length < 8) { setError('La contraseña necesita mínimo 8 caracteres.'); return; }

    setLoading(true);

    try {
      if (mode === 'login') {
        const result = await iniciarSesionComprador({ email: cleanEmail, password });
        if (result.error || !result.comprador) {
          setError(result.error ?? 'Entraste, pero no pudimos preparar tu perfil. Intentá de nuevo.');
          return;
        }

        onSuccess(result.comprador);
        return;
      }

      const result = await registrarComprador({
        nombre: cleanNombre,
        telefono: cleanTelefono || null,
        email: cleanEmail,
        password,
      });

      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.notice) {
        setNotice(result.notice);
        return;
      }
      if (!result.comprador) {
        setError('La cuenta se creó, pero no pudimos guardar el perfil. Iniciá sesión e intentá completar tus datos.');
        return;
      }

      onSuccess(result.comprador);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,8,8,0.62)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', padding: 18 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 'min(540px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 36px)', overflowY: 'auto', background: '#fff', borderRadius: 18, padding: 0, boxShadow: '0 30px 90px rgba(0,0,0,0.28)', animation: 'slideUp .22s ease', position: 'relative' }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Cerrar" style={{ position: 'absolute', top: 18, right: 18, width: 38, height: 38, borderRadius: 19, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
          <Icons.close width={18} height={18} />
        </button>

        <div style={{ padding: '30px 30px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'linear-gradient(180deg, #fbfbfb 0%, #fff 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingRight: 44 }}>
            <div style={{ width: 54, height: 54, borderRadius: 17, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-3) 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icons.user width={24} height={24} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', color: '#111' }}>{mode === 'login' ? 'Bienvenida de nuevo' : 'Creá tu cuenta'}</div>
              <div style={{ fontSize: 13, color: '#777', lineHeight: 1.45, marginTop: 4 }}>{mode === 'login' ? 'Entrá para ver pedidos y comprar más rápido.' : 'Tu perfil guarda tus datos para el próximo checkout.'}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: 30 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#f3f3f3', borderRadius: 12, padding: 4, marginBottom: 22 }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(''); setNotice(''); }}
                style={{ height: 42, borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer', background: mode === m ? '#fff' : 'transparent', border: mode === m ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent', color: mode === m ? '#111' : '#777', boxShadow: mode === m ? '0 1px 5px rgba(0,0,0,0.06)' : 'none' }}>
                {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
            {mode === 'register' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                <div>
                  <label className="label">Nombre completo</label>
                  <input className="input input-lg" autoComplete="name" placeholder="Karla Morales" value={nombre} onChange={e => { setNombre(e.target.value); setError(''); setNotice(''); }} />
                </div>
                <div>
                  <label className="label">WhatsApp <span style={{ fontWeight: 400, color: '#999' }}>opcional</span></label>
                  <input className="input input-lg" inputMode="tel" autoComplete="tel" placeholder="+504 9876-5432" value={telefono} onChange={e => { setTelefono(e.target.value); setError(''); setNotice(''); }} />
                </div>
              </div>
            )}

            <div>
              <label className="label">Correo electrónico</label>
              <input className="input input-lg" type="email" autoComplete="email" placeholder="karla@gmail.com" value={email} onChange={e => { setEmail(e.target.value); setError(''); setNotice(''); }} />
            </div>

            <div>
              <label className="label">Contraseña{mode === 'register' && <span style={{ fontWeight: 400, color: '#999', marginLeft: 6 }}>mín. 8 caracteres</span>}</label>
              <input className="input input-lg" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="••••••••" value={password} onChange={e => { setPassword(e.target.value); setError(''); setNotice(''); }} />
            </div>

            {mode === 'register' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Seguimiento de pedidos', Icons.bag],
                  ['Checkout más rápido', Icons.sparkle],
                ].map(([label, Icon]) => {
                  const Ic = Icon as typeof Icons.bag;
                  return (
                    <div key={label as string} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 11, padding: '10px 11px', display: 'flex', alignItems: 'center', gap: 8, color: '#555', fontSize: 12, fontWeight: 800 }}>
                      <Ic width={14} height={14} />
                      {label as string}
                    </div>
                  );
                })}
              </div>
            )}

            {error && <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 2, padding: '10px 12px', background: '#fef2f2', borderRadius: 10 }}>{error}</div>}
            {notice && <div style={{ fontSize: 13, color: '#047857', marginTop: 2, padding: '10px 12px', background: '#ecfdf5', borderRadius: 10, lineHeight: 1.45 }}>{notice}</div>}

            <button className="btn btn-primary btn-block" style={{ height: 52, fontSize: 15, marginTop: 4, borderRadius: 14, fontWeight: 900 }} disabled={loading}>
              {loading ? 'Procesando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        </div>
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
  const [loadingPedidos, setLoadingPedidos] = useState(true);
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
      setLoadingPedidos(false);
    })();
    return () => { active = false; };
  }, [comprador.email, onLogout]);

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,8,8,0.62)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', padding: 18 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 'min(720px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 36px)', overflow: 'hidden', background: '#fff', borderRadius: 18, boxShadow: '0 30px 90px rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.7)', animation: 'slideUp .22s ease' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'linear-gradient(180deg, #fbfbfb 0%, #fff 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 15, minWidth: 0 }}>
              <div style={{ width: 58, height: 58, borderRadius: 18, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-3) 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, flexShrink: 0 }}>
                {initial}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#999', marginBottom: 5 }}>Cuenta de compradora</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#111', letterSpacing: '-0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{comprador.nombre}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#777', fontSize: 13, marginTop: 4, minWidth: 0 }}>
                  <Icons.mail width={13} height={13} style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{comprador.email}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} aria-label="Cerrar" style={{ width: 36, height: 36, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: '#555', cursor: 'pointer', flexShrink: 0 }}>
              <Icons.close width={17} height={17} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 18 }}>
            <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '12px 13px', background: '#fff' }}>
              <div style={{ fontSize: 11, color: '#999', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pedidos</div>
              <div className="mono tnum" style={{ fontSize: 22, fontWeight: 900, color: '#111', marginTop: 5 }}>{loadingPedidos ? '--' : pedidos.length}</div>
            </div>
            <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '12px 13px', background: '#fff' }}>
              <div style={{ fontSize: 11, color: '#999', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Compras</div>
              <div className="mono tnum" style={{ fontSize: 22, fontWeight: 900, color: '#111', marginTop: 5 }}>L {loadingPedidos ? '--' : totalGastado.toLocaleString()}</div>
            </div>
            <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '12px 13px', background: '#fff' }}>
              <div style={{ fontSize: 11, color: '#999', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Perfil</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: datosGuardados >= 3 ? '#065f46' : '#92400e', marginTop: 9 }}>
                {datosGuardados >= 3 ? 'Completo' : 'Por completar'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 24px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#f3f3f3', borderRadius: 12, padding: 4 }}>
            {[
              { id: 'orders' as const, label: 'Pedidos', icon: Icons.bag },
              { id: 'profile' as const, label: 'Perfil', icon: Icons.settings },
            ].map(tab => {
              const Ic = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{ height: 40, borderRadius: 9, border: selected ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent', background: selected ? '#fff' : 'transparent', boxShadow: selected ? '0 1px 5px rgba(0,0,0,0.06)' : 'none', color: selected ? '#111' : '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                  <Ic width={15} height={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: 24, maxHeight: 'calc(100vh - 360px)', minHeight: 280, overflowY: 'auto' }}>
          {activeTab === 'orders' && (
            <div>
              {direccionCompleta && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#f7f7f7', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <Icons.pin width={16} height={16} style={{ color: '#777', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#333' }}>Dirección guardada</div>
                    <div style={{ fontSize: 12, color: '#777', lineHeight: 1.45, marginTop: 2 }}>{direccionCompleta}</div>
                  </div>
                </div>
              )}
              {loadingPedidos ? (
                <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: 18, fontSize: 13, color: '#888', background: '#fff' }}>Cargando pedidos...</div>
              ) : pedidos.length === 0 ? (
                <div style={{ border: '1px dashed rgba(0,0,0,0.16)', borderRadius: 16, padding: '34px 22px', textAlign: 'center', background: '#fff' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#555' }}>
                    <Icons.bag width={22} height={22} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>Aún no tenés pedidos con esta cuenta</div>
                  <div style={{ fontSize: 13, color: '#777', lineHeight: 1.5, maxWidth: 380, margin: '0 auto 16px' }}>Cuando compres usando {comprador.email}, tu seguimiento aparecerá aquí.</div>
                  <button onClick={onClose} className="btn btn-primary" style={{ height: 40, borderRadius: 10, padding: '0 15px' }}>Seguir comprando</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {pedidos.map(pedido => {
                    const estado = PEDIDO_LABELS[pedido.estado ?? 'apartado'] ?? PEDIDO_LABELS.apartado;
                    const item = pedido.items?.[0];
                    const prenda = item?.prenda;
                    return (
                      <button key={pedido.id} onClick={() => { onClose(); router.push(`/pedido/${pedido.numero}`); }}
                        style={{ width: '100%', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, background: '#fff', padding: 12, display: 'grid', gridTemplateColumns: '58px 1fr auto', gap: 12, textAlign: 'left', cursor: 'pointer', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                        <div style={{ width: 58, height: 66, borderRadius: 10, overflow: 'hidden', background: '#f1f1f1', position: 'relative' }}>
                          {prenda?.fotos?.[0]
                            ? <Image src={prenda.fotos[0]} alt="" fill sizes="58px" style={{ objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #eeeeee, #dddddd)' }} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span className="mono tnum" style={{ fontSize: 12, fontWeight: 900, color: '#111' }}>{pedido.numero}</span>
                            <span style={{ fontSize: 10, fontWeight: 900, color: estado.tone, background: estado.bg, borderRadius: 20, padding: '3px 8px', whiteSpace: 'nowrap' }}>{estado.label}</span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prenda?.nombre ?? pedido.drop?.nombre ?? 'Pedido'}</div>
                          <div style={{ fontSize: 12, color: '#999', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[pedido.drop?.nombre, (item?.talla_seleccionada ?? prenda?.talla) && `T. ${item?.talla_seleccionada ?? prenda?.talla}`, formatShortDate(pedido.created_at)].filter(Boolean).join(' · ')}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="mono tnum" style={{ fontSize: 14, fontWeight: 900, color: '#111' }}>L {pedido.monto_total.toLocaleString()}</div>
                          <Icons.arrow width={15} height={15} style={{ color: '#aaa', marginTop: 8 }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} style={{ display: 'grid', gap: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#111', marginBottom: 3 }}>Datos de compra</div>
                <div style={{ fontSize: 12, color: '#777', lineHeight: 1.45 }}>Guardamos estos datos para rellenar tus próximos checkouts.</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                <div>
                  <label className="label">Nombre completo</label>
                  <input className="input input-lg" value={profileForm.nombre} onChange={e => { setProfileForm(f => ({ ...f, nombre: e.target.value })); setProfileError(''); setProfileMsg(''); }} placeholder="Karla Morales" />
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input className="input input-lg" value={profileForm.telefono} onChange={e => { setProfileForm(f => ({ ...f, telefono: e.target.value })); setProfileError(''); setProfileMsg(''); }} placeholder="+504 9876-5432" />
                </div>
              </div>

              <div>
                <label className="label">Correo de acceso</label>
                <div style={{ position: 'relative' }}>
                  <input className="input input-lg" value={comprador.email} readOnly style={{ background: '#f6f6f6', color: '#777', paddingLeft: 42 }} />
                  <Icons.mail width={16} height={16} style={{ position: 'absolute', left: 15, top: 17, color: '#999' }} />
                </div>
              </div>

              <div>
                <label className="label">Dirección</label>
                <input className="input input-lg" value={profileForm.direccion} onChange={e => { setProfileForm(f => ({ ...f, direccion: e.target.value })); setProfileError(''); setProfileMsg(''); }} placeholder="Colonia, calle, casa o referencia" />
              </div>

              <div>
                <label className="label">Ciudad</label>
                <input className="input input-lg" value={profileForm.ciudad} onChange={e => { setProfileForm(f => ({ ...f, ciudad: e.target.value })); setProfileError(''); setProfileMsg(''); }} placeholder="San Pedro Sula" />
              </div>

              {profileError && <div style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', borderRadius: 10, padding: '10px 12px' }}>{profileError}</div>}
              {profileMsg && <div style={{ fontSize: 13, color: '#047857', background: '#ecfdf5', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 7 }}><Icons.check width={15} height={15} />{profileMsg}</div>}

              <button className="btn btn-primary btn-block" disabled={savingProfile || !profileForm.nombre.trim()} style={{ height: 48, borderRadius: 12, fontSize: 14, fontWeight: 800 }}>
                {savingProfile ? 'Guardando...' : 'Guardar perfil'}
              </button>
            </form>
          )}
        </div>

        <div style={{ padding: '14px 24px 22px', borderTop: '1px solid rgba(0,0,0,0.07)', background: '#fafafa', display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
          <button onClick={onLogout} style={{ height: 38, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: '#111', padding: '0 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
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
  const router = useRouter();
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [subscribeDrop, setSubscribeDrop] = useState<Drop | null>(null);
  const [comprador, setComprador] = useState<Comprador | null>(null);
  const [showBag] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [categoryMenuRect, setCategoryMenuRect] = useState<{ left: number; top: number } | null>(null);
  const { count: carritoCount, abrirDrawer } = useCarrito();
  const [viewerCounts, setViewerCounts] = useState<Record<string, number | null>>({});
  const [nowMs, setNowMs] = useState<number | null>(null);

  // Realtime: observar viewers de cada drop sin depender de una columna persistida.
  useEffect(() => {
    if (drops.length === 0) return;

    const supabase = createClient();
    const channels = drops.map(drop => {
      const channel = supabase.channel(`viewers-${drop.id}`, {
        config: {
          presence: {
            key: `observer-store-${drop.id}-${Math.random().toString(36).slice(2)}`,
          },
        },
      });

      const syncCount = () => {
        const state = channel.presenceState();
        const total = Object.values(state).reduce((sum, entries) => (
          Array.isArray(entries) ? sum + entries.length : sum
        ), 0);

        setViewerCounts(prev => (
          prev[drop.id] === total
            ? prev
            : { ...prev, [drop.id]: total }
        ));
      };

      channel
        .on('presence', { event: 'sync' }, syncCount)
        .subscribe(status => {
          if (status === 'SUBSCRIBED') syncCount();
        });

      return channel;
    });

    return () => {
      channels.forEach(channel => {
        void supabase.removeChannel(channel);
      });
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
  const prendasFiltradas = catFilter && catFilter !== 'Todo'
    ? prendasDisponibles.filter(p => (p.categoria ?? '').trim().toLowerCase() === catFilter.trim().toLowerCase())
    : prendasDisponibles;
  const estaDisponible = (e: Prenda['estado']) => !e || e === 'disponible' || e === 'remanente';
  const totalUnidades = prendasDisponibles.reduce((s, p) => s + getProductTotalQuantity(p), 0);
  const unidadesFiltradas = prendasFiltradas.reduce((s, p) => s + getProductTotalQuantity(p), 0);
  const { agregarItem, tieneItem, abrirDrawer: abrirCarrito } = useCarrito();
  const showNoDropBanner = hasClock && liveDrops.length === 0 && scheduledDrops.length === 0;
  const scrollToCatalog = () => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const selectCategory = (category: string | null) => {
    setCatFilter(category);
    setShowCategoryMenu(false);
    setCategoryMenuRect(null);
  };
  const toggleCategoryMenu = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setCategoryMenuRect({ left: Math.min(rect.left, window.innerWidth - 280), top: rect.bottom + 8 });
    setShowCategoryMenu(open => !open);
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
      try { window.localStorage.setItem(`fardodrops:drop-popup-seen:${tienda.id}:${subscribeDrop.id}`, '1'); } catch {}
    }
    setSubscribeDrop(null);
  }

  const initials = tienda.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{
      minHeight: '100vh',
      background:
        'radial-gradient(circle at top center, rgba(201,100,66,0.08) 0%, transparent 28%), linear-gradient(180deg, #fffdfa 0%, #faf7f1 48%, #f3eee7 100%)',
      fontFamily: 'var(--font-sans)',
    }}>
      {isOwnerPreview && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 999,
          background: 'linear-gradient(135deg, #4a332a 0%, #2f211a 100%)', color: '#fff7f2',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', gap: 12, fontSize: 13,
        }}>
          <span style={{ opacity: 0.7 }}>Vista previa de tu tienda — los clientes no ven este aviso</span>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ background: '#fff7f2', color: 'var(--accent-3)', border: 'none', borderRadius: 10, padding: '6px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
          >
            ← Volver al dashboard
          </button>
        </div>
      )}

      {/* ── HEADER ── */}
      <header style={{ background: 'rgba(255,253,250,0.82)', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(18px)' }}>
        <div className="store-header-inner">
          {/* Avatar + info tienda */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {tienda.logo_url
                ? <Image src={tienda.logo_url} alt={tienda.nombre} width={44} height={44} style={{ borderRadius: 22, objectFit: 'cover', border: '2px solid #eee' }} />
                : <div style={{ width: 44, height: 44, borderRadius: 22, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-3) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', border: '2px solid rgba(255,255,255,0.9)' }}>{initials}</div>}
              {liveDrops.length > 0 && (
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, background: '#C96442', border: '2px solid #fff', animation: 'pulse 1.4s ease-in-out infinite' }} />
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tienda.nombre}</div>
            <div className="store-header-meta">
            {tienda.ubicacion && (
                <span style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Icons.pin width={11} height={11}/>{tienda.ubicacion}
              </span>
            )}
            {tienda.instagram && (
                <a
                    href={`https://instagram.com/${tienda.instagram.replace('@','')}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                    <Icons.ig width={11} height={11}/>{tienda.instagram}
                  </a>
                )}
            {tiendaEmail && (
                <a
                  href={`mailto:${tiendaEmail}`}
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                  <Icons.mail width={11} height={11}/>{tiendaEmail}
                </a>
              )}
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: tienda.nombre, url: window.location.href }).catch(() => {});
                } else {
                  navigator.clipboard?.writeText(window.location.href);
                }
              }}
              className="store-header-share"
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', borderRadius: 20, border: '1px solid var(--line)', background: 'rgba(255,255,255,0.78)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Icons.arrow width={14} height={14} style={{ transform: 'rotate(-45deg)' }} />
              Compartir
            </button>
            {!isOwnerPreview && (
              <button
                onClick={() => setShowAuth(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', borderRadius: 20, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', boxShadow: '0 10px 24px rgba(201,100,66,0.22)' }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <path d="M3 16a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                {comprador ? comprador.nombre.split(' ')[0] : 'Mi cuenta'}
              </button>
            )}
            <button
              onClick={abrirDrawer}
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 20, background: carritoCount > 0 ? 'var(--accent-3)' : '#fff', color: carritoCount > 0 ? '#fff' : 'var(--accent-3)', border: '1px solid var(--line)', cursor: 'pointer' }}
              title="Ver carrito"
            >
              <Icons.bag width={16} height={16} />
              {carritoCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 18, height: 18, borderRadius: 9,
                  background: '#C96442', color: '#fff',
                  fontSize: 10, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #fff',
                }}>
                  {carritoCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── BANNER DROP EN VIVO (1 solo) o CARRUSEL DROPS PROGRAMADOS ── */}
      {liveDrop && (
        <div
          style={{
            position: 'relative', overflow: 'hidden', cursor: 'pointer',
            background: 'linear-gradient(135deg, #5b3d31 0%, #3c2720 55%, #2a1c16 100%)',
          }}
          onClick={() => router.push(`/${tienda.username}/drop/${liveDrop.id}`)}
        >
          {liveDrop.foto_portada_url && (
            <div style={{ position: 'absolute', inset: 0 }}>
              <Image
                src={liveDrop.foto_portada_url}
                alt={liveDrop.nombre}
                fill
                sizes="100vw"
                style={{ objectFit: 'cover', opacity: 0.18 }}
              />
            </div>
          )}
          <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#C96442', borderRadius: 20, padding: '4px 10px', fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    <span style={{ width: 5, height: 5, borderRadius: 3, background: '#fff', display: 'inline-block', animation: 'pulse 1.4s ease-in-out infinite' }} />
                    EN VIVO
                  </span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.1, marginBottom: 12 }}>
                  {liveDrop.nombre}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', padding: '5px 12px', fontSize: 12, fontWeight: 600 }}>
                    <Icons.box width={12} height={12} />
                    {liveDropAvailableUnits} disponibles
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', padding: '5px 12px', fontSize: 12, fontWeight: 600 }}>
                    <Icons.eye width={12} height={12} />
                    {liveDrop.viewers_count ?? 0} viendo
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.46)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>Cierra en</div>
                  <CountdownBlocks target={liveDropTarget} />
                </div>
                <button
                  onClick={e => { e.stopPropagation(); router.push(`/${tienda.username}/drop/${liveDrop.id}`); }}
                  style={{ height: 48, borderRadius: 10, background: '#fff', color: '#111', border: 'none', padding: '0 24px', fontSize: 14, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Ver drop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECCIÓN DROPS EN VIVO (2+) ── */}
      {liveDrops.length > 1 && (
        <div style={{ background: 'linear-gradient(135deg, #5b3d31 0%, #3c2720 55%, #2a1c16 100%)', padding: '16px 20px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: '#C96442', display: 'inline-block', animation: 'pulse 1.4s ease-in-out infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#C96442', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>DROPS EN VIVO</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {liveDrops.map(d => {
                const target = new Date(d.cierra_at ?? d.inicia_at).getTime();
                return (
                  <div key={d.id}
                    onClick={() => router.push(`/${tienda.username}/drop/${d.id}`)}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nombre}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span>Cierra en <CountdownInline target={target} /></span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icons.eye width={12} height={12} />
                          {d.viewers_count ?? 0} viendo
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/${tienda.username}/drop/${d.id}`); }}
                      style={{ height: 34, borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', padding: '0 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
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
        <div style={{ background: 'linear-gradient(135deg, #5b3d31 0%, #3c2720 55%, #2a1c16 100%)', padding: '14px 20px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              {/* Flechas solo si hay más de 1 drop */}
              {scheduledDrops.length > 1 && (
                <button onClick={prevSlide}
                  style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <Icons.back width={14} height={14} />
                </button>
              )}
              <div style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icons.bell width={16} height={16} style={{ color: '#fff' }} />
              </div>
              <div onClick={() => router.push(`/${tienda.username}/drop/${sliderDrop!.id}`)} style={{ cursor: 'pointer', minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 4 }}>PRÓXIMO DROP</span>
                  {scheduledDrops.length > 1 && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>{safeSliderIdx + 1}/{scheduledDrops.length}</span>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {sliderDrop!.nombre}
                </div>
                {(() => {
                  const n = sliderDrop!.prendas?.[0]?.count ?? 0;
                  if (n === 0) return null;
                  return <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{n} {n === 1 ? 'prenda' : 'prendas'}</div>;
                })()}
              </div>
              {scheduledDrops.length > 1 && (
                <button onClick={nextSlide}
                  style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <Icons.arrow width={14} height={14} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
              <CountdownBlocks target={sliderTarget} />
              <button
                onClick={() => setSubscribeDrop(sliderDrop)}
                style={{ height: 40, borderRadius: 8, background: '#fff', color: '#111', border: 'none', padding: '0 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Notificarme
              </button>
            </div>
          </div>
          {/* Dots indicadores */}
          {scheduledDrops.length > 1 && (
            <div style={{ maxWidth: 1100, margin: '10px auto 0', display: 'flex', gap: 5, justifyContent: 'center' }}>
              {scheduledDrops.map((_, i) => (
                <button key={i} onClick={() => setSliderIdx(i)}
                  style={{ width: i === safeSliderIdx ? 18 : 6, height: 6, borderRadius: 3, background: i === safeSliderIdx ? '#fff' : 'rgba(255,255,255,0.25)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all .2s' }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ESTADO SIN DROP ACTIVO O PROGRAMADO ── */}
      {showNoDropBanner && (
        <div style={{ background: 'linear-gradient(135deg, #5b3d31 0%, #3c2720 55%, #2a1c16 100%)', padding: '16px 20px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <div style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icons.box width={16} height={16} />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 4 }}>SIN DROP PROGRAMADO</span>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginTop: 5 }}>
                  {totalUnidades > 0 ? 'Por ahora comprá desde el catálogo' : 'Nuevos drops próximamente'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2, lineHeight: 1.45 }}>
                  {totalUnidades > 0
                    ? 'Cuando la tienda programe otro drop, aparecerá aquí con su contador.'
                    : 'La tienda todavía no tiene piezas disponibles ni un lanzamiento agendado.'}
                </div>
              </div>
            </div>
            {totalUnidades > 0 ? (
              <button
                onClick={scrollToCatalog}
                style={{ height: 40, borderRadius: 8, background: '#fff', color: '#111', border: 'none', padding: '0 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Ver catálogo
              </button>
            ) : tienda.instagram ? (
              <a
                href={`https://instagram.com/${tienda.instagram.replace('@','')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ height: 40, borderRadius: 8, background: '#fff', color: '#111', textDecoration: 'none', padding: '0 20px', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
                <Icons.ig width={14} height={14} />
                Seguir tienda
              </a>
            ) : null}
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div id="catalogo" className="store-catalog">

        {/* Filtros de categoría */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap', maxWidth: '100%', overflowX: 'auto', paddingBottom: 2 }}>
            <button
              onClick={() => selectCategory(null)}
              style={{
                height: 34, padding: '0 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                background: !catFilter ? 'var(--accent)' : '#fff',
                color: !catFilter ? '#fff' : '#4A4540',
                border: !catFilter ? 'none' : '1px solid #E8E4DF',
                whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'all .15s',
              }}>
              Todo
            </button>
            {visibleCategoryNames.map(cat => {
              const active = catFilter === cat;
              return (
              <button key={cat}
                onClick={() => selectCategory(active ? null : cat)}
                style={{
                  height: 34, padding: '0 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  background: active ? 'var(--accent)' : '#fff',
                  color: active ? '#fff' : '#4A4540',
                  border: active ? 'none' : '1px solid #E8E4DF',
                  display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'all .15s',
                }}>
                {cat}
              </button>
              );
            })}
            {hasMoreCategories && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={e => toggleCategoryMenu(e.currentTarget)}
                  style={{
                    height: 34, padding: '0 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    background: '#fff', color: '#4A4540', border: '1px solid #E8E4DF',
                    display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
                  }}>
                  <Icons.grid width={13} height={13} />
                  Más +{overflowCategoryNames.length}
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888', fontSize: 13 }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M2 5h16M5 10h10M8 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            {unidadesFiltradas} {unidadesFiltradas === 1 ? 'pieza disponible' : 'piezas disponibles'}
          </div>
        </div>
        {showCategoryMenu && categoryMenuRect && (
          <>
            <button
              aria-label="Cerrar categorías"
              onClick={() => { setShowCategoryMenu(false); setCategoryMenuRect(null); }}
              style={{ position: 'fixed', inset: 0, zIndex: 70, border: 'none', background: 'transparent', cursor: 'default' }}
            />
            <div style={{ position: 'fixed', top: categoryMenuRect.top, left: categoryMenuRect.left, zIndex: 80, width: 260, maxHeight: 320, overflowY: 'auto', background: '#fffdf9', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 18px 45px rgba(26,23,20,0.12)', padding: 6 }}>
              {overflowCategoryNames.map(category => (
                <button
                  key={category}
                  onClick={() => selectCategory(category)}
                  style={{ width: '100%', minHeight: 38, borderRadius: 8, border: 'none', background: catFilter === category ? 'var(--accent)' : 'transparent', color: catFilter === category ? '#fff' : '#222', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => { e.currentTarget.style.background = catFilter === category ? 'var(--accent)' : '#f7efe7'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = catFilter === category ? 'var(--accent)' : 'transparent'; }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{category}</span>
                  <span className="mono tnum" style={{ fontSize: 11, color: catFilter === category ? 'rgba(255,255,255,0.72)' : '#999', flexShrink: 0 }}>{productCategoryCounts[category]}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Grid de productos */}
        {prendasFiltradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#999' }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                  color: 'var(--ink-3)',
                }}>
                  <Icons.grid width={19} height={19} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#444', marginBottom: 6 }}>{catFilter ? `Sin prendas en ${catFilter}` : 'Sin prendas disponibles'}</div>
                <div style={{ fontSize: 13 }}>El inventario de esta tienda aparecerá aquí.</div>
              </div>
            ) : (
              <>
                <div className="store-product-grid">
                  {prendasFiltradas.map((p, i) => {
                const disponible = estaDisponible(p.estado);
                const vistas = p.drop_id ? (dropsWithLiveState.find(d => d.id === p.drop_id)?.viewers_count ?? 0) : null;
                const tallaLabel = formatProductSizes(p);
                const tallaCarrito = getPrimaryProductSize(p);
                const tieneVariantes = getProductSizes(p).length > 1;
                const enCarrito = tallaCarrito ? tieneItem(p.id, tallaCarrito) : tieneItem(p.id);
                const unidadesProducto = getProductTotalQuantity(p);

                return (
                  <div key={p.id}
                    style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', border: '1px solid #E8E4DF', transition: 'transform .18s, box-shadow .18s', position: 'relative' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>

                    {/* Imagen */}
                    <div style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden', background: '#F2F0EC' }}
                      onClick={() => router.push(`/${tienda.username}/prenda/${p.id}`)}>
                      {p.fotos?.[0]
                        ? <Image src={p.fotos[0]} alt={p.nombre} fill sizes="(max-width: 640px) 50vw, 220px" style={{ objectFit: 'cover', display: 'block', filter: !disponible ? 'brightness(0.72)' : 'none' }} />
                        : <Ph tone={(['rose', 'sand', 'sage'] as const)[i % 3]} aspect="3/4" radius={0} />}

                      {/* Badges NUEVO / HOT */}
                      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {i % 5 === 0 && (
                          <span style={{ background: 'var(--dark)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, letterSpacing: '0.04em' }}>NUEVO</span>
                        )}
                        {vistas !== null && vistas > 600 && (
                          <span style={{ background: 'rgba(201,100,66,0.12)', color: '#C96442', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(201,100,66,0.3)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Icons.sparkle width={11} height={11} />
                            HOT
                          </span>
                        )}
                      </div>

                      {/* Overlay vendida/apartada */}
                      {!disponible && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ background: 'rgba(42,28,22,0.82)', color: '#fff', padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                            {p.estado === 'vendida' ? 'Vendida' : 'Apartada'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: '10px 12px 12px' }} onClick={() => router.push(`/${tienda.username}/prenda/${p.id}`)}>
                      {p.marca && <div style={{ fontSize: 10, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{p.marca}</div>}
                      <div style={{ fontSize: 13, fontWeight: 600, color: disponible ? '#111' : '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 5 }}>{p.nombre}</div>

                      {/* Precio */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                        <span className="mono tnum" style={{ fontSize: 15, fontWeight: 800, color: disponible ? '#111' : '#bbb' }}>
                          L {p.precio.toLocaleString()}
                        </span>
                      </div>

                      {/* Talla + vistas */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: '#888', background: '#f5f5f5', borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap', maxWidth: '72%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {[tallaLabel, `${unidadesProducto} disp.`].filter(Boolean).join(' · ')}
                        </span>
                        {vistas !== null && vistas > 0 && (
                          <span style={{ fontSize: 11, color: '#bbb', display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                            <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" stroke="currentColor" strokeWidth="1.5"/><circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/></svg>
                            {vistas}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botones comprar / carrito */}
                    {disponible && (
                      <div style={{ padding: '0 12px 12px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                        <button
                          onClick={() => router.push(`/${tienda.username}/prenda/${p.id}`)}
                          style={{ height: 38, borderRadius: 8, background: '#C96442', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'background .15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#b05538'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#C96442'; }}>
                          Comprar
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (tieneVariantes) {
                              router.push(`/${tienda.username}/prenda/${p.id}`);
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
                          style={{
                            width: 38, height: 38, borderRadius: 8, border: '1.5px solid #E8E4DF',
                            background: !tieneVariantes && enCarrito ? 'var(--accent-3)' : '#fff',
                            color: !tieneVariantes && enCarrito ? '#fff' : 'var(--accent-3)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all .15s', flexShrink: 0,
                          }}
                          title={tieneVariantes ? 'Elegir talla' : enCarrito ? 'Ver carrito' : 'Añadir al carrito'}
                        >
                          <Icons.bag width={15} height={15} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
                </div>

                {/* Ver más */}
                {prendasFiltradas.length >= 6 && (
                  <div style={{ textAlign: 'center', marginTop: 32 }}>
                    <button style={{ height: 44, padding: '0 32px', borderRadius: 22, border: '1px solid #E8E4DF', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, color: '#4A4540' }}>
                      Ver más productos
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M3 10l7 7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                )}
              </>
            )}
        {/* ── BENEFICIOS ── */}
        <div style={{ margin: '48px 0 0', background: '#fff', borderRadius: 16, border: '1px solid #E8E4DF', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {[
            {
              svg: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 8h14l-1.5 9H6.5L5 8z"/>
                  <path d="M5 8l-.75-3H2"/>
                  <circle cx="9" cy="20" r="1"/>
                  <circle cx="15" cy="20" r="1"/>
                </svg>
              ),
              title: 'Envío Rápido',
              desc: 'Recibe tu compra en cualquier parte de Honduras',
            },
            {
              svg: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                </svg>
              ),
              title: 'Calidad Garantizada',
              desc: 'Todas las prendas en excelente estado',
            },
            {
              svg: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21C12 21 3 15.5 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12z"/>
                </svg>
              ),
              title: '100% Auténtico',
              desc: 'Piezas originales verificadas',
            },
          ].map((b, i, arr) => (
            <div key={i} style={{
              textAlign: 'center',
              padding: '28px 24px',
              borderRight: i < arr.length - 1 ? '1px solid #E8E4DF' : 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F2F0EC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1A1714' }}>
                {b.svg}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{b.title}</div>
              <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6, maxWidth: 180 }}>{b.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background: 'linear-gradient(180deg, #fffaf5 0%, #f4ede6 100%)', color: 'var(--ink)', padding: '32px 20px 24px', borderTop: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--line)' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{tienda.nombre}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 280, lineHeight: 1.55 }}>
                {tienda.bio || 'Tu tienda de moda sostenible'}
              </div>
              {tienda.instagram && (
                <a href={`https://instagram.com/${tienda.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none' }}>
                  <Icons.ig width={14} height={14} />
                  {tienda.instagram}
                </a>
              )}
              {tiendaEmail && (
                <a href={`mailto:${tiendaEmail}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, marginLeft: tienda.instagram ? 14 : 0, fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none' }}>
                  <Icons.mail width={14} height={14} />
                  {tiendaEmail}
                </a>
              )}
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>© {new Date().getFullYear()} - {tienda.nombre} · Tecnología de Droppi</div>
            {(tienda.instagram || tienda.facebook || tienda.tiktok) && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Seguínos en nuestras redes</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {tienda.instagram && (
                    <a href={`https://instagram.com/${tienda.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer"
                      title="Instagram"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 17, border: '1px solid var(--line)', color: 'var(--ink-2)', textDecoration: 'none', background: 'rgba(255,255,255,0.72)' }}>
                      <Icons.ig width={16} height={16} />
                    </a>
                  )}
                  {tienda.facebook && (
                    <a href={tienda.facebook.startsWith('http') ? tienda.facebook : `https://facebook.com/${tienda.facebook}`} target="_blank" rel="noopener noreferrer"
                      title="Facebook"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 17, border: '1px solid var(--line)', color: 'var(--ink-2)', textDecoration: 'none', background: 'rgba(255,255,255,0.72)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                    </a>
                  )}
                  {tienda.tiktok && (
                    <a href={tienda.tiktok.startsWith('http') ? tienda.tiktok : `https://tiktok.com/@${tienda.tiktok.replace('@','')}`} target="_blank" rel="noopener noreferrer"
                      title="TikTok"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 17, border: '1px solid var(--line)', color: 'var(--ink-2)', textDecoration: 'none', background: 'rgba(255,255,255,0.72)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg>
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
      {showBag && <div style={{ display: 'none' }} />}
    </div>
  );
}
