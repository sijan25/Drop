'use client';

import { useEffect } from 'react';
import { useCountdown, pad } from '@/hooks/use-countdown';

interface CountdownProps {
  target: number;
  size?: 'hero' | 'md' | 'sm';
  label?: boolean;
  urgent?: boolean;
  color?: string;
  onExpire?: () => void;
}

export function CountdownTimer({ target, size = 'md', label = true, urgent = false, color: colorProp, onExpire }: CountdownProps) {
  const { d, h, m, s, diff, ready, done } = useCountdown(target);

  useEffect(() => {
    if (done && onExpire) onExpire();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  const color = colorProp ?? (urgent || (ready && diff < 600000) ? 'var(--urgent)' : 'var(--ink)');

  if (size === 'hero') {
    const parts = [['d', d], ['h', h], ['m', m], ['s', s]] as const;
    const filtered = parts.filter(([, v], i) => i > 0 || v > 0);
    return (
      <div className="flex gap-2 items-start">
        {filtered.map(([lbl, v]) => (
          <div key={lbl} className="flex-1 text-center py-[14px] bg-white rounded-[12px] border border-[var(--line)]">
            <div className="mono tnum text-[36px] font-medium leading-none tracking-[0]" style={{ color }}>{ready ? pad(v) : '--'}</div>
            {label && <div className="mono text-[10px] text-[var(--ink-3)] mt-[6px] uppercase tracking-[0.04em]">{{ d: 'días', h: 'horas', m: 'min', s: 'seg' }[lbl]}</div>}
          </div>
        ))}
      </div>
    );
  }

  if (size === 'sm') {
    return (
      <span className="mono tnum text-[13px] font-medium tracking-[0]" style={{ color }}>
        {ready ? `${d > 0 ? `${d}d ` : ''}${pad(h)}:${pad(m)}:${pad(s)}` : '--:--:--'}
      </span>
    );
  }

  return (
    <span className="mono tnum text-[16px] font-medium tracking-[0]" style={{ color }}>
      {ready ? `${d > 0 ? `${d}d ` : ''}${pad(h)}:${pad(m)}:${pad(s)}` : '--:--:--'}
    </span>
  );
}
