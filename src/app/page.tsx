import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BarChart3,
  Check,
  Clock3,
  MessageCircleMore,
  Package,
  Play,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { StoreSearchInput } from '@/components/shared/store-search-input';
import { ScrollReveal } from '@/components/shared/scroll-reveal';
import { PLATFORM } from '@/lib/config/platform';

type Feature = {
  title: string;
  description: string;
  Icon: LucideIcon;
};

type Step = {
  title: string;
  description: string;
};

type Testimonial = {
  quote: string;
  result: string;
  name: string;
  role: string;
  initials: string;
  gradient: string;
};

type Plan = {
  name: string;
  description: string;
  price: string;
  suffix?: string;
  cta: string;
  highlighted?: boolean;
  features: string[];
};

const features: Feature[] = [
  {
    title: 'Drops en vivo con countdown',
    description:
      'Programa lanzamientos con cuenta regresiva, feed de actividad en tiempo real y contador de espectadores. Genera urgencia real que convierte.',
    Icon: Clock3,
  },
  {
    title: 'Checkout integrado',
    description:
      'Tus clientes pagan directo en tu tienda, sin escribirte por WhatsApp. Envío, pago y comprobante en un solo flujo limpio.',
    Icon: Zap,
  },
  {
    title: 'Analíticas de ventas en vivo',
    description:
      'Consulta cuánto vendiste, qué prendas rotan más, el ticket promedio y la tasa de conversión de cada drop.',
    Icon: BarChart3,
  },
  {
    title: 'Verificación de comprobantes',
    description:
      'El sistema detecta si el monto, cuenta y referencia del comprobante coinciden. Aprueba o rechaza en un clic.',
    Icon: ShieldCheck,
  },
  {
    title: 'Gestión de inventario',
    description:
      'Agrega prendas con foto, talla y precio. Al cerrar un drop, el remanente migra automáticamente al inventario para el próximo drop.',
    Icon: Package,
  },
  {
    title: 'Notificaciones a compradoras',
    description:
      'Avisa sobre el próximo drop por WhatsApp o correo. Tus compradoras se registran y tú notificas con un clic antes de abrir.',
    Icon: MessageCircleMore,
  },
];

const steps: Step[] = [
  {
    title: 'Crea tu tienda',
    description:
      'Regístrate, elige tu nombre de usuario y configura tus métodos de pago y envío. En menos de 5 minutos ya puedes vender.',
  },
  {
    title: 'Publica tus prendas',
    description:
      'Sube fotos, asigna talla y precio. Carga hasta 50 prendas con tu plan Starter y tu catálogo queda listo al instante.',
  },
  {
    title: 'Programa un drop',
    description:
      'Elige fecha, hora y duración. Comparte el link en tus stories. Tus seguidoras se registran para recibir una notificación.',
  },
  {
    title: 'Vende y entrega',
    description:
      'Tu tienda recibe pedidos, verifica comprobantes y gestiona envíos. Solo confirmas y empacas.',
  },
];

const testimonials: Testimonial[] = [
  {
    quote:
      'Antes vendía por mensajes y era imposible organizarme. Pedidos perdidos, prendas apartadas dos veces, caos total. Con Droppi mi tienda se ve profesional y yo controlo todo desde una pantalla.',
    result: 'L 15,000 · primer mes',
    name: 'Ana Gabriela López',
    role: 'Ropa vintage · San Pedro Sula',
    initials: 'AG',
    gradient: 'linear-gradient(135deg,#1A8C64 0%,#0F5E43 100%)',
  },
  {
    quote:
      'Probé vender por stories y era un desastre: gente que no pagaba, otras que preguntaban por algo ya vendido. Ahora comparto el link de Droppi y en dos horas ya cerré el drop. 3x más conversión que antes.',
    result: '3× más conversión',
    name: 'Sofía Martínez',
    role: '45k seguidoras · Tegucigalpa',
    initials: 'SM',
    gradient: 'linear-gradient(135deg,#1A6CA0 0%,#0F4A78 100%)',
  },
  {
    quote:
      'No soy influencer, solo quería vender ropa que ya no usaba. En dos semanas con Droppi vendí todo el clóset. El drop duró menos de 3 horas y fue la locura más organizada que viví.',
    result: 'L 8,500 · 2 semanas',
    name: 'Karla Rivera',
    role: 'Closet drop · Tegucigalpa',
    initials: 'KR',
    gradient: 'linear-gradient(135deg,#4ECFA0 0%,#1A8C64 100%)',
  },
];

const plans: Plan[] = [
  {
    name: 'Starter',
    description: 'Para empezar a vender sin complicarte',
    price: 'L 499',
    suffix: '/mes',
    cta: 'Empezar ahora',
    features: [
      'Hasta 50 prendas activas',
      'Tienda pública personalizada',
      'Drops con countdown',
      'Checkout integrado',
      'Inventario básico',
      'Link público de Droppi',
    ],
  },
  {
    name: 'Pro',
    description: 'Para vender con orden, marca y escala',
    price: 'L 999',
    suffix: '/mes',
    cta: 'Empezar con Pro',
    highlighted: true,
    features: [
      'Prendas ilimitadas',
      'Drops ilimitados',
      'Analíticas completas',
      'Notificaciones WhatsApp',
      'Pagos con tarjeta vía PixelPay',
      'Soporte prioritario',
    ],
  },
  {
    name: 'Enterprise',
    description: 'Para equipos y agencias con múltiples tiendas',
    price: 'Hablemos',
    cta: 'Contactar',
    features: [
      'Múltiples tiendas',
      'API completa',
      'White label',
      'Equipo colaborativo',
      'Manager dedicado',
      'SLA garantizado',
    ],
  },
];

type Faq = { q: string; a: string };

const faqs: Faq[] = [
  {
    q: '¿Necesito tarjeta de crédito para registrarme?',
    a: 'No. Puedes crear tu tienda y explorar Droppi sin ingresar ningún método de pago. Solo necesitas uno cuando decides activar tu plan de suscripción.',
  },
  {
    q: '¿Cobran comisión por cada venta que hago?',
    a: 'No cobramos comisión por venta en ningún plan. Pagas únicamente la suscripción mensual y cada lempira que vendas es tuyo.',
  },
  {
    q: '¿Qué es un "drop" exactamente?',
    a: 'Drop viene de "soltar". Publicas tus prendas, activas el contador y tus seguidoras tienen un tiempo límite para comprar. Lo que no se vende en ese tiempo, se va. Eso genera urgencia real — sin fingirla..',
  },
  {
    q: '¿Cómo verifican los comprobantes de pago?',
    a: 'El sistema revisa automáticamente que el monto, la cuenta y la referencia del comprobante coincidan con el pedido. Tú solo apruebas o rechazas en un clic desde tu panel.',
  },
  {
    q: '¿Necesito conocimientos técnicos para configurar mi tienda?',
    a: 'Para nada. En menos de 5 minutos tienes tu tienda lista: subes tus fotos, asignas precios y compartes tu link. Sin código, sin diseñador web.',
  },
  {
    q: '¿Puedo cancelar mi plan cuando quiera?',
    a: 'Sí. No hay contratos ni permanencias. Cancelas desde tu cuenta con un clic y no se te cobra el siguiente mes. Tus datos se mantienen disponibles durante 30 días.',
  },
  {
    q: '¿Funciona si vendo desde fuera de Honduras?',
    a: 'Droppi está optimizado para Honduras y Centroamérica, con soporte para moneda local y métodos de pago locales. Estamos expandiendo a otras regiones próximamente.',
  },
  {
    q: '¿Puedo llevar el inventario de mis prendas dentro de Droppi?',
    a: 'Sí. Cada prenda tiene su propio registro con foto, talla y precio. Al cerrar un drop, las prendas no vendidas pasan automáticamente a tu inventario y quedan listas para el próximo drop, sin que tengas que volver a cargarlas.',
  },
  {
    q: '¿Cuántas tiendas puedo tener?',
    a: 'Con los planes Starter y Pro puedes gestionar una tienda. Si necesitas múltiples tiendas o acceso para un equipo, el plan Enterprise está diseñado para eso.',
  },
];

const tickerItems = [
  ['Drops en vivo', 'con countdown'],
  ['Sin WhatsApp', 'sin caos'],
  ['Sin comisión', 'por venta'],
  ['Checkout', 'integrado'],
  ['Hecho en', 'Honduras 🇭🇳'],
  ['5 minutos', 'de configuración'],
];

const activityItems = [
  {
    initials: 'KM',
    gradient: 'linear-gradient(135deg,#C96442 0%,#9B4A2D 100%)',
    text: 'compró Blusa floral H&M · Talla M',
    badge: 'L 180',
    badgeClass: 'landing-activity-badge-green',
  },
  {
    initials: 'SG',
    gradient: 'linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)',
    text: "apartó Jeans Levi's 501 · Talla 28",
    badge: '48h',
    badgeClass: 'landing-activity-badge-yellow',
  },
  {
    initials: 'AR',
    gradient: 'linear-gradient(135deg,#0369A1 0%,#0c4a6e 100%)',
    text: 'compró Vestido midi Zara · Talla S',
    badge: 'L 220',
    badgeClass: 'landing-activity-badge-green',
  },
  {
    initials: 'GP',
    gradient: 'linear-gradient(135deg,#047857 0%,#064e3b 100%)',
    text: 'compró Chaqueta denim · Talla L',
    badge: 'L 450',
    badgeClass: 'landing-activity-badge-green',
  },
];

function NavButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="landing-nav-cta" href={href}>
      {children}
      <ArrowRight size={14} />
    </Link>
  );
}

function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="landing-btn-primary" href={href}>
      {children}
      <ArrowRight size={16} />
    </Link>
  );
}

function SecondaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="landing-btn-secondary" href={href}>
      <Play size={15} />
      {children}
    </Link>
  );
}

function CheckIcon() {
  return (
    <span className="landing-check-icon" aria-hidden="true">
      <Check size={10} />
    </span>
  );
}

export default function Home() {
  return (
    <main className="landing-page">
      <ScrollReveal />
      <div className="landing-nav-wrap">
        <div className="landing-shell">
          <nav className="landing-nav">
            <Link className="landing-brand" href="/">
              <Logo size={32} wordmarkSize={18} className="landing-logo" />
            </Link>

            <div className="landing-nav-links">
              <a href="#features">Producto</a>
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#precios">Precios</a>
              <a href="#testimonios">Historias</a>
            </div>

            <NavButton href="/onboarding">Empezar gratis</NavButton>
          </nav>
        </div>
      </div>

      <section className="landing-hero">
        <div className="landing-hero-grid" />
        <div className="landing-hero-glow" />

        <div className="landing-shell landing-hero-inner">
          <div className="landing-hero-badge landing-fade-up">
            <span className="landing-badge-dot" />
            Lanzamiento anticipado · Cupos limitados
          </div>

          <h1 className="landing-hero-title landing-fade-up landing-fade-up-1">
            Vende ropa
            <br />
            con <span>drops en vivo</span>.
            <br />
            Sin WhatsApp. Sin caos.
          </h1>

          <p className="landing-hero-copy landing-fade-up landing-fade-up-2">
            Droppi te da la tienda, el checkout, los pedidos y el inventario para vender con orden desde el primer día.
            Configuración en menos de 5 minutos.
          </p>

          <div className="landing-hero-actions landing-fade-up landing-fade-up-3">
            <PrimaryButton href="/onboarding">Crear mi tienda gratis</PrimaryButton>
            <SecondaryButton href="#como-funciona">Ver cómo funciona</SecondaryButton>
          </div>

          <div className="landing-proof landing-fade-up landing-fade-up-3">
            <span className="landing-proof-stars">★★★★★</span>
            <span className="landing-proof-text">Acceso anticipado · Sin comisión · Todo en un solo link</span>
          </div>

          <div className="landing-demo-grid" data-reveal>
            <article className="landing-demo-card">
              <div className="landing-demo-head">
                <span className="landing-demo-dot" />
                <strong>Drop en vivo — Fardo de primavera</strong>
                <span>Cierra en</span>
              </div>

              <div className="landing-demo-body">
                <div className="landing-countdown">
                  {[
                    ['02', 'horas'],
                    ['47', 'min'],
                    ['33', 'seg'],
                  ].map(([value, label]) => (
                    <div className="landing-countdown-card" key={label}>
                      <strong>{value}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>

                <div className="landing-demo-metrics">
                  <div className="landing-demo-metric">
                    <span>Viendo</span>
                    <strong>47</strong>
                    <em>↑ en vivo</em>
                  </div>
                  <div className="landing-demo-metric">
                    <span>Vendidas</span>
                    <strong>18/48</strong>
                    <em>↑ 37%</em>
                  </div>
                  <div className="landing-demo-metric">
                    <span>Recaudado</span>
                    <strong>L 3.4K</strong>
                    <em>↑ L 890</em>
                  </div>
                </div>
              </div>
            </article>

            <article className="landing-demo-card landing-demo-card-secondary">
              <div className="landing-demo-head">
                <span className="landing-demo-ring" />
                <strong>Actividad del drop</strong>
                <span>últimos 60 seg</span>
              </div>

              <div className="landing-demo-body landing-demo-body-compact">
                {activityItems.map(item => (
                  <div className="landing-activity-item" key={`${item.initials}-${item.badge}`}>
                    <span className="landing-activity-avatar" style={{ background: item.gradient }}>
                      {item.initials}
                    </span>
                    <p>
                      <strong>{item.initials === 'KM' ? 'Karla M.' : item.initials === 'SG' ? 'Sofía G.' : item.initials === 'AR' ? 'Andrea R.' : 'Gabriela P.'}</strong>{' '}
                      {item.text}
                    </p>
                    <span className={`landing-activity-badge ${item.badgeClass}`}>{item.badge}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <div className="landing-ticker">
        <div className="landing-ticker-track">
          {[...tickerItems, ...tickerItems].map(([strong, text], index) => (
            <div className="landing-ticker-item" key={`${strong}-${index}`}>
              <strong>{strong}</strong>
              <span>{text}</span>
              <i />
            </div>
          ))}
        </div>
      </div>

      <section className="landing-store-search-section" data-reveal>
        <div className="landing-shell">
          <div className="landing-store-search-inner">
            <div className="landing-store-search-text">
              <h2>¿Buscas una tienda?</h2>
              <p>Ingresa el nombre de la tienda y accede directo a su catálogo.</p>
            </div>
            <StoreSearchInput />
          </div>
        </div>
      </section>

      <section className="landing-section" id="features">
        <div className="landing-shell">
          <div className="landing-section-kicker" data-reveal>Producto</div>
          <h2 className="landing-section-title" data-reveal data-delay="1">
            Todo lo que necesitas
            <br />
            para vender <span>sin límites.</span>
          </h2>
          <p className="landing-section-copy" data-reveal data-delay="2">
            Desde el primer drop hasta la gestión diaria. Droppi te da las herramientas que usan las mejores tiendas de
            ropa en Honduras.
          </p>

          <div className="landing-features-grid">
            {features.map(({ title, description, Icon }, i) => (
              <article className="landing-feature-card" key={title} data-reveal data-delay={String((i % 3) + 1)}>
                <div className="landing-feature-icon">
                  <Icon size={20} />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt" id="como-funciona">
        <div className="landing-shell">
          <div className="landing-section-kicker" data-reveal>Proceso</div>
          <h2 className="landing-section-title" data-reveal data-delay="1">
            De cero a <span>vendiendo</span>
            <br />
            en 4 pasos.
          </h2>

          <div className="landing-steps-grid">
            {steps.map((step, index) => (
              <article className="landing-step" key={step.title} data-reveal data-delay={String(index + 1)}>
                <span>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section" id="testimonios">
        <div className="landing-shell">
          <div className="landing-section-kicker" data-reveal>Historias reales</div>
          <h2 className="landing-section-title" data-reveal data-delay="1">
            Emprendedoras que
            <br />
            encontraron su <span>sistema.</span>
          </h2>

          <div className="landing-testimonials-grid">
            {testimonials.map((testimonial, i) => (
              <article className="landing-testimonial-card" key={testimonial.name} data-reveal data-delay={String(i + 1)}>
                <div className="landing-stars">★★★★★</div>
                <p>{testimonial.quote}</p>
                <strong>{testimonial.result}</strong>
                <div className="landing-testimonial-author">
                  <span style={{ background: testimonial.gradient }}>{testimonial.initials}</span>
                  <div>
                    <h3>{testimonial.name}</h3>
                    <small>{testimonial.role}</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt" id="precios">
        <div className="landing-shell">
          <div className="landing-section-kicker">Precios</div>
          <h2 className="landing-section-title">
            Precios claros,
            <br />
            <span>sin sorpresas.</span>
          </h2>
          <p className="landing-section-copy">
            Empieza simple. Escala cuando tu operación lo pida. Sin comisión por venta en ningún plan.
          </p>

          <div className="landing-pricing-grid">
            {plans.map((plan, i) => (
              <article className={`landing-plan${plan.highlighted ? ' landing-plan-highlighted' : ''}`} key={plan.name} data-reveal data-delay={String(i + 1)}>
                {plan.highlighted && <div className="landing-plan-badge">Más popular</div>}
                <span className="landing-plan-name">{plan.name}</span>
                <p className="landing-plan-description">{plan.description}</p>
                <div className="landing-plan-price">
                  <strong>{plan.price}</strong>
                  {plan.suffix ? <span>{plan.suffix}</span> : null}
                </div>
                <Link className={`landing-plan-cta${plan.highlighted ? ' landing-plan-cta-dark' : ''}`} href="/onboarding">
                  {plan.cta} <ArrowRight size={14} />
                </Link>
                <ul>
                  {plan.features.map(feature => (
                    <li key={feature}>
                      <CheckIcon />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <p className="landing-pricing-note">✓ Sin comisión por venta · ✓ Cancela cuando quieras · ✓ Soporte en español</p>
        </div>
      </section>

      <section className="landing-section" id="faq">
        <div className="landing-shell">
          <div className="landing-section-kicker" data-reveal>FAQS</div>
          <h2 className="landing-section-title" style={{ textAlign: 'center' }} data-reveal data-delay="1">
            Preguntas
            <br />
            <span>frecuentes.</span>
          </h2>

          <div className="landing-faq-list">
            {faqs.map(({ q, a }, i) => (
              <details className="landing-faq-item" key={q} data-reveal data-delay={String((i % 3) + 1)}>
                <summary>{q}</summary>
                <p className="landing-faq-answer">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-final-cta" data-reveal>
        <div className="landing-final-glow" />
        <div className="landing-shell">
          <div className="landing-section-kicker landing-section-kicker-center">Empieza hoy</div>
          <h2 className="landing-final-title">
            Tu audiencia ya existe.
            <br />
            Lo que faltaba era una forma
            <br />
            <span>simple de venderle.</span>
          </h2>
          <p className="landing-final-copy">
            Publica tus prendas, comparte tu link y empieza a vender hoy — sin montar una web, sin comisión por venta.
          </p>
          <div className="landing-final-actions">
            <PrimaryButton href="/onboarding">Crear mi link de ventas</PrimaryButton>
            <a className="landing-btn-secondary landing-btn-secondary-plain" href="mailto:hola@droppi.app">
              Hablar con el equipo
            </a>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer-grid">
          <div>
            <div className="landing-footer-brand">
              <Logo size={24} wordmarkSize={16} className="landing-logo" />
            </div>
            <p>
              La plataforma para vender desde tu audiencia. Drops, checkout y gestión en un solo link.
            </p>
            <span className="landing-footer-tag">Hecho en Honduras 🇭🇳</span>
          </div>

          <div>
            <strong>Producto</strong>
            <a href="#features">Características</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#precios">Precios</a>
            <a href="#testimonios">Historias</a>
          </div>

          <div>
            <strong>Soporte</strong>
            <a href="/contacto">Contacto</a>
            <a href="/ayuda">Centro de ayuda</a>
            <a href="https://wa.me/50499999999">WhatsApp</a>
          </div>

          <div>
            <strong>Legal</strong>
            <a href="/privacidad">Privacidad</a>
            <a href="/terminos">Términos de uso</a>
            <a href="/cookies">Cookies</a>
          </div>
        </div>

        <div className="landing-shell landing-footer-bottom">
          <span>© 2026 Droppi. Todos los derechos reservados.</span>
          <span>{PLATFORM.location}</span>
        </div>
      </footer>
    </main>
  );
}
