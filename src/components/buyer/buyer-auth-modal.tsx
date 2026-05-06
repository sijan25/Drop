'use client';

import { useState, type FormEvent } from 'react';
import { Icons } from '@/components/shared/icons';
import { PhoneInput } from '@/components/shared/phone-input';
import { iniciarSesionComprador, registrarComprador, solicitarResetPasswordComprador } from '@/lib/buyer/actions';

export type BuyerProfile = {
  nombre: string;
  email: string;
  telefono?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
};

const BUYER_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BUYER_PHONE_RE = /^[+\d][\d\s().-]{6,39}$/;

export function BuyerAuthModal({
  onClose,
  onSuccess,
  initialMode = 'login',
}: {
  onClose: () => void;
  onSuccess: (buyer: BuyerProfile) => void;
  initialMode?: 'login' | 'register';
}) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
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

    if (mode === 'forgot') {
      if (!cleanEmail || !BUYER_EMAIL_RE.test(cleanEmail)) { setError('Ingresá un correo válido.'); return; }
      setLoading(true);
      try {
        const result = await solicitarResetPasswordComprador({ email: cleanEmail });
        if (result.error) { setError(result.error); return; }
        setNotice('Te enviamos un correo para restablecer tu contraseña. Revisá tu bandeja de entrada.');
      } finally {
        setLoading(false);
      }
      return;
    }

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

      if (result.error) { setError(result.error); return; }
      if (result.notice) { setNotice(result.notice); return; }
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
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,8,8,0.62)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', padding: 18 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(540px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 36px)', overflowY: 'auto', background: '#fff', borderRadius: 18, padding: 0, boxShadow: '0 30px 90px rgba(0,0,0,0.28)', animation: 'slideUp .22s ease', position: 'relative' }}
      >
        {/* Header */}
        <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'linear-gradient(180deg,#fbfbfb 0%,#fff 100%)' }}>
          {/* Fila: ícono + botón cerrar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icons.user width={20} height={20} />
            </div>
            {/* Botón cerrar inline (quitamos el absolute) */}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              style={{ width: 36, height: 36, borderRadius: 18, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <Icons.close width={16} height={16} />
            </button>
          </div>
          {/* Título y subtítulo sin competir con el botón cerrar */}
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', color: '#111', lineHeight: 1.2 }}>
            {mode === 'forgot' ? 'Olvidé mi contraseña' : mode === 'login' ? 'Bienvenido de nuevo' : 'Creá tu cuenta'}
          </div>
          <div style={{ fontSize: 13, color: '#777', lineHeight: 1.5, marginTop: 6 }}>
            {mode === 'forgot'
              ? 'Te enviamos un link para crear una nueva contraseña.'
              : mode === 'login'
                ? 'Entrá para ver pedidos y comprar más rápido.'
                : 'Tu perfil guarda tus datos para el próximo checkout.'}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 30 }}>

          {/* Toggle login / register */}
          {mode !== 'forgot' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#f3f3f3', borderRadius: 12, padding: 4, marginBottom: 22 }}>
              {(['login', 'register'] as const).map(m => (
                <button
                  key={m} type="button"
                  onClick={() => { setMode(m); setError(''); setNotice(''); }}
                  style={{ height: 42, borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer', background: mode === m ? '#fff' : 'transparent', border: mode === m ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent', color: mode === m ? '#111' : '#777', boxShadow: mode === m ? '0 1px 5px rgba(0,0,0,0.06)' : 'none' }}
                >
                  {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>

            {/* Campos solo en registro */}
            {mode === 'register' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                <div>
                  <label className="label">Nombre completo</label>
                  <input className="input input-lg" autoComplete="name" placeholder="Karla Morales" value={nombre}
                    onChange={e => { setNombre(e.target.value); setError(''); setNotice(''); }} />
                </div>
                <div>
                  <label className="label">WhatsApp <span style={{ fontWeight: 400, color: '#999' }}>opcional</span></label>
                  <PhoneInput size="lg" value={telefono} onChange={v => { setTelefono(v); setError(''); setNotice(''); }} />
                </div>
              </div>
            )}

            {/* Correo */}
            <div>
              <label className="label">Correo electrónico</label>
              <input className="input input-lg" type="email" autoComplete="email" placeholder="karla@gmail.com" value={email}
                onChange={e => { setEmail(e.target.value); setError(''); setNotice(''); }} />
            </div>

            {/* Contraseña */}
            {mode !== 'forgot' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0, flexShrink: 1 }}>
                    Contraseña
                    {mode === 'register' && <span style={{ fontWeight: 400, color: '#999' }}>mín. 8 caracteres</span>}
                  </span>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); setNotice(''); }}
                      style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0, textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <input
                  className="input input-lg"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); setNotice(''); }}
                />
              </div>
            )}

            {/* Perks registro */}
            {mode === 'register' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {([['Seguimiento de pedidos', Icons.bag], ['Checkout más rápido', Icons.sparkle]] as const).map(([label, Icon]) => {
                  const Ic = Icon as typeof Icons.bag;
                  return (
                    <div key={label} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 11, padding: '10px 11px', display: 'flex', alignItems: 'center', gap: 8, color: '#555', fontSize: 12, fontWeight: 800 }}>
                      <Ic width={14} height={14} />{label}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Errores y avisos */}
            {error && <div style={{ fontSize: 13, color: '#b91c1c', padding: '10px 12px', background: '#fef2f2', borderRadius: 10 }}>{error}</div>}
            {notice && <div style={{ fontSize: 13, color: '#047857', padding: '10px 12px', background: '#ecfdf5', borderRadius: 10, lineHeight: 1.45 }}>{notice}</div>}

            {/* Botón principal */}
            <button
              className="btn btn-primary btn-block"
              style={{ height: 52, fontSize: 15, marginTop: 4, borderRadius: 14, fontWeight: 900 }}
              disabled={loading}
            >
              {loading ? 'Procesando...' : mode === 'forgot' ? 'Enviar link de recuperación' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>

            {/* Volver desde forgot */}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setNotice(''); }}
                style={{ fontSize: 13, color: '#777', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', textDecoration: 'underline', textUnderlineOffset: 2 }}
              >
                ← Volver a iniciar sesión
              </button>
            )}

          </form>
        </div>
      </div>
    </div>
  );
}
