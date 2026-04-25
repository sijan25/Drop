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
      style={{ position: 'fixed', inset: 0, zIndex, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, backdropFilter: `blur(${blur})`, WebkitBackdropFilter: `blur(${blur})`, padding: 18 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{ width: `min(${typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth}, calc(100vw - 32px))`, maxHeight: 'calc(100vh - 36px)', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 30px 90px rgba(0,0,0,0.28)', animation: 'slideUp .22s ease', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
