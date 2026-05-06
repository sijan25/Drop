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
  banks: ['Ficohsa', 'BAC Honduras', 'Banco Atlántida', 'Banco del País', 'Banpais', 'BANHCAFE', 'Davivienda', 'Lafise'],
} as const;

export function formatCurrency(amount: number): string {
  return `${PLATFORM.currencySymbol} ${amount.toLocaleString(PLATFORM.locale)}`;
}

export function formatCurrencyFree(amount: number, freeLabel = 'Gratis'): string {
  return amount === 0 ? freeLabel : formatCurrency(amount);
}
