import { Resend } from 'resend'

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

/** Dirección remitente — cambia esto por tu dominio verificado en Resend.
 *  Mientras usas el dominio de prueba de Resend, pon: onboarding@resend.dev
 */
export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL?.trim() ||
  'Droppi <onboarding@resend.dev>'
