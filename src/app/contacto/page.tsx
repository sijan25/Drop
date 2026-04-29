import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import { Logo } from '@/components/shared/logo';
import { PLATFORM } from '@/lib/config/platform';
import { ContactoForm } from './contacto-form';
import s from './contacto.module.css';

export const metadata: Metadata = {
  title: 'Contacto — Droppi',
  description: 'Escríbenos y te ayudamos.',
};

export default function ContactoPage() {
  return (
    <main className="landing-page">
      {/* Nav idéntico al landing */}
      <div className="landing-nav-wrap">
        <div className="landing-shell">
          <nav className="landing-nav">
            <Link className="landing-brand" href="/">
              <Logo size={32} wordmarkSize={18} className="landing-logo" />
            </Link>
            <div className="landing-nav-links">
              <a href="/#features">Producto</a>
              <a href="/#como-funciona">Cómo funciona</a>
              <a href="/#precios">Precios</a>
              <a href="/#testimonios">Historias</a>
            </div>
            <Link className="landing-nav-cta" href="/login">
              Empezar gratis <ArrowRight size={14} />
            </Link>
          </nav>
        </div>
      </div>

      {/* Contenido */}
      <div className={s.shell}>
        <div className={s.header}>
          <h1>¿En qué podemos ayudarte?</h1>
        </div>
        <div className={s.card}>
          <ContactoForm />
        </div>
      </div>

      {/* Footer idéntico al landing */}
      <footer className="landing-footer">
        <div className="landing-shell landing-footer-grid">
          <div>
            <div className="landing-footer-brand">
              <Logo size={24} wordmarkSize={16} className="landing-logo" />
            </div>
            <p>La plataforma para vender desde tu audiencia. Drops, checkout y gestión en un solo link.</p>
            <span className="landing-footer-tag">Hecho en Honduras 🇭🇳</span>
          </div>
          <div>
            <strong>Producto</strong>
            <a href="/#features">Características</a>
            <a href="/#como-funciona">Cómo funciona</a>
            <a href="/#precios">Precios</a>
            <a href="/#testimonios">Historias</a>
          </div>
          <div>
            <strong>Soporte</strong>
            <a href="/contacto">Contacto</a>
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
          <span>{PLATFORM.location}</span>
        </div>
      </footer>
    </main>
  );
}
