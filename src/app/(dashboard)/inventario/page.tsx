'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/shared/icons';
import { ConfirmModal } from '@/components/shared/confirm-modal';
import { SizeSelector } from '@/components/shared/size-selector';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/cloudinary/client';
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
  estado: EstadoPrenda;
  drop_id: string | null;
  drops: { nombre: string } | null;
  created_at: string;
}

const FILTROS = ['Todas', 'Disponibles', 'Apartadas', 'Vendidas', 'Remanentes'];
const ESTADO_MAP: Record<EstadoPrenda, { label: string; style: React.CSSProperties }> = {
  disponible: { label: 'Disponible', style: { color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0' } },
  apartada:   { label: 'Apartada',   style: { color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a' } },
  vendida:    { label: 'Vendida',    style: { color: '#fff',    background: '#111',    border: 'none' } },
  remanente:  { label: 'Remanente 48h', style: { color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe' } },
};

function Badge({ estado }: { estado: EstadoPrenda }) {
  const { label, style } = ESTADO_MAP[estado];
  return (
    <span style={{ ...style, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
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
  const [nombre, setNombre]       = useState(prenda?.nombre ?? '');
  const [descripcion, setDesc]    = useState(prenda?.descripcion ?? '');
  const [marca, setMarca]         = useState(prenda?.marca ?? '');
  const [precio, setPrecio]       = useState(prenda?.precio?.toString() ?? '');
  const [cantidadGeneral, setCantidadGeneral] = useState(
    tallasIniciales.length === 0 ? (prenda?.cantidad?.toString() ?? '1') : ''
  );
  const [tallasSeleccionadas, setTallasSeleccionadas] = useState(() => tallasIniciales);
  const [cantidadesPorTalla, setCantidadesPorTalla] = useState<Record<string, number>>(() => (
    Object.fromEntries(tallasIniciales.map(size => [size, cantidadesIniciales[size] ?? 1]))
  ));
  const [categoria, setCat]       = useState(prenda?.categoria ?? '');
  const [dropId, setDropId]       = useState(prenda?.drop_id ?? '');
  const [estado, setEstado]       = useState<EstadoPrenda>(prenda?.estado ?? 'disponible');
  const [fotos, setFotos]         = useState<string[]>(prenda?.fotos ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
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
      values.forEach(size => {
        next[size] = prev[size] ?? 1;
      });
      return next;
    });
  }

  function handleQtyChange(size: string, qty: number) {
    setCantidadesPorTalla(prev => ({ ...prev, [size]: Math.max(0, qty) }));
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
    } catch {
      setError('No se pudo subir la foto. Intentá de nuevo.');
    } finally {
      setUploading(false);
      // Resetear input para permitir subir la misma imagen de nuevo
      if (fileRef.current) fileRef.current.value = '';
    }
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
      nombre:      nombre.trim(),
      descripcion: descripcion.trim() || null,
      marca:       marca.trim() || null,
      precio:      parseFloat(precio),
      cantidad:    cantidadTotal,
      cantidades_por_talla: tallasSeleccionadas.length > 0
        ? Object.fromEntries(tallasSeleccionadas.map(size => [size, Math.max(0, cantidadesPorTalla[size] ?? 0)]))
        : {},
      talla:       tallasSeleccionadas[0] ?? null,
      tallas:      tallasSeleccionadas,
      categoria:   categoria || null,
      drop_id:     dropId || null,
      estado,
      fotos,
    };
    if (editando) {
      const { error: updErr } = await supabase.from('prendas').update(payload).eq('id', prenda!.id);
      if (updErr) { setError(mensajeGuardar(updErr.message)); setSaving(false); return; }
    } else {
      // Obtener tiendaId desde auth para no depender del prop
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('No autenticado'); setSaving(false); return; }
      const { data: t } = await supabase.from('tiendas').select('id').eq('user_id', user.id).single();
      if (!t) { setError('Tienda no encontrada'); setSaving(false); return; }
      const { error: insErr } = await supabase.from('prendas').insert({ ...payload, tienda_id: t.id });
      if (insErr) { setError(mensajeGuardar(insErr.message)); setSaving(false); return; }
    }
    onSaved();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{editando ? 'Editar prenda' : 'Agregar prenda'}</div>
          <button onClick={onClose} style={{ color: 'var(--ink-3)', display: 'flex' }}>
            <Icons.close width={18} height={18}/>
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'grid', gap: 16 }}>

          {/* Fotos — Cloudinary */}
          <div>
            <label className="label">Fotos</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {fotos.map((url, i) => (
                <div key={i} style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)', position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  <button onClick={() => setFotos(f => f.filter((_, j) => j !== i))}
                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.55)', borderRadius: 4, color: '#fff', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, border: 'none', cursor: 'pointer' }}>
                    ×
                  </button>
                </div>
              ))}
              {fotos.length < 5 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  style={{ width: 72, height: 72, borderRadius: 8, border: '1.5px dashed var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--ink-3)', fontSize: 10, background: 'var(--surface-2)', cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
                  {uploading
                    ? <span style={{ fontSize: 10 }}>Subiendo…</span>
                    : <><Icons.plus width={16} height={16}/><span>Foto</span></>}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFoto}/>
            <div className="t-mute" style={{ fontSize: 11, marginTop: 4 }}>{fotos.length}/5 fotos · se suben a Cloudinary automáticamente</div>
          </div>

          {/* Nombre + Marca */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Nombre <span style={{ color: 'var(--urgent)' }}>*</span></label>
              <input className="input" placeholder="Ej. Blusa floral" value={nombre} onChange={e => setNombre(e.target.value)}/>
            </div>
            <div>
              <label className="label">Marca</label>
              <input className="input" placeholder="Ej. H&M, Zara…" value={marca} onChange={e => setMarca(e.target.value)}/>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="label">Descripción</label>
            <textarea className="input" rows={2} placeholder="Estado, detalles, material…" value={descripcion}
              onChange={e => setDesc(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}/>
          </div>

          {/* Precio + cantidad */}
          <div style={{ display: 'grid', gridTemplateColumns: tallasSeleccionadas.length > 0 ? '1fr' : '1fr 120px', gap: 12 }}>
            <div>
              <label className="label">Precio (L) <span style={{ color: 'var(--urgent)' }}>*</span></label>
              <input className="input" type="number" min="0" step="0.01" placeholder="0.00"
                value={precio} onChange={e => setPrecio(e.target.value)}/>
            </div>
            {tallasSeleccionadas.length === 0 && (
            <div>
              <label className="label">Cantidad <span style={{ color: 'var(--urgent)' }}>*</span></label>
              <input className="input mono tnum" type="number" min="1" step="1"
                value={cantidadGeneral} onChange={e => setCantidadGeneral(e.target.value)}/>
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
            <div className="t-mute" style={{ fontSize: 11, marginTop: 6 }}>
              {tallasSeleccionadas.length > 0
                ? `${tallaHint} Total actual: ${totalPorTallas} unidad${totalPorTallas === 1 ? '' : 'es'}.`
                : tallaHint}
            </div>
          </div>

          {/* Categoría + Estado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={categoria} onChange={e => setCat(e.target.value)} style={{ cursor: 'pointer' }}>
                <option value="">— Sin categoría —</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={estado} onChange={e => setEstado(e.target.value as EstadoPrenda)} style={{ cursor: 'pointer' }}>
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
            <select className="input" value={dropId} onChange={e => setDropId(e.target.value)} style={{ cursor: 'pointer' }}>
              <option value="">— Sin drop —</option>
              {drops.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>

          {error && <div style={{ fontSize: 13, color: 'var(--urgent)', padding: '8px 12px', background: '#fef2f2', borderRadius: 8 }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-outline btn-sm">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving || uploading} className="btn btn-primary btn-sm" style={{ opacity: saving || uploading ? 0.6 : 1 }}>
            {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar prenda'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Página principal ───────────────────────────────────── */
export default function InventarioPage() {
  const [tiendaId, setTiendaId]         = useState<string | null>(null);
  const [prendas, setPrendas]           = useState<Prenda[]>([]);
  const [drops, setDrops]               = useState<Drop[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filtro, setFiltro]             = useState('Todas');
  const [filtroCategoria, setFiltroCat] = useState<string | null>(null);
  const [flyoutOpen, setFlyoutOpen]     = useState(false);
  const [busqueda, setBusqueda]         = useState('');
  const [modal, setModal]         = useState(false);
  const [editando, setEditando]   = useState<Prenda | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  async function cargar(tid: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from('prendas')
      .select('id, nombre, descripcion, cantidad, cantidades_por_talla, precio, talla, tallas, marca, categoria, fotos, estado, drop_id, created_at, drops(nombre)')
      .eq('tienda_id', tid)
      .order('created_at', { ascending: false });
    setPrendas((data as unknown as Prenda[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: t } = await supabase.from('tiendas').select('id').eq('user_id', user.id).single();
      if (!t) return;
      setTiendaId(t.id);

      const { data: dropsData } = await supabase
        .from('drops').select('id, nombre').eq('tienda_id', t.id).order('inicia_at', { ascending: false });
      setDrops(dropsData ?? []);

      await cargar(t.id);
    }
    init();
  }, []);

  async function eliminarPrenda(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('prendas').delete().eq('id', id);
    if (error) { toast.error('No se pudo eliminar la prenda.'); return; }
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
    const { error } = await supabase.from('prendas').update({ estado }).eq('id', id);
    if (error) { toast.error('No se pudo actualizar el estado.'); return; }
    setPrendas(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
    toast.success(`Marcada como ${ESTADO_MAP[estado].label.toLowerCase()}`);
  }

  const categoriasDisponibles = [...new Set(prendas.map(p => p.categoria).filter(Boolean) as string[])].sort();

  const filtradas = prendas.filter(p => {
    const matchFiltro =
      filtro === 'Todas'      ? true :
      filtro === 'Disponibles'? p.estado === 'disponible' :
      filtro === 'Apartadas'  ? p.estado === 'apartada' :
      filtro === 'Vendidas'   ? p.estado === 'vendida' :
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>Inventario</div>
          <div className="t-mute" style={{ fontSize: 13, marginTop: 3 }}>
            {loading ? 'Cargando…' : `${prendas.length} prendas · ${unidadesDisponibles} unidades disponibles`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>
            <Icons.plus width={13} height={13}/> Agregar prenda
          </button>
        </div>
      </div>

      {/* Barra búsqueda + filtros */}
      <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--line)', background: '#fff', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, position: 'relative', zIndex: 10 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Icons.search width={14} height={14} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--ink-3)' }}/>
          <input className="input" style={{ paddingLeft: 34, height: 36 }} placeholder="Buscar por nombre, categoría, talla…"
            value={busqueda} onChange={e => setBusqueda(e.target.value)}/>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTROS.map(f => {
            if (f !== 'Todas') {
              return (
                <button key={f} onClick={() => { setFiltro(f); setFiltroCat(null); }} style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 12,
                  fontWeight: filtro === f ? 500 : 400,
                  background: filtro === f ? 'var(--surface-2)' : 'transparent',
                  color: filtro === f ? 'var(--ink)' : 'var(--ink-3)',
                }}>{f}</button>
              );
            }
            const isTodasActive = filtro === 'Todas';
            return (
              <div
                key={f}
                style={{ position: 'relative' }}
                onMouseEnter={() => setFlyoutOpen(true)}
                onMouseLeave={() => setFlyoutOpen(false)}
              >
                <button
                  onClick={() => { setFiltro('Todas'); setFiltroCat(null); }}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12,
                    fontWeight: isTodasActive ? 500 : 400,
                    background: isTodasActive ? 'var(--surface-2)' : 'transparent',
                    color: isTodasActive ? 'var(--ink)' : 'var(--ink-3)',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {filtroCategoria ? filtroCategoria : 'Todas'}
                  {filtroCategoria && (
                    <span
                      onClick={e => { e.stopPropagation(); setFiltroCat(null); }}
                      style={{ marginLeft: 2, opacity: 0.5, lineHeight: 1, fontSize: 13 }}
                    >×</span>
                  )}
                </button>

                {flyoutOpen && categoriasDisponibles.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
                    background: '#fff', border: '1px solid rgba(26,23,20,0.1)',
                    borderRadius: 12, boxShadow: '0 8px 32px rgba(26,23,20,0.12)',
                    minWidth: 180, padding: '8px 0', overflow: 'hidden',
                  }}>
                    <div style={{ padding: '4px 14px 8px', fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Categorías
                    </div>
                    {categoriasDisponibles.map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setFiltro('Todas'); setFiltroCat(cat); setFlyoutOpen(false); }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '7px 14px', fontSize: 13,
                          fontWeight: filtroCategoria === cat ? 600 : 400,
                          color: filtroCategoria === cat ? 'var(--accent-3)' : 'var(--ink)',
                          background: filtroCategoria === cat ? 'rgba(201,100,66,0.07)' : 'transparent',
                          borderLeft: `2px solid ${filtroCategoria === cat ? 'var(--accent)' : 'transparent'}`,
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                    {filtroCategoria && (
                      <>
                        <div style={{ height: 1, background: 'var(--line)', margin: '6px 0' }}/>
                        <button
                          onClick={() => { setFiltroCat(null); setFlyoutOpen(false); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 14px', fontSize: 12, color: 'var(--ink-3)' }}
                        >
                          Ver todas
                        </button>
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
        <div className="card" style={{ marginTop: 20, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 56px 1.5fr 1fr 100px 70px 80px 130px 28px', padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.04 }} className="mono">
            <div></div><div></div><div>Prenda</div><div>Drop</div><div>Precio</div><div>Cant.</div><div>Talla</div><div>Estado</div><div></div>
          </div>

          {loading ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Cargando inventario…</div>
          ) : filtradas.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                {busqueda ? 'Sin resultados para esa búsqueda' : 'No hay prendas aún'}
              </div>
              <div className="t-mute" style={{ fontSize: 12, marginBottom: 16 }}>
                {busqueda ? 'Intentá con otro término' : 'Agregá tu primera prenda para empezar'}
              </div>
              {!busqueda && (
                <button onClick={() => setModal(true)} className="btn btn-primary btn-sm">
                  <Icons.plus width={13} height={13}/> Agregar prenda
                </button>
              )}
            </div>
          ) : (
            filtradas.map((p, i) => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '40px 56px 1.5fr 1fr 100px 70px 80px 130px 28px', padding: '10px 16px', borderBottom: i < filtradas.length - 1 ? '1px solid var(--line-2)' : 'none', alignItems: 'center', fontSize: 12 }}>
                <input type="checkbox" style={{ cursor: 'pointer' }}/>
                <div style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.fotos?.[0]
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.fotos[0]} alt="" style={{ width: 40, height: 40, objectFit: 'cover', display: 'block' }}/>
                    : <Icons.grid width={14} height={14} style={{ color: 'var(--ink-3)' }}/>
                  }
                </div>
                <div>
                  <div style={{ fontWeight: 500 }}>{p.nombre}</div>
                  <div className="t-mute" style={{ fontSize: 11 }}>{p.categoria ?? '—'}</div>
                </div>
                <div className="t-mute">{p.drops?.nombre ?? '—'}</div>
                <div className="mono tnum" style={{ fontWeight: 500 }}>L {p.precio.toLocaleString()}</div>
                <div className="mono tnum" style={{ fontWeight: 600 }}>{getProductTotalQuantity(p)}</div>
                <div className="mono" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatProductSizes(p)?.replace('Tallas ', '').replace('Talla ', '') ?? '—'}</div>
                <div><Badge estado={p.estado}/></div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="btn-ghost"><Icons.more width={13} height={13} style={{ color: 'var(--ink-3)' }}/></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" style={{ minWidth: 180 }}>
                    <DropdownMenuItem onClick={() => setEditando(p)}>
                      <Icons.edit width={14} height={14} style={{ marginRight: 8 }}/>
                      Editar prenda
                    </DropdownMenuItem>
                    <DropdownMenuSeparator/>
                    {p.estado !== 'disponible' && p.estado !== 'vendida' && (
                      <DropdownMenuItem onClick={() => cambiarEstado(p.id, 'disponible')}>
                        <Icons.check width={14} height={14} style={{ marginRight: 8 }}/>
                        Marcar disponible
                      </DropdownMenuItem>
                    )}
                    {p.estado === 'vendida' && (
                      <DropdownMenuItem disabled style={{ opacity: 0.45, cursor: 'not-allowed' }}>
                        <Icons.check width={14} height={14} style={{ marginRight: 8 }}/>
                        Vendida · no modificable
                      </DropdownMenuItem>
                    )}
                    {p.estado !== 'vendida' && (
                      <DropdownMenuItem onClick={() => cambiarEstado(p.id, 'vendida')}>
                        <Icons.bag width={14} height={14} style={{ marginRight: 8 }}/>
                        Marcar vendida
                      </DropdownMenuItem>
                    )}
                    {p.estado !== 'remanente' && (
                      <DropdownMenuItem onClick={() => cambiarEstado(p.id, 'remanente')}>
                        <Icons.clock width={14} height={14} style={{ marginRight: 8 }}/>
                        Marcar remanente 48h
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator/>
                    <DropdownMenuItem onClick={() => setConfirmDelete(p.id)} style={{ color: 'var(--urgent)' }}>
                      <Icons.trash width={14} height={14} style={{ marginRight: 8 }}/>
                      Eliminar prenda
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal agregar */}
      {modal && tiendaId && (
        <ModalPrenda
          tiendaId={tiendaId}
          drops={drops}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); cargar(tiendaId); toast.success('Prenda agregada correctamente'); }}
        />
      )}

      {/* Modal editar */}
      {editando && tiendaId && (
        <ModalPrenda
          tiendaId={tiendaId}
          drops={drops}
          prenda={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); cargar(tiendaId); toast.success('Cambios guardados correctamente'); }}
        />
      )}

      {/* Modal confirmar eliminación */}
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
