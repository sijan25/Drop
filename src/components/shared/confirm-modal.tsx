'use client'

import { Icons } from './icons'
import { ModalOverlay } from './modal-overlay'

// useEffect was removed — ModalOverlay handles Escape key internally

interface ConfirmModalProps {
  title: string
  description: string
  confirmLabel: string
  variant?: 'danger' | 'warning'
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmModal({
  title,
  description,
  confirmLabel,
  variant = 'danger',
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const isDanger = variant === 'danger'

  return (
    <ModalOverlay onClose={onClose} zIndex={100} maxWidth={400} blur="2px" bg="rgba(0,0,0,0.45)">
      <div style={{ overflow: 'hidden', borderRadius: 18 }}>
        {/* Icon */}
        <div style={{ padding: '28px 28px 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: isDanger ? '#fef2f2' : '#fffbeb',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isDanger ? '#dc2626' : '#d97706',
          }}>
            {isDanger
              ? <Icons.trash width={22} height={22} />
              : <Icons.close width={22} height={22} />
            }
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 28px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>
            {title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>
            {description}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '0 20px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
        }}>
          <button
            onClick={onClose}
            className="btn btn-outline"
            style={{ height: 40, fontSize: 13 }}
          >
            No, volver
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className="btn"
            style={{
              height: 40, fontSize: 13, fontWeight: 600,
              background: isDanger ? '#dc2626' : '#d97706',
              color: '#fff',
              border: 'none',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
