import { Logo } from '@/components/shared/logo';

type AppLoadingScreenProps = {
  fixed?: boolean;
};

export function AppLoadingScreen({ fixed = false }: AppLoadingScreenProps) {
  return (
    <div
      aria-label="Cargando Droppi"
      aria-live="polite"
      className={`min-h-screen w-full flex items-center justify-center bg-[#FAF9F7] ${fixed ? 'fixed inset-0 z-[9999]' : 'relative'}`}
    >
      <div className="grid justify-items-center gap-8">
        <Logo size={72} wordmarkSize={44} />
        <div
          className="droppi-loading-spinner w-[42px] h-[42px] rounded-full border-4 border-[#E8DED5] border-t-[#C96442] [animation:droppi-loading-spin_0.72s_linear_infinite]"
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
