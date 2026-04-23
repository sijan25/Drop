'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, ArrowRight, Shirt, ShoppingBag, SportShoe } from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { Icons } from '@/components/shared/icons';
import { validateStoreUsername } from '@/lib/stores/username';
import { createAccount } from './actions';
import s from '../auth.module.css';

interface StepOneData {
  email: string;
  nombre: string;
  username: string;
  instagram: string;
  password: string;
  passwordConfirm: string;
  tipo_negocio: 'ropa' | 'zapatos' | 'mixto';
}

interface StepTwoData {
  ciudad: string;
  direccion: string;
  envios: { domicilio: boolean; nacional: boolean };
}

const CIUDADES = ['San Pedro Sula', 'Tegucigalpa', 'La Ceiba', 'Choloma', 'Comayagua', 'Choluteca'];

const STEPS = ['Cuenta y tienda', 'Ubicación y envíos', 'Métodos de pago'];

const STORE_TYPES = [
  { value: 'ropa', label: 'Ropa', Icon: Shirt, desc: 'Blusas, jeans, vestidos...' },
  { value: 'zapatos', label: 'Zapatos', Icon: SportShoe, desc: 'Tenis, botas, sandalias...' },
  { value: 'mixto', label: 'Mixto', Icon: ShoppingBag, desc: 'Ropa y zapatos' },
] as const;

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof StepOneData, string>>>({});
  const [showPass, setShowPass] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [one, setOne] = useState<StepOneData>({
    email: '', nombre: '', username: '', instagram: '', password: '', passwordConfirm: '', tipo_negocio: 'ropa',
  });
  const [two, setTwo] = useState<StepTwoData>({
    ciudad: 'San Pedro Sula', direccion: '', envios: { domicilio: true, nacional: false },
  });
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: tienda } = await supabase
        .from('tiendas')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (tienda) router.replace('/dashboard');
    }
    checkAuth();
  }, [router]);

  async function handleNextStep() {
    setError('');
    setFieldErrors({});

    if (step === 0) {
      const errs: Partial<Record<keyof StepOneData, string>> = {};

      if (!one.email.trim()) errs.email = 'El correo es requerido.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(one.email.trim())) errs.email = 'Ingresá un correo válido (ej: nombre@dominio.com).';

      if (!one.nombre.trim()) errs.nombre = 'El nombre de tienda es requerido.';

      const usernameValidation = validateStoreUsername(one.username);
      if (!one.username.trim()) errs.username = 'El link público es requerido.';
      else if (usernameValidation.error) errs.username = usernameValidation.error;

      if (!one.password) errs.password = 'La contraseña es requerida.';
      else if (one.password.length < 8) errs.password = 'Mínimo 8 caracteres.';
      else if (!/[A-Za-z]/.test(one.password) || !/[0-9]/.test(one.password)) errs.password = 'Debe incluir letras y al menos un número.';

      if (!one.passwordConfirm) errs.passwordConfirm = 'Confirmá la contraseña.';
      else if (one.password !== one.passwordConfirm) errs.passwordConfirm = 'Las contraseñas no coinciden.';

      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        return;
      }
    }

    setStep(s => s + 1);
  }

  async function handleFinish() {
    setLoading(true);
    setError('');

    const ubicacion = [two.ciudad, two.direccion].filter(Boolean).join(' · ');

    const result = await createAccount({
      email: one.email.trim(),
      password: one.password,
      username: one.username.toLowerCase().trim(),
      nombre: one.nombre.trim(),
      instagram: one.instagram.trim() || null,
      ubicacion: ubicacion || null,
      tipo_negocio: one.tipo_negocio,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.needsConfirmation) {
      setNeedsConfirmation(true);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  // Pantalla de confirmación de email
  if (needsConfirmation) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div className="card" style={{ padding: 40, maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
              <path d="M2 4.5A1.5 1.5 0 013.5 3h13A1.5 1.5 0 0118 4.5v11a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 012 15.5v-11zM3.5 4.5L10 9.5l6.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8 }}>¡Tienda creada! Confirmá tu correo</div>
          <div className="t-mute" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Enviamos un link de confirmación a <strong style={{ color: 'var(--ink)' }}>{one.email}</strong>.
            Hacé click en el link para activar tu cuenta e iniciar sesión.
          </div>
          <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 24 }}>
            ¿No llegó? Revisá la carpeta de spam o correo no deseado.
          </div>
          <button onClick={() => router.push('/login')} className="btn btn-outline btn-lg btn-block">
            Ir al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.obPage}>
      {/* Top bar */}
      <div className={s.obTopbar}>
        <Logo size={18} />
        <div className={s.obSteps}>
          {STEPS.map((label, i) => {
            const state = i < step ? 'done' : i === step ? 'active' : 'pending';
            return (
              <div key={i} className={s.obStepItem}>
                <div className={s.obStepInner}>
                  <div className={s.obStepBubble} data-state={state}>
                    {i < step
                      ? <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      : i + 1}
                  </div>
                  <span className={s.obStepLabel} data-state={state}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={s.obConnector} />}
              </div>
            );
          })}
        </div>
        <button onClick={() => router.push('/login')} className={s.obLoginLink}>
          Ya tengo cuenta
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Content */}
      <div className={s.obContent}>
        <div className={s.obFormWrap}>

          {/* Step 0 */}
          {step === 0 && (
            <div className="card" style={{ padding: 36 }}>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 4 }}>Creá tu cuenta</div>
              <div className="t-mute" style={{ fontSize: 14, marginBottom: 28 }}>Datos de acceso y perfil público de tu tienda.</div>

              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label className="label">Correo electrónico</label>
                  <input
                    className="input input-lg"
                    type="email"
                    placeholder="mariela@miciclita.hn"
                    value={one.email}
                    onChange={e => { setOne(o => ({ ...o, email: e.target.value })); setFieldErrors(fe => ({ ...fe, email: undefined })); }}
                    style={fieldErrors.email ? { borderColor: 'var(--urgent)' } : undefined}
                  />
                  {fieldErrors.email && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fieldErrors.email}</div>}
                </div>

                <hr className="hr"/>

                <div>
                  <label className="label">Nombre de tienda</label>
                  <input
                    className="input input-lg"
                    placeholder="Mi Ciclita Paca"
                    value={one.nombre}
                    onChange={e => { setOne(o => ({ ...o, nombre: e.target.value })); setFieldErrors(fe => ({ ...fe, nombre: undefined })); }}
                    style={fieldErrors.nombre ? { borderColor: 'var(--urgent)' } : undefined}
                  />
                  {fieldErrors.nombre && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fieldErrors.nombre}</div>}
                </div>

                <div>
                  <label className="label">¿Qué vendés?</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {STORE_TYPES.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setOne(o => ({ ...o, tipo_negocio: opt.value }))}
                        style={{
                          padding: '14px 12px',
                          borderRadius: 10,
                          border: `1.5px solid ${one.tipo_negocio === opt.value ? 'var(--ink)' : 'var(--line)'}`,
                          background: one.tipo_negocio === opt.value ? 'var(--ink)' : '#fff',
                          color: one.tipo_negocio === opt.value ? '#fff' : 'var(--ink)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all .12s',
                        }}
                      >
                        <opt.Icon size={24} strokeWidth={1.8} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</span>
                        <span style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.3 }}>{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Link público</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${fieldErrors.username ? 'var(--urgent)' : 'var(--line)'}`, borderRadius: 10, overflow: 'hidden' }}>
                    <span className="mono" style={{ padding: '0 12px', color: 'var(--ink-3)', fontSize: 13, background: 'var(--surface-2)', height: 48, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                      droppi.app/
                    </span>
                    <input
                      style={{ flex: 1, padding: '0 12px', height: 48, border: 'none', outline: 'none', fontSize: 15 }}
                      placeholder="miciclita"
                      value={one.username}
                      onChange={e => { setOne(o => ({ ...o, username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })); setFieldErrors(fe => ({ ...fe, username: undefined })); }}
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </div>
                  {fieldErrors.username && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fieldErrors.username}</div>}
                </div>

                <hr className="hr"/>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="label">Contraseña</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="input input-lg"
                        type={showPass ? 'text' : 'password'}
                        placeholder="Mín. 8 caracteres + número"
                        value={one.password}
                        onChange={e => { setOne(o => ({ ...o, password: e.target.value })); setFieldErrors(fe => ({ ...fe, password: undefined })); }}
                        style={{ paddingRight: 44, ...(fieldErrors.password ? { borderColor: 'var(--urgent)' } : {}) }}
                      />
                      <button
                        onClick={() => setShowPass(s => !s)}
                        style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                          {showPass
                            ? <><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.5"/><circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5"/></>
                            : <><path d="M3 3l14 14M10 4C6.5 4 3.7 6.6 2 10c.9 1.8 2.2 3.3 3.8 4.3M10 16c3.5 0 6.3-2.6 8-6a13.7 13.7 0 00-3.8-4.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>
                          }
                        </svg>
                      </button>
                    </div>
                    {fieldErrors.password && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fieldErrors.password}</div>}
                  </div>
                  <div>
                    <label className="label">Confirmar contraseña</label>
                    <input
                      className="input input-lg"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Repetí la contraseña"
                      value={one.passwordConfirm}
                      onChange={e => { setOne(o => ({ ...o, passwordConfirm: e.target.value })); setFieldErrors(fe => ({ ...fe, passwordConfirm: undefined })); }}
                      style={fieldErrors.passwordConfirm ? { borderColor: 'var(--urgent)' } : undefined}
                    />
                    {fieldErrors.passwordConfirm && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fieldErrors.passwordConfirm}</div>}
                  </div>
                </div>

                <div>
                  <label className="label">Instagram <span className="t-mute" style={{ fontWeight: 400 }}>(opcional)</span></label>
                  <input
                    className="input input-lg"
                    placeholder="@miciclita.paca"
                    value={one.instagram}
                    onChange={e => setOne(o => ({ ...o, instagram: e.target.value }))}
                  />
                </div>
              </div>

              {error && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: 'var(--urgent)' }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleNextStep}
                disabled={loading}
                className="btn btn-primary btn-lg btn-block"
                style={{ marginTop: 24, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? 'Verificando...' : <>Siguiente <ArrowRight size={16} /></>}
              </button>
            </div>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <div className="card" style={{ padding: 36 }}>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 4 }}>Ubicación y envíos</div>
              <div className="t-mute" style={{ fontSize: 14, marginBottom: 28 }}>Dónde estás y cómo entregás a tus compradoras.</div>

              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="label">Ciudad</label>
                    <select
                      className="input input-lg"
                      value={two.ciudad}
                      onChange={e => setTwo(t => ({ ...t, ciudad: e.target.value }))}
                    >
                      {CIUDADES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Dirección de retiro <span className="t-mute" style={{ fontWeight: 400 }}>(opc.)</span></label>
                    <input
                      className="input input-lg"
                      placeholder="Col. Los Andes, 3a calle"
                      value={two.direccion}
                      onChange={e => setTwo(t => ({ ...t, direccion: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="label" style={{ marginBottom: 10 }}>Opciones de envío que ofrezco</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {[
                      { key: 'pickup', label: 'Retiro en tienda', desc: 'Gratis', fixed: true },
                      { key: 'domicilio', label: 'Envío en ciudad', desc: 'L 60', field: 'domicilio' as const },
                      { key: 'nacional', label: 'Envío nacional', desc: 'L 120 · 2-3 días', field: 'nacional' as const },
                    ].map(o => (
                      <label key={o.key} style={{
                        padding: '12px 14px', border: `1px solid ${o.fixed || two.envios[o.field as keyof typeof two.envios] ? 'var(--ink)' : 'var(--line)'}`,
                        borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer',
                        background: o.fixed || two.envios[o.field as keyof typeof two.envios] ? '#fafafa' : '#fff',
                      }}>
                        <input
                          type="checkbox"
                          checked={o.fixed || (o.field ? two.envios[o.field] : false)}
                          readOnly={o.fixed}
                          onChange={o.field ? e => setTwo(t => ({ ...t, envios: { ...t.envios, [o.field!]: e.target.checked } })) : undefined}
                          style={{ alignSelf: 'flex-start' }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{o.label}</div>
                          <div className="t-mute" style={{ fontSize: 11 }}>{o.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: 'var(--urgent)' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button onClick={() => setStep(s => s - 1)} className="btn btn-outline btn-lg" style={{ flex: 1 }}><ArrowLeft size={16} /> Atrás</button>
                <button onClick={handleNextStep} className="btn btn-primary btn-lg" style={{ flex: 2 }}>Siguiente <ArrowRight size={16} /></button>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="card" style={{ padding: 36 }}>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 4 }}>Métodos de pago</div>
              <div className="t-mute" style={{ fontSize: 14, marginBottom: 28 }}>Configurá cómo recibís el dinero. Podés agregar más en Configuración.</div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ padding: '16px 18px', border: '1px solid var(--line)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icons.card width={18} height={18}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>PixelPay</div>
                    <div className="t-mute" style={{ fontSize: 12 }}>Acepta tarjetas de crédito/débito · 3.9% + L 5 por transacción</div>
                  </div>
                  <button className="btn btn-outline btn-sm">Conectar</button>
                </div>
                <div style={{ padding: '16px 18px', border: '1px solid var(--line)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icons.bank width={18} height={18}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Cuenta bancaria</div>
                    <div className="t-mute" style={{ fontSize: 12 }}>Ficohsa, BAC, Atlántida, Banco Atlántida · Sin comisión</div>
                  </div>
                  <button className="btn btn-outline btn-sm">Agregar</button>
                </div>
              </div>

              <div className="t-mute" style={{ fontSize: 12, marginTop: 16, textAlign: 'center' }}>
                Podés saltarte este paso y configurarlo después desde Configuración.
              </div>

              {error && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: 'var(--urgent)' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button onClick={() => setStep(s => s - 1)} className="btn btn-outline btn-lg" style={{ flex: 1 }}><ArrowLeft size={16} /> Atrás</button>
                <button
                  onClick={handleFinish}
                  disabled={loading}
                  className="btn btn-primary btn-lg"
                  style={{ flex: 2, opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? 'Creando tienda...' : <>Empezar a vender <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
