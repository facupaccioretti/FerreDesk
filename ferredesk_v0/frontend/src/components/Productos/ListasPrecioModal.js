"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useListasPrecioAPI } from "../../utils/useListasPrecioAPI"
import { BotonEditar, BotonHistorial } from "../Botones"

// Constantes para las pestañas
const PESTANA_MARGENES = 'margenes'
const PESTANA_DESACTUALIZADOS = 'desactualizados'

// Función para formatear fechas
const formatearFecha = (valor) => {
  if (!valor) return '-'
  try {
    const fecha = new Date(valor)
    return fecha.toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (e) {
    return valor
  }
}

function ListasPrecioModal({ open, onClose, onEditProducto }) {
  const {
    listas,
    loading: loadingListas,
    actualizarLista,
    obtenerProductosDesactualizados,
    fetchListas
  } = useListasPrecioAPI()

  // Estado de pestañas
  const [pestanaActiva, setPestanaActiva] = useState(PESTANA_MARGENES)

  // Estado para edición de márgenes
  const [margenesEditados, setMargenesEditados] = useState({})
  const [margenesOriginales, setMargenesOriginales] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState(null)
  const [mensajeError, setMensajeError] = useState(null)

  // Estado para productos desactualizados
  const [productosDesactualizados, setProductosDesactualizados] = useState([])
  const [loadingDesactualizados, setLoadingDesactualizados] = useState(false)

  // Estado para historial de lista
  const [historialLista, setHistorialLista] = useState(null)
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [listaHistorialActiva, setListaHistorialActiva] = useState(null)

  // Estado para productos expandidos
  const [productosExpandidos, setProductosExpandidos] = useState({})

  // Cargar listas 1-4 (excluir Lista 0)
  const listas1a4 = listas.filter(l => l.numero >= 1 && l.numero <= 4)

  // Inicializar márgenes editados cuando se cargan las listas
  useEffect(() => {
    const listasDerivadas = listas.filter(l => l.numero >= 1 && l.numero <= 4)
    if (listasDerivadas.length > 0) {
      const margenes = {}
      listasDerivadas.forEach(lista => {
        margenes[lista.id] = String(lista.margen_descuento || 0)
      })
      setMargenesEditados(margenes)
      setMargenesOriginales(margenes)
    }
  }, [listas])

  // Cargar productos desactualizados cuando se abre el modal o cambia a esa pestaña
  const cargarProductosDesactualizados = useCallback(async () => {
    setLoadingDesactualizados(true)
    try {
      const data = await obtenerProductosDesactualizados()
      setProductosDesactualizados(data.productos || [])
    } catch (err) {
      console.error('Error al cargar productos desactualizados:', err)
      setProductosDesactualizados([])
    } finally {
      setLoadingDesactualizados(false)
    }
  }, [obtenerProductosDesactualizados])

  useEffect(() => {
    if (open && pestanaActiva === PESTANA_DESACTUALIZADOS) {
      cargarProductosDesactualizados()
    }
  }, [open, pestanaActiva, cargarProductosDesactualizados])

  // Refrescar datos al abrir el modal
  useEffect(() => {
    if (open) {
      fetchListas()
      setMensajeExito(null)
      setMensajeError(null)
    }
  }, [open, fetchListas])

  // Handler para cambio de margen
  const handleMargenChange = (listaId, valor) => {
    // Validar que el descuento no sea mayor al 99% (valor < -99)
    const num = parseFloat(valor)
    if (!isNaN(num) && num < -99) {
      window.alert("El descuento no puede ser superior al 99% (el valor mínimo permitido es -99).")
      return
    }

    setMargenesEditados(prev => ({
      ...prev,
      [listaId]: valor,
    }))
  }

  // Detectar si hay cambios pendientes
  const hayCambiosPendientes = useCallback(() => {
    for (const listaId of Object.keys(margenesEditados)) {
      if (margenesEditados[listaId] !== margenesOriginales[listaId]) {
        return true
      }
    }
    return false
  }, [margenesEditados, margenesOriginales])

  // Obtener listas que cambiaron
  const obtenerListasCambiadas = useCallback(() => {
    const cambiadas = []
    for (const listaId of Object.keys(margenesEditados)) {
      if (margenesEditados[listaId] !== margenesOriginales[listaId]) {
        const lista = listas1a4.find(l => l.id === parseInt(listaId))
        if (lista) {
          cambiadas.push({
            id: parseInt(listaId),
            nombre: lista.nombre,
            numero: lista.numero,
            margenNuevo: parseFloat(margenesEditados[listaId])
          })
        }
      }
    }
    return cambiadas
  }, [margenesEditados, margenesOriginales, listas1a4])

  // Handler para guardar TODOS los cambios
  const handleGuardarTodo = async () => {
    const listasCambiadas = obtenerListasCambiadas()

    if (listasCambiadas.length === 0) {
      setMensajeError('No hay cambios para guardar')
      setTimeout(() => setMensajeError(null), 3000)
      return
    }

    for (const lista of listasCambiadas) {
      if (isNaN(lista.margenNuevo)) {
        setMensajeError(`El margen de ${lista.nombre} debe ser un número válido`)
        return
      }
      if (lista.margenNuevo < -99) {
        window.alert(`El descuento de ${lista.nombre} no puede ser superior al 99%.`)
        return
      }
    }

    setGuardando(true)
    setMensajeExito(null)
    setMensajeError(null)

    try {
      const errores = []

      for (const lista of listasCambiadas) {
        try {
          await actualizarLista(lista.id, { margen_descuento: lista.margenNuevo })
        } catch (err) {
          errores.push(`${lista.nombre}: ${err.message}`)
        }
      }

      if (errores.length > 0) {
        setMensajeError(`Errores: ${errores.join(', ')}`)
      } else {
        setMargenesOriginales({ ...margenesEditados })
        setMensajeExito('Márgenes actualizados correctamente.')
        cargarProductosDesactualizados()
        setTimeout(() => setMensajeExito(null), 5000)
      }
    } catch (err) {
      setMensajeError('Error al actualizar los márgenes: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  // Handler para cancelar cambios
  const handleCancelar = () => {
    setMargenesEditados({ ...margenesOriginales })
    setMensajeError(null)
  }

  // Handler para editar producto
  const handleEditarProducto = (producto) => {
    if (onEditProducto) {
      onEditProducto({
        id: producto.stock_id,
        codvta: producto.codvta,
        deno: producto.deno,
      })
      // Cerrar el modal para enfocar la pestaña de edición
      onClose()
    }
  }

  // Obtener nombres de listas por número
  const obtenerNombreLista = (listaNumero) => {
    const lista = listas.find(l => l.numero === listaNumero)
    return lista?.nombre || `Lista ${listaNumero}`
  }

  // Cargar historial de una lista
  const cargarHistorialLista = async (listaNumero) => {
    if (listaHistorialActiva === listaNumero) {
      setListaHistorialActiva(null)
      setHistorialLista(null)
      return
    }

    setLoadingHistorial(true)
    setListaHistorialActiva(listaNumero)

    try {
      const res = await fetch(`/api/productos/actualizaciones-listas/?lista_numero=${listaNumero}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Error al cargar historial')
      const data = await res.json()
      const items = Array.isArray(data) ? data : (data.results || [])
      setHistorialLista(items.slice(0, 3))
    } catch (err) {
      console.error('Error al cargar historial:', err)
      setHistorialLista([])
    } finally {
      setLoadingHistorial(false)
    }
  }

  // Toggle expansión de producto
  const toggleProductoExpandido = (stockId) => {
    setProductosExpandidos(prev => ({
      ...prev,
      [stockId]: !prev[stockId]
    }))
  }

  return (
    <Transition show={open} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden">
                {/* Encabezado azul FerreDesk */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-4 relative">
                  <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-2xl text-slate-300 hover:text-white transition-colors"
                  >
                    ×
                  </button>
                  <Dialog.Title className="text-lg font-bold text-white">
                    Gestión de Listas de Precios
                  </Dialog.Title>
                  <p className="text-slate-300 text-sm mt-1">
                    Configura márgenes y revisa precios manuales desactualizados
                  </p>
                </div>

                {/* Pestañas */}
                <div className="flex border-b border-slate-200 bg-slate-50">
                  <button
                    onClick={() => setPestanaActiva(PESTANA_MARGENES)}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${pestanaActiva === PESTANA_MARGENES
                        ? 'text-orange-600 border-b-2 border-orange-600 bg-white'
                        : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                      }`}
                  >
                    Márgenes de Listas
                  </button>
                  <button
                    onClick={() => setPestanaActiva(PESTANA_DESACTUALIZADOS)}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative ${pestanaActiva === PESTANA_DESACTUALIZADOS
                        ? 'text-orange-600 border-b-2 border-orange-600 bg-white'
                        : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                      }`}
                  >
                    Productos Desactualizados
                    {productosDesactualizados.length > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                        {productosDesactualizados.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Contenido */}
                <div className="flex-1 p-4 overflow-auto bg-white">
                  {/* Mensaje de éxito */}
                  {mensajeExito && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                      {mensajeExito}
                    </div>
                  )}

                  {/* Mensaje de error */}
                  {mensajeError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                      {mensajeError}
                    </div>
                  )}

                  {/* Pestaña Márgenes */}
                  {pestanaActiva === PESTANA_MARGENES && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600 mb-4">
                        Define el porcentaje de descuento (-) o recargo (+) sobre el precio de Lista 0.
                      </p>

                      {loadingListas ? (
                        <div className="text-center py-8 text-slate-500">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600 mx-auto mb-2"></div>
                          Cargando listas...
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            {listas1a4.map(lista => {
                              const hayCambio = margenesEditados[lista.id] !== margenesOriginales[lista.id]
                              const historialVisible = listaHistorialActiva === lista.numero
                              return (
                                <div key={lista.id}>
                                  <div
                                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${hayCambio
                                        ? 'bg-amber-50 border-amber-300'
                                        : 'bg-slate-50 border-slate-200'
                                      }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <BotonHistorial
                                        onClick={() => cargarHistorialLista(lista.numero)}
                                        title="Ver historial de actualizaciones"
                                      />
                                      <div>
                                        <span className="font-medium text-slate-700">{lista.nombre}</span>
                                        <span className="text-xs text-slate-400 ml-2">(Lista {lista.numero})</span>
                                        {hayCambio && (
                                          <span className="text-xs text-amber-600 ml-2">• modificado</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={margenesEditados[lista.id] || ''}
                                        onChange={(e) => handleMargenChange(lista.id, e.target.value)}
                                        className="w-20 border border-slate-300 rounded px-2 py-1 text-sm text-right focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                      />
                                      <span className="text-sm text-slate-500">%</span>
                                    </div>
                                  </div>

                                  {/* Panel de historial */}
                                  {historialVisible && (
                                    <div className="ml-8 mt-1 p-3 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                                      {loadingHistorial ? (
                                        <div className="text-slate-500">Cargando historial...</div>
                                      ) : historialLista && historialLista.length > 0 ? (
                                        <div className="space-y-2">
                                          <div className="font-medium text-slate-600 mb-2">Últimas 3 actualizaciones:</div>
                                          {historialLista.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-200 last:border-0">
                                              <div>
                                                <span className="text-slate-500">{formatearFecha(item.fecha_actualizacion)}</span>
                                                <span className="mx-2">•</span>
                                                <span className="text-slate-700">{item.porcentaje_anterior}% → {item.porcentaje_nuevo}%</span>
                                              </div>
                                              <div className="text-slate-500">
                                                {item.usuario_nombre || 'Usuario desconocido'}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-slate-500">Sin historial de actualizaciones</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {/* Botones de acción */}
                          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-200">
                            <button
                              onClick={handleCancelar}
                              disabled={!hayCambiosPendientes() || guardando}
                              className={`px-4 py-2 text-sm rounded transition-colors ${!hayCambiosPendientes() || guardando
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleGuardarTodo}
                              disabled={!hayCambiosPendientes() || guardando}
                              className={`px-4 py-2 text-sm rounded transition-colors ${!hayCambiosPendientes() || guardando
                                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                  : 'bg-orange-600 text-white hover:bg-orange-700'
                                }`}
                            >
                              {guardando ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Pestaña Productos Desactualizados */}
                  {pestanaActiva === PESTANA_DESACTUALIZADOS && (
                    <div>
                      <p className="text-sm text-slate-600 mb-4">
                        Productos con precios cargados manualmente antes de la última actualización de márgenes.
                        Estos precios no se actualizaron automáticamente.
                      </p>

                      {loadingDesactualizados ? (
                        <div className="text-center py-8 text-slate-500">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600 mx-auto mb-2"></div>
                          Cargando productos...
                        </div>
                      ) : productosDesactualizados.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p>No hay productos con precios manuales desactualizados.</p>
                          <p className="text-xs mt-1">Todos los precios están al día.</p>
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100">
                              <tr>
                                <th className="px-2 py-2 text-center font-medium text-slate-700 w-8"></th>
                                <th className="px-3 py-2 text-left font-medium text-slate-700">Código</th>
                                <th className="px-3 py-2 text-left font-medium text-slate-700">Producto</th>
                                <th className="px-3 py-2 text-left font-medium text-slate-700">Listas</th>
                                <th className="px-3 py-2 text-center font-medium text-slate-700">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {productosDesactualizados.map(producto => {
                                const expandido = productosExpandidos[producto.stock_id]
                                return (
                                  <React.Fragment key={producto.stock_id}>
                                    <tr className="hover:bg-slate-50">
                                      <td className="px-2 py-2 text-center">
                                        <button
                                          onClick={() => toggleProductoExpandido(producto.stock_id)}
                                          className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                                          title={expandido ? "Ocultar detalles" : "Ver detalles"}
                                        >
                                          <svg
                                            className={`w-4 h-4 transition-transform ${expandido ? 'rotate-90' : ''}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        </button>
                                      </td>
                                      <td className="px-3 py-2 font-mono text-slate-600">
                                        {producto.codvta}
                                      </td>
                                      <td className="px-3 py-2 text-slate-700 truncate max-w-[200px]" title={producto.deno}>
                                        {producto.deno}
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="flex flex-wrap gap-1">
                                          {producto.listas_desactualizadas.map(listaNum => (
                                            <span
                                              key={listaNum}
                                              className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded"
                                              title={obtenerNombreLista(listaNum)}
                                            >
                                              {obtenerNombreLista(listaNum)}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <BotonEditar
                                          onClick={() => handleEditarProducto(producto)}
                                          title="Editar producto"
                                        />
                                      </td>
                                    </tr>
                                    {/* Fila expandida con detalles */}
                                    {expandido && producto.detalles_listas && (
                                      <tr>
                                        <td colSpan={5} className="bg-slate-50 px-4 py-3">
                                          <div className="text-xs">
                                            <div className="font-medium text-slate-600 mb-2">Detalle de precios manuales:</div>
                                            <div className="grid gap-2">
                                              {producto.detalles_listas.map((detalle, idx) => (
                                                <div
                                                  key={idx}
                                                  className="flex items-center justify-between p-2 bg-white rounded border border-slate-200"
                                                >
                                                  <div className="flex items-center gap-3">
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                                                      {obtenerNombreLista(detalle.lista_numero)}
                                                    </span>
                                                    <span className="text-slate-700 font-medium">
                                                      ${Number(detalle.precio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-4 text-slate-500">
                                                    <span>
                                                      Cargado: {formatearFecha(detalle.fecha_carga_manual)}
                                                    </span>
                                                    <span className="text-slate-400">|</span>
                                                    <span>
                                                      Por: <span className="text-slate-700">{detalle.usuario_nombre || 'Usuario desconocido'}</span>
                                                    </span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Botón refrescar */}
                      <div className="mt-4 text-right">
                        <button
                          onClick={cargarProductosDesactualizados}
                          disabled={loadingDesactualizados}
                          className="px-3 py-1 text-sm text-slate-600 border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                        >
                          Actualizar lista
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export default ListasPrecioModal
