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
      style={{
        background: '#fff',
        borderRadius: isCompact ? 14 : 16,
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1px solid #E8E4DF',
        transition: 'transform .18s ease, box-shadow .18s ease',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        color: 'inherit',
        outline: 'none',
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden', background: '#F2F0EC' }}>
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

        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {isNew && (
            <span style={{ background: 'var(--dark)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 6, letterSpacing: '0.04em' }}>
              NUEVO
            </span>
          )}
          {isPreview && disponible && (
            <span style={{ background: 'rgba(10,10,10,0.78)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Preview
            </span>
          )}
          {views !== null && views > 600 && (
            <span style={{ background: 'rgba(201,100,66,0.12)', color: '#C96442', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(201,100,66,0.3)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icons.sparkle width={11} height={11} />
              HOT
            </span>
          )}
        </div>

        {!disponible && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ background: vendida ? 'rgba(10,10,10,0.86)' : 'rgba(120,60,0,0.84)', color: '#fff', padding: '6px 13px', borderRadius: 8, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
              {vendida ? 'Vendida' : 'Apartada'}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: isCompact ? '10px 11px 11px' : '11px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: isCompact ? 6 : 7 }}>
        <div>
          <div style={{ fontSize: isCompact ? 13 : 14, fontWeight: 800, color: disponible ? '#111' : '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
            {product.nombre}
          </div>
          {product.marca && (
            <div style={{ fontSize: isCompact ? 11 : 12, fontWeight: 500, color: '#999', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {product.marca}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', minHeight: 24 }}>
          {sizes.length > 0 ? sizes.map(size => {
            const qty = qtys[size] ?? 0;
            const active = disponible && qty > 0;
            return (
              <span
                key={size}
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '4px 8px',
                  borderRadius: 7,
                  background: active ? '#f0fdf4' : '#f5f5f5',
                  color: active ? '#16a34a' : '#bbb',
                  border: `1px solid ${active ? '#bbf7d0' : '#e5e5e5'}`,
                  lineHeight: 1,
                }}
              >
                {size}
              </span>
            );
          }) : (
            disponible && totalUnits > 0 && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 8px', borderRadius: 7, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', lineHeight: 1 }}>
                {totalUnits} disp.
              </span>
            )
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto' }}>
          <span className="mono tnum" style={{ fontSize: isCompact ? 15 : 17, fontWeight: 850, color: disponible ? '#111' : '#bbb', textDecoration: !disponible ? 'line-through' : 'none', lineHeight: 1 }}>
            L {product.precio.toLocaleString()}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: isCompact ? 11 : 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, flexShrink: 0, background: vendida ? '#ef4444' : apartada ? '#f59e0b' : isPreview ? '#888' : '#22c55e' }} />
            <span style={{ color: vendida ? '#ef4444' : apartada ? '#f59e0b' : isPreview ? '#777' : '#16a34a' }}>
              {vendida ? 'Vendida' : apartada ? 'Apartada' : isPreview ? 'Preview' : 'Disponible'}
            </span>
          </span>
        </div>

        {views !== null && views > 0 && (
          <span style={{ fontSize: 11, color: '#aaa', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icons.eye width={12} height={12} />
            {views} viendo
          </span>
        )}
      </div>

      {hasActions && (
        <div style={{ padding: isCompact ? '0 11px 11px' : '0 12px 12px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              (onBuy ?? onOpen)();
            }}
            style={{ height: isCompact ? 36 : 40, borderRadius: 9, background: '#C96442', color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
            style={{
              width: isCompact ? 36 : 40,
              height: isCompact ? 36 : 40,
              borderRadius: 9,
              border: '1.5px solid #E8E4DF',
              background: cartActive ? 'var(--accent-3)' : '#fff',
              color: cartActive ? '#fff' : 'var(--accent-3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icons.bag width={15} height={15} />
          </button>
        </div>
      )}
    </div>
  );
}
