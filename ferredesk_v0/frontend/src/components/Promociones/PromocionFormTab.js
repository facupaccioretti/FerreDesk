// PromocionFormTab.js — Wrapper que conecta PromocionForm con la API y el
// sistema de subtabs de ProductosManager.
//
// POR QUÉ UN COMPONENTE SEPARADO: ProductosManager no conoce la API de
// promociones; al delegar el hook aquí, el Manager solo recibe callbacks
// onGuardado / onCancelar, igual que hace con StockForm para productos.

import { toast } from 'react-toastify'
import PromocionForm from './PromocionForm'
import { usePromocionesAPI } from './hooks/usePromocionesAPI'

/**
 * @param {Object}   props
 * @param {Object|null} props.promocion  - null → alta; objeto completo → edición
 * @param {Function} props.onGuardado    - se llama tras guardar con éxito
 * @param {Function} props.onCancelar   - se llama al cancelar
 */
function PromocionFormTab({ promocion, onGuardado, onCancelar }) {
  const esEdicion = !!promocion?.id

  // El estado del listado se invalida automáticamente por onSuccess en el hook.
  const { crearPromocion, creando, editarPromocion, editando } = usePromocionesAPI()

  const handleGuardar = async (payload) => {
    try {
      if (esEdicion) {
        await editarPromocion(promocion.id, payload)
        toast.success(`Promoción "${payload.nombre}" actualizada correctamente.`)
      } else {
        await crearPromocion(payload)
        toast.success(`Promoción "${payload.nombre}" creada correctamente.`)
      }
      onGuardado()
    } catch (error) {
      toast.error(error?.message || (esEdicion ? "No se pudo actualizar la promoción." : "No se pudo crear la promoción."))
      // Re-lanzamos para que PromocionForm lo capture y lo muestre
      // con su propio mensaje de error inline.
      throw error
    }
  }

  return (
    <PromocionForm
      promocion={promocion}
      onGuardar={handleGuardar}
      onCancelar={onCancelar}
      guardando={creando || editando}
    />
  )
}

export default PromocionFormTab
