import React, { useState, useRef, useEffect } from 'react';

// SVG ICONS
const IconFactura = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);
const IconCredito = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
  </svg>
);
const IconDebito = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v7.5m2.25-6.466a9.016 9.016 0 0 0-3.461-.203c-.536.072-.974.478-1.021 1.017a4.559 4.559 0 0 0-.018.402c0 .464.336.844.775.994l2.95 1.012c.44.15.775.53.775.994 0 .136-.006.27-.018.402-.047.539-.485.945-1.021 1.017a9.077 9.077 0 0 1-3.461-.203M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);
const IconRecibo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
  </svg>
);

function getIcon(icon, label) {
  switch (icon) {
    case 'invoice': return <IconFactura />;
    case 'credit': return <IconCredito />;
    case 'debit': return <IconDebito />;
    case 'receipt': return <IconRecibo />;
    case 'document': return <IconFactura />;
    default:
      if ((label || '').toLowerCase().includes('crédito')) return <IconCredito />;
      if ((label || '').toLowerCase().includes('débito')) return <IconDebito />;
      if ((label || '').toLowerCase().includes('recibo')) return <IconRecibo />;
      if ((label || '').toLowerCase().includes('factura')) return <IconFactura />;
      return <IconFactura />;
  }
}

function groupByTipo(opciones) {
  // Agrupa por value (tipo principal)
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
  // Forzar label 'Presupuesto' si el value es 'presupuesto'
  const selectedLabel = selected.value === 'presupuesto' ? 'Presupuesto' : (selected.label || '');
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
            {getIcon(selected.icon, selectedLabel)}
          </span>
          <div>
            <span className="block truncate font-medium">{selectedLabel}</span>
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
                  {options.map(option => (
                    <li
                      key={option.value}
                      className={`relative cursor-pointer select-none py-2 pl-3 pr-9 hover:bg-gray-50 rounded-md ${value === option.value ? 'bg-gray-50' : ''}`}
                      role="option"
                      aria-selected={value === option.value}
                      onClick={() => { onChange(option.value); setIsOpen(false); }}
                    >
                      <div className="flex items-center">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 mr-3">{getIcon(option.icon, option.label)}</span>
                        <div>
                          <span className={`block truncate ${value === option.value ? 'font-medium' : 'font-normal'}`}>{option.label || ''}</span>
                        </div>
                      </div>
                      {value === option.value && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-black">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 