'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/shared/icons';
import { Ph } from '@/components/shared/image-placeholder';
import { SizeSelector } from '@/components/shared/size-selector';
import { createClient } from '@/lib/supabase/client';
import { formatCurrencyTienda } from '@/lib/config/platform';
import { uploadImage } from '@/lib/cloudinary/client';
import { formatProductSizes, normalizeProductSizes } from '@/lib/product-sizes';
import { useCatalogOptions } from '@/hooks/use-catalog-options';
import { TONES } from '@/lib/ui/tones';

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
  fotos: string[];
  cloudinaryIds: string[];
}

function totalCantidad(cantidades: Record<string, number>, tallas: string[]) {
  return tallas.reduce((sum, t) => sum + (cantidades[t] ?? 0), 0);
}

const DURATION_MIN: Record<string, number> = { '1h': 60, '6h': 360, '24h': 1440, '48h': 2880 };


const PRENDA_VACIA: Omit<PrendaForm, 'id' | 'tone' | 'fotos' | 'cloudinaryIds'> = {
  nombre: '', marca: '', talla: '', tallas: [], cantidades_por_talla: {}, precio: '', categoria: '', descripcion: '',
};

// ── stepper ────────────────────────────────────────────────────────────────
function Stepper({ steps, active }: { steps: string[]; active: number }) {
  return (
    <div className="new-drop-stepper flex items-center gap-[6px]">
      {steps.map((s, i) => (
        <div key={i} className={`new-drop-stepper-item flex items-center${i < steps.length - 1 ? ' gap-[6px]' : ''}`}>
          <div className="new-drop-stepper-step flex items-center gap-2">
            <div className={`new-drop-stepper-bubble w-[22px] h-[22px] rounded-full text-[11px] font-semibold flex items-center justify-center ${i < active ? 'bg-[var(--ink)] border-[1.5px] border-transparent text-white' : i === active ? 'bg-white border-[1.5px] border-[var(--ink)] text-[var(--ink-2)]' : 'bg-[var(--surface-2)] border-[1.5px] border-transparent text-[var(--ink-2)]'}`}>
              {i < active ? <Icons.check width={11} height={11}/> : i + 1}
            </div>
            <span className={`new-drop-stepper-label text-[12px] ${i === active ? 'font-semibold' : 'font-normal'} ${i <= active ? 'text-[var(--ink)]' : 'text-[var(--ink-3)]'}`}>{s}</span>
          </div>
          {i < steps.length - 1 && <div className="new-drop-stepper-line w-6 h-px bg-[var(--line)] ml-[6px]"/>}
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
  const [form, setForm] = useState<Omit<PrendaForm, 'id' | 'tone' | 'fotos' | 'cloudinaryIds'>>(() => {
    if (!inicial) return { ...PRENDA_VACIA };
    const tallas = normalizeProductSizes([...(inicial.tallas ?? []), inicial.talla].filter(Boolean));
    const cantidades = inicial.cantidades_por_talla ?? {};
    const cantidadesFull = Object.fromEntries(tallas.map(t => [t, cantidades[t] ?? 1]));
    return { nombre: inicial.nombre, marca: inicial.marca, talla: inicial.talla, tallas, cantidades_por_talla: cantidadesFull, precio: inicial.precio, categoria: inicial.categoria, descripcion: inicial.descripcion };
  });
  const [error, setError] = useState('');
  const [fotos, setFotos] = useState<string[]>(inicial?.fotos ?? []);
  const [cloudinaryIds, setCloudinaryIds] = useState<string[]>(inicial?.cloudinaryIds ?? []);
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
    if (!f || fotos.length >= 5) return;
    setSubiendo(true);
    try {
      const result = await uploadImage(f, { folder: 'fardodrops/prendas' });
      setFotos(prev => [...prev, result.url]);
      setCloudinaryIds(prev => [...prev, result.publicId]);
    } catch {
      setError('No se pudo subir la foto. Intentá de nuevo.');
    } finally {
      setSubiendo(false);
      if (fotoRef.current) fotoRef.current.value = '';
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
      ...form,
      fotos,
      cloudinaryIds,
      talla: form.tallas[0] ?? '',
      precio: String(Number(form.precio)),
    });
  }

  return (
    <div
      onClick={onCerrar}
      className="fixed inset-0 bg-[rgba(15,20,25,0.45)] flex items-center justify-center z-[400] p-6"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[540px] bg-white rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.2)] flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-[22px] py-[18px] border-b border-[var(--line)] flex items-center justify-between shrink-0">
          <div className="text-[16px] font-semibold">{inicial ? 'Editar prenda' : 'Agregar prenda'}</div>
          <button onClick={onCerrar} className="text-[var(--ink-3)] leading-none">
            <Icons.close width={16} height={16}/>
          </button>
        </div>

        {/* Body */}
        <div className="px-[22px] py-5 overflow-y-auto grid gap-[14px]">

          {/* Fotos de la prenda — máx 5 */}
          <div>
            <label className="label">Fotos</label>
            <input ref={fotoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFoto}/>
            <div className="flex gap-2 flex-wrap">
              {fotos.map((url, i) => (
                <div key={i} className="w-[72px] h-[72px] rounded-lg overflow-hidden border border-[var(--line)] relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" src={url} alt="" className="w-full h-full object-cover"/>
                  <button onClick={() => setFotos(f => f.filter((_, j) => j !== i))}
                    className="absolute top-[2px] right-[2px] bg-[rgba(0,0,0,0.55)] rounded text-white w-[18px] h-[18px] flex items-center justify-center text-[10px] border-0 cursor-pointer">
                    ×
                  </button>
                </div>
              ))}
              {fotos.length < 5 && (
                <button
                  onClick={() => fotoRef.current?.click()}
                  disabled={subiendo}
                  className={`w-[72px] h-[72px] rounded-lg border-[1.5px] border-dashed border-[var(--line)] flex flex-col items-center justify-center gap-1 text-[var(--ink-3)] text-[10px] bg-[var(--surface-2)] ${subiendo ? 'cursor-default opacity-70' : 'cursor-pointer'}`}>
                  {subiendo ? <span className="text-[10px]">Subiendo…</span> : <><Icons.plus width={16} height={16}/><span>Foto</span></>}
                </button>
              )}
            </div>
            <div className="t-mute text-[11px] mt-1">{fotos.length}/5 fotos · JPG, PNG, WEBP</div>
          </div>

          <hr className="hr"/>

          {/* Nombre + Marca */}
          <div className="new-drop-form-grid-2 grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre <span className="text-[var(--urgent)]">*</span></label>
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
            <label className="label">{tallaLabel} <span className="text-[var(--urgent)]">*</span></label>
            <SizeSelector
              options={tallas}
              selected={form.tallas}
              onChange={handleTallasChange}
              quantities={form.cantidades_por_talla}
              onQuantityChange={handleQtyChange}
            />
            {form.tallas.length > 0 && (
              <div className="mt-[6px] text-[12px] text-[var(--ink-3)]">
                Total: <strong>{total}</strong> unidad{total !== 1 ? 'es' : ''} · Hacé clic en la talla para quitarla
              </div>
            )}
          </div>

          {/* Precio */}
          <div>
            <label className="label">Precio (L) <span className="text-[var(--urgent)]">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-[var(--ink-3)]">L</span>
              <input
                className="input mono tnum pl-7"
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
            <label className="label">Descripción <span className="t-mute font-normal">(opcional)</span></label>
            <textarea
              className="input h-20 p-3 resize-none text-[13px] leading-[1.55]"
              placeholder="Color, detalles, estado de la prenda, medidas exactas…"
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
            />
          </div>

          {error && (
            <div className="px-[14px] py-[10px] bg-[#fef2f2] border border-[#fecaca] rounded-lg text-[13px] text-[var(--urgent)]">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="new-drop-modal-footer px-[22px] py-[14px] border-t border-[var(--line)] flex justify-end gap-2 shrink-0">
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
    name: '', desc: '', duration: '',
    date: new Date().toISOString().slice(0, 10),
    time: '19:00',
  });
  const [prendas, setPrendas] = useState<PrendaForm[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<PrendaForm | undefined>(undefined);
  const [portadaUrl, setPortadaUrl] = useState<string>('');
  const [portadaCloudinaryId, setPortadaCloudinaryId] = useState<string>('');
  const [subiendoPortada, setSubiendoPortada] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [errPub, setErrPub] = useState('');
  const [infoErrors, setInfoErrors] = useState<{ name?: string; portada?: string }>({});
  const [scheduleErrors, setScheduleErrors] = useState<{ duration?: string }>({});
  const [productsError, setProductsError] = useState('');
  const [simbolo, setSimbolo] = useState('L');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('tiendas').select('simbolo_moneda').eq('user_id', user.id as never).single()
        .then(({ data }) => { if (data) setSimbolo((data as unknown as { simbolo_moneda: string }).simbolo_moneda ?? 'L'); });
    });
  }, []);
  const portadaRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const steps = ['Info', 'Programación', 'Prendas', 'Revisar'];

  const totalUnidades = prendas.reduce((s, p) => s + totalCantidad(p.cantidades_por_talla, p.tallas), 0);
  const totalValor = prendas.reduce((s, p) => s + Number(p.precio) * totalCantidad(p.cantidades_por_talla, p.tallas), 0);

  async function handlePortada(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErrPub('');
    setInfoErrors(prev => ({ ...prev, portada: undefined }));
    // Preview inmediato
    setPortadaUrl(URL.createObjectURL(f));
    setSubiendoPortada(true);
    try {
      const result = await uploadImage(f, { folder: 'fardodrops/portadas' });
      setPortadaUrl(result.url);
      setPortadaCloudinaryId(result.publicId);
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
    setProductsError('');
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

  function validateInfoStep() {
    const errors: { name?: string; portada?: string } = {};
    if (!form.name.trim()) errors.name = 'Ingresá el nombre del drop.';
    if (subiendoPortada) errors.portada = 'Esperá a que termine de subir la portada.';
    else if (!portadaUrl) errors.portada = 'Subí una foto de portada para continuar.';
    setInfoErrors(errors);
    if (Object.keys(errors).length > 0) {
      return false;
    }
    setErrPub('');
    return true;
  }

  function validateScheduleStep() {
    const errors: { duration?: string } = {};
    if (!form.duration) errors.duration = 'Seleccioná cuánto durará el drop.';
    setScheduleErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateProductsStep() {
    if (prendas.length === 0) {
      setProductsError('Agregá al menos una prenda para continuar.');
      return false;
    }
    setProductsError('');
    return true;
  }

  function handleNextStep() {
    if (step === 0 && !validateInfoStep()) return;
    if (step === 1 && !validateScheduleStep()) return;
    if (step === 2 && !validateProductsStep()) return;
    setStep(s => s + 1);
  }

  async function publicar() {
    if (!validateInfoStep()) {
      setStep(0);
      return;
    }
    if (!validateScheduleStep()) {
      setStep(1);
      return;
    }
    if (!validateProductsStep()) {
      setStep(2);
      return;
    }
    setPublicando(true);
    setErrPub('');
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { data: t } = await supabase.from('tiendas').select('id').eq('user_id', user.id as never).single();
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
        portada_cloudinary_id: portadaCloudinaryId || null,
        estado,
        inicia_at: iniDate.toISOString(),
        cierra_at: cierraDate.toISOString(),
        duracion_minutos: durMin,
        vendidas_count: 0,
        viewers_count: 0,
        recaudado_total: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).select('id').single();

      if (dropErr || !drop) throw new Error(dropErr?.message ?? 'Error al crear el drop');
      const dropData = drop as { id: string };

      for (const p of prendas) {
        const fotos: string[] = p.fotos ?? [];
        const cantTotal = totalCantidad(p.cantidades_por_talla, p.tallas);
        const { error: prendaErr } = await supabase.from('prendas').insert({
          tienda_id: t.id,
          drop_id: dropData.id,
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
          cloudinary_ids: p.cloudinaryIds ?? [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
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
      <div className="new-drop-shell h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="new-drop-header px-7 pt-5 pb-4 border-b border-[var(--line)] flex items-end justify-between gap-5 shrink-0">
          <div>
            <div className="text-[20px] font-semibold tracking-[-0.015em]">Nuevo drop</div>
            <div className="t-mute text-[13px] mt-[3px]">Configurá tu próximo lanzamiento en 4 pasos</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push('/drops')} className="btn btn-ghost btn-sm">Cancelar</button>
          </div>
        </div>

        {/* Stepper */}
        <div className="new-drop-stepper-wrap px-7 py-[18px] border-b border-[var(--line)] bg-white shrink-0">
          <Stepper steps={steps} active={step}/>
        </div>

        {/* Contenido */}
        <div className="new-drop-content flex-1 overflow-y-auto p-7 bg-[var(--bg)]">
          <div className="new-drop-content-inner max-w-[720px] mx-auto">

            {/* ── Step 0: Info ── */}
            {step === 0 && (
              <div className="new-drop-card card p-6">
                <div className="text-[16px] font-semibold mb-1">Información del drop</div>
                <div className="t-mute text-[13px] mb-5">Esto es lo que verán tus compradoras en el enlace de IG.</div>
                <div className="grid gap-[14px]">
                  <div>
                    <label className="label">Nombre <span className="text-[var(--urgent)]">*</span></label>
                    <input
                      className={`input${infoErrors.name ? ' border-[var(--urgent)]' : ''}`}
                      placeholder="Fardo de primavera"
                      value={form.name}
                      onChange={e => {
                        setForm({ ...form, name: e.target.value });
                        setErrPub('');
                        setInfoErrors(prev => ({ ...prev, name: undefined }));
                      }}
                    />
                    {infoErrors.name && <div className="mt-[5px] text-[12px] text-[var(--urgent)]">{infoErrors.name}</div>}
                  </div>
                  <div>
                    <label className="label">Descripción</label>
                    <textarea className="input h-[88px] p-3 resize-none" placeholder="48 prendas femeninas, tallas XS a L…" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })}/>
                  </div>
                  <div>
                    <label className="label">Foto de portada</label>
                    <input
                      ref={portadaRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePortada}
                    />
                    <div
                      onClick={() => !subiendoPortada && portadaRef.current?.click()}
                      className={`border-[1.5px] border-dashed rounded-xl overflow-hidden bg-white${subiendoPortada ? ' cursor-default opacity-70' : ' cursor-pointer'}${infoErrors.portada ? ' border-[var(--urgent)]' : ' border-[var(--line)]'}`}
                    >
                      {portadaUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img loading="lazy" src={portadaUrl} alt="portada" className="w-full h-[180px] object-cover block"/>
                      ) : (
                        <div className="p-6 flex flex-col items-center gap-2">
                          <Icons.upload width={20} height={20} className="text-[var(--ink-3)]"/>
                          <div className="text-[13px] font-medium">Arrastrá una foto o click para subir</div>
                          <div className="t-mute text-[11px]">JPG, PNG, WEBP · Recomendado 4:5 · Máx 5MB</div>
                        </div>
                      )}
                    </div>
                    {subiendoPortada && (
                      <div className="t-mute text-[11px] mt-[6px]">Subiendo a Cloudinary…</div>
                    )}
                    {infoErrors.portada && <div className="mt-[6px] text-[12px] text-[var(--urgent)]">{infoErrors.portada}</div>}
                    {portadaUrl && !subiendoPortada && (
                      <button
                        onClick={() => { setPortadaUrl(''); setInfoErrors(prev => ({ ...prev, portada: 'Subí una foto de portada para continuar.' })); if (portadaRef.current) portadaRef.current.value = ''; }}
                        className="t-mute text-[11px] mt-[6px] underline bg-transparent border-0 cursor-pointer p-0"
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
              <div className="new-drop-card card p-6">
                <div className="text-[16px] font-semibold mb-1">Cuándo abre y por cuánto</div>
                <div className="t-mute text-[13px] mb-5">Las compradoras recibirán notificación 15min antes.</div>
                <div className="new-drop-form-grid-2 grid grid-cols-2 gap-[14px] mb-5">
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
                <div className="new-drop-duration-grid grid grid-cols-4 gap-2">
                  {['1h', '6h', '24h', '48h'].map(d => (
                    <button key={d} onClick={() => { setForm({ ...form, duration: d }); setScheduleErrors({}); }}
                      className={`py-3 px-[10px] rounded-[10px] text-[14px] font-medium ${form.duration === d ? 'bg-[var(--ink)] text-white border border-[var(--ink)]' : `bg-white text-[var(--ink)] border ${scheduleErrors.duration ? 'border-[var(--urgent)]' : 'border-[var(--line)]'}`}`}>
                      {d}
                    </button>
                  ))}
                </div>
                {scheduleErrors.duration && <div className="mt-[6px] text-[12px] text-[var(--urgent)]">{scheduleErrors.duration}</div>}
              </div>
            )}

            {/* ── Step 2: Prendas ── */}
            {step === 2 && (
              <div>
                <div className="new-drop-products-header flex items-center justify-between mb-[14px]">
                  <div>
                    <div className="text-[15px] font-semibold">
                      Prendas del drop
                      {prendas.length > 0 && <span className="t-mute font-normal"> ({totalUnidades} uds)</span>}
                    </div>
                    <div className="t-mute text-[12px] mt-[2px]">Agregá cada prenda con su talla, precio y descripción.</div>
                  </div>
                  <button
                    onClick={() => { setEditando(undefined); setModalAbierto(true); }}
                    className="btn btn-primary btn-sm"
                  >
                    <Icons.plus width={13} height={13}/> Agregar prenda
                  </button>
                </div>

                {prendas.length === 0 && (
                  <div className={`new-drop-empty-card card p-10 text-center${productsError ? ' border-[var(--urgent)]' : ''}`}>
                    <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center mx-auto mb-[14px]">
                      <Icons.grid width={20} height={20} className="text-[var(--ink-3)]"/>
                    </div>
                    <div className="text-[14px] font-medium mb-[6px]">Sin prendas todavía</div>
                    <div className="t-mute text-[13px] mb-5">Agregá las prendas que van a estar en este drop.</div>
                    {productsError && <div className="text-[12px] text-[var(--urgent)] mb-[14px]">{productsError}</div>}
                    <button onClick={() => { setEditando(undefined); setModalAbierto(true); }} className="btn btn-primary btn-sm">
                      <Icons.plus width={13} height={13}/> Agregar primera prenda
                    </button>
                  </div>
                )}

                {prendas.length > 0 && (
                  <>
                    <div className="new-drop-products-card card overflow-hidden mb-3">
                      <div className="new-drop-products-head mono grid px-4 py-[10px] border-b border-[var(--line)] text-[11px] text-[var(--ink-3)] uppercase tracking-[0.04em]" style={{ gridTemplateColumns: COL }}>
                        <div/><div>Prenda</div><div className="text-right">Cant.</div><div className="text-right">Precio</div><div/>
                      </div>
                      {prendas.map((p, i) => (
                        <div key={p.id} className={`new-drop-product-row grid px-4 py-[10px] items-center text-[13px]${i < prendas.length - 1 ? ' border-b border-[var(--line-2)]' : ''}`} style={{ gridTemplateColumns: COL }}>
                          <div className="new-drop-product-thumb w-9 h-9 rounded-md overflow-hidden shrink-0">
                            {p.fotos?.[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img loading="lazy" src={p.fotos?.[0]} alt="" className="w-full h-full object-cover block"/>
                            ) : (
                              <Ph tone={p.tone} radius={6}/>
                            )}
                          </div>
                          <div className="new-drop-product-main min-w-0">
                            <div className="font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{p.nombre}</div>
                            <div className="t-mute text-[11px] mt-[2px]">
                              {[p.marca, formatProductSizes(p), p.categoria].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <div className="new-drop-product-qty mono tnum font-bold text-right text-[13px]">{totalCantidad(p.cantidades_por_talla, p.tallas)}</div>
                          <div className="new-drop-product-price mono tnum font-bold text-right text-[13px]">{simbolo} {(Number(p.precio) * totalCantidad(p.cantidades_por_talla, p.tallas)).toLocaleString()}</div>
                          <div className="new-drop-product-actions flex gap-[2px] justify-end">
                            <button onClick={() => abrirEditar(p)} className="btn-ghost p-[5px]">
                              <Icons.edit width={13} height={13} className="text-[var(--ink-3)]"/>
                            </button>
                            <button onClick={() => eliminarPrenda(p.id)} className="btn-ghost p-[5px]">
                              <Icons.trash width={13} height={13} className="text-[var(--ink-3)]"/>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="new-drop-products-total flex justify-between items-center px-4 py-3 bg-white rounded-[10px] border border-[var(--line)]">
                      <span className="t-mute text-[13px]">{prendas.length} línea{prendas.length !== 1 ? 's' : ''} · {totalUnidades} unidad{totalUnidades !== 1 ? 'es' : ''} · valor total</span>
                      <span className="mono tnum text-[16px] font-bold">{simbolo} {totalValor.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Step 3: Revisar ── */}
            {step === 3 && (
              <div className="new-drop-card card p-0 overflow-hidden">
                <div className="p-5 border-b border-[var(--line)]">
                  <div className="text-[16px] font-semibold">Revisar y publicar</div>
                  <div className="t-mute text-[12px]">Confirmá los datos antes de publicar el drop.</div>
                </div>
                <div className="p-5 grid gap-[10px]">
                  {[
                    ['Nombre', form.name || '—'],
                    ['Apertura', `${form.date} ${form.time}`],
                    ['Duración', form.duration],
                    ['Prendas', `${prendas.length} líneas · ${totalUnidades} unidades`],
                    ['Valor total', formatCurrencyTienda(totalValor, simbolo)],
                  ].map(([k, v]) => (
                    <div key={k} className="new-drop-review-row flex justify-between text-[13px] py-2 border-b border-[var(--line-2)]">
                      <span className="t-mute">{k}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
                </div>
                {prendas.length > 0 && (
                  <div className="px-5 pb-5">
                    <div className="text-[13px] font-semibold mb-[10px]">Prendas ({prendas.length})</div>
                    <div className="grid gap-2">
                      {prendas.map(p => (
                        <div key={p.id} className="new-drop-review-product flex items-center gap-3 px-3 py-2 bg-[var(--surface-2)] rounded-lg">
                          <div className="w-8 h-8 rounded-md overflow-hidden shrink-0">
                            {p.fotos?.[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img loading="lazy" src={p.fotos?.[0]} alt="" className="w-full h-full object-cover block"/>
                            ) : (
                              <Ph tone={p.tone} radius={6}/>
                            )}
                          </div>
                          <div className="flex-1 text-[12px] min-w-0">
                            <div className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">{p.nombre}</div>
                            <div className="t-mute text-[11px]">
                              {[p.marca, formatProductSizes(p), p.categoria, `${totalCantidad(p.cantidades_por_talla, p.tallas)} ud.`].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <span className="mono tnum text-[12px] font-semibold shrink-0">{simbolo} {(Number(p.precio) * totalCantidad(p.cantidades_por_talla, p.tallas)).toLocaleString()}</span>
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
        <div className="new-drop-footer px-7 py-3 border-t border-[var(--line)] bg-white flex flex-col gap-2 shrink-0">
          {errPub && (
            <div className="px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded-lg text-[13px] text-[var(--urgent)]">
              {errPub}
            </div>
          )}
          <div className="new-drop-footer-actions flex justify-between">
            <button onClick={() => setStep(s => Math.max(0, s - 1))} className="btn btn-outline" disabled={step === 0 || publicando}>
              <Icons.arrow width={14} height={14} className="rotate-180" />
              Atrás
            </button>
            {step < 3 ? (
              <button onClick={handleNextStep} className="btn btn-primary" disabled={subiendoPortada}>
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
