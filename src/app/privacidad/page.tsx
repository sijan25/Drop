import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/shared/logo';

export const metadata: Metadata = {
  title: 'Política de Privacidad · Droppi',
  description: 'Conoce cómo Droppi recopila, usa y protege tu información personal.',
};

const lastUpdated = '30 de abril de 2026';

export default function PrivacidadPage() {
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
              <Link href="/terminos">Términos de uso</Link>
              <Link href="/cookies">Cookies</Link>
            </div>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="landing-section pt-[7rem] pb-8">
        <div className="landing-shell max-w-[760px]">
          <div className="landing-section-kicker">Legal</div>
          <h1 className="landing-section-title mb-2">
            Política de <span>Privacidad</span>
          </h1>
          <p className="landing-section-copy mb-0">
            Última actualización: {lastUpdated}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="landing-section pt-4">
        <div className="landing-shell max-w-[760px]">
          <div className="legal-prose">

            <h2>1. ¿Quiénes somos?</h2>
            <p>
              Droppi es una plataforma de comercio para emprendedoras de moda en Honduras y Centroamérica. Operamos en San Pedro Sula, Honduras. Si tienes preguntas sobre esta política puedes escribirnos a{' '}
              <a href="mailto:privacidad@droppi.app">privacidad@droppi.app</a>.
            </p>

            <h2>2. Información que recopilamos</h2>
            <p>Recopilamos información en tres categorías principales:</p>
            <ul>
              <li>
                <strong>Información que tú nos das:</strong> nombre, correo electrónico, número de teléfono, datos de tu tienda (nombre, descripción, fotos de productos), métodos de pago configurados y cualquier comunicación que tengas con nuestro equipo.
              </li>
              <li>
                <strong>Información generada por el uso:</strong> historial de drops, pedidos procesados, actividad dentro de la plataforma, configuraciones y preferencias.
              </li>
              <li>
                <strong>Información técnica:</strong> dirección IP, tipo de dispositivo y navegador, páginas visitadas, tiempos de sesión y datos de cookies (ver nuestra{' '}
                <Link href="/cookies">Política de Cookies</Link>).
              </li>
            </ul>

            <h2>3. Cómo usamos tu información</h2>
            <p>Usamos tu información para:</p>
            <ul>
              <li>Crear y gestionar tu cuenta de vendedora.</li>
              <li>Procesar pedidos, verificar comprobantes de pago y gestionar envíos.</li>
              <li>Enviarte notificaciones sobre tu tienda, drops y pedidos.</li>
              <li>Brindarte soporte técnico y atención al cliente.</li>
              <li>Mejorar la plataforma con datos de uso agregados y anónimos.</li>
              <li>Cumplir con obligaciones legales aplicables en Honduras.</li>
            </ul>

            <h2>4. Bases legales para el tratamiento</h2>
            <p>
              Tratamos tus datos bajo las siguientes bases legales conforme a la legislación hondureña aplicable: ejecución del contrato de servicio que aceptas al registrarte; tu consentimiento explícito para comunicaciones de marketing; interés legítimo para mejorar nuestros servicios; y obligación legal cuando aplique.
            </p>

            <h2>5. Compartir información con terceros</h2>
            <p>
              No vendemos tu información personal. Podemos compartirla únicamente con:
            </p>
            <ul>
              <li>
                <strong>Proveedores de servicio:</strong> plataformas de infraestructura cloud, pasarelas de pago y herramientas de comunicación que nos ayudan a operar. Todos bajo acuerdos de confidencialidad.
              </li>
              <li>
                <strong>Compradores en tu tienda:</strong> compartimos únicamente la información necesaria para completar un pedido (nombre de la compradora y dirección de envío).
              </li>
              <li>
                <strong>Autoridades:</strong> cuando sea requerido por ley o resolución judicial.
              </li>
            </ul>

            <h2>6. Retención de datos</h2>
            <p>
              Conservamos tu información mientras tu cuenta esté activa. Si cancelas tu suscripción, tus datos se mantienen disponibles por 30 días para que puedas exportarlos, y posteriormente se eliminan de forma segura, salvo que la ley exija conservarlos por más tiempo.
            </p>

            <h2>7. Tus derechos</h2>
            <p>Tienes derecho a:</p>
            <ul>
              <li><strong>Acceder</strong> a la información que tenemos sobre ti.</li>
              <li><strong>Rectificar</strong> datos incorrectos o desactualizados.</li>
              <li><strong>Eliminar</strong> tu cuenta y los datos asociados.</li>
              <li><strong>Portabilidad:</strong> recibir tus datos en formato exportable.</li>
              <li><strong>Oponerte</strong> al tratamiento con fines de marketing.</li>
            </ul>
            <p>
              Para ejercer cualquiera de estos derechos escríbenos a{' '}
              <a href="mailto:privacidad@droppi.app">privacidad@droppi.app</a> desde el correo de tu cuenta.
            </p>

            <h2>8. Seguridad</h2>
            <p>
              Implementamos medidas técnicas y organizativas para proteger tu información: cifrado en tránsito (TLS), acceso restringido por roles y monitoreo continuo. Sin embargo, ningún sistema es 100% infalible. Te recomendamos usar una contraseña fuerte y no compartirla.
            </p>

            <h2>9. Cookies</h2>
            <p>
              Usamos cookies propias y de terceros para que la plataforma funcione correctamente y para mejorar tu experiencia. Consulta nuestra{' '}
              <Link href="/cookies">Política de Cookies</Link> para más detalles.
            </p>

            <h2>10. Cambios a esta política</h2>
            <p>
              Podemos actualizar esta política ocasionalmente. Cuando hagamos cambios significativos te notificaremos por correo o mediante un aviso en la plataforma. La fecha de última actualización siempre estará visible al inicio del documento.
            </p>

            <h2>11. Contacto</h2>
            <p>
              Si tienes dudas, comentarios o quieres ejercer algún derecho, escríbenos a{' '}
              <a href="mailto:privacidad@droppi.app">privacidad@droppi.app</a> o por WhatsApp al{' '}
              <a href="https://wa.me/50499999999">+504 9999-9999</a>.
            </p>
          </div>

          {/* Footer nav legal */}
          <div className="legal-footer-nav">
            <Link href="/terminos">Términos de uso →</Link>
            <Link href="/cookies">Política de Cookies →</Link>
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
