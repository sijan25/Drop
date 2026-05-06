import { Logo } from '@/components/shared/logo';

type AppLoadingScreenProps = {
  fixed?: boolean;
};

export function AppLoadingScreen({ fixed = false }: AppLoadingScreenProps) {
  return (
    <div
      aria-label="Cargando Droppi"
      aria-live="polite"
      style={{
        position: fixed ? 'fixed' : 'relative',
        inset: fixed ? 0 : undefined,
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FAF9F7',
        zIndex: fixed ? 9999 : undefined,
      }}
    >
      <div style={{ display: 'grid', justifyItems: 'center', gap: 32 }}>
        <Logo size={72} wordmarkSize={44} />
        <div
          className="droppi-loading-spinner"
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            border: '4px solid #E8DED5',
            borderTopColor: '#C96442',
            animation: 'droppi-loading-spin 0.72s linear infinite',
          }}
        />
      </div>
      <style>{`
        @keyframes droppi-loading-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 520px) {
          [aria-label="Cargando Droppi"] > div {
            transform: scale(0.82);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .droppi-loading-spinner {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
