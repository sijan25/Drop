'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';
import { Icons } from '@/components/shared/icons';
import { CountdownTimer } from '@/components/drops/countdown-timer';
import { Ph } from '@/components/shared/image-placeholder';
import { SizeSelector } from '@/components/shared/size-selector';
import { useDropViewerCount } from '@/hooks/use-drop-viewer-count';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/cloudinary/client';
import { formatCurrency } from '@/lib/config/platform';
import { useCountdown } from '@/hooks/use-countdown';
import { formatProductSizes, getProductTotalQuantity } from '@/lib/product-sizes';
import { useCatalogOptions } from '@/hooks/use-catalog-options';
import { TONES } from '@/lib/ui/tones';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

type EstadoPrenda = 'disponible' | 'apartada' | 'vendida' | 'remanente';

interface Drop {
  id: string;
  tienda_id: string;
  nombre: string;
  estado: string;
  inicia_at: string;
  cierra_at: string | null;
  vendidas_count: number;
  viewers_count: number;
  recaudado_total: number;
  foto_portada_url: string | null;
  descripcion: string | null;
}

interface Prenda {
  id: string;
  nombre: string;
  marca: string | null;
  talla: string | null;
  tallas: string[];
  cantidades_por_talla: Record<string, number>;
  cantidad: number;
  precio: number;
  estado: EstadoPrenda;
  fotos: string[];
}

interface PrendaForm {
  nombre: string;
  marca: string;
  talla: string;
  tallas: string[];
  cantidades_por_talla: Record<string, number>;
  cantidad: string;
  precio: string;
  categoria: string;
  descripcion: string;
}

const PRENDA_VACIA: PrendaForm = { nombre: '', marca: '', talla: '', tallas: [], cantidades_por_talla: {}, cantidad: '1', precio: '', categoria: '', descripcion: '' };

const BADGE: Record<string, string> = { disponible: 'badge-ok', apartada: 'badge-held', vendida: 'badge-sold', remanente: 'badge-rem' };
const LABEL: Record<string, string> = { disponible: 'Disponible', apartada: 'Apartada', vendida: 'Vendida', remanente: 'Remanente' };

function dinero(valor: number | null | undefined): string {
  return formatCurrency(valor ?? 0);
}

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return 'Pendiente';
  const d = new Date(iso);
  const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()];
  return `${d.getDate()} ${m} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function ModalAgregarPrenda({ dropId, tiendaId, onGuardado, onCerrar }: {
  dropId: string;
  tiendaId: string;
  onGuardado: (p: Prenda) => void;
  onCerrar: () => void;
}) {
  const [form, setForm] = useState<PrendaForm>({ ...PRENDA_VACIA });
  const [fotos, setFotos] = useState<string[]>([]);
  const [cloudinaryIds, setCloudinaryIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const fotoRef = useRef<HTMLInputElement>(null);
  const { categorias, tallas, tipoNegocio } = useCatalogOptions(tiendaId);
  const productoPlaceholder = tipoNegocio === 'zapatos' ? 'Tenis blancos' : 'Blusa floral';
  const tallaLabel = tipoNegocio === 'zapatos' ? 'Numeraciones' : 'Tallas';
  const totalPorTallas = form.tallas.reduce((sum, size) => sum + (form.cantidades_por_talla[size] ?? 0), 0);
  const set = (k: Exclude<keyof PrendaForm, 'tallas' | 'cantidades_por_talla'>, v: string) => setForm(f => ({ ...f, [k]: v }));

  function handleTallasChange(values: string[]) {
    setForm(prev => {
      const cantidades: Record<string, number> = {};
      values.forEach(size => {
        cantidades[size] = prev.cantidades_por_talla[size] ?? 1;
      });
      return { ...prev, tallas: values, talla: values[0] ?? '', cantidades_por_talla: cantidades };
    });
  }

  function handleQtyChange(size: string, qty: number) {
    setForm(prev => ({
      ...prev,
      cantidades_por_talla: { ...prev.cantidades_por_talla, [size]: Math.max(0, qty) },
    }));
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fotos.length >= 5) return;
    setUploading(true);
    setError('');
    try {
      const result = await uploadImage(file, { folder: 'fardodrops/prendas' });
      setFotos(f => [...f, result.url]);
      setCloudinaryIds(ids => [...ids, result.publicId]);
    } catch {
      setError('No se pudo subir la foto. Intentá de nuevo.');
    } finally {
      setUploading(false);
      if (fotoRef.current) fotoRef.current.value = '';
    }
  }

  function fail(msg: string) {
    setError(msg);
    toast.error(msg);
  }

  async function guardar() {
    if (!form.nombre.trim()) { fail('El nombre es requerido.'); return; }
    if (!form.precio || Number(form.precio) <= 0) { fail('Ingresá un precio válido.'); return; }
    const cantidadTotal = form.tallas.length > 0 ? totalPorTallas : Number(form.cantidad);
    if (!Number.isInteger(cantidadTotal) || cantidadTotal <= 0) {
      fail(form.tallas.length > 0
        ? 'Asigná al menos 1 unidad entre las tallas seleccionadas.'
        : 'Ingresá una cantidad válida.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.from('prendas').insert({
        tienda_id: tiendaId,
        drop_id: dropId,
        nombre: form.nombre.trim(),
        marca: form.marca.trim() || null,
        talla: form.tallas[0] ?? null,
        tallas: form.tallas,
        cantidades_por_talla: form.tallas.length > 0
          ? Object.fromEntries(form.tallas.map(size => [size, Math.max(0, form.cantidades_por_talla[size] ?? 0)]))
          : {},
        cantidad: cantidadTotal,
        precio: Number(form.precio),
        categoria: form.categoria || null,
        descripcion: form.descripcion.trim() || null,
        estado: 'disponible',
        fotos,
        cloudinary_ids: cloudinaryIds,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).select('id, nombre, marca, talla, tallas, cantidades_por_talla, cantidad, precio, estado, fotos').single();
      if (err || !data) throw new Error(err?.message ?? 'Error al guardar');
      onGuardado(data as Prenda);
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 16, boxShadow: '0 30px 80px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Agregar prenda</div>
          <button onClick={onCerrar} style={{ color: 'var(--ink-3)' }}><Icons.close width={16} height={16}/></button>
        </div>
        <div style={{ padding: '20px 22px', overflowY: 'auto', display: 'grid', gap: 14 }}>
          <div>
            <label className="label">Foto</label>
            <input ref={fotoRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFoto}/>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {fotos.map((url, i) => (
                <div key={i} style={{ position: 'relative', width: 64, height: 64 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, display: 'block' }}/>
                  <button onClick={() => setFotos(f => f.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, background: '#111', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>×</button>
                </div>
              ))}
              {fotos.length < 5 && (
                <div onClick={() => fotoRef.current?.click()} style={{ width: 64, height: 64, border: '1.5px dashed var(--line)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--surface-2)', flexDirection: 'column', gap: 4 }}>
                  {uploading ? <Icons.upload width={16} height={16} style={{ color: 'var(--ink-3)', opacity: 0.4 }}/> : <Icons.upload width={16} height={16} style={{ color: 'var(--ink-3)' }}/>}
                  <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>{uploading ? 'Subiendo…' : 'Foto'}</span>
                </div>
              )}
            </div>
          </div>
          <div className="drop-detail-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Nombre *</label>
              <input className="input" placeholder={productoPlaceholder} value={form.nombre} onChange={e => set('nombre', e.target.value)}/>
            </div>
            <div>
              <label className="label">Marca</label>
              <input className="input" placeholder="H&M, Zara…" value={form.marca} onChange={e => set('marca', e.target.value)}/>
            </div>
          </div>
          <div>
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                <option value="">Seleccionar…</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{tallaLabel} *</label>
            <SizeSelector
              options={tallas}
              selected={form.tallas}
              onChange={handleTallasChange}
              quantities={form.cantidades_por_talla}
              onQuantityChange={handleQtyChange}
              tipoNegocio={tipoNegocio}
              allowEmpty
            />
            <div className="t-mute" style={{ fontSize: 11, marginTop: 6 }}>
              {form.tallas.length > 0
                ? `Total actual: ${totalPorTallas} unidad${totalPorTallas === 1 ? '' : 'es'}.`
                : 'Si no lleva talla, usá la cantidad general.'}
            </div>
          </div>
          <div className="drop-detail-form-grid-price" style={{ display: 'grid', gridTemplateColumns: form.tallas.length > 0 ? '1fr' : '1fr 120px', gap: 12 }}>
            <div>
              <label className="label">Precio (L) *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 600, color: 'var(--ink-3)' }}>L</span>
                <input className="input mono tnum" style={{ paddingLeft: 28 }} placeholder="0.00" type="number" min="0" step="0.01" value={form.precio} onChange={e => set('precio', e.target.value)}/>
              </div>
            </div>
            {form.tallas.length === 0 && (
            <div>
              <label className="label">Cantidad *</label>
              <input className="input mono tnum" type="number" min="1" step="1" value={form.cantidad} onChange={e => set('cantidad', e.target.value)}/>
            </div>
            )}
          </div>
          <div>
            <label className="label">Descripción <span className="t-mute" style={{ fontWeight: 400 }}>(opcional)</span></label>
            <textarea className="input" style={{ height: 72, padding: 12, resize: 'none', fontSize: 13 }} placeholder="Color, estado, medidas…" value={form.descripcion} onChange={e => set('descripcion', e.target.value)}/>
          </div>
          {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: 'var(--urgent)' }}>{error}</div>}
        </div>
        <div className="drop-detail-modal-footer" style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onCerrar} className="btn btn-outline">Cancelar</button>
          <button onClick={guardar} className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Agregar prenda'}</button>
        </div>
      </div>
    </div>
  );
}

function toLocalDatetimeInput(iso: string | null) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ModalEditarTiempo({ drop, onGuardado, onCerrar }: {
  drop: Drop;
  onGuardado: (nuevoCierreAt: string) => void;
  onCerrar: () => void;
}) {
  const [valor, setValor] = useState(toLocalDatetimeInput(drop.cierra_at));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const minDatetime = toLocalDatetimeInput(new Date().toISOString());

  async function guardar() {
    const nueva = new Date(valor);
    if (isNaN(nueva.getTime()) || nueva <= new Date()) {
      setError('La nueva fecha debe ser en el futuro.');
      return;
    }
    setGuardando(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from('drops')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ cierra_at: nueva.toISOString() } as any)
        .eq('id', drop.id as never);
      if (err) throw new Error(err.message);
      onGuardado(nueva.toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 16, boxShadow: '0 30px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Cambiar cierre del drop</div>
          <button onClick={onCerrar} style={{ color: 'var(--ink-3)' }}><Icons.close width={16} height={16}/></button>
        </div>
        <div style={{ padding: '20px 22px', display: 'grid', gap: 14 }}>
          <div>
            <label className="label">Nueva fecha y hora de cierre</label>
            <input
              className="input"
              type="datetime-local"
              min={minDatetime}
              value={valor}
              onChange={e => setValor(e.target.value)}
            />
          </div>
          {error && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: 'var(--urgent)' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCerrar} className="btn btn-outline btn-sm">Cancelar</button>
          <button onClick={guardar} className="btn btn-primary btn-sm" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Anotacion {
  id: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  created_at: string | null;
}

export default function DropDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [drop, setDrop] = useState<Drop | null>(null);
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [anotaciones, setAnotaciones] = useState<Anotacion[]>([]);
  const [tab, setTab] = useState<'prendas' | 'suscriptores'>('prendas');
  const [loading, setLoading] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalTiempo, setModalTiempo] = useState(false);
  const [tiendaUsername, setTiendaUsername] = useState<string>('');

  useEffect(() => {
    async function cargar() {
      const supabase = createClient();
      const [dropRes, prendasRes, anotacionesRes] = await Promise.all([
        supabase.from('drops').select('*').eq('id', id as never).single(),
        supabase.from('prendas')
          .select('id, nombre, marca, talla, tallas, cantidades_por_talla, cantidad, precio, estado, fotos')
          .eq('drop_id', id as never)
          .order('created_at', { ascending: true }),
        supabase.from('anotaciones')
          .select('id, nombre, apellido, telefono, email, created_at')
          .eq('drop_id', id as never)
          .order('created_at', { ascending: true }),
      ]);
      if (dropRes.data) {
        const loadedDrop = dropRes.data as unknown as Drop;
        setDrop(loadedDrop);
        const { data: tienda } = await supabase
          .from('tiendas')
          .select('username')
          .eq('id', loadedDrop.tienda_id as never)
          .single();
        setTiendaUsername((tienda as { username: string } | null)?.username ?? '');
      }
      setPrendas((prendasRes.data ?? []) as Prenda[]);
      setAnotaciones((anotacionesRes.data ?? []) as Anotacion[]);
      setLoading(false);
    }
    cargar();
  }, [id]);

  async function cerrarDrop() {
    if (!drop) return;
    setCerrando(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('drops').update({ estado: 'cerrado' } as any).eq('id', drop.id as never);
    await migrarPrendasDisponibles(supabase, drop.id);
    setDrop(prev => prev ? { ...prev, estado: 'cerrado' } : prev);
    setPrendas(prev => prev.filter(p => p.estado !== 'disponible'));
    setCerrando(false);
    toast.success('Drop cerrado — prendas sin vender pasadas a inventario');
  }

  async function activarDrop() {
    if (!drop) return;
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('drops').update({ estado: 'activo', inicia_at: new Date().toISOString() } as any).eq('id', drop.id as never);
    setDrop(prev => prev ? { ...prev, estado: 'activo', inicia_at: new Date().toISOString() } : prev);
    toast.success('¡Drop activado! Ya está en vivo.');
  }

  async function cambiarEstadoPrenda(prendaId: string, nuevoEstado: EstadoPrenda) {
    const actual = prendas.find(p => p.id === prendaId);
    if (actual?.estado === 'vendida' && nuevoEstado === 'disponible') {
      toast.error('Esta prenda ya está vendida y no se puede modificar.');
      return;
    }
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('prendas').update({ estado: nuevoEstado } as any).eq('id', prendaId as never);
    setPrendas(prev => prev.map(p => p.id === prendaId ? { ...p, estado: nuevoEstado } : p));
  }

  async function eliminarPrenda(prendaId: string) {
    if (!confirm('¿Eliminar esta prenda del drop?')) return;
    const supabase = createClient();
    await supabase.from('prendas').delete().eq('id', prendaId as never);
    setPrendas(prev => prev.filter(p => p.id !== prendaId));
  }

  async function migrarPrendasDisponibles(supabase: ReturnType<typeof createClient>, dropId: string) {
    return supabase
      .from('prendas')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ estado: 'disponible', remanente_hasta: null, drop_id: null } as any)
      .eq('drop_id', dropId as never)
      .eq('estado', 'disponible' as never);
  }

  async function migrarRemanentes() {
    if (!drop) return;
    setMigrando(true);
    const supabase = createClient();
    const { error } = await migrarPrendasDisponibles(supabase, drop.id);

    if (error) {
      toast.error(error.message);
    } else {
      setPrendas(prev => prev.filter(p => p.estado !== 'disponible'));
      toast.success('Prendas sin vender migradas a inventario');
    }
    setMigrando(false);
  }

  function copiarWhatsApp() {
    const nums = anotaciones
      .map(a => a.telefono?.trim())
      .filter(Boolean)
      .join('\n');
    if (!nums) { toast.error('No hay números registrados.'); return; }
    navigator.clipboard.writeText(nums).then(() => toast.success('Números copiados al portapapeles'));
  }

  function exportarSuscriptoresCSV() {
    if (!drop) return;
    const header = ['Nombre', 'Apellido', 'Teléfono', 'Email', 'Fecha'];
    const rows = anotaciones.map(a => [
      a.nombre ?? '',
      a.apellido ?? '',
      a.telefono ?? '',
      a.email ?? '',
      a.created_at ? new Date(a.created_at).toLocaleString('es-HN') : '',
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v.replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suscriptores-${drop.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarResumen() {
    if (!drop) return;
    const sinVenderActual = prendas
      .filter(p => p.estado !== 'vendida' && p.estado !== 'apartada')
      .reduce((s, p) => s + getProductTotalQuantity(p), 0);
    const valorApartadoActual = prendas
      .filter(p => p.estado === 'apartada')
      .reduce((s, p) => s + (p.precio * getProductTotalQuantity(p)), 0);
    const rows = [
      ['Drop', drop.nombre],
      ['Estado', drop.estado],
      ['Inicio', fmtFecha(drop.inicia_at)],
      ['Cierre', fmtFecha(drop.cierra_at)],
      ['Total recaudado', String(drop.recaudado_total ?? 0)],
      ['Pendiente apartadas', String(valorApartadoActual)],
      ['Prendas totales', String(prendas.length)],
      ['Vendidas', String(vendidas || drop.vendidas_count || 0)],
      ['Apartadas', String(apartadas)],
      ['Sin vender', String(sinVenderActual)],
      ['Viewers unicas', String(drop.viewers_count ?? 0)],
    ];
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumen-${drop.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalUnidades = prendas.reduce((s, p) => s + getProductTotalQuantity(p), 0);
  const vendidas = prendas.filter(p => p.estado === 'vendida').reduce((s, p) => s + getProductTotalQuantity(p), 0);
  const apartadas = prendas.filter(p => p.estado === 'apartada').reduce((s, p) => s + getProductTotalQuantity(p), 0);
  const sinVender = prendas.filter(p => p.estado !== 'vendida' && p.estado !== 'apartada').reduce((s, p) => s + getProductTotalQuantity(p), 0);
  const tienePrendasParaMigrar = prendas.some(p => p.estado === 'disponible');
  const valorApartado = prendas.filter(p => p.estado === 'apartada').reduce((s, p) => s + (p.precio * getProductTotalQuantity(p)), 0);
  const liveViewerCount = useDropViewerCount(drop?.id ?? null, {
    initialCount: drop?.viewers_count ?? 0,
    enabled: drop?.estado === 'activo',
    trackSelf: false,
  });
  const target = drop?.cierra_at ? new Date(drop.cierra_at).getTime() : null;

  const autoClosedRef = useRef(false);
  const { done: countdownDone } = useCountdown(target ?? 0);
  useEffect(() => {
    if (target && countdownDone && drop?.estado === 'activo' && !autoClosedRef.current) {
      autoClosedRef.current = true;
      cerrarDrop();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, countdownDone, drop?.estado]);

  const accentColor = drop?.estado === 'activo' ? 'var(--urgent)' : drop?.estado === 'programado' ? '#3b82f6' : 'var(--line)';

  return (
    <>
      <div className="drop-detail-shell" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Barra de estado */}
        {!loading && drop && (
          <div style={{ height: 3, background: accentColor, flexShrink: 0, opacity: drop.estado === 'cerrado' ? 0.3 : 1 }}/>
        )}
        <div className="drop-detail-header" style={{ padding: '18px 28px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexShrink: 0 }}>
          <div className="drop-detail-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/drops')} className="btn-ghost" style={{ color: 'var(--ink-3)' }}>
              <Icons.arrow width={16} height={16} style={{ transform: 'rotate(180deg)' }}/>
            </button>
            <div>
              <div className="drop-detail-title-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>
                  {loading ? 'Cargando…' : (drop?.nombre ?? 'Drop no encontrado')}
                </div>
                {!loading && drop && (
                  drop.estado === 'activo' ? (
                    <span className="badge badge-live" style={{ fontSize: 12 }}><span className="dot"/>En vivo</span>
                  ) : drop.estado === 'programado' ? (
                    <span className="badge" style={{ fontSize: 12, background: '#eff6ff', color: '#3b82f6', borderColor: '#bfdbfe' }}>Programado</span>
                  ) : (
                    <span className="badge" style={{ fontSize: 12 }}>Cerrado</span>
                  )
                )}
              </div>
              <div className="t-mute" style={{ fontSize: 13, marginTop: 3 }}>
                {!loading && drop && (
                  <>
                    {prendas.length} prendas · {totalUnidades} unidades
                    {drop.estado === 'activo' && target && (
                      <> · Cierra en <CountdownTimer target={target} size="sm"/></>
                    )}
                    {drop.estado === 'programado' && (
                      <> · Inicia en <CountdownTimer target={new Date(drop.inicia_at).getTime()} size="sm"/></>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="drop-detail-header-actions" style={{ display: 'flex', gap: 8 }}>
            <button
              className="drop-detail-public-btn btn btn-outline btn-sm"
              onClick={() => drop && tiendaUsername && router.push(`/${tiendaUsername}/drop/${drop.id}`)}
              disabled={!drop || !tiendaUsername}
            >
              <Icons.eye width={13} height={13}/><span>Vista pública</span>
            </button>
            {drop?.estado === 'cerrado' && (
              <button className="drop-detail-export-btn btn btn-outline btn-sm" onClick={exportarResumen}>
                <span>Exportar resumen</span>
              </button>
            )}
            {!loading && drop && drop.estado !== 'cerrado' && (
              <button className="btn btn-primary btn-sm" onClick={() => setModalAbierto(true)}>
                <Icons.plus width={13} height={13}/> Agregar prenda
              </button>
            )}
            {drop?.estado === 'programado' && (
              <button className="btn btn-outline btn-sm" onClick={activarDrop}>
                Activar ahora
              </button>
            )}
            {drop?.estado === 'activo' && (
              <button className="btn btn-outline btn-sm" onClick={() => setModalTiempo(true)}>
                <Icons.clock width={13} height={13}/> Extender tiempo
              </button>
            )}
            {drop?.estado === 'activo' && (
              <button className="btn btn-danger btn-sm" onClick={cerrarDrop} disabled={cerrando}>
                {cerrando ? 'Cerrando…' : 'Cerrar drop'}
              </button>
            )}
          </div>
        </div>

        <div className="drop-detail-content" style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 28px' }}>
          {!loading && drop?.estado === 'cerrado' && (
            <div className="drop-detail-closed-card card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ textAlign: 'center', padding: '10px 0 22px', borderBottom: '1px solid var(--line)' }}>
                <div className="mono t-mute" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0 }}>Total recaudado</div>
                <div className="tnum" style={{ fontSize: 56, lineHeight: 1.05, fontWeight: 800, marginTop: 8 }}>
                  {dinero(drop.recaudado_total)}
                </div>
                {valorApartado > 0 && (
                  <div className="t-mute" style={{ fontSize: 14, marginTop: 8 }}>
                    + {dinero(valorApartado)} pendientes de apartados
                  </div>
                )}
              </div>

              <div className="drop-detail-closed-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '20px 0', borderBottom: '1px solid var(--line)' }}>
                {[
                  ['Vendidas', vendidas || (drop.vendidas_count ?? 0)],
                  ['Apartadas', apartadas],
                  ['Sin vender', sinVender],
                  ['Viewers únicas', drop.viewers_count ?? 0],
                ].map(([label, value]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div className="tnum" style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
                    <div className="t-mute" style={{ fontSize: 12, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>

              <div className="drop-detail-closed-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, paddingTop: 20 }}>
                <button onClick={() => router.push('/pedidos')} className="btn btn-outline" style={{ height: 52, justifyContent: 'space-between', padding: '0 18px' }}>
                  <span><Icons.bag width={14} height={14}/> Ver pedidos</span>
                  <Icons.arrow width={14} height={14}/>
                </button>
                <button onClick={() => router.push('/comprobantes')} className="btn btn-outline" style={{ height: 52, justifyContent: 'space-between', padding: '0 18px' }}>
                  <span><Icons.inbox width={14} height={14}/> Verificar</span>
                  <Icons.arrow width={14} height={14}/>
                </button>
                {tienePrendasParaMigrar && (
                  <button
                    onClick={migrarRemanentes}
                    className="btn btn-primary"
                    style={{ height: 52, justifyContent: 'space-between', padding: '0 18px' }}
                    disabled={migrando}
                  >
                    <span><Icons.box width={14} height={14}/> <span className="drop-detail-migrate-label">{migrando ? 'Migrando...' : 'Migrar a inventario'}</span></span>
                    <Icons.arrow width={14} height={14}/>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="drop-detail-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Viendo ahora', value: drop?.estado === 'activo' ? liveViewerCount : (drop?.viewers_count ?? 0), icon: Icons.eye },
              { label: 'Vendidas', value: vendidas || (drop?.vendidas_count ?? 0), icon: Icons.bag },
              { label: 'Apartadas', value: apartadas, icon: Icons.inbox },
              { label: 'Recaudado', value: formatCurrency(drop?.recaudado_total ?? 0), icon: Icons.card },
            ].map(s => {
              const Ic = s.icon;
              return (
                <div key={s.label} style={{ padding: '14px 18px', background: '#fff', border: '1px solid var(--line)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ic width={15} height={15}/>
                  </div>
                  <div>
                    <div className="mono t-mute" style={{ fontSize: 10, textTransform: 'uppercase' }}>{s.label}</div>
                    <div className="tnum" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>{s.value}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tab switcher */}
          <div className="drop-tabs-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
              {(['prendas', 'suscriptores'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '5px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
                    background: tab === t ? '#fff' : 'transparent',
                    color: tab === t ? 'var(--ink)' : 'var(--ink-3)',
                    boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {t === 'prendas' ? `Prendas (${prendas.length})` : `Suscriptores (${anotaciones.length})`}
                </button>
              ))}
            </div>
            {tab === 'prendas' && !loading && drop && drop.estado !== 'cerrado' && (
              <button className="btn btn-outline btn-sm" onClick={() => setModalAbierto(true)}>
                <Icons.plus width={12} height={12}/> Agregar
              </button>
            )}
            {tab === 'suscriptores' && anotaciones.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={copiarWhatsApp}>Copiar números WhatsApp</button>
                <button className="btn btn-outline btn-sm" onClick={exportarSuscriptoresCSV}>Exportar CSV</button>
              </div>
            )}
          </div>

          {tab === 'prendas' && (
          <div className="drop-detail-products-card card" style={{ overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Cargando prendas…</div>
            ) : prendas.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Icons.grid width={18} height={18} style={{ color: 'var(--ink-3)' }}/>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Sin prendas todavía</div>
                <div className="t-mute" style={{ fontSize: 12, marginBottom: 16 }}>Agregá las prendas que van a estar en este drop.</div>
                {drop?.estado !== 'cerrado' && (
                  <button className="btn btn-primary btn-sm" onClick={() => setModalAbierto(true)}>
                    <Icons.plus width={13} height={13}/> Agregar primera prenda
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="drop-detail-products-head mono" style={{ display: 'grid', gridTemplateColumns: '56px 1.5fr 1fr 80px 70px 120px 36px', padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
                  <div/><div>Prenda</div><div>Marca / Talla</div><div>Precio</div><div>Cant.</div><div>Estado</div><div/>
                </div>
                {prendas.map((p, i) => (
                  <div key={p.id} className="drop-detail-product-row" style={{ display: 'grid', gridTemplateColumns: '56px 1.5fr 1fr 80px 70px 120px 36px', padding: '10px 16px', borderBottom: i < prendas.length - 1 ? '1px solid var(--line-2)' : 'none', alignItems: 'center', fontSize: 12 }}>
                    <div className="drop-detail-product-thumb" style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                      {p.fotos?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img loading="lazy" src={p.fotos[0]} alt="" style={{ width: 40, height: 40, objectFit: 'cover', display: 'block' }}/>
                      ) : (
                        <Ph tone={TONES[i % TONES.length]} radius={6}/>
                      )}
                    </div>
                    <div className="drop-detail-product-name" style={{ fontWeight: 500 }}>{p.nombre}</div>
                    <div className="drop-detail-product-meta t-mute">{[p.marca, formatProductSizes(p)].filter(Boolean).join(' · ')}</div>
                    <div className="drop-detail-product-price mono tnum" style={{ fontWeight: 500 }}>L {p.precio}</div>
                    <div className="drop-detail-product-qty mono tnum" style={{ fontWeight: 600 }}>{getProductTotalQuantity(p)}</div>
                    <div className="drop-detail-product-status"><span className={`badge ${BADGE[p.estado] ?? ''}`}>{LABEL[p.estado] ?? p.estado}</span></div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="drop-detail-product-menu btn-ghost" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icons.more width={13} height={13} style={{ color: 'var(--ink-3)' }}/>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {p.estado !== 'disponible' && p.estado !== 'vendida' && (
                          <DropdownMenuItem onSelect={() => cambiarEstadoPrenda(p.id, 'disponible')}>
                            <Icons.check width={14} height={14}/> Marcar disponible
                          </DropdownMenuItem>
                        )}
                        {p.estado === 'vendida' && (
                          <DropdownMenuItem disabled style={{ opacity: 0.45, cursor: 'not-allowed' }}>
                            <Icons.check width={14} height={14}/> Vendida · no modificable
                          </DropdownMenuItem>
                        )}
                        {p.estado !== 'vendida' && p.estado !== 'apartada' && (
                          <DropdownMenuItem onSelect={() => cambiarEstadoPrenda(p.id, 'apartada')}>
                            <Icons.clock width={14} height={14}/> Marcar apartada
                          </DropdownMenuItem>
                        )}
                        {p.estado !== 'vendida' && (
                          <DropdownMenuItem onSelect={() => cambiarEstadoPrenda(p.id, 'vendida')}>
                            <Icons.bag width={14} height={14}/> Marcar vendida
                          </DropdownMenuItem>
                        )}
                        {p.estado !== 'vendida' && p.estado !== 'remanente' && (
                          <DropdownMenuItem onSelect={() => cambiarEstadoPrenda(p.id, 'remanente')}>
                            <Icons.box width={14} height={14}/> Marcar remanente
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem variant="destructive" onSelect={() => eliminarPrenda(p.id)}>
                          <Icons.trash width={14} height={14}/> Eliminar prenda
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </>
            )}
          </div>
          )}

          {tab === 'suscriptores' && (
          <div className="drop-subs-card card" style={{ overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Cargando…</div>
            ) : anotaciones.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Sin suscriptores todavía</div>
                <div className="t-mute" style={{ fontSize: 12 }}>Cuando alguien se anote al drop aparecerá aquí.</div>
              </div>
            ) : (
              <>
                <div className="drop-subs-head mono" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr 120px', padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
                  <div>Nombre</div><div>Teléfono</div><div>Email</div><div>Fecha</div>
                </div>
                {anotaciones.map((a, i) => (
                  <div key={a.id} className="drop-subs-row" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr 120px', padding: '10px 16px', borderBottom: i < anotaciones.length - 1 ? '1px solid var(--line-2)' : 'none', alignItems: 'center', fontSize: 13 }}>
                    <div className="drop-subs-name" style={{ fontWeight: 500 }}>{[a.nombre, a.apellido].filter(Boolean).join(' ') || '—'}</div>
                    <div className="drop-subs-phone mono t-mute">{a.telefono || '—'}</div>
                    <div className="drop-subs-email t-mute" style={{ fontSize: 12 }}>{a.email || '—'}</div>
                    <div className="drop-subs-date mono t-mute" style={{ fontSize: 11 }}>
                      {a.created_at ? new Date(a.created_at).toLocaleDateString('es-HN', { day: '2-digit', month: 'short' }) : '—'}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
          )}
        </div>
      </div>

      {modalAbierto && drop && (
        <ModalAgregarPrenda
          dropId={drop.id}
          tiendaId={drop.tienda_id}
          onGuardado={p => { setPrendas(prev => [...prev, p]); setModalAbierto(false); toast.success('Prenda agregada'); }}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
      {modalTiempo && drop && (
        <ModalEditarTiempo
          drop={drop}
          onGuardado={nuevoCierreAt => {
            setDrop(prev => prev ? { ...prev, cierra_at: nuevoCierreAt } : prev);
            setModalTiempo(false);
            toast.success('Tiempo extendido');
          }}
          onCerrar={() => setModalTiempo(false)}
        />
      )}
    </>
  );
}
