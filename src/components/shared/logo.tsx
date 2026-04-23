'use client';

interface LogoProps {
  size?: number;
  color?: string;
  white?: boolean;
}

export function Logo({ size = 20, color, white }: LogoProps) {
  const c = color ?? (white ? '#fff' : 'currentColor');
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="9" fill="none" stroke={c} strokeWidth="1.5"/>
        <circle cx="10" cy="10" r="3" fill={c}/>
      </svg>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontWeight: 600, fontSize: 14, letterSpacing: 0,
        color: c,
      }}>Droppi</span>
    </div>
  );
}
