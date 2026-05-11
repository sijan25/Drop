'use client'

import { Icons } from './icons'
import { ModalOverlay } from './modal-overlay'

// useEffect was removed — ModalOverlay handles Escape key internally

interface ConfirmModalProps {
  title: string
  description: string
  confirmLabel: string
  variant?: 'danger' | 'warning'
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmModal({
  title,
  description,
  confirmLabel,
  variant = 'danger',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const isDanger = variant === 'danger'

  return (
    <ModalOverlay onClose={onClose} zIndex={100} maxWidth={400} blur="2px" bg="rgba(0,0,0,0.45)">
      <div className="overflow-hidden rounded-[18px]">
        {/* Icon */}
        <div className="pt-7 px-7 flex justify-center">
          <div className={`w-[52px] h-[52px] rounded-[14px] flex items-center justify-center ${isDanger ? 'bg-[#fef2f2] text-[#dc2626]' : 'bg-[#fffbeb] text-[#d97706]'}`}>
            {isDanger
              ? <Icons.trash width={22} height={22} />
              : <Icons.close width={22} height={22} />
            }
          </div>
        </div>

        {/* Content */}
        <div className="px-7 pt-4 pb-6 text-center">
          <div className="text-[16px] font-bold tracking-[-0.01em] mb-2">
            {title}
          </div>
          <div className="text-[13px] text-[var(--ink-3)] leading-[1.55]">
            {description}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className={`btn btn-outline h-[40px] text-[13px] ${loading ? 'opacity-50' : ''}`}
          >
            No, volver
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            disabled={loading}
            className={`btn h-[40px] text-[13px] font-semibold text-white border-none ${isDanger ? 'bg-[#dc2626]' : 'bg-[#d97706]'} ${loading ? 'opacity-70' : ''}`}
          >
            {loading ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
