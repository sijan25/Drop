'use client';

import type { FormEvent } from 'react';
import { useEffect, useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/shared/icons';
import { PhoneInput } from '@/components/shared/phone-input';
import { uploadImage } from '@/lib/cloudinary/client';
import type { CatalogOptionTipo } from '@/lib/catalog-options';
import { USERNAME_CHANGE_LIMIT, normalizeStoreUsername } from '@/lib/stores/username';
import { PLATFORM, formatCurrencyFree } from '@/lib/config/platform';
import type { Tienda } from '@/types/tienda';
import type { MetodoPago, MetodoEnvio } from '@/types/envio';
import type { OpcionCatalogo } from '@/types/catalog';
import {
  guardarInfoTienda,
  agregarMetodoPago,
  toggleMetodoPago,
  eliminarMetodoPago,
  agregarMetodoEnvio,
  editarMetodoEnvio,
  toggleMetodoEnvio,
  eliminarMetodoEnvio,
  agregarOpcionCatalogo,
  toggleOpcionCatalogo,
  eliminarOpcionCatalogo,
  resetearCatalogo,
} from './actions';

type OpcionTipo = CatalogOptionTipo;

function sameOptionName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function sortOptions(items: OpcionCatalogo[]) {
  return [...items].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nombre.localeCompare(b.nombre));
}

function FeedbackModal({
  title,
  message,
  ok,
  onClose,
}: {
  title: string;
  message: string;
  ok: boolean;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 520, padding: 18 }}
    >
      <div onClick={event => event.stopPropagation()} style={{ width: 'min(420px, 100%)', background: '#fff', borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,0.22)', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: ok ? '#ecfdf5' : '#fef2f2', color: ok ? '#047857' : '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {ok ? <Icons.check width={18} height={18}/> : <Icons.close width={18} height={18}/>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
            <div className="t-mute" style={{ fontSize: 13, marginTop: 4 }}>{message}</div>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost" style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icons.close width={15} height={15}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal editar/crear método de envío ──────────────────
function EnvioModal({ m, onClose, onSave }: {
  m: Partial<MetodoEnvio> | null;
  onClose: () => void;
  onSave: (data: { nombre: string; proveedor: string; precio: number; tiempo_estimado: string; cobertura: string; tracking_url: string }) => void;
}) {
  const [form, setForm] = useState({
    nombre: m?.nombre ?? '',
    proveedor: m?.proveedor ?? '',
    precio: m?.precio ?? 0,
    tiempo_estimado: m?.tiempo_estimado ?? '',
    cobertura: m?.cobertura ?? '',
    tracking_url: m?.tracking_url ?? '',
  });
  const change = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="settings-modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div className="settings-modal-panel" onClick={e => e.stopPropagation()} style={{ width: 520, background: '#fff', borderRadius: 16, display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{m?.id ? 'Editar método de envío' : 'Nuevo método de envío'}</div>
          <button onClick={onClose} style={{ color: 'var(--ink-3)' }}><Icons.close width={16} height={16}/></button>
        </div>
        <div style={{ padding: 22, display: 'grid', gap: 14 }}>
          <div className="settings-modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Nombre público</label>
              <input className="input" value={form.nombre} onChange={e => change('nombre', e.target.value)} placeholder={`Envío a todo ${PLATFORM.country}`}/>
            </div>
            <div>
              <label className="label">Precio (L)</label>
              <input className="input mono tnum" type="number" min={0} value={form.precio} onChange={e => change('precio', Number(e.target.value))}/>
            </div>
          </div>
          <div className="settings-modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Empresa / Proveedor</label>
              <input className="input" value={form.proveedor} onChange={e => change('proveedor', e.target.value)} placeholder="C807 Xpress"/>
            </div>
            <div>
              <label className="label">Tiempo estimado</label>
              <input className="input" value={form.tiempo_estimado} onChange={e => change('tiempo_estimado', e.target.value)} placeholder="3 días laborales"/>
            </div>
          </div>
          <div className="settings-modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Zona de cobertura</label>
              <input className="input" value={form.cobertura} onChange={e => change('cobertura', e.target.value)} placeholder="Todos los departamentos"/>
            </div>
            <div>
              <label className="label">URL de rastreo</label>
              <input className="input" value={form.tracking_url} onChange={e => change('tracking_url', e.target.value)} placeholder="https://proveedor.com/track?id="/>
            </div>
          </div>
        </div>
        <div className="settings-modal-footer" style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn btn-outline">Cancelar</button>
          <button onClick={() => form.nombre && form.proveedor && onSave(form)} className="btn btn-primary">Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal agregar método de pago ────────────────────────
function AgregarMetodoPagoModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (data: { tipo: 'tarjeta' | 'transferencia'; proveedor: string; nombre: string; detalle: string }) => void;
}) {
  const [form, setForm] = useState({ tipo: 'transferencia' as 'tarjeta' | 'transferencia', proveedor: '', nombre: '', detalle: '' });
  const change = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="settings-modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div className="settings-modal-panel" onClick={e => e.stopPropagation()} style={{ width: 480, background: '#fff', borderRadius: 16, display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Agregar método de pago</div>
          <button onClick={onClose} style={{ color: 'var(--ink-3)' }}><Icons.close width={16} height={16}/></button>
        </div>
        <div style={{ padding: 22, display: 'grid', gap: 14 }}>
          <div>
            <label className="label">Tipo</label>
            <div className="settings-modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(['tarjeta', 'transferencia'] as const).map(t => (
                <button key={t} onClick={() => change('tipo', t)} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${form.tipo === t ? 'var(--ink)' : 'var(--line)'}`, background: form.tipo === t ? 'var(--ink)' : '#fff', color: form.tipo === t ? '#fff' : 'var(--ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  {t === 'tarjeta' ? 'Tarjeta (PixelPay)' : 'Transferencia bancaria'}
                </button>
              ))}
            </div>
          </div>
          <div><label className="label">Nombre público</label><input className="input" value={form.nombre} onChange={e => change('nombre', e.target.value)} placeholder={form.tipo === 'tarjeta' ? 'PixelPay' : 'Banco Ficohsa'}/></div>
          <div><label className="label">Proveedor / Banco</label><input className="input" value={form.proveedor} onChange={e => change('proveedor', e.target.value)} placeholder={form.tipo === 'tarjeta' ? 'pixelpay' : 'ficohsa'}/></div>
          {form.tipo === 'transferencia' && (
            <div><label className="label">Número de cuenta · Titular</label><input className="input" value={form.detalle} onChange={e => change('detalle', e.target.value)} placeholder="123-456-7890 · María López"/></div>
          )}
        </div>
        <div className="settings-modal-footer" style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn btn-outline">Cancelar</button>
          <button onClick={() => form.nombre && form.proveedor && onSave(form)} className="btn btn-primary">Agregar</button>
        </div>
      </div>
    </div>
  );
}

// ── Opciones de catálogo ─────────────────────────────────
function CatalogOptionsCard({
  title,
  description,
  defaults,
  options,
  tipo,
  onAdd,
  onToggle,
  onDelete,
  pending,
}: {
  title: string;
  description: string;
  defaults: readonly string[];
  options: OpcionCatalogo[];
  tipo: OpcionTipo;
  onAdd: (tipo: OpcionTipo, nombre: string, onSuccess: () => void) => void;
  onToggle: (id: string, activo: boolean) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  const [nombre, setNombre] = useState('');
  const [inputError, setInputError] = useState('');
  const baseRows = defaults.map(defaultName => ({
    nombre: defaultName,
    override: options.find(option => sameOptionName(option.nombre, defaultName)),
  }));
  const visibleBaseRows = baseRows.filter(row => row.override?.activo !== false);
  const customOptions = options.filter(option => !defaults.some(defaultName => sameOptionName(defaultName, option.nombre)));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = nombre.trim();
    if (!value) return;
    const lower = value.toLowerCase();
    if (defaults.some(d => d.toLowerCase() === lower)) {
      setInputError('Ya está en la lista base.');
      return;
    }
    if (options.some(o => o.activo !== false && o.nombre.trim().toLowerCase() === lower)) {
      setInputError('Ya existe en tu catálogo.');
      return;
    }
    setInputError('');
    onAdd(tipo, value, () => setNombre(''));
  };

  return (
    <div className="settings-catalog-card" style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--line)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {tipo === 'categoria' ? <Icons.grid width={15} height={15}/> : <Icons.box width={15} height={15}/>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
          <div className="t-mute" style={{ fontSize: 12, marginTop: 2 }}>{description}</div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'grid', gap: 16 }}>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 4 }}>
          <div className="settings-catalog-add-row" style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={nombre}
              onChange={e => { setNombre(e.target.value); if (inputError) setInputError(''); }}
              placeholder={tipo === 'categoria' ? 'Ej. Carteras, Ropa deportiva…' : 'Ej. 14, Plus, Petite…'}
              style={{ height: 38, borderColor: inputError ? 'var(--urgent)' : undefined }}
            />
            <button className="btn btn-primary btn-sm" disabled={pending || !nombre.trim()} style={{ height: 38, flexShrink: 0 }}>
              <Icons.plus width={13} height={13}/> Agregar
            </button>
          </div>
          {inputError && <div style={{ fontSize: 11, color: 'var(--urgent)' }}>{inputError}</div>}
        </form>

        {visibleBaseRows.length > 0 && (
          <div>
            <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.08, color: 'var(--ink-3)', marginBottom: 8 }}>Base del sistema</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {visibleBaseRows.map(row => (
                <span key={row.nombre} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 7px 5px 8px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 12, color: 'var(--ink-2)', background: 'var(--surface-2)' }}>
                  {row.nombre}
                  <span className="mono" style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase' }}>Base</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.08, color: 'var(--ink-3)', marginBottom: 8 }}>Tus opciones</div>
          {customOptions.length === 0 ? (
            <div style={{ padding: '18px 12px', border: '1px dashed var(--line)', borderRadius: 10, textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
              Agregá opciones propias cuando necesités vender una categoría o talla nueva.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {customOptions.map(option => (
                <div key={option.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{option.nombre}</div>
                    <div className="t-mute" style={{ fontSize: 11 }}>{option.activo ? 'Disponible en formularios' : 'Oculta temporalmente'}</div>
                  </div>
                  <button
                    onClick={() => onToggle(option.id, !option.activo)}
                    type="button"
                    aria-label={option.activo ? `Ocultar ${option.nombre}` : `Activar ${option.nombre}`}
                    style={{ width: 32, height: 18, borderRadius: 10, background: option.activo ? 'var(--ink)' : 'var(--line)', position: 'relative', flexShrink: 0, cursor: 'pointer', border: 'none' }}
                  >
                    <div style={{ position: 'absolute', top: 2, left: option.activo ? 16 : 2, width: 14, height: 14, borderRadius: 7, background: '#fff', transition: 'left .15s' }}/>
                  </button>
                  <button type="button" onClick={() => onDelete(option.id)} className="btn-ghost" style={{ padding: 4 }}>
                    <Icons.trash width={14} height={14} style={{ color: 'var(--ink-3)' }}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────
export function ConfiguracionClient({
  tienda,
  ownerEmail,
  metodosPago: initialMetodosPago,
  metodosEnvio: initialMetodosEnvio,
  opcionesCatalogo: initialOpcionesCatalogo,
}: {
  tienda: Tienda;
  ownerEmail: string;
  metodosPago: MetodoPago[];
  metodosEnvio: MetodoEnvio[];
  opcionesCatalogo: OpcionCatalogo[];
}) {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [tab, setTab] = useState('shop');
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>(initialMetodosPago);
  const [metodosEnvio, setMetodosEnvio] = useState<MetodoEnvio[]>(initialMetodosEnvio);
  const [opcionesCatalogo, setOpcionesCatalogo] = useState<OpcionCatalogo[]>(initialOpcionesCatalogo);
  const [editingEnvio, setEditingEnvio] = useState<Partial<MetodoEnvio> | null>(null);
  const [showAgregarPago, setShowAgregarPago] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const showNotice = (title: string, message: string, ok = true) => {
    setNotice({ title, message, ok });
    showToast(title, ok);
    setTimeout(() => setNotice(null), ok ? 1700 : 2600);
  };

  const [logoPreview, setLogoPreview] = useState<string>(tienda.logo_url ?? '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [infoForm, setInfoForm] = useState({
    nombre: tienda.nombre,
    username: tienda.username,
    bio: tienda.bio ?? '',
    instagram: tienda.instagram ?? '',
    facebook: tienda.facebook ?? '',
    tiktok: tienda.tiktok ?? '',
    ubicacion: tienda.ubicacion ?? '',
    ciudad: tienda.ciudad ?? '',
    departamento: tienda.departamento ?? '',
    contact_email: tienda.contact_email ?? ownerEmail,
    whatsapp: (tienda as { whatsapp?: string | null }).whatsapp ?? '',
  });

  const [boxfulStates, setBoxfulStates] = useState<Array<{ id: string; name: string; cities: Array<{ id: string; name: string }> }>>([]);
  useEffect(() => {
    fetch('/api/boxful/states').then(r => r.json()).then(data => {
      setBoxfulStates(data.states ?? []);
    }).catch(() => {});
  }, []);
  const usernamePreview = normalizeStoreUsername(infoForm.username);
  const usernameChanged = usernamePreview !== normalizeStoreUsername(tienda.username);
  const usernameChangesLeft = Math.max(0, USERNAME_CHANGE_LIMIT - (tienda.username_change_count ?? 0));

  const tabs = [
    { id: 'shop', t: 'Info de tienda' },
    { id: 'pay', t: 'Métodos de pago' },
    { id: 'ship', t: 'Envíos' },
    { id: 'catalog', t: 'Catálogo' },
    { id: 'notif', t: 'Notificaciones' },
    { id: 'sub', t: 'Suscripción' },
  ];

  const initials = tienda.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  useEffect(() => {
    const node = shellRef.current;
    if (!node) return;
    const update = () => {
      setIsCompact(node.clientWidth <= 900);
      setIsNarrow(node.clientWidth <= 560);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // ── handleGuardarInfo — usa Cloudinary para logo ──
  const handleGuardarInfo = () => {
    startTransition(async () => {
      try {
        // Subir logo a Cloudinary si cambió
        let logo_url: string | null = tienda.logo_url ?? null;
        let logo_cloudinary_id: string | null = null;
        if (logoFile) {
          const result = await uploadImage(logoFile, { folder: 'fardodrops/logos' });
          logo_url = result.url;
          logo_cloudinary_id = result.publicId;
        }

        const res = await guardarInfoTienda({ ...infoForm, logo_url, logo_cloudinary_id });
        showToast(res.error ?? 'Cambios guardados', !res.error);
        if (!res.error) { setLogoFile(null); router.refresh(); }
      } catch {
        showToast('Error al subir la imagen. Intentá de nuevo.', false);
      }
    });
  };

  // ── Handlers pago ──
  const handleAgregarPago = (data: { tipo: 'tarjeta' | 'transferencia'; proveedor: string; nombre: string; detalle: string }) => {
    setShowAgregarPago(false);
    startTransition(async () => {
      const res = await agregarMetodoPago(data);
      if (res.metodo) { setMetodosPago(ms => [...ms, res.metodo!]); showToast('Método agregado'); }
      else showToast(res.error ?? 'Error', false);
    });
  };

  const handleTogglePago = (id: string, activo: boolean) => {
    setMetodosPago(ms => ms.map(m => m.id === id ? { ...m, activo } : m));
    startTransition(async () => {
      const res = await toggleMetodoPago(id, activo);
      if (res.error) showToast(res.error, false);
    });
  };

  const handleEliminarPago = (id: string) => {
    setMetodosPago(ms => ms.filter(m => m.id !== id));
    startTransition(async () => {
      const res = await eliminarMetodoPago(id);
      if (!res.error) showToast('Método eliminado');
      else showToast(res.error, false);
    });
  };

  // ── Handlers envío ──
  const handleGuardarEnvio = (data: { nombre: string; proveedor: string; precio: number; tiempo_estimado: string; cobertura: string; tracking_url: string }) => {
    const id = editingEnvio?.id;
    setEditingEnvio(null);
    startTransition(async () => {
      if (id) {
        const res = await editarMetodoEnvio(id, data);
        if (res.metodo) { setMetodosEnvio(ms => ms.map(m => m.id === id ? res.metodo! : m)); showToast('Cambios guardados'); }
        else showToast(res.error ?? 'Error', false);
      } else {
        const res = await agregarMetodoEnvio(data);
        if (res.metodo) { setMetodosEnvio(ms => [...ms, res.metodo!]); showToast('Método agregado'); }
        else showToast(res.error ?? 'Error', false);
      }
    });
  };

  const handleToggleEnvio = (id: string, activo: boolean) => {
    setMetodosEnvio(ms => ms.map(m => m.id === id ? { ...m, activo } : m));
    startTransition(async () => {
      const res = await toggleMetodoEnvio(id, activo);
      if (res.error) showToast(res.error, false);
    });
  };

  const handleEliminarEnvio = (id: string) => {
    setMetodosEnvio(ms => ms.filter(m => m.id !== id));
    startTransition(async () => {
      const res = await eliminarMetodoEnvio(id);
      if (!res.error) showToast('Método eliminado');
      else showToast(res.error, false);
    });
  };

  // ── Handlers catálogo ──
  const handleAgregarOpcion = (tipo: OpcionTipo, nombre: string, onSuccess: () => void) => {
    startTransition(async () => {
      const res = await agregarOpcionCatalogo({ tipo, nombre });
      if (res.opcion) {
        setOpcionesCatalogo(items => sortOptions([...items.filter(item => item.id !== res.opcion!.id), res.opcion!]));
        onSuccess();
        showNotice(
          tipo === 'categoria' ? 'Categoría agregada' : 'Talla agregada',
          `${res.opcion.nombre} ya está disponible en tus formularios.`
        );
      } else {
        showNotice('No se pudo agregar', res.error ?? 'Intentá de nuevo.', false);
      }
    });
  };

  const handleToggleOpcion = (id: string, activo: boolean) => {
    setOpcionesCatalogo(items => items.map(item => item.id === id ? { ...item, activo } : item));
    startTransition(async () => {
      const res = await toggleOpcionCatalogo(id, activo);
      if (res.error) showNotice('No se pudo actualizar', res.error, false);
      else if (activo) showNotice('Opción restaurada', 'Ya vuelve a aparecer en inventario y drops.');
      else showNotice('Opción ocultada', 'Ya no aparecerá en tus formularios.');
    });
  };

  const handleEliminarOpcion = (id: string) => {
    const actual = opcionesCatalogo.find(item => item.id === id);
    setOpcionesCatalogo(items => items.filter(item => item.id !== id));
    startTransition(async () => {
      const res = await eliminarOpcionCatalogo(id);
      if (!res.error) showNotice('Opción eliminada', `${actual?.nombre ?? 'La opción'} se eliminó correctamente.`);
      else {
        if (actual) setOpcionesCatalogo(items => sortOptions([...items, actual]));
        showNotice('No se pudo eliminar', res.error, false);
      }
    });
  };

  const handleResetearCatalogo = () => {
    if (!confirm('¿Restaurar el catálogo a los valores por defecto de tu tipo de tienda? Se reemplazarán todas tus opciones actuales.')) return;
    startTransition(async () => {
      const res = await resetearCatalogo();
      if (res.opciones) {
        setOpcionesCatalogo(sortOptions(res.opciones));
        showNotice('Catálogo restaurado', 'Las opciones volvieron a los valores por defecto de tu tipo de tienda.');
      } else {
        showNotice('No se pudo restaurar', res.error ?? 'Intentá de nuevo.', false);
      }
    });
  };

  return (
    <div ref={shellRef} className="settings-shell" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="settings-header" style={{ padding: isCompact ? '18px 16px 14px' : '20px 28px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>Configuración</div>
        <div className="t-mute" style={{ fontSize: 13, marginTop: 3 }}>{tienda.nombre} · @{tienda.username}</div>
      </div>

      <div className="settings-content" style={{ flex: 1, overflowY: 'auto', padding: isCompact ? '14px 14px 120px' : '24px 28px', background: 'var(--bg)' }}>
        <div className="dash-settings-grid settings-layout-grid" style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '220px 1fr', gap: isCompact ? 14 : 28, maxWidth: 960, margin: '0 auto' }}>

          {/* Nav */}
          <nav className="settings-tabs" style={{ display: isCompact ? 'flex' : 'grid', gap: isCompact ? 6 : 2, alignSelf: 'start', overflowX: isCompact ? 'auto' : undefined, paddingBottom: isCompact ? 2 : undefined }}>
            {tabs.map(n => (
              <button key={n.id} onClick={() => setTab(n.id)} style={{
                padding: '7px 10px', textAlign: 'left', borderRadius: 6,
                background: tab === n.id ? 'var(--surface-2)' : 'transparent',
                fontSize: 13, fontWeight: tab === n.id ? 500 : 400,
                color: tab === n.id ? 'var(--ink)' : 'var(--ink-2)',
                flex: isCompact ? '0 0 auto' : undefined,
                whiteSpace: isCompact ? 'nowrap' : undefined,
              }}>{n.t}</button>
            ))}
          </nav>

          <div className="settings-main" style={{ display: 'grid', gap: 16, minWidth: 0 }}>

            {/* ── Info tienda ── */}
            {tab === 'shop' && (
              <div className="card settings-card" style={{ padding: isCompact ? 16 : 24 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Info pública</div>
                <div className="t-mute" style={{ fontSize: 12, marginBottom: 20 }}>Esto es lo que ven tus compradoras.</div>

                {/* Logo */}
                <div className="settings-logo-row" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20, flexDirection: isNarrow ? 'column' : undefined }}>
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img loading="lazy" src={logoPreview} alt="logo" style={{ width: 64, height: 64, borderRadius: 32, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 32, background: '#e4d4d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, flexShrink: 0 }}>{initials}</div>
                  )}
                  <div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { setLogoPreview(URL.createObjectURL(f)); setLogoFile(f); }
                      }}
                    />
                    <button className="btn btn-outline btn-sm" onClick={() => logoInputRef.current?.click()}>Cambiar logo</button>
                    <div className="help">PNG cuadrado, mín 256px · se sube a Cloudinary</div>
                  </div>
                </div>

                <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: 14 }}>
                  <div><label className="label">Nombre de tienda</label><input className="input" value={infoForm.nombre} onChange={e => setInfoForm(f => ({ ...f, nombre: e.target.value }))}/></div>
                  <div>
                    <label className="label">Link público</label>
                    <input
                      className="input"
                      value={infoForm.username}
                      onChange={e => setInfoForm(f => ({ ...f, username: e.target.value.toLowerCase() }))}
                      placeholder="mitienda-hn"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                    <div className="help">droppii.com/{usernamePreview || 'mitienda-hn'}</div>
                  </div>
                  {usernameChanged && (
                    <div style={{ gridColumn: isCompact ? 'auto' : 'span 2', border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 10, padding: '11px 12px', fontSize: 12, color: '#92400e', lineHeight: 1.45 }}>
                      Cambiar este link puede afectar enlaces compartidos. Guardaremos una redirección desde <strong>/{tienda.username}</strong> hacia <strong>/{usernamePreview}</strong>. Te quedan {usernameChangesLeft} {usernameChangesLeft === 1 ? 'cambio' : 'cambios'}.
                    </div>
                  )}
                  <div style={{ gridColumn: isCompact ? 'auto' : 'span 2' }}>
                    <label className="label">Correo público</label>
                    <input
                      className="input"
                      type="email"
                      value={infoForm.contact_email}
                      onChange={e => setInfoForm(f => ({ ...f, contact_email: e.target.value }))}
                      placeholder="ventas@tutienda.com"
                    />
                    <div className="help">Se muestra en la tienda y se usa para avisarte de nuevos pedidos.</div>
                  </div>
                  <div style={{ gridColumn: isCompact ? 'auto' : 'span 2' }}>
                    <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icons.whatsapp width={13} height={13}/> WhatsApp de la tienda
                    </label>
                    <PhoneInput
                      value={infoForm.whatsapp}
                      onChange={v => setInfoForm(f => ({ ...f, whatsapp: v }))}
                    />
                    <div className="help">Número donde recibirás el aviso de nuevos pedidos por WhatsApp.</div>
                  </div>
                  <div style={{ gridColumn: isCompact ? 'auto' : 'span 2' }}><label className="label">Bio</label><textarea className="input" style={{ height: 72, padding: 10, resize: 'none' }} value={infoForm.bio} onChange={e => setInfoForm(f => ({ ...f, bio: e.target.value }))}/></div>
                  <div style={{ gridColumn: isCompact ? 'auto' : 'span 2', display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">Departamento de origen</label>
                      <select
                        className="input"
                        value={infoForm.departamento}
                        onChange={e => {
                          const dep = e.target.value;
                          setInfoForm(f => ({ ...f, departamento: dep, ciudad: '' }));
                        }}
                      >
                        <option value="">Seleccioná un departamento</option>
                        {boxfulStates.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Ciudad de origen</label>
                      <select
                        className="input"
                        value={infoForm.ciudad}
                        onChange={e => setInfoForm(f => ({ ...f, ciudad: e.target.value }))}
                        disabled={!infoForm.departamento}
                      >
                        <option value="">Seleccioná una ciudad</option>
                        {(boxfulStates.find(s => s.name === infoForm.departamento)?.cities ?? []).map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                      <div className="help">Se usa para calcular el costo de envío con Boxful.</div>
                    </div>
                  </div>
                  <div style={{ gridColumn: isCompact ? 'auto' : 'span 2' }}>
                    <label className="label">Dirección / Colonia</label>
                    <input className="input" placeholder="Ej: Col. Los Andes, calle principal" value={infoForm.ubicacion} onChange={e => setInfoForm(f => ({ ...f, ubicacion: e.target.value }))}/>
                    <div className="help">Se muestra en el perfil de la tienda.</div>
                  </div>
                  <div style={{ gridColumn: isCompact ? 'auto' : 'span 2', borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--ink-2)' }}>Redes sociales</div>
                    <div className="settings-social-grid" style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
                      <div>
                        <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icons.ig width={13} height={13}/> Instagram
                        </label>
                        <input className="input" placeholder="@tutienda" value={infoForm.instagram} onChange={e => setInfoForm(f => ({ ...f, instagram: e.target.value }))}/>
                      </div>
                      <div>
                        <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> Facebook
                        </label>
                        <input className="input" placeholder="facebook.com/tutienda" value={infoForm.facebook} onChange={e => setInfoForm(f => ({ ...f, facebook: e.target.value }))}/>
                      </div>
                      <div>
                        <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg> TikTok
                        </label>
                        <input className="input" placeholder="@tutienda" value={infoForm.tiktok} onChange={e => setInfoForm(f => ({ ...f, tiktok: e.target.value }))}/>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={handleGuardarInfo} disabled={isPending} className="btn btn-primary" style={{ width: isNarrow ? '100%' : undefined }}>
                    {isPending ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Métodos de pago ── */}
            {tab === 'pay' && (
              <div className="card settings-card" style={{ padding: isCompact ? 16 : 24 }}>
                <div className="settings-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: isCompact ? 'stretch' : 'baseline', marginBottom: 16, gap: 12, flexDirection: isCompact ? 'column' : undefined }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>Métodos de pago</div>
                    <div className="t-mute" style={{ fontSize: 12 }}>Tus compradoras verán estas opciones al pagar.</div>
                  </div>
                  <button onClick={() => setShowAgregarPago(true)} className="btn btn-outline btn-sm" style={{ width: isNarrow ? '100%' : undefined }}><Icons.plus width={13} height={13}/> Agregar</button>
                </div>
                {metodosPago.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No tenés métodos de pago configurados.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {metodosPago.map(m => {
                      const Ic = m.tipo === 'tarjeta' ? Icons.card : Icons.bank;
                      return (
                        <div className="settings-method-row" key={m.id} style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: isNarrow ? 'wrap' : undefined }}>
                          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic width={14} height={14}/></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{m.nombre}</div>
                            <div className="t-mute" style={{ fontSize: 11 }}>{m.detalle ?? m.proveedor}</div>
                          </div>
                          <button onClick={() => handleTogglePago(m.id, !m.activo)} style={{ width: 32, height: 18, borderRadius: 10, background: m.activo ? 'var(--ink)' : 'var(--line)', position: 'relative', flexShrink: 0, cursor: 'pointer' }}>
                            <div style={{ position: 'absolute', top: 2, left: m.activo ? 16 : 2, width: 14, height: 14, borderRadius: 7, background: '#fff', transition: 'left .15s' }}/>
                          </button>
                          <button onClick={() => handleEliminarPago(m.id)} className="btn-ghost" style={{ padding: 4 }}>
                            <Icons.trash width={14} height={14} style={{ color: 'var(--ink-3)' }}/>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Métodos de envío ── */}
            {tab === 'ship' && (
              <div className="card settings-card" style={{ padding: isCompact ? 16 : 24 }}>
                <div className="settings-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: isCompact ? 'stretch' : 'flex-start', marginBottom: 18, gap: 12, flexDirection: isCompact ? 'column' : undefined }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>Métodos de envío</div>
                    <div className="t-mute" style={{ fontSize: 12, marginTop: 2 }}>Vos definís con qué empresas enviás y cuánto cobrás.</div>
                  </div>
                  <button onClick={() => setEditingEnvio({})} className="btn btn-outline btn-sm" style={{ width: isNarrow ? '100%' : undefined }}>
                    <Icons.plus width={13} height={13}/> Nuevo método
                  </button>
                </div>
                {metodosEnvio.length === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                    No tenés métodos de envío configurados.<br/>
                    <button onClick={() => setEditingEnvio({})} className="btn btn-outline btn-sm" style={{ marginTop: 12 }}>+ Agregar primero</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {metodosEnvio.map(m => (
                      <div key={m.id} style={{ padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 12, background: '#fff' }}>
                        <div className="settings-shipping-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexDirection: isNarrow ? 'column' : undefined }}>
                          <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icons.truck width={16} height={16} style={{ color: 'var(--ink-2)' }}/>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{m.nombre}</div>
                              <span className="mono tnum" style={{ fontSize: 13, fontWeight: 500 }}>{formatCurrencyFree(m.precio)}</span>
                              {!m.activo && <span className="badge">Inactivo</span>}
                            </div>
                            <div className="t-mute" style={{ fontSize: 12, marginTop: 2 }}>{m.proveedor} · {m.tiempo_estimado}</div>
                            <div className="t-mute" style={{ fontSize: 12 }}>{m.cobertura}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', alignSelf: isNarrow ? 'stretch' : undefined, justifyContent: isNarrow ? 'flex-end' : undefined, width: isNarrow ? '100%' : undefined }}>
                            <button onClick={() => handleToggleEnvio(m.id, !m.activo)} style={{ width: 32, height: 18, borderRadius: 10, background: m.activo ? 'var(--ink)' : 'var(--line)', position: 'relative', flexShrink: 0, cursor: 'pointer', border: 'none' }}>
                              <div style={{ position: 'absolute', top: 2, left: m.activo ? 16 : 2, width: 14, height: 14, borderRadius: 7, background: '#fff', transition: 'left .15s' }}/>
                            </button>
                            <button onClick={() => setEditingEnvio(m)} className="btn-ghost" style={{ padding: 4 }}>
                              <Icons.edit width={14} height={14} style={{ color: 'var(--ink-3)' }}/>
                            </button>
                            <button onClick={() => handleEliminarEnvio(m.id)} className="btn-ghost" style={{ padding: 4 }}>
                              <Icons.trash width={14} height={14} style={{ color: 'var(--ink-3)' }}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Catálogo ── */}
            {tab === 'catalog' && (
              <div className="card settings-card" style={{ padding: isCompact ? 16 : 24 }}>
                <div className="settings-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: isCompact ? 'stretch' : 'flex-start', marginBottom: 18, gap: 12, flexDirection: isCompact ? 'column' : undefined }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>Catálogo de prendas</div>
                    <div className="t-mute" style={{ fontSize: 12, marginTop: 2 }}>
                      Estas opciones alimentan los selectores de categoría y talla en Nuevo drop e Inventario.
                    </div>
                  </div>
                  <button onClick={handleResetearCatalogo} disabled={isPending} className="btn btn-outline btn-sm" style={{ color: 'var(--urgent)', borderColor: 'var(--urgent)', flexShrink: 0, width: isNarrow ? '100%' : undefined }}>
                    Restaurar defaults
                  </button>
                </div>
                <div className="settings-catalog-grid" style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: 14, alignItems: 'start' }}>
                  <>
                    <CatalogOptionsCard
                      title="Categorías"
                      description="Usalas para ordenar tu inventario y facilitar la búsqueda."
                      defaults={[]}
                      options={opcionesCatalogo.filter(option => option.tipo === 'categoria')}
                      tipo="categoria"
                      pending={isPending}
                      onAdd={handleAgregarOpcion}
                      onToggle={handleToggleOpcion}
                      onDelete={handleEliminarOpcion}
                    />
                    <CatalogOptionsCard
                      title="Tallas"
                      description="Agregá números, tallas especiales o formatos propios."
                      defaults={[]}
                      options={opcionesCatalogo.filter(option => option.tipo === 'talla')}
                      tipo="talla"
                      pending={isPending}
                      onAdd={handleAgregarOpcion}
                      onToggle={handleToggleOpcion}
                      onDelete={handleEliminarOpcion}
                    />
                  </>
                </div>
              </div>
            )}

            {/* ── Notificaciones ── */}
            {tab === 'notif' && (
              <div className="card settings-card" style={{ padding: isCompact ? 16 : 24 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Notificaciones a compradoras</div>
                <div className="t-mute" style={{ fontSize: 12, marginBottom: 18 }}>Canales por los que avisás tus próximos drops.</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {[
                    { t: 'WhatsApp', d: 'Mensaje 15 min antes de cada drop', on: true, icon: Icons.whatsapp },
                    { t: 'Correo electrónico', d: 'Resumen semanal + aviso de apertura', on: true, icon: Icons.mail },
                    { t: 'Push en navegador', d: 'Solo compradoras que la activaron', on: false, icon: Icons.bell },
                  ].map((m, i) => {
                    const Ic = m.icon;
                    return (
                      <div key={i} style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic width={14} height={14}/></div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{m.t}</div>
                          <div className="t-mute" style={{ fontSize: 11 }}>{m.d}</div>
                        </div>
                        <div style={{ width: 32, height: 18, borderRadius: 10, background: m.on ? 'var(--ink)' : 'var(--line)', position: 'relative', flexShrink: 0 }}>
                          <div style={{ position: 'absolute', top: 2, left: m.on ? 16 : 2, width: 14, height: 14, borderRadius: 7, background: '#fff', transition: 'left .15s' }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Suscripción ── */}
            {tab === 'sub' && (
              <div className="card settings-card" style={{ padding: isCompact ? 16 : 24 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Suscripción</div>
                <div className="t-mute" style={{ fontSize: 12, marginBottom: 20 }}>Plan actual y uso este mes.</div>
                <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 10, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: isNarrow ? 'stretch' : 'center', gap: 12, flexDirection: isNarrow ? 'column' : undefined }}>
                  <div>
                    <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.08, color: 'var(--ink-3)' }}>
                      Plan {tienda.plan ?? 'Starter'}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2, color: 'var(--ink-2)' }}>
                      {(tienda as { plan_status?: string | null }).plan_status === 'active'
                        ? 'Suscripción activa'
                        : tienda.plan === 'pro' ? 'Período de gracia' : 'Plan gratuito'}
                    </div>
                  </div>
                  <button className="btn btn-outline" onClick={() => router.push('/billing')}>
                    {tienda.plan === 'pro' ? 'Gestionar plan' : 'Mejorar a Pro'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#0a0a0a' : '#dc2626',
          color: '#fff', borderRadius: 10, padding: '10px 18px',
          fontSize: 13, fontWeight: 500, zIndex: 500,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap',
        }}>
          {toast.ok ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="7" fill="#22c55e"/><path d="M4 7l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="7" fill="#fff2f2"/><path d="M5 5l4 4M9 5l-4 4" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/></svg>
          )}
          {toast.msg}
        </div>
      )}

      {notice && (
        <FeedbackModal
          title={notice.title}
          message={notice.message}
          ok={notice.ok}
          onClose={() => setNotice(null)}
        />
      )}

      {/* Modales */}
      {editingEnvio !== null && (
        <EnvioModal m={editingEnvio} onClose={() => setEditingEnvio(null)} onSave={handleGuardarEnvio}/>
      )}
      {showAgregarPago && (
        <AgregarMetodoPagoModal onClose={() => setShowAgregarPago(false)} onSave={handleAgregarPago}/>
      )}
    </div>
  );
}
