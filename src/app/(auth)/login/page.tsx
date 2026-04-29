'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/shared/logo';
import { createClient } from '@/lib/supabase/client';
import s from '../auth.module.css';
import { PLATFORM } from '@/lib/config/platform';

/* ─── Contenido principal del login ──────────────────────────────────────── */
function LoginContent() {
  const [mode, setMode]         = useState<'password' | 'magic'>('password');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [sent, setSent]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const router      = useRouter();
  const searchParams = useSearchParams();
  const authError   = searchParams.get('error');

  function validateEmail(val: string) {
    if (!val.trim()) return 'El correo es requerido.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return 'Ingresá un correo válido.';
    return '';
  }

  async function handleLogin() {
    const e = validateEmail(email);
    if (e) { setError(e); return; }
    if (!password) { setError('La contraseña es requerida.'); return; }
    setLoading(true); setError('');
    const { error: err } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setError('Correo o contraseña incorrectos.');
      setLoading(false);
    } else {
      window.location.href = '/dashboard';
    }
  }

  async function handleMagicLink() {
    const e = validateEmail(email);
    if (e) { setError(e); return; }
    setLoading(true); setError('');
    const { error: err } = await createClient().auth.signInWithOtp({
      email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) setError('No pudimos enviar el link. Intentá de nuevo.');
    else setSent(true);
    setLoading(false);
  }

  async function handleGoogle() {
    await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleForgotPassword() {
    const e = validateEmail(email);
    if (e) { setError(e); return; }
    setLoading(true); setError('');
    const { error: err } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });
    if (err) setError('No pudimos enviar el correo. Intentá de nuevo.');
    else setForgotSent(true);
    setLoading(false);
  }

  /* ── Panel izquierdo de marca ── */
  const leftPanel = (
    <div className={s.left}>
      <Logo size={44} wordmarkSize={30} white />

      <div>
        <div className={s.headline}>Vende tu ropa de la manera más sencilla.</div>
        <div className={s.sub}>Drops en vivo, checkout integrado y verificación automática de comprobantes.</div>
        <div className={s.features}>
          {[
            ['Drops en vivo', 'Countdown, feed de actividad y contador de viewers en tiempo real'],
            ['Cobro automático', 'Tarjeta con PixelPay o transferencia con verificación instantánea'],
            ['Gestión completa', 'Inventario, pedidos, envíos y reportes en un solo lugar'],
          ].map(([t, d]) => (
            <div key={t} className={s.featureItem}>
              <div className={s.featureDot} style={{ background: '#C96442' }} />
              <div>
                <div className={s.featureTitle}>{t}</div>
                <div className={s.featureDesc}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={s.leftFooter}>© 2026 Droppi · {PLATFORM.country}</div>
    </div>
  );

  /* ── Vista "olvidé contraseña" ── */
  if (forgotMode) {
    return (
      <div className={s.page}>
        <div className={s.card}>
          {leftPanel}
          <div className={s.right}>
            <div className={s.mobileLogo}><Logo size={36} wordmarkSize={24} /></div>

            {forgotSent ? (
              <>
                <div className={s.sentIcon}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M2 4.5A1.5 1.5 0 013.5 3h13A1.5 1.5 0 0118 4.5v11a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 012 15.5v-11zM3.5 4.5L10 9.5l6.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className={s.formTitle}>Revisá tu bandeja</div>
                <div className={s.formSub}>Enviamos un link a <strong style={{ color: '#0a0a0a' }}>{email}</strong>. Hacé click para restablecer.</div>
                <div className={s.sentNote}>
                  El link vence en 15 min. ¿No llegó? Revisá spam o{' '}
                  <button onClick={() => setForgotSent(false)} style={{ textDecoration: 'underline', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: '#C96442' }}>reenviar</button>.
                </div>
                <button onClick={() => { setForgotMode(false); setForgotSent(false); setError(''); }} className="btn btn-ghost btn-sm" style={{ marginTop: 20, color: '#737373' }}>
                  ← Volver al inicio de sesión
                </button>
              </>
            ) : (
              <>
                <div className={s.formTitle}>Restablecer contraseña</div>
                <div className={s.formSub}>Ingresá tu correo y te enviamos un link.</div>
                <div className={s.fields}>
                  <div>
                    <label className="label">Correo electrónico</label>
                    <input className="input input-lg" type="email" placeholder="mariela@miciclita.hn" value={email}
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleForgotPassword()} autoFocus/>
                  </div>
                </div>
                {error && <div className={s.fieldError}>{error}</div>}
                <button onClick={handleForgotPassword} disabled={loading} className="btn btn-primary btn-lg btn-block" style={{ marginTop: 20, opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Enviando…' : 'Enviar link de recuperación'}
                </button>
                <button onClick={() => { setForgotMode(false); setError(''); }} className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10, color: '#737373' }}>
                  ← Volver al inicio de sesión
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Vista principal ── */
  return (
    <div className={s.page}>
      <div className={s.card}>
        {leftPanel}

        <div className={s.right}>
          <div className={s.mobileLogo}><Logo size={36} wordmarkSize={24} /></div>

          {authError && (
            <div className={s.errorBanner}>El link expiró o no es válido. Iniciá sesión de nuevo.</div>
          )}

          {sent ? (
            <>
              <div className={s.sentIcon}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M2 4.5A1.5 1.5 0 013.5 3h13A1.5 1.5 0 0118 4.5v11a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 012 15.5v-11zM3.5 4.5L10 9.5l6.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className={s.formTitle}>Revisá tu bandeja</div>
              <div className={s.formSub}>Enviamos un link a <strong style={{ color: '#0a0a0a' }}>{email}</strong>. Hacé click desde este dispositivo.</div>
              <div className={s.sentNote}>
                El link vence en 15 min. ¿No llegó? Revisá spam o{' '}
                <button onClick={() => setSent(false)} style={{ textDecoration: 'underline', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: '#C96442' }}>reenviar</button>.
              </div>
            </>
          ) : (
            <>
              <div className={s.formTitle}>Iniciá sesión</div>
              <div className={s.formSub}>
                ¿No tenés cuenta?{' '}
                <button onClick={() => router.push('/onboarding')}
                  style={{ fontWeight: 600, color: '#C96442', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
                  Crear tienda
                </button>
              </div>

              {/* Google */}
              <button onClick={handleGoogle} className={`btn btn-outline btn-lg btn-block ${s.googleBtn}`}>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M14.8 8.2c0-.5-.05-1-.14-1.4H8v2.64h3.8c-.16.9-.66 1.66-1.42 2.16v1.8h2.3c1.34-1.24 2.12-3.06 2.12-5.2z" fill="#4285F4"/>
                  <path d="M8 15c1.92 0 3.53-.64 4.7-1.74l-2.3-1.78c-.64.42-1.45.68-2.4.68-1.84 0-3.4-1.24-3.96-2.92H1.7v1.84C2.86 13.4 5.24 15 8 15z" fill="#34A853"/>
                  <path d="M4.04 9.24c-.14-.42-.22-.88-.22-1.36s.08-.94.22-1.36V4.68H1.7C1.24 5.6 1 6.76 1 8c0 1.24.26 2.4.7 3.32l2.34-1.84v-.24z" fill="#FBBC05"/>
                  <path d="M8 3.72c1.04 0 1.98.36 2.72 1.06l2.02-2.02C11.52 1.66 9.92 1 8 1 5.24 1 2.86 2.6 1.7 4.68L4.04 6.52C4.6 4.84 6.16 3.72 8 3.72z" fill="#EA4335"/>
                </svg>
                Continuar con Google
              </button>

              <div className={s.divider}><div/><span>o</span><div/></div>

              {/* Tab toggle */}
              <div className={s.tabToggle}>
                <button onClick={() => setMode('password')} className={mode === 'password' ? s.tabActive : ''}>Con contraseña</button>
                <button onClick={() => setMode('magic')} className={mode === 'magic' ? s.tabActive : ''}>Sin contraseña</button>
              </div>

              <div className={s.fields}>
                <div>
                  <label className="label">Correo electrónico</label>
                  <input className="input input-lg" type="email" placeholder="mariela@miciclita.hn"
                    value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                    onKeyDown={e => mode === 'password' && e.key === 'Enter' && handleLogin()}
                    style={error && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) ? { borderColor: '#dc2626' } : undefined}
                  />
                </div>

                {mode === 'password' && (
                  <div>
                    <div className={s.passLabelRow}>
                      <label className="label" style={{ margin: 0 }}>Contraseña</label>
                      <button onClick={() => { setForgotMode(true); setError(''); }}
                        style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: '#C96442', fontWeight: 500 }}>
                        ¿Olvidaste la contraseña?
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input className="input input-lg" type={showPass ? 'text' : 'password'}
                        placeholder="••••••••" value={password}
                        onChange={e => { setPassword(e.target.value); setError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        style={{ paddingRight: 44, ...(error && !password ? { borderColor: '#dc2626' } : {}) }}
                      />
                      <button onClick={() => setShowPass(v => !v)} className={s.showPass}>
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                          {showPass
                            ? <><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.5"/><circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5"/></>
                            : <><path d="M3 3l14 14M10 4C6.5 4 3.7 6.6 2 10c.9 1.8 2.2 3.3 3.8 4.3M10 16c3.5 0 6.3-2.6 8-6a13.7 13.7 0 00-3.8-4.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>
                          }
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {error && <div className={s.fieldError}>{error}</div>}

              <button onClick={mode === 'password' ? handleLogin : handleMagicLink}
                disabled={loading} className="btn btn-primary btn-lg btn-block"
                style={{ marginTop: 20, opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Entrando…' : mode === 'password' ? 'Iniciar sesión' : 'Enviar acceso sin contraseña'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
