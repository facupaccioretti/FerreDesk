import { useState, useCallback, useRef } from 'react'
import { getCookie } from './csrf'

/**
 * Hook personalizado para validar CUITs usando el algoritmo de dígito verificador
 * Se activa en onBlur o al presionar Enter para evitar validaciones constantes mientras el usuario escribe
 */
const useValidacionCUIT = () => {
  const [resultado, setResultado] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mostrarTooltip, setMostrarTooltip] = useState(false)
  const timeoutRef = useRef(null)

  /**
   * Valida un CUIT en el backend
   * @param {string} cuit - El CUIT a validar
   */
  const validarCUIT = useCallback(async (cuit) => {
    // Validaciones básicas
    if (!cuit || cuit.trim().length < 11) {
      setResultado(null)
      setError(null)
      return
    }

    // Limpiar timeout anterior si existe
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Debounce de 500ms para evitar múltiples llamadas
    timeoutRef.current = setTimeout(async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/clientes/validar-cuit/?cuit=${encodeURIComponent(cuit.trim())}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': getCookie('csrftoken')
            },
            credentials: 'include',
          }
        )

        if (!response.ok) {
          throw new Error('Error al validar CUIT')
        }

        const data = await response.json()

        // Mostrar resultado si hay datos válidos
        if (data) {
          setResultado(data)
          setMostrarTooltip(false) // Inicialmente oculto
        } else {
          setResultado(null)
        }

      } catch (err) {
        setError(err.message)
        setResultado(null)
      } finally {
        setIsLoading(false)
      }
    }, 500) // Debounce de 500ms
  }, [])

  /**
   * Limpia el resultado de la validación (usado cuando el usuario ignora la validación)
   */
  const limpiarResultado = useCallback(() => {
    setResultado(null)
    setError(null)
    setMostrarTooltip(false)
  }, [])

  /**
   * Alterna la visibilidad del tooltip
   */
  const toggleTooltip = useCallback(() => {
    setMostrarTooltip(prev => !prev)
  }, [])

  /**
   * Maneja el evento onBlur del campo CUIT
   * @param {string} cuit - Valor del campo CUIT
   */
  const handleCUITBlur = useCallback((cuit) => {
    validarCUIT(cuit)
  }, [validarCUIT])

  /**
   * Maneja el evento onKeyDown del campo CUIT (para Enter)
   * @param {string} cuit - Valor del campo CUIT
   */
  const handleCUITKeyDown = useCallback((cuit) => {
    validarCUIT(cuit)
  }, [validarCUIT])

  return {
    resultado,
    isLoading,
    error,
    mostrarTooltip,
    validarCUIT,
    limpiarResultado,
    toggleTooltip,
    handleCUITBlur,
    handleCUITKeyDown
  }
}

export default useValidacionCUIT 