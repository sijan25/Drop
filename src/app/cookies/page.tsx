import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/shared/logo';

export const metadata: Metadata = {
  title: 'Política de Cookies · Droppi',
  description: 'Descubre cómo Droppi usa cookies y tecnologías similares en la plataforma.',
};

const lastUpdated = '30 de abril de 2026';

type CookieRow = {
  nombre: string;
  tipo: string;
  proposito: string;
  duracion: string;
};

const cookieTable: CookieRow[] = [
  {
    nombre: 'droppi_session',
    tipo: 'Esencial',
    proposito: 'Mantiene tu sesión activa mientras navegas en la plataforma.',
    duracion: 'Sesión',
  },
  {
    nombre: 'droppi_auth',
    tipo: 'Esencial',
    proposito: 'Recuerda tu autenticación para no pedir contraseña en cada visita.',
    duracion: '30 días',
  },
  {
    nombre: 'droppi_prefs',
    tipo: 'Funcional',
    proposito: 'Guarda preferencias de idioma, tema y configuración de la tienda.',
    duracion: '1 año',
  },
  {
    nombre: '_vercel_insights',
    tipo: 'Analítica',
    proposito: 'Métricas de rendimiento y uso agregado. Sin datos personales identificables.',
    duracion: '90 días',
  },
  {
    nombre: 'cookie_consent',
    tipo: 'Funcional',
    proposito: 'Recuerda tu decisión sobre el uso de cookies para no volver a preguntarte.',
    duracion: '1 año',
  },
];

export default function CookiesPage() {
  return (
    <main className="landing-page">
      {/* Nav */}
      <div className="landing-nav-wrap">
        <div className="landing-shell">
          <nav className="landing-nav">
            <Link className="landing-brand" href="/">
              <Logo size={32} wordmarkSize={18} className="landing-logo" />
            </Link>
            <div className="landing-nav-links">
              <Link href="/">Inicio</Link>
              <Link href="/privacidad">Privacidad</Link>
              <Link href="/terminos">Términos de uso</Link>
            </div>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="landing-section" style={{ paddingTop: '7rem', paddingBottom: '2rem' }}>
        <div className="landing-shell" style={{ maxWidth: 760 }}>
          <div className="landing-section-kicker">Legal</div>
          <h1 className="landing-section-title" style={{ marginBottom: '0.5rem' }}>
            Política de <span>Cookies</span>
          </h1>
          <p className="landing-section-copy" style={{ marginBottom: 0 }}>
            Última actualización: {lastUpdated}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="landing-section" style={{ paddingTop: '1rem' }}>
        <div className="landing-shell" style={{ maxWidth: 760 }}>
          <div className="legal-prose">

            <h2>1. ¿Qué son las cookies?</h2>
            <p>
              Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas un sitio web. Sirven para que la plataforma te reconozca entre visitas, guarde tus preferencias y funcione correctamente. No son programas ni virus, y no pueden acceder a otros datos de tu dispositivo.
            </p>

            <h2>2. ¿Por qué usamos cookies?</h2>
            <p>Usamos cookies para tres fines principales:</p>
            <ul>
              <li>
                <strong>Operación del servicio:</strong> sin ellas, acciones básicas como mantener tu sesión iniciada o guardar el contenido de tu tienda no funcionarían.
              </li>
              <li>
                <strong>Preferencias:</strong> recordar configuraciones como tu tema visual o los filtros que usas con frecuencia.
              </li>
              <li>
                <strong>Análisis de rendimiento:</strong> entender cómo se usa la plataforma en forma agregada y anónima para mejorarla continuamente.
              </li>
            </ul>
            <p>
              <strong>No usamos cookies publicitarias ni de seguimiento entre sitios.</strong> Droppi no te rastrea fuera de la plataforma.
            </p>

            <h2>3. Cookies que utilizamos</h2>
            <p>
              A continuación encontrarás el detalle de las cookies activas en Droppi:
            </p>
          </div>

          {/* Cookie table */}
          <div className="cookie-table-wrap">
            <table className="cookie-table">
              <thead>
                <tr>
                  <th>Cookie</th>
                  <th>Tipo</th>
                  <th>Propósito</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                {cookieTable.map((row) => (
                  <tr key={row.nombre}>
                    <td><code>{row.nombre}</code></td>
                    <td>
                      <span className={`cookie-badge cookie-badge-${row.tipo.toLowerCase()}`}>
                        {row.tipo}
                      </span>
                    </td>
                    <td>{row.proposito}</td>
                    <td>{row.duracion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="legal-prose" style={{ marginTop: '2rem' }}>

            <h2>4. Cookies de terceros</h2>
            <p>
              Usamos Vercel Analytics para métricas de rendimiento. Este servicio recopila datos agregados y anonimizados sobre el uso de la plataforma. No permite identificarte a ti personalmente. Puedes consultar la política de privacidad de Vercel en{' '}
              <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                vercel.com/legal/privacy-policy
              </a>.
            </p>

            <h2>5. ¿Puedo desactivar las cookies?</h2>
            <p>
              Puedes controlar y eliminar cookies desde la configuración de tu navegador. Sin embargo, ten en cuenta que desactivar las cookies esenciales afectará el funcionamiento de Droppi: no podrás mantener tu sesión iniciada ni guardar configuraciones.
            </p>
            <p>Aquí encontrarás instrucciones para los navegadores más comunes:</p>
            <ul>
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Google Chrome</a></li>
              <li><a href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
              <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a></li>
              <li><a href="https://support.microsoft.com/es-es/windows/eliminar-y-administrar-cookies" target="_blank" rel="noopener noreferrer">Microsoft Edge</a></li>
            </ul>

            <h2>6. Consentimiento</h2>
            <p>
              Al continuar usando Droppi después de ver el aviso de cookies, aceptas el uso descrito en esta política. Puedes retirar tu consentimiento en cualquier momento limpiando las cookies de tu navegador, aunque esto cerrará tu sesión activa.
            </p>

            <h2>7. Cambios a esta política</h2>
            <p>
              Podemos actualizar esta política cuando añadamos o modifiquemos el uso de cookies. Te notificaremos mediante el aviso de cookies en la plataforma o por correo si el cambio es significativo.
            </p>

            <h2>8. Contacto</h2>
            <p>
              Si tienes preguntas sobre el uso de cookies, escríbenos a{' '}
              <a href="mailto:privacidad@droppi.app">privacidad@droppi.app</a>.
            </p>
          </div>

          {/* Footer nav legal */}
          <div className="legal-footer-nav">
            <Link href="/privacidad">Política de Privacidad →</Link>
            <Link href="/terminos">Términos de Uso →</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-shell landing-footer-bottom">
          <span>© 2026 Droppi. Todos los derechos reservados.</span>
          <span>San Pedro Sula, Honduras</span>
        </div>
      </footer>

      <style>{`
        .legal-prose {
          font-size: 1rem;
          line-height: 1.8;
          color: var(--color-fg, #1a1a1a);
        }
        .legal-prose h2 {
          font-size: 1.15rem;
          font-weight: 700;
          margin: 2.5rem 0 0.75rem;
          color: var(--color-fg, #111);
        }
        .legal-prose p,
        .legal-prose ul {
          margin-bottom: 1rem;
          color: var(--color-fg-muted, #444);
        }
        .legal-prose ul {
          padding-left: 1.4rem;
        }
        .legal-prose li {
          margin-bottom: 0.4rem;
        }
        .legal-prose a {
          color: #1A8C64;
          text-decoration: underline;
        }
        .cookie-table-wrap {
          overflow-x: auto;
          margin: 1.5rem 0;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.08);
        }
        .cookie-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }
        .cookie-table th {
          background: rgba(0,0,0,0.04);
          padding: 0.75rem 1rem;
          text-align: left;
          font-weight: 600;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #555;
        }
        .cookie-table td {
          padding: 0.75rem 1rem;
          border-top: 1px solid rgba(0,0,0,0.06);
          color: #444;
          vertical-align: top;
        }
        .cookie-table code {
          font-family: monospace;
          font-size: 0.85em;
          background: rgba(0,0,0,0.06);
          padding: 2px 6px;
          border-radius: 4px;
          white-space: nowrap;
        }
        .cookie-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 99px;
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .cookie-badge-esencial {
          background: #dcfce7;
          color: #166534;
        }
        .cookie-badge-funcional {
          background: #dbeafe;
          color: #1e40af;
        }
        .cookie-badge-analítica {
          background: #fef9c3;
          color: #854d0e;
        }
        .legal-footer-nav {
          display: flex;
          gap: 2rem;
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(0,0,0,0.08);
        }
        .legal-footer-nav a {
          color: #1A8C64;
          font-weight: 600;
          text-decoration: none;
          font-size: 0.95rem;
        }
        .legal-footer-nav a:hover {
          text-decoration: underline;
        }
      `}</style>
    </main>
  );
}
