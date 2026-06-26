"use client"

import React, { forwardRef } from "react"

const Badge = forwardRef(({
  children,
  variant = "solid", // "solid" | "outline"
  color = "primary", // "primary" | "accent" | "success" | "danger"
  className = "",
  as: Component = "span",
  ...props
}, ref) => {
  const baseClasses = "inline-flex items-center justify-center rounded-sm px-2 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none"

  const variants = {
    solid: {
      primary: "bg-[#1e2d3d] text-white", // Azul oscuro
      accent: "bg-[#e8641a] text-white", // Naranja
      success: "bg-[#16a34a] text-white", // Verde (del PIE_COLORS)
      danger: "bg-[#b91c1c] text-white", // Rojo oscuro
    },
    outline: {
      primary: "border border-[#1e2d3d] text-[#1e2d3d]",
      accent: "border border-[#e8641a] text-[#e8641a]",
      success: "border border-[#16a34a] text-[#16a34a]",
      danger: "border border-[#b91c1c] text-[#b91c1c]",
    },
  }

  const styleClasses = variants[variant]?.[color] || variants.solid.primary

  return (
    <Component ref={ref} className={`${baseClasses} ${styleClasses} ${className}`} {...props}>
      {children}
    </Component>
  )
})

Badge.displayName = "Badge"

export default Badge
