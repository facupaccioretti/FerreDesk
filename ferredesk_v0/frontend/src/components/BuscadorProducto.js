// este buscador es el que se usa en la grilla de presupuestos y ventas
import React, { useState } from 'react';

function BuscadorProducto({ productos, onSelect }) {
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  // Filtrar productos a partir de 2 caracteres
  const handleChange = (e) => {
    const value = e.target.value;
    setBusqueda(value);
    if (value.length >= 2) {
      const lower = value.toLowerCase();
      const sugs = productos.filter(
        p =>
          (p.codvta || '').toLowerCase().includes(lower) ||
          (p.codcom || '').toLowerCase().includes(lower) ||
          (p.deno || p.nombre || '').toLowerCase().includes(lower)
      );
      setSugerencias(sugs);
      setShowDropdown(true);
      setHighlighted(0);
    } else {
      setSugerencias([]);
      setShowDropdown(false);
      setHighlighted(0);
    }
  };

  const handleSelect = (producto) => {
    onSelect(producto);
    setBusqueda('');
    setSugerencias([]);
    setShowDropdown(false);
    setHighlighted(0);
  };

  return (
    <div style={{ position: 'relative', maxWidth: 400, marginBottom: 16 }}>
      <input
        type="text"
        value={busqueda}
        onChange={handleChange}
        onFocus={() => { if (sugerencias.length > 0) setShowDropdown(true); }}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        placeholder="Buscar productos"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        autoComplete="off"
        onKeyDown={e => {
          if (e.key === 'Enter') {
            if (sugerencias.length > 0 && busqueda) {
              handleSelect(sugerencias[highlighted]);
              e.preventDefault();
              e.stopPropagation();
            } else {
              e.preventDefault();
              e.stopPropagation();
            }
          } else if (e.key === 'ArrowDown') {
            setHighlighted(h => Math.min(h + 1, sugerencias.length - 1));
          } else if (e.key === 'ArrowUp') {
            setHighlighted(h => Math.max(h - 1, 0));
          }
        }}
      />
      {showDropdown && sugerencias.length > 0 && (
        <ul className="absolute z-10 bg-white border border-gray-200 rounded-lg mt-1 w-full max-h-56 overflow-auto shadow-lg">
          {sugerencias.map((p, idx) => (
            <li
              key={p.id}
              className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${highlighted === idx ? 'bg-gray-200' : ''}`}
              onMouseDown={() => handleSelect(p)}
              onMouseEnter={() => setHighlighted(idx)}
            >
              <span className="font-semibold">{p.codvta || p.codcom}</span> - {p.deno || p.nombre}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default BuscadorProducto;
