"use client"

import { useState, useEffect } from "react"
import useCuentaCorrienteProveedorAPI from "../../utils/useCuentaCorrienteProveedorAPI"
import CuentaCorrienteProveedorTable from "./CuentaCorrienteProveedorTable"
import OrdenPagoModal from "./OrdenPagoModal"
import ImputarOrdenPagoModal from "./ImputarOrdenPagoModal"
import DetalleComprobanteProveedorModal from "./DetalleComprobanteProveedorModal"
import ProveedorSelectorModal from "../Compras/ProveedorSelectorModal" // Reutilizamos el existente

const CuentaCorrienteProveedorList = ({
    proveedorSeleccionado,
    onProveedorChange,
    theme
}) => {
    const {
        loading,
        error,
        getCuentaCorrienteProveedor,
        anularOrdenPago,
    } = useCuentaCorrienteProveedorAPI()

    const [cuentaCorriente, setCuentaCorriente] = useState(null)
    const [fechaDesde, setFechaDesde] = useState('')
    const [fechaHasta, setFechaHasta] = useState('')
    const [completo, setCompleto] = useState(false)

    // Modales
    const [proveedorSelectorModal, setProveedorSelectorModal] = useState({ abierto: false })
    const [ordenPagoModal, setOrdenPagoModal] = useState({ abierto: false })
    const [imputarOrdenModal, setImputarOrdenModal] = useState({ abierto: false, comprobante: null })
    const [detalleModal, setDetalleModal] = useState({ abierto: false, item: null })

    // Cargar cuenta corriente cuando cambia el proveedor seleccionado o filtros
    useEffect(() => {
        if (proveedorSeleccionado) {
            cargarCuentaCorriente()
        } else {
            setCuentaCorriente(null)
        }
    }, [proveedorSeleccionado, fechaDesde, fechaHasta, completo]) // eslint-disable-line react-hooks/exhaustive-deps

    const cargarCuentaCorriente = async () => {
        if (!proveedorSeleccionado) return

        try {
            const response = await getCuentaCorrienteProveedor(proveedorSeleccionado.id, fechaDesde, fechaHasta, completo)
            setCuentaCorriente(response)
        } catch (err) {
            console.error('Error al cargar cuenta corriente de proveedor:', err)
        }
    }

    // ... handlers existentes ...

    const handleImputarOrden = (comprobante) => {
        if (!comprobante.saldo_pendiente || Number(comprobante.saldo_pendiente) <= 0) {
            alert('Este comprobante no tiene saldo disponible para imputar')
            return
        }
        setImputarOrdenModal({ abierto: true, comprobante })
    }

    const handleVerDetalle = (item) => {
        setDetalleModal({ abierto: true, item })
    }

    const handleCerrarImputarOrden = () => {
        setImputarOrdenModal({ abierto: false, comprobante: null })
    }

    const handleImputacionGuardada = () => {
        cargarCuentaCorriente()
        handleCerrarImputarOrden()
    }

    const handleAbrirSelectorProveedor = () => {
        setProveedorSelectorModal({ abierto: true })
    }

    const handleCerrarSelectorProveedor = () => {
        setProveedorSelectorModal({ abierto: false })
    }

    const handleSeleccionarProveedor = (proveedor) => {
        onProveedorChange(proveedor)
        handleCerrarSelectorProveedor()
    }

    const handleNuevaOrdenPago = () => {
        if (!proveedorSeleccionado) {
            alert('Debe seleccionar un proveedor primero')
            return
        }
        setOrdenPagoModal({ abierto: true })
    }

    const handleCerrarOrdenPago = () => {
        setOrdenPagoModal({ abierto: false })
    }

    const handleOrdenPagoGuardada = () => {
        cargarCuentaCorriente()
        handleCerrarOrdenPago()
    }

    const handleAnularOrdenPago = async (item) => {
        if (!window.confirm(`¿Está seguro de anular la Orden de Pago ${item.numero_formateado}?`)) return;

        try {
            await anularOrdenPago(item.op_id || item.id) // Ajustar ID según respuesta
            cargarCuentaCorriente()
        } catch (err) {
            console.error('Error al anular orden de pago:', err)
            alert('Error al anular orden de pago: ' + err.message)
        }
    }

    // Constantes de clases para el formato compacto
    const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
    const CLASES_INPUT = "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
    const CLASES_FILTRO = "bg-white border border-slate-200 rounded-md p-2 h-16 flex flex-col justify-between"

    return (
        <div className="space-y-4">
            {/* Filtros compactos */}
            <div className="flex items-start gap-3 w-full">

                {/* Selector de Proveedor */}
                <div className={`${CLASES_FILTRO} flex-1`}>
                    <div className={CLASES_ETIQUETA}>Proveedor</div>
                    <div className="mt-0.5">
                        <button
                            onClick={handleAbrirSelectorProveedor}
                            className={CLASES_INPUT + " text-left cursor-pointer flex items-center justify-between"}
                            disabled={loading}
                        >
                            <span className="truncate">
                                {proveedorSeleccionado ? (proveedorSeleccionado.razon || proveedorSeleccionado.fantasia) : "Seleccionar proveedor..."}
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
                            onChange={(e) => setFechaDesde(e.target.value)}
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
                            onChange={(e) => setFechaHasta(e.target.value)}
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
                            onChange={(e) => setCompleto(e.target.checked)}
                            className="w-3 h-3 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500"
                            disabled={loading}
                        />
                        <label htmlFor="completo" className="text-xs text-slate-600 whitespace-nowrap">
                            Todas las transacciones
                        </label>
                    </div>
                </div>

                {/* Botón Nueva Orden de Pago */}
                <div className={`${CLASES_FILTRO} flex-1`}>
                    <div className={CLASES_ETIQUETA}>Acciones</div>
                    <div className="mt-0.5">
                        <button
                            onClick={handleNuevaOrdenPago}
                            disabled={loading || !proveedorSeleccionado}
                            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white text-xs font-medium py-1 px-3 rounded transition-colors duration-200 flex items-center justify-center space-x-1"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Nueva Orden Pago</span>
                        </button>
                    </div>
                </div>
            </div>


            {/* Tabla de cuenta corriente */}
            {proveedorSeleccionado && cuentaCorriente && (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200">
                    {/* Encabezado de la tabla */}
                    <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">
                                    {proveedorSeleccionado.razon || proveedorSeleccionado.fantasia}
                                </h3>
                                <p className="text-sm text-slate-600">
                                    {cuentaCorriente.movimientos?.length || 0} movimientos encontrados
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-slate-600">Saldo Total</div>
                                <div className={`text-lg font-bold ${(cuentaCorriente.saldo_total || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    ${(parseFloat(cuentaCorriente.saldo_total) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contenido de la tabla */}
                    <div className="p-0">
                        <CuentaCorrienteProveedorTable
                            items={cuentaCorriente.movimientos || []}
                            loading={loading}
                            onAnularOrden={handleAnularOrdenPago}
                            onImputar={handleImputarOrden}
                            onVerDetalle={handleVerDetalle}
                            saldoTotal={cuentaCorriente.saldo_total}
                        />
                    </div>
                </div>
            )}

            {/* Mensaje cuando no hay proveedor seleccionado */}
            {!proveedorSeleccionado && (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-12">
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">
                            Selecciona un proveedor
                        </h3>
                        <p className="text-slate-500 max-w-md mx-auto">
                            Para ver la cuenta corriente, primero selecciona un proveedor.
                        </p>
                    </div>
                </div>
            )}

            {/* Modal selector de proveedor */}
            <ProveedorSelectorModal
                abierto={proveedorSelectorModal.abierto}
                onCerrar={handleCerrarSelectorProveedor}
                onSeleccionar={handleSeleccionarProveedor}
                cargando={loading}
                error={error}
            />

            {/* Modal nueva orden de pago */}
            <OrdenPagoModal
                abierto={ordenPagoModal.abierto}
                onClose={handleCerrarOrdenPago}
                onGuardar={handleOrdenPagoGuardada}
                proveedor={proveedorSeleccionado}
            />

            {/* Modal imputar orden de pago */}
            <ImputarOrdenPagoModal
                open={imputarOrdenModal.abierto}
                onClose={handleCerrarImputarOrden}
                comprobante={imputarOrdenModal.comprobante}
                proveedorId={proveedorSeleccionado?.id}
                onImputado={handleImputacionGuardada}
            />

            {/* Modal detalle comprobante */}
            <DetalleComprobanteProveedorModal
                open={detalleModal.abierto}
                onClose={() => setDetalleModal({ abierto: false, item: null })}
                itemBase={detalleModal.item}
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

export default CuentaCorrienteProveedorList
