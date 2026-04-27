export const PAYPAL_PLANS = {
  pro_monthly: {
    id: process.env.PAYPAL_PLAN_PRO_MONTHLY_ID ?? '',
    label: 'Pro Mensual',
    price: 999,
    priceLabel: 'L 999/mes',
    interval: 'MONTH' as const,
    savings: null,
    annualEquiv: null,
  },
  pro_annual: {
    id: process.env.PAYPAL_PLAN_PRO_ANNUAL_ID ?? '',
    label: 'Pro Anual',
    price: 9990,
    priceLabel: 'L 9,990/año',
    interval: 'YEAR' as const,
    savings: 'Ahorrás L 1,998 (2 meses gratis)',
    annualEquiv: 'L 832/mes',
  },
} as const;

export type PlanKey = keyof typeof PAYPAL_PLANS;

export const PLAN_FEATURES = {
  starter: [
    'Hasta 50 prendas en inventario',
    '1 drop activo a la vez',
    'Carrito de compras',
    'Notificaciones por email',
  ],
  pro: [
    'Prendas ilimitadas',
    'Drops ilimitados simultáneos',
    'Carrito de compras',
    'Notificaciones por email y WhatsApp',
    'Analytics de ventas',
    'Soporte prioritario',
  ],
};
