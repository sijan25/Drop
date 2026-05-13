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
    '--fd-logo-shadow': white
      ? '0 16px 34px rgba(0,0,0,0.24)'
      : '0 12px 28px rgba(26,23,20,0.12)',
  } as CSSProperties;

  return (
    <span className={[styles.logo, className].filter(Boolean).join(' ')} style={cssVars}>
      <span className={styles.iconWrap} aria-hidden="true">
        <img src="/logo-icon.png" alt="" className={styles.icon} />
        {live && <span className={styles.liveDot} />}
      </span>

      {showWordmark ? <span className={styles.wordmark}>Droppi</span> : null}
    </span>
  );
}
