import React from 'react';

/**
 * Componente Card reutilizable para FerreDesk
 * @param {Object} props - Propiedades del componente
 * @param {React.ReactNode} props.children - Contenido del card
 * @param {string} props.className - Clases CSS adicionales
 * @param {string} props.variant - Variante del card ('default', 'light', 'metric', 'dashboard')
 * @param {Object} props.style - Estilos inline adicionales
 */
const Card = ({ 
  children, 
  className = "", 
  variant = "default",
  style = {},
  ...props 
}) => {
  const baseClasses = "rounded-lg shadow-md border";
  
  const variants = {
    default: "bg-gradient-to-br from-slate-800 to-slate-700 border-slate-800 ring-1 ring-orange-500/20",
    light: "bg-white border-slate-200",
    metric: "bg-gradient-to-br from-slate-800 to-slate-700 border-slate-800 ring-1 ring-orange-500/20 p-2 flex items-center space-x-2",
    dashboard: "bg-gradient-to-br from-slate-800 to-slate-700 border-slate-800 ring-1 ring-orange-500/20 p-3"
  };
  
  const variantClasses = variants[variant] || variants.default;
  
  return (
    <div 
      className={`${baseClasses} ${variantClasses} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
