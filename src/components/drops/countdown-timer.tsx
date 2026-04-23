'use client';

import { useCountdown, pad } from '@/hooks/use-countdown';

interface CountdownProps {
  target: number;
  size?: 'hero' | 'md' | 'sm';
  label?: boolean;
  urgent?: boolean;
}

export function CountdownTimer({ target, size = 'md', label = true, urgent = false }: CountdownProps) {
  const { d, h, m, s, diff, ready } = useCountdown(target);
  const color = urgent || (ready && diff < 600000) ? 'var(--urgent)' : 'var(--ink)';

  if (size === 'hero') {
    const parts = [['d', d], ['h', h], ['m', m], ['s', s]] as const;
    const filtered = parts.filter(([, v], i) => i > 0 || v > 0);
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {filtered.map(([lbl, v]) => (
          <div key={lbl} style={{ flex: 1, textAlign: 'center', padding: '14px 0', background: '#fff', borderRadius: 12, border: '1px solid var(--line)' }}>
            <div className="mono tnum" style={{ fontSize: 36, fontWeight: 500, lineHeight: 1, color, letterSpacing: 0 }}>{ready ? pad(v) : '--'}</div>
            {label && <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.04 }}>{{ d: 'días', h: 'horas', m: 'min', s: 'seg' }[lbl]}</div>}
          </div>
        ))}
      </div>
    );
  }

  if (size === 'sm') {
    return (
      <span className="mono tnum" style={{ fontSize: 13, fontWeight: 500, color, letterSpacing: 0 }}>
        {ready ? `${d > 0 ? `${d}d ` : ''}${pad(h)}:${pad(m)}:${pad(s)}` : '--:--:--'}
      </span>
    );
  }

  return (
    <span className="mono tnum" style={{ fontSize: 16, fontWeight: 500, color, letterSpacing: 0 }}>
      {ready ? `${d > 0 ? `${d}d ` : ''}${pad(h)}:${pad(m)}:${pad(s)}` : '--:--:--'}
    </span>
  );
}
