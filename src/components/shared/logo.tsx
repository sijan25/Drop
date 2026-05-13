import type { CSSProperties } from 'react';
import styles from './logo.module.css';

interface LogoProps {
  size?: number;
  wordmarkSize?: number;
  color?: string;
  white?: boolean;
  showWordmark?: boolean;
  className?: string;
  live?: boolean;
}

export function Logo({
  size = 20,
  wordmarkSize,
  color,
  white = false,
  showWordmark = true,
  className,
  live = false,
}: LogoProps) {
  const cssVars = {
    '--fd-logo-size': `${size}px`,
    '--fd-logo-gap': `${Math.max(8, Math.round(size * 0.22))}px`,
    '--fd-logo-wordmark-size': `${wordmarkSize ?? Math.max(13, Math.round(size * 0.68))}px`,
    '--fd-logo-text-color': color ?? (white ? '#ffffff' : '#1A1714'),
    '--fd-logo-tile-bg': white
      ? 'linear-gradient(180deg, rgba(255,248,243,0.96) 0%, rgba(248,240,233,0.94) 100%)'
      : 'linear-gradient(180deg, #d9754d 0%, #c96442 100%)',
    '--fd-logo-glyph-color': white ? '#1A1714' : '#fff8f3',
    '--fd-logo-border': white ? 'rgba(255,255,255,0.14)' : 'rgba(26,23,20,0.08)',
    '--fd-logo-shadow': white
      ? '0 16px 34px rgba(0,0,0,0.24)'
      : '0 12px 28px rgba(26,23,20,0.12)',
  } as CSSProperties;

  return (
    <span className={[styles.logo, className].filter(Boolean).join(' ')} style={cssVars}>
      <span className={styles.iconWrap} aria-hidden="true">
      <span className={styles.icon}>
        <svg className={styles.glyph} viewBox="0 0 48 48" fill="none">
          {/* D — left stroke */}
          <path
            d="M 11 15 L 11 40"
            stroke="var(--fd-logo-glyph-color)"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          {/* D — outer curve */}
          <path
            d="M 11 15 C 11 15 37 15 37 27.5 C 37 40 11 40 11 40"
            stroke="var(--fd-logo-glyph-color)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Bag body */}
          <rect
            x="14" y="19" width="20" height="15"
            rx="4"
            stroke="var(--fd-logo-glyph-color)"
            strokeWidth="3.75"
          />
          {/* Bag handle */}
          <path
            d="M 18.5 19 V 16.5 C 18.5 12.5 21.2 9.5 24 9.5 C 26.8 9.5 29.5 12.5 29.5 16.5 V 19"
            stroke="var(--fd-logo-glyph-color)"
            strokeWidth="3.75"
            strokeLinecap="round"
            fill="none"
          />
          {/* Handle crossbar */}
          <line
            x1="18.5" y1="14.5" x2="29.5" y2="14.5"
            stroke="var(--fd-logo-glyph-color)"
            strokeWidth="3.75"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {live && <span className={styles.liveDot} />}
      </span>

      {showWordmark ? <span className={styles.wordmark}>Droppi</span> : null}
    </span>
  );
}
