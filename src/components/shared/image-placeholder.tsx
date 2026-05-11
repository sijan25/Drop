interface PhProps {
  label?: string;
  aspect?: string;
  radius?: number;
  tone?: keyof typeof tones;
  style?: React.CSSProperties;
}

const tones = {
  neutral: { bg: '#e7ecf2', stripe: 'rgba(10,10,10,0.03)' },
  warm: { bg: '#ede6de', stripe: 'rgba(90,60,40,0.05)' },
  cool: { bg: '#dde4ec', stripe: 'rgba(30,50,80,0.04)' },
  dark: { bg: '#2a2e35', stripe: 'rgba(255,255,255,0.03)' },
  mid: { bg: '#b8c0cc', stripe: 'rgba(10,10,10,0.05)' },
  sand: { bg: '#dfd6c6', stripe: 'rgba(90,60,40,0.06)' },
  sage: { bg: '#d6ddd0', stripe: 'rgba(30,60,30,0.05)' },
  blue: { bg: '#c8d3e0', stripe: 'rgba(30,50,80,0.06)' },
  rose: { bg: '#e4d4d0', stripe: 'rgba(90,40,40,0.06)' },
};

export function Ph({ label, aspect = '1/1', radius = 10, tone = 'neutral', style = {} }: PhProps) {
  const t = tones[tone] || tones.neutral;
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: aspect,
        background: t.bg,
        backgroundImage: `repeating-linear-gradient(135deg, ${t.stripe} 0, ${t.stripe} 1px, transparent 1px, transparent 10px)`,
        borderRadius: radius,
        ...style,
      }}
    >
      {label && (
        <div
          className="absolute left-2 bottom-2 right-2 text-[10px] leading-[1.2] tracking-[-0.01em] whitespace-pre-line font-[var(--font-mono)]"
          style={{ color: tone === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(10,10,10,0.4)' }}
        >{label}</div>
      )}
    </div>
  );
}
