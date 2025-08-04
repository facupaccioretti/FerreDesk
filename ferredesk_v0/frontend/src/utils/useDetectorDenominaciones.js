import { useState, useCallback, useRef } from 'react'

/**
 * Hook personalizado para detectar denominaciones similares de productos
 * Se activa en onBlur para evitar búsquedas constantes mientras el usuario escribe
 */
const useDetectorDenominaciones = () => {
  const [sugerencias, setSugerencias] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mostrarTooltip, setMostrarTooltip] = useState(false)
  const timeoutRef = useRef(null)

  /**
   * Busca denominaciones similares en el backend
   * @param {string} denominacion - La denominación a buscar
   */
  const buscarSimilares = useCallback(async (denominacion) => {
    // Validaciones básicas
    if (!denominacion || denominacion.trim().length < 3) {
      setSugerencias(null)
      setError(null)
      return
    }

    // Limpiar timeout anterior si existe
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Debounce de 300ms para evitar múltiples llamadas
    timeoutRef.current = setTimeout(async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/productos/buscar-denominaciones-similares/?denominacion=${encodeURIComponent(denominacion.trim())}`,
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
          throw new Error('Error al buscar denominaciones similares')
        }

        const data = await response.json()

        // Solo mostrar sugerencias si hay similitud significativa (>= 60%)
        if (data.productos_similares && data.productos_similares.length > 0) {
          setSugerencias(data)
          setMostrarTooltip(false) // Inicialmente oculto
        } else {
          setSugerencias(null)
        }

      } catch (err) {
        setError(err.message)
        setSugerencias(null)
      } finally {
        setIsLoading(false)
      }
    }, 500) // Debounce de 500ms
  }, [])

  /**
   * Limpia las sugerencias (usado cuando el usuario ignora la advertencia)
   */
  const limpiarSugerencias = useCallback(() => {
    setSugerencias(null)
    setError(null)
    setMostrarTooltip(false)
  }, [])

  const toggleTooltip = useCallback(() => {
    setMostrarTooltip(prev => !prev)
  }, [])

  /**
   * Maneja el evento onBlur del campo denominación
   * @param {string} denominacion - Valor del campo denominación
   */
  const handleDenominacionBlur = useCallback((denominacion) => {
    buscarSimilares(denominacion)
  }, [buscarSimilares])

  return {
    sugerencias,
    isLoading,
    error,
    mostrarTooltip,
    buscarSimilares,
    limpiarSugerencias,
    toggleTooltip,
    handleDenominacionBlur
  }
}

// Función auxiliar para obtener el token CSRF
function getCookie(name) {
  let cookieValue = null
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';')
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim()
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1))
        break
      }
    }
  }
  return cookieValue
}

export default useDetectorDenominaciones 