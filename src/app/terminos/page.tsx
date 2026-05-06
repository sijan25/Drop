import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/shared/logo';

export const metadata: Metadata = {
  title: 'Términos de Uso · Droppi',
  description: 'Lee los términos y condiciones que rigen el uso de la plataforma Droppi.',
};

const lastUpdated = '30 de abril de 2026';

export default function TerminosPage() {
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
              <Link href="/cookies">Cookies</Link>
            </div>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="landing-section" style={{ paddingTop: '7rem', paddingBottom: '2rem' }}>
        <div className="landing-shell" style={{ maxWidth: 760 }}>
          <div className="landing-section-kicker">Legal</div>
          <h1 className="landing-section-title" style={{ marginBottom: '0.5rem' }}>
            Términos de <span>Uso</span>
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

            <h2>1. Aceptación de los términos</h2>
            <p>
              Al crear una cuenta en Droppi o utilizar cualquiera de nuestros servicios, aceptas estos Términos de Uso en su totalidad. Si no estás de acuerdo con alguno de los puntos, te pedimos no utilizar la plataforma. Droppi se reserva el derecho de modificar estos términos en cualquier momento, notificándote con al menos 15 días de anticipación por correo electrónico.
            </p>

            <h2>2. Descripción del servicio</h2>
            <p>
              Droppi es una plataforma de comercio electrónico diseñada para emprendedoras de moda en Honduras y Centroamérica. Te permite crear una tienda en línea, gestionar inventario, programar drops con cuenta regresiva, procesar pedidos y verificar comprobantes de pago, todo desde un solo panel.
            </p>

            <h2>3. Elegibilidad</h2>
            <p>
              Para registrarte debes tener al menos 18 años de edad o contar con autorización de un tutor legal. Al aceptar estos términos declaras que la información que proporcionas es verídica y que eres responsable de mantenerla actualizada.
            </p>

            <h2>4. Tu cuenta</h2>
            <p>
              Eres responsable de mantener la confidencialidad de tu contraseña y de toda la actividad que ocurra bajo tu cuenta. Notifícanos de inmediato a{' '}
              <a href="mailto:soporte@droppi.app">soporte@droppi.app</a> si sospechas de un acceso no autorizado. Droppi no será responsable por pérdidas derivadas del uso no autorizado de tu cuenta.
            </p>

            <h2>5. Uso permitido</h2>
            <p>Puedes usar Droppi para:</p>
            <ul>
              <li>Vender prendas de vestir, accesorios y artículos de moda de tu propiedad o con los derechos para venderlos.</li>
              <li>Crear y gestionar tu tienda en línea con fines comerciales lícitos.</li>
              <li>Comunicarte con compradores de manera profesional y respetuosa.</li>
            </ul>

            <h2>6. Uso prohibido</h2>
            <p>Está estrictamente prohibido:</p>
            <ul>
              <li>Vender artículos falsificados, de contrabando, o sin licencia para su comercialización.</li>
              <li>Publicar contenido ofensivo, discriminatorio, engañoso o que infrinja derechos de terceros.</li>
              <li>Realizar actividades fraudulentas como comprobantes de pago falsificados.</li>
              <li>Intentar vulnerar la seguridad de la plataforma, hacer scraping o uso abusivo de la API.</li>
              <li>Crear múltiples cuentas para evadir restricciones o sanciones.</li>
              <li>Usar la plataforma para actividades ilegales bajo las leyes de Honduras.</li>
            </ul>
            <p>
              El incumplimiento de estas reglas puede resultar en la suspensión o eliminación permanente de tu cuenta, sin derecho a reembolso.
            </p>

            <h2>7. Pagos y suscripción</h2>
            <p>
              Droppi opera bajo un modelo de suscripción mensual. El plan activo se cobra al inicio de cada período. No cobramos comisión por venta en ningún plan. Puedes cancelar en cualquier momento desde tu panel; la cancelación entra en vigor al finalizar el período de facturación vigente y no se realizan reembolsos proporcionales por el tiempo no utilizado.
            </p>

            <h2>8. Transacciones entre vendedoras y compradoras</h2>
            <p>
              Droppi es una plataforma intermediaria. Las transacciones de compraventa son entre la vendedora y la compradora. Droppi no es parte de esa relación contractual y no garantiza el pago ni la entrega de los productos. Sin embargo, ponemos a disposición herramientas para verificar comprobantes y gestionar el flujo del pedido.
            </p>

            <h2>9. Contenido de la tienda</h2>
            <p>
              Eres la única responsable del contenido que publicas: fotos, descripciones, precios y cualquier información de tus productos. Garantizas que tienes los derechos para publicar ese contenido y que no infringe derechos de terceros. Droppi puede remover contenido que viole estos términos sin previo aviso.
            </p>

            <h2>10. Propiedad intelectual</h2>
            <p>
              Todo el diseño, código, marca, logotipos y materiales de Droppi son propiedad exclusiva de Droppi. No se te concede ninguna licencia para usarlos fuera de la plataforma. Al publicar contenido en Droppi, nos otorgas una licencia no exclusiva para mostrarlo dentro del servicio con el propósito de operar tu tienda.
            </p>

            <h2>11. Limitación de responsabilidad</h2>
            <p>
              Droppi no será responsable por daños indirectos, pérdida de ganancias, interrupción de negocio o cualquier daño especial derivado del uso o imposibilidad de uso de la plataforma. Nuestra responsabilidad máxima, en cualquier caso, estará limitada al monto pagado por suscripción en los últimos 3 meses.
            </p>

            <h2>12. Disponibilidad del servicio</h2>
            <p>
              Nos esforzamos por mantener Droppi disponible las 24 horas, pero no garantizamos un tiempo de actividad del 100%. Podemos realizar mantenimientos programados, generalmente notificados con 24 horas de anticipación. No seremos responsables por interrupciones fuera de nuestro control (fuerza mayor, fallos de terceros, etc.).
            </p>

            <h2>13. Terminación</h2>
            <p>
              Puedes cancelar tu cuenta en cualquier momento. Droppi puede suspender o eliminar tu cuenta si violas estos términos, con o sin previo aviso dependiendo de la gravedad de la infracción. Tras la terminación, tus datos estarán disponibles para exportación por 30 días.
            </p>

            <h2>14. Ley aplicable</h2>
            <p>
              Estos términos se rigen por las leyes de la República de Honduras. Cualquier disputa que no pueda resolverse de mutuo acuerdo se someterá a los tribunales competentes de San Pedro Sula, Cortés, Honduras.
            </p>

            <h2>15. Contacto</h2>
            <p>
              Para preguntas sobre estos términos, escríbenos a{' '}
              <a href="mailto:legal@droppi.app">legal@droppi.app</a>.
            </p>
          </div>

          {/* Footer nav legal */}
          <div className="legal-footer-nav">
            <Link href="/privacidad">Política de Privacidad →</Link>
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
