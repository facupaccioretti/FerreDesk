"use client"

import { Fragment, useEffect, useState, useCallback } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { getCookie } from "../../utils/csrf"

/**
 * Modal para endosar cheques a un proveedor.
 * 
 * @param {Array} chequesSeleccionados - Cheques a endosar (desde ValoresEnCartera)
 * @param {Function} onConfirmar - Callback con proveedor_id
 * @param {Function} onCancelar - Callback para cerrar el modal
 * @param {boolean} loading - Si está procesando
 */
const ModalEndosarCheques = ({ chequesSeleccionados = [], onConfirmar, onCancelar, loading }) => {
    const theme = useFerreDeskTheme()
    
    // Estados para proveedores
    const [proveedores, setProveedores] = useState([])
    const [proveedorId, setProveedorId] = useState("")
    const [busquedaProveedor, setBusquedaProveedor] = useState("")
    const [cargandoProveedores, setCargandoProveedores] = useState(true)
    const [error, setError] = useState("")
    const [mostrarDetalleCheques, setMostrarDetalleCheques] = useState(false)

    // Cargar lista de proveedores
    const cargarProveedores = useCallback(async () => {
        setCargandoProveedores(true)
        try {
            const res = await fetch("/api/productos/proveedores/?page_size=500", {
                credentials: "include",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || data.error || "Error cargando proveedores")
            const lista = data?.results ?? (Array.isArray(data) ? data : [])
            setProveedores(lista)
        } catch (err) {
            console.error("Error cargando proveedores:", err)
            setError("No se pudieron cargar los proveedores.")
        } finally {
            setCargandoProveedores(false)
        }
    }, [])

    useEffect(() => {
        cargarProveedores()
    }, [cargarProveedores])

    // Filtrar proveedores por búsqueda
    const proveedoresFiltrados = proveedores.filter((p) => {
        const nombre = (p.razon || p.fantasia || "").toLowerCase()
        const cuit = (p.cuit || "").toLowerCase()
        const busqueda = busquedaProveedor.toLowerCase()
        return nombre.includes(busqueda) || cuit.includes(busqueda)
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        setError("")
        
        if (chequesSeleccionados.length === 0) {
            setError("No hay cheques seleccionados.")
            return
        }

        if (!proveedorId) {
            setError("Debe seleccionar un proveedor.")
            return
        }

        onConfirmar(Number(proveedorId))
    }

    // Calcular total de los cheques seleccionados
    const totalMonto = chequesSeleccionados.reduce((acc, c) => acc + (parseFloat(c.monto) || 0), 0)
    const formatearMoneda = (v) => {
        const num = parseFloat(v) || 0
        return num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
    const CLASES_INPUT = "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
    const CLASES_TARJETA = "bg-white border border-slate-200 rounded-md p-4"

    const estaAbierto = chequesSeleccionados.length > 0

    return (
        <Transition show={estaAbierto} as={Fragment} appear>
            <Dialog as="div" className="relative z-50" onClose={onCancelar}>
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
                        <Dialog.Panel className="w-full max-w-xl bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">
                            <div
                                className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}
                            >
                                <Dialog.Title className="text-lg font-bold text-white">
                                    Endosar cheques
                                </Dialog.Title>
                                <button
                                    type="button"
                                    onClick={onCancelar}
                                    className="text-slate-200 hover:text-white transition-colors"
                                    aria-label="Cerrar"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={1.5}
                                        stroke="currentColor"
                                        className="w-6 h-6"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                                {error && (
                                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
                                )}

                                {/* Resumen de cheques con dropdown */}
                                <div className={CLASES_TARJETA}>
                                    <div className="flex items-center justify-between">
                                        <div className={CLASES_ETIQUETA}>Cheques a endosar</div>
                                        <button
                                            type="button"
                                            onClick={() => setMostrarDetalleCheques(!mostrarDetalleCheques)}
                                            className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1"
                                        >
                                            {mostrarDetalleCheques ? (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                                                    </svg>
                                                    Ocultar
                                                </>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                                    </svg>
                                                    Ver detalle
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-sm font-medium text-slate-800">
                                            {chequesSeleccionados.length} cheque{chequesSeleccionados.length !== 1 ? "s" : ""}
                                        </span>
                                        <span className="text-sm font-semibold text-orange-600">
                                            ${formatearMoneda(totalMonto)}
                                        </span>
                                    </div>
                                    {mostrarDetalleCheques && chequesSeleccionados.length > 0 && (
                                        <div className="mt-2 max-h-32 overflow-y-auto text-xs text-slate-600 space-y-1 border-t border-slate-200 pt-2">
                                            {chequesSeleccionados.map((c) => (
                                                <div key={c.id} className="flex justify-between py-1">
                                                    <span>#{c.numero} - {c.banco_emisor}</span>
                                                    <span className="font-medium">${formatearMoneda(c.monto)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Selector de proveedor */}
                                <div className={CLASES_TARJETA}>
                                    <label className={CLASES_ETIQUETA}>Proveedor destino</label>
                                    <input
                                        type="text"
                                        placeholder="Buscar proveedor..."
                                        value={busquedaProveedor}
                                        onChange={(e) => setBusquedaProveedor(e.target.value)}
                                        className={`${CLASES_INPUT} mt-1`}
                                    />
                                    {cargandoProveedores ? (
                                        <div className="text-xs text-slate-500 py-2 mt-1">Cargando proveedores...</div>
                                    ) : proveedoresFiltrados.length === 0 ? (
                                        <div className="text-xs text-slate-500 py-2 mt-1">
                                            {busquedaProveedor ? "No se encontraron proveedores con ese criterio." : "No hay proveedores disponibles."}
                                        </div>
                                    ) : (
                                        <select
                                            className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 mt-1"
                                            value={proveedorId}
                                            onChange={(e) => {
                                                setProveedorId(e.target.value)
                                                setError("")
                                            }}
                                            size={Math.min(proveedoresFiltrados.length + 1, 12)}
                                            style={{ minHeight: '200px' }}
                                        >
                                            <option value="">Seleccionar proveedor</option>
                                            {proveedoresFiltrados.map((p) => {
                                                const nombre = p.razon || p.fantasia || "Sin nombre"
                                                const cuit = p.cuit || ""
                                                return (
                                                    <option key={p.id} value={p.id}>
                                                        {nombre}{cuit ? ` - CUIT: ${cuit}` : ""}
                                                    </option>
                                                )
                                            })}
                                        </select>
                                    )}
                                </div>

                                {/* Botones */}
                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                                    <button
                                        type="button"
                                        onClick={onCancelar}
                                        className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || cargandoProveedores}
                                        className={`px-4 py-2 rounded-lg font-medium text-sm ${theme.botonPrimario} disabled:opacity-50`}
                                    >
                                        {loading ? "Procesando..." : "Endosar"}
                                    </button>
                                </div>
                            </form>
                        </Dialog.Panel>
                    </div>
                </Transition.Child>
            </Dialog>
        </Transition>
    )
}

export default ModalEndosarCheques
