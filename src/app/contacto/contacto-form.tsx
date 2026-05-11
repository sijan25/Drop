'use client';

import { useState, useRef } from 'react';
import { enviarContacto } from './actions';
import s from './contacto.module.css';

const ASUNTOS = [
  'Tengo una pregunta sobre mi cuenta',
  'Problema técnico con mi tienda',
  'Consulta sobre planes y precios',
  'Solicitud de facturación',
  'Otro',
];

export function ContactoForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    const data = new FormData(e.currentTarget);
    const result = await enviarContacto(data);
    if (result.ok) {
      setStatus('success');
      formRef.current?.reset();
    } else {
      setStatus('error');
      setErrorMsg(result.error);
    }
  }

  if (status === 'success') {
    return (
      <div className={s.success}>
        <div className={s.successIcon}>✓</div>
        <h2>Mensaje enviado</h2>
        <p>Gracias por escribirnos. Te respondemos en menos de 24 horas hábiles.</p>
        <button className={`${s.btn} max-w-[200px] mt-2`} onClick={() => setStatus('idle')}>
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} className={s.form} onSubmit={handleSubmit} noValidate>
      <div className={s.field}>
        <label className={s.label} htmlFor="nombre">Nombre completo</label>
        <input id="nombre" name="nombre" className={s.input} type="text"
          placeholder="Ana García" autoComplete="name" required disabled={status === 'loading'} />
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor="email">Correo electrónico</label>
        <input id="email" name="email" className={s.input} type="email"
          placeholder="tu@correo.com" autoComplete="email" required disabled={status === 'loading'} />
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor="asunto">Asunto</label>
        <select id="asunto" name="asunto" className={s.select} required
          defaultValue="" disabled={status === 'loading'}>
          <option value="" disabled>Selecciona un tema</option>
          {ASUNTOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor="mensaje">Mensaje</label>
        <textarea id="mensaje" name="mensaje" className={s.textarea}
          placeholder="Describe tu consulta con el mayor detalle posible..."
          required rows={5} disabled={status === 'loading'} />
      </div>

      {status === 'error' && <p className={s.error}>{errorMsg}</p>}

      <button className={s.btn} type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Enviando...' : 'Enviar mensaje'}
      </button>
    </form>
  );
}
