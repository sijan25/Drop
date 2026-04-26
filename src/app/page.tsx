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
      'Programá lanzamientos con cuenta regresiva, feed de actividad en tiempo real y contador de viewers. Creás urgencia genuina que convierte.',
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
      'Mirás cuánto vendiste, qué prendas rotan más, el ticket promedio y la tasa de conversión de cada drop.',
    Icon: BarChart3,
  },
  {
    title: 'Verificación de comprobantes',
    description:
      'El sistema detecta si el monto, cuenta y referencia del comprobante coinciden. Vos aprobás o rechazás en un click.',
    Icon: ShieldCheck,
  },
  {
    title: 'Gestión de inventario',
    description:
      'Agregá prendas con foto, talla y precio. Al cerrar un drop, el remanente migra automáticamente al inventario para el próximo.',
    Icon: Package,
  },
  {
    title: 'Notificaciones a compradoras',
    description:
      'Avisá el próximo drop por WhatsApp o correo. Tus compradoras se anotan y vos mandás con un click antes de abrir.',
    Icon: MessageCircleMore,
  },
];

const steps: Step[] = [
  {
    title: 'Creá tu tienda',
    description:
      'Registrate, elegí tu username y configurá métodos de pago y envío. En menos de 5 minutos ya estás lista para vender.',
  },
  {
    title: 'Publicá tus prendas',
    description:
      'Subí fotos, asignás talla y precio. Cargás hasta 50 prendas con tu plan Starter y tu catálogo queda listo al instante.',
  },
  {
    title: 'Programá un drop',
    description:
      'Elegís fecha, hora y duración. Compartís el link en tus stories. Tus seguidoras se anotan para recibir alerta.',
  },
  {
    title: 'Vendé y entregá',
    description:
      'Tu tienda recibe pedidos, verifica comprobantes y gestiona envíos. Vos solo confirmás y empacás.',
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
      'IA para precios y categorías',
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

const tickerItems = [
  ['500+', 'tiendas activas'],
  ['L 2M+', 'en ventas procesadas'],
  ['Honduras', '& región'],
  ['5 minutos', 'de configuración'],
  ['Urgencia real', 'con countdown'],
  ['Checkout', 'integrado'],
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

function BrandLockup() {
  return (
    <span className="landing-logo">
      <svg className="landing-logo-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.5" fill="currentColor" />
      </svg>
      <span className="landing-logo-text">Droppi</span>
    </span>
  );
}

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
      <div className="landing-nav-wrap">
        <div className="landing-shell">
          <nav className="landing-nav">
            <Link className="landing-brand" href="/">
              <BrandLockup />
            </Link>

            <div className="landing-nav-links">
              <a href="#features">Producto</a>
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#precios">Precios</a>
              <a href="#testimonios">Historias</a>
            </div>

            <NavButton href="/login">Empezar gratis</NavButton>
          </nav>
        </div>
      </div>

      <section className="landing-hero">
        <div className="landing-hero-grid" />
        <div className="landing-hero-glow" />

        <div className="landing-shell landing-hero-inner">
          <div className="landing-hero-badge landing-fade-up">
            <span className="landing-badge-dot" />
            500+ tiendas vendiendo hoy en Honduras
          </div>

          <h1 className="landing-hero-title landing-fade-up landing-fade-up-1">
            Vendé ropa
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
            <PrimaryButton href="/login">Crear mi tienda gratis</PrimaryButton>
            <SecondaryButton href="#como-funciona">Ver cómo funciona</SecondaryButton>
          </div>

          <div className="landing-proof landing-fade-up landing-fade-up-3">
            <div className="landing-avatars">
              {[
              ['AK', 'linear-gradient(135deg,#1A8C64 0%,#0F5E43 100%)'],
              ['SM', 'linear-gradient(135deg,#1A6CA0 0%,#0F4A78 100%)'],
              ['KR', 'linear-gradient(135deg,#4ECFA0 0%,#1A8C64 100%)'],
              ['GB', 'linear-gradient(135deg,#2D6A4F 0%,#1A8C64 100%)'],
              ['MJ', 'linear-gradient(135deg,#1A6CA0 0%,#4ECFA0 100%)'],
              ].map(([label, gradient]) => (
                <span className="landing-avatar" key={label} style={{ background: gradient }}>
                  {label}
                </span>
              ))}
            </div>
            <p>
              <strong>L 2,000,000+</strong> en ventas procesadas
              <br />
              ★★★★★ 4.9 promedio de tiendas activas
            </p>
          </div>

          <div className="landing-demo-grid">
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

      <section className="landing-section" id="features">
        <div className="landing-shell">
          <div className="landing-section-kicker">Producto</div>
          <h2 className="landing-section-title">
            Todo lo que necesitás
            <br />
            para vender <span>sin límites.</span>
          </h2>
          <p className="landing-section-copy">
            Desde el primer drop hasta la gestión diaria. Droppi te da las herramientas que usan las mejores tiendas de
            ropa en Honduras.
          </p>

          <div className="landing-features-grid">
            {features.map(({ title, description, Icon }) => (
              <article className="landing-feature-card" key={title}>
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
          <div className="landing-section-kicker">Flujo</div>
          <h2 className="landing-section-title">
            De cero a <span>vendiendo</span>
            <br />
            en 4 pasos.
          </h2>

          <div className="landing-steps-grid">
            {steps.map((step, index) => (
              <article className="landing-step" key={step.title}>
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
          <div className="landing-section-kicker">Historias reales</div>
          <h2 className="landing-section-title">
            Emprendedoras que
            <br />
            encontraron su <span>sistema.</span>
          </h2>

          <div className="landing-testimonials-grid">
            {testimonials.map(testimonial => (
              <article className="landing-testimonial-card" key={testimonial.name}>
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
            Empezá simple. Escalá cuando tu operación lo pida. Sin comisión por venta en ningún plan.
          </p>

          <div className="landing-pricing-grid">
            {plans.map(plan => (
              <article className={`landing-plan${plan.highlighted ? ' landing-plan-highlighted' : ''}`} key={plan.name}>
                {plan.highlighted && <div className="landing-plan-badge">Más popular</div>}
                <span className="landing-plan-name">{plan.name}</span>
                <p className="landing-plan-description">{plan.description}</p>
                <div className="landing-plan-price">
                  <strong>{plan.price}</strong>
                  {plan.suffix ? <span>{plan.suffix}</span> : null}
                </div>
                <Link className={`landing-plan-cta${plan.highlighted ? ' landing-plan-cta-dark' : ''}`} href="/login">
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

          <p className="landing-pricing-note">✓ Sin comisión por venta · ✓ Cancelá cuando quieras · ✓ Soporte en español</p>
        </div>
      </section>

      <section className="landing-final-cta">
        <div className="landing-final-glow" />
        <div className="landing-shell">
          <div className="landing-section-kicker landing-section-kicker-center">Empezá hoy</div>
          <h2 className="landing-final-title">
            Tu audiencia ya existe.
            <br />
            Lo que faltaba era una forma
            <br />
            <span>simple de venderle.</span>
          </h2>
          <p className="landing-final-copy">
            Publicá tus prendas, compartí tu link y empezá a vender hoy — sin montar una web, sin comisión por venta.
          </p>
          <div className="landing-final-actions">
            <PrimaryButton href="/login">Empezar mi link de ventas</PrimaryButton>
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
              <BrandLockup />
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
            <a href="mailto:hola@droppi.app">Contacto</a>
            <a href="/ayuda">Centro de ayuda</a>
            <a href="https://wa.me/50498765432">WhatsApp</a>
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
          <span>San Pedro Sula, Honduras</span>
        </div>
      </footer>
    </main>
  );
}
