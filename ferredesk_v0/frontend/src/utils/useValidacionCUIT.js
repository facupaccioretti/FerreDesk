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
  
  // Estados para ARCA
  const [datosARCA, setDatosARCA] = useState(null)
  const [isLoadingARCA, setIsLoadingARCA] = useState(false)
  const [errorARCA, setErrorARCA] = useState(null)

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
          // Si el CUIT es válido, encadenar consulta a ARCA
          if (data.es_valido) {
            try {
              await consultarARCA(cuit.trim())
            } catch (_) {
              // Silenciar errores aquí; se reflejan en errorARCA
            }
          }
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
   * Consulta datos de ARCA usando el CUIT
   * @param {string} cuit - El CUIT a consultar en ARCA
   */
  const consultarARCA = useCallback(async (cuit) => {
    if (!cuit) return
    
    setIsLoadingARCA(true)
    setErrorARCA(null)
    
    try {
      const response = await fetch(
        `/api/clientes/procesar-cuit-arca/?cuit=${encodeURIComponent(cuit)}`,
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
        throw new Error('Error al consultar ARCA')
      }
      
      const data = await response.json()
      
      if (data.error) {
        setErrorARCA(data.error)
        setDatosARCA(null)
      } else {
        setDatosARCA(data)
        setErrorARCA(null)
      }
      
    } catch (err) {
      setErrorARCA(err.message)
      setDatosARCA(null)
    } finally {
      setIsLoadingARCA(false)
    }
  }, [])

  /**
   * Limpia todos los estados de ARCA
   */
  const limpiarEstadosARCA = useCallback(() => {
    setDatosARCA(null)
    setErrorARCA(null)
  }, [])

  /**
   * Limpia el resultado de la validación (usado cuando el usuario ignora la validación)
   */
  const limpiarResultado = useCallback(() => {
    setResultado(null)
    setError(null)
    setMostrarTooltip(false)
    limpiarEstadosARCA()
  }, [limpiarEstadosARCA])

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
    handleCUITKeyDown,
    // Estados y funciones de ARCA
    datosARCA,
    isLoadingARCA,
    errorARCA,
    consultarARCA,
    limpiarEstadosARCA
  }
}

export default useValidacionCUIT 