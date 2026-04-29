'use server';

import { resend, FROM_EMAIL } from '@/lib/resend/client';

export type ContactResult = { ok: true } | { ok: false; error: string };

export async function enviarContacto(formData: FormData): Promise<ContactResult> {
  const nombre = String(formData.get('nombre') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const asunto = String(formData.get('asunto') ?? '').trim();
  const mensaje = String(formData.get('mensaje') ?? '').trim();

  if (!nombre || !email || !asunto || !mensaje) {
    return { ok: false, error: 'Todos los campos son obligatorios.' };
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    return { ok: false, error: 'El correo electrónico no es válido.' };
  }

  if (mensaje.length < 10) {
    return { ok: false, error: 'El mensaje es demasiado corto.' };
  }

  if (!resend) {
    return { ok: false, error: 'El servicio de correo no está configurado.' };
  }

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px">
      <h2 style="margin:0 0 24px;font-size:20px;color:#1a1a1a">Nuevo mensaje de contacto</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#666;width:100px">Nombre</td><td style="padding:8px 0;color:#1a1a1a;font-weight:600">${nombre}</td></tr>
        <tr><td style="padding:8px 0;color:#666">Email</td><td style="padding:8px 0;color:#1a1a1a">${email}</td></tr>
        <tr><td style="padding:8px 0;color:#666">Asunto</td><td style="padding:8px 0;color:#1a1a1a">${asunto}</td></tr>
      </table>
      <div style="margin-top:24px;padding:16px;background:#f5f5f3;border-radius:8px;color:#1a1a1a;line-height:1.6;white-space:pre-wrap">${mensaje}</div>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: 'hola@droppi.app',
    replyTo: email,
    subject: `Contacto: ${asunto}`,
    html,
  });

  if (error) {
    return { ok: false, error: 'No se pudo enviar el mensaje. Intenta de nuevo.' };
  }

  return { ok: true };
}
