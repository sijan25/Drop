'use server';

import Settings from '@pixelpay/sdk-core/lib/models/Settings';
import Card from '@pixelpay/sdk-core/lib/models/Card';
import Billing from '@pixelpay/sdk-core/lib/models/Billing';
import Order from '@pixelpay/sdk-core/lib/models/Order';
import Item from '@pixelpay/sdk-core/lib/models/Item';
import SaleTransaction from '@pixelpay/sdk-core/lib/requests/SaleTransaction';
import StatusTransaction from '@pixelpay/sdk-core/lib/requests/StatusTransaction';
import VoidTransaction from '@pixelpay/sdk-core/lib/requests/VoidTransaction';
import Transaction from '@pixelpay/sdk-core/lib/services/Transaction';
import TransactionResult from '@pixelpay/sdk-core/lib/entities/TransactionResult';
import {
  decryptPixelPaySecret,
  getPixelPayAuthHash,
  getPixelPayServiceSignature,
  getSandboxPixelPayCredentials,
  getVoidSignature,
} from './security';

export type PixelPayCredentials = {
  sandbox: boolean;
  endpoint?: string | null;
  keyId?: string | null;
  secretKey?: string | null;
};

export type PixelPayCardData = {
  number: string;
  holder: string;
  expireMonth: string;
  expireYear: string;
  cvv: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingPhone: string;
};

export type PixelPayOrderData = {
  id: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  items: { code: string; title: string; price: number; qty: number }[];
};

export type PixelPayResult =
  | {
      success: true;
      payment_uuid: string;
      payment_hash: string;
      transaction_id: string;
      response_code?: string;
      response_reason?: string;
      transaction_auth?: string;
      metadata: Record<string, unknown>;
    }
  | { success: false; message: string; metadata?: Record<string, unknown> };

function createSettings(credentials: PixelPayCredentials, orderId?: string) {
  const settings = new Settings();
  const sandbox = getSandboxPixelPayCredentials();
  const secret = credentials.sandbox
    ? sandbox.secret
    : decryptPixelPaySecret(credentials.secretKey);
  const keyId = credentials.sandbox ? sandbox.keyId : credentials.keyId?.trim();

  if (credentials.sandbox) {
    settings.setupSandbox();
  } else {
    if (!credentials.endpoint || !keyId || !secret) {
      return { settings, error: 'Credenciales de PixelPay no configuradas.' };
    }
    settings.setupEndpoint(credentials.endpoint.trim());
    settings.setupCredentials(keyId, getPixelPayAuthHash(secret));
  }

  const appUrl = credentials.sandbox ? 'https://pixelpay.dev' : credentials.endpoint?.trim();
  if (keyId && secret && appUrl && orderId) {
    settings.setupHeaders({
      'x-client-signature': getPixelPayServiceSignature({
        keyId,
        secret,
        fields: [keyId, orderId, appUrl],
      }),
    });
  }

  return { settings, secret, keyId, appUrl };
}

export async function procesarVentaPixelPay(
  credentials: PixelPayCredentials,
  cardData: PixelPayCardData,
  orderData: PixelPayOrderData,
): Promise<PixelPayResult> {
  const setup = createSettings(credentials, orderData.id);
  if ('error' in setup) return { success: false, message: setup.error ?? 'Credenciales de PixelPay no configuradas.' };
  const { settings, secret } = setup;

  const card = new Card();
  card.number = cardData.number.replace(/\s/g, '');
  card.cardholder = cardData.holder;
  card.expire_month = parseInt(cardData.expireMonth, 10);
  card.expire_year = parseInt(cardData.expireYear, 10);
  card.cvv2 = cardData.cvv;

  const billing = new Billing();
  billing.address = cardData.billingAddress;
  billing.country = 'HN';
  billing.state = cardData.billingState || 'HN-CR';
  billing.city = cardData.billingCity;
  billing.phone = cardData.billingPhone.replace(/\D/g, '');

  const order = new Order();
  order.id = orderData.id;
  order.currency = orderData.currency;
  order.customer_name = orderData.customerName;
  order.customer_email = orderData.customerEmail;
  order.amount = credentials.sandbox ? 1 : orderData.amount;

  if (!credentials.sandbox) {
    for (const it of orderData.items) {
      const item = new Item();
      item.code = it.code;
      item.title = it.title;
      item.price = it.price;
      item.qty = it.qty;
      order.addItem(item);
    }
  }

  const sale = new SaleTransaction();
  sale.setCard(card);
  sale.setBilling(billing);
  sale.setOrder(order);

  const service = new Transaction(settings);

  try {
    const response = await service.doSale(sale);

    if (TransactionResult.validateResponse(response)) {
      const result = TransactionResult.fromResponse(response);

      if (!credentials.sandbox && secret) {
        const isValid = service.verifyPaymentHash(result.payment_hash ?? '', order.id, secret);
        if (!isValid) {
          return { success: false, message: 'Verificación de pago fallida. Contactá soporte.' };
        }
      }

      return {
        success: true,
        payment_uuid: result.payment_uuid ?? '',
        payment_hash: result.payment_hash ?? '',
        transaction_id: result.transaction_id ?? '',
        response_code: result.response_code,
        response_reason: result.response_reason,
        transaction_auth: result.transaction_auth,
        metadata: {
          transaction_type: result.transaction_type,
          transaction_amount: result.transaction_amount,
          transaction_approved_amount: result.transaction_approved_amount,
          response_approved: result.response_approved,
          response_incomplete: result.response_incomplete,
          response_code: result.response_code,
          response_reason: result.response_reason,
          response_cvn: result.response_cvn,
          response_avs: result.response_avs,
          response_cavv: result.response_cavv,
          transaction_id: result.transaction_id,
          transaction_auth: result.transaction_auth,
          transaction_reference: result.transaction_reference,
          transaction_terminal: result.transaction_terminal,
          transaction_merchant: result.transaction_merchant,
          transaction_date: result.transaction_date,
          transaction_time: result.transaction_time,
          installment_type: result.installment_type,
          installment_months: result.installment_months,
        },
      };
    }

    return { success: false, message: (response as { message?: string }).message ?? 'Pago rechazado.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de conexión con PixelPay.';
    return { success: false, message: msg };
  }
}

export async function consultarEstadoPixelPay(
  credentials: PixelPayCredentials,
  paymentUuid: string,
) {
  const setup = createSettings(credentials);
  if ('error' in setup) return { success: false as const, message: setup.error };
  if (setup.keyId && setup.secret && setup.appUrl) {
    setup.settings.setupHeaders({
      'x-client-signature': getPixelPayServiceSignature({
        keyId: setup.keyId,
        secret: setup.secret,
        fields: [setup.keyId, paymentUuid, setup.appUrl],
      }),
    });
  }

  const status = new StatusTransaction();
  status.payment_uuid = paymentUuid;

  const response = await new Transaction(setup.settings).getStatus(status);
  if (!TransactionResult.validateResponse(response)) {
    return { success: false as const, message: (response as { message?: string }).message ?? 'No se pudo consultar el estado.' };
  }

  const result = TransactionResult.fromResponse(response);
  return { success: true as const, result };
}

export async function anularPagoPixelPay(
  credentials: PixelPayCredentials,
  data: {
    paymentUuid: string;
    orderId: string;
    authUserEmail: string;
    reason: string;
  },
) {
  const setup = createSettings(credentials);
  if ('error' in setup) return { success: false as const, message: setup.error };
  if (!setup.secret) return { success: false as const, message: 'Secret Key de PixelPay no configurado.' };

  const { authUserHash, voidSignature } = getVoidSignature({
    authUserEmail: data.authUserEmail,
    orderId: data.orderId,
    secret: setup.secret,
  });

  setup.settings.setupPlatformUser(authUserHash);

  const voidTx = new VoidTransaction();
  voidTx.payment_uuid = data.paymentUuid;
  voidTx.void_reason = data.reason;
  voidTx.void_signature = voidSignature;

  const response = await new Transaction(setup.settings).doVoid(voidTx);
  if (!TransactionResult.validateResponse(response)) {
    return { success: false as const, message: (response as { message?: string }).message ?? 'No se pudo anular el pago.' };
  }

  return { success: true as const, result: TransactionResult.fromResponse(response) };
}
