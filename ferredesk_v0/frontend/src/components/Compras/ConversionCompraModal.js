"use client"

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useFerreDeskTheme } from '../../hooks/useFerreDeskTheme'

const ConversionCompraModal = ({
  isOpen,
  onClose,
  ordenCompra,
  onConvertir,
  loading = false,
}) => {
  const theme = useFerreDeskTheme()
  const [selectedItems, setSelectedItems] = useState([])
  const [cantidadesRecibidas, setCantidadesRecibidas] = useState({})

  // Resetear selección cuando cambia la orden
  useEffect(() => {
    if (ordenCompra && ordenCompra.items) {
      setSelectedItems([])
      setCantidadesRecibidas({})
    }
  }, [ordenCompra])

  // Manejar selección individual de items
  const handleItemSelect = (itemId, checked) => {
    if (checked) {
      setSelectedItems(prev => [...prev, itemId])
      // Inicializar cantidad recibida con la cantidad solicitada
      const item = ordenCompra.items.find(i => i.id === itemId)
      if (item) {
        setCantidadesRecibidas(prev => ({
          ...prev,
          [itemId]: item.odi_cantidad
        }))
        
        // Auto-enfocar el input de cantidad después de un breve delay para que se renderice
        setTimeout(() => {
          const cantidadInput = document.querySelector(`input[data-item-id="${itemId}"]`)
          if (cantidadInput) {
            cantidadInput.focus()
            cantidadInput.select() // Seleccionar todo el texto para que se pueda sobrescribir directamente
          }
        }, 100)
      }
    } else {
      setSelectedItems(prev => prev.filter(id => id !== itemId))
      // Limpiar cantidad recibida
      setCantidadesRecibidas(prev => {
        const newCantidades = { ...prev }
        delete newCantidades[itemId]
        return newCantidades
      })
    }
  }

  // Manejar click en la fila
  const handleRowClick = (itemId) => {
    const isSelected = selectedItems.includes(itemId)
    handleItemSelect(itemId, !isSelected)
  }

  // Selección total
  const todosSeleccionados = ordenCompra?.items && selectedItems.length === ordenCompra.items.length
  const toggleSeleccionarTodos = () => {
    if (todosSeleccionados) {
      setSelectedItems([])
      setCantidadesRecibidas({})
    } else {
      const todosLosIds = ordenCompra.items.map(item => item.id)
      setSelectedItems(todosLosIds)
      // Inicializar cantidades con las cantidades solicitadas
      const cantidadesIniciales = {}
      ordenCompra.items.forEach(item => {
        cantidadesIniciales[item.id] = item.odi_cantidad
      })
      setCantidadesRecibidas(cantidadesIniciales)
    }
  }

  // Manejar cambio de cantidad recibida
  const handleCantidadChange = (itemId, cantidad) => {
    setCantidadesRecibidas(prev => ({
      ...prev,
      [itemId]: parseFloat(cantidad) || 0
    }))
  }



  const handleConvertir = () => {
    if (selectedItems.length === 0) {
      alert('Debe seleccionar al menos un item para convertir')
      return
    }

    // Validar que todas las cantidades recibidas sean válidas
    const itemsConCantidades = selectedItems.map(itemId => {
      const cantidad = cantidadesRecibidas[itemId]
      if (!cantidad || cantidad <= 0) {
        const item = ordenCompra.items.find(i => i.id === itemId)
        alert(`La cantidad recibida para "${item?.producto_denominacion || item?.odi_detalle1}" debe ser mayor a 0`)
        return null
      }
      return {
        id: itemId,
        cantidad_recibida: cantidad
      }
    }).filter(Boolean)

    if (itemsConCantidades.length !== selectedItems.length) {
      return // Hay errores de validación
    }

    onConvertir({
      orden_origen: ordenCompra.ord_id,
      items_seleccionados: itemsConCantidades,
    })
  }

  const formatDate = (dateString) => {
    if (!dateString) return "-"
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: es })
    } catch {
      return dateString
    }
  }

  if (!isOpen || !ordenCompra) return null

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/20" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-3">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-2xl transition-all border border-slate-200/50">
                {/* Header compacto */}
                <div className={`px-5 py-4 border-b border-slate-200/80 bg-gradient-to-r ${theme.primario}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                          />
                        </svg>
                      </div>
                      <Dialog.Title as="h2" className="text-xl font-bold text-white">
                        Convertir Orden de Compra a Compra
                      </Dialog.Title>
                    </div>
                    <button
                      onClick={onClose}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/50 transition-all duration-200"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Información compacta */}
                <div className="px-5 py-3 bg-gradient-to-r from-slate-50/50 to-slate-100/30">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-white/80 px-3 py-2 rounded-lg border border-slate-200/50">
                      <span className="block text-xs font-medium text-slate-500 mb-0.5">Número</span>
                      <span className="block text-sm font-semibold text-slate-800 truncate" title={ordenCompra.ord_numero}>
                        {ordenCompra.ord_numero}
                      </span>
                    </div>
                    <div className="bg-white/80 px-3 py-2 rounded-lg border border-slate-200/50">
                      <span className="block text-xs font-medium text-slate-500 mb-0.5">Fecha</span>
                      <span className="block text-sm font-semibold text-slate-800">{formatDate(ordenCompra.ord_fecha)}</span>
                    </div>
                    <div className="bg-white/80 px-3 py-2 rounded-lg border border-slate-200/50">
                      <span className="block text-xs font-medium text-slate-500 mb-0.5">Proveedor</span>
                      <span className="block text-sm font-semibold text-slate-800 truncate" title={ordenCompra.proveedor_nombre || ordenCompra.ord_razon_social}>
                        {ordenCompra.proveedor_nombre || ordenCompra.ord_razon_social}
                      </span>
                    </div>
                    <div className="bg-white/80 px-3 py-2 rounded-lg border border-slate-200/50">
                      <span className="block text-xs font-medium text-slate-500 mb-0.5">Items</span>
                      <span className="block text-sm font-semibold text-slate-800">{ordenCompra.items?.length || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Tabla de items compacta */}
                <div className="px-5 py-4">
                                     <div className="flex items-center justify-between mb-3">
                     <h3 className="text-base font-semibold text-slate-800">Seleccionar Items para Convertir</h3>
                     <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                       {selectedItems.length} de {ordenCompra.items?.length || 0} seleccionados
                     </span>
                   </div>

                  <div className="rounded-xl border border-slate-200/80 shadow-sm overflow-hidden max-h-80 overflow-y-auto">
                    <table className="min-w-full">
                                             <thead className={`bg-gradient-to-r ${theme.primario} sticky top-0`}>
                         <tr>
                           <th className="px-4 py-2">
                             <span
                               role="checkbox"
                               aria-checked={todosSeleccionados}
                               tabIndex={0}
                               onClick={toggleSeleccionarTodos}
                               onKeyDown={(e) => {
                                 if (e.key === "Enter" || e.key === " ") toggleSeleccionarTodos()
                               }}
                               className={`inline-flex items-center justify-center w-4 h-4 rounded border transition-all duration-200 cursor-pointer ${todosSeleccionados ? "bg-orange-600 border-orange-600 shadow-sm" : "bg-white border-slate-300 hover:border-orange-400"}`}
                             >
                               {todosSeleccionados && (
                                 <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                   <path d="M3.5 7.5L6 10L10.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                 </svg>
                               )}
                             </span>
                           </th>
                           <th className="px-4 py-2 text-left">
                             <span className="text-xs font-medium text-white uppercase tracking-wider">Código</span>
                           </th>
                           <th className="px-4 py-2 text-left">
                             <span className="text-xs font-medium text-white uppercase tracking-wider">Producto</span>
                           </th>
                           <th className="px-4 py-2 text-left">
                             <span className="text-xs font-medium text-white uppercase tracking-wider">Solicitada</span>
                           </th>
                           <th className="px-4 py-2 text-left">
                             <span className="text-xs font-medium text-white uppercase tracking-wider">Recibida</span>
                           </th>
                           <th className="px-4 py-2 text-left">
                             <span className="text-xs font-medium text-white uppercase tracking-wider">Unidad</span>
                           </th>
                         </tr>
                       </thead>
                                             <tbody className="bg-white divide-y divide-slate-100">
                         {ordenCompra.items?.map((item) => (
                                                       <tr
                              key={item.id}
                              className={`hover:bg-orange-50/50 cursor-pointer transition-colors duration-150 ${
                                selectedItems.includes(item.id) ? "bg-orange-50/80 border-l-2 border-orange-500" : ""
                              }`}
                              onClick={() => handleRowClick(item.id)}
                              tabIndex={0}
                              aria-label={`Seleccionar item ${item.producto_denominacion || item.odi_detalle1}`}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") handleRowClick(item.id)
                              }}
                            >
                              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                <span
                                  role="checkbox"
                                  aria-checked={selectedItems.includes(item.id)}
                                  tabIndex={0}
                                  onClick={() => handleItemSelect(item.id, !selectedItems.includes(item.id))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ")
                                      handleItemSelect(item.id, !selectedItems.includes(item.id))
                                  }}
                                  className={`inline-flex items-center justify-center w-4 h-4 rounded border transition-all duration-200 cursor-pointer ${
                                    selectedItems.includes(item.id)
                                      ? "bg-orange-600 border-orange-600 shadow-sm"
                                      : "bg-white border-slate-300 hover:border-orange-400"
                                  }`}
                                >
                                  {selectedItems.includes(item.id) && (
                                   <svg
                                     width="12"
                                     height="12"
                                     viewBox="0 0 12 12"
                                     fill="none"
                                     xmlns="http://www.w3.org/2000/svg"
                                   >
                                     <path
                                       d="M2.5 6L5 8.5L9.5 3.5"
                                       stroke="white"
                                       strokeWidth="1.5"
                                       strokeLinecap="round"
                                       strokeLinejoin="round"
                                     />
                                   </svg>
                                 )}
                               </span>
                             </td>
                             <td className="px-2 py-2 text-xs font-mono text-slate-700 bg-slate-50/50">
                               {item.producto_codigo || '-'}
                             </td>
                             <td className="px-3 py-2 text-sm text-slate-800 font-medium">
                               <div className="truncate max-w-xs" title={item.producto_denominacion || item.odi_detalle1}>
                                 {item.producto_denominacion || item.odi_detalle1}
                               </div>
                             </td>
                             <td className="px-3 py-2 text-sm text-slate-700 font-semibold text-center">
                               {item.odi_cantidad}
                             </td>
                             <td className="px-3 py-2 text-center">
                               {selectedItems.includes(item.id) ? (
                                 <input
                                   type="number"
                                   min="0"
                                   step="0.01"
                                   value={cantidadesRecibidas[item.id] || ''}
                                   onChange={(e) => handleCantidadChange(item.id, e.target.value)}
                                   onClick={(e) => e.stopPropagation()}
                                   data-item-id={item.id}
                                   className="w-20 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                   placeholder="0.00"
                                 />
                               ) : (
                                 <span className="text-slate-400 text-xs">-</span>
                               )}
                             </td>
                             <td className="px-3 py-2 text-sm text-slate-600 text-center">
                               {item.producto_unidad || item.odi_detalle2 || '-'}
                             </td>
                           </tr>
                         ))}
                       </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-200/80 bg-gradient-to-r from-slate-50/30 to-slate-100/20">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-slate-600">
                      {selectedItems.length} de {ordenCompra.items?.length || 0} items seleccionados
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                        disabled={loading}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleConvertir}
                        disabled={selectedItems.length === 0 || loading}
                        className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${theme.botonPrimario}`}
                      >
                        {loading ? 'Convirtiendo...' : 'Convertir a Compra'}
                      </button>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export default ConversionCompraModal

