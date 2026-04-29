'use client';

import { useState, type FormEvent } from 'react';
import { ArrowRight, Search } from 'lucide-react';

export function StoreSearchInput() {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const username = value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (!username) return;
    window.location.href = `/${username}`;
  }

  return (
    <form className="store-search-form" onSubmit={handleSubmit}>
      <div className="store-search-input-wrap">
        <Search className="store-search-icon" size={18} aria-hidden="true" />
        <input
          className="store-search-input"
          type="text"
          placeholder="Ej: miciclita, karlamodas, zapatosbq..."
          value={value}
          onChange={e => setValue(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={60}
        />
        <button className="store-search-btn" type="submit" aria-label="Buscar tienda">
          <span>Ir a la tienda</span>
          <ArrowRight size={15} />
        </button>
      </div>
      <p className="store-search-hint">
        Cada tienda tiene su propio link: <strong>droppi.com/su-tienda</strong>
      </p>
    </form>
  );
}
