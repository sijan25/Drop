export const ORDER_STATUS: Record<string, { label: string; tone: string; bg: string }> = {
  apartado:     { label: 'Apartado',          tone: '#92400e', bg: '#fffbeb' },
  por_verificar:{ label: 'Pago en revisión',  tone: '#7c2d12', bg: '#fff7ed' },
  pagado:       { label: 'Pago confirmado',   tone: '#065f46', bg: '#ecfdf5' },
  empacado:     { label: 'Empacado',          tone: '#1d4ed8', bg: '#eff6ff' },
  en_camino:    { label: 'En camino',         tone: '#3730a3', bg: '#eef2ff' },
  enviado:      { label: 'Enviado',           tone: '#3730a3', bg: '#eef2ff' },
  entregado:    { label: 'Entregado',         tone: '#166534', bg: '#f0fdf4' },
  cancelado:    { label: 'Cancelado',         tone: '#991b1b', bg: '#fef2f2' },
};
