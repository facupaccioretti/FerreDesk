import React, { useState, useRef, useEffect } from 'react';
import { IconVenta, IconFactura, IconCredito, IconPresupuesto, IconRecibo } from './ComprobanteIcono';

// Utilidad para icono y nombre corto
const getComprobanteIconAndLabel = (tipo, nombre = '', letra = '') => {
  const n = (nombre || '').toLowerCase();
  if (n.includes('presupuesto')) return { icon: <IconPresupuesto />, label: 'Presupuesto' };
  if (n.includes('venta')) return { icon: <IconVenta />, label: 'Venta' };
  if (n.includes('factura')) return { icon: <IconFactura />, label: `Factura${letra ? ' ' + letra : ''}` };
  if (n.includes('nota de crédito interna')) return { icon: <IconCredito />, label: 'N. Cred. Int.' };
  if (n.includes('nota de crédito')) return { icon: <IconCredito />, label: 'N. Cred.' };
  if (n.includes('nota de débito')) return { icon: <IconCredito />, label: 'N. Deb.' };
  if (n.includes('recibo')) return { icon: <IconRecibo />, label: 'Recibo' };
  return { icon: <IconFactura />, label: nombre };
};

function groupByTipo(opciones) {
  const groups = {};
  (opciones || []).forEach(c => {
    const group = (c.value || (c.label ? c.label.split(' ')[0] : '') || '').toUpperCase();
    if (!groups[group]) groups[group] = [];
    groups[group].push(c);
  });
  return groups;
}

export default function ComprobanteDropdown({ opciones = [], value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selected = opciones.find(c => c.value === value) || opciones[0] || {};
  const { icon, label } = getComprobanteIconAndLabel(selected.tipo, selected.label, selected.letra);
  const groups = groupByTipo(opciones);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        className={`relative w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2.5 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all hover:border-gray-400 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <div className="flex items-center">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 mr-3">
            {icon}
          </span>
          <div>
            <span className="block truncate font-medium">{label}</span>
          </div>
        </div>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </span>
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-80 rounded-md overflow-auto focus:outline-none border border-gray-200">
          <ul className="py-1 divide-y divide-gray-100" role="listbox">
            {Object.entries(groups).map(([groupName, options]) => (
              <li key={groupName} className="px-1 py-1">
                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 rounded-sm">{groupName}</div>
                <ul className="mt-1">
                  {options.map(option => {
                    const { icon: optIcon, label: optLabel } = getComprobanteIconAndLabel(option.tipo, option.label, option.letra);
                    return (
                      <li
                        key={option.value}
                        className={`relative cursor-pointer select-none py-2 pl-3 pr-9 hover:bg-gray-50 rounded-md ${value === option.value ? 'bg-gray-50' : ''}`}
                        role="option"
                        aria-selected={value === option.value}
                        onClick={() => { onChange(option.value); setIsOpen(false); }}
                      >
                        <div className="flex items-center">
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 mr-3">{optIcon}</span>
                          <div>
                            <span className={`block truncate ${value === option.value ? 'font-medium' : 'font-normal'}`}>{optLabel}</span>
                          </div>
                        </div>
                        {value === option.value && (
                          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-black">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 