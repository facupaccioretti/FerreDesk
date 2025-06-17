import React, { useState, useRef, useEffect } from 'react';

const IconSumar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);
const IconDuplicar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
  </svg>
);

const OPCIONES = [
  {
    value: 'sumar',
    label: 'Sumar cantidades',
    icon: <IconSumar />,
  },
  {
    value: 'duplicar',
    label: 'Crear duplicado',
    icon: <IconDuplicar />,
  },
];

/**
 * Componente para manejar la lógica de duplicación y suma de ítems
 * @param {Object} props
 * @param {string} props.autoSumarDuplicados - Valor actual de la acción por defecto ('sumar' o 'duplicar')
 * @param {Function} props.setAutoSumarDuplicados - Función para actualizar la acción por defecto
 */
const SumarDuplicar = ({ autoSumarDuplicados, setAutoSumarDuplicados, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const [dropdownWidth, setDropdownWidth] = useState(undefined);
  const selected = OPCIONES.find(o => o.value === autoSumarDuplicados) || OPCIONES[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (buttonRef.current) {
      setDropdownWidth(buttonRef.current.offsetWidth);
    }
    const handleResize = () => {
      if (buttonRef.current) {
        setDropdownWidth(buttonRef.current.offsetWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  return (
    <div className="w-full" ref={dropdownRef}>
      <label className="block text-xs font-medium text-gray-500 mb-0.5">Acción por defecto al cargar ítem duplicado</label>
      <button
        type="button"
        ref={buttonRef}
        className={`relative w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2.5 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all hover:border-gray-400 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <div className="flex items-center">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 mr-3">
            {selected.icon}
          </span>
          <div>
            <span className="block truncate font-medium text-base">{selected.label}</span>
          </div>
        </div>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </span>
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 bg-white shadow-lg max-h-80 rounded-md overflow-auto focus:outline-none border border-gray-200" style={dropdownWidth ? { width: dropdownWidth } : {}}>
          <ul className="py-1 divide-y divide-gray-100" role="listbox">
            {OPCIONES.map(option => (
              <li
                key={option.value}
                className={`relative cursor-pointer select-none py-2 pl-3 pr-9 hover:bg-gray-50 rounded-md ${autoSumarDuplicados === option.value ? 'bg-gray-50' : ''}`}
                role="option"
                aria-selected={autoSumarDuplicados === option.value}
                onClick={() => { setAutoSumarDuplicados(option.value); setIsOpen(false); }}
              >
                <div className="flex items-center">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 mr-3">{option.icon}</span>
                  <div>
                    <span className={`block truncate ${autoSumarDuplicados === option.value ? 'font-medium' : 'font-normal'} text-base`}>{option.label}</span>
                  </div>
                </div>
                {autoSumarDuplicados === option.value && (
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-black">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SumarDuplicar; 