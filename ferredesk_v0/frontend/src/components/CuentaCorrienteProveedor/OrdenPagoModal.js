"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import useCuentaCorrienteProveedorAPI from "../../utils/useCuentaCorrienteProveedorAPI"

const OrdenPagoModal = ({
    abierto,
    onClose,
    onGuardar,
    proveedor
}) => {
    const theme = useFerreDeskTheme()
    const {
        getComprasPendientes,
        crearOrdenPago,
        getMetodosPago,
        getCuentasBanco,
        getChequesEnCartera
    } = useCuentaCorrienteProveedorAPI()

    const [paso, setPaso] = useState(1) // 1: Imputaciones, 2: Datos y Pagos

    // Data local (catálogos)
    const [metodosPago, setMetodosPago] = useState([])
    const [cuentasBanco, setCuentasBanco] = useState([])
    const [chequesCartera, setChequesCartera] = useState([])

    // Paso 1: Imputaciones
    const [comprasPendientes, setComprasPendientes] = useState([])
    const [imputaciones, setImputaciones] = useState([])

    // Paso 2: Datos generales
    const [formData, setFormData] = useState({
        fecha: new Date().toISOString().split('T')[0],
        numero: "",
        observacion: '',
    })

    // Paso 2: Medios de Pago
    // Estructura: { metodo_pago_id, monto, cuenta_banco_id, cheque_id, detalle, ... }
    const [pagos, setPagos] = useState([])

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Constantes de clases
    const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
    const CLASES_INPUT = "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
    const CLASES_TARJETA = "bg-white border border-slate-200 rounded-md p-4"
    const CLASES_BOTON_SECUNDARIO = "px-6 py-3 rounded-lg font-semibold shadow transition-all duration-200 bg-slate-200 text-slate-700 hover:bg-slate-300"

    // Totales
    const montoImputaciones = imputaciones.reduce((total, imp) => total + (parseFloat(imp.monto) || 0), 0)
    const montoPagos = pagos.reduce((total, p) => total + (parseFloat(p.monto) || 0), 0)

    // Cargar datos iniciales
    const cargarDatos = useCallback(async () => {
        try {
            setLoading(true)
            const [compras, metodos, cuentas, cheques] = await Promise.all([
                getComprasPendientes(proveedor.id),
                getMetodosPago(),
                getCuentasBanco(),
                getChequesEnCartera()
            ])

            setComprasPendientes(compras.compras_pendientes || [])
            setMetodosPago(Array.isArray(metodos) ? metodos : metodos.results || [])
            setCuentasBanco(Array.isArray(cuentas) ? cuentas : cuentas.results || [])
            setChequesCartera(Array.isArray(cheques) ? cheques : cheques.results || [])

        } catch (err) {
            console.error('Error al cargar datos:', err)
            setError('Error al cargar datos iniciales')
        } finally {
            setLoading(false)
        }
    }, [proveedor, getComprasPendientes, getMetodosPago, getCuentasBanco, getChequesEnCartera])

    useEffect(() => {
        if (abierto && proveedor) {
            cargarDatos()
            resetearFormulario()
        }
    }, [abierto, proveedor, cargarDatos])

    // Inicializar imputaciones
    useEffect(() => {
        if (comprasPendientes.length > 0) {
            setImputaciones(comprasPendientes.map(compra => ({
                compra_id: compra.compra_id,
                numero: compra.numero_factura,
                fecha: compra.fecha,
                monto_original: compra.total,
                saldo_pendiente: compra.saldo_pendiente,
                monto: 0
            })))
        } else {
            setImputaciones([])
        }
    }, [comprasPendientes])

    const resetearFormulario = () => {
        setPaso(1)
        setFormData({
            fecha: new Date().toISOString().split('T')[0],
            numero: "",
            observacion: '',
        })
        setPagos([]) // Se inicializará con 1 pago efectivo al avanzar o manual
        setError('')
    }

    const handleImputacionChange = (compraId, monto) => {
        setImputaciones(prev => prev.map(imp =>
            imp.compra_id === compraId
                ? { ...imp, monto: parseFloat(monto) || 0 }
                : imp
        ))
    }

    // Manejo de Pagos
    const agregarPago = () => {
        // Buscar metodo efectivo por defecto
        const efectivo = metodosPago.find(m => m.codigo === 'EFECTIVO')
        setPagos(prev => [...prev, {
            metodo_pago_id: efectivo ? efectivo.id : '',
            codigo: efectivo ? efectivo.codigo : '',
            monto: 0,
            detalle: ''
        }])
    }

    const quitarPago = (index) => {
        setPagos(prev => prev.filter((_, i) => i !== index))
    }

    const actualizarPago = (index, campo, valor) => {
        setPagos(prev => prev.map((p, i) => {
            if (i !== index) return p

            const nuevoPago = { ...p, [campo]: valor }

            // Si cambia el método, actualizar el código también para condicionales
            if (campo === 'metodo_pago_id') {
                const metodo = metodosPago.find(m => String(m.id) === String(valor))
                const codigo = (metodo?.codigo || "").toUpperCase()
                nuevoPago.codigo = codigo

                // Limpiar campos específicos al cambiar método
                delete nuevoPago.cuenta_banco_id
                delete nuevoPago.cheque_id
                nuevoPago.monto = 0 // Reset monto por seguridad

                // Si es cheque, inicializar como terceros por defecto
                if (codigo === 'CHEQUE') {
                    nuevoPago.es_propio = false
                }
            }

            // Si es cheque propio, inicializar campos si no existen
            if (campo === 'es_propio' && valor === true) {
                nuevoPago.numero_cheque = ''
                nuevoPago.banco_emisor = ''
                nuevoPago.cuit_librador = ''
                nuevoPago.fecha_emision = new Date().toISOString().split('T')[0]
                nuevoPago.fecha_presentacion = new Date().toISOString().split('T')[0]
                nuevoPago.cheque_id = null
                nuevoPago.monto = 0
            } else if (campo === 'es_propio' && valor === false) {
                nuevoPago.cheque_id = null
                nuevoPago.monto = 0
            }

            // Si selecciona un cheque, asignar el monto automáticamente
            if (campo === 'cheque_id' && (nuevoPago.codigo === 'CHEQUE' && !nuevoPago.es_propio)) {
                const cheque = chequesCartera.find(c => String(c.id) === String(valor))
                if (cheque) {
                    nuevoPago.monto = parseFloat(cheque.monto)
                }
            }

            return nuevoPago
        }))
    }

    const handlePaso1Aceptar = () => {
        // Si no hay pagos, agregar uno por defecto (Efectivo) con el monto total
        if (pagos.length === 0) {
            const efectivo = metodosPago.find(m => m.codigo === 'EFECTIVO')
            if (efectivo) {
                setPagos([{
                    metodo_pago_id: efectivo.id,
                    codigo: efectivo.codigo,
                    monto: montoImputaciones,
                    detalle: ''
                }])
            } else {
                // Fallback si no carga efectivo
                setPagos([{ metodo_pago_id: '', monto: montoImputaciones }])
            }
        } else if (pagos.length === 1 && pagos[0].monto === 0) {
            // Si hay uno vacío, autocompletar
            setPagos(prev => [{ ...prev[0], monto: montoImputaciones }])
        }
        setPaso(2)
    }

    const handleGuardar = async () => {
        if (montoPagos <= 0) {
            setError('El monto total debe ser mayor a 0')
            return
        }
        if (montoImputaciones > montoPagos) {
            setError('El monto imputado no puede ser mayor al total pagado')
            return
        }

        // Validaciones específicas de pagos
        for (const p of pagos) {
            if (!p.metodo_pago_id) {
                setError('Debe seleccionar el método de pago para todos los items')
                return
            }
            if ((p.codigo || "").toUpperCase() === 'TRANSFERENCIA' && !p.cuenta_banco_id) {
                setError('Debe seleccionar la cuenta bancaria para las transferencias')
                return
            }
            if ((p.codigo || "").toUpperCase() === 'CHEQUE') {
                if (!p.es_propio && !p.cheque_id) {
                    setError('Debe seleccionar el cheque de terceros')
                    return
                }
                if (p.es_propio) {
                    if (!p.numero_cheque || !p.banco_emisor || !p.cuit_librador || !p.fecha_emision || !p.fecha_presentacion) {
                        setError('Debe completar todos los datos del cheque propio')
                        return
                    }
                    if (p.cuit_librador.length !== 11) {
                        setError('El CUIT debe tener 11 dígitos')
                        return
                    }
                }
            }
        }

        setLoading(true)
        setError('')
        try {
            const ordenData = {
                proveedor_id: proveedor.id,
                fecha: formData.fecha,
                numero: formData.numero,
                observacion: formData.observacion,
                total: montoPagos,
                pagos: pagos.filter(p => p.monto > 0),
                imputaciones: imputaciones
                    .filter(imp => imp.monto > 0)
                    .map(imp => ({
                        compra_id: imp.compra_id,
                        monto: imp.monto,
                        observacion: ''
                    }))
            }

            await crearOrdenPago(ordenData)
            onGuardar()
        } catch (err) {
            setError(err.message || 'Error al guardar orden de pago')
        } finally {
            setLoading(false)
        }
    }

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
                    <div className="fixed inset-0 bg-black/60" />
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
                        <Dialog.Panel className="w-full max-w-5xl bg-white rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                            {/* Header */}
                            <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}>
                                <Dialog.Title className="text-lg font-bold text-white">
                                    Nueva Orden de Pago - {proveedor?.razon}
                                </Dialog.Title>
                                <button onClick={onClose} className="text-slate-200 hover:text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Contenido Scrollable */}
                            <div className="px-6 py-4 overflow-y-auto flex-1">

                                {/* PASO 1: IMPUTACIONES */}
                                {paso === 1 && (
                                    <div className="space-y-4">
                                        <div className={CLASES_TARJETA}>
                                            <h3 className="font-semibold text-slate-800 mb-2">Paso 1: Seleccionar facturas a pagar</h3>
                                            <p className="text-sm text-slate-600">Ingrese el monto a pagar para cada factura pendiente.</p>
                                        </div>

                                        {comprasPendientes.length === 0 ? (
                                            <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200">
                                                <p className="text-slate-500">No hay facturas pendientes. Se generará un pago a cuenta (saldo a favor).</p>
                                            </div>
                                        ) : (
                                            <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                                                <table className="w-full">
                                                    <thead className="bg-slate-50 border-b border-slate-200">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Comp.</th>
                                                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Saldo</th>
                                                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">A Pagar</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {imputaciones.map(imp => (
                                                            <tr key={imp.compra_id} className={imp.monto > 0 ? "bg-orange-50" : ""}>
                                                                <td className="px-4 py-2 text-sm text-slate-700">
                                                                    {new Date(imp.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                                                                </td>
                                                                <td className="px-4 py-2 text-sm text-slate-700">{imp.numero}</td>
                                                                <td className="px-4 py-2 text-sm text-right text-slate-700">
                                                                    ${parseFloat(imp.saldo_pendiente).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="px-4 py-2 text-right">
                                                                    <input
                                                                        type="number"
                                                                        className="w-24 border border-slate-300 rounded px-2 py-1 text-right text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                        value={imp.monto}
                                                                        min="0"
                                                                        max={imp.saldo_pendiente}
                                                                        onChange={(e) => handleImputacionChange(imp.compra_id, e.target.value)}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                        <div className="flex justify-end p-2 bg-slate-100 rounded">
                                            <span className="font-bold text-slate-700 mr-2">Total Imputado:</span>
                                            <span className="font-bold text-orange-600 text-lg">${montoImputaciones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                )}

                                {/* PASO 2: DATOS Y PAGOS */}
                                {paso === 2 && (
                                    <div className="space-y-4">
                                        <div className={CLASES_TARJETA}>
                                            <h3 className="font-semibold text-slate-800 mb-4">Paso 2: Datos de la Orden de Pago</h3>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className={CLASES_ETIQUETA}>Fecha</label>
                                                    <input
                                                        type="date"
                                                        className={CLASES_INPUT}
                                                        value={formData.fecha}
                                                        onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={CLASES_ETIQUETA}>Número Orden de Pago</label>
                                                    <input
                                                        type="text"
                                                        className={`${CLASES_INPUT} bg-slate-100 font-mono`}
                                                        value={formData.numero || 'Auto-generado'}
                                                        readOnly
                                                        placeholder="0001-00000001"
                                                    />
                                                    <p className="text-[10px] text-slate-500 mt-1 italic">Este número se asigna automáticamente al guardar.</p>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className={CLASES_ETIQUETA}>Observación</label>
                                                    <input
                                                        type="text"
                                                        className={CLASES_INPUT}
                                                        value={formData.observacion}
                                                        placeholder="Opcional..."
                                                        onChange={(e) => setFormData({ ...formData, observacion: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className={CLASES_TARJETA}>
                                            <div className="flex justify-between items-center mb-2">
                                                <h3 className="font-semibold text-slate-800">Medios de Pago</h3>
                                                <button type="button" onClick={agregarPago} className="text-xs text-orange-600 font-semibold hover:text-orange-700">+ Agregar Medio</button>
                                            </div>

                                            <div className="space-y-2">
                                                {pagos.map((pago, idx) => (
                                                    <div key={idx} className="flex flex-col md:flex-row gap-2 items-start bg-slate-50 p-2 rounded border border-slate-200 relative">
                                                        <div className="w-full md:w-1/4">
                                                            <label className={CLASES_ETIQUETA}>Tipo</label>
                                                            <select
                                                                className={CLASES_INPUT}
                                                                value={pago.metodo_pago_id}
                                                                onChange={(e) => actualizarPago(idx, 'metodo_pago_id', e.target.value)}
                                                            >
                                                                <option value="">Seleccione...</option>
                                                                {metodosPago.map(m => (
                                                                    <option key={m.id} value={m.id}>{m.nombre}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {/* Condicionales según tipo */}
                                                        {(pago.codigo || "").toUpperCase() === 'TRANSFERENCIA' && (
                                                            <div className="w-full md:w-1/3">
                                                                <label className={CLASES_ETIQUETA}>Cuenta Origen</label>
                                                                <select
                                                                    className={CLASES_INPUT}
                                                                    value={pago.cuenta_banco_id || ''}
                                                                    onChange={(e) => actualizarPago(idx, 'cuenta_banco_id', e.target.value)}
                                                                >
                                                                    <option value="">Seleccione cuenta...</option>
                                                                    {cuentasBanco.map(c => (
                                                                        <option key={c.id} value={c.id}>{c.banco} - {c.numero}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}

                                                        {(pago.codigo || "").toUpperCase() === 'CHEQUE' && (
                                                            <div className="w-full md:w-1/2 flex flex-col gap-2">
                                                                <div className="flex items-center justify-between">
                                                                    <label className={CLASES_ETIQUETA}>Datos del Cheque</label>
                                                                    <div className="flex bg-slate-200 p-0.5 rounded text-[9px] font-bold border border-slate-300">
                                                                        <button
                                                                            type="button"
                                                                            className={`px-2 py-0.5 rounded ${!pago.es_propio ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}
                                                                            onClick={() => actualizarPago(idx, 'es_propio', false)}
                                                                        >TERCEROS</button>
                                                                        <button
                                                                            type="button"
                                                                            className={`px-2 py-0.5 rounded ${pago.es_propio ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}
                                                                            onClick={() => actualizarPago(idx, 'es_propio', true)}
                                                                        >PROPIO</button>
                                                                    </div>
                                                                </div>

                                                                {!pago.es_propio ? (
                                                                    <select
                                                                        className={CLASES_INPUT}
                                                                        value={pago.cheque_id || ''}
                                                                        onChange={(e) => actualizarPago(idx, 'cheque_id', e.target.value)}
                                                                    >
                                                                        <option value="">Seleccione cheque...</option>
                                                                        {chequesCartera.map(c => (
                                                                            <option key={c.id} value={c.id}>
                                                                                ${parseFloat(c.monto).toLocaleString()} - #{c.numero} - {c.banco_emisor}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                ) : (
                                                                    <div className="grid grid-cols-2 gap-2 p-2 bg-white border border-slate-200 rounded-md shadow-inner">
                                                                        <div className="col-span-2 md:col-span-1">
                                                                            <input
                                                                                placeholder="N° Cheque"
                                                                                className="text-xs w-full border border-slate-200 rounded px-2 py-1"
                                                                                value={pago.numero_cheque || ''}
                                                                                onChange={(e) => actualizarPago(idx, 'numero_cheque', e.target.value)}
                                                                            />
                                                                        </div>
                                                                        <div className="col-span-2 md:col-span-1">
                                                                            <input
                                                                                placeholder="Banco"
                                                                                className="text-xs w-full border border-slate-200 rounded px-2 py-1"
                                                                                value={pago.banco_emisor || ''}
                                                                                onChange={(e) => actualizarPago(idx, 'banco_emisor', e.target.value)}
                                                                            />
                                                                        </div>
                                                                        <div className="col-span-2 md:col-span-1">
                                                                            <input
                                                                                placeholder="CUIT Librador"
                                                                                className="text-xs w-full border border-slate-200 rounded px-2 py-1"
                                                                                value={pago.cuit_librador || ''}
                                                                                onChange={(e) => actualizarPago(idx, 'cuit_librador', e.target.value.replace(/\D/g, ''))}
                                                                            />
                                                                        </div>
                                                                        <div className="col-span-2 md:col-span-1 text-[8px] flex items-center text-slate-400">
                                                                            11 dígitos sin guiones
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[8px] text-slate-500 uppercase font-bold block">F. Emisión</label>
                                                                            <input
                                                                                type="date"
                                                                                className="text-xs w-full border border-slate-200 rounded px-1 py-1"
                                                                                value={pago.fecha_emision || ''}
                                                                                onChange={(e) => actualizarPago(idx, 'fecha_emision', e.target.value)}
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[8px] text-slate-500 uppercase font-bold block">F. Pago</label>
                                                                            <input
                                                                                type="date"
                                                                                className="text-xs w-full border border-slate-200 rounded px-1 py-1"
                                                                                value={pago.fecha_presentacion || ''}
                                                                                onChange={(e) => actualizarPago(idx, 'fecha_presentacion', e.target.value)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="w-full md:w-1/4">
                                                            <label className={CLASES_ETIQUETA}>Monto</label>
                                                            <input
                                                                type="number"
                                                                className={`${CLASES_INPUT} ${(pago.codigo || "").toUpperCase() === 'CHEQUE' && !pago.es_propio ? 'bg-gray-100' : ''}`}
                                                                value={pago.monto}
                                                                readOnly={(pago.codigo || "").toUpperCase() === 'CHEQUE' && !pago.es_propio}
                                                                onChange={(e) => actualizarPago(idx, 'monto', parseFloat(e.target.value) || 0)}
                                                            />
                                                        </div>

                                                        <div className="flex-1">
                                                            <label className={CLASES_ETIQUETA}>Detalle (Opcional)</label>
                                                            <input
                                                                type="text"
                                                                className={CLASES_INPUT}
                                                                value={pago.detalle || ''}
                                                                placeholder={(pago.codigo || "").toUpperCase() === 'CHEQUE' ? 'Auto-completado' : 'Observación...'}
                                                                onChange={(e) => actualizarPago(idx, 'detalle', e.target.value)}
                                                            />
                                                        </div>

                                                        {/* Botón eliminar */}
                                                        <button
                                                            onClick={() => quitarPago(idx)}
                                                            className="mt-6 text-red-500 hover:text-red-700"
                                                            title="Quitar pago"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))}
                                                {pagos.length === 0 && (
                                                    <div className="text-center p-4 text-slate-500 italic">No hay pagos agregados</div>
                                                )}
                                            </div>

                                            <div className="flex justify-between mt-4 pt-2 border-t border-slate-200">
                                                <div>
                                                    <div className="text-xs text-slate-500">Total Imputado: ${montoImputaciones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-bold text-slate-700">Total a Pagar:</div>
                                                    <div className={`text-xl font-bold ${montoPagos < montoImputaciones ? 'text-red-600' : 'text-green-600'}`}>
                                                        ${montoPagos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                    </div>
                                                    {montoPagos > montoImputaciones && (
                                                        <div className="text-xs text-green-600 mt-1">Saldo a favor: ${(montoPagos - montoImputaciones).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Mensajes Error */}
                                {error && (
                                    <div className="bg-red-50 text-red-700 p-3 rounded text-sm mt-4 border border-red-200">
                                        {error}
                                    </div>
                                )}

                            </div>

                            {/* Footer acciones */}
                            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-between">

                                {paso === 2 ? (
                                    <button onClick={() => setPaso(1)} className={CLASES_BOTON_SECUNDARIO}>
                                        ← Volver
                                    </button>
                                ) : (
                                    <div></div> // Spacer
                                )}

                                <div className="flex gap-2">
                                    <button onClick={onClose} className={CLASES_BOTON_SECUNDARIO}>Cancelar</button>
                                    {paso === 1 ? (
                                        <button onClick={handlePaso1Aceptar} className={theme.botonPrimario}>Continuar →</button>
                                    ) : (
                                        <button
                                            onClick={handleGuardar}
                                            disabled={loading}
                                            className={`${theme.botonPrimario} ${loading ? 'opacity-70' : ''}`}
                                        >
                                            {loading ? 'Guardando...' : 'Confirmar Orden de Pago'}
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

export default OrdenPagoModal
