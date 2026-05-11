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
      className="fixed inset-0 z-[360] flex items-center justify-center bg-[rgba(8,8,8,0.62)] backdrop-blur-[10px] p-[18px]"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-[min(540px,calc(100vw-32px))] max-h-[calc(100vh-36px)] overflow-y-auto bg-white rounded-[18px] p-0 shadow-[0_30px_90px_rgba(0,0,0,0.28)] [animation:slideUp_.22s_ease] relative"
      >
        {/* Header */}
        <div className="px-7 pt-7 pb-5 border-b border-[rgba(0,0,0,0.07)] bg-gradient-to-b from-[#fbfbfb] to-white">
          {/* Fila: ícono + botón cerrar */}
          <div className="flex items-center justify-between mb-[14px]">
            <div className="w-[46px] h-[46px] rounded-[14px] bg-[var(--accent)] text-white flex items-center justify-center shrink-0">
              <Icons.user width={20} height={20} />
            </div>
            {/* Botón cerrar inline (quitamos el absolute) */}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="w-9 h-9 rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-white text-[#555] flex items-center justify-center cursor-pointer shrink-0"
            >
              <Icons.close width={16} height={16} />
            </button>
          </div>
          {/* Título y subtítulo sin competir con el botón cerrar */}
          <div className="text-[22px] font-[900] tracking-[-0.03em] text-[#111] leading-[1.2]">
            {mode === 'forgot' ? 'Olvidé mi contraseña' : mode === 'login' ? 'Bienvenido de nuevo' : 'Creá tu cuenta'}
          </div>
          <div className="text-[13px] text-[#777] leading-[1.5] mt-[6px]">
            {mode === 'forgot'
              ? 'Te enviamos un link para crear una nueva contraseña.'
              : mode === 'login'
                ? 'Entrá para ver pedidos y comprar más rápido.'
                : 'Tu perfil guarda tus datos para el próximo checkout.'}
          </div>
        </div>

        {/* Body */}
        <div className="p-[30px]">

          {/* Toggle login / register */}
          {mode !== 'forgot' && (
            <div className="grid grid-cols-2 gap-[6px] bg-[#f3f3f3] rounded-[12px] p-1 mb-[22px]">
              {(['login', 'register'] as const).map(m => (
                <button
                  key={m} type="button"
                  onClick={() => { setMode(m); setError(''); setNotice(''); }}
                  className={`h-[42px] rounded-[9px] text-[13px] font-[800] cursor-pointer ${mode === m ? 'bg-white border border-[rgba(0,0,0,0.08)] text-[#111] shadow-[0_1px_5px_rgba(0,0,0,0.06)]' : 'bg-transparent border border-transparent text-[#777]'}`}
                >
                  {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="grid gap-[14px]">

            {/* Campos solo en registro */}
            {mode === 'register' && (
              <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
                <div>
                  <label className="label">Nombre completo</label>
                  <input className="input input-lg" autoComplete="name" placeholder="Karla Morales" value={nombre}
                    onChange={e => { setNombre(e.target.value); setError(''); setNotice(''); }} />
                </div>
                <div>
                  <label className="label">WhatsApp <span className="font-normal text-[#999]">opcional</span></label>
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
                <div className="flex items-center justify-between gap-2 mb-[6px]">
                  <span className="label inline-flex items-center gap-[6px] m-0 shrink">
                    Contraseña
                    {mode === 'register' && <span className="font-normal text-[#999]">mín. 8 caracteres</span>}
                  </span>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); setNotice(''); }}
                      className="text-[12px] text-[var(--accent)] bg-none border-none cursor-pointer font-bold p-0 no-underline shrink-0 whitespace-nowrap"
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
              <div className="grid grid-cols-2 gap-2">
                {([['Seguimiento de pedidos', Icons.bag], ['Checkout más rápido', Icons.sparkle]] as const).map(([label, Icon]) => {
                  const Ic = Icon as typeof Icons.bag;
                  return (
                    <div key={label} className="border border-[rgba(0,0,0,0.08)] rounded-[11px] p-[10px_11px] flex items-center gap-2 text-[#555] text-[12px] font-[800]">
                      <Ic width={14} height={14} />{label}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Errores y avisos */}
            {error && <div className="text-[13px] text-[#b91c1c] px-3 py-[10px] bg-[#fef2f2] rounded-[10px]">{error}</div>}
            {notice && <div className="text-[13px] text-[#047857] px-3 py-[10px] bg-[#ecfdf5] rounded-[10px] leading-[1.45]">{notice}</div>}

            {/* Botón principal */}
            <button
              className="btn btn-primary btn-block h-[52px] text-[15px] mt-1 rounded-[14px] font-[900]"
              disabled={loading}
            >
              {loading ? 'Procesando...' : mode === 'forgot' ? 'Enviar link de recuperación' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>

            {/* Volver desde forgot */}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setNotice(''); }}
                className="text-[13px] text-[#777] bg-none border-none cursor-pointer text-center underline underline-offset-[2px]"
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
