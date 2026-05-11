'use client';

import { useState } from 'react';
import { Icons } from '@/components/shared/icons';
import { BuyerAuthModal, type BuyerProfile } from './buyer-auth-modal';
import { cerrarSesionComprador } from '@/lib/buyer/actions';

export function BuyerCheckoutAccess({
  buyer,
  onBuyer,
  onLogout,
}: {
  buyer: BuyerProfile | null;
  onBuyer: (buyer: BuyerProfile) => void;
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await cerrarSesionComprador();
    setLoggingOut(false);
    onLogout?.();
  }

  return (
    <>
      <div className={`buyer-checkout-access border border-[rgba(0,0,0,0.08)] rounded-[12px] p-[12px_14px] mb-[18px] flex items-center justify-between gap-3 ${buyer ? 'bg-[#f7fbf8]' : 'bg-[#f8f8f8]'}`}>
        <div className="buyer-checkout-access-copy flex items-center gap-[10px] min-w-0">
          <div className={`w-[34px] h-[34px] rounded-[10px] border border-[rgba(0,0,0,0.06)] flex items-center justify-center shrink-0 ${buyer ? 'bg-[#ecfdf5] text-[#047857]' : 'bg-white text-[#555]'}`}>
            {buyer ? <Icons.check width={17} height={17} /> : <Icons.user width={17} height={17} />}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-[800] text-[#111]">
              {buyer ? 'Datos de cuenta cargados' : '¿Ya tenés cuenta?'}
            </div>
            <div className="text-[12px] text-[#777] mt-[2px] whitespace-nowrap overflow-hidden text-ellipsis">
              {buyer ? buyer.email : 'Iniciá sesión y rellenamos tus datos.'}
            </div>
          </div>
        </div>

        {!buyer ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-[34px] rounded-[9px] border border-[rgba(0,0,0,0.1)] bg-white text-[#111] px-3 text-[12px] font-[800] cursor-pointer shrink-0"
          >
            Iniciar sesión
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className={`h-[34px] rounded-[9px] border border-[rgba(0,0,0,0.1)] bg-white text-[#777] px-3 text-[12px] font-semibold cursor-pointer shrink-0 ${loggingOut ? 'opacity-50' : ''}`}
          >
            {loggingOut ? '...' : 'Cerrar sesión'}
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
