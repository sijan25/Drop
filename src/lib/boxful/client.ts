import 'server-only';

import {
  HONDURAS_STATE_NAMES,
  HONDURAS_STATES_FALLBACK,
} from './honduras-states';
import type {
  BoxfulCreateShipmentInput,
  BoxfulQuote,
  BoxfulQuoteRequest,
  BoxfulShipmentResult,
  BoxfulState,
} from './types';

const BOXFUL_API_URL = process.env.BOXFUL_API_URL ?? 'https://api.goboxful.com';

type BoxfulStateApi = {
  id: string;
  name: string;
  Cities?: Array<{ id: string; name: string }>;
};

type BoxfulStatesResponse = {
  status?: string;
  states?: BoxfulStateApi[];
};

type BoxfulQuoterResponse = {
  status?: string;
  couriers?: Array<{
    id: string;
    name: string;
    clientPrice?: number;
    price?: number;
    deliveryType?: string;
    logo?: string;
  }>;
};

type BoxfulShipmentResponse = {
  status?: string;
  shipmentData?: {
    id?: string;
    shipmentNumber?: string;
    trackingUrl?: string;
    labelUrl?: string;
    courierName?: string;
    statusDescription?: string;
  };
};

type BoxfulAddressApi = {
  id: string;
  address: string;
  cityId: string;
  stateId: string;
  referencePoint?: string | null;
};

type BoxfulAddressesResponse = {
  status?: string;
  addresses?: BoxfulAddressApi[];
};

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hasBoxfulCredentials() {
  return Boolean(process.env.BOXFUL_API_TOKEN?.trim());
}

async function boxfulRequest<T>(path: string, init?: RequestInit) {
  const token = process.env.BOXFUL_API_TOKEN?.trim();
  if (!token) return null;

  const response = await fetch(`${BOXFUL_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Boxful respondió ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

function onlyHondurasStates(states: BoxfulStateApi[]): BoxfulState[] {
  const allowed = new Set(HONDURAS_STATE_NAMES.map(normalizeText));
  return states
    .filter(state => allowed.has(normalizeText(state.name)))
    .map(state => ({
      id: state.id,
      name: state.name,
      cities: (state.Cities ?? []).map(city => ({ id: city.id, name: city.name })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function getBoxfulStates(): Promise<{ states: BoxfulState[]; source: 'boxful' | 'local_estimate' }> {
  if (!hasBoxfulCredentials()) {
    return { states: HONDURAS_STATES_FALLBACK, source: 'local_estimate' };
  }

  try {
    const response = await boxfulRequest<BoxfulStatesResponse>('/states');
    const states = onlyHondurasStates(response?.states ?? []);
    return {
      states: states.length > 0 ? states : HONDURAS_STATES_FALLBACK,
      source: states.length > 0 ? 'boxful' : 'local_estimate',
    };
  } catch (error) {
    console.error('[boxful] Error cargando estados:', error);
    return { states: HONDURAS_STATES_FALLBACK, source: 'local_estimate' };
  }
}

function estimateLocalQuote(input: BoxfulQuoteRequest): BoxfulQuote {
  const origin = normalizeText(input.originCityName || 'San Pedro Sula');
  const destination = normalizeText(input.destinationCityName);
  const destinationState = normalizeText(input.destinationStateName);
  const sameCity = origin && destination && origin === destination;
  const centralCities = new Set(['san pedro sula', 'tegucigalpa', 'comayaguela', 'la ceiba', 'choloma', 'el progreso']);
  const remoteState = ['gracias a dios', 'islas de la bahia', 'olancho'].includes(destinationState);
  const base = sameCity ? 75 : centralCities.has(destination) ? 105 : remoteState ? 165 : 130;
  const packageExtra = Math.max(0, input.itemsCount - 1) * 10;
  const pickupExtra = input.mode === 'boxful_recoleccion' ? 35 : 0;

  return {
    provider: 'boxful',
    mode: input.mode,
    courierId: null,
    courierName: input.mode === 'boxful_dropoff' ? 'Boxful Drop-off' : 'Boxful Recolección',
    courierLogo: null,
    price: base + packageExtra + pickupExtra,
    estimatedDelivery: remoteState ? '2-4 días hábiles' : '1-3 días hábiles',
    deliveryType: null,
    source: 'local_estimate',
    note: null,
  };
}

let _cachedAddresses: BoxfulAddressApi[] | null = null;

async function getBoxfulAddresses(): Promise<BoxfulAddressApi[]> {
  if (_cachedAddresses) return _cachedAddresses;
  try {
    const response = await boxfulRequest<BoxfulAddressesResponse>('/addresses');
    _cachedAddresses = response?.addresses ?? [];
    return _cachedAddresses;
  } catch {
    return [];
  }
}

async function findOriginCityId(originCityName: string | null | undefined, states: BoxfulState[]): Promise<string | null> {
  const normalized = normalizeText(originCityName || '');
  if (!normalized) return null;

  // Try matching against registered Boxful addresses first (exact city IDs)
  try {
    const addresses = await getBoxfulAddresses();
    if (addresses.length > 0) {
      // Build city lookup from states to match address cityIds to names
      const cityIdToName = new Map<string, string>();
      for (const state of states) {
        for (const city of state.cities) {
          cityIdToName.set(city.id, normalizeText(city.name));
        }
      }
      for (const addr of addresses) {
        const cityName = cityIdToName.get(addr.cityId);
        if (cityName && cityName === normalized) return addr.cityId;
      }
      // If only one registered address, use it as fallback origin
      if (addresses.length === 1) return addresses[0].cityId;
    }
  } catch { /* fall through to text match */ }

  // Text-match fallback against states
  for (const state of states) {
    const city = state.cities.find(item => normalizeText(item.name) === normalized);
    if (city) return city.id;
  }

  return null;
}

export async function quoteBoxful(input: BoxfulQuoteRequest): Promise<BoxfulQuote> {
  if (!hasBoxfulCredentials() || !input.destinationCityId) {
    return estimateLocalQuote(input);
  }

  try {
    const { states } = await getBoxfulStates();
    const originCityId = await findOriginCityId(input.originCityName, states);
    if (!originCityId) return estimateLocalQuote(input);

    const response = await boxfulRequest<BoxfulQuoterResponse>('/quoter', {
      method: 'POST',
      body: JSON.stringify({
        recollectionCityId: originCityId,
        customerCityId: input.destinationCityId,
      }),
    });

    const courier = response?.couriers
      ?.map(item => ({ ...item, numericPrice: Number(item.clientPrice ?? item.price ?? 0) }))
      .filter(item => item.numericPrice > 0)
      .sort((a, b) => a.numericPrice - b.numericPrice)[0];

    if (!courier) return estimateLocalQuote(input);

    const pickupExtra = input.mode === 'boxful_recoleccion' ? 35 : 0;
    return {
      provider: 'boxful',
      mode: input.mode,
      courierId: courier.id,
      courierName: courier.name,
      courierLogo: courier.logo ?? null,
      price: courier.numericPrice + pickupExtra,
      estimatedDelivery: courier.deliveryType === 'same-day' ? 'Mismo día' : '1-3 días hábiles',
      deliveryType: courier.deliveryType ?? null,
      source: 'boxful',
      note: input.mode === 'boxful_recoleccion'
        ? 'La recolección queda sujeta a cobertura del courier seleccionado.'
        : null,
    };
  } catch (error) {
    console.error('[boxful] Error cotizando:', error);
    return estimateLocalQuote(input);
  }
}

export async function createBoxfulShipment(input: BoxfulCreateShipmentInput): Promise<BoxfulShipmentResult> {
  if (!hasBoxfulCredentials() || !input.courierId || !input.customerStateId || !input.customerCityId) {
    const shipmentNumber = `LOCAL-${input.orderNumber}`;
    return {
      shipmentId: null,
      shipmentNumber,
      trackingUrl: null,
      labelUrl: null,
      courierName: input.courierName ?? 'Boxful',
      statusDescription: input.mode === 'boxful_dropoff'
        ? 'Pendiente de entrega en punto autorizado'
        : 'Pendiente de recolección',
      source: 'local_estimate',
    };
  }

  const response = await boxfulRequest<BoxfulShipmentResponse>('/shipment', {
    method: 'POST',
    body: JSON.stringify({
      courierId: input.courierId,
      recolectionDate: new Date().toISOString(),
      parcels: input.parcels.map(parcel => ({
        content: parcel.content,
        price: parcel.price,
        weight: parcel.weight ?? 1,
        width: parcel.width ?? 20,
        height: parcel.height ?? 8,
        length: parcel.length ?? 25,
        isFragile: false,
      })),
      cod: false,
      codAmount: 0,
      customerName: input.customerName,
      customerLastname: 'Cliente',
      customerPhone: input.customerPhone.replace(/\D/g, ''),
      customerPhoneAreaCode: '+504',
      customerEmail: input.customerEmail || 'cliente@droppi.local',
      customerAddress: input.customerAddress,
      customerState: input.customerStateId,
      customerCity: input.customerCityId,
      customerAddressReferencePoint: input.customerAddress,
      instructions: input.mode === 'boxful_dropoff'
        ? 'Pedido Droppi. La tienda entregará el paquete en punto autorizado.'
        : 'Pedido Droppi. Solicitar recolección con la tienda.',
    }),
  });

  const shipment = response?.shipmentData;
  if (!shipment?.shipmentNumber) {
    throw new Error('Boxful no devolvió número de guía.');
  }

  return {
    shipmentId: shipment.id ?? null,
    shipmentNumber: shipment.shipmentNumber,
    trackingUrl: shipment.trackingUrl ?? null,
    labelUrl: shipment.labelUrl ?? null,
    courierName: shipment.courierName ?? input.courierName ?? null,
    statusDescription: shipment.statusDescription ?? null,
    source: 'boxful',
  };
}
