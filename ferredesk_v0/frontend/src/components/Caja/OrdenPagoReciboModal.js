"use client"

import React, { Fragment, useState, useEffect, useCallback, useMemo } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import useCuentaCorrienteAPI from "../../utils/useCuentaCorrienteAPI"
import useCuentaCorrienteProveedorAPI from "../../utils/useCuentaCorrienteProveedorAPI"
import useCajaAPI from "../../utils/useCajaAPI"
import MediosPagoGrid from "./MediosPagoGrid"

/**
 * OrdenPagoReciboModal - Modal unificado para Cobros (Recibos) y Pagos (Ordenes de Pago)
 * 
 * @param {boolean} abierto - Estado del modal
 * @param {function} onClose - Función para cerrar
 * @param {function} onGuardar - Callback post-guardado
 * @param {object} entidad - Objeto Cliente o Proveedor
 * @param {string} tipo - 'RECIBO' (Ingreso de dinero) o 'ORDEN_PAGO' (Egreso de dinero)
 */
const OrdenPagoReciboModal = ({
    abierto,
    onClose,
    onGuardar,
    entidad,
    tipo = 'RECIBO'
}) => {
    const theme = useFerreDeskTheme()

    // Hooks de API (seleccionamos según tipo)
    const apiCliente = useCuentaCorrienteAPI()
    const apiProveedor = useCuentaCorrienteProveedorAPI()
    const { validarCUIT } = useCajaAPI()

    // Extraemos métodos específicos para que las dependencias sean estables
    const {
        getFacturasPendientes,
        getMetodosPago: getMetodosCliente,
        getCuentasBanco: getCuentasCliente,
        getChequesEnCartera: getChequesCliente,
        crearReciboConImputaciones
    } = apiCliente

    const {
        getComprasPendientes,
        getMetodosPago: getMetodosProv,
        getCuentasBanco: getCuentasProv,
        getChequesEnCartera: getChequesProv,
        crearOrdenPago
    } = apiProveedor

    const [paso, setPaso] = useState(1) // 1: Imputaciones, 2: Datos y Pagos

    // Catálogos
    const [metodosPago, setMetodosPago] = useState([])
    const [cuentasBanco, setCuentasBanco] = useState([])
    const [chequesCartera, setChequesCartera] = useState([])

    // Paso 1: Deudas (Facturas de Venta o Facturas de Compra)
    const [documentosPendientes, setDocumentosPendientes] = useState([])
    const [imputaciones, setImputaciones] = useState([])

    // Paso 2: Datos Generales
    const [formData, setFormData] = useState({
        fecha: new Date().toISOString().split('T')[0],
        pv: '0001',
        numero: '',
        observacion: '',
    })

    // Paso 2: Pagos (Lista de objetos de pago)
    const [pagos, setPagos] = useState([])

    const [loading, setLoading] = useState(false)

    // Constantes de estilo
    const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
    const CLASES_INPUT = "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
    const CLASES_TARJETA = "bg-white border border-slate-200 rounded-md p-4"
    const CLASES_BOTON_SECUNDARIO = "px-6 py-2 rounded-lg font-semibold shadow-sm transition-all duration-200 bg-slate-100 text-slate-600 hover:bg-slate-200"

    // Totales dinámicos
    const montoImputaciones = useMemo(() =>
        imputaciones.reduce((total, imp) => total + (parseFloat(imp.monto) || 0), 0)
        , [imputaciones])

    const montoPagos = useMemo(() =>
        pagos.reduce((total, p) => total + (parseFloat(p.monto) || 0), 0)
        , [pagos])

    // Carga de datos iniciales
    const cargarDatosParaTipo = useCallback(async () => {
        if (!entidad?.id) return
        setLoading(true)
        try {

            const fetchPendientes = tipo === 'RECIBO'
                ? getFacturasPendientes(entidad.id)
                : getComprasPendientes(entidad.id)

            const metodosFn = tipo === 'RECIBO' ? getMetodosCliente : getMetodosProv
            const cuentasFn = tipo === 'RECIBO' ? getCuentasCliente : getCuentasProv
            const chequesFn = tipo === 'RECIBO' ? getChequesCliente : getChequesProv

            const [pendientes, metodos, cuentas, cheques] = await Promise.all([
                fetchPendientes,
                metodosFn(),
                cuentasFn(),
                chequesFn()
            ])

            const docs = tipo === 'RECIBO' ? (pendientes.facturas || []) : (pendientes.compras_pendientes || [])
            setDocumentosPendientes(docs)
            setMetodosPago(Array.isArray(metodos) ? metodos : metodos.results || [])
            setCuentasBanco(Array.isArray(cuentas) ? cuentas : cuentas.results || [])
            setChequesCartera(Array.isArray(cheques) ? cheques : cheques.results || [])

            // Inicializar imputaciones
            setImputaciones(docs.map(doc => ({
                id: tipo === 'RECIBO' ? doc.ven_id : doc.compra_id,
                numero: tipo === 'RECIBO' ? doc.numero_formateado : doc.numero_factura,
                fecha: tipo === 'RECIBO' ? doc.ven_fecha : doc.fecha,
                saldo_pendiente: parseFloat(doc.saldo_pendiente) || 0,
                monto: 0
            })))

        } catch (err) {
            console.error('Error al cargar datos:', err)
            window.alert('Error al cargar datos de ' + (tipo === 'RECIBO' ? 'facturas' : 'compras') + ': ' + err.message)
        } finally {
            setLoading(false)
        }
    }, [
        entidad?.id, tipo,
        getFacturasPendientes, getComprasPendientes,
        getMetodosCliente, getMetodosProv,
        getCuentasCliente, getCuentasProv,
        getChequesCliente, getChequesProv
    ])

    useEffect(() => {
        if (abierto && entidad?.id) {
            resetearFormulario()
            cargarDatosParaTipo()
        }
    }, [abierto, entidad?.id, cargarDatosParaTipo])

    const resetearFormulario = () => {
        setPaso(1)
        setFormData({
            fecha: new Date().toISOString().split('T')[0],
            pv: '0001',
            numero: '',
            observacion: '',
        })
        setPagos([])
    }


    const handleImputacionChange = (id, monto) => {
        setImputaciones(prev => prev.map(imp =>
            imp.id === id ? { ...imp, monto: parseFloat(monto) || 0 } : imp
        ))
    }

    const handleAvanzarPaso2 = () => {
        // Al avanzar, si no hay pagos definidos, inicializar con Efectivo por defecto cubriendo el total imputado
        if (pagos.length === 0 && montoImputaciones > 0) {
            const efectivo = metodosPago.find(m => m.codigo === 'EFECTIVO')
            setPagos([{
                metodo_pago_id: efectivo?.id || '',
                codigo: efectivo?.codigo || 'EFECTIVO',
                monto: montoImputaciones,
                detalle: ''
            }])
        }
        setPaso(2)
    }

    const handleGuardar = async () => {
        if (montoPagos <= 0) {
            window.alert('El monto total debe ser mayor a 0')
            return
        }

        // Validación de coherencia
        if (montoImputaciones > montoPagos) {
            window.alert('El monto total imputado no puede ser mayor al total de medios de pago.')
            return
        }

        // Validaciones específicas de la grilla (pueden ser más extensas)
        const pagosInvalidos = pagos.some(p => !p.metodo_pago_id || p.monto <= 0)
        if (pagosInvalidos) {
            window.alert('Todos los medios de pago deben tener un método seleccionado y un monto válido.')
            return;
        }

        setLoading(true)
        try {

            if (tipo === 'RECIBO') {
                const reciboData = {
                    cliente_id: entidad.id,
                    rec_fecha: formData.fecha,
                    rec_pv: formData.pv,
                    rec_numero: formData.numero,
                    rec_observacion: formData.observacion,
                    rec_monto_total: montoPagos,
                    pagos: pagos,
                    imputaciones: imputaciones
                        .filter(imp => imp.monto > 0)
                        .map(imp => ({
                            imp_id_venta: imp.id,
                            imp_monto: imp.monto,
                            imp_observacion: ''
                        }))
                }
                await crearReciboConImputaciones(reciboData)
            } else {
                const ordenData = {
                    proveedor_id: entidad.id,
                    fecha: formData.fecha,
                    numero: formData.numero,
                    observacion: formData.observacion,
                    total: montoPagos,
                    pagos: pagos,
                    imputaciones: imputaciones
                        .filter(imp => imp.monto > 0)
                        .map(imp => ({
                            compra_id: imp.id,
                            monto: imp.monto,
                            observacion: ''
                        }))
                }
                await crearOrdenPago(ordenData)
            }
            onGuardar()
        } catch (err) {
            window.alert(err.message || 'Error al procesar el comprobante')
        } finally {
            setLoading(false)
        }
    }

    const tituloModal = tipo === 'RECIBO' ? 'Ingreso de Cobro (Recibo)' : 'Egreso de Pago (Orden de Pago)'

    return (
        <Transition show={abierto} as={Fragment} appear>
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
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
                </Transition.Child>

                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                >
                    <div className="fixed inset-0 flex items-center justify-center p-4">
                        <Dialog.Panel className="w-full max-w-6xl bg-white rounded-lg shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
                            {/* Header */}
                            <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}>
                                <div className="flex items-center gap-3 text-white">
                                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                                        </svg>
                                    </div>
                                    <div>
                                        <Dialog.Title className="text-lg font-bold leading-none">
                                            {tituloModal}
                                        </Dialog.Title>
                                        <p className="text-[10px] text-white/70 uppercase tracking-widest mt-1">
                                            {entidad?.razon || 'Seleccione entidad'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Contenido Principal */}
                            <div className="px-6 py-6 overflow-y-auto flex-1 bg-slate-50/50">

                                {/* PASO 1: IMPUTACIONES (DEUDAS) */}
                                {paso === 1 && (
                                    <div className="space-y-4 animate-in fade-in duration-300">
                                        <div className="flex items-center gap-4 border-b border-slate-200 pb-2 mb-4">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm">1</div>
                                            <h3 className="font-semibold text-slate-800">Seleccionar pendientes a cancelar</h3>
                                        </div>

                                        {documentosPendientes.length === 0 ? (
                                            <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-xl">
                                                <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-400">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12" />
                                                    </svg>
                                                </div>
                                                <p className="text-slate-500 font-medium font-sm">No hay documentos pendientes.</p>
                                                <p className="text-slate-400 text-xs mt-1 italic">Este comprobante se registrará como un "Pago a Cuenta" (Saldo a favor).</p>
                                            </div>
                                        ) : (
                                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-slate-50 border-b border-slate-200">
                                                        <tr className="uppercase tracking-wider text-slate-500">
                                                            <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                                                            <th className="px-4 py-3 text-left font-semibold">Comprobante</th>
                                                            <th className="px-4 py-3 text-right font-semibold">Saldo Pendiente</th>
                                                            <th className="px-4 py-3 text-right font-semibold">Monto a Aplicar</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {imputaciones.map(imp => (
                                                            <tr key={imp.id} className={imp.monto > 0 ? "bg-orange-50/50 transition-colors" : "hover:bg-slate-50 transition-colors"}>
                                                                <td className="px-4 py-3 text-slate-600">
                                                                    {new Date(imp.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                                                                </td>
                                                                <td className="px-4 py-3 font-medium text-slate-800">{imp.numero}</td>
                                                                <td className="px-4 py-3 text-right text-slate-600 font-mono">
                                                                    ${imp.saldo_pendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <input
                                                                            type="number"
                                                                            className="w-28 border border-slate-300 rounded px-2 py-1.5 text-right font-bold text-slate-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                            value={imp.monto || ''}
                                                                            min="0"
                                                                            max={imp.saldo_pendiente}
                                                                            onChange={(e) => handleImputacionChange(imp.id, e.target.value)}
                                                                            placeholder="0.00"
                                                                        />
                                                                        <button
                                                                            onClick={() => handleImputacionChange(imp.id, imp.saldo_pendiente)}
                                                                            className="text-[10px] text-orange-600 font-bold hover:underline"
                                                                            title="Cargar saldo completo"
                                                                        >
                                                                            MAX
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                        <div className="flex justify-end p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                                            <div className="text-right">
                                                <span className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Total a Imputar</span>
                                                <span className="font-bold text-orange-600 text-2xl tracking-tighter">
                                                    ${montoImputaciones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* PASO 2: MEDIOS DE PAGO Y DATOS */}
                                {paso === 2 && (
                                    <div className="grid grid-cols-12 gap-6 animate-in slide-in-from-right-4 duration-300">

                                        {/* Columna Izquierda: Datos Comprobante y Medios de Pago */}
                                        <div className="col-span-12 lg:col-span-8 space-y-6">
                                            <div className={CLASES_TARJETA}>
                                                <h3 className="font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Información General</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className={CLASES_ETIQUETA}>Fecha Emisión</label>
                                                        <input
                                                            type="date"
                                                            className={CLASES_INPUT}
                                                            value={formData.fecha}
                                                            onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={CLASES_ETIQUETA}>PV</label>
                                                        <input
                                                            type="text"
                                                            maxLength={4}
                                                            className={CLASES_INPUT}
                                                            placeholder="0001"
                                                            value={formData.pv}
                                                            onChange={(e) => setFormData({ ...formData, pv: e.target.value.padStart(4, '0') })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={CLASES_ETIQUETA}>N° Comprobante</label>
                                                        <input
                                                            type="text"
                                                            className={`${CLASES_INPUT} font-mono`}
                                                            placeholder="Número..."
                                                            value={formData.numero}
                                                            onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="md:col-span-3">
                                                        <label className={CLASES_ETIQUETA}>Observaciones internas</label>
                                                        <textarea
                                                            rows={2}
                                                            className={`${CLASES_INPUT} h-auto`}
                                                            placeholder="Escriba algo si es necesario..."
                                                            value={formData.observacion}
                                                            onChange={(e) => setFormData({ ...formData, observacion: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <MediosPagoGrid
                                                pagos={pagos}
                                                setPagos={setPagos}
                                                metodosPago={metodosPago}
                                                cuentasBanco={cuentasBanco}
                                                chequesCartera={chequesCartera}
                                                modo={tipo}
                                                entidadNombre={entidad?.razon || ''}
                                                cuitEntidad={entidad?.cuit || ''}
                                                proveedorNombre={tipo === 'ORDEN_PAGO' ? entidad?.razon : ''}
                                                validarCUITFn={validarCUIT}
                                            />
                                        </div>

                                        {/* Columna Derecha: Resumen de Totales */}
                                        <div className="col-span-12 lg:col-span-4 space-y-4">
                                            <div className="sticky top-0 space-y-4">
                                                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden pb-4">
                                                    <div className="bg-slate-800 px-4 py-3 text-white">
                                                        <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-3-3V18m-3-3V18M4.5 3.75h15a2.25 2.25 0 0 1 2.25 2.25v12a2.25 2.25 0 0 1-2.25 2.25H4.5A2.25 2.25 0 0 1 2.25 18V5.75A2.25 2.25 0 0 1 4.5 3.75Z" />
                                                            </svg>
                                                            Resumen de totales
                                                        </h3>
                                                    </div>

                                                    <div className="px-5 py-6 space-y-6">
                                                        <div className="flex justify-between items-end border-b border-slate-100 pb-3">
                                                            <div>
                                                                <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Imputado</span>
                                                                <span className="text-lg font-bold text-slate-600">${montoImputaciones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex justify-between items-end">
                                                            <div>
                                                                <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Medios de Pago</span>
                                                                <span className={`text-3xl font-bold tracking-tighter ${montoPagos < montoImputaciones ? 'text-red-500' : 'text-green-600'}`}>
                                                                    ${montoPagos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {montoPagos > montoImputaciones && (
                                                            <div className="bg-green-50 border border-green-100 p-3 rounded text-green-700 text-xs font-semibold flex items-center gap-2">
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-500">
                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 1 00-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                                                                </svg>
                                                                <span>Saldo a favor: ${(montoPagos - montoImputaciones).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                        )}

                                                        {montoPagos < montoImputaciones && montoPagos > 0 && (
                                                            <div className="bg-red-50 border border-red-100 p-3 rounded text-red-700 text-xs font-semibold flex items-center gap-2">
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-500">
                                                                    <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                                                                </svg>
                                                                <span>Faltan ${(montoImputaciones - montoPagos).toLocaleString('es-AR', { minimumFractionDigits: 2 })} por cubrir.</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Mensaje de Ayuda dinámico */}
                                                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-lg">
                                                    <p className="text-[11px] text-blue-700 leading-relaxed italic">
                                                        <span className="font-bold">Procesamiento de Comprobante:</span> Al confirmar, se generará el {tipo === 'RECIBO' ? 'Recibo de Cobro' : 'Orden de Pago'}, se registrarán los movimientos de caja correspondientes y se actualizará el saldo en cuenta corriente.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>

                            {/* Footer - Navegación */}
                            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                                {paso === 2 ? (
                                    <button
                                        onClick={() => setPaso(1)}
                                        className={CLASES_BOTON_SECUNDARIO}
                                        disabled={loading}
                                    >
                                        ← Atrás
                                    </button>
                                ) : (
                                    <button
                                        onClick={onClose}
                                        className={CLASES_BOTON_SECUNDARIO}
                                    >
                                        Cancelar
                                    </button>
                                )}

                                <div className="flex gap-3">
                                    {paso === 1 ? (
                                        <>
                                            <button onClick={onClose} className="px-6 py-2 text-slate-500 font-semibold hover:text-slate-800 transition-colors">Cerrar</button>
                                            <button
                                                onClick={handleAvanzarPaso2}
                                                className={`px-8 py-2 rounded-lg font-bold text-sm shadow-md transition-all active:scale-95 ${theme.botonPrimario}`}
                                            >
                                                Paso Siguiente: Pagos →
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={handleGuardar}
                                            disabled={loading}
                                            className={`px-10 py-2 rounded-xl font-bold text-sm shadow-xl transition-all active:scale-95 flex items-center gap-2 ${theme.botonPrimario} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {loading ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Procesando...
                                                </>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                                    </svg>
                                                    Confirmar y Guardar
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </Dialog.Panel>
                    </div>
                </Transition.Child>
            </Dialog>
        </Transition>
    )
}

export default OrdenPagoReciboModal
