'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/shared/logo';
import { createClient } from '@/lib/supabase/client';
import s from '@/app/(auth)/auth.module.css';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleReset() {
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError('No pudimos actualizar la contraseña. El link puede haber expirado.');
    } else {
      setDone(true);
    }
    setLoading(false);
  }

  return (
    <div className={s.page}>
      <div className={s.card}>

        {/* Left — branding */}
        <div className={s.left}>
          <Logo size={20} white />
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
                  <div className={s.featureDot} />
                  <div>
                    <div className={s.featureTitle}>{t}</div>
                    <div className={s.featureDesc}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={s.leftFooter}>© 2026 Droppi · Honduras</div>
        </div>

        {/* Right — form */}
        <div className={s.right}>
          <div className={s.mobileLogo}><Logo size={18} /></div>

          {done ? (
            <>
              <div className={s.sentIcon}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10l4.5 4.5L16 6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className={s.formTitle}>¡Contraseña actualizada!</div>
              <div className={s.formSub}>
                Tu nueva contraseña está activa. Ya podés iniciar sesión.
              </div>
              <button
                onClick={() => router.push('/dashboard')}
                className="btn btn-primary btn-lg btn-block"
                style={{ marginTop: 24 }}
              >
                Ir al dashboard
              </button>
            </>
          ) : (
            <>
              <div className={s.formTitle}>Nueva contraseña</div>
              <div className={s.formSub}>
                Elegí una contraseña segura para tu cuenta.
              </div>

              <div className={s.fields}>
                <div>
                  <label className="label">Nueva contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input input-lg"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleReset()}
                      style={{ paddingRight: 44 }}
                      autoFocus
                    />
                    <button onClick={() => setShowPass(v => !v)} className={s.showPass}>
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        {showPass
                          ? <><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" /></>
                          : <><path d="M3 3l14 14M10 4C6.5 4 3.7 6.6 2 10c.9 1.8 2.2 3.3 3.8 4.3M10 16c3.5 0 6.3-2.6 8-6a13.7 13.7 0 00-3.8-4.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>
                        }
                      </svg>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Confirmar contraseña</label>
                  <input
                    className="input input-lg"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Repetí la contraseña"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                    style={error && confirm && password !== confirm ? { borderColor: '#dc2626' } : undefined}
                  />
                </div>
              </div>

              {error && <div className={s.fieldError}>{error}</div>}

              <button
                onClick={handleReset}
                disabled={loading}
                className="btn btn-primary btn-lg btn-block"
                style={{ marginTop: 20, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? 'Guardando…' : 'Guardar nueva contraseña'}
              </button>

              <button
                onClick={() => router.push('/login')}
                className="btn btn-ghost btn-sm btn-block"
                style={{ marginTop: 10, color: '#737373' }}
              >
                ← Volver al inicio de sesión
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
