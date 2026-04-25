'use client';

type AlertType = 'error' | 'success' | 'warning' | 'info';

const STYLES: Record<AlertType, { color: string; bg: string; border: string }> = {
  error:   { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  success: { color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  warning: { color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  info:    { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
};

export function Alert({ type = 'error', message }: { type?: AlertType; message: string }) {
  const s = STYLES[type];
  return (
    <div style={{ fontSize: 13, color: s.color, padding: '10px 14px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, lineHeight: 1.5 }}>
      {message}
    </div>
  );
}
