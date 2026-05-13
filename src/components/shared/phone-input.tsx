'use client';

import { useState } from 'react';
import { getCountries, getCountryCallingCode, parsePhoneNumberWithError, type CountryCode } from 'libphonenumber-js';

export function isoFromPhoneCode(codigoTelefono: string): CountryCode {
  const dial = codigoTelefono.replace('+', '').trim();
  return (getCountries().find(iso => String(getCountryCallingCode(iso)) === dial) ?? 'HN') as CountryCode;
}

const flag = (code: string) =>
  code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));

const ALL_COUNTRIES: { iso: CountryCode; code: string }[] = getCountries()
  .map(iso => ({ iso, code: `+${getCountryCallingCode(iso)}` }))
  .sort((a, b) => {
    if (a.iso === 'HN') return -1;
    if (b.iso === 'HN') return 1;
    return a.code.localeCompare(b.code);
  });

const NATIONAL_DIGIT_LIMITS: Partial<Record<CountryCode, number>> = {
  HN: 8,
};

function normalizeLocal(value: string, iso: CountryCode) {
  const digits = value.replace(/\D/g, '');
  const limit = NATIONAL_DIGIT_LIMITS[iso];
  return limit ? digits.slice(0, limit) : digits;
}

function parsePhone(full: string, defaultCountry: CountryCode = 'HN'): { prefix: string; iso: CountryCode; local: string } {
  if (full) {
    try {
      const parsed = parsePhoneNumberWithError(full.startsWith('+') ? full : `+${full}`);
      if (parsed.country) {
        const code = `+${getCountryCallingCode(parsed.country)}`;
        return { prefix: code, iso: parsed.country, local: parsed.nationalNumber };
      }
    } catch { /* fall through */ }
  }
  const prefix = `+${getCountryCallingCode(defaultCountry)}`;
  return { prefix, iso: defaultCountry, local: full ?? '' };
}

interface PhoneInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputStyle?: React.CSSProperties;
  selectStyle?: React.CSSProperties;
  size?: 'sm' | 'md' | 'lg';
  defaultCountry?: CountryCode;
}

export function PhoneInput({
  value,
  onChange,
  placeholder = '99990000',
  className = 'input',
  inputStyle,
  selectStyle,
  size = 'md',
  defaultCountry = 'HN',
}: PhoneInputProps) {
  const parsed = parsePhone(value ?? '', defaultCountry);
  const [iso, setIso] = useState<CountryCode>(parsed.iso);
  const [local, setLocal] = useState(parsed.local);

  const height = size === 'lg' ? 48 : size === 'sm' ? 32 : 38;
  const fontSize = size === 'lg' ? 14 : 13;

  function handleIso(newIso: CountryCode) {
    setIso(newIso);
    const nextLocal = normalizeLocal(local, newIso);
    setLocal(nextLocal);
    const code = `+${getCountryCallingCode(newIso)}`;
    onChange(code + nextLocal);
  }

  function handleLocal(l: string) {
    const nextLocal = normalizeLocal(l, iso);
    setLocal(nextLocal);
    const code = `+${getCountryCallingCode(iso)}`;
    onChange(code + nextLocal);
  }

  const prefix = `+${getCountryCallingCode(iso)}`;
  const maxLength = NATIONAL_DIGIT_LIMITS[iso];

  return (
    <div className="flex min-w-0 w-full border border-[var(--line)] rounded-[8px] overflow-hidden bg-white" style={{ height }}>
      <select
        value={iso}
        onChange={e => handleIso(e.target.value as CountryCode)}
        className="h-full border-none border-r border-[var(--line)] bg-[var(--surface-2)] px-2 font-semibold cursor-pointer shrink-0 text-[var(--ink)] outline-none"
        style={{ fontSize, borderRight: '1px solid var(--line)', ...selectStyle }}
      >
        {ALL_COUNTRIES.map(c => (
          <option key={c.iso} value={c.iso}>{flag(c.iso)} {c.code}</option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={local}
        maxLength={maxLength}
        onChange={e => handleLocal(e.target.value)}
        placeholder={placeholder}
        className="border-none outline-none flex-1 min-w-0 px-3 bg-transparent text-[var(--ink)]"
        style={{ fontSize, ...inputStyle }}
      />
      <input type="hidden" value={prefix + local} />
    </div>
  );
}
