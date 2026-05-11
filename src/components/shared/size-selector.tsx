'use client';

import { useMemo } from 'react';
import { normalizeProductSizes } from '@/lib/product-sizes';

export function SizeSelector({
  options,
  selected,
  onChange,
  quantities,
  onQuantityChange,
  allowEmpty = false,
}: {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  quantities?: Record<string, number>;
  onQuantityChange?: (size: string, qty: number) => void;
  tipoNegocio?: string;
  allowEmpty?: boolean;
}) {
  const normalized = useMemo(() => normalizeProductSizes(options), [options]);
  const selectedSet = new Set(selected);

  function toggle(size: string) {
    onChange(selectedSet.has(size)
      ? selected.filter(v => v !== size)
      : normalizeProductSizes([...selected, size]));
  }

  return (
    <div className="border border-[var(--line)] rounded-[12px] overflow-hidden bg-white">
      <div className="px-[14px] py-[12px] border-b border-[var(--line)] flex justify-between gap-[12px] items-center">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-[var(--ink-3)]">
            {selected.length > 0
              ? `${selected.length} seleccionada${selected.length === 1 ? '' : 's'}`
              : allowEmpty ? 'Sin talla seleccionada' : 'Seleccioná al menos una opción'}
          </div>
        </div>
        {allowEmpty && selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="h-[32px] rounded-[8px] px-[10px] border border-[var(--line)] bg-white text-[12px] font-bold text-[var(--ink-2)] cursor-pointer shrink-0"
          >
            Sin talla
          </button>
        )}
      </div>

      {onQuantityChange && selected.length > 0 && (
        <div className="px-[12px] pb-[12px] border-b border-[var(--line)] grid gap-[8px]">
          {selected.map(size => {
            const qty = quantities?.[size] ?? 0;
            return (
              <div
                key={size}
                className="flex items-center justify-between gap-[12px] border border-[var(--line)] rounded-[10px] px-[12px] py-[10px]"
                style={{ background: qty > 0 ? '#fff' : 'var(--surface-2)' }}
              >
                <div>
                  <div className="text-[13px] font-bold">{size}</div>
                  <div className="text-[11px] text-[var(--ink-3)]">
                    {qty > 0 ? `${qty} disponible${qty === 1 ? '' : 's'}` : 'Sin stock en esta talla'}
                  </div>
                </div>
                <div className="inline-flex items-center gap-[8px]">
                  <button
                    type="button"
                    onClick={() => qty > 0 && onQuantityChange(size, qty - 1)}
                    className="w-[28px] h-[28px] rounded-[8px] border border-[var(--line)] bg-white text-[16px] font-bold"
                    style={{ cursor: qty > 0 ? 'pointer' : 'default', opacity: qty > 0 ? 1 : 0.45 }}
                  >
                    −
                  </button>
                  <div className="mono tnum min-w-[22px] text-center text-[14px] font-bold">{qty}</div>
                  <button
                    type="button"
                    onClick={() => onQuantityChange(size, qty + 1)}
                    className="w-[28px] h-[28px] rounded-[8px] border border-[var(--line)] bg-white text-[16px] font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-[12px] grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-[8px]">
        {normalized.map(size => {
          const active = selectedSet.has(size);
          return (
            <button
              key={size}
              type="button"
              onClick={() => toggle(size)}
              className="h-[38px] rounded-[8px] text-[13px] font-extrabold cursor-pointer"
              style={{
                border: active ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                background: active ? 'var(--ink)' : '#fff',
                color: active ? '#fff' : 'var(--ink)',
              }}
            >
              {size}
            </button>
          );
        })}
      </div>
    </div>
  );
}
