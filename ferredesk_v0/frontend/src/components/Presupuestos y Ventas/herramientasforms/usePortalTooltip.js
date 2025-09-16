import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

/**
 * Hook personalizado para manejar tooltips con portales y auto-placement inteligente
 * Resuelve el problema de tooltips cortados por contenedores con overflow
 * 
 * Características:
 * - Renderiza el tooltip en un portal (document.body) para evitar cortes por overflow
 * - Mantiene el tooltip anclado al elemento trigger durante scroll de página
 * - Auto-placement inteligente: detecta espacio disponible y ajusta posición automáticamente
 * - Recalcula posición automáticamente en scroll, resize y cuando se vuelve visible
 * - Ideal para menús contextuales que deben seguir a su elemento trigger
 * 
 * Lógica de auto-placement:
 * - Intenta posicionar en la dirección preferida (placement)
 * - Si no hay espacio, busca alternativas en orden de prioridad
 * - bottom → top, right, left
 * - top → bottom, right, left  
 * - right → left, bottom, top
 * - left → right, bottom, top
 * 
 * @param {Object} options - Opciones de configuración
 * @param {string} options.placement - Posición preferida del tooltip ('bottom', 'right', 'left', 'top')
 * @param {number} options.offset - Offset en píxeles desde el elemento trigger
 * @returns {Object} - Objeto con props y utilidades para el tooltip
 */
const usePortalTooltip = ({ 
  placement = 'right', 
  offset = 8 
} = {}) => {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const tooltipRef = useRef(null)

  // Función para calcular la posición del tooltip con auto-placement inteligente
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    // Usar dimensiones reales si están disponibles, sino estimadas
    const tooltipSize = tooltipRef.current ? {
      width: tooltipRef.current.getBoundingClientRect().width,
      height: tooltipRef.current.getBoundingClientRect().height
    } : {
      width: 200, // Ancho estimado
      height: 150 // Alto estimado
    }

    // Función para verificar si hay espacio en una dirección específica
    const hasSpace = (direction) => {
      switch (direction) {
        case 'bottom':
          return triggerRect.bottom + tooltipSize.height + offset < viewport.height
        case 'top':
          return triggerRect.top - tooltipSize.height - offset > 0
        case 'right':
          return triggerRect.right + tooltipSize.width + offset < viewport.width
        case 'left':
          return triggerRect.left - tooltipSize.width - offset > 0
        default:
          return true
      }
    }

    // Función para calcular posición en una dirección específica
    const getPositionForDirection = (direction) => {
      switch (direction) {
        case 'right':
          return {
            top: triggerRect.top + triggerRect.height / 2,
            left: triggerRect.right + offset,
            transform: 'translateY(-50%)'
          }
        case 'left':
          return {
            top: triggerRect.top + triggerRect.height / 2,
            left: triggerRect.left - offset,
            transform: 'translateY(-50%) translateX(-100%)'
          }
        case 'bottom':
          return {
            top: triggerRect.bottom + offset,
            left: triggerRect.left + triggerRect.width / 2,
            transform: 'translateX(-50%)'
          }
        case 'top':
          return {
            top: triggerRect.top - offset,
            left: triggerRect.left + triggerRect.width / 2,
            transform: 'translateX(-50%) translateY(-100%)'
          }
        default:
          return {
            top: triggerRect.top,
            left: triggerRect.right + offset,
            transform: 'translateY(-50%)'
          }
      }
    }

    // Determinar la mejor dirección
    let bestDirection = placement
    
    // Si la dirección preferida no tiene espacio, buscar alternativas
    if (!hasSpace(placement)) {
      const alternatives = {
        'bottom': ['top', 'right', 'left'],
        'top': ['bottom', 'right', 'left'],
        'right': ['left', 'bottom', 'top'],
        'left': ['right', 'bottom', 'top']
      }
      
      const directionAlternatives = alternatives[placement] || ['bottom', 'top', 'right', 'left']
      
      for (const alt of directionAlternatives) {
        if (hasSpace(alt)) {
          bestDirection = alt
          break
        }
      }
    }

    const position = getPositionForDirection(bestDirection)
    setPosition(position)
  }, [placement, offset])

  // Función para mostrar el tooltip
  const show = useCallback(() => {
    calculatePosition()
    setVisible(true)
  }, [calculatePosition])

  // Función para ocultar el tooltip
  const hide = useCallback(() => {
    setVisible(false)
  }, [])

  // Función para alternar visibilidad
  const toggle = useCallback((e) => {
    e?.stopPropagation()
    if (visible) {
      hide()
    } else {
      show()
    }
  }, [visible, show, hide])

  // Manejar click fuera del tooltip
  const handleClickOutside = useCallback((event) => {
    if (
      tooltipRef.current &&
      !tooltipRef.current.contains(event.target) &&
      triggerRef.current &&
      !triggerRef.current.contains(event.target)
    ) {
      hide()
    }
  }, [hide])

  // Recalcular posición en scroll/resize (solo scroll de página, no scroll interno)
  const handlePositionUpdate = useCallback((event) => {
    if (visible) {
      // Solo recalcular si el scroll es del window o document, no de elementos internos
      if (event.target === window || event.target === document || event.target === document.documentElement) {
        calculatePosition()
      }
    }
  }, [visible, calculatePosition])

  // Efecto para recalcular posición cuando el tooltip se vuelve visible
  useEffect(() => {
    if (visible) {
      // Recalcular inmediatamente cuando se vuelve visible
      calculatePosition()
      
      // Recalcular con dimensiones reales después del primer render
      const timeoutId = setTimeout(() => {
        if (tooltipRef.current) {
          calculatePosition()
        }
      }, 0)
      
      return () => clearTimeout(timeoutId)
    }
  }, [visible, calculatePosition])

  // Efectos para manejar eventos
  useEffect(() => {
    if (visible) {
      document.addEventListener('mousedown', handleClickOutside)
      // Solo escuchar scroll del window para evitar interferir con scroll interno
      window.addEventListener('scroll', handlePositionUpdate)
      window.addEventListener('resize', handlePositionUpdate)
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        window.removeEventListener('scroll', handlePositionUpdate)
        window.removeEventListener('resize', handlePositionUpdate)
      }
    }
  }, [visible, handleClickOutside, handlePositionUpdate])

  // Componente que renderiza el tooltip en un portal
  const TooltipPortal = ({ children, className = '', role = 'tooltip', ...props }) => {
    if (!visible) return null

    const tooltipElement = (
      <div
        ref={tooltipRef}
        className={`fixed z-[9999] ${className}`}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform: position.transform || 'translateY(-50%)'
        }}
        role={role}
        {...props}
      >
        {children}
      </div>
    )

    return createPortal(tooltipElement, document.body)
  }

  return {
    visible,
    show,
    hide,
    toggle,
    triggerRef,
    TooltipPortal,
    // Props para el elemento trigger
    triggerProps: {
      ref: triggerRef,
      onClick: toggle,
      'aria-expanded': visible,
      'aria-haspopup': true
    }
  }
}

export default usePortalTooltip
