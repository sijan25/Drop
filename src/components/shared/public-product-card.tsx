'use client';

import Image from 'next/image';
import type { KeyboardEvent } from 'react';

import { cld } from '@/lib/cloudinary/client';
import { Icons } from '@/components/shared/icons';
import { Ph } from '@/components/shared/image-placeholder';
import { getProductSizeQuantities, getProductSizes, getProductTotalQuantity } from '@/lib/product-sizes';

type ProductCardTone = 'rose' | 'sand' | 'sage' | 'blue' | 'dark' | 'neutral' | 'warm';

type PublicProduct = {
  id: string;
  nombre: string;
  marca: string | null;
  precio: number;
  fotos: string[] | null;
  estado: string | null;
  talla: string | null;
  tallas: string[] | null;
  cantidad: number | null;
  cantidades_por_talla: unknown;
  created_at?: string | null;
};

type PublicProductCardProps = {
  product: PublicProduct;
  tone?: ProductCardTone;
  density?: 'normal' | 'compact';
  isNew?: boolean;
  isPreview?: boolean;
  views?: number | null;
  showActions?: boolean;
  cartActive?: boolean;
  cartTitle?: string;
  onOpen: () => void;
  onBuy?: () => void;
  onCart?: () => void;
};

function isAvailable(estado: string | null, totalUnits: number) {
  if (estado === 'apartada') return false;
  if (totalUnits > 0 && (estado === 'vendida' || !estado || estado === 'disponible' || estado === 'remanente')) return true;
  return false;
}

export function PublicProductCard({
  product,
  tone = 'neutral',
  density = 'normal',
  isNew = false,
  isPreview = false,
  views = null,
  showActions = true,
  cartActive = false,
  cartTitle = 'Añadir al carrito',
  onOpen,
  onBuy,
  onCart,
}: PublicProductCardProps) {
  const sizes = getProductSizes(product);
  const qtys = sizes.length > 0 ? getProductSizeQuantities(product) : {};
  const totalUnits = getProductTotalQuantity(product);
  const disponible = isAvailable(product.estado, totalUnits);
  const vendida = product.estado === 'vendida' && totalUnits <= 0;
  const apartada = product.estado === 'apartada';
  const hasActions = showActions && disponible;
  const isCompact = density === 'compact';

  function activateCard() {
    onOpen();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activateCard();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={activateCard}
      onKeyDown={handleKeyDown}
      onMouseEnter={event => {
        event.currentTarget.style.transform = 'translateY(-2px)';
        event.currentTarget.style.boxShadow = isCompact ? '0 8px 20px rgba(0,0,0,0.08)' : '0 10px 26px rgba(0,0,0,0.10)';
      }}
      onMouseLeave={event => {
        event.currentTarget.style.transform = 'none';
        event.currentTarget.style.boxShadow = 'none';
      }}
      className={`bg-white overflow-hidden cursor-pointer border border-[#E8E4DF] transition-[transform,box-shadow] duration-[180ms] ease-in-out relative flex flex-col h-full text-inherit outline-none ${isCompact ? 'rounded-[14px]' : 'rounded-[16px]'}`}
    >
      <div className="relative overflow-hidden bg-[#F2F0EC] aspect-[3/4]">
        {product.fotos?.[0] ? (
          <Image
            src={cld(product.fotos[0], 'card')}
            alt={product.nombre}
            fill
            sizes={isCompact ? '(max-width: 900px) 50vw, 240px' : '(max-width: 640px) 50vw, 220px'}
            style={{
              objectFit: 'cover',
              display: 'block',
              filter: !disponible ? 'grayscale(0.35) brightness(0.76)' : isPreview ? 'brightness(0.9)' : 'none',
            }}
          />
        ) : (
          <Ph tone={disponible ? tone : 'warm'} aspect="3/4" radius={0} />
        )}

        <div className="absolute top-[10px] left-[10px] flex gap-[5px] flex-wrap">
          {isNew && (
            <span className="bg-[var(--dark)] text-white text-[10px] font-[800] px-2 py-1 rounded-[6px] tracking-[0.04em]">
              NUEVO
            </span>
          )}
          {isPreview && disponible && (
            <span className="bg-[rgba(10,10,10,0.78)] text-white text-[10px] font-[800] px-2 py-1 rounded-[999px] tracking-[0.05em] uppercase">
              Preview
            </span>
          )}
          {views !== null && views > 600 && (
            <span className="bg-[rgba(201,100,66,0.12)] text-[#C96442] text-[10px] font-[800] px-2 py-1 rounded-[6px] border border-[rgba(201,100,66,0.3)] tracking-[0.04em] flex items-center gap-1">
              <Icons.sparkle width={11} height={11} />
              HOT
            </span>
          )}
        </div>

        {!disponible && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-white px-[13px] py-[6px] rounded-[8px] text-[10px] font-[800] tracking-[0.08em] uppercase backdrop-blur-[4px] ${vendida ? 'bg-[rgba(10,10,10,0.86)]' : 'bg-[rgba(120,60,0,0.84)]'}`}>
              {vendida ? 'Vendida' : 'Apartada'}
            </span>
          </div>
        )}
      </div>

      <div className={`flex-1 flex flex-col ${isCompact ? 'p-[10px_11px_11px] gap-[6px]' : 'p-[11px_12px_12px] gap-[7px]'}`}>
        <div>
          <div className={`font-[800] whitespace-nowrap overflow-hidden text-ellipsis leading-[1.2] ${isCompact ? 'text-[13px]' : 'text-[14px]'} ${disponible ? 'text-[#111]' : 'text-[#aaa]'}`}>
            {product.nombre}
          </div>
          {product.marca && (
            <div className={`font-medium text-[#999] mt-[3px] whitespace-nowrap overflow-hidden text-ellipsis ${isCompact ? 'text-[11px]' : 'text-[12px]'}`}>
              {product.marca}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap min-h-6">
          {sizes.length > 0 ? sizes.map(size => {
            const qty = qtys[size] ?? 0;
            const active = disponible && qty > 0;
            return (
              <span
                key={size}
                className={`text-[11px] font-[800] px-2 py-1 rounded-[7px] leading-none ${active ? 'bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0]' : 'bg-[#f5f5f5] text-[#bbb] border border-[#e5e5e5]'}`}
              >
                {size}
              </span>
            );
          }) : (
            disponible && totalUnits > 0 && (
              <span className="text-[11px] font-[800] px-2 py-1 rounded-[7px] bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0] leading-none">
                {totalUnits} disp.
              </span>
            )
          )}
        </div>

        <div className="flex items-center justify-between gap-[10px] mt-auto">
          <span className={`mono tnum font-[850] leading-none ${isCompact ? 'text-[15px]' : 'text-[17px]'} ${disponible ? 'text-[#111]' : 'text-[#bbb] line-through'}`}>
            L {product.precio.toLocaleString()}
          </span>
          <span className={`inline-flex items-center gap-[5px] font-bold whitespace-nowrap ${isCompact ? 'text-[11px]' : 'text-[12px]'}`}>
            <span className={`w-[7px] h-[7px] rounded-[99px] shrink-0 ${vendida ? 'bg-[#ef4444]' : apartada ? 'bg-[#f59e0b]' : isPreview ? 'bg-[#888]' : 'bg-[#22c55e]'}`} />
            <span className={vendida ? 'text-[#ef4444]' : apartada ? 'text-[#f59e0b]' : isPreview ? 'text-[#777]' : 'text-[#16a34a]'}>
              {vendida ? 'Vendida' : apartada ? 'Apartada' : isPreview ? 'Preview' : 'Disponible'}
            </span>
          </span>
        </div>

        {views !== null && views > 0 && (
          <span className="text-[11px] text-[#aaa] inline-flex items-center gap-1">
            <Icons.eye width={12} height={12} />
            {views} viendo
          </span>
        )}
      </div>

      {hasActions && (
        <div className={`grid gap-2 grid-cols-[1fr_auto] ${isCompact ? 'px-[11px] pb-[11px]' : 'px-3 pb-3'}`}>
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              (onBuy ?? onOpen)();
            }}
            className={`rounded-[9px] bg-[#C96442] text-white border-none text-[13px] font-[800] cursor-pointer flex items-center justify-center ${isCompact ? 'h-[36px]' : 'h-[40px]'}`}
          >
            Comprar
          </button>
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              (onCart ?? onOpen)();
            }}
            title={cartTitle}
            className={`rounded-[9px] border-[1.5px] border-[#E8E4DF] cursor-pointer flex items-center justify-center ${isCompact ? 'w-[36px] h-[36px]' : 'w-[40px] h-[40px]'} ${cartActive ? 'bg-[var(--accent-3)] text-white' : 'bg-white text-[var(--accent-3)]'}`}
          >
            <Icons.bag width={15} height={15} />
          </button>
        </div>
      )}
    </div>
  );
}
