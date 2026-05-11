'use client';

import { useEffect, type ReactNode } from 'react';

interface ModalOverlayProps {
  onClose: () => void;
  children: ReactNode;
  zIndex?: number;
  maxWidth?: number | string;
  blur?: string;
  bg?: string;
}

export function ModalOverlay({ onClose, children, zIndex = 300, maxWidth = 540, blur = '10px', bg = 'rgba(8,8,8,0.62)' }: ModalOverlayProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-[18px]"
      style={{ zIndex, background: bg, backdropFilter: `blur(${blur})`, WebkitBackdropFilter: `blur(${blur})` }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="max-h-[calc(100vh-36px)] overflow-y-auto bg-white rounded-[18px] shadow-[0_30px_90px_rgba(0,0,0,0.28)] [animation:slideUp_.22s_ease] relative"
        style={{ width: `min(${typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth}, calc(100vw - 32px))` }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
