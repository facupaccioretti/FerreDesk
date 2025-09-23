import { useState, useCallback, useRef } from 'react'
import { getCookie } from './csrf'

/**
 * Hook personalizado para validar CUITs usando el algoritmo de dígito verificador
 * Especializado para proveedores - usa endpoints de proveedores
 * Se activa en onBlur o al presionar Enter para evitar validaciones constantes mientras el usuario escribe
 */
const useValidacionCUITProveedores = () => {
  const [resultado, setResultado] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mostrarTooltip, setMostrarTooltip] = useState(false)
  const timeoutRef = useRef(null)
  
  // Estados para ARCA
  const [datosARCA, setDatosARCA] = useState(null)
  const [isLoadingARCA, setIsLoadingARCA] = useState(false)
  const [errorARCA, setErrorARCA] = useState(null)

  // Estados para consulta de estado ARCA (modo status)
  const [estadoARCAStatus, setEstadoARCAStatus] = useState(null)
  const [mensajesARCAStatus, setMensajesARCAStatus] = useState([])
  const [isLoadingARCAStatus, setIsLoadingARCAStatus] = useState(false)
  const [errorARCAStatus, setErrorARCAStatus] = useState(null)

  /**
   * Limpia todos los estados de ARCA
   */
  const limpiarEstadosARCA = useCallback(() => {
    setDatosARCA(null)
    setErrorARCA(null)
  }, [])

  /**
   * Limpia todos los estados de ARCA Status
   */
  const limpiarEstadosARCAStatus = useCallback(() => {
    setEstadoARCAStatus(null)
    setMensajesARCAStatus([])
    setErrorARCAStatus(null)
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
        `/api/proveedores/procesar-cuit-arca/?cuit=${encodeURIComponent(cuit)}`,
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
   * Consulta estado de CUIT en ARCA (modo liviano para validación fiscal)
   * @param {string} cuit - El CUIT a consultar en ARCA
   */
  const consultarARCAStatus = useCallback(async (cuit) => {
    if (!cuit) return
    
    setIsLoadingARCAStatus(true)
    setErrorARCAStatus(null)
    
    try {
      const response = await fetch(
        `/api/proveedores/procesar-cuit-arca/?cuit=${encodeURIComponent(cuit)}&mode=status`,
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

      // Si hay error del servidor (503, etc.)
      if (!response.ok) {
        const mensaje = data?.mensajes?.[0] || data?.message || 'Error consultando AFIP'
        setErrorARCAStatus(mensaje)
        setEstadoARCAStatus('error')
        setMensajesARCAStatus([mensaje])
        return
      }

      // Procesar respuesta exitosa
      if (data) {
        setEstadoARCAStatus(data.estado || 'ok')
        setMensajesARCAStatus(data.mensajes || [])
        setErrorARCAStatus(null)
      } else {
        setErrorARCAStatus('Respuesta vacía de ARCA')
        setEstadoARCAStatus('error')
        setMensajesARCAStatus(['Respuesta vacía de ARCA'])
      }
      
    } catch (err) {
      setErrorARCAStatus(err.message)
      setEstadoARCAStatus('error')
      setMensajesARCAStatus([err.message])
    } finally {
      setIsLoadingARCAStatus(false)
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
          `/api/proveedores/validar-cuit/?cuit=${encodeURIComponent(cuit.trim())}`,
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
    limpiarEstadosARCAStatus()
  }, [limpiarEstadosARCA, limpiarEstadosARCAStatus])

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
    limpiarEstadosARCA,
    // Estados y funciones de ARCA Status
    estadoARCAStatus,
    mensajesARCAStatus,
    isLoadingARCAStatus,
    errorARCAStatus,
    consultarARCAStatus,
    limpiarEstadosARCAStatus
  }
}

export default useValidacionCUITProveedores
