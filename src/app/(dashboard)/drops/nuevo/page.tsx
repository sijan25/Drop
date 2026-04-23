'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/shared/icons';
import { Ph } from '@/components/shared/image-placeholder';
import { SizeSelector } from '@/components/shared/size-selector';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/cloudinary/client';
import { formatProductSizes, normalizeProductSizes } from '@/lib/product-sizes';
import { useCatalogOptions } from '@/hooks/use-catalog-options';

// ── tipos ──────────────────────────────────────────────────────────────────
interface PrendaForm {
  id: string;
  nombre: string;
  marca: string;
  talla: string;
  tallas: string[];
  cantidades_por_talla: Record<string, number>;
  precio: string;
  categoria: string;
  descripcion: string;
  tone: 'rose' | 'sand' | 'sage' | 'blue' | 'dark' | 'warm' | 'neutral';
  fotoUrl?: string;
  fotoFile?: File;
}

function totalCantidad(cantidades: Record<string, number>, tallas: string[]) {
  return tallas.reduce((sum, t) => sum + (cantidades[t] ?? 0), 0);
}

const DURATION_MIN: Record<string, number> = { '1h': 60, '6h': 360, '24h': 1440, '48h': 2880 };

const TONES: PrendaForm['tone'][] = ['rose', 'sand', 'sage', 'blue', 'dark', 'warm', 'neutral'];

const PRENDA_VACIA: Omit<PrendaForm, 'id' | 'tone'> = {
  nombre: '', marca: '', talla: '', tallas: [], cantidades_por_talla: {}, precio: '', categoria: '', descripcion: '',
};

// ── stepper ────────────────────────────────────────────────────────────────
function Stepper({ steps, active }: { steps: string[]; active: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: i < steps.length - 1 ? 6 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 11,
              background: i < active ? 'var(--ink)' : i === active ? '#fff' : 'var(--surface-2)',
              border: i === active ? '1.5px solid var(--ink)' : '1.5px solid transparent',
              color: i < active ? '#fff' : 'var(--ink-2)',
              fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {i < active ? <Icons.check width={11} height={11}/> : i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: i === active ? 600 : 400, color: i <= active ? 'var(--ink)' : 'var(--ink-3)' }}>{s}</span>
          </div>
          {i < steps.length - 1 && <div style={{ width: 24, height: 1, background: 'var(--line)', marginLeft: 6 }}/>}
        </div>
      ))}
    </div>
  );
}

// ── modal agregar / editar prenda ──────────────────────────────────────────
function ModalPrenda({
  inicial,
  onGuardar,
  onCerrar,
}: {
  inicial?: PrendaForm;
  onGuardar: (p: PrendaForm) => void;
  onCerrar: () => void;
}) {
  const [form, setForm] = useState<Omit<PrendaForm, 'id' | 'tone'>>(() => {
    if (!inicial) return { ...PRENDA_VACIA };
    const tallas = normalizeProductSizes([...(inicial.tallas ?? []), inicial.talla].filter(Boolean));
    const cantidades = inicial.cantidades_por_talla ?? {};
    const cantidadesFull = Object.fromEntries(tallas.map(t => [t, cantidades[t] ?? 1]));
    return { nombre: inicial.nombre, marca: inicial.marca, talla: inicial.talla, tallas, cantidades_por_talla: cantidadesFull, precio: inicial.precio, categoria: inicial.categoria, descripcion: inicial.descripcion };
  });
  const [error, setError] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string>(inicial?.fotoUrl ?? '');
  const [fotoFile, setFotoFile] = useState<File | undefined>(inicial?.fotoFile);
  const [subiendo, setSubiendo] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);
  const { categorias, tallas, tipoNegocio } = useCatalogOptions();
  const productoPlaceholder = tipoNegocio === 'zapatos' ? 'Tenis blancos' : 'Blusa floral';
  const tallaLabel = tipoNegocio === 'zapatos' ? 'Numeraciones' : 'Tallas';
  const total = totalCantidad(form.cantidades_por_talla, form.tallas);

  const set = (k: Exclude<keyof typeof form, 'tallas' | 'cantidades_por_talla'>, v: string) => setForm(f => ({ ...f, [k]: v }));

  function handleTallasChange(values: string[]) {
    setForm(f => {
      const cantidades = { ...f.cantidades_por_talla };
      values.forEach(t => { if (!cantidades[t]) cantidades[t] = 1; });
      Object.keys(cantidades).forEach(t => { if (!values.includes(t)) delete cantidades[t]; });
      return { ...f, tallas: values, talla: values[0] ?? '', cantidades_por_talla: cantidades };
    });
  }

  function handleQtyChange(size: string, qty: number) {
    setForm(f => ({ ...f, cantidades_por_talla: { ...f.cantidades_por_talla, [size]: Math.max(0, qty) } }));
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    // Preview inmediato
    setFotoUrl(URL.createObjectURL(f));
    setFotoFile(f);
    // Subir a Cloudinary
    setSubiendo(true);
    try {
      const result = await uploadImage(f, { folder: 'fardodrops/prendas' });
      setFotoUrl(result.url);
      setFotoFile(undefined); // ya no necesitamos el archivo local
    } catch {
      setError('No se pudo subir la foto. Intentá de nuevo.');
    } finally {
      setSubiendo(false);
    }
  }

  function guardar() {
    if (!form.nombre.trim()) { setError('El nombre es requerido.'); return; }
    if (form.tallas.length === 0) { setError('Seleccioná al menos una talla.'); return; }
    if (!form.precio || isNaN(Number(form.precio)) || Number(form.precio) <= 0) {
      setError('Ingresá un precio válido.'); return;
    }
    if (total <= 0) { setError('Asigná al menos 1 unidad entre las tallas seleccionadas.'); return; }
    const idx = Math.floor(Math.random() * TONES.length);
    onGuardar({
      id: inicial?.id ?? `p-${Date.now()}`,
      tone: inicial?.tone ?? TONES[idx],
      fotoUrl: fotoUrl || undefined,
      fotoFile: fotoFile || undefined,
      ...form,
      talla: form.tallas[0] ?? '',
      precio: String(Number(form.precio)),
    });
  }

  return (
    <div
      onClick={onCerrar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 540, background: '#fff', borderRadius: 16, boxShadow: '0 30px 80px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{inicial ? 'Editar prenda' : 'Agregar prenda'}</div>
          <button onClick={onCerrar} style={{ color: 'var(--ink-3)', lineHeight: 1 }}>
            <Icons.close width={16} height={16}/>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', display: 'grid', gap: 14 }}>

          {/* Foto de prenda */}
          <div>
            <label className="label">Foto de la prenda</label>
            <input
              ref={fotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleFoto}
            />
            <div
              onClick={() => !subiendo && fotoRef.current?.click()}
              style={{
                padding: '18px 24px', border: '1.5px dashed var(--line)', borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 14,
                background: 'var(--surface-2)', cursor: subiendo ? 'default' : 'pointer',
                overflow: 'hidden', opacity: subiendo ? 0.7 : 1,
              }}
            >
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt="prenda" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}/>
              ) : (
                <Icons.upload width={18} height={18} style={{ color: 'var(--ink-3)', flexShrink: 0 }}/>
              )}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {subiendo ? 'Subiendo a Cloudinary…' : fotoUrl ? 'Cambiar foto' : 'Subir foto'}
                </div>
                <div className="t-mute" style={{ fontSize: 11 }}>JPG, PNG, WEBP · Máx 5MB</div>
              </div>
            </div>
          </div>

          <hr className="hr"/>

          {/* Nombre + Marca */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Nombre <span style={{ color: 'var(--urgent)' }}>*</span></label>
              <input
                className="input"
                placeholder={productoPlaceholder}
                value={form.nombre}
                onChange={e => set('nombre', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Marca</label>
              <input
                className="input"
                placeholder="H&M, Zara, Vintage…"
                value={form.marca}
                onChange={e => set('marca', e.target.value)}
              />
            </div>
          </div>

          {/* Categoría */}
          <div>
            <div>
              <label className="label">Categoría</label>
              <select
                className="input"
                value={form.categoria}
                onChange={e => set('categoria', e.target.value)}
              >
                <option value="">Seleccionar…</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">{tallaLabel} <span style={{ color: 'var(--urgent)' }}>*</span></label>
            <SizeSelector
              options={tallas}
              selected={form.tallas}
              onChange={handleTallasChange}
              quantities={form.cantidades_por_talla}
              onQuantityChange={handleQtyChange}
            />
            {form.tallas.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-3)' }}>
                Total: <strong>{total}</strong> unidad{total !== 1 ? 'es' : ''} · Hacé clic en la talla para quitarla
              </div>
            )}
          </div>

          {/* Precio */}
          <div>
            <label className="label">Precio (L) <span style={{ color: 'var(--urgent)' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 600, color: 'var(--ink-3)' }}>L</span>
              <input
                className="input mono tnum"
                style={{ paddingLeft: 28 }}
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                value={form.precio}
                onChange={e => set('precio', e.target.value)}
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="label">Descripción <span className="t-mute" style={{ fontWeight: 400 }}>(opcional)</span></label>
            <textarea
              className="input"
              style={{ height: 80, padding: 12, resize: 'none', fontSize: 13, lineHeight: 1.55 }}
              placeholder="Color, detalles, estado de la prenda, medidas exactas…"
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
            />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: 'var(--urgent)' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onCerrar} className="btn btn-outline">Cancelar</button>
          <button onClick={guardar} disabled={subiendo} className="btn btn-primary">
            {inicial ? 'Guardar cambios' : 'Agregar prenda'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── página principal ───────────────────────────────────────────────────────
export default function NuevoDropPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', desc: '', duration: '6h',
    date: new Date().toISOString().slice(0, 10),
    time: '19:00',
  });
  const [prendas, setPrendas] = useState<PrendaForm[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<PrendaForm | undefined>(undefined);
  const [portadaUrl, setPortadaUrl] = useState<string>('');
  const [subiendoPortada, setSubiendoPortada] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [errPub, setErrPub] = useState('');
  const portadaRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const steps = ['Info', 'Programación', 'Prendas', 'Revisar'];

  const totalUnidades = prendas.reduce((s, p) => s + totalCantidad(p.cantidades_por_talla, p.tallas), 0);
  const totalValor = prendas.reduce((s, p) => s + Number(p.precio) * totalCantidad(p.cantidades_por_talla, p.tallas), 0);

  async function handlePortada(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    // Preview inmediato
    setPortadaUrl(URL.createObjectURL(f));
    setSubiendoPortada(true);
    try {
      const result = await uploadImage(f, { folder: 'fardodrops/portadas' });
      setPortadaUrl(result.url);
    } catch {
      setErrPub('No se pudo subir la portada. Intentá de nuevo.');
      setPortadaUrl('');
    } finally {
      setSubiendoPortada(false);
    }
  }

  function agregarPrenda(p: PrendaForm) {
    setPrendas(prev => {
      const existe = prev.find(x => x.id === p.id);
      return existe ? prev.map(x => x.id === p.id ? p : x) : [...prev, p];
    });
    setModalAbierto(false);
    setEditando(undefined);
  }

  function eliminarPrenda(id: string) {
    setPrendas(prev => prev.filter(p => p.id !== id));
  }

  function abrirEditar(p: PrendaForm) {
    setEditando(p);
    setModalAbierto(true);
  }

  async function publicar() {
    if (!form.name.trim()) { setErrPub('El nombre del drop es requerido.'); return; }
    setPublicando(true);
    setErrPub('');
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { data: t } = await supabase.from('tiendas').select('id').eq('user_id', user.id).single();
      if (!t) throw new Error('Tienda no encontrada');

      const iniDate = new Date(`${form.date}T${form.time}`);
      const durMin = DURATION_MIN[form.duration] ?? 360;
      const cierraDate = new Date(iniDate.getTime() + durMin * 60 * 1000);
      const estado: 'activo' | 'programado' = iniDate <= new Date() ? 'activo' : 'programado';

      // portadaUrl ya tiene la URL de Cloudinary (o está vacío)
      const fotoPortadaUrl = portadaUrl || null;

      // Insertar drop
      const { data: drop, error: dropErr } = await supabase.from('drops').insert({
        tienda_id: t.id,
        nombre: form.name.trim(),
        descripcion: form.desc.trim() || null,
        foto_portada_url: fotoPortadaUrl,
        estado,
        inicia_at: iniDate.toISOString(),
        cierra_at: cierraDate.toISOString(),
        duracion_minutos: durMin,
        vendidas_count: 0,
        viewers_count: 0,
        recaudado_total: 0,
      }).select('id').single();

      if (dropErr || !drop) throw new Error(dropErr?.message ?? 'Error al crear el drop');

      // Insertar prendas — las fotos ya están en Cloudinary (fotoUrl es URL directa)
      for (const p of prendas) {
        const fotos: string[] = p.fotoUrl ? [p.fotoUrl] : [];
        const cantTotal = totalCantidad(p.cantidades_por_talla, p.tallas);
        const { error: prendaErr } = await supabase.from('prendas').insert({
          tienda_id: t.id,
          drop_id: drop.id,
          nombre: p.nombre.trim(),
          marca: p.marca.trim() || null,
          talla: p.tallas[0] ?? null,
          precio: Number(p.precio),
          categoria: p.categoria || null,
          descripcion: p.descripcion.trim() || null,
          tallas: p.tallas,
          cantidades_por_talla: p.cantidades_por_talla,
          cantidad: cantTotal || 1,
          estado: 'disponible',
          fotos,
        });
        if (prendaErr) throw new Error(`Error al guardar prenda "${p.nombre}": ${prendaErr.message}`);
      }

      router.push('/drops');
    } catch (e) {
      setErrPub(e instanceof Error ? e.message : 'Error al publicar');
    } finally {
      setPublicando(false);
    }
  }

  // columnas: foto(48) | prenda/info(flex) | cantidad(80) | precio(120) | acciones(60)
  const COL = '48px 1fr 80px 120px 60px';

  return (
    <>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>Nuevo drop</div>
            <div className="t-mute" style={{ fontSize: 13, marginTop: 3 }}>Configurá tu próximo lanzamiento en 4 pasos</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => router.push('/drops')} className="btn btn-ghost btn-sm">Cancelar</button>
          </div>
        </div>

        {/* Stepper */}
        <div style={{ padding: '18px 28px', borderBottom: '1px solid var(--line)', background: '#fff', flexShrink: 0 }}>
          <Stepper steps={steps} active={step}/>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px', background: 'var(--bg)' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>

            {/* ── Step 0: Info ── */}
            {step === 0 && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Información del drop</div>
                <div className="t-mute" style={{ fontSize: 13, marginBottom: 20 }}>Esto es lo que verán tus compradoras en el enlace de IG.</div>
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <label className="label">Nombre <span style={{ color: 'var(--urgent)' }}>*</span></label>
                    <input className="input" placeholder="Fardo de primavera" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/>
                  </div>
                  <div>
                    <label className="label">Descripción</label>
                    <textarea className="input" style={{ height: 88, padding: 12, resize: 'none' }} placeholder="48 prendas femeninas, tallas XS a L…" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })}/>
                  </div>
                  <div>
                    <label className="label">Foto de portada</label>
                    <input
                      ref={portadaRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={handlePortada}
                    />
                    <div
                      onClick={() => !subiendoPortada && portadaRef.current?.click()}
                      style={{ border: '1.5px dashed var(--line)', borderRadius: 12, overflow: 'hidden', cursor: subiendoPortada ? 'default' : 'pointer', background: '#fff', opacity: subiendoPortada ? 0.7 : 1 }}
                    >
                      {portadaUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={portadaUrl} alt="portada" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}/>
                      ) : (
                        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                          <Icons.upload width={20} height={20} style={{ color: 'var(--ink-3)' }}/>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>Arrastrá una foto o click para subir</div>
                          <div className="t-mute" style={{ fontSize: 11 }}>JPG, PNG, WEBP · Recomendado 4:5 · Máx 5MB</div>
                        </div>
                      )}
                    </div>
                    {subiendoPortada && (
                      <div className="t-mute" style={{ fontSize: 11, marginTop: 6 }}>Subiendo a Cloudinary…</div>
                    )}
                    {portadaUrl && !subiendoPortada && (
                      <button
                        onClick={() => { setPortadaUrl(''); if (portadaRef.current) portadaRef.current.value = ''; }}
                        className="t-mute"
                        style={{ fontSize: 11, marginTop: 6, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Quitar foto
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 1: Programación ── */}
            {step === 1 && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Cuándo abre y por cuánto</div>
                <div className="t-mute" style={{ fontSize: 13, marginBottom: 20 }}>Las compradoras recibirán notificación 15min antes.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div>
                    <label className="label">Fecha de apertura</label>
                    <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}/>
                  </div>
                  <div>
                    <label className="label">Hora</label>
                    <input className="input" type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}/>
                  </div>
                </div>
                <label className="label">Duración del drop</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {['1h', '6h', '24h', '48h'].map(d => (
                    <button key={d} onClick={() => setForm({ ...form, duration: d })} style={{
                      padding: '12px 10px', borderRadius: 10,
                      background: form.duration === d ? 'var(--ink)' : '#fff',
                      color: form.duration === d ? '#fff' : 'var(--ink)',
                      border: `1px solid ${form.duration === d ? 'var(--ink)' : 'var(--line)'}`,
                      fontSize: 14, fontWeight: 500,
                    }}>{d}</button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 2: Prendas ── */}
            {step === 2 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      Prendas del drop
                      {prendas.length > 0 && <span className="t-mute" style={{ fontWeight: 400 }}> ({totalUnidades} uds)</span>}
                    </div>
                    <div className="t-mute" style={{ fontSize: 12, marginTop: 2 }}>Agregá cada prenda con su talla, precio y descripción.</div>
                  </div>
                  <button
                    onClick={() => { setEditando(undefined); setModalAbierto(true); }}
                    className="btn btn-primary btn-sm"
                  >
                    <Icons.plus width={13} height={13}/> Agregar prenda
                  </button>
                </div>

                {prendas.length === 0 && (
                  <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 24, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                      <Icons.grid width={20} height={20} style={{ color: 'var(--ink-3)' }}/>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Sin prendas todavía</div>
                    <div className="t-mute" style={{ fontSize: 13, marginBottom: 20 }}>Agregá las prendas que van a estar en este drop.</div>
                    <button onClick={() => { setEditando(undefined); setModalAbierto(true); }} className="btn btn-primary btn-sm">
                      <Icons.plus width={13} height={13}/> Agregar primera prenda
                    </button>
                  </div>
                )}

                {prendas.length > 0 && (
                  <>
                    <div className="card" style={{ overflow: 'hidden', marginBottom: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: COL, padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }} className="mono">
                        <div/><div>Prenda</div><div style={{ textAlign: 'right' }}>Cant.</div><div style={{ textAlign: 'right' }}>Precio</div><div/>
                      </div>
                      {prendas.map((p, i) => (
                        <div key={p.id} style={{ display: 'grid', gridTemplateColumns: COL, padding: '10px 16px', borderBottom: i < prendas.length - 1 ? '1px solid var(--line-2)' : 'none', alignItems: 'center', fontSize: 13 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                            {p.fotoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
                            ) : (
                              <Ph tone={p.tone} radius={6}/>
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                            <div className="t-mute" style={{ fontSize: 11, marginTop: 2 }}>
                              {[p.marca, formatProductSizes(p), p.categoria].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <div className="mono tnum" style={{ fontWeight: 700, textAlign: 'right', fontSize: 13 }}>{totalCantidad(p.cantidades_por_talla, p.tallas)}</div>
                          <div className="mono tnum" style={{ fontWeight: 700, textAlign: 'right', fontSize: 13 }}>L {(Number(p.precio) * totalCantidad(p.cantidades_por_talla, p.tallas)).toLocaleString()}</div>
                          <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                            <button onClick={() => abrirEditar(p)} className="btn-ghost" style={{ padding: 5 }}>
                              <Icons.edit width={13} height={13} style={{ color: 'var(--ink-3)' }}/>
                            </button>
                            <button onClick={() => eliminarPrenda(p.id)} className="btn-ghost" style={{ padding: 5 }}>
                              <Icons.trash width={13} height={13} style={{ color: 'var(--ink-3)' }}/>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#fff', borderRadius: 10, border: '1px solid var(--line)' }}>
                      <span className="t-mute" style={{ fontSize: 13 }}>{prendas.length} línea{prendas.length !== 1 ? 's' : ''} · {totalUnidades} unidad{totalUnidades !== 1 ? 'es' : ''} · valor total</span>
                      <span className="mono tnum" style={{ fontSize: 16, fontWeight: 700 }}>L {totalValor.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Step 3: Revisar ── */}
            {step === 3 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 20, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>Revisar y publicar</div>
                  <div className="t-mute" style={{ fontSize: 12 }}>Confirmá los datos antes de publicar el drop.</div>
                </div>
                <div style={{ padding: 20, display: 'grid', gap: 10 }}>
                  {[
                    ['Nombre', form.name || '—'],
                    ['Apertura', `${form.date} ${form.time}`],
                    ['Duración', form.duration],
                    ['Prendas', `${prendas.length} líneas · ${totalUnidades} unidades`],
                    ['Valor total', `L ${totalValor.toLocaleString()}`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
                      <span className="t-mute">{k}</span>
                      <span style={{ fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>
                {prendas.length > 0 && (
                  <div style={{ padding: '0 20px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Prendas ({prendas.length})</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {prendas.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                            {p.fotoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
                            ) : (
                              <Ph tone={p.tone} radius={6}/>
                            )}
                          </div>
                          <div style={{ flex: 1, fontSize: 12, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                            <div className="t-mute" style={{ fontSize: 11 }}>
                              {[p.marca, formatProductSizes(p), p.categoria, `${totalCantidad(p.cantidades_por_talla, p.tallas)} ud.`].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <span className="mono tnum" style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>L {(Number(p.precio) * totalCantidad(p.cantidades_por_talla, p.tallas)).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Footer nav */}
        <div style={{ padding: '12px 28px', borderTop: '1px solid var(--line)', background: '#fff', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          {errPub && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: 'var(--urgent)' }}>
              {errPub}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(s => Math.max(0, s - 1))} className="btn btn-outline" disabled={step === 0 || publicando}>
              <Icons.arrow width={14} height={14} style={{ transform: 'rotate(180deg)' }} />
              Atrás
            </button>
            {step < 3 ? (
              <button onClick={() => setStep(s => s + 1)} className="btn btn-primary">
                Siguiente <Icons.arrow width={14} height={14}/>
              </button>
            ) : (
              <button onClick={publicar} className="btn btn-primary" disabled={publicando || subiendoPortada}>
                {publicando ? 'Publicando…' : 'Publicar drop'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalAbierto && (
        <ModalPrenda
          inicial={editando}
          onGuardar={agregarPrenda}
          onCerrar={() => { setModalAbierto(false); setEditando(undefined); }}
        />
      )}
    </>
  );
}
