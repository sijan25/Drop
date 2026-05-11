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

export function CheckoutProcessingOverlay({ message, total }: { message: string; total?: number }) {
  return (
    <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-[2px] flex items-center justify-center px-6">
      <div className="w-full max-w-[360px] text-center">
        <div className="w-[54px] h-[54px] rounded-full border-[4px] border-[var(--line)] border-t-[var(--accent)] animate-spin mx-auto mb-5" />
        <div className="text-[22px] font-bold tracking-[-0.02em] mb-2">Procesando compra</div>
        <div className="text-[14px] text-[var(--ink-2)] leading-[1.55] mb-5">
          {message}
        </div>
        {typeof total === 'number' && (
          <div className="inline-flex items-baseline gap-[4px] rounded-[999px] bg-[var(--surface-2)] px-4 py-2">
            <span className="text-[11px] text-[var(--ink-3)]">{PLATFORM.currency}</span>
            <span className="mono tnum text-[18px] font-extrabold">{formatCurrency(total)}</span>
          </div>
        )}
        <div className="mt-5 text-[12px] text-[var(--ink-3)]">
          No cerrés esta ventana ni presionés atrás.
        </div>
      </div>
    </div>
  );
}

/* ──────── RESUMEN DE LÍNEAS ──────── */
export function ResumenLineas({ precio, costoEnvio, total }: { precio: number; costoEnvio: number; total: number }) {
  return (
    <>
      <div className="flex justify-between text-[13px] text-[var(--ink-2)] mb-[6px]">
        <span>Subtotal</span><span className="mono tnum">{formatCurrency(precio)}</span>
      </div>
      <div className="flex justify-between text-[13px] text-[var(--ink-2)] mb-2">
        <span>Envío</span><span className="mono tnum">{formatCurrencyFree(costoEnvio)}</span>
      </div>
      <div className="flex justify-between text-[15px] font-bold">
        <span>Total</span>
        <span><span className="text-[11px] text-[var(--ink-3)] mr-[3px]">{PLATFORM.currency}</span><span className="mono tnum">{formatCurrency(total)}</span></span>
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
    <div className="buyer-checkout-summary bg-[var(--surface-2)] rounded-[12px] px-4 py-[14px] mb-6">
      <div className="flex gap-3 items-center">
        <div className="w-14 h-[70px] rounded-[8px] overflow-hidden shrink-0 relative">
          {prenda.fotos?.[0]
            ? <Image src={prenda.fotos[0]} alt="" fill sizes="56px" className="object-cover" />
            : <Ph tone="rose" aspect="4/5" radius={0} />}
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-semibold">{prenda.nombre}</div>
          <div className="text-[12px] text-[var(--ink-3)]">{prenda.marca}{tallaSeleccionada ? ` · Talla ${tallaSeleccionada}` : ''}</div>
        </div>
        <div className="mono tnum text-[15px] font-bold">{formatCurrency(prenda.precio)}</div>
      </div>
      <hr className="border-none border-t border-[var(--line)] my-3" />
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
    <div className="grid gap-3">
      <div className="buyer-checkout-two-col grid grid-cols-2 gap-3">
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
      {boxfulQuoteLoading && <div className="text-[12px] text-[var(--ink-3)]">Calculando envío...</div>}
      {boxfulQuote && (
        <div className="border border-[var(--line)] rounded-[10px] px-3 py-[10px] bg-[var(--surface-2)]">
          <div className="flex justify-between gap-3 text-[12px]">
            <span className="font-bold">{boxfulQuote.courierName}</span>
            <span className="mono tnum font-bold">{formatCurrency(boxfulQuote.price)}</span>
          </div>
          <div className="text-[11px] text-[var(--ink-3)] mt-[3px]">
            {boxfulQuote.estimatedDelivery}
            {boxfulQuote.source === 'local_estimate' ? ' · Estimado local' : ' · Cotización Boxful'}
          </div>
          {boxfulQuote.note && <div className="text-[11px] text-[var(--ink-3)] mt-[3px]">{boxfulQuote.note}</div>}
        </div>
      )}
      {boxfulQuoteError && <div className="text-[12px] text-[var(--urgent)]">{boxfulQuoteError}</div>}
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
    <div className="grid gap-[10px]">
      {/* Boxful */}
      <div
        onClick={() => onChange(BOXFUL_ID)}
        className={`px-4 py-[14px] rounded-[12px] cursor-pointer bg-white border-[1.5px] ${isBoxfulSelected ? 'border-[var(--ink)]' : 'border-[var(--line)]'}`}
      >
        <div className="flex items-start gap-[14px]">
          <input type="radio" name="envio" checked={isBoxfulSelected} onChange={() => onChange(BOXFUL_ID)}
            className="mt-[3px] w-4 h-4 shrink-0 accent-[var(--ink)]" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between gap-3">
              <div className="text-[14px] font-bold">Envío con Boxful</div>
              <div className="mono tnum text-[14px] font-bold whitespace-nowrap">
                {isBoxfulSelected ? boxfulResumen : '—'}
              </div>
            </div>
            <div className="text-[12px] text-[var(--ink-3)] mt-[2px]">Envíos a todo Honduras con seguimiento.</div>
          </div>
        </div>
      </div>
      {/* Métodos manuales de la tienda */}
      {metodosEnvio.map(m => (
        <label
          key={m.id}
          className={`flex items-start gap-[14px] px-4 py-[14px] rounded-[12px] cursor-pointer bg-white transition-[border-color] duration-[120ms] border-[1.5px] ${metodoEnvioId === m.id ? 'border-[var(--ink)]' : 'border-[var(--line)]'}`}
        >
          <input type="radio" name="envio" checked={metodoEnvioId === m.id} onChange={() => onChange(m.id)}
            className="mt-[3px] w-4 h-4 shrink-0 accent-[var(--ink)]" />
          <div className="flex-1">
            <div className="flex justify-between">
              <div className="text-[14px] font-semibold">{m.nombre}</div>
              <div className="mono tnum text-[14px] font-semibold">{formatCurrencyFree(m.precio)}</div>
            </div>
            <div className="text-[12px] text-[var(--ink-3)] mt-[2px]">{m.proveedor} · {m.tiempo_estimado}</div>
            <div className="text-[12px] text-[var(--ink-3)]">{m.cobertura}</div>
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
    <div className="buyer-checkout-panel px-7 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[11px] text-[var(--ink-3)] uppercase tracking-[0.06em] mb-[2px]">PASO 1 DE 2</div>
          <div className="text-[20px] font-bold tracking-[-0.02em]">Envío</div>
        </div>
        <div className="flex items-center gap-3">
          {dropTarget != null && (
            <div className="flex items-center gap-[6px] text-[12px] text-[var(--urgent)] font-semibold">
              <Icons.clock width={13} height={13} />
              <CountdownTimer target={dropTarget} size="sm" urgent />
            </div>
          )}
          <button onClick={onCerrar} className="bg-none border-none cursor-pointer text-[var(--ink-3)] flex">
            <Icons.close width={20} height={20} />
          </button>
        </div>
      </div>
      <div className="h-[2px] bg-[var(--line)] rounded-[2px] mb-7">
        <div className="h-full w-1/2 bg-[var(--ink)] rounded-[2px]" />
      </div>
      <PrendaSummary prenda={prenda} tallaSeleccionada={tallaSeleccionada} costoEnvio={costoEnvio} total={total} />
      <BuyerCheckoutAccess buyer={buyer} onBuyer={onBuyer} />
      <div className="mb-[14px]">
        <label className="label">Nombre completo</label>
        <input className="input input-lg" placeholder="Karla Morales" value={nombre} onChange={e => onChange('nombre', e.target.value)} />
      </div>
      <div className="mb-[14px]">
        <label className="label">WhatsApp</label>
        <PhoneInput value={whatsapp} onChange={v => onChange('whatsapp', v)} size="lg" />
      </div>
      <div className="mb-[6px]">
        <label className="label">
          Email <span className="text-[11px] text-[var(--ink-3)] font-normal">(opcional — para recibir notificaciones)</span>
        </label>
        <input className="input input-lg" type="email" placeholder="karla@email.com" value={email} onChange={e => onChange('email', e.target.value)} />
      </div>
      <div className="text-[12px] text-[var(--ink-3)] mb-5">Te avisamos por WhatsApp y email cuando salga tu pedido</div>
      <div className="mb-[14px]">
        <label className="label">Dirección</label>
        <input className="input input-lg" placeholder="Col. Kennedy, Calle 5, Casa 12" value={direccion} onChange={e => onChange('direccion', e.target.value)} />
      </div>
      {metodoEnvioId === BOXFUL_ID ? (
        <div className="mb-6">
          <BoxfulAddressFields
            originCity={boxfulOriginCity}
            itemsCount={1}
            subtotal={prenda.precio}
            onBoxfulChange={data => { onBoxfulChange?.(data); onChange('ciudad', data.destination?.cityName ?? ciudad); }}
            onCiudadChange={c => onChange('ciudad', c)}
          />
        </div>
      ) : (
        <div className="buyer-checkout-two-col grid grid-cols-2 gap-3 mb-6">
          <div>
            <label className="label">Ciudad</label>
            <input className="input input-lg" placeholder={PLATFORM.defaultCity} value={ciudad} onChange={e => onChange('ciudad', e.target.value)} />
          </div>
          <div>
            <label className="label">País</label>
            <input className="input input-lg bg-[var(--surface-2)] text-[var(--ink-3)]" value={PLATFORM.country} readOnly />
          </div>
        </div>
      )}
      <div className="text-[14px] font-semibold mb-3">Método de envío</div>
      <ShippingSelector
        metodosEnvio={metodosEnvio}
        metodoEnvioId={metodoEnvioId}
        boxfulQuote={boxfulData?.quote}
        onChange={id => {
          onChange('metodoEnvioId', id);
          if (id !== BOXFUL_ID) onBoxfulChange?.({ isBoxful: false, quote: null, destination: null, mode: 'boxful_dropoff' });
        }}
      />
      <div className="h-6" />
      {errorMsg && <div className="mb-3"><Alert type="error" message={errorMsg} /></div>}
      <button className="btn btn-primary btn-block h-[52px] text-[15px]" onClick={onContinuar}>
        Continuar al pago <Icons.arrow width={15} height={15} />
      </button>
    </div>
  );
}

/* ──────── PANEL PAGO ──────── */
export type CardData = { number: string; holder: string; expireMonth: string; expireYear: string; cvv: string; billingAddress: string; billingCity: string; billingState: string; billingPhone: string };

export function PagoPanel({ prenda, tallaSeleccionada, metodosPago, metodoPagoId, tiendaEmail, costoEnvio, total, dropTarget, uploading, comprobanteUrl, errorMsg, loading, processingMessage, fileRef, compradorNombre, cardData, onCardChange, onChange, onSubirComprobante, onConfirmar, onVolver }: {
  prenda: CheckoutPrenda;
  tallaSeleccionada: string | null;
  metodosPago: MetodoPago[];
  metodoPagoId: string; tiendaEmail: string; costoEnvio: number; total: number;
  dropTarget?: number;
  uploading: boolean; comprobanteUrl: string | null; errorMsg: string; loading: boolean; processingMessage?: string;
  fileRef: React.RefObject<HTMLInputElement | null>;
  compradorNombre?: string;
  cardData?: CardData;
  onCardChange?: (field: keyof CardData, value: string) => void;
  onChange: (f: string, v: string) => void;
  onSubirComprobante: (file: File) => void;
  onConfirmar: () => void;
  onVolver: () => void;
}) {
  const metodoPago = metodosPago.find(m => m.id === metodoPagoId);
  const esTransferencia = metodoPago?.tipo === 'transferencia';
  const esPixelPay = metodoPago?.tipo === 'tarjeta' && metodoPago?.proveedor?.toLowerCase().includes('pixelpay');
  const refPedido = compradorNombre ? compradorNombre.trim().split(' ').slice(0, 2).join(' ') : 'tu nombre completo';

  return (
    <div className="buyer-checkout-panel relative min-h-screen px-7 py-6">
      {loading && (
        <CheckoutProcessingOverlay
          message={processingMessage ?? 'Estamos validando tu pedido y confirmando la compra.'}
          total={total}
        />
      )}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-[10px]">
          <button onClick={onVolver} disabled={loading} className="bg-none border-none cursor-pointer flex text-[var(--ink-3)] disabled:opacity-40">
            <Icons.back width={20} height={20} />
          </button>
          <div>
            <div className="text-[11px] text-[var(--ink-3)] uppercase tracking-[0.06em] mb-[2px]">PASO 2 DE 2</div>
            <div className="text-[20px] font-bold tracking-[-0.02em]">Pago</div>
          </div>
        </div>
        {dropTarget != null && (
          <div className="flex items-center gap-[6px] text-[12px] text-[var(--urgent)] font-semibold">
            <Icons.clock width={13} height={13} />
            <CountdownTimer target={dropTarget} size="sm" urgent />
          </div>
        )}
      </div>
      <div className="h-[2px] bg-[var(--line)] rounded-[2px] mb-7">
        <div className="h-full w-full bg-[var(--ink)] rounded-[2px]" />
      </div>
      <PrendaSummary prenda={prenda} tallaSeleccionada={tallaSeleccionada} costoEnvio={costoEnvio} total={total} />
      <div className="text-[14px] font-semibold mb-3">Método de pago</div>
      <div className="grid gap-[10px] mb-5">
        {metodosPago.map(m => {
          const esTarjeta = m.tipo === 'tarjeta';
          const Ic = esTarjeta ? Icons.card : Icons.bank;
          return (
            <label
              key={m.id}
              className={`flex items-center gap-[14px] px-4 py-[14px] rounded-[12px] cursor-pointer bg-white transition-[border-color] duration-[120ms] border-[1.5px] ${metodoPagoId === m.id ? 'border-[var(--ink)]' : 'border-[var(--line)]'}`}
            >
              <div className="w-9 h-9 rounded-[8px] bg-[var(--surface-2)] flex items-center justify-center shrink-0">
                <Ic width={18} height={18} />
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold">{m.nombre ?? m.proveedor}</div>
                {esTarjeta ? (
                  <div className="text-[12px] text-[var(--ink-3)]">Visa · Mastercard</div>
                ) : (
                  m.detalle && <div className="text-[12px] text-[var(--ink-3)]">{m.detalle}</div>
                )}
              </div>
              <input type="radio" name="pago" checked={metodoPagoId === m.id} disabled={loading} onChange={() => onChange('metodoPagoId', m.id)} className="accent-[var(--ink)] w-4 h-4" />
            </label>
          );
        })}
      </div>
      {esPixelPay && cardData && onCardChange && (
        <div className="mt-4 mb-4 border border-[var(--line)] rounded-[14px] p-4 grid gap-3 bg-[var(--surface-2)]">
          <div className="text-[13px] font-semibold text-[var(--ink-2)] mb-[2px]">Datos de la tarjeta</div>
          <div>
            <label className="label">Número de tarjeta</label>
            <input className="input input-lg mono tnum" placeholder="4111 1111 1111 1111" maxLength={19} inputMode="numeric"
              value={cardData.number}
              onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 16); onCardChange('number', v.replace(/(.{4})/g, '$1 ').trim()); }} />
          </div>
          <div>
            <label className="label">Nombre en la tarjeta</label>
            <input className="input input-lg" placeholder="KARLA MORALES" value={cardData.holder}
              onChange={e => onCardChange('holder', e.target.value.toUpperCase())} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Vence (MM/AA)</label>
              <input className="input input-lg mono tnum" placeholder="12/28" maxLength={5} inputMode="numeric"
                value={cardData.expireMonth && cardData.expireYear ? `${cardData.expireMonth}/${cardData.expireYear}` : cardData.expireMonth}
                onChange={e => { const raw = e.target.value.replace(/\D/g, '').slice(0, 4); onCardChange('expireMonth', raw.slice(0, 2)); onCardChange('expireYear', raw.slice(2)); }} />
            </div>
            <div>
              <label className="label">CVV</label>
              <input className="input input-lg mono tnum" placeholder="123" maxLength={4} inputMode="numeric" type="password"
                value={cardData.cvv} onChange={e => onCardChange('cvv', e.target.value.replace(/\D/g, '').slice(0, 4))} />
            </div>
          </div>
          <div>
            <label className="label">Teléfono de facturación</label>
            <input className="input input-lg" placeholder="+504 9999-9999" value={cardData.billingPhone}
              onChange={e => onCardChange('billingPhone', e.target.value)} />
          </div>
        </div>
      )}
      {esTransferencia && (
        <div className="bg-[var(--surface-2)] rounded-[12px] px-[18px] py-4 mb-4">
          <div className="text-[12px] text-[var(--ink-3)] mb-2">Transferí este monto exacto:</div>
          <div className="mono tnum text-[32px] font-bold tracking-[-0.04em]">{formatCurrency(total)}</div>
          <div className="text-[13px] text-[var(--ink-3)] mt-[6px]">Concepto: <strong>{refPedido}</strong></div>
        </div>
      )}
      {esTransferencia && (
        <>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onSubirComprobante(f); }} />
          <button className="btn btn-outline btn-block h-12 text-[14px] mb-4" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Subiendo...' : comprobanteUrl ? '✓ Comprobante adjuntado' : '↑ Subir comprobante'}
          </button>
        </>
      )}
      <div className="border border-[var(--line)] rounded-[12px] px-4 py-[14px] mb-4 bg-white">
        <div className="flex items-center gap-2 text-[14px] font-bold mb-2">
          <Icons.clock width={15} height={15} />
          Devoluciones y cancelaciones
        </div>
        <div className="text-[13px] text-[var(--ink-2)] leading-[1.55]">
          Una vez procesada la compra no se puede cancelar la orden. No se aceptan devoluciones de ningún tipo.
          {tiendaEmail && (
            <> Para casos relacionados con tu pedido, escribí a{' '}
              <a href={`mailto:${tiendaEmail}`} className="text-[var(--ink)] font-bold underline">{tiendaEmail}</a>.
            </>
          )}
        </div>
      </div>
      {errorMsg && <div className="mb-3"><Alert type="error" message={errorMsg} /></div>}
      <button className="btn btn-primary btn-block h-[52px] text-[15px]" onClick={onConfirmar} disabled={loading || uploading}>
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
    <div className="buyer-confirmed-panel px-10 py-[60px] text-center flex flex-col items-center justify-center min-h-screen">
      <div className="w-[72px] h-[72px] rounded-[36px] bg-[#ecfdf5] flex items-center justify-center text-[32px] mb-6">✓</div>
      <div className="text-[26px] font-bold tracking-[-0.02em] mb-2">¡Compra realizada!</div>
      <div className="text-[15px] text-[var(--ink-3)] mb-8 leading-[1.55]">
        Tu pedido fue registrado correctamente.<br />Te avisamos por WhatsApp cuando salga tu pedido.
      </div>
      <div className="bg-[var(--surface-2)] rounded-[12px] px-8 py-[18px] mb-9 w-full">
        <div className="text-[12px] text-[var(--ink-3)] mb-[6px] uppercase tracking-[0.06em]">Número de pedido</div>
        <div className="mono tnum text-[24px] font-bold">{numero}</div>
      </div>
      <button className="btn btn-primary btn-block h-[52px] text-[15px] mb-[10px]" onClick={onVerPedido}>
        Ver estado del pedido
      </button>
      {secondaryAction && (
        <button className="btn btn-outline btn-block h-[50px] text-[14px] mb-[10px]" onClick={secondaryAction.onClick}>
          {secondaryAction.label}
        </button>
      )}
      <button className="btn btn-ghost btn-block h-12 text-[14px]" onClick={onCerrar}>
        Cerrar
      </button>
    </div>
  );
}
