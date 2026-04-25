const GRAPH_URL = 'https://graph.facebook.com/v19.0'
const PHONE_RE = /^\+?[\d\s().-]{7,20}$/

export type WhatsAppSendResult =
  | { status: 'sent'; messageId: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string }

function getConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim()
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  if (!token || !phoneNumberId) return null
  return { token, phoneNumberId }
}

export function normalizeWhatsApp(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/[\s().-]/g, '')
  if (!PHONE_RE.test(raw)) return null
  // Honduras numbers without country code (8 digits starting with 8 or 9 or 2 or 3)
  if (/^\d{8}$/.test(digits)) return `504${digits}`
  // Already has +
  return digits.replace(/^\+/, '')
}

export async function sendWhatsAppText(
  to: string | null | undefined,
  message: string,
): Promise<WhatsAppSendResult> {
  const cfg = getConfig()
  if (!cfg) {
    return { status: 'skipped', reason: 'WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configurados.' }
  }

  const phone = normalizeWhatsApp(to)
  if (!phone) {
    return { status: 'skipped', reason: `Número inválido: "${to}"` }
  }

  try {
    const res = await fetch(`${GRAPH_URL}/${cfg.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message, preview_url: false },
      }),
    })

    const data = await res.json() as { messages?: { id: string }[]; error?: { message: string } }

    if (!res.ok || data.error) {
      console.error('[WhatsApp] Error API:', data.error)
      return { status: 'failed', error: data.error?.message ?? `HTTP ${res.status}` }
    }

    return { status: 'sent', messageId: data.messages?.[0]?.id ?? '' }
  } catch (err) {
    console.error('[WhatsApp] Excepción:', err)
    return { status: 'failed', error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
