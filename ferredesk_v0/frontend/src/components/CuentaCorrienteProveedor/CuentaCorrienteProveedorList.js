"use client"

import { useState, useEffect, Fragment } from "react"
import { Menu, Transition as MenuTransition } from "@headlessui/react"
import useCuentaCorrienteProveedorAPI from "../../utils/useCuentaCorrienteProveedorAPI"
import CuentaCorrienteProveedorTable from "./CuentaCorrienteProveedorTable"
// import OrdenPagoModal from "./OrdenPagoModal"
import OrdenPagoReciboModal from "../Caja/OrdenPagoReciboModal"
import ImputarOrdenPagoModal from "./ImputarOrdenPagoModal"
import DetalleComprobanteProveedorModal from "./DetalleComprobanteProveedorModal"
import AjusteProveedorModal from "./AjusteProveedorModal"
import ProveedorSelectorModal from "../Compras/ProveedorSelectorModal" // Reutilizamos el existente

const CuentaCorrienteProveedorList = ({
    proveedorSeleccionado,
    fechaDesde,
    fechaHasta,
    completo,
    onProveedorChange,
    onFechaDesdeChange,
    onFechaHastaChange,
    onCompletoChange,
    theme
}) => {
    const {
        loading,
        error,
        getCuentaCorrienteProveedor,
        anularOrdenPago,
        crearAjusteProveedor,
    } = useCuentaCorrienteProveedorAPI()

    const [cuentaCorriente, setCuentaCorriente] = useState(null)

    // Modales
    const [proveedorSelectorModal, setProveedorSelectorModal] = useState({ abierto: false })
    const [ordenPagoModal, setOrdenPagoModal] = useState({ abierto: false })
    const [imputarOrdenModal, setImputarOrdenModal] = useState({ abierto: false, comprobante: null })
    const [detalleModal, setDetalleModal] = useState({ abierto: false, item: null })
    const [ajusteModal, setAjusteModal] = useState({ abierto: false, tipo: 'DEBITO' })

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
            const response = await getCuentaCorrienteProveedor(
                proveedorSeleccionado.id,
                fechaDesde,
                fechaHasta,
                completo
            )
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

    const handleAbrirAjuste = (tipo) => {
        if (!proveedorSeleccionado) {
            alert('Debe seleccionar un proveedor primero')
            return
        }
        setAjusteModal({ abierto: true, tipo })
    }

    const handleConfirmarAjuste = async (ajusteData) => {
        try {
            await crearAjusteProveedor(ajusteData)
            setAjusteModal({ ...ajusteModal, abierto: false })
            cargarCuentaCorriente()
        } catch (err) {
            console.error('Error al crear ajuste:', err)
            alert('Error al crear ajuste: ' + err.message)
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

                {/* Dropdown de Acciones (Nueva OP / Ajustes) */}
                <div className={`${CLASES_FILTRO} flex-1`}>
                    <div className={CLASES_ETIQUETA}>Acciones</div>
                    <div className="mt-0.5 relative">
                        <Menu as="div" className="relative inline-block w-full text-left">
                            <Menu.Button
                                disabled={loading || !proveedorSeleccionado}
                                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white text-xs font-semibold py-1.5 px-3 rounded shadow-sm transition-all flex items-center justify-center space-x-1.5"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>Nuevo...</span>
                                <svg className="w-3 h-3 ml-0.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </Menu.Button>

                            <MenuTransition
                                as={Fragment}
                                enter="transition ease-out duration-100"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="transform opacity-100 scale-100"
                                leaveTo="transform opacity-0 scale-95"
                            >
                                <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-slate-100 rounded-md bg-white shadow-xl ring-1 ring-black/5 focus:outline-none z-50">
                                    <div className="px-1 py-1">
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button
                                                    onClick={handleNuevaOrdenPago}
                                                    className={`${active ? 'bg-orange-500 text-white' : 'text-slate-700'
                                                        } group flex w-full items-center rounded-md px-3 py-2 text-xs font-medium`}
                                                >
                                                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    Nueva Orden de Pago
                                                </button>
                                            )}
                                        </Menu.Item>
                                    </div>
                                    <div className="px-1 py-1">
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button
                                                    onClick={() => handleAbrirAjuste('DEBITO')}
                                                    className={`${active ? 'bg-slate-800 text-white' : 'text-slate-700'
                                                        } group flex w-full items-center rounded-md px-3 py-2 text-xs font-medium`}
                                                >
                                                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                                    </svg>
                                                    Generar Ajuste Débito
                                                </button>
                                            )}
                                        </Menu.Item>
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button
                                                    onClick={() => handleAbrirAjuste('CREDITO')}
                                                    className={`${active ? 'bg-blue-600 text-white' : 'text-slate-700'
                                                        } group flex w-full items-center rounded-md px-3 py-2 text-xs font-medium`}
                                                >
                                                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                                    </svg>
                                                    Generar Ajuste Crédito
                                                </button>
                                            )}
                                        </Menu.Item>
                                    </div>
                                </Menu.Items>
                            </MenuTransition>
                        </Menu>
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

            {/* Modal nueva orden de pago (Unified) */}
            <OrdenPagoReciboModal
                abierto={ordenPagoModal.abierto}
                onClose={handleCerrarOrdenPago}
                onGuardar={handleOrdenPagoGuardada}
                entidad={proveedorSeleccionado}
                tipo="ORDEN_PAGO"
            />

            {/* Modal para Ajustes Débito/Crédito */}
            <AjusteProveedorModal
                abierto={ajusteModal.abierto}
                onClose={() => setAjusteModal({ ...ajusteModal, abierto: false })}
                onConfirmar={handleConfirmarAjuste}
                tipo={ajusteModal.tipo}
                proveedor={proveedorSeleccionado}
                loading={loading}
            />

            {/* Legacy Modal (Comentado para preservar según pedido)
            <OrdenPagoModal
                abierto={ordenPagoModal.abierto}
                onClose={handleCerrarOrdenPago}
                onGuardar={handleOrdenPagoGuardada}
                proveedor={proveedorSeleccionado}
            />
            */}

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
