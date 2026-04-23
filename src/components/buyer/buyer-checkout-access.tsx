'use client';

import { useState } from 'react';
import { Icons } from '@/components/shared/icons';
import { BuyerAuthModal, type BuyerProfile } from './buyer-auth-modal';

export function BuyerCheckoutAccess({
  buyer,
  onBuyer,
}: {
  buyer: BuyerProfile | null;
  onBuyer: (buyer: BuyerProfile) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="buyer-checkout-access" style={{
        border: '1px solid rgba(0,0,0,0.08)',
        background: buyer ? '#f7fbf8' : '#f8f8f8',
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div className="buyer-checkout-access-copy" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: buyer ? '#ecfdf5' : '#fff',
            border: '1px solid rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: buyer ? '#047857' : '#555',
            flexShrink: 0,
          }}>
            {buyer ? <Icons.check width={17} height={17} /> : <Icons.user width={17} height={17} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>
              {buyer ? 'Datos de cuenta cargados' : '¿Ya tenés cuenta?'}
            </div>
            <div style={{ fontSize: 12, color: '#777', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {buyer ? buyer.email : 'Iniciá sesión y rellenamos tus datos.'}
            </div>
          </div>
        </div>

        {!buyer && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              height: 34,
              borderRadius: 9,
              border: '1px solid rgba(0,0,0,0.1)',
              background: '#fff',
              color: '#111',
              padding: '0 12px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Iniciar sesión
          </button>
        )}
      </div>

      {open && (
        <BuyerAuthModal
          onClose={() => setOpen(false)}
          onSuccess={profile => {
            onBuyer(profile);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
