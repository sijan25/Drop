export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const PLATFORM = {
  country: 'Honduras',
  countryCode: 'HN',
  currency: 'HNL',
  currencySymbol: 'L',
  locale: 'es-HN',
  defaultCity: 'Tegucigalpa',
  location: 'San Pedro Sula, Honduras',
  cities: ['San Pedro Sula', 'Tegucigalpa', 'La Ceiba', 'Choloma', 'Comayagua', 'Choluteca'],
  phoneCode: '+504',
} as const;

export function formatCurrency(amount: number): string {
  return `${PLATFORM.currencySymbol} ${amount.toLocaleString(PLATFORM.locale)}`;
}

export function formatCurrencyFree(amount: number, freeLabel = 'Gratis'): string {
  return amount === 0 ? freeLabel : formatCurrency(amount);
}

export type TiendaMonedaConfig = {
  pais: string;
  moneda: string;
  simbolo_moneda: string;
  codigo_telefono: string;
  ciudad?: string | null;
};

export function getTiendaConfig(tienda: Partial<TiendaMonedaConfig>): TiendaMonedaConfig {
  return {
    pais: tienda.pais || PLATFORM.country,
    moneda: tienda.moneda || PLATFORM.currency,
    simbolo_moneda: tienda.simbolo_moneda || PLATFORM.currencySymbol,
    codigo_telefono: tienda.codigo_telefono || PLATFORM.phoneCode,
    ciudad: tienda.ciudad,
  };
}

export function formatCurrencyTienda(amount: number, simbolo: string): string {
  return `${simbolo} ${amount.toLocaleString('es')}`;
}

export function formatCurrencyFreeTienda(amount: number, simbolo: string, freeLabel = 'Gratis'): string {
  return amount === 0 ? freeLabel : formatCurrencyTienda(amount, simbolo);
}
