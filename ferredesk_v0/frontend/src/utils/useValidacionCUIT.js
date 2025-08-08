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
   * Limpia todos los estados de ARCA
   */
  const limpiarEstadosARCA = useCallback(() => {
    setDatosARCA(null)
    setErrorARCA(null)
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
      
      // Intentar leer JSON siempre, incluso cuando !response.ok
      let data = null
      try {
        data = await response.json()
      } catch (_) {
        data = null
      }

      // Manejo según contrato de backend
      // 1) Faults SOAP / fallas técnicas → status 5xx con envelope { ok:false, type:'fault' }
      if (!response.ok) {
        const mensaje = data?.message || 'Error consultando AFIP'
        setErrorARCA(mensaje)
        setDatosARCA(null)
        return
      }

      // 2) Errores de negocio (ok:false, type:'business')
      if (data && data.ok === false) {
        const mensaje = data.message || 'ARCA no devolvió datos'
        setErrorARCA(mensaje)
        setDatosARCA(null)
        return
      }

      // 3) Compatibilidad legacy (backend pudo devolver { error: ... })
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        setErrorARCA(data.error)
        setDatosARCA(null)
        return
      }

      // 4) Caso exitoso: datos procesados para autocompletar
      if (data) {
        setDatosARCA(data)
        setErrorARCA(null)
      } else {
        setErrorARCA('Respuesta vacía de ARCA')
        setDatosARCA(null)
      }
      
    } catch (err) {
      setErrorARCA(err.message)
      setDatosARCA(null)
    } finally {
      setIsLoadingARCA(false)
    }
  }, [])

  /**
   * Valida un CUIT en el backend
   * @param {string} cuit - El CUIT a validar
   */
  const validarCUIT = useCallback(async (cuit) => {
    // Validaciones básicas
    if (!cuit || cuit.trim().length < 11) {
      setResultado(null)
      setError(null)
      // Limpiar estados de ARCA cuando el CUIT está vacío o es muy corto
      limpiarEstadosARCA()
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
      // Limpiar estados de ARCA al iniciar nueva validación
      limpiarEstadosARCA()

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
  }, [limpiarEstadosARCA, consultarARCA])

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