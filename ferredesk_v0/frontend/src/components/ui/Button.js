import React from 'react';

/**
 * Componente Button reutilizable para FerreDesk
 * @param {Object} props - Propiedades del componente
 * @param {React.ReactNode} props.children - Contenido del botón
 * @param {string} props.variant - Variante del botón ('primary', 'secondary', 'danger')
 * @param {string} props.size - Tamaño del botón ('sm', 'md', 'lg')
 * @param {string} props.className - Clases CSS adicionales
 * @param {Object} props.style - Estilos inline adicionales
 * @param {Function} props.onClick - Función de click
 * @param {boolean} props.disabled - Estado deshabilitado
 */
const Button = ({ 
  children, 
  variant = "primary",
  size = "md",
  className = "",
  style = {},
  onClick,
  disabled = false,
  type = "button",
  ...props 
}) => {
  const baseClasses = "rounded-lg transition-all duration-300 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    primary: "bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow-lg hover:shadow-xl focus:ring-orange-500",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-300 focus:ring-slate-500",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
    outline: "border border-slate-600 text-slate-300 hover:bg-slate-700 focus:ring-slate-500"
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };
  
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer";
  
  const variantClasses = variants[variant] || variants.primary;
  const sizeClasses = sizes[size] || sizes.md;
  
  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${disabledClasses} ${className}`}
      style={style}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
