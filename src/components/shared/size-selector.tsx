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
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {selected.length > 0
              ? `${selected.length} seleccionada${selected.length === 1 ? '' : 's'}`
              : allowEmpty ? 'Sin talla seleccionada' : 'Seleccioná al menos una opción'}
          </div>
        </div>
        {allowEmpty && selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            style={{ height: 32, borderRadius: 8, padding: '0 10px', border: '1px solid var(--line)', background: '#fff', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', cursor: 'pointer', flexShrink: 0 }}
          >
            Sin talla
          </button>
        )}
      </div>

      {onQuantityChange && selected.length > 0 && (
        <div style={{ padding: '0 12px 12px', borderBottom: '1px solid var(--line)', display: 'grid', gap: 8 }}>
          {selected.map(size => {
            const qty = quantities?.[size] ?? 0;
            return (
              <div key={size} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', background: qty > 0 ? '#fff' : 'var(--surface-2)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{size}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {qty > 0 ? `${qty} disponible${qty === 1 ? '' : 's'}` : 'Sin stock en esta talla'}
                  </div>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => qty > 0 && onQuantityChange(size, qty - 1)}
                    style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--line)', background: '#fff', fontSize: 16, fontWeight: 700, cursor: qty > 0 ? 'pointer' : 'default', opacity: qty > 0 ? 1 : 0.45 }}
                  >
                    −
                  </button>
                  <div className="mono tnum" style={{ minWidth: 22, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>{qty}</div>
                  <button
                    type="button"
                    onClick={() => onQuantityChange(size, qty + 1)}
                    style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--line)', background: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(58px, 1fr))', gap: 8 }}>
        {normalized.map(size => {
          const active = selectedSet.has(size);
          return (
            <button
              key={size}
              type="button"
              onClick={() => toggle(size)}
              style={{
                height: 38,
                borderRadius: 8,
                border: active ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                background: active ? 'var(--ink)' : '#fff',
                color: active ? '#fff' : 'var(--ink)',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
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
