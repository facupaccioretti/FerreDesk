import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

const VIEWPORT_PADDING = 8
const ESTIMATED_TOOLTIP_SIZE = {
  width: 200,
  height: 150
}

/**
 * Hook para renderizar menus/tooltips en portal y mantenerlos flotando anclados al trigger.
 * Conserva la API existente y mejora el seguimiento sobre scroll interno y bordes del viewport.
 */
const usePortalTooltip = ({
  placement = 'right',
  offset = 8
} = {}) => {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, transform: 'none' })
  const triggerRef = useRef(null)
  const tooltipRef = useRef(null)
  const rafRef = useRef(null)

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    const tooltipSize = tooltipRef.current
      ? {
          width: tooltipRef.current.getBoundingClientRect().width,
          height: tooltipRef.current.getBoundingClientRect().height
        }
      : ESTIMATED_TOOLTIP_SIZE

    const hasSpace = (direction) => {
      switch (direction) {
        case 'bottom':
          return triggerRect.bottom + tooltipSize.height + offset + VIEWPORT_PADDING <= viewport.height
        case 'top':
          return triggerRect.top - tooltipSize.height - offset - VIEWPORT_PADDING >= 0
        case 'right':
          return triggerRect.right + tooltipSize.width + offset + VIEWPORT_PADDING <= viewport.width
        case 'left':
          return triggerRect.left - tooltipSize.width - offset - VIEWPORT_PADDING >= 0
        default:
          return true
      }
    }

    const alternatives = {
      bottom: ['top', 'right', 'left'],
      top: ['bottom', 'right', 'left'],
      right: ['left', 'bottom', 'top'],
      left: ['right', 'bottom', 'top']
    }

    let bestDirection = placement

    if (!hasSpace(placement)) {
      const directionAlternatives = alternatives[placement] || ['bottom', 'top', 'right', 'left']
      const fallback = directionAlternatives.find((direction) => hasSpace(direction))
      if (fallback) {
        bestDirection = fallback
      }
    }

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
    const maxLeft = Math.max(VIEWPORT_PADDING, viewport.width - tooltipSize.width - VIEWPORT_PADDING)
    const maxTop = Math.max(VIEWPORT_PADDING, viewport.height - tooltipSize.height - VIEWPORT_PADDING)

    let top = triggerRect.top
    let left = triggerRect.left

    switch (bestDirection) {
      case 'bottom':
        top = clamp(triggerRect.bottom + offset, VIEWPORT_PADDING, maxTop)
        left = clamp(
          triggerRect.left + triggerRect.width / 2 - tooltipSize.width / 2,
          VIEWPORT_PADDING,
          maxLeft
        )
        break
      case 'top':
        top = clamp(triggerRect.top - tooltipSize.height - offset, VIEWPORT_PADDING, maxTop)
        left = clamp(
          triggerRect.left + triggerRect.width / 2 - tooltipSize.width / 2,
          VIEWPORT_PADDING,
          maxLeft
        )
        break
      case 'left':
        top = clamp(
          triggerRect.top + triggerRect.height / 2 - tooltipSize.height / 2,
          VIEWPORT_PADDING,
          maxTop
        )
        left = clamp(triggerRect.left - tooltipSize.width - offset, VIEWPORT_PADDING, maxLeft)
        break
      case 'right':
      default:
        top = clamp(
          triggerRect.top + triggerRect.height / 2 - tooltipSize.height / 2,
          VIEWPORT_PADDING,
          maxTop
        )
        left = clamp(triggerRect.right + offset, VIEWPORT_PADDING, maxLeft)
        break
    }

    setPosition({
      top,
      left,
      transform: 'none'
    })
  }, [offset, placement])

  const show = useCallback(() => {
    calculatePosition()
    setVisible(true)
  }, [calculatePosition])

  const hide = useCallback(() => {
    setVisible(false)
  }, [])

  const toggle = useCallback((e) => {
    e?.stopPropagation()
    if (visible) {
      hide()
      return
    }
    show()
  }, [visible, show, hide])

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

  const handlePositionUpdate = useCallback(() => {
    if (!visible) return

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null

      if (!triggerRef.current || !triggerRef.current.isConnected) {
        setVisible(false)
        return
      }

      calculatePosition()
    })
  }, [visible, calculatePosition])

  useEffect(() => {
    if (!visible) return undefined

    calculatePosition()

    const timeoutId = window.setTimeout(() => {
      if (tooltipRef.current) {
        calculatePosition()
      }
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [visible, calculatePosition])

  useEffect(() => {
    if (!visible) return undefined

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handlePositionUpdate, true)
    window.addEventListener('resize', handlePositionUpdate)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handlePositionUpdate, true)
      window.removeEventListener('resize', handlePositionUpdate)
    }
  }, [visible, handleClickOutside, handlePositionUpdate])

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const TooltipPortal = ({ children, className = '', role = 'tooltip', ...props }) => {
    if (!visible) return null

    return createPortal(
      <div
        ref={tooltipRef}
        className={`fixed z-[9999] ${className}`}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform: position.transform || 'none'
        }}
        role={role}
        {...props}
      >
        {children}
      </div>,
      document.body
    )
  }

  return {
    visible,
    show,
    hide,
    toggle,
    triggerRef,
    TooltipPortal,
    triggerProps: {
      ref: triggerRef,
      onClick: toggle,
      'aria-expanded': visible,
      'aria-haspopup': true
    }
  }
}

export default usePortalTooltip
