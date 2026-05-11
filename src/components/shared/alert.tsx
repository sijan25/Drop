'use client';

type AlertType = 'error' | 'success' | 'warning' | 'info';

const CLASSES: Record<AlertType, string> = {
  error:   'text-[#b91c1c] bg-[#fef2f2] border-[#fecaca]',
  success: 'text-[#047857] bg-[#ecfdf5] border-[#a7f3d0]',
  warning: 'text-[#92400e] bg-[#fffbeb] border-[#fde68a]',
  info:    'text-[#1d4ed8] bg-[#eff6ff] border-[#bfdbfe]',
};

export function Alert({ type = 'error', message }: { type?: AlertType; message: string }) {
  return (
    <div className={`text-[13px] px-[14px] py-[10px] border rounded-[8px] leading-[1.5] ${CLASSES[type]}`}>
      {message}
    </div>
  );
}
