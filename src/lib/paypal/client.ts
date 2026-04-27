const BASE =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function getAccessToken(): Promise<string> {
  const creds = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

async function pp<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': crypto.randomUUID(),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString());
    throw new Error(`PayPal ${method} ${path} → ${res.status}: ${err}`);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export type PayPalSubscription = {
  id: string;
  status: 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
  plan_id: string;
  links: Array<{ href: string; rel: string; method: string }>;
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { time?: string };
  };
};

export async function createSubscription(
  planId: string,
  returnUrl: string,
  cancelUrl: string,
  subscriberName: string,
  subscriberEmail: string,
): Promise<PayPalSubscription> {
  return pp<PayPalSubscription>('POST', '/v1/billing/subscriptions', {
    plan_id: planId,
    subscriber: {
      name: { given_name: subscriberName },
      email_address: subscriberEmail,
    },
    application_context: {
      brand_name: 'FardoDrops',
      locale: 'es-HN',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      payment_method: { payer_selected: 'PAYPAL', payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED' },
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  });
}

export async function getSubscription(subscriptionId: string): Promise<PayPalSubscription> {
  return pp<PayPalSubscription>('GET', `/v1/billing/subscriptions/${subscriptionId}`);
}

export async function cancelSubscription(subscriptionId: string, reason: string): Promise<void> {
  await pp<void>('POST', `/v1/billing/subscriptions/${subscriptionId}/cancel`, { reason });
}

export async function verifyWebhookSignature(
  headers: Headers,
  rawBody: string,
): Promise<boolean> {
  try {
    const result = await pp<{ verification_status: string }>(
      'POST',
      '/v1/notifications/verify-webhook-signature',
      {
        transmission_id:   headers.get('paypal-transmission-id'),
        transmission_time: headers.get('paypal-transmission-time'),
        cert_url:          headers.get('paypal-cert-url'),
        auth_algo:         headers.get('paypal-auth-algo'),
        transmission_sig:  headers.get('paypal-transmission-sig'),
        webhook_id:        process.env.PAYPAL_WEBHOOK_ID,
        webhook_event:     JSON.parse(rawBody),
      },
    );
    return result.verification_status === 'SUCCESS';
  } catch {
    return false;
  }
}
