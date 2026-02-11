"use client"

import { useState, useEffect } from "react"
import useCuentaCorrienteAPI from "../../utils/useCuentaCorrienteAPI"
import CuentaCorrienteTable from "./CuentaCorrienteTable"
// import NuevoReciboModal from "./NuevoReciboModal"
import OrdenPagoReciboModal from "../Caja/OrdenPagoReciboModal"
import ImputarExistenteModal from "./ImputarExistenteModal"
import ModalDetalleComprobante from "./ModalDetalleComprobante"
import ModalAnularRecibo from "./ModalAnularRecibo"
import ModalModificarImputaciones from "./ModalModificarImputaciones"
import ClienteSelectorModal from "../Clientes/ClienteSelectorModal"

const CuentaCorrienteList = ({
  clienteSeleccionado,
  fechaDesde,
  fechaHasta,
  completo,
  onClienteChange,
  onFechaDesdeChange,
  onFechaHastaChange,
  onCompletoChange,
  theme
}) => {
  const {
    loading,
    error,
    getCuentaCorrienteCliente,
    anularRecibo,
    anularAutoimputacion,
    modificarImputaciones
  } = useCuentaCorrienteAPI()

  const [cuentaCorriente, setCuentaCorriente] = useState(null)
  const [detalleModal, setDetalleModal] = useState({ abierto: false, item: null })
  const [clienteSelectorModal, setClienteSelectorModal] = useState({
    abierto: false
  })
  const [nuevoReciboModal, setNuevoReciboModal] = useState({
    abierto: false,
    clienteId: null
  })
  const [imputarExistenteModal, setImputarExistenteModal] = useState({
    abierto: false,
    comprobante: null
  })
  const [anularReciboModal, setAnularReciboModal] = useState({
    abierto: false,
    item: null
  })
  const [modificarPagosModal, setModificarPagosModal] = useState({
    abierto: false,
    comprobante: null
  })

  // Cargar cuenta corriente cuando cambian los filtros
  useEffect(() => {
    if (clienteSeleccionado) {
      cargarCuentaCorriente()
    }
  }, [clienteSeleccionado, fechaDesde, fechaHasta, completo]) // eslint-disable-line react-hooks/exhaustive-deps

  const cargarCuentaCorriente = async () => {
    if (!clienteSeleccionado) return

    try {
      const response = await getCuentaCorrienteCliente(
        clienteSeleccionado.id,
        fechaDesde,
        fechaHasta,
        completo
      )
      setCuentaCorriente(response)
    } catch (err) {
      console.error('Error al cargar cuenta corriente:', err)
    }
  }


  const handleVerDetalle = (item) => {
    setDetalleModal({ abierto: true, item })
  }

  const handleAbrirSelectorCliente = () => {
    setClienteSelectorModal({ abierto: true })
  }

  const handleCerrarSelectorCliente = () => {
    setClienteSelectorModal({ abierto: false })
  }

  const handleSeleccionarCliente = (cliente) => {
    onClienteChange(cliente)
    handleCerrarSelectorCliente()
  }

  const handleNuevoRecibo = () => {
    if (!clienteSeleccionado) {
      alert('Debe seleccionar un cliente primero')
      return
    }
    setNuevoReciboModal({
      abierto: true,
      clienteId: clienteSeleccionado.id
    })
  }

  const handleCerrarNuevoRecibo = () => {
    setNuevoReciboModal({ abierto: false, clienteId: null })
  }

  const handleNuevoReciboGuardado = () => {
    // Recargar cuenta corriente después de crear el recibo
    cargarCuentaCorriente()
    handleCerrarNuevoRecibo()
  }

  const handleImputarExistente = (comprobante) => {
    // Abrir modal para imputar recibo o nota de crédito existente
    if (!comprobante.saldo_pendiente || comprobante.saldo_pendiente <= 0) {
      alert('Este comprobante no tiene saldo disponible para imputar')
      return
    }
    setImputarExistenteModal({
      abierto: true,
      comprobante: comprobante
    })
  }

  const handleCerrarImputarExistente = () => {
    setImputarExistenteModal({ abierto: false, comprobante: null })
  }

  const handleImputacionExistenteGuardada = () => {
    // Recargar cuenta corriente después de imputar
    cargarCuentaCorriente()
    handleCerrarImputarExistente()
  }

  const handleAnularRecibo = (item) => {
    setAnularReciboModal({ abierto: true, item })
  }

  const handleCerrarAnularRecibo = () => {
    setAnularReciboModal({ abierto: false, item: null })
  }

  const handleConfirmarAnularRecibo = async (item) => {
    try {
      const esAutoimputacion = item.comprobante_tipo === 'factura_recibo'

      if (esAutoimputacion) {
        await anularAutoimputacion(item.ven_id)
      } else {
        await anularRecibo(item.ven_id)
      }

      // Recargar cuenta corriente después de anular
      cargarCuentaCorriente()
      handleCerrarAnularRecibo()
    } catch (err) {
      console.error('Error al anular:', err)
      // El error se muestra automáticamente por el hook
    }
  }

  const handleModificarPagos = (comprobante) => {
    setModificarPagosModal({ abierto: true, comprobante })
  }

  const handleCerrarModificarPagos = () => {
    setModificarPagosModal({ abierto: false, comprobante: null })
  }

  const handleConfirmarModificarPagos = async (comprobanteId, imputaciones) => {
    try {
      await modificarImputaciones(comprobanteId, imputaciones)
      // Recargar cuenta corriente después de modificar
      cargarCuentaCorriente()
      handleCerrarModificarPagos()
    } catch (err) {
      console.error('Error al modificar imputaciones:', err)
      // El error se muestra automáticamente por el hook
    }
  }

  // Constantes de clases para el formato compacto simplificado
  const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
  const CLASES_INPUT = "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
  const CLASES_FILTRO = "bg-white border border-slate-200 rounded-md p-2 h-16 flex flex-col justify-between"

  return (
    <div className="space-y-4">
      {/* Filtros compactos */}
      <div className="flex items-start gap-3 w-full">

        {/* Selector de Cliente */}
        <div className={`${CLASES_FILTRO} flex-1`}>
          <div className={CLASES_ETIQUETA}>Cliente</div>
          <div className="mt-0.5">
            <button
              onClick={handleAbrirSelectorCliente}
              className={CLASES_INPUT + " text-left cursor-pointer flex items-center justify-between"}
              disabled={loading}
            >
              <span className="truncate">
                {clienteSeleccionado ? (clienteSeleccionado.razon || clienteSeleccionado.fantasia) : "Seleccionar cliente..."}
              </span>
              <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Fecha Desde */}
        <div className={`${CLASES_FILTRO} flex-1`}>
          <div className={CLASES_ETIQUETA}>Desde</div>
          <div className="mt-0.5">
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => onFechaDesdeChange(e.target.value)}
              className={CLASES_INPUT}
              disabled={loading}
            />
          </div>
        </div>

        {/* Fecha Hasta */}
        <div className={`${CLASES_FILTRO} flex-1`}>
          <div className={CLASES_ETIQUETA}>Hasta</div>
          <div className="mt-0.5">
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => onFechaHastaChange(e.target.value)}
              className={CLASES_INPUT}
              disabled={loading}
            />
          </div>
        </div>

        {/* Checkbox Completo */}
        <div className={`${CLASES_FILTRO} flex-1`}>
          <div className={CLASES_ETIQUETA}>Mostrar completo</div>
          <div className="mt-0.5 flex items-center space-x-2">
            <input
              type="checkbox"
              id="completo"
              checked={completo}
              onChange={(e) => onCompletoChange(e.target.checked)}
              className="w-3 h-3 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500"
              disabled={loading}
            />
            <label htmlFor="completo" className="text-xs text-slate-600 whitespace-nowrap">
              Todas las transacciones
            </label>
          </div>
        </div>

        {/* Botón Nuevo Recibo */}
        <div className={`${CLASES_FILTRO} flex-1`}>
          <div className={CLASES_ETIQUETA}>Acciones</div>
          <div className="mt-0.5">
            <button
              onClick={handleNuevoRecibo}
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white text-xs font-medium py-1 px-3 rounded transition-colors duration-200 flex items-center justify-center space-x-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Nuevo Recibo</span>
            </button>
          </div>
        </div>
      </div>


      {/* Tabla de cuenta corriente */}
      {clienteSeleccionado && cuentaCorriente && (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200">
          {/* Encabezado de la tabla */}
          <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {clienteSeleccionado.razon || clienteSeleccionado.fantasia}
                </h3>
                <p className="text-sm text-slate-600">
                  {cuentaCorriente.items?.length || 0} movimientos encontrados
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-600">Saldo Total</div>
                <div className={`text-lg font-bold ${(cuentaCorriente.saldo_total || 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${(cuentaCorriente.saldo_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Contenido de la tabla */}
          <div className="p-0">
            <CuentaCorrienteTable
              items={cuentaCorriente.items || []}
              loading={loading}
              onImputarPago={handleImputarExistente}
              onVerDetalle={handleVerDetalle}
              onAnularRecibo={handleAnularRecibo}
              onModificarPagos={handleModificarPagos}
              theme={theme}
              saldoTotal={cuentaCorriente.saldo_total}
            />
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay cliente seleccionado */}
      {!clienteSeleccionado && (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-12">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Selecciona un cliente
            </h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Para ver la cuenta corriente, primero selecciona en la lista de filtros.
            </p>
          </div>
        </div>
      )}

      {/* Modal detalle comprobante */}
      <ModalDetalleComprobante
        open={detalleModal.abierto}
        onClose={() => setDetalleModal({ abierto: false, item: null })}
        itemBase={detalleModal.item}
      />

      {/* Modal selector de cliente */}
      <ClienteSelectorModal
        abierto={clienteSelectorModal.abierto}
        onCerrar={handleCerrarSelectorCliente}
        onSeleccionar={handleSeleccionarCliente}
        cargando={loading}
        error={error}
      />

      {/* Modal nuevo recibo (Unified) */}
      <OrdenPagoReciboModal
        abierto={nuevoReciboModal.abierto}
        onClose={handleCerrarNuevoRecibo}
        onGuardar={handleNuevoReciboGuardado}
        entidad={clienteSeleccionado}
        tipo="RECIBO"
      />

      {/* Legacy Modal (Comentado para preservar según pedido) 
      <NuevoReciboModal
        modal={nuevoReciboModal}
        onClose={handleCerrarNuevoRecibo}
        onGuardar={handleNuevoReciboGuardado}
      />
      */}

      {/* Modal imputar existente (recibos/NC) */}
      <ImputarExistenteModal
        open={imputarExistenteModal.abierto}
        onClose={handleCerrarImputarExistente}
        comprobante={imputarExistenteModal.comprobante}
        clienteId={clienteSeleccionado?.id}
        onImputado={handleImputacionExistenteGuardada}
      />

      {/* Modal anular recibo */}
      <ModalAnularRecibo
        isOpen={anularReciboModal.abierto}
        onClose={handleCerrarAnularRecibo}
        item={anularReciboModal.item}
        onConfirmar={handleConfirmarAnularRecibo}
        loading={loading}
      />

      {/* Modal modificar imputaciones */}
      <ModalModificarImputaciones
        isOpen={modificarPagosModal.abierto}
        onClose={handleCerrarModificarPagos}
        comprobante={modificarPagosModal.comprobante}
        onConfirmar={handleConfirmarModificarPagos}
        loading={loading}
      />

      {/* Mensaje de error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 mr-3">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default CuentaCorrienteList
