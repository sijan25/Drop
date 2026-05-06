export type BoxfulShippingMode = 'boxful_dropoff' | 'boxful_recoleccion';

export type BoxfulCity = {
  id: string;
  name: string;
};

export type BoxfulState = {
  id: string;
  name: string;
  cities: BoxfulCity[];
};

export type BoxfulQuoteRequest = {
  mode: BoxfulShippingMode;
  originCityName?: string | null;
  destinationStateId?: string | null;
  destinationStateName: string;
  destinationCityId?: string | null;
  destinationCityName: string;
  itemsCount: number;
  subtotal: number;
};

export type BoxfulQuote = {
  provider: 'boxful';
  mode: BoxfulShippingMode;
  courierId: string | null;
  courierName: string;
  courierLogo: string | null;
  price: number;
  estimatedDelivery: string;
  deliveryType: string | null;
  source: 'boxful' | 'local_estimate';
  note: string | null;
};

export type BoxfulCreateShipmentInput = {
  orderId: string;
  orderNumber: string;
  mode: BoxfulShippingMode;
  courierId?: string | null;
  courierName?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerAddress: string;
  customerStateId?: string | null;
  customerCityId?: string | null;
  customerStateName?: string | null;
  customerCityName?: string | null;
  parcels: Array<{
    content: string;
    price: number;
    weight?: number;
    width?: number;
    height?: number;
    length?: number;
  }>;
};

export type BoxfulShipmentResult = {
  shipmentId: string | null;
  shipmentNumber: string;
  trackingUrl: string | null;
  labelUrl: string | null;
  courierName: string | null;
  statusDescription: string | null;
  source: 'boxful' | 'local_estimate';
};
