import React from 'react';

/**
 * Componente Container reutilizable para FerreDesk
 * @param {Object} props - Propiedades del componente
 * @param {React.ReactNode} props.children - Contenido del contenedor
 * @param {string} props.variant - Variante del contenedor ('default', 'dashboard', 'page')
 * @param {string} props.className - Clases CSS adicionales
 * @param {Object} props.style - Estilos inline adicionales
 */
const Container = ({ 
  children, 
  variant = "default",
  className = "",
  style = {},
  ...props 
}) => {
  const baseClasses = "rounded-lg shadow-lg border";
  
  const variants = {
    default: "bg-gradient-to-br from-slate-800 to-slate-700 border-slate-800 ring-1 ring-orange-500/20 p-4",
    dashboard: "bg-gradient-to-br from-slate-800 to-slate-700 border-slate-800 ring-1 ring-orange-500/20 p-3",
    page: "bg-white border-slate-200 p-6",
    metric: "bg-gradient-to-br from-slate-800 to-slate-700 border-slate-800 ring-1 ring-orange-500/20 p-2"
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

export default Container;
