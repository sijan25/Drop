import type { BoxfulState } from './types';

export const HONDURAS_STATE_NAMES = [
  'Atlántida',
  'Choluteca',
  'Colón',
  'Comayagua',
  'Copán',
  'Cortés',
  'El Paraíso',
  'Francisco Morazán',
  'Gracias a Dios',
  'Intibucá',
  'Islas de la Bahía',
  'La Paz',
  'Lempira',
  'Ocotepeque',
  'Olancho',
  'Santa Bárbara',
  'Valle',
  'Yoro',
];

// Fallback para desarrollo local cuando todavía no hay credenciales de Boxful.
// Con credenciales reales se consulta /states y se usa el catálogo vivo de Boxful.
export const HONDURAS_STATES_FALLBACK: BoxfulState[] = [
  { id: 'hn-atlantida', name: 'Atlántida', cities: [
    { id: 'hn-atlantida-la-ceiba', name: 'La Ceiba' },
    { id: 'hn-atlantida-tela', name: 'Tela' },
    { id: 'hn-atlantida-el-porvenir', name: 'El Porvenir' },
  ] },
  { id: 'hn-choluteca', name: 'Choluteca', cities: [
    { id: 'hn-choluteca-choluteca', name: 'Choluteca' },
    { id: 'hn-choluteca-marcovia', name: 'Marcovia' },
    { id: 'hn-choluteca-san-marcos-de-colon', name: 'San Marcos de Colón' },
  ] },
  { id: 'hn-colon', name: 'Colón', cities: [
    { id: 'hn-colon-tocoa', name: 'Tocoa' },
    { id: 'hn-colon-trujillo', name: 'Trujillo' },
    { id: 'hn-colon-saba', name: 'Sabá' },
  ] },
  { id: 'hn-comayagua', name: 'Comayagua', cities: [
    { id: 'hn-comayagua-comayagua', name: 'Comayagua' },
    { id: 'hn-comayagua-siguatepeque', name: 'Siguatepeque' },
  ] },
  { id: 'hn-copan', name: 'Copán', cities: [
    { id: 'hn-copan-santa-rosa-de-copan', name: 'Santa Rosa de Copán' },
    { id: 'hn-copan-copan-ruinas', name: 'Copán Ruinas' },
  ] },
  { id: 'hn-cortes', name: 'Cortés', cities: [
    { id: 'hn-cortes-san-pedro-sula', name: 'San Pedro Sula' },
    { id: 'hn-cortes-choloma', name: 'Choloma' },
    { id: 'hn-cortes-puerto-cortes', name: 'Puerto Cortés' },
    { id: 'hn-cortes-villanueva', name: 'Villanueva' },
    { id: 'hn-cortes-la-lima', name: 'La Lima' },
  ] },
  { id: 'hn-el-paraiso', name: 'El Paraíso', cities: [
    { id: 'hn-el-paraiso-danli', name: 'Danlí' },
    { id: 'hn-el-paraiso-el-paraiso', name: 'El Paraíso' },
  ] },
  { id: 'hn-francisco-morazan', name: 'Francisco Morazán', cities: [
    { id: 'hn-francisco-morazan-tegucigalpa', name: 'Tegucigalpa' },
    { id: 'hn-francisco-morazan-comayaguela', name: 'Comayagüela' },
    { id: 'hn-francisco-morazan-valle-de-angeles', name: 'Valle de Ángeles' },
  ] },
  { id: 'hn-gracias-a-dios', name: 'Gracias a Dios', cities: [
    { id: 'hn-gracias-a-dios-puerto-lempira', name: 'Puerto Lempira' },
  ] },
  { id: 'hn-intibuca', name: 'Intibucá', cities: [
    { id: 'hn-intibuca-la-esperanza', name: 'La Esperanza' },
    { id: 'hn-intibuca-intibuca', name: 'Intibucá' },
  ] },
  { id: 'hn-islas-de-la-bahia', name: 'Islas de la Bahía', cities: [
    { id: 'hn-islas-de-la-bahia-roatan', name: 'Roatán' },
    { id: 'hn-islas-de-la-bahia-utila', name: 'Utila' },
  ] },
  { id: 'hn-la-paz', name: 'La Paz', cities: [
    { id: 'hn-la-paz-la-paz', name: 'La Paz' },
    { id: 'hn-la-paz-marcala', name: 'Marcala' },
  ] },
  { id: 'hn-lempira', name: 'Lempira', cities: [
    { id: 'hn-lempira-gracias', name: 'Gracias' },
  ] },
  { id: 'hn-ocotepeque', name: 'Ocotepeque', cities: [
    { id: 'hn-ocotepeque-ocotepeque', name: 'Ocotepeque' },
  ] },
  { id: 'hn-olancho', name: 'Olancho', cities: [
    { id: 'hn-olancho-juticalpa', name: 'Juticalpa' },
    { id: 'hn-olancho-catacamas', name: 'Catacamas' },
  ] },
  { id: 'hn-santa-barbara', name: 'Santa Bárbara', cities: [
    { id: 'hn-santa-barbara-santa-barbara', name: 'Santa Bárbara' },
    { id: 'hn-santa-barbara-quimistan', name: 'Quimistán' },
  ] },
  { id: 'hn-valle', name: 'Valle', cities: [
    { id: 'hn-valle-nacaome', name: 'Nacaome' },
    { id: 'hn-valle-san-lorenzo', name: 'San Lorenzo' },
  ] },
  { id: 'hn-yoro', name: 'Yoro', cities: [
    { id: 'hn-yoro-el-progreso', name: 'El Progreso' },
    { id: 'hn-yoro-yoro', name: 'Yoro' },
    { id: 'hn-yoro-olanchito', name: 'Olanchito' },
  ] },
];
