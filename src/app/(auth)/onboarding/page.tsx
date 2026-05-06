'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, ArrowRight, Shirt, ShoppingBag, SportShoe } from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { Icons } from '@/components/shared/icons';
import { validateStoreUsername } from '@/lib/stores/username';
import { createAccount } from './actions';
import s from '../auth.module.css';
import { PLATFORM } from '@/lib/config/platform';

interface StepOneData {
  email: string;
  nombre: string;
  username: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  password: string;
  passwordConfirm: string;
  tipo_negocio: 'ropa' | 'zapatos' | 'mixto';
}

interface MetodoEnvioForm {
  nombre: string; proveedor: string; precio: number; tiempoEstimado: string; cobertura: string; trackingUrl: string;
}

interface StepTwoData {
  ciudad: string;
  direccion: string;
  metodosEnvio: MetodoEnvioForm[];
  formActivo: MetodoEnvioForm | null;
}

const CIUDADES = PLATFORM.cities;
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
    email: '', nombre: '', username: '', instagram: '', tiktok: '', facebook: '',
    password: '', passwordConfirm: '', tipo_negocio: 'ropa',
  });
  const [two, setTwo] = useState<StepTwoData>({
    ciudad: PLATFORM.cities[0], direccion: '', metodosEnvio: [], formActivo: null,
  });
  const [cuentaBancaria, setCuentaBancaria] = useState({ banco: '', cuenta: '', titular: '' });
  const [showCuentaForm, setShowCuentaForm] = useState(false);
  const router = useRouter();

  async function handleNextStep() {
    setError('');
    setFieldErrors({});

    if (step === 0) {
      const errs: Partial<Record<keyof StepOneData, string>> = {};
      if (!one.email.trim()) errs.email = 'El correo es requerido.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(one.email.trim())) errs.email = 'Ingresá un correo válido.';
      if (!one.nombre.trim()) errs.nombre = 'El nombre de tienda es requerido.';
      const usernameValidation = validateStoreUsername(one.username);
      if (!one.username.trim()) errs.username = 'El link público es requerido.';
      else if (usernameValidation.error) errs.username = usernameValidation.error;
      if (!one.password) errs.password = 'La contraseña es requerida.';
      else if (one.password.length < 8) errs.password = 'Mínimo 8 caracteres.';
      else if (!/[A-Za-z]/.test(one.password) || !/[0-9]/.test(one.password)) errs.password = 'Debe incluir letras y al menos un número.';
      if (!one.passwordConfirm) errs.passwordConfirm = 'Confirmá la contraseña.';
      else if (one.password !== one.passwordConfirm) errs.passwordConfirm = 'Las contraseñas no coinciden.';
      if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
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
      tiktok: one.tiktok.trim() || null,
      facebook: one.facebook.trim() || null,
      ubicacion: ubicacion || null,
      tipo_negocio: one.tipo_negocio,
      metodosEnvio: two.metodosEnvio.map(m => ({
        nombre: m.nombre.trim(),
        proveedor: m.proveedor.trim() || m.nombre.trim(),
        precio: m.precio,
        tiempoEstimado: m.tiempoEstimado.trim() || null,
        cobertura: m.cobertura.trim() || null,
        trackingUrl: m.trackingUrl.trim() || null,
      })),
      cuentaBancaria: (showCuentaForm && cuentaBancaria.banco && cuentaBancaria.cuenta)
        ? cuentaBancaria : null,
    });
    if (result.error) { setError(result.error); setLoading(false); return; }
    if (result.needsConfirmation) { setNeedsConfirmation(true); setLoading(false); return; }
    router.push('/drops');
  }

  async function handleExistingAccount() {
    await createClient().auth.signOut();
    window.location.assign('/login');
  }

  if (needsConfirmation) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div className="card" style={{ padding: 40, maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--accent-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--accent)' }}>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
              <path d="M2 4.5A1.5 1.5 0 013.5 3h13A1.5 1.5 0 0118 4.5v11a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 012 15.5v-11zM3.5 4.5L10 9.5l6.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8 }}>¡Tienda creada! Confirmá tu correo</div>
          <div className="t-mute" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Enviamos un link a <strong style={{ color: 'var(--ink)' }}>{one.email}</strong>. Hacé click para activar tu cuenta.
          </div>
          <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 24 }}>
            ¿No llegó? Revisá la carpeta de spam.
          </div>
          <button onClick={() => router.push('/login')} className="btn btn-primary btn-lg btn-block">
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
                      ? <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : i + 1}
                  </div>
                  <span className={s.obStepLabel} data-state={state}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={s.obConnector}/>}
              </div>
            );
          })}
        </div>
        <button onClick={handleExistingAccount} className={s.obLoginLink}>
          <span className={s.obLoginText}>Ya tengo cuenta</span> <ArrowRight size={14}/>
        </button>
      </div>

      <div className={s.obContent}>
        <div className={s.obFormWrap}>

          {/* ── Step 0: Cuenta y tienda ── */}
          {step === 0 && (
            <div className={`card ${s.obCard}`}>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 4 }}>Creá tu cuenta</div>
              <div className="t-mute" style={{ fontSize: 14, marginBottom: 28 }}>Datos de acceso y perfil público de tu tienda.</div>

              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label className="label">Correo electrónico</label>
                  <input className="input input-lg" type="email" placeholder="mariela@miciclita.hn" value={one.email}
                    onChange={e => { setOne(o => ({ ...o, email: e.target.value })); setFieldErrors(fe => ({ ...fe, email: undefined })); }}
                    style={fieldErrors.email ? { borderColor: 'var(--urgent)' } : undefined}/>
                  {fieldErrors.email && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fieldErrors.email}</div>}
                </div>

                <hr className="hr"/>

                <div>
                  <label className="label">Nombre de tienda</label>
                  <input className="input input-lg" placeholder="Mi Ciclita Paca" value={one.nombre}
                    onChange={e => { setOne(o => ({ ...o, nombre: e.target.value })); setFieldErrors(fe => ({ ...fe, nombre: undefined })); }}
                    style={fieldErrors.nombre ? { borderColor: 'var(--urgent)' } : undefined}/>
                  {fieldErrors.nombre && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fieldErrors.nombre}</div>}
                </div>

                <div>
                  <label className="label">¿Qué vendés?</label>
                  <div className={s.obGrid3}>
                    {STORE_TYPES.map(opt => (
                      <button key={opt.value} type="button" onClick={() => setOne(o => ({ ...o, tipo_negocio: opt.value }))}
                        style={{
                          padding: '14px 12px', borderRadius: 10,
                          border: `1.5px solid ${one.tipo_negocio === opt.value ? 'var(--accent)' : 'var(--line)'}`,
                          background: one.tipo_negocio === opt.value ? 'var(--accent)' : '#fff',
                          color: one.tipo_negocio === opt.value ? '#fff' : 'var(--ink)',
                          cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all .12s',
                        }}>
                        <opt.Icon size={24} strokeWidth={1.8}/>
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
                      autoCapitalize="none" spellCheck={false}
                    />
                  </div>
                  {fieldErrors.username && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fieldErrors.username}</div>}
                </div>

                <hr className="hr"/>

                <div className={s.obGrid2}>
                  <div>
                    <label className="label">Contraseña</label>
                    <div style={{ position: 'relative' }}>
                      <input className="input input-lg" type={showPass ? 'text' : 'password'} placeholder="Mín. 8 caracteres + número"
                        value={one.password}
                        onChange={e => { setOne(o => ({ ...o, password: e.target.value })); setFieldErrors(fe => ({ ...fe, password: undefined })); }}
                        style={{ paddingRight: 44, ...(fieldErrors.password ? { borderColor: 'var(--urgent)' } : {}) }}/>
                      <button onClick={() => setShowPass(s => !s)}
                        style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }}>
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                          {showPass
                            ? <><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.5"/><circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5"/></>
                            : <path d="M3 3l14 14M10 4C6.5 4 3.7 6.6 2 10c.9 1.8 2.2 3.3 3.8 4.3M10 16c3.5 0 6.3-2.6 8-6a13.7 13.7 0 00-3.8-4.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>}
                        </svg>
                      </button>
                    </div>
                    {fieldErrors.password && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fieldErrors.password}</div>}
                  </div>
                  <div>
                    <label className="label">Confirmar contraseña</label>
                    <input className="input input-lg" type={showPass ? 'text' : 'password'} placeholder="Repetí la contraseña"
                      value={one.passwordConfirm}
                      onChange={e => { setOne(o => ({ ...o, passwordConfirm: e.target.value })); setFieldErrors(fe => ({ ...fe, passwordConfirm: undefined })); }}
                      style={fieldErrors.passwordConfirm ? { borderColor: 'var(--urgent)' } : undefined}/>
                    {fieldErrors.passwordConfirm && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fieldErrors.passwordConfirm}</div>}
                  </div>
                </div>

                <div>
                  <label className="label">Instagram <span className="t-mute" style={{ fontWeight: 400 }}>(opcional)</span></label>
                  <input className="input input-lg" placeholder="@miciclita.paca" value={one.instagram}
                    onChange={e => setOne(o => ({ ...o, instagram: e.target.value }))}/>
                </div>
                <div className={s.obGrid2}>
                  <div>
                    <label className="label">TikTok <span className="t-mute" style={{ fontWeight: 400 }}>(opcional)</span></label>
                    <input className="input input-lg" placeholder="@miciclita" value={one.tiktok}
                      onChange={e => setOne(o => ({ ...o, tiktok: e.target.value }))}/>
                  </div>
                  <div>
                    <label className="label">Facebook <span className="t-mute" style={{ fontWeight: 400 }}>(opcional)</span></label>
                    <input className="input input-lg" placeholder="miciclita.paca" value={one.facebook}
                      onChange={e => setOne(o => ({ ...o, facebook: e.target.value }))}/>
                  </div>
                </div>
              </div>

              {error && <div style={{ marginTop: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: 'var(--urgent)' }}>{error}</div>}

              <button onClick={handleNextStep} disabled={loading} className="btn btn-primary btn-lg btn-block"
                style={{ marginTop: 24, opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Verificando...' : <>Siguiente <ArrowRight size={16}/></>}
              </button>
              <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--ink-3)' }}>
                ¿Ya tenés cuenta?{' '}
                <button onClick={handleExistingAccount} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'inherit' }}>
                  Iniciá sesión
                </button>
              </p>
            </div>
          )}

          {/* ── Step 1: Ubicación y envíos ── */}
          {step === 1 && (
            <div className={`card ${s.obCard}`}>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 4 }}>Ubicación y envíos</div>
              <div className="t-mute" style={{ fontSize: 14, marginBottom: 28 }}>Dónde estás y cómo entregás a tus compradoras.</div>

              <div style={{ display: 'grid', gap: 16 }}>
                <div className={s.obGrid2}>
                  <div>
                    <label className="label">Ciudad</label>
                    <select className="input input-lg" value={two.ciudad} onChange={e => setTwo(t => ({ ...t, ciudad: e.target.value }))}>
                      {CIUDADES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Dirección de retiro <span className="t-mute" style={{ fontWeight: 400 }}>(opc.)</span></label>
                    <input className="input input-lg" placeholder="Col. Los Andes, 3a calle" value={two.direccion}
                      onChange={e => setTwo(t => ({ ...t, direccion: e.target.value }))}/>
                  </div>
                </div>

                <div>
                  <label className="label" style={{ marginBottom: 10 }}>Métodos de envío <span className="t-mute" style={{ fontWeight: 400 }}>(opc.)</span></label>

                  {/* Lista de métodos agregados */}
                  {two.metodosEnvio.map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 10, marginBottom: 8, background: 'var(--surface-2)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{m.nombre}</div>
                        <div className="t-mute" style={{ fontSize: 11 }}>L {m.precio}{m.tiempoEstimado ? ` · ${m.tiempoEstimado}` : ''}</div>
                      </div>
                      <button type="button" onClick={() => setTwo(t => ({ ...t, metodosEnvio: t.metodosEnvio.filter((_, j) => j !== i) }))}
                        style={{ fontSize: 11, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer' }}>Quitar</button>
                    </div>
                  ))}

                  {/* Formulario inline */}
                  {two.formActivo ? (
                    <div style={{ border: '1px solid var(--accent)', borderRadius: 10, padding: '14px 16px', background: 'var(--accent-2)', display: 'grid', gap: 10 }}>
                      <div className={s.obGrid2} style={{ gap: 10 }}>
                        <div>
                          <label className="label">Nombre público</label>
                          <input className="input" placeholder="Ej: Envío express" value={two.formActivo.nombre}
                            onChange={e => setTwo(t => ({ ...t, formActivo: t.formActivo ? { ...t.formActivo, nombre: e.target.value } : null }))}/>
                        </div>
                        <div>
                          <label className="label">Precio (L)</label>
                          <input className="input" type="number" min={0} placeholder="0" value={two.formActivo.precio === 0 ? '' : two.formActivo.precio}
                            onChange={e => setTwo(t => ({ ...t, formActivo: t.formActivo ? { ...t.formActivo, precio: Number(e.target.value) || 0 } : null }))}/>
                        </div>
                        <div>
                          <label className="label">Empresa / Proveedor</label>
                          <input className="input" placeholder="Ej: DHL" value={two.formActivo.proveedor}
                            onChange={e => setTwo(t => ({ ...t, formActivo: t.formActivo ? { ...t.formActivo, proveedor: e.target.value } : null }))}/>
                        </div>
                        <div>
                          <label className="label">Tiempo estimado</label>
                          <input className="input" placeholder="Ej: 1-3 días" value={two.formActivo.tiempoEstimado}
                            onChange={e => setTwo(t => ({ ...t, formActivo: t.formActivo ? { ...t.formActivo, tiempoEstimado: e.target.value } : null }))}/>
                        </div>
                        <div>
                          <label className="label">Zona de cobertura</label>
                          <input className="input" placeholder="Ej: Todo HN" value={two.formActivo.cobertura}
                            onChange={e => setTwo(t => ({ ...t, formActivo: t.formActivo ? { ...t.formActivo, cobertura: e.target.value } : null }))}/>
                        </div>
                        <div>
                          <label className="label">URL de rastreo <span className="t-mute" style={{ fontWeight: 400 }}>(opc.)</span></label>
                          <input className="input" placeholder="https://..." value={two.formActivo.trackingUrl}
                            onChange={e => setTwo(t => ({ ...t, formActivo: t.formActivo ? { ...t.formActivo, trackingUrl: e.target.value } : null }))}/>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setTwo(t => ({ ...t, formActivo: null }))} className="btn btn-outline btn-sm">Cancelar</button>
                        <button type="button" onClick={() => {
                          if (!two.formActivo?.nombre.trim()) return;
                          setTwo(t => ({ ...t, metodosEnvio: [...t.metodosEnvio, t.formActivo!], formActivo: null }));
                        }} className="btn btn-primary btn-sm">Guardar método</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setTwo(t => ({ ...t, formActivo: { nombre: '', proveedor: '', precio: 0, tiempoEstimado: '', cobertura: '', trackingUrl: '' } }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent)', background: 'none', border: '1px dashed var(--accent)', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                      + Agregar método de envío
                    </button>
                  )}
                </div>
              </div>

              {error && <div style={{ marginTop: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: 'var(--urgent)' }}>{error}</div>}

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button onClick={() => setStep(s => s - 1)} className="btn btn-outline btn-lg" style={{ flex: 1 }}><ArrowLeft size={16}/> Atrás</button>
                <button onClick={handleNextStep} className="btn btn-primary btn-lg" style={{ flex: 2 }}>Siguiente <ArrowRight size={16}/></button>
              </div>
            </div>
          )}

          {/* ── Step 2: Métodos de pago ── */}
          {step === 2 && (
            <div className={`card ${s.obCard}`}>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 4 }}>Métodos de pago</div>
              <div className="t-mute" style={{ fontSize: 14, marginBottom: 24 }}>
                Configurá cómo recibís el dinero. Podés agregar más en Configuración.
              </div>

              <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>

                {/* Cuenta bancaria — expandible */}
                <div style={{ border: `1px solid ${showCuentaForm ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 12, overflow: 'hidden', background: showCuentaForm ? 'var(--accent-2)' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icons.bank width={18} height={18} style={{ color: 'var(--ink-2)' }}/>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>Cuenta bancaria</span>
                        <span className="badge badge-accent" style={{ fontSize: 10 }}>Recomendado</span>
                      </div>
                      <div className="t-mute" style={{ fontSize: 12, marginTop: 2 }}>Ficohsa, BAC, Atlántida, Banco del País · Sin comisión</div>
                    </div>
                    <button
                      onClick={() => setShowCuentaForm(v => !v)}
                      className={showCuentaForm ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'}
                    >
                      {showCuentaForm ? 'Cancelar' : 'Agregar'}
                    </button>
                  </div>

                  {showCuentaForm && (
                    <div style={{ padding: '0 16px 16px', display: 'grid', gap: 10 }}>
                      <div>
                        <label className="label">Banco</label>
                        <select className="input" value={cuentaBancaria.banco} onChange={e => setCuentaBancaria(c => ({ ...c, banco: e.target.value }))}>
                          <option value="">— Seleccioná tu banco —</option>
                          {PLATFORM.banks.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div className={s.obGrid2} style={{ gap: 10 }}>
                        <div>
                          <label className="label">Número de cuenta</label>
                          <input className="input mono" placeholder="123-456-7890" value={cuentaBancaria.cuenta} onChange={e => setCuentaBancaria(c => ({ ...c, cuenta: e.target.value }))}/>
                        </div>
                        <div>
                          <label className="label">Titular</label>
                          <input className="input" placeholder="Tu nombre completo" value={cuentaBancaria.titular} onChange={e => setCuentaBancaria(c => ({ ...c, titular: e.target.value }))}/>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* PixelPay — después */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 12, background: '#fff' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icons.card width={18} height={18} style={{ color: 'var(--ink-2)' }}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>PixelPay</span>
                    <div className="t-mute" style={{ fontSize: 12, marginTop: 2 }}>Tarjetas de crédito/débito · 3.9% + L 5 por transacción</div>
                  </div>
                  <span className="t-mute" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>Después <Icons.arrow width={11} height={11}/></span>
                </div>

                {/* Banca Móvil — después */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 12, background: '#fff' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icons.wallet width={18} height={18} style={{ color: 'var(--ink-2)' }}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Banca Móvil / Tigo Money</span>
                    <div className="t-mute" style={{ fontSize: 12, marginTop: 2 }}>Transferencias locales · Sin comisión</div>
                  </div>
                  <span className="t-mute" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>Después <Icons.arrow width={11} height={11}/></span>
                </div>
              </div>

              <div className="t-mute" style={{ fontSize: 12, marginBottom: 16 }}>
                Podés saltarte este paso y configurarlo después desde Configuración.
              </div>

              {error && <div style={{ marginTop: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: 'var(--urgent)' }}>{error}</div>}

              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button onClick={() => setStep(s => s - 1)} className="btn btn-outline btn-lg" style={{ flex: 1 }}>
                  <ArrowLeft size={16}/> Atrás
                </button>
                <button onClick={handleFinish} disabled={loading} className="btn btn-primary btn-lg" style={{ flex: 2, opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Creando tienda...' : <>Empezar a vender <ArrowRight size={16}/></>}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
