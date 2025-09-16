import { useCallback, useRef } from 'react'

/**
 * Hook personalizado para manejar navegación entre campos de formulario con Enter
 * Previene el submit automático del formulario al presionar Enter
 * y navega automáticamente al siguiente campo
 */
const useNavegacionForm = () => {
  const formRef = useRef(null)

  const manejarEnter = useCallback((e) => {
    // Solo procesar si se presiona Enter
    if (e.key !== 'Enter') return

    // Prevenir el submit del formulario
    e.preventDefault()

    // Si no hay referencia al formulario, no hacer nada
    if (!formRef.current) return

    // Obtener todos los inputs, selects y textareas que no sean botones
    const inputs = Array.from(
      formRef.current.querySelectorAll(
        'input:not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'
      )
    )

    // Encontrar el índice del elemento actual
    const indiceActual = inputs.indexOf(e.target)

    // Si hay un siguiente elemento, mover el foco
    if (indiceActual !== -1 && indiceActual < inputs.length - 1) {
      const siguienteInput = inputs[indiceActual + 1]
      siguienteInput.focus()
      
      // Si es un input de texto, seleccionar todo el contenido para facilitar la edición
      if (siguienteInput.type === 'text' || siguienteInput.type === 'number') {
        siguienteInput.select()
      }
    }
  }, [])

  // Función para obtener las props que se deben aplicar al form
  const getFormProps = useCallback(() => ({
    ref: formRef,
    onKeyDown: manejarEnter
  }), [manejarEnter])

  return {
    formRef,
    manejarEnter,
    getFormProps
  }
}

export default useNavegacionForm
