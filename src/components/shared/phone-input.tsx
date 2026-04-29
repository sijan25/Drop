'use client';

import { useState } from 'react';
import { getCountries, getCountryCallingCode, parsePhoneNumberWithError, type CountryCode } from 'libphonenumber-js';

const flag = (code: string) =>
  code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));

const ALL_COUNTRIES: { iso: CountryCode; code: string }[] = getCountries()
  .map(iso => ({ iso, code: `+${getCountryCallingCode(iso)}` }))
  .sort((a, b) => {
    if (a.iso === 'HN') return -1;
    if (b.iso === 'HN') return 1;
    return a.code.localeCompare(b.code);
  });

function parsePhone(full: string): { prefix: string; iso: CountryCode; local: string } {
  if (full) {
    try {
      const parsed = parsePhoneNumberWithError(full.startsWith('+') ? full : `+${full}`);
      if (parsed.country) {
        const code = `+${getCountryCallingCode(parsed.country)}`;
        return { prefix: code, iso: parsed.country, local: parsed.nationalNumber };
      }
    } catch { /* fall through */ }
  }
  return { prefix: '+504', iso: 'HN', local: full ?? '' };
}

interface PhoneInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputStyle?: React.CSSProperties;
  selectStyle?: React.CSSProperties;
  size?: 'sm' | 'md' | 'lg';
}

export function PhoneInput({
  value,
  onChange,
  placeholder = '99990000',
  className = 'input',
  inputStyle,
  selectStyle,
  size = 'md',
}: PhoneInputProps) {
  const parsed = parsePhone(value ?? '');
  const [iso, setIso] = useState<CountryCode>(parsed.iso);
  const [local, setLocal] = useState(parsed.local);

  const height = size === 'lg' ? 48 : size === 'sm' ? 32 : 38;
  const fontSize = size === 'lg' ? 14 : 13;

  function handleIso(newIso: CountryCode) {
    setIso(newIso);
    const code = `+${getCountryCallingCode(newIso)}`;
    onChange(code + local);
  }

  function handleLocal(l: string) {
    setLocal(l);
    const code = `+${getCountryCallingCode(iso)}`;
    onChange(code + l);
  }

  const prefix = `+${getCountryCallingCode(iso)}`;

  return (
    <div style={{ display: 'flex' }}>
      <select
        value={iso}
        onChange={e => handleIso(e.target.value as CountryCode)}
        style={{
          height,
          borderRadius: '8px 0 0 8px',
          border: '1px solid var(--line)',
          borderRight: 'none',
          background: 'var(--surface-2)',
          padding: '0 8px',
          fontSize,
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
          color: 'var(--ink)',
          ...selectStyle,
        }}
      >
        {ALL_COUNTRIES.map(c => (
          <option key={c.iso} value={c.iso}>{flag(c.iso)} {c.code}</option>
        ))}
      </select>
      <input
        className={className}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={local}
        onChange={e => handleLocal(e.target.value)}
        placeholder={placeholder}
        style={{ borderRadius: '0 8px 8px 0', flex: 1, ...inputStyle }}
      />
      <input type="hidden" value={prefix + local} />
    </div>
  );
}
