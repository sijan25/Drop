import 'server-only';

import {
  HONDURAS_STATE_NAMES,
  HONDURAS_STATES_FALLBACK,
} from './honduras-states';
import { decryptBoxfulPassword } from './security';
import type {
  BoxfulCreateShipmentInput,
  BoxfulQuote,
  BoxfulQuoteRequest,
  BoxfulShipmentResult,
  BoxfulState,
} from './types';

function getBoxfulBaseUrl() {
  const baseUrl = process.env.BOXFUL_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error('BOXFUL_BASE_URL no está configurada.');
  }
  return baseUrl.replace(/\/+$/, '');
}

type BoxfulStateApi = {
  id: string;
  name: string;
  Cities?: Array<{ id: string; name: string; latitude?: number | null; longitude?: number | null }>;
};

type BoxfulAuthResponse = {
  accessToken?: string;
  token?: string;
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

export type BoxfulCredentials = {
  email: string;
  password: string;
};

function resolveCredentials(creds?: BoxfulCredentials | null): BoxfulCredentials | null {
  if (creds?.email && creds?.password) {
    const password = decryptBoxfulPassword(creds.password);
    return password ? { email: creds.email, password } : null;
  }
  const email = process.env.BOXFUL_EMAIL?.trim();
  const password = process.env.BOXFUL_PASSWORD?.trim();
  if (email && password) return { email, password };
  return null;
}

function hasBoxfulCredentials(creds?: BoxfulCredentials | null) {
  return Boolean(
    process.env.BOXFUL_API_TOKEN?.trim() || resolveCredentials(creds)
  );
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getBoxfulAccessToken(creds?: BoxfulCredentials | null, forceRefresh = false) {
  const staticToken = process.env.BOXFUL_API_TOKEN?.trim();
  const resolved = resolveCredentials(creds);

  if (!resolved) return staticToken || null;

  const cacheKey = resolved.email;
  const cached = tokenCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.token;

  const baseUrl = getBoxfulBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/auth/client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resolved.email, password: resolved.password }),
      cache: 'no-store',
    });
  } catch {
    throw new Error(`No se pudo conectar con Boxful (${baseUrl}). Revisá BOXFUL_BASE_URL o confirmá que el ambiente esté disponible.`);
  }

  if (!response.ok) throw new Error(`Boxful auth respondió ${response.status}.`);

  const payload = await response.json() as BoxfulAuthResponse;
  const token = payload.accessToken ?? payload.token;
  if (!token) throw new Error('Boxful no devolvió accessToken.');

  tokenCache.set(cacheKey, { token, expiresAt: Date.now() + 45 * 60 * 1000 });
  return token;
}

async function boxfulRequest<T>(path: string, init?: RequestInit, retryAuth = true, creds?: BoxfulCredentials | null): Promise<T | null> {
  const token = await getBoxfulAccessToken(creds);
  if (!token) return null;

  const baseUrl = getBoxfulBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
  } catch {
    throw new Error(`No se pudo conectar con Boxful (${baseUrl}). Revisá BOXFUL_BASE_URL o confirmá que el ambiente esté disponible.`);
  }

  if (response.status === 401 && retryAuth) {
    const resolved = resolveCredentials(creds);
    if (resolved) tokenCache.delete(resolved.email);
    const freshToken = await getBoxfulAccessToken(creds, true);
    if (!freshToken) return null;

    let retryResponse: Response;
    try {
      retryResponse = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
          ...(init?.headers ?? {}),
        },
        cache: 'no-store',
      });
    } catch {
      throw new Error(`No se pudo conectar con Boxful (${baseUrl}). Revisá BOXFUL_BASE_URL o confirmá que el ambiente esté disponible.`);
    }

    if (!retryResponse.ok) {
      throw new Error(`Boxful respondió ${retryResponse.status}.`);
    }

    return retryResponse.json() as Promise<T>;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[boxful] ${response.status} en ${path}:`, body);
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
      cities: (state.Cities ?? []).map(city => ({
        id: city.id,
        name: city.name,
        latitude: city.latitude ?? null,
        longitude: city.longitude ?? null,
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function getBoxfulStates(creds?: BoxfulCredentials | null): Promise<{ states: BoxfulState[]; source: 'boxful' | 'local_estimate' }> {
  if (!hasBoxfulCredentials(creds)) {
    return { states: HONDURAS_STATES_FALLBACK, source: 'local_estimate' };
  }

  try {
    const response = await boxfulRequest<BoxfulStatesResponse>('/states', undefined, true, creds);
    const states = onlyHondurasStates(response?.states ?? []);
    if (states.length === 0) {
      throw new Error('Boxful no devolvió departamentos/ciudades de Honduras.');
    }
    return {
      states,
      source: 'boxful',
    };
  } catch (error) {
    console.error('[boxful] Error cargando estados:', error);
    throw error;
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

function quoteFromCourier(
  input: BoxfulQuoteRequest,
  courier: NonNullable<BoxfulQuoterResponse['couriers']>[number] & { numericPrice: number },
): BoxfulQuote {
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
}

let _cachedAddresses: BoxfulAddressApi[] | null = null;

async function getBoxfulAddresses(creds?: BoxfulCredentials | null): Promise<BoxfulAddressApi[]> {
  if (_cachedAddresses) return _cachedAddresses;
  try {
    const response = await boxfulRequest<BoxfulAddressesResponse>('/addresses', undefined, true, creds);
    _cachedAddresses = response?.addresses ?? [];
    return _cachedAddresses;
  } catch {
    return [];
  }
}

async function findOriginCityId(originCityName: string | null | undefined, states: BoxfulState[], creds?: BoxfulCredentials | null): Promise<string | null> {
  const normalized = normalizeText(originCityName || '');
  if (!normalized) return null;

  // Try matching against registered Boxful addresses first (exact city IDs)
  try {
    const addresses = await getBoxfulAddresses(creds);
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

function findLocationByNames(states: BoxfulState[], stateName?: string | null, cityName?: string | null) {
  const normalizedState = normalizeText(stateName || '');
  const normalizedCity = normalizeText(cityName || '');
  if (!normalizedCity) return null;

  const candidateStates = normalizedState
    ? states.filter(state => normalizeText(state.name) === normalizedState)
    : states;

  for (const state of candidateStates) {
    const city = state.cities.find(item => normalizeText(item.name) === normalizedCity);
    if (city) return { state, city };
  }

  return null;
}

export async function quoteBoxfulOptions(input: BoxfulQuoteRequest, creds?: BoxfulCredentials | null): Promise<BoxfulQuote[]> {
  if (!hasBoxfulCredentials(creds) || !input.destinationCityId) {
    return [estimateLocalQuote(input)];
  }

  try {
    const { states } = await getBoxfulStates(creds);
    const originCityId = await findOriginCityId(input.originCityName, states, creds);
    if (!originCityId) {
      throw new Error('Boxful no encontró la ciudad de origen de la tienda.');
    }

    const response = await boxfulRequest<BoxfulQuoterResponse>('/quoter', {
      method: 'POST',
      body: JSON.stringify({
        recollectionCityId: originCityId,
        customerCityId: input.destinationCityId,
      }),
    }, true, creds);

    const couriers = response?.couriers
      ?.map(item => ({ ...item, numericPrice: Number(item.clientPrice ?? item.price ?? 0) }))
      .filter(item => item.numericPrice > 0)
      .sort((a, b) => a.numericPrice - b.numericPrice) ?? [];

    if (couriers.length === 0) {
      throw new Error('Boxful no devolvió couriers para esta ruta.');
    }

    return couriers.map(courier => quoteFromCourier(input, courier));
  } catch (error) {
    console.error('[boxful] Error cotizando:', error);
    throw error;
  }
}

export async function quoteBoxful(input: BoxfulQuoteRequest, creds?: BoxfulCredentials | null): Promise<BoxfulQuote> {
  const quotes = await quoteBoxfulOptions(input, creds);
  if (!input.preferredCourierId) return quotes[0];
  return quotes.find(quote => quote.courierId === input.preferredCourierId) ?? quotes[0];
}

export async function createBoxfulShipment(input: BoxfulCreateShipmentInput, creds?: BoxfulCredentials | null): Promise<BoxfulShipmentResult> {
  if (!hasBoxfulCredentials(creds)) {
    throw new Error('Boxful no está configurado para esta tienda.');
  }
  if (!input.courierId) {
    throw new Error('La cotización no tiene courierId real de Boxful.');
  }
  if (!input.customerStateId || !input.customerCityId) {
    throw new Error('La dirección de entrega no tiene IDs reales de Boxful.');
  }

  const { states } = await getBoxfulStates(creds);
  const originLocation = findLocationByNames(states, input.originStateName, input.originCityName);
  const originAddress = input.originAddress?.trim();
  const areaCode = input.phoneAreaCode ?? '+504';
  const dialCode = areaCode.replace('+', '');
  const originPhone = input.originPhone?.replace(/\D/g, '').replace(new RegExp(`^${dialCode}`), '') || input.customerPhone.replace(/\D/g, '').replace(new RegExp(`^${dialCode}`), '');

  if (!originLocation || !originAddress) {
    throw new Error('Configurá departamento, ciudad y dirección de retiro de la tienda antes de crear la guía de Boxful.');
  }

  const shipmentPayload: Record<string, unknown> = {
    courierId: input.courierId,
    recolectionDate: new Date().toISOString().split('T')[0],
    recolectionAddress: {
      address: originAddress,
      referencePoint: originAddress,
      latitude: originLocation.city.latitude ?? 0,
      longitude: originLocation.city.longitude ?? 0,
      stateId: originLocation.state.id,
      cityId: originLocation.city.id,
      areaCode: areaCode,
      phone: originPhone,
    },
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
    customerPhone: input.customerPhone.replace(/\D/g, '').replace(new RegExp(`^${dialCode}`), ''),
    customerPhoneAreaCode: areaCode,
    customerEmail: input.customerEmail || 'cliente@droppi.local',
    customerAddress: input.customerAddress,
    customerState: input.customerStateId,
    customerCity: input.customerCityId,
    customerAddressReferencePoint: input.customerAddress,
    instructions: input.mode === 'boxful_dropoff'
      ? 'Pedido Droppi. La tienda entregará el paquete en punto autorizado.'
      : 'Pedido Droppi. Solicitar recolección con la tienda.',
  };

  const response = await boxfulRequest<BoxfulShipmentResponse>('/shipment', {
    method: 'POST',
    body: JSON.stringify(shipmentPayload),
  }, true, creds);

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
