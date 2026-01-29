"use client"

import { useState, useEffect, useRef } from "react"
import ItemsGridCompras from "./ItemsGridCompras"
import BuscadorProductoCompras from "./BuscadorProductoCompras"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import useNavegacionForm from "../../hooks/useNavegacionForm"

const OrdenCompraForm = ({
  onSave,
  onCancel,
  initialData,
  readOnly = false,
  proveedores = [],
  productos = [],
  sucursales = [],
  loadingProveedores,
  loadingProductos,
  errorProveedores,
  errorProductos,
}) => {
  const [formData, setFormData] = useState(() => {
    // Estado inicial del formulario
    const initialState = {
      ord_sucursal: sucursales[0]?.id || 1,
      ord_fecha: new Date().toISOString().split("T")[0],
      ord_idpro: "",
      ord_cuit: "",
      ord_razon_social: "",
      ord_domicilio: "",
      ord_observacion: "",
      items_data: [],
    }

    // Si hay datos iniciales (edición), cargarlos inmediatamente
    if (initialData) {
      initialState.ord_sucursal = initialData.ord_sucursal || sucursales[0]?.id || 1
      initialState.ord_fecha = initialData.ord_fecha || new Date().toISOString().split("T")[0]
      initialState.ord_idpro = initialData.ord_idpro !== undefined && initialData.ord_idpro !== null ? initialData.ord_idpro : initialData.proveedorSeleccionado?.id || null
      initialState.ord_cuit = initialData.ord_cuit || ""
      initialState.ord_razon_social = initialData.ord_razon_social || initialData.proveedorSeleccionado?.razon || ""
      initialState.ord_domicilio = initialData.ord_domicilio || ""
      initialState.ord_observacion = initialData.ord_observacion || ""
      initialState.items_data = initialData.items || []
    }

    return initialState
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const itemsGridRef = useRef(null)

  // Hook para el tema de FerreDesk
  const theme = useFerreDeskTheme()

  // Hook para navegación entre campos con Enter
  const { getFormProps } = useNavegacionForm()
  
  const [selectedProveedor, setSelectedProveedor] = useState(null)

  useEffect(() => {
    
    
    if (initialData) {
      if (initialData.proveedorSeleccionado) {
        // Caso NUEVA ORDEN: proveedor seleccionado del modal
        const proveedor = initialData.proveedorSeleccionado
        setSelectedProveedor(proveedor)
        // Establecer también formData.ord_idpro para que pase la validación
        setFormData(prev => ({
          ...prev,
          ord_idpro: proveedor.id,
          ord_cuit: proveedor.cuit || "",
          ord_razon_social: proveedor.razon|| "",
          ord_domicilio: proveedor.domicilio || "",
        }))
      } else if (initialData.ord_idpro) {
        // Caso EDICIÓN: usar datos directamente de la base de datos
        const proveedorFromDB = {
          id: initialData.ord_idpro,
          razon: initialData.ord_razon_social,
          cuit: initialData.ord_cuit,
          domicilio: initialData.ord_domicilio
        }
        setSelectedProveedor(proveedorFromDB)
      }
    }
  }, [initialData, formData.ord_idpro])

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Limpiar error del campo
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }


  const handleAddItemFromBuscador = (producto) => {
    if (!selectedProveedor?.id) {
      console.error("No hay proveedor seleccionado")
      return
    }

    // Crear un nuevo item con el producto seleccionado para orden de compra
    const nuevoItem = {
      id: Date.now() + Math.random(),
      codigo_venta: producto.codvta || "",
      producto: producto,
      odi_idsto: producto.id,
      odi_idpro: selectedProveedor.id,
      odi_detalle1: producto.deno || producto.nombre || "",
      odi_detalle2: producto.unidad || producto.unidadmedida || "-",
      odi_cantidad: 1,
      odi_stock_proveedor: producto.stockprove_id || null,
      unidad: producto.unidad || producto.unidadmedida || "-",
    }

    // Agregar el item directamente al grid usando el método imperativo
    if (itemsGridRef.current && itemsGridRef.current.addItem) {
      itemsGridRef.current.addItem(nuevoItem)
    }
  }

  const handleItemsChange = (newItems) => {
    setFormData((prev) => ({ ...prev, items_data: newItems }))
    // Limpiar error de items
    if (errors.items) {
      setErrors((prev) => ({ ...prev, items: null }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.ord_fecha) {
      newErrors.ord_fecha = "La fecha es requerida"
    }



    if (!formData.items_data || formData.items_data.length === 0) {
      newErrors.items = "Debe agregar al menos un producto"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Confirmación nativa antes de guardar
    const confirmar = window.confirm('¿Desea guardar la orden de compra?')
    if (!confirmar) {
      return
    }
    
    if (!validateForm()) {
      return
    }

    // Asegurar que ord_idpro no sea null antes de enviar
    if (!formData.ord_idpro) {
      setErrors({ ord_idpro: "El proveedor es requerido" })
      return
    }

    

    setIsSubmitting(true)
    setErrors({})

    try {
      // Filtrar campos calculados que no deben enviarse al backend
      const payload = {
        ...formData,
        items_data: formData.items_data.map(item => {
          // Crear un nuevo objeto solo con los campos que el backend espera
          const cleanItem = {
            odi_orden: item.odi_orden,
            odi_idsto: item.odi_idsto,
            odi_idpro: item.odi_idpro,
            odi_cantidad: item.odi_cantidad,
            odi_detalle1: item.odi_detalle1,
            odi_detalle2: item.odi_detalle2,
            odi_stock_proveedor: item.odi_stock_proveedor
          }
          
          // Incluir el ID si existe (para actualización inteligente)
          if (item.id) {
            cleanItem.id = item.id
          }
          
          return cleanItem
        })
      }
      
      await onSave(payload)
    } catch (error) {
      console.error("Error al guardar orden de compra:", error)
      setErrors({ submit: error.message || "Error al guardar la orden de compra" })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Bloquear submit por Enter en cualquier input del formulario
  const bloquearEnterSubmit = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
    }
  }

  return (
    <div className="px-6 pt-4 pb-6">
      <form className="venta-form w-full max-w-[1000px] mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200/50 relative overflow-hidden" onSubmit={handleSubmit} onKeyDown={bloquearEnterSubmit} {...getFormProps()}>
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.primario}`} />

        {/* width constraint */}
        <div className="px-8 pt-6 pb-6">
          <div className="max-w-[1100px] mx-auto">
                         <div className="mb-4">
               <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                 <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${theme.primario} flex items-center justify-center shadow-md`}>
                   <svg
                     xmlns="http://www.w3.org/2000/svg"
                     fill="none"
                     viewBox="0 0 24 24"
                     strokeWidth={1.5}
                     stroke="currentColor"
                     className="w-3.5 h-3.5 text-white"
                   >
                     <path
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                     />
                   </svg>
                 </div>
                 {initialData?.ord_id ? (readOnly ? "Ver Orden de Compra" : "Editar Orden de Compra") : "Nueva Orden de Compra"}
               </h3>
               {initialData?.ord_id && (
                 <div className="flex gap-4 items-center">
                   <p className="text-slate-600 text-sm">Orden #{initialData.ord_id}</p>
                   {initialData.ord_numero && (
                     <p className="text-slate-600 text-sm">Número: {initialData.ord_numero}</p>
                   )}
                 </div>
               )}
             </div>

            {/* Una sola tarjeta con campos organizados en grid */}
            <div className="mb-6">
              <div className="p-2 bg-slate-50 rounded-sm border border-slate-200">
                
                                 {/* Primera fila: 4 campos con tamaños personalizados */}
                 <div className="grid gap-4 mb-3" style={{ gridTemplateColumns: '2fr 1fr 1.5fr 1fr' }}>
                   {/* Proveedor */}
                   <div>
                     <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                       Proveedor *
                       {initialData?.proveedorSeleccionado && (
                         <span className="ml-1 text-xs text-green-600 font-normal">(Seleccionado)</span>
                       )}
                     </label>
                     {loadingProveedores ? (
                       <div className="flex items-center gap-2 text-slate-500 bg-slate-100 rounded-none px-2 py-1 text-xs h-8">
                         <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-600"></div>
                         Cargando...
                       </div>
                     ) : errorProveedores ? (
                       <div className="text-red-600 bg-red-50 rounded-none px-2 py-1 text-xs border border-red-200 h-8">
                         {errorProveedores}
                       </div>
                                           ) : (
                        // Campo de texto de solo lectura - el proveedor siempre se elige antes
                        <input
                          type="text"
                          value={formData.ord_razon_social || "Proveedor no seleccionado"}
                          readOnly
                          className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 bg-slate-50 text-slate-700 cursor-not-allowed"
                          placeholder="Proveedor seleccionado"
                        />
                      )}
                     {errors.ord_idpro && <p className="mt-1 text-xs text-red-600">{errors.ord_idpro}</p>}
                   </div>

                   {/* CUIT */}
                   <div>
                     <label className="block text-[12px] font-semibold text-slate-700 mb-1">CUIT</label>
                     <input
                       name="ord_cuit"
                       type="text"
                       value={formData.ord_cuit}
                       className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 bg-slate-50 text-slate-700 cursor-not-allowed"
                       readOnly
                       placeholder="CUIT del proveedor"
                     />
                   </div>

                   {/* Domicilio */}
                   <div>
                     <label className="block text-[12px] font-semibold text-slate-700 mb-1">Domicilio</label>
                     <input
                       name="ord_domicilio"
                       type="text"
                       value={formData.ord_domicilio}
                       className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 bg-slate-50 text-slate-700 cursor-not-allowed"
                       readOnly
ja de                        placeholder="Domicilio del proveedor"
                     />
                   </div>

                   {/* Fecha */}
                   <div>
                     <label className="block text-[12px] font-semibold text-slate-700 mb-1">Fecha *</label>
                     <input
                       name="ord_fecha"
                       type="date"
                       value={formData.ord_fecha}
                       onChange={(e) => handleInputChange("ord_fecha", e.target.value)}
                       className={`w-full border rounded-none px-2 py-1 text-xs h-8 bg-white focus:ring-2 ${theme.secundario} focus:border-orange-500 ${
                         errors.ord_fecha ? "border-red-500" : "border-slate-300"
                       }`}
                       required
                       readOnly={readOnly}
                     />
                     {errors.ord_fecha && <p className="mt-1 text-xs text-red-600">{errors.ord_fecha}</p>}
                   </div>
                 </div>

              </div>
            </div>

            {/* Buscador de productos */}
            {selectedProveedor && (
              <div className="mb-4">
                <div className="p-2 bg-slate-50 rounded-sm border border-slate-200">
                  <div className="grid gap-4 mb-3">
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-700 mb-1">Buscador de Productos del Proveedor</label>
                                             <BuscadorProductoCompras
                         selectedProveedor={selectedProveedor}
                         onSelect={handleAddItemFromBuscador}
                         disabled={readOnly}
                         readOnly={readOnly}
                         className="w-full"
                         modoOrdenCompra={true}
                       />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Grid de items */}
            <div className="mb-4">
                             <ItemsGridCompras
                 ref={itemsGridRef}
                 items={formData.items_data}
                 initialItems={formData.items_data}
                 onItemsChange={handleItemsChange}
                 readOnly={readOnly}
                 productos={productos}
                 proveedores={proveedores}
                 selectedProveedor={selectedProveedor}
                 showPrecios={false}
                 showIVA={false}
                 modoOrdenCompra={true}
                 mostrarModoLector={true}
               />
              {errors.items && <p className="mt-2 text-sm text-red-600">{errors.items}</p>}
            </div>

            {/* Observaciones */}
            <div className="mt-2">
              <textarea
                value={formData.ord_observacion}
                onChange={(e) => handleInputChange("ord_observacion", e.target.value)}
                disabled={readOnly}
                rows={3}
                placeholder="Observaciones adicionales..."
                className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 ${theme.secundario} disabled:bg-slate-100`}
              />
            </div>

            {/* Acciones */}
            <div className="mt-3 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  const confirmar = window.confirm('¿Desea cancelar y descartar los cambios?')
                  if (!confirmar) return
                  onCancel()
                }}
                className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all duration-200 font-medium shadow-sm"
              >
                Cancelar
              </button>
              {!readOnly && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-6 py-3 ${theme.botonPrimario} rounded-xl`}
                >
                  {isSubmitting ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Orden de Compra"}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default OrdenCompraForm
