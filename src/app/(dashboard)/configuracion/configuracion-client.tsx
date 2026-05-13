'use client';

import type { FormEvent } from 'react';
import { useEffect, useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/shared/icons';
import { PhoneInput } from '@/components/shared/phone-input';
import { uploadImage } from '@/lib/cloudinary/client';
import type { CatalogOptionTipo } from '@/lib/catalog-options';
import { getCountryDataList, getEmojiFlag } from 'countries-list';
import { USERNAME_CHANGE_LIMIT, normalizeStoreUsername } from '@/lib/stores/username';
import { formatCurrencyFree } from '@/lib/config/platform';
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
  guardarPixelPayCredenciales,
  guardarBoxfulCredenciales,
} from './actions';

type OpcionTipo = CatalogOptionTipo;

function getCurrencySymbol(code: string) {
  try {
    const parts = new Intl.NumberFormat('es', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0);
    return parts.find(p => p.type === 'currency')?.value ?? code;
  } catch { return code; }
}

const PAISES_CONFIG = getCountryDataList()
  .filter(c => c.currency?.length && c.phone?.length)
  .map(c => ({
    pais: c.name,
    moneda: c.currency[0],
    simbolo: getCurrencySymbol(c.currency[0]),
    telefono: `+${c.phone[0]}`,
    bandera: getEmojiFlag(c.iso2 as Parameters<typeof getEmojiFlag>[0]),
  }))
  .sort((a, b) => a.pais.localeCompare(b.pais, 'es'));

const MONEDAS_CONFIG = Array.from(
  new Map(PAISES_CONFIG.map(p => [p.moneda, { moneda: p.moneda, simbolo: p.simbolo }])).values()
).sort((a, b) => a.moneda.localeCompare(b.moneda));

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
      className="fixed inset-0 bg-[rgba(15,20,25,0.32)] flex items-center justify-center z-[520] p-[18px]"
    >
      <div onClick={event => event.stopPropagation()} className="w-[min(420px,100%)] bg-white rounded-[14px] shadow-[0_24px_70px_rgba(0,0,0,0.22)] p-[22px]">
        <div className="flex items-start gap-[14px]">
          <div
            className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0"
            style={{ background: ok ? '#ecfdf5' : '#fef2f2', color: ok ? '#047857' : '#dc2626' }}
          >
            {ok ? <Icons.check width={18} height={18} /> : <Icons.close width={18} height={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-bold">{title}</div>
            <div className="t-mute text-[13px] mt-[4px]">{message}</div>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost w-[28px] h-[28px] p-0 flex items-center justify-center">
            <Icons.close width={15} height={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  nombre,
  tipo,
  onConfirm,
  onCancel,
}: {
  nombre: string;
  tipo: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      className="fixed inset-0 bg-[rgba(15,20,25,0.32)] flex items-center justify-center z-[520] p-[18px]"
    >
      <div onClick={e => e.stopPropagation()} className="w-[min(400px,100%)] bg-white rounded-[16px] shadow-[0_24px_70px_rgba(0,0,0,0.22)] p-[24px]">
        <div className="w-[40px] h-[40px] rounded-[10px] bg-red-50 flex items-center justify-center mb-[14px]">
          <Icons.trash width={18} height={18} className="text-red-500" />
        </div>
        <div className="text-[16px] font-bold mb-[6px]">
          ¿Eliminar {tipo === 'categoria' ? 'categoría' : 'talla'}?
        </div>
        <div className="text-[13px] text-[var(--ink-3)] mb-[20px] leading-[1.5]">
          Estás por eliminar <span className="font-semibold text-[var(--ink)]">{nombre}</span>. Esta acción no se puede deshacer.
        </div>
        <div className="flex gap-[10px]">
          <button
            onClick={onConfirm}
            className="flex-1 h-[40px] rounded-[10px] bg-red-500 text-white text-[13px] font-semibold cursor-pointer"
          >
            Sí, eliminar
          </button>
          <button
            onClick={onCancel}
            className="flex-1 h-[40px] rounded-[10px] border border-[var(--line)] text-[var(--ink)] text-[13px] font-medium cursor-pointer bg-white"
          >
            Cancelar
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
    <div className="settings-modal-overlay fixed inset-0 bg-[rgba(15,20,25,0.42)] flex items-center justify-center z-[300]" onClick={onClose}>
      <div className="settings-modal-panel w-[520px] bg-white rounded-[16px] flex flex-col shadow-[0_30px_80px_rgba(0,0,0,0.2)]" onClick={e => e.stopPropagation()}>
        <div className="px-[22px] py-[18px] border-b border-[var(--line)] flex items-center justify-between">
          <div className="text-[16px] font-semibold">{m?.id ? 'Editar método de envío' : 'Nuevo método de envío'}</div>
          <button onClick={onClose} className="text-[var(--ink-3)]"><Icons.close width={16} height={16} /></button>
        </div>
        <div className="p-[22px] grid gap-[14px]">
          <div className="settings-modal-grid-2 grid grid-cols-[2fr_1fr] gap-[12px]">
            <div>
              <label className="label">Nombre público</label>
              <input className="input" value={form.nombre} onChange={e => change('nombre', e.target.value)} placeholder="Envío a todo el país" />
            </div>
            <div>
              <label className="label">Precio (L)</label>
              <input className="input mono tnum" type="number" min={0} value={form.precio} onChange={e => change('precio', Number(e.target.value))} />
            </div>
          </div>
          <div className="settings-modal-grid-2 grid grid-cols-2 gap-[12px]">
            <div>
              <label className="label">Empresa / Proveedor</label>
              <input className="input" value={form.proveedor} onChange={e => change('proveedor', e.target.value)} placeholder="C807 Xpress" />
            </div>
            <div>
              <label className="label">Tiempo estimado</label>
              <input className="input" value={form.tiempo_estimado} onChange={e => change('tiempo_estimado', e.target.value)} placeholder="3 días laborales" />
            </div>
          </div>
          <div className="settings-modal-grid-2 grid grid-cols-2 gap-[12px]">
            <div>
              <label className="label">Zona de cobertura</label>
              <input className="input" value={form.cobertura} onChange={e => change('cobertura', e.target.value)} placeholder="Todos los departamentos" />
            </div>
            <div>
              <label className="label">URL de rastreo</label>
              <input className="input" value={form.tracking_url} onChange={e => change('tracking_url', e.target.value)} placeholder="https://proveedor.com/track?id=" />
            </div>
          </div>
        </div>
        <div className="settings-modal-footer px-[22px] py-[14px] border-t border-[var(--line)] flex justify-end gap-[8px]">
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
    <div className="settings-modal-overlay fixed inset-0 bg-[rgba(15,20,25,0.42)] flex items-center justify-center z-[300]" onClick={onClose}>
      <div className="settings-modal-panel w-[480px] bg-white rounded-[16px] flex flex-col shadow-[0_30px_80px_rgba(0,0,0,0.2)]" onClick={e => e.stopPropagation()}>
        <div className="px-[22px] py-[18px] border-b border-[var(--line)] flex items-center justify-between">
          <div className="text-[16px] font-semibold">Agregar método de pago</div>
          <button onClick={onClose} className="text-[var(--ink-3)]"><Icons.close width={16} height={16} /></button>
        </div>
        <div className="p-[22px] grid gap-[14px]">
          <div>
            <label className="label">Tipo</label>
            <div className="settings-modal-grid-2 grid grid-cols-2 gap-[8px]">
              {(['tarjeta', 'transferencia'] as const).map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t, nombre: t === 'tarjeta' ? 'PixelPay' : '', proveedor: t === 'tarjeta' ? 'pixelpay' : '' }))} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${form.tipo === t ? 'var(--ink)' : 'var(--line)'}`, background: form.tipo === t ? 'var(--ink)' : '#fff', color: form.tipo === t ? '#fff' : 'var(--ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  {t === 'tarjeta' ? 'Tarjeta (PixelPay)' : 'Transferencia bancaria'}
                </button>
              ))}
            </div>
          </div>
          {form.tipo === 'tarjeta' ? (
            <div className="text-[12px] text-[var(--ink-2)] p-[10px] rounded-[8px] bg-[var(--surface-2)] border border-[var(--line)]">
              Se agregará PixelPay como método de tarjeta. Configurá tus credenciales en la sección <strong>Conectar PixelPay</strong> debajo.
            </div>
          ) : (
            <>
              <div><label className="label">Nombre público</label><input className="input" value={form.nombre} onChange={e => change('nombre', e.target.value)} placeholder="Banco Ficohsa" /></div>
              <div><label className="label">Proveedor / Banco</label><input className="input" value={form.proveedor} onChange={e => change('proveedor', e.target.value)} placeholder="ficohsa" /></div>
              <div><label className="label">Número de cuenta · Titular</label><input className="input" value={form.detalle} onChange={e => change('detalle', e.target.value)} placeholder="123-456-7890 · María López" /></div>
            </>
          )}
        </div>
        <div className="settings-modal-footer px-[22px] py-[14px] border-t border-[var(--line)] flex justify-end gap-[8px]">
          <button onClick={onClose} className="btn btn-outline">Cancelar</button>
          <button onClick={() => (form.tipo === 'tarjeta' || (form.nombre && form.proveedor)) && onSave(form)} className="btn btn-primary">Agregar</button>
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
    <div className="settings-catalog-card border border-[var(--line)] rounded-[12px] overflow-hidden bg-white">
      <div className="p-[16px] border-b border-[var(--line)] flex gap-[12px] items-start">
        <div className="w-[34px] h-[34px] rounded-[8px] bg-[var(--surface-2)] flex items-center justify-center shrink-0">
          {tipo === 'categoria' ? <Icons.grid width={15} height={15} /> : <Icons.box width={15} height={15} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold">{title}</div>
          <div className="t-mute text-[12px] mt-[2px]">{description}</div>
        </div>
      </div>

      <div className="p-[16px] grid gap-[16px]">
        <form onSubmit={handleSubmit} className="grid gap-[4px]">
          <div className="settings-catalog-add-row flex gap-[8px]">
            <input
              className="input"
              value={nombre}
              onChange={e => { setNombre(e.target.value); if (inputError) setInputError(''); }}
              placeholder={tipo === 'categoria' ? 'Ej. Carteras, Ropa deportiva…' : 'Ej. 14, Plus, Petite…'}
              style={{ height: 38, borderColor: inputError ? 'var(--urgent)' : undefined }}
            />
            <button className="btn btn-primary btn-sm h-[38px] shrink-0" disabled={pending || !nombre.trim()}>
              <Icons.plus width={13} height={13} /> Agregar
            </button>
          </div>
          {inputError && <div className="text-[11px] text-[var(--urgent)]">{inputError}</div>}
        </form>

        {visibleBaseRows.length > 0 && (
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)] mb-[8px]">Base del sistema</div>
            <div className="flex flex-wrap gap-[6px]">
              {visibleBaseRows.map(row => (
                <span key={row.nombre} className="inline-flex items-center gap-[7px] py-[5px] pr-[7px] pl-[8px] border border-[var(--line)] rounded-[7px] text-[12px] text-[var(--ink-2)] bg-[var(--surface-2)]">
                  {row.nombre}
                  <span className="mono text-[9px] text-[var(--ink-3)] uppercase">Base</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)] mb-[8px]">Tus opciones</div>
          {customOptions.length === 0 ? (
            <div className="px-[12px] py-[18px] border border-dashed border-[var(--line)] rounded-[10px] text-center text-[var(--ink-3)] text-[12px]">
              Agregá opciones propias cuando necesités vender una categoría o talla nueva.
            </div>
          ) : (
            <div className="grid gap-[8px]">
              {customOptions.map(option => (
                <div key={option.id} className="flex items-center gap-[10px] px-[12px] py-[10px] border border-[var(--line)] rounded-[10px]">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">{option.nombre}</div>
                    <div className="t-mute text-[11px]">{option.activo ? 'Disponible en formularios' : 'Oculta temporalmente'}</div>
                  </div>
                  <button
                    onClick={() => onToggle(option.id, !option.activo)}
                    type="button"
                    aria-label={option.activo ? `Ocultar ${option.nombre}` : `Activar ${option.nombre}`}
                    className="w-[32px] h-[18px] rounded-[10px] relative shrink-0 cursor-pointer border-none"
                    style={{ background: option.activo ? 'var(--ink)' : 'var(--line)' }}
                  >
                    <div className="absolute top-[2px] w-[14px] h-[14px] rounded-[7px] bg-white transition-[left] duration-150" style={{ left: option.activo ? 16 : 2 }} />
                  </button>
                  <button type="button" onClick={() => onDelete(option.id)} className="btn-ghost p-[4px]">
                    <Icons.trash width={14} height={14} className="text-[var(--ink-3)]" />
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
  const [pixelpayForm, setPixelpayForm] = useState({
    sandbox: tienda.pixelpay_sandbox ?? true,
    enabled: tienda.pixelpay_enabled ?? false,
    endpoint: tienda.pixelpay_endpoint ?? '',
    keyId: tienda.pixelpay_key_id ?? '',
    secretKey: '',
  });
  const [boxfulForm, setBoxfulForm] = useState({
    enabled: tienda.boxful_enabled ?? false,
    email: tienda.boxful_email ?? '',
    password: '',
  });
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string; ok: boolean } | null>(null);
  const [confirmDeleteOpcion, setConfirmDeleteOpcion] = useState<{ id: string; nombre: string; tipo: OpcionTipo } | null>(null);

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
    pais: tienda.pais ?? 'Honduras',
    moneda: tienda.moneda ?? 'HNL',
    simbolo_moneda: tienda.simbolo_moneda ?? 'L',
    codigo_telefono: tienda.codigo_telefono ?? '+504',
  });

  const [boxfulStates, setBoxfulStates] = useState<Array<{ id: string; name: string; cities: Array<{ id: string; name: string }> }>>([]);
  useEffect(() => {
    fetch('/api/boxful/states').then(r => r.json()).then(data => {
      setBoxfulStates(data.states ?? []);
    }).catch(() => { });
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

  const handleGuardarPixelPay = () => {
    startTransition(async () => {
      const res = await guardarPixelPayCredenciales(pixelpayForm);
      if (!res.error) showToast('Configuración de PixelPay guardada');
      else showToast(res.error, false);
    });
  };

  const handleGuardarBoxful = () => {
    startTransition(async () => {
      const res = await guardarBoxfulCredenciales(boxfulForm);
      if (!res.error) showToast('Configuración de Boxful guardada');
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
    if (!actual) return;
    setConfirmDeleteOpcion({ id, nombre: actual.nombre, tipo: actual.tipo as OpcionTipo });
  };

  const doEliminarOpcion = () => {
    if (!confirmDeleteOpcion) return;
    const { id } = confirmDeleteOpcion;
    const actual = opcionesCatalogo.find(item => item.id === id);
    setConfirmDeleteOpcion(null);
    setOpcionesCatalogo(items => items.filter(item => item.id !== id));
    startTransition(async () => {
      const res = await eliminarOpcionCatalogo(id);
      if (res.error) {
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
    <div ref={shellRef} className="settings-shell h-full flex flex-col overflow-hidden">
      <div className="settings-header border-b border-[var(--line)] shrink-0" style={{ padding: isCompact ? '18px 16px 14px' : '20px 28px 16px' }}>
        <div className="text-[20px] font-semibold tracking-[-0.015em]">Configuración</div>
        <div className="t-mute text-[13px] mt-[3px]">{tienda.nombre} · @{tienda.username}</div>
      </div>

      <div className="settings-content" style={{ flex: 1, overflowY: 'auto', padding: isCompact ? '14px 14px 120px' : '24px 28px', background: 'var(--bg)' }}>
        <div className="dash-settings-grid settings-layout-grid" style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '220px 1fr', gap: isCompact ? 14 : 28, maxWidth: 960, margin: '0 auto' }}>

          {/* Nav */}
          <nav className="settings-tabs" style={{ display: isCompact ? 'flex' : 'grid', gap: isCompact ? 6 : 2, alignSelf: 'start', overflowX: isCompact ? 'auto' : undefined, paddingBottom: isCompact ? 2 : undefined }}>
            {tabs.map(n => (
              <button key={n.id} onClick={() => setTab(n.id)} className="px-[10px] py-[7px] text-left rounded-[6px] text-[13px]" style={{
                background: tab === n.id ? 'var(--surface-2)' : 'transparent',
                fontWeight: tab === n.id ? 500 : 400,
                color: tab === n.id ? 'var(--ink)' : 'var(--ink-2)',
                flex: isCompact ? '0 0 auto' : undefined,
                whiteSpace: isCompact ? 'nowrap' : undefined,
              }}>{n.t}</button>
            ))}
          </nav>

          <div className="settings-main grid gap-[16px] min-w-0">

            {/* ── Info tienda ── */}
            {tab === 'shop' && (
              <div className="card settings-card" style={{ padding: isCompact ? 16 : 24 }}>
                <div className="text-[15px] font-semibold mb-[4px]">Info pública</div>
                <div className="t-mute text-[12px] mb-[20px]">Esto es lo que ven tus compradoras.</div>

                {/* Logo */}
                <div className="settings-logo-row" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20, flexDirection: isNarrow ? 'column' : undefined }}>
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img loading="lazy" src={logoPreview} alt="logo" className="w-[64px] h-[64px] rounded-[32px] object-cover shrink-0" />
                  ) : (
                    <div className="w-[64px] h-[64px] rounded-[32px] bg-[#e4d4d0] flex items-center justify-center text-[16px] font-semibold shrink-0">{initials}</div>
                  )}
                  <div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
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
                  <div><label className="label">Nombre de tienda</label><input className="input" value={infoForm.nombre} onChange={e => setInfoForm(f => ({ ...f, nombre: e.target.value }))} /></div>
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
                    <label className="label flex items-center gap-[6px]">
                      WhatsApp de la tienda
                    </label>
                    <PhoneInput
                      value={infoForm.whatsapp}
                      onChange={v => setInfoForm(f => ({ ...f, whatsapp: v }))}
                    />
                    <div className="help">Número donde recibirás el aviso de nuevos pedidos por WhatsApp.</div>
                  </div>
                  <div style={{ gridColumn: isCompact ? 'auto' : 'span 2' }}><label className="label">Bio</label><textarea className="input h-[72px] p-[10px] resize-none" value={infoForm.bio} onChange={e => setInfoForm(f => ({ ...f, bio: e.target.value }))} /></div>
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
                    <input className="input" placeholder="Ej: Col. Los Andes, calle principal" value={infoForm.ubicacion} onChange={e => setInfoForm(f => ({ ...f, ubicacion: e.target.value }))} />
                    <div className="help">Se muestra en el perfil de la tienda.</div>
                  </div>
                  <div style={{ gridColumn: isCompact ? 'auto' : 'span 2', borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 2 }}>
                    <div className="text-[13px] font-semibold mb-[12px] text-[var(--ink-2)]">Región y moneda</div>
                    <div className="grid gap-3" style={{ gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr 1fr' }}>
                      <div>
                        <label className="label">País</label>
                        <select
                          className="input"
                          value={PAISES_CONFIG.some(p => p.pais === infoForm.pais) ? infoForm.pais : PAISES_CONFIG[0].pais}
                          onChange={e => {
                            const found = PAISES_CONFIG.find(p => p.pais === e.target.value);
                            if (found) setInfoForm(f => ({ ...f, pais: found.pais, moneda: found.moneda, simbolo_moneda: found.simbolo, codigo_telefono: found.telefono }));
                          }}
                        >
                          {PAISES_CONFIG.map(p => (
                            <option key={p.pais} value={p.pais}>{p.bandera} {p.pais}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Moneda (ISO)</label>
                        <select
                          className="input"
                          value={infoForm.moneda}
                          onChange={e => {
                            const found = MONEDAS_CONFIG.find(m => m.moneda === e.target.value);
                            if (found) setInfoForm(f => ({ ...f, moneda: found.moneda, simbolo_moneda: found.simbolo }));
                          }}
                        >
                          {MONEDAS_CONFIG.map(m => (
                            <option key={m.moneda} value={m.moneda}>{m.moneda}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Símbolo</label>
                        <input className="input" value={infoForm.simbolo_moneda} onChange={e => setInfoForm(f => ({ ...f, simbolo_moneda: e.target.value }))} placeholder="L" />
                      </div>
                    </div>
                  </div>
                  <div style={{ gridColumn: isCompact ? 'auto' : 'span 2', borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 2 }}>
                    <div className="text-[13px] font-semibold mb-[12px] text-[var(--ink-2)]">Redes sociales</div>
                    <div className="settings-social-grid" style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
                      <div>
                        <label className="label flex items-center gap-[6px]">
                          <Icons.ig width={13} height={13} /> Instagram
                        </label>
                        <input className="input" placeholder="@tutienda" value={infoForm.instagram} onChange={e => setInfoForm(f => ({ ...f, instagram: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label flex items-center gap-[6px]">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg> Facebook
                        </label>
                        <input className="input" placeholder="facebook.com/tutienda" value={infoForm.facebook} onChange={e => setInfoForm(f => ({ ...f, facebook: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label flex items-center gap-[6px]">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" /></svg> TikTok
                        </label>
                        <input className="input" placeholder="@tutienda" value={infoForm.tiktok} onChange={e => setInfoForm(f => ({ ...f, tiktok: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-[20px] flex justify-end">
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
                    <div className="text-[15px] font-semibold">Métodos de pago</div>
                    <div className="t-mute text-[12px]">Tus compradoras verán estas opciones al pagar.</div>
                  </div>
                  <button onClick={() => setShowAgregarPago(true)} className="btn btn-outline btn-sm" style={{ width: isNarrow ? '100%' : undefined }}><Icons.plus width={13} height={13} /> Agregar</button>
                </div>
                {metodosPago.length === 0 ? (
                  <div className="py-[32px] text-center text-[var(--ink-3)] text-[13px]">No tenés métodos de pago configurados.</div>
                ) : (
                  <div className="grid gap-[8px]">
                    {metodosPago.map(m => {
                      const Ic = m.tipo === 'tarjeta' ? Icons.card : Icons.bank;
                      return (
                        <div className="settings-method-row px-[14px] py-[12px] border border-[var(--line)] rounded-[10px] flex items-center gap-[12px]" key={m.id} style={{ flexWrap: isNarrow ? 'wrap' : undefined }}>
                          <div className="w-[32px] h-[32px] rounded-[6px] bg-[var(--surface-2)] flex items-center justify-center"><Ic width={14} height={14} /></div>
                          <div className="flex-1">
                            <div className="text-[13px] font-medium">{m.nombre}</div>
                            <div className="t-mute text-[11px]">{m.detalle ?? m.proveedor}</div>
                          </div>
                          <button onClick={() => handleTogglePago(m.id, !m.activo)} className="w-[32px] h-[18px] rounded-[10px] relative shrink-0 cursor-pointer border-none" style={{ background: m.activo ? 'var(--ink)' : 'var(--line)' }}>
                            <div className="absolute top-[2px] w-[14px] h-[14px] rounded-[7px] bg-white transition-[left] duration-150" style={{ left: m.activo ? 16 : 2 }} />
                          </button>
                          <button onClick={() => handleEliminarPago(m.id)} className="btn-ghost p-[4px]">
                            <Icons.trash width={14} height={14} className="text-[var(--ink-3)]" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Conectar PixelPay ── */}
            {tab === 'pay' && (
              <div className="card settings-card mt-[12px]" style={{ padding: isCompact ? 16 : 24 }}>
                <div className="flex items-center justify-between mb-[16px] gap-[12px]">
                  <div>
                    <div className="text-[15px] font-semibold flex items-center gap-[8px]">
                      <Icons.card width={15} height={15} className="text-[var(--ink-2)]" />
                      Conectar PixelPay
                    </div>
                    <div className="t-mute text-[12px] mt-[2px]">Procesá pagos con tarjeta directamente en tu tienda.</div>
                  </div>
                  <button
                    onClick={() => setPixelpayForm(f => ({ ...f, enabled: !f.enabled }))}
                    className="w-[32px] h-[18px] rounded-[10px] relative shrink-0 cursor-pointer border-none"
                    style={{ background: pixelpayForm.enabled ? 'var(--ink)' : 'var(--line)' }}
                  >
                    <div className="absolute top-[2px] w-[14px] h-[14px] rounded-[7px] bg-white transition-[left] duration-150" style={{ left: pixelpayForm.enabled ? 16 : 2 }} />
                  </button>
                </div>

                <div className="grid gap-[12px]">
                  <div className="flex items-center justify-between p-[12px] rounded-[10px] bg-[var(--surface-2)]">
                    <span className="text-[13px] font-medium">Modo sandbox (pruebas)</span>
                    <button
                      onClick={() => setPixelpayForm(f => ({ ...f, sandbox: !f.sandbox }))}
                      className="w-[32px] h-[18px] rounded-[10px] relative shrink-0 cursor-pointer border-none"
                      style={{ background: pixelpayForm.sandbox ? 'var(--ink)' : 'var(--line)' }}
                    >
                      <div className="absolute top-[2px] w-[14px] h-[14px] rounded-[7px] bg-white transition-[left] duration-150" style={{ left: pixelpayForm.sandbox ? 16 : 2 }} />
                    </button>
                  </div>

                  {pixelpayForm.sandbox && (
                    <div className="text-[12px] text-[var(--ink-2)] p-[10px] rounded-[8px] bg-[var(--surface-2)] border border-[var(--line)]">
                      En modo sandbox no se procesan pagos reales. Usá la tarjeta de prueba <span className="mono font-medium">4111 1111 1111 1111</span>.
                    </div>
                  )}

                  {!pixelpayForm.sandbox && (
                    <div className="grid gap-[10px]">
                      <div>
                        <label className="label">Endpoint (URL del comercio)</label>
                        <input
                          className="input"
                          value={pixelpayForm.endpoint}
                          onChange={e => setPixelpayForm(f => ({ ...f, endpoint: e.target.value }))}
                          placeholder="https://tucomercio.pixelpay.app"
                        />
                      </div>
                      <div>
                        <label className="label">Key ID (ID de comercio)</label>
                        <input
                          className="input"
                          value={pixelpayForm.keyId}
                          onChange={e => setPixelpayForm(f => ({ ...f, keyId: e.target.value }))}
                          placeholder="123456"
                        />
                      </div>
                      <div>
                        <label className="label">Secret Key</label>
                        <input
                          className="input"
                          type="password"
                          value={pixelpayForm.secretKey}
                          onChange={e => setPixelpayForm(f => ({ ...f, secretKey: e.target.value }))}
                          placeholder="••••••••••••"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleGuardarPixelPay}
                    disabled={isPending}
                    className="btn btn-primary btn-sm"
                  >
                    Guardar configuración
                  </button>
                </div>
              </div>
            )}

            {/* ── Métodos de envío ── */}
            {tab === 'ship' && (
              <div className="card settings-card" style={{ padding: isCompact ? 16 : 24 }}>
                <div className="settings-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: isCompact ? 'stretch' : 'flex-start', marginBottom: 18, gap: 12, flexDirection: isCompact ? 'column' : undefined }}>
                  <div>
                    <div className="text-[15px] font-semibold">Métodos de envío</div>
                    <div className="t-mute text-[12px] mt-[2px]">Vos definís con qué empresas enviás y cuánto cobrás.</div>
                  </div>
                  <button onClick={() => setEditingEnvio({})} className="btn btn-outline btn-sm" style={{ width: isNarrow ? '100%' : undefined }}>
                    <Icons.plus width={13} height={13} /> Nuevo método
                  </button>
                </div>
                {metodosEnvio.length === 0 ? (
                  <div className="py-[40px] text-center text-[var(--ink-3)] text-[13px]">
                    No tenés métodos de envío configurados.<br />
                    <button onClick={() => setEditingEnvio({})} className="btn btn-outline btn-sm mt-[12px]">+ Agregar primero</button>
                  </div>
                ) : (
                  <div className="grid gap-[10px]">
                    {metodosEnvio.map(m => (
                      <div key={m.id} className="px-[16px] py-[14px] border border-[var(--line)] rounded-[12px] bg-white">
                        <div className="settings-shipping-row flex items-start gap-[14px]" style={{ flexDirection: isNarrow ? 'column' : undefined }}>
                          <div className="w-[38px] h-[38px] rounded-[8px] bg-[var(--surface-2)] flex items-center justify-center shrink-0">
                            <Icons.truck width={16} height={16} className="text-[var(--ink-2)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-[10px] flex-wrap">
                              <div className="text-[14px] font-semibold">{m.nombre}</div>
                              <span className="mono tnum text-[13px] font-medium">{formatCurrencyFree(m.precio)}</span>
                              {!m.activo && <span className="badge">Inactivo</span>}
                            </div>
                            <div className="t-mute text-[12px] mt-[2px]">{m.proveedor} · {m.tiempo_estimado}</div>
                            <div className="t-mute text-[12px]">{m.cobertura}</div>
                          </div>
                          <div className="flex gap-[6px] shrink-0 items-center" style={{ alignSelf: isNarrow ? 'stretch' : undefined, justifyContent: isNarrow ? 'flex-end' : undefined, width: isNarrow ? '100%' : undefined }}>
                            <button onClick={() => handleToggleEnvio(m.id, !m.activo)} className="w-[32px] h-[18px] rounded-[10px] relative shrink-0 cursor-pointer border-none" style={{ background: m.activo ? 'var(--ink)' : 'var(--line)' }}>
                              <div className="absolute top-[2px] w-[14px] h-[14px] rounded-[7px] bg-white transition-[left] duration-150" style={{ left: m.activo ? 16 : 2 }} />
                            </button>
                            <button onClick={() => setEditingEnvio(m)} className="btn-ghost p-[4px]">
                              <Icons.edit width={14} height={14} className="text-[var(--ink-3)]" />
                            </button>
                            <button onClick={() => handleEliminarEnvio(m.id)} className="btn-ghost p-[4px]">
                              <Icons.trash width={14} height={14} className="text-[var(--ink-3)]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Conectar Boxful ── */}
            {tab === 'ship' && (
              <div className="card settings-card mt-[12px]" style={{ padding: isCompact ? 16 : 24 }}>
                <div className="flex items-center justify-between mb-[16px] gap-[12px]">
                  <div>
                    <div className="text-[15px] font-semibold flex items-center gap-[8px]">
                      <Icons.truck width={15} height={15} className="text-[var(--ink-2)]" />
                      Conectar Boxful
                    </div>
                    <div className="t-mute text-[12px] mt-[2px]">Generá guías y rastreá envíos con tu cuenta de Boxful.</div>
                  </div>
                  <button
                    onClick={() => setBoxfulForm(f => ({ ...f, enabled: !f.enabled }))}
                    className="w-[32px] h-[18px] rounded-[10px] relative shrink-0 cursor-pointer border-none"
                    style={{ background: boxfulForm.enabled ? 'var(--ink)' : 'var(--line)' }}
                  >
                    <div className="absolute top-[2px] w-[14px] h-[14px] rounded-[7px] bg-white transition-[left] duration-150" style={{ left: boxfulForm.enabled ? 16 : 2 }} />
                  </button>
                </div>

                {boxfulForm.enabled && (
                  <div className="grid gap-[10px]">
                    <div>
                      <label className="label">Email de Boxful</label>
                      <input
                        className="input"
                        type="email"
                        value={boxfulForm.email}
                        onChange={e => setBoxfulForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="tu@email.com"
                      />
                    </div>
                    <div>
                      <label className="label">Contraseña de Boxful</label>
                      <input
                        className="input"
                        type="password"
                        value={boxfulForm.password}
                        onChange={e => setBoxfulForm(f => ({ ...f, password: e.target.value }))}
                        placeholder={tienda.boxful_email ? '••••••••' : 'Tu contraseña'}
                      />
                      {tienda.boxful_email && <div className="help mt-[4px]">Dejá vacío para mantener la contraseña actual.</div>}
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-[16px]">
                  <button onClick={handleGuardarBoxful} disabled={isPending} className="btn btn-primary btn-sm">
                    Guardar configuración
                  </button>
                </div>
              </div>
            )}

            {/* ── Catálogo ── */}
            {tab === 'catalog' && (
              <div className="card settings-card" style={{ padding: isCompact ? 16 : 24 }}>
                <div className="settings-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: isCompact ? 'stretch' : 'flex-start', marginBottom: 18, gap: 12, flexDirection: isCompact ? 'column' : undefined }}>
                  <div>
                    <div className="text-[15px] font-semibold">Catálogo de prendas</div>
                    <div className="t-mute text-[12px] mt-[2px]">
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
                <div className="text-[15px] font-semibold mb-[4px]">Notificaciones a compradoras</div>
                <div className="t-mute text-[12px] mb-[18px]">Canales por los que avisás tus próximos drops.</div>
                <div className="grid gap-[8px]">
                  {[
                    { t: 'WhatsApp', d: 'Mensaje 15 min antes de cada drop', on: true, icon: Icons.whatsapp },
                    { t: 'Correo electrónico', d: 'Resumen semanal + aviso de apertura', on: true, icon: Icons.mail },
                    { t: 'Push en navegador', d: 'Solo compradoras que la activaron', on: false, icon: Icons.bell },
                  ].map((m, i) => {
                    const Ic = m.icon;
                    return (
                      <div key={i} className="px-[14px] py-[12px] border border-[var(--line)] rounded-[10px] flex items-center gap-[12px]">
                        <div className="w-[32px] h-[32px] rounded-[6px] bg-[var(--surface-2)] flex items-center justify-center"><Ic width={14} height={14} /></div>
                        <div className="flex-1">
                          <div className="text-[13px] font-medium">{m.t}</div>
                          <div className="t-mute text-[11px]">{m.d}</div>
                        </div>
                        <div className="w-[32px] h-[18px] rounded-[10px] relative shrink-0" style={{ background: m.on ? 'var(--ink)' : 'var(--line)' }}>
                          <div className="absolute top-[2px] w-[14px] h-[14px] rounded-[7px] bg-white transition-[left] duration-150" style={{ left: m.on ? 16 : 2 }} />
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
                <div className="text-[15px] font-semibold mb-[4px]">Suscripción</div>
                <div className="t-mute text-[12px] mb-[20px]">Plan actual y uso este mes.</div>
                <div className="p-[16px] bg-[var(--surface-2)] rounded-[10px] mb-[12px] flex justify-between gap-[12px]" style={{ alignItems: isNarrow ? 'stretch' : 'center', flexDirection: isNarrow ? 'column' : undefined }}>
                  <div>
                    <div className="mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
                      Plan {tienda.plan ?? 'Starter'}
                    </div>
                    <div className="text-[15px] font-semibold mt-[2px] text-[var(--ink-2)]">
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
        <div
          className="fixed bottom-[28px] left-1/2 -translate-x-1/2 text-white rounded-[10px] px-[18px] py-[10px] text-[13px] font-medium z-[500] flex items-center gap-[8px] shadow-[0_4px_20px_rgba(0,0,0,0.25)] whitespace-nowrap"
          style={{ background: toast.ok ? '#0a0a0a' : '#dc2626' }}
        >
          {toast.ok ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="7" fill="#22c55e" /><path d="M4 7l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="7" fill="#fff2f2" /><path d="M5 5l4 4M9 5l-4 4" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" /></svg>
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
        <EnvioModal m={editingEnvio} onClose={() => setEditingEnvio(null)} onSave={handleGuardarEnvio} />
      )}
      {showAgregarPago && (
        <AgregarMetodoPagoModal onClose={() => setShowAgregarPago(false)} onSave={handleAgregarPago} />
      )}
      {confirmDeleteOpcion && (
        <ConfirmDeleteModal
          nombre={confirmDeleteOpcion.nombre}
          tipo={confirmDeleteOpcion.tipo}
          onConfirm={doEliminarOpcion}
          onCancel={() => setConfirmDeleteOpcion(null)}
        />
      )}
    </div>
  );
}
