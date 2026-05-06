'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Icons } from '@/components/shared/icons';
import { Ph } from '@/components/shared/image-placeholder';
import { CountdownTimer } from '@/components/drops/countdown-timer';
import { BuyerCheckoutAccess } from '@/components/buyer/buyer-checkout-access';
import type { BuyerProfile } from '@/components/buyer/buyer-auth-modal';
import type { MetodoPago, MetodoEnvio } from '@/types/envio';
import { Alert } from '@/components/shared/alert';
import { PLATFORM, formatCurrency, formatCurrencyFree } from '@/lib/config/platform';
import type { BoxfulQuote, BoxfulShippingMode, BoxfulState } from '@/lib/boxful/types';
import { PhoneInput } from '@/components/shared/phone-input';

const BOXFUL_ID = 'boxful';

export type BoxfulChangeData = {
  isBoxful: boolean;
  quote: BoxfulQuote | null;
  destination: { stateId: string; stateName: string; cityId: string; cityName: string } | null;
  mode: BoxfulShippingMode;
};

export type CheckoutPrenda = {
  id: string;
  nombre: string;
  marca: string | null;
  precio: number;
  fotos: string[] | null;
};

/* ──────── RESUMEN DE LÍNEAS ──────── */
export function ResumenLineas({ precio, costoEnvio, total }: { precio: number; costoEnvio: number; total: number }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>
        <span>Subtotal</span><span className="mono tnum">{formatCurrency(precio)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>
        <span>Envío</span><span className="mono tnum">{formatCurrencyFree(costoEnvio)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700 }}>
        <span>Total</span>
        <span><span style={{ fontSize: 11, color: 'var(--ink-3)', marginRight: 3 }}>{PLATFORM.currency}</span><span className="mono tnum">{formatCurrency(total)}</span></span>
      </div>
    </>
  );
}

/* ──────── MINIATURA DE PRENDA ──────── */
function PrendaSummary({ prenda, tallaSeleccionada, costoEnvio, total }: {
  prenda: CheckoutPrenda;
  tallaSeleccionada: string | null;
  costoEnvio: number;
  total: number;
}) {
  return (
    <div className="buyer-checkout-summary" style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 56, height: 70, borderRadius: 8, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
          {prenda.fotos?.[0]
            ? <Image src={prenda.fotos[0]} alt="" fill sizes="56px" style={{ objectFit: 'cover' }} />
            : <Ph tone="rose" aspect="4/5" radius={0} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{prenda.nombre}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{prenda.marca}{tallaSeleccionada ? ` · Talla ${tallaSeleccionada}` : ''}</div>
        </div>
        <div className="mono tnum" style={{ fontSize: 15, fontWeight: 700 }}>{formatCurrency(prenda.precio)}</div>
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '12px 0' }} />
      <ResumenLineas precio={prenda.precio} costoEnvio={costoEnvio} total={total} />
    </div>
  );
}

/* ──────── BOXFUL ADDRESS FIELDS (departamento + ciudad + cotización) ──────── */
export function BoxfulAddressFields({ originCity, itemsCount, subtotal, onBoxfulChange, onCiudadChange }: {
  originCity?: string | null;
  itemsCount: number;
  subtotal: number;
  onBoxfulChange: (data: BoxfulChangeData) => void;
  onCiudadChange?: (ciudad: string) => void;
}) {
  const boxfulMode: BoxfulShippingMode = 'boxful_dropoff';
  const [boxfulStates, setBoxfulStates] = useState<BoxfulState[]>([]);
  const [boxfulStateId, setBoxfulStateId] = useState('');
  const [boxfulCityId, setBoxfulCityId] = useState('');
  const [boxfulQuote, setBoxfulQuote] = useState<BoxfulQuote | null>(null);
  const [boxfulQuoteLoading, setBoxfulQuoteLoading] = useState(false);
  const [boxfulQuoteError, setBoxfulQuoteError] = useState('');

  const boxfulState = boxfulStates.find(s => s.id === boxfulStateId) ?? null;
  const boxfulCity = boxfulState?.cities.find(c => c.id === boxfulCityId) ?? null;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/boxful/states')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((payload: { states?: BoxfulState[] }) => {
        if (cancelled) return;
        setBoxfulStates(payload.states ?? []);
      })
      .catch(() => { if (!cancelled) setBoxfulStates([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!boxfulState || !boxfulCity) return;
    const ctrl = new AbortController();
    setBoxfulQuoteLoading(true);
    setBoxfulQuoteError('');
    fetch('/api/boxful/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: boxfulMode,
        originCityName: originCity ?? PLATFORM.defaultCity,
        destinationStateId: boxfulState.id,
        destinationStateName: boxfulState.name,
        destinationCityId: boxfulCity.id,
        destinationCityName: boxfulCity.name,
        itemsCount,
        subtotal,
      }),
      signal: ctrl.signal,
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((payload: { quote?: BoxfulQuote; error?: string }) => {
        const q = payload.quote ?? null;
        setBoxfulQuote(q);
        setBoxfulQuoteError(payload.error ?? '');
        onBoxfulChange({
          isBoxful: true, quote: q, mode: boxfulMode,
          destination: { stateId: boxfulState!.id, stateName: boxfulState!.name, cityId: boxfulCity!.id, cityName: boxfulCity!.name },
        });
      })
      .catch(err => {
        if (err?.name !== 'AbortError') {
          setBoxfulQuote(null);
          setBoxfulQuoteError('No pudimos calcular el envío. Probá otra ciudad.');
          onBoxfulChange({ isBoxful: true, quote: null, destination: null, mode: boxfulMode });
        }
      })
      .finally(() => setBoxfulQuoteLoading(false));
    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxfulStateId, boxfulCityId]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="buyer-checkout-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="label">Departamento</label>
          <select className="input input-lg" value={boxfulStateId}
            onChange={e => { setBoxfulStateId(e.target.value); setBoxfulCityId(''); setBoxfulQuote(null); onBoxfulChange({ isBoxful: true, quote: null, destination: null, mode: boxfulMode }); }}>
            <option value="">Seleccionar...</option>
            {boxfulStates.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Ciudad</label>
          <select className="input input-lg" value={boxfulCityId} disabled={!boxfulState}
            onChange={e => {
              const nextId = e.target.value;
              const nextCity = boxfulState?.cities.find(c => c.id === nextId);
              setBoxfulCityId(nextId);
              if (nextCity) onCiudadChange?.(nextCity.name);
              setBoxfulQuote(null);
              onBoxfulChange({ isBoxful: true, quote: null, destination: null, mode: boxfulMode });
            }}>
            <option value="">Seleccionar...</option>
            {boxfulState?.cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      {boxfulQuoteLoading && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Calculando envío...</div>}
      {boxfulQuote && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
            <span style={{ fontWeight: 700 }}>{boxfulQuote.courierName}</span>
            <span className="mono tnum" style={{ fontWeight: 700 }}>{formatCurrency(boxfulQuote.price)}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>
            {boxfulQuote.estimatedDelivery}
            {boxfulQuote.source === 'local_estimate' ? ' · Estimado local' : ' · Cotización Boxful'}
          </div>
          {boxfulQuote.note && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>{boxfulQuote.note}</div>}
        </div>
      )}
      {boxfulQuoteError && <div style={{ fontSize: 12, color: 'var(--urgent)' }}>{boxfulQuoteError}</div>}
    </div>
  );
}

/* ──────── SHIPPING SELECTOR (solo opciones de radio) ──────── */
export function ShippingSelector({ metodosEnvio, metodoEnvioId, boxfulQuote, boxfulQuoteLoading, onChange }: {
  metodosEnvio: MetodoEnvio[];
  metodoEnvioId: string;
  boxfulQuote?: BoxfulQuote | null;
  boxfulQuoteLoading?: boolean;
  onChange: (id: string) => void;
}) {
  const isBoxfulSelected = metodoEnvioId === BOXFUL_ID;
  const boxfulResumen = boxfulQuote
    ? formatCurrency(boxfulQuote.price)
    : boxfulQuoteLoading ? 'Calculando...' : '—';

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* Boxful */}
      <div onClick={() => onChange(BOXFUL_ID)}
        style={{ padding: '14px 16px', border: `1.5px solid ${isBoxfulSelected ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 12, cursor: 'pointer', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <input type="radio" name="envio" checked={isBoxfulSelected} onChange={() => onChange(BOXFUL_ID)}
            style={{ marginTop: 3, accentColor: 'var(--ink)', width: 16, height: 16, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Envío con Boxful</div>
              <div className="mono tnum" style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {isBoxfulSelected ? boxfulResumen : '—'}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Envíos a todo Honduras con seguimiento.</div>
          </div>
        </div>
      </div>
      {/* Métodos manuales de la tienda */}
      {metodosEnvio.map(m => (
        <label key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', border: `1.5px solid ${metodoEnvioId === m.id ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 12, cursor: 'pointer', background: '#fff', transition: 'border-color .12s' }}>
          <input type="radio" name="envio" checked={metodoEnvioId === m.id} onChange={() => onChange(m.id)}
            style={{ marginTop: 3, accentColor: 'var(--ink)', width: 16, height: 16, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{m.nombre}</div>
              <div className="mono tnum" style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrencyFree(m.precio)}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{m.proveedor} · {m.tiempo_estimado}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{m.cobertura}</div>
          </div>
        </label>
      ))}
    </div>
  );
}

/* ──────── PANEL ENVÍO ──────── */
export function EnvioPanel({ prenda, tallaSeleccionada, nombre, email, whatsapp, direccion, ciudad, buyer, metodoEnvioId, metodosEnvio, dropTarget, costoEnvio, total, errorMsg, boxfulOriginCity, boxfulData, onChange, onBuyer, onBoxfulChange, onContinuar, onCerrar }: {
  prenda: CheckoutPrenda;
  tallaSeleccionada: string | null;
  nombre: string; email: string; whatsapp: string; direccion: string; ciudad: string;
  buyer: BuyerProfile | null;
  metodoEnvioId: string;
  metodosEnvio: MetodoEnvio[];
  dropTarget?: number;
  costoEnvio: number; total: number; errorMsg: string;
  boxfulOriginCity?: string | null;
  boxfulData?: BoxfulChangeData | null;
  onChange: (f: string, v: string) => void;
  onBuyer: (buyer: BuyerProfile) => void;
  onBoxfulChange?: (data: BoxfulChangeData) => void;
  onContinuar: () => void;
  onCerrar: () => void;
}) {
  return (
    <div className="buyer-checkout-panel" style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>PASO 1 DE 2</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Envío</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {dropTarget != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--urgent)', fontWeight: 600 }}>
              <Icons.clock width={13} height={13} />
              <CountdownTimer target={dropTarget} size="sm" urgent />
            </div>
          )}
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', display: 'flex' }}>
            <Icons.close width={20} height={20} />
          </button>
        </div>
      </div>
      <div style={{ height: 2, background: 'var(--line)', borderRadius: 2, marginBottom: 28 }}>
        <div style={{ height: '100%', width: '50%', background: 'var(--ink)', borderRadius: 2 }} />
      </div>
      <PrendaSummary prenda={prenda} tallaSeleccionada={tallaSeleccionada} costoEnvio={costoEnvio} total={total} />
      <BuyerCheckoutAccess buyer={buyer} onBuyer={onBuyer} />
      <div style={{ marginBottom: 14 }}>
        <label className="label">Nombre completo</label>
        <input className="input input-lg" placeholder="Karla Morales" value={nombre} onChange={e => onChange('nombre', e.target.value)} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="label">WhatsApp</label>
        <PhoneInput value={whatsapp} onChange={v => onChange('whatsapp', v)} size="lg" />
      </div>
      <div style={{ marginBottom: 6 }}>
        <label className="label">
          Email <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}>(opcional — para recibir notificaciones)</span>
        </label>
        <input className="input input-lg" type="email" placeholder="karla@email.com" value={email} onChange={e => onChange('email', e.target.value)} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 20 }}>Te avisamos por WhatsApp y email cuando salga tu pedido</div>
      <div style={{ marginBottom: 14 }}>
        <label className="label">Dirección</label>
        <input className="input input-lg" placeholder="Col. Kennedy, Calle 5, Casa 12" value={direccion} onChange={e => onChange('direccion', e.target.value)} />
      </div>
      {metodoEnvioId === BOXFUL_ID ? (
        <div style={{ marginBottom: 24 }}>
          <BoxfulAddressFields
            originCity={boxfulOriginCity}
            itemsCount={1}
            subtotal={prenda.precio}
            onBoxfulChange={data => { onBoxfulChange?.(data); onChange('ciudad', data.destination?.cityName ?? ciudad); }}
            onCiudadChange={c => onChange('ciudad', c)}
          />
        </div>
      ) : (
        <div className="buyer-checkout-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <div>
            <label className="label">Ciudad</label>
            <input className="input input-lg" placeholder={PLATFORM.defaultCity} value={ciudad} onChange={e => onChange('ciudad', e.target.value)} />
          </div>
          <div>
            <label className="label">País</label>
            <input className="input input-lg" value={PLATFORM.country} readOnly style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }} />
          </div>
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Método de envío</div>
      <ShippingSelector
        metodosEnvio={metodosEnvio}
        metodoEnvioId={metodoEnvioId}
        boxfulQuote={boxfulData?.quote}
        onChange={id => {
          onChange('metodoEnvioId', id);
          if (id !== BOXFUL_ID) onBoxfulChange?.({ isBoxful: false, quote: null, destination: null, mode: 'boxful_dropoff' });
        }}
      />
      <div style={{ height: 24 }} />
      {errorMsg && <div style={{ marginBottom: 12 }}><Alert type="error" message={errorMsg} /></div>}
      <button className="btn btn-primary btn-block" style={{ height: 52, fontSize: 15 }} onClick={onContinuar}>
        Continuar al pago <Icons.arrow width={15} height={15} />
      </button>
    </div>
  );
}

/* ──────── PANEL PAGO ──────── */
export function PagoPanel({ prenda, tallaSeleccionada, metodosPago, metodoPagoId, tiendaEmail, costoEnvio, total, dropTarget, uploading, comprobanteUrl, errorMsg, loading, fileRef, compradorNombre, onChange, onSubirComprobante, onConfirmar, onVolver }: {
  prenda: CheckoutPrenda;
  tallaSeleccionada: string | null;
  metodosPago: MetodoPago[];
  metodoPagoId: string; tiendaEmail: string; costoEnvio: number; total: number;
  dropTarget?: number;
  uploading: boolean; comprobanteUrl: string | null; errorMsg: string; loading: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  compradorNombre?: string;
  onChange: (f: string, v: string) => void;
  onSubirComprobante: (file: File) => void;
  onConfirmar: () => void;
  onVolver: () => void;
}) {
  const metodoPago = metodosPago.find(m => m.id === metodoPagoId);
  const esTransferencia = metodoPago?.tipo === 'transferencia';
  const refPedido = compradorNombre ? compradorNombre.trim().split(' ').slice(0, 2).join(' ') : 'tu nombre completo';

  return (
    <div className="buyer-checkout-panel" style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onVolver} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--ink-3)' }}>
            <Icons.back width={20} height={20} />
          </button>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>PASO 2 DE 2</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Pago</div>
          </div>
        </div>
        {dropTarget != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--urgent)', fontWeight: 600 }}>
            <Icons.clock width={13} height={13} />
            <CountdownTimer target={dropTarget} size="sm" urgent />
          </div>
        )}
      </div>
      <div style={{ height: 2, background: 'var(--line)', borderRadius: 2, marginBottom: 28 }}>
        <div style={{ height: '100%', width: '100%', background: 'var(--ink)', borderRadius: 2 }} />
      </div>
      <PrendaSummary prenda={prenda} tallaSeleccionada={tallaSeleccionada} costoEnvio={costoEnvio} total={total} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Método de pago</div>
      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {metodosPago.map(m => (
          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: `1.5px solid ${metodoPagoId === m.id ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 12, cursor: 'pointer', background: '#fff', transition: 'border-color .12s' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icons.bank width={18} height={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{m.proveedor}</div>
              {m.detalle && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{m.detalle}</div>}
            </div>
            <input type="radio" name="pago" checked={metodoPagoId === m.id} onChange={() => onChange('metodoPagoId', m.id)} style={{ accentColor: 'var(--ink)', width: 16, height: 16 }} />
          </label>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1.5px solid var(--line)', borderRadius: 12, background: 'var(--surface-2)', opacity: 0.6, cursor: 'not-allowed' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e8e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icons.card width={18} height={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              Pagar con tarjeta
              <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--ink-3)', color: '#fff', padding: '2px 7px', borderRadius: 20, letterSpacing: '0.04em' }}>Próximamente</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Visa · Mastercard</div>
          </div>
          <input type="radio" name="pago" disabled style={{ accentColor: 'var(--ink)', width: 16, height: 16 }} />
        </div>
      </div>
      {esTransferencia && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>Transferí este monto exacto:</div>
          <div className="mono tnum" style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em' }}>{formatCurrency(total)}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6 }}>Concepto: <strong>{refPedido}</strong></div>
        </div>
      )}
      {esTransferencia && (
        <>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onSubirComprobante(f); }} />
          <button className="btn btn-outline btn-block" style={{ height: 48, fontSize: 14, marginBottom: 16 }} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Subiendo...' : comprobanteUrl ? '✓ Comprobante adjuntado' : '↑ Subir comprobante'}
          </button>
        </>
      )}
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
          <Icons.clock width={15} height={15} />
          Devoluciones y cancelaciones
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
          Una vez procesada la compra no se puede cancelar la orden. No se aceptan devoluciones de ningún tipo.
          {tiendaEmail && (
            <> Para casos relacionados con tu pedido, escribí a{' '}
              <a href={`mailto:${tiendaEmail}`} style={{ color: 'var(--ink)', fontWeight: 700, textDecoration: 'underline' }}>{tiendaEmail}</a>.
            </>
          )}
        </div>
      </div>
      {errorMsg && <div style={{ marginBottom: 12 }}><Alert type="error" message={errorMsg} /></div>}
      <button className="btn btn-primary btn-block" style={{ height: 52, fontSize: 15 }} onClick={onConfirmar} disabled={loading || uploading}>
        {loading ? 'Procesando...' : 'Realizar compra'}
      </button>
    </div>
  );
}

/* ──────── PANEL CONFIRMADO ──────── */
export function ConfirmadoPanel({ numero, onVerPedido, onCerrar, secondaryAction }: {
  numero: string;
  onVerPedido: () => void;
  onCerrar: () => void;
  secondaryAction?: { label: string; onClick: () => void };
}) {
  return (
    <div className="buyer-confirmed-panel" style={{ padding: '60px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: 72, height: 72, borderRadius: 36, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 24 }}>✓</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>¡Compra realizada!</div>
      <div style={{ fontSize: 15, color: 'var(--ink-3)', marginBottom: 32, lineHeight: 1.55 }}>
        Tu pedido fue registrado correctamente.<br />Te avisamos por WhatsApp cuando salga tu pedido.
      </div>
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '18px 32px', marginBottom: 36, width: '100%' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Número de pedido</div>
        <div className="mono tnum" style={{ fontSize: 24, fontWeight: 700 }}>{numero}</div>
      </div>
      <button className="btn btn-primary btn-block" style={{ height: 52, fontSize: 15, marginBottom: 10 }} onClick={onVerPedido}>
        Ver estado del pedido
      </button>
      {secondaryAction && (
        <button className="btn btn-outline btn-block" style={{ height: 50, fontSize: 14, marginBottom: 10 }} onClick={secondaryAction.onClick}>
          {secondaryAction.label}
        </button>
      )}
      <button className="btn btn-ghost btn-block" style={{ height: 48, fontSize: 14 }} onClick={onCerrar}>
        Cerrar
      </button>
    </div>
  );
}
