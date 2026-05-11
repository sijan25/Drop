'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/shared/icons';
import { ConfirmModal } from '@/components/shared/confirm-modal';
import { SizeSelector } from '@/components/shared/size-selector';
import { createClient } from '@/lib/supabase/client';
import { uploadImage, deleteCloudinaryImages } from '@/lib/cloudinary/client';
import {
  formatProductSizes,
  getProductSizeQuantities,
  getProductTotalQuantity,
  normalizeProductSizes,
} from '@/lib/product-sizes';
import { useCatalogOptions } from '@/hooks/use-catalog-options';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

/* ─── Tipos ─────────────────────────────────────────────── */
type EstadoPrenda = 'disponible' | 'apartada' | 'vendida' | 'remanente';

interface Drop { id: string; nombre: string; }
interface Prenda {
  id: string;
  nombre: string;
  descripcion: string | null;
  cantidad: number;
  cantidades_por_talla: Record<string, number>;
  precio: number;
  talla: string | null;
  tallas: string[];
  marca: string | null;
  categoria: string | null;
  fotos: string[];
  cloudinary_ids?: string[];
  estado: EstadoPrenda;
  drop_id: string | null;
  drops: { nombre: string } | null;
  created_at: string;
}

const FILTROS = ['Todas', 'Disponibles', 'Apartadas', 'Vendidas', 'Remanentes'];
const ESTADO_MAP: Record<EstadoPrenda, { label: string; className: string }> = {
  disponible: { label: 'Disponible', className: 'text-[#065f46] bg-[#ecfdf5] border border-[#a7f3d0]' },
  apartada: { label: 'Apartada', className: 'text-[#92400e] bg-[#fffbeb] border border-[#fde68a]' },
  vendida: { label: 'Vendida', className: 'text-white bg-[#111] border-0' },
  remanente: { label: 'Remanente 48h', className: 'text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe]' },
};

function Badge({ estado }: { estado: EstadoPrenda }) {
  const { label, className } = ESTADO_MAP[estado];
  return (
    <span className={`${className} py-[3px] px-2 rounded-md text-[11px] font-medium whitespace-nowrap`}>
      {label}
    </span>
  );
}

/* ─── Modal compartido (agregar / editar) ────────────────── */
interface ModalProps {
  tiendaId: string;
  drops: Drop[];
  prenda?: Prenda;
  onClose: () => void;
  onSaved: () => void;
}

function ModalPrenda({ tiendaId, drops, prenda, onClose, onSaved }: ModalProps) {
  const editando = !!prenda;
  const tallasIniciales = normalizeProductSizes([...(prenda?.tallas ?? []), prenda?.talla]);
  const cantidadesIniciales = prenda ? getProductSizeQuantities(prenda) : {};
  const [nombre, setNombre] = useState(prenda?.nombre ?? '');
  const [descripcion, setDesc] = useState(prenda?.descripcion ?? '');
  const [marca, setMarca] = useState(prenda?.marca ?? '');
  const [precio, setPrecio] = useState(prenda?.precio?.toString() ?? '');
  const [cantidadGeneral, setCantidadGeneral] = useState(
    tallasIniciales.length === 0 ? (prenda?.cantidad?.toString() ?? '1') : ''
  );
  const [tallasSeleccionadas, setTallasSeleccionadas] = useState(() => tallasIniciales);
  const [cantidadesPorTalla, setCantidadesPorTalla] = useState<Record<string, number>>(() => (
    Object.fromEntries(tallasIniciales.map(size => [size, cantidadesIniciales[size] ?? 1]))
  ));
  const [categoria, setCat] = useState(prenda?.categoria ?? '');
  const [dropId, setDropId] = useState(prenda?.drop_id ?? '');
  const [estado, setEstado] = useState<EstadoPrenda>(prenda?.estado ?? 'disponible');
  const [fotos, setFotos] = useState<string[]>(prenda?.fotos ?? []);
  const [cloudinaryIds, setCloudinaryIds] = useState<string[]>(prenda?.cloudinary_ids ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { categorias, tallas, tipoNegocio } = useCatalogOptions(tiendaId);
  const tallaLabel = tipoNegocio === 'zapatos' ? 'Numeraciones' : 'Tallas';
  const tallaHint = tipoNegocio === 'zapatos'
    ? 'Podés seleccionar una o varias numeraciones para mostrar en la tienda.'
    : 'Podés seleccionar una o varias tallas para mostrar en la tienda.';
  const totalPorTallas = tallasSeleccionadas.reduce((sum, size) => sum + (cantidadesPorTalla[size] ?? 0), 0);

  const mensajeGuardar = (message: string) => {
    if (message.includes('schema cache') || message.includes("'cantidad' column") || message.includes("'cantidades_por_talla'")) {
      return 'Falta aplicar la migración de inventario por talla en Supabase. Ejecutala y volvé a intentar.';
    }
    return `Error al guardar: ${message}`;
  };

  function handleTallasChange(values: string[]) {
    setTallasSeleccionadas(values);
    setCantidadesPorTalla(prev => {
      const next: Record<string, number> = {};
      values.forEach(size => { next[size] = prev[size] ?? 1; });
      return next;
    });
  }

  function handleQtyChange(size: string, qty: number) {
    setCantidadesPorTalla(prev => ({ ...prev, [size]: Math.max(0, qty) }));
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || fotos.length >= 5) return;
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
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function removeFoto(index: number) {
    setFotos(f => f.filter((_, j) => j !== index));
    setCloudinaryIds(ids => ids.filter((_, j) => j !== index));
  }

  async function handleGuardar() {
    if (!nombre.trim() || !precio) { setError('Nombre y precio son obligatorios.'); return; }
    const cantidadTotal = tallasSeleccionadas.length > 0 ? totalPorTallas : Number(cantidadGeneral);
    if (!Number.isInteger(cantidadTotal) || cantidadTotal <= 0) {
      setError(tallasSeleccionadas.length > 0
        ? 'Asigná al menos 1 unidad entre las tallas seleccionadas.'
        : 'Ingresá una cantidad válida.');
      return;
    }
    setSaving(true);
    setError('');
    const supabase = createClient();
    const payload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      marca: marca.trim() || null,
      precio: parseFloat(precio),
      cantidad: cantidadTotal,
      cantidades_por_talla: tallasSeleccionadas.length > 0
        ? Object.fromEntries(tallasSeleccionadas.map(size => [size, Math.max(0, cantidadesPorTalla[size] ?? 0)]))
        : {},
      talla: tallasSeleccionadas[0] ?? null,
      tallas: tallasSeleccionadas,
      categoria: categoria || null,
      drop_id: dropId || null,
      estado,
      fotos,
      cloudinary_ids: cloudinaryIds,
    };
    if (editando) {
      const { error: updErr } = await supabase.from('prendas').update(payload as any).eq('id', prenda!.id as never);
      if (updErr) { setError(mensajeGuardar(updErr.message)); setSaving(false); return; }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('No autenticado'); setSaving(false); return; }
      const { data: t } = await supabase.from('tiendas').select('id').eq('user_id', user.id as never).single();
      if (!t) { setError('Tienda no encontrada'); setSaving(false); return; }
      const tiendaData = t as { id: string };
      const { error: insErr } = await supabase.from('prendas').insert({ ...payload, tienda_id: tiendaData.id } as any);
      if (insErr) { setError(mensajeGuardar(insErr.message)); setSaving(false); return; }
    }
    onSaved();
  }

  return (
    <div className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="inventory-modal-panel bg-white rounded-2xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto shadow-[0_24px_64px_rgba(0,0,0,0.18)]">
        <div className="px-6 pt-5 pb-4 border-b border-[var(--line)] flex items-center justify-between">
          <div className="text-[16px] font-semibold">{editando ? 'Editar prenda' : 'Agregar prenda'}</div>
          <button onClick={onClose} className="text-[var(--ink-3)] flex">
            <Icons.close width={18} height={18} />
          </button>
        </div>

        <div className="inventory-modal-body px-6 py-5 grid gap-4">
          {/* Fotos */}
          <div>
            <label className="label">Fotos</label>
            <div className="flex gap-2 flex-wrap">
              {fotos.map((url, i) => (
                <div key={i} className="w-[72px] h-[72px] rounded-lg overflow-hidden border border-[var(--line)] relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeFoto(i)}
                    className="absolute top-[2px] right-[2px] bg-[rgba(0,0,0,0.55)] rounded text-white w-[18px] h-[18px] flex items-center justify-center text-[10px] border-0 cursor-pointer">
                    ×
                  </button>
                </div>
              ))}
              {fotos.length < 5 && (
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className={`w-[72px] h-[72px] rounded-lg border-[1.5px] border-dashed border-[var(--line)] flex flex-col items-center justify-center gap-1 text-[var(--ink-3)] text-[10px] bg-[var(--surface-2)] ${uploading ? 'cursor-default opacity-70' : 'cursor-pointer'}`}>
                  {uploading ? <span className="text-[10px]">Subiendo…</span> : <><Icons.plus width={16} height={16} /><span>Foto</span></>}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFoto} />
            <div className="t-mute text-[11px] mt-1">{fotos.length}/5 fotos · Las fotos se suben a Cloudinary automáticamente</div>
          </div>

          {/* Nombre + Marca */}
          <div className="inventory-modal-grid-2 grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre <span className="text-[var(--urgent)]">*</span></label>
              <input className="input" placeholder="Ej. Blusa floral" value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div>
              <label className="label">Marca</label>
              <input className="input" placeholder="Ej. H&M, Zara…" value={marca} onChange={e => setMarca(e.target.value)} />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-y font-[inherit] text-[13px]" rows={2} placeholder="Estado, detalles, material…" value={descripcion}
              onChange={e => setDesc(e.target.value)} />
          </div>

          {/* Precio + cantidad */}
          <div className="inventory-modal-price-grid grid gap-3" style={{ gridTemplateColumns: tallasSeleccionadas.length > 0 ? '1fr' : '1fr 120px' }}>
            <div>
              <label className="label">Precio (L) <span className="text-[var(--urgent)]">*</span></label>
              <input className="input" type="number" min="0" step="0.01" placeholder="0.00"
                value={precio} onChange={e => setPrecio(e.target.value)} />
            </div>
            {tallasSeleccionadas.length === 0 && (
              <div>
                <label className="label">Cantidad <span className="text-[var(--urgent)]">*</span></label>
                <input className="input mono tnum" type="number" min="1" step="1"
                  value={cantidadGeneral} onChange={e => setCantidadGeneral(e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <label className="label">{tallaLabel}</label>
            <SizeSelector
              options={tallas}
              selected={tallasSeleccionadas}
              onChange={handleTallasChange}
              quantities={cantidadesPorTalla}
              onQuantityChange={handleQtyChange}
              tipoNegocio={tipoNegocio}
              allowEmpty
            />
            <div className="t-mute text-[11px] mt-[6px]">
              {tallasSeleccionadas.length > 0
                ? `${tallaHint} Total actual: ${totalPorTallas} unidad${totalPorTallas === 1 ? '' : 'es'}.`
                : tallaHint}
            </div>
          </div>

          {/* Categoría + Estado */}
          <div className="inventory-modal-grid-2 grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoría</label>
              <select className="input cursor-pointer" value={categoria} onChange={e => setCat(e.target.value)}>
                <option value="">— Sin categoría —</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input cursor-pointer" value={estado} onChange={e => setEstado(e.target.value as EstadoPrenda)}>
                <option value="disponible">Disponible</option>
                <option value="apartada">Apartada</option>
                <option value="vendida">Vendida</option>
                <option value="remanente">Remanente 48h</option>
              </select>
            </div>
          </div>

          {/* Drop */}
          <div>
            <label className="label">Asignar a Drop (opcional)</label>
            <select className="input cursor-pointer" value={dropId} onChange={e => setDropId(e.target.value)}>
              <option value="">— Sin drop —</option>
              {drops.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>

          {error && <div className="text-[13px] text-[var(--urgent)] px-3 py-2 bg-[#fef2f2] rounded-lg">{error}</div>}
        </div>

        <div className="inventory-modal-footer px-6 py-[14px] border-t border-[var(--line)] flex gap-2 justify-end">
          <button onClick={onClose} className="btn btn-outline btn-sm">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving || uploading} className={`btn btn-primary btn-sm${saving || uploading ? ' opacity-60' : ''}`}>
            {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar prenda'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Página principal ───────────────────────────────────── */
export default function InventarioPage() {
  const [tiendaId, setTiendaId] = useState<string | null>(null);
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('Todas');
  const [filtroCategoria, setFiltroCat] = useState<string | null>(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Prenda | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  async function cargar(tid: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from('prendas')
      .select('id, nombre, descripcion, cantidad, cantidades_por_talla, precio, talla, tallas, marca, categoria, fotos, cloudinary_ids, estado, drop_id, created_at, drops(nombre)')
      .eq('tienda_id', tid as never)
      .order('created_at', { ascending: false });
    setPrendas((data as unknown as Prenda[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: t } = await supabase.from('tiendas').select('id').eq('user_id', user.id as never).single();
      if (!t) return;
      const tiendaData = t as { id: string };
      setTiendaId(tiendaData.id);
      const { data: dropsData } = await supabase
        .from('drops').select('id, nombre').eq('tienda_id', tiendaData.id as never).order('inicia_at', { ascending: false });
      setDrops(dropsData ?? []);
      await cargar(tiendaData.id);
    }
    init();
  }, []);

  async function eliminarPrenda(id: string) {
    const prenda = prendas.find(p => p.id === id);
    const supabase = createClient();
    const { error } = await supabase.from('prendas').delete().eq('id', id as never);
    if (error) { toast.error('No se pudo eliminar la prenda.'); return; }
    // Limpiar imágenes de Cloudinary en background
    if (prenda?.cloudinary_ids?.length) {
      void deleteCloudinaryImages(prenda.cloudinary_ids);
    }
    setPrendas(prev => prev.filter(p => p.id !== id));
    toast.success('Prenda eliminada');
  }

  async function cambiarEstado(id: string, estado: EstadoPrenda) {
    const actual = prendas.find(p => p.id === id);
    if (actual?.estado === 'vendida') {
      toast.error('Esta prenda ya está vendida y no se puede modificar.');
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('prendas').update({ estado } as any).eq('id', id as never);
    if (error) { toast.error('No se pudo actualizar el estado.'); return; }
    setPrendas(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
    toast.success(`Marcada como ${ESTADO_MAP[estado].label.toLowerCase()}`);
  }

  const categoriasDisponibles = [...new Set(prendas.map(p => p.categoria).filter(Boolean) as string[])].sort();

  const filtradas = prendas.filter(p => {
    const matchFiltro =
      filtro === 'Todas' ? true :
      filtro === 'Disponibles' ? p.estado === 'disponible' :
      filtro === 'Apartadas' ? p.estado === 'apartada' :
      filtro === 'Vendidas' ? p.estado === 'vendida' :
      filtro === 'Remanentes' ? p.estado === 'remanente' : true;
    const matchCat = !filtroCategoria || p.categoria === filtroCategoria;
    const q = busqueda.toLowerCase();
    const tallasTexto = formatProductSizes(p)?.toLowerCase() ?? '';
    const matchBusqueda = !q || p.nombre.toLowerCase().includes(q) || (p.categoria ?? '').toLowerCase().includes(q) || tallasTexto.includes(q);
    return matchFiltro && matchCat && matchBusqueda;
  });

  const unidadesDisponibles = prendas
    .filter(p => p.estado === 'disponible' || p.estado === 'remanente')
    .reduce((sum, p) => sum + getProductTotalQuantity(p), 0);

  return (
    <div className="inventory-shell h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="inventory-header px-7 pt-5 pb-4 border-b border-[var(--line)] flex items-end justify-between gap-5 shrink-0">
        <div>
          <div className="text-[20px] font-semibold tracking-[-0.015em]">Inventario</div>
          <div className="t-mute text-[13px] mt-[3px]">
            {loading ? 'Cargando…' : `${prendas.length} prendas · ${unidadesDisponibles} unidades disponibles`}
          </div>
        </div>
        <div className="inventory-header-actions flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>
            <Icons.plus width={13} height={13} /> Agregar prenda
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="inventory-toolbar px-7 py-3 border-b border-[var(--line)] bg-white flex gap-2 items-center shrink-0 relative z-10">
        <div className="inventory-search relative flex-1 max-w-[320px]">
          <Icons.search width={14} height={14} className="absolute left-3 top-[11px] text-[var(--ink-3)]" />
          <input className="input pl-[34px] h-9" placeholder="Buscar por nombre, categoría, talla…"
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <div className="inventory-filter-row flex gap-1">
          {FILTROS.map(f => {
            if (f !== 'Todas') {
              return (
                <button key={f} onClick={() => { setFiltro(f); setFiltroCat(null); }}
                  className={`py-[6px] px-3 rounded-lg text-[12px] ${filtro === f ? 'font-medium bg-[var(--surface-2)] text-[var(--ink)]' : 'font-normal bg-transparent text-[var(--ink-3)]'}`}>
                  {f}
                </button>
              );
            }
            const isTodasActive = filtro === 'Todas';
            return (
              <div key={f} className="relative"
                onMouseEnter={() => setFlyoutOpen(true)}
                onMouseLeave={() => setFlyoutOpen(false)}>
                <button onClick={() => { setFiltro('Todas'); setFiltroCat(null); }}
                  className={`py-[6px] px-3 rounded-lg text-[12px] flex items-center gap-1 ${isTodasActive ? 'font-medium bg-[var(--surface-2)] text-[var(--ink)]' : 'font-normal bg-transparent text-[var(--ink-3)]'}`}>
                  {filtroCategoria ? filtroCategoria : 'Todas'}
                  {filtroCategoria && (
                    <span onClick={e => { e.stopPropagation(); setFiltroCat(null); }}
                      className="ml-[2px] opacity-50 leading-none text-[13px]">×</span>
                  )}
                </button>
                {flyoutOpen && categoriasDisponibles.length > 0 && (
                  <div className="absolute top-[calc(100%+6px)] left-0 z-50 bg-white border border-[rgba(26,23,20,0.1)] rounded-xl shadow-[0_8px_32px_rgba(26,23,20,0.12)] min-w-[180px] py-2">
                    <div className="px-[14px] pt-1 pb-2 text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-[0.06em]">Categorías</div>
                    {categoriasDisponibles.map(cat => (
                      <button key={cat} onClick={() => { setFiltro('Todas'); setFiltroCat(cat); setFlyoutOpen(false); }}
                        className={`block w-full text-left px-[14px] py-[7px] text-[13px] border-l-2 ${filtroCategoria === cat ? 'font-semibold text-[var(--accent-3)] bg-[rgba(201,100,66,0.07)] border-[var(--accent)]' : 'font-normal text-[var(--ink)] bg-transparent border-transparent'}`}>
                        {cat}
                      </button>
                    ))}
                    {filtroCategoria && (
                      <>
                        <div className="h-px bg-[var(--line)] my-[6px]" />
                        <button onClick={() => { setFiltroCat(null); setFlyoutOpen(false); }} className="block w-full text-left px-[14px] py-[7px] text-[12px] text-[var(--ink-3)]">Ver todas</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabla */}
      <div className="inventory-content flex-1 overflow-y-auto px-7 pb-7">
        <div className="card inventory-table-card mt-5 overflow-hidden">
          <div className="mono inventory-table-head grid grid-cols-[40px_56px_1.5fr_1fr_100px_70px_80px_130px_28px] px-4 py-[10px] border-b border-[var(--line)] text-[11px] text-[var(--ink-3)] uppercase tracking-[0.04em]">
            <div/><div/><div>Prenda</div><div>Drop</div><div>Precio</div><div>Cant.</div><div>Talla</div><div>Estado</div><div/>
          </div>
          {loading ? (
            <div className="px-4 py-10 text-center text-[var(--ink-3)] text-[13px]">Cargando inventario…</div>
          ) : filtradas.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="text-[13px] font-medium mb-[6px]">{busqueda ? 'Sin resultados para esa búsqueda' : 'No hay prendas aún'}</div>
              <div className="t-mute text-[12px] mb-4">{busqueda ? 'Intentá con otro término' : 'Agregá tu primera prenda para empezar'}</div>
              {!busqueda && <button onClick={() => setModal(true)} className="btn btn-primary btn-sm"><Icons.plus width={13} height={13} /> Agregar prenda</button>}
            </div>
          ) : (
            filtradas.map((p, i) => (
              <div className={`inventory-row grid grid-cols-[40px_56px_1.5fr_1fr_100px_70px_80px_130px_28px] px-4 py-[10px] items-center text-[12px]${i < filtradas.length - 1 ? ' border-b border-[var(--line-2)]' : ''}`} key={p.id}>
                <input className="inventory-row-check cursor-pointer" type="checkbox" />
                <div className="inventory-thumb w-10 h-10 rounded-md overflow-hidden bg-[var(--surface-2)] flex items-center justify-center">
                  {p.fotos?.[0]
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img loading="lazy" src={p.fotos[0]} alt="" className="w-10 h-10 object-cover block" />
                    : <Icons.grid width={14} height={14} className="text-[var(--ink-3)]" />}
                </div>
                <div className="inventory-product-main">
                  <div className="font-medium">{p.nombre}</div>
                  <div className="t-mute text-[11px]">{p.categoria ?? '—'}</div>
                </div>
                <div className="t-mute inventory-drop">{p.drops?.nombre ?? '—'}</div>
                <div className="mono tnum inventory-price font-medium">L {p.precio.toLocaleString()}</div>
                <div className="mono tnum inventory-qty font-semibold">{getProductTotalQuantity(p)}</div>
                <div className="mono inventory-size whitespace-nowrap overflow-hidden text-ellipsis">{formatProductSizes(p)?.replace('Tallas ', '').replace('Talla ', '') ?? '—'}</div>
                <div className="inventory-status"><Badge estado={p.estado} /></div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="btn-ghost inventory-menu"><Icons.more width={13} height={13} className="text-[var(--ink-3)]" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[180px]">
                    <DropdownMenuItem onClick={() => setEditando(p)}><Icons.edit width={14} height={14} className="mr-2" />Editar prenda</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {p.estado !== 'disponible' && p.estado !== 'vendida' && <DropdownMenuItem onClick={() => cambiarEstado(p.id, 'disponible')}><Icons.check width={14} height={14} className="mr-2" />Marcar disponible</DropdownMenuItem>}
                    {p.estado === 'vendida' && <DropdownMenuItem disabled className="opacity-45 cursor-not-allowed"><Icons.check width={14} height={14} className="mr-2" />Vendida · no modificable</DropdownMenuItem>}
                    {p.estado !== 'vendida' && <DropdownMenuItem onClick={() => cambiarEstado(p.id, 'vendida')}><Icons.bag width={14} height={14} className="mr-2" />Marcar vendida</DropdownMenuItem>}
                    {p.estado !== 'remanente' && <DropdownMenuItem onClick={() => cambiarEstado(p.id, 'remanente')}><Icons.clock width={14} height={14} className="mr-2" />Marcar remanente 48h</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setConfirmDelete(p.id)} className="text-[var(--urgent)]"><Icons.trash width={14} height={14} className="mr-2" />Eliminar prenda</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </div>

      {modal && tiendaId && (
        <ModalPrenda tiendaId={tiendaId} drops={drops} onClose={() => setModal(false)}
          onSaved={() => { setModal(false); cargar(tiendaId); toast.success('Prenda agregada correctamente'); }} />
      )}
      {editando && tiendaId && (
        <ModalPrenda tiendaId={tiendaId} drops={drops} prenda={editando} onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); cargar(tiendaId); toast.success('Cambios guardados correctamente'); }} />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Eliminar prenda"
          description="Esta acción no se puede deshacer. La prenda será eliminada permanentemente de tu inventario."
          confirmLabel="Sí, eliminar"
          variant="danger"
          loading={deletePending}
          onConfirm={() => startDeleteTransition(() => eliminarPrenda(confirmDelete))}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
