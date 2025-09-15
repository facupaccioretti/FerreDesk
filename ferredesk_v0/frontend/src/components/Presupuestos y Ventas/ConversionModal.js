"use client"

import { Fragment, useState, useEffect } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { formatearMoneda } from "./herramientasforms/plantillasComprobantes/helpers"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

const ConversionModal = ({
  open,
  presupuesto,
  onClose,
  onConvertir,
  vendedores,
  clientes,
  plazos,
  sucursales,
  puntosVenta,
}) => {
  const theme = useFerreDeskTheme()
  const [selectedItems, setSelectedItems] = useState([])

  // Detectar tipo de conversión
  const esConversionFacturaI = presupuesto?.tipoConversion === 'factura_i_factura'
  
  // Textos dinámicos según el tipo de conversión
  const titulo = esConversionFacturaI ? 'Convertir a Factura Fiscal' : 'Convertir a Venta'
  const subtituloItems = esConversionFacturaI ? 'Ítems de la Cotización' : 'Ítems del Presupuesto'
  const textoBoton = esConversionFacturaI ? 'Convertir a Factura' : 'Convertir a Venta'

  // Inicializar items seleccionados cuando se abre el modal
  useEffect(() => {
    if (open && presupuesto?.items) {
      setSelectedItems(presupuesto.items.map((item) => item.id))
    }
  }, [open, presupuesto])

  // Manejar selección individual de items
  const handleItemSelect = (itemId, checked) => {
    if (checked) {
      setSelectedItems((prev) => [...prev, itemId])
    } else {
      setSelectedItems((prev) => prev.filter((id) => id !== itemId))
    }
  }

  // Manejar click en la fila
  const handleRowClick = (itemId) => {
    const isSelected = selectedItems.includes(itemId)
    handleItemSelect(itemId, !isSelected)
  }

  // Selección total
  const todosSeleccionados =
    presupuesto?.items && selectedItems.length === presupuesto.items.length
  const toggleSeleccionarTodos = () => {
    if (todosSeleccionados) {
      setSelectedItems([])
    } else {
      setSelectedItems(presupuesto.items.map((it) => it.id))
    }
  }

  if (!open) return null

  // Datos generales
  const cliente =
    clientes?.find((c) => c.id === (presupuesto?.clienteId || presupuesto?.ven_idcli))?.razon ||
    presupuesto?.cliente ||
    presupuesto?.clienteId ||
    "-"
  const vendedor =
    vendedores?.find((v) => v.id === (presupuesto?.vendedorId || presupuesto?.ven_idvdo))?.nombre ||
    presupuesto?.vendedorId ||
    "-"
  const sucursal =
    sucursales?.find((s) => s.id === (presupuesto?.sucursalId || presupuesto?.ven_sucursal))?.nombre ||
    presupuesto?.sucursalId ||
    "-"
  const puntoVenta =
    puntosVenta?.find((pv) => pv.id === (presupuesto?.puntoVentaId || presupuesto?.ven_punto))?.nombre ||
    presupuesto?.puntoVentaId ||
    "-"
  const plazo =
    plazos?.find((p) => p.id === (presupuesto?.plazoId || presupuesto?.ven_idpla))?.nombre ||
    presupuesto?.plazoId ||
    "-"

  return (
    <Transition appear show={open} as={Fragment}>
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
                        {titulo}
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
                  <div className="grid grid-cols-6 gap-3">
                    <div className="bg-white/80 px-3 py-2 rounded-lg border border-slate-200/50">
                      <span className="block text-xs font-medium text-slate-500 mb-0.5">Cliente</span>
                      <span className="block text-sm font-semibold text-slate-800 truncate" title={cliente}>
                        {cliente}
                      </span>
                    </div>
                    <div className="bg-white/80 px-3 py-2 rounded-lg border border-slate-200/50">
                      <span className="block text-xs font-medium text-slate-500 mb-0.5">Fecha</span>
                      <span className="block text-sm font-semibold text-slate-800">{presupuesto?.fecha}</span>
                    </div>
                    <div className="bg-white/80 px-3 py-2 rounded-lg border border-slate-200/50">
                      <span className="block text-xs font-medium text-slate-500 mb-0.5">Vendedor</span>
                      <span className="block text-sm font-semibold text-slate-800 truncate" title={vendedor}>
                        {vendedor}
                      </span>
                    </div>
                    <div className="bg-white/80 px-3 py-2 rounded-lg border border-slate-200/50">
                      <span className="block text-xs font-medium text-slate-500 mb-0.5">Sucursal</span>
                      <span className="block text-sm font-semibold text-slate-800 truncate" title={sucursal}>
                        {sucursal}
                      </span>
                    </div>
                    <div className="bg-white/80 px-3 py-2 rounded-lg border border-slate-200/50">
                      <span className="block text-xs font-medium text-slate-500 mb-0.5">Pto. Venta</span>
                      <span className="block text-sm font-semibold text-slate-800 truncate" title={puntoVenta}>
                        {puntoVenta}
                      </span>
                    </div>
                    <div className="bg-white/80 px-3 py-2 rounded-lg border border-slate-200/50">
                      <span className="block text-xs font-medium text-slate-500 mb-0.5">Plazo</span>
                      <span className="block text-sm font-semibold text-slate-800 truncate" title={plazo}>
                        {plazo}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tabla de items compacta */}
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-slate-800">{subtituloItems}</h3>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                      {selectedItems.length} de {presupuesto?.items?.length || 0} seleccionados
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
                          <th className="px-2 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide w-12">
                            #
                          </th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide w-20">
                            Código
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide">
                            Detalle
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide w-20">
                            Cant.
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide w-24">
                            P. Unit.
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide w-20">
                            Bonif.
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide w-24">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {presupuesto?.items?.map((item, idxItem) => (
                          <tr
                            key={item.id}
                            className={`hover:bg-orange-50/50 cursor-pointer transition-colors duration-150 ${
                              selectedItems.includes(item.id) ? "bg-orange-50/80 border-l-2 border-orange-500" : ""
                            }`}
                            onClick={() => handleRowClick(item.id)}
                            tabIndex={0}
                            aria-label={`Seleccionar item ${item.denominacion}`}
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
                            <td className="px-2 py-2 text-xs font-medium text-slate-600">{idxItem + 1}</td>
                            <td className="px-2 py-2 text-xs font-mono text-slate-700 bg-slate-50/50">{item.codigo}</td>
                            <td className="px-3 py-2 text-sm text-slate-800 font-medium">
                              <div className="truncate max-w-xs" title={item.vdi_detalle1 || item.denominacion}>
                                {item.vdi_detalle1 || item.denominacion}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-700 font-semibold text-center">
                              {item.vdi_cantidad || item.cantidad}
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-700 font-medium text-right">
                              ${formatearMoneda(item.precioFinal ?? item.vdi_precio_unitario_final ?? item.precio)}
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-600 text-center">
                              {item.vdi_bonifica || item.bonificacion}%
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-800 font-bold text-right">
                              ${formatearMoneda(item.vdi_importe_total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer compacto */}
                <div className="px-5 py-4 bg-gradient-to-r from-slate-50/50 to-slate-100/30 border-t border-slate-200/80 flex justify-end items-center">
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 font-medium text-sm transition-all duration-200"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => onConvertir(selectedItems)}
                      disabled={selectedItems.length === 0}
                      className="px-5 py-2 rounded-lg text-white bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
                    >
                      {textoBoton}
                    </button>
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

export default ConversionModal
