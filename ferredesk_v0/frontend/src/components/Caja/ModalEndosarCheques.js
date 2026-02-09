"use client"

import { useEffect, useState, useCallback } from "react"
import { getCookie } from "../../utils/csrf"

/**
 * Modal para endosar cheques a un proveedor.
 * Fase 6: Permite seleccionar un proveedor y confirmar el endoso de los cheques seleccionados.
 * 
 * @param {Array} chequesSeleccionados - Cheques a endosar (desde ValoresEnCartera)
 * @param {Function} onConfirmar - Callback con proveedor_id
 * @param {Function} onCancelar - Callback para cerrar el modal
 * @param {boolean} loading - Si está procesando
 */
const ModalEndosarCheques = ({ chequesSeleccionados = [], onConfirmar, onCancelar, loading }) => {
    const [proveedores, setProveedores] = useState([])
    const [proveedorId, setProveedorId] = useState("")
    const [busquedaProveedor, setBusquedaProveedor] = useState("")
    const [cargandoProveedores, setCargandoProveedores] = useState(true)
    const [error, setError] = useState("")

    // Cargar lista de proveedores al montar
    const cargarProveedores = useCallback(async () => {
        setCargandoProveedores(true)
        try {
            const res = await fetch("/api/productos/proveedores/?page_size=500", {
                credentials: "include",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || data.error || "Error cargando proveedores")
            // El endpoint puede devolver {results: [...]} o un array directo
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
        const nombre = (p.nombre || p.razon_social || "").toLowerCase()
        return nombre.includes(busquedaProveedor.toLowerCase())
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!proveedorId) {
            setError("Debe seleccionar un proveedor.")
            return
        }
        if (chequesSeleccionados.length === 0) {
            setError("No hay cheques seleccionados.")
            return
        }
        setError("")
        onConfirmar(Number(proveedorId))
    }

    // Calcular total de los cheques seleccionados
    const totalMonto = chequesSeleccionados.reduce((acc, c) => acc + (parseFloat(c.monto) || 0), 0)
    const formatearMoneda = (v) => {
        const num = parseFloat(v) || 0
        return num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancelar} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-indigo-700 to-indigo-600 text-white text-sm font-semibold">
                    Endosar cheques a proveedor
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {error && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>
                    )}

                    {/* Resumen de cheques */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">Cheques a endosar</div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-800">
                                {chequesSeleccionados.length} cheque{chequesSeleccionados.length !== 1 ? "s" : ""}
                            </span>
                            <span className="text-sm font-semibold text-indigo-700">
                                ${formatearMoneda(totalMonto)}
                            </span>
                        </div>
                        {chequesSeleccionados.length > 0 && (
                            <div className="mt-2 max-h-24 overflow-y-auto text-xs text-slate-600 space-y-0.5">
                                {chequesSeleccionados.map((c) => (
                                    <div key={c.id} className="flex justify-between">
                                        <span>#{c.numero} - {c.banco_emisor}</span>
                                        <span>${formatearMoneda(c.monto)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Selector de proveedor */}
                    <div className="space-y-2">
                        <label className="text-xs text-slate-600 font-medium">Proveedor destino</label>

                        {/* Buscador */}
                        <input
                            type="text"
                            placeholder="Buscar proveedor..."
                            value={busquedaProveedor}
                            onChange={(e) => setBusquedaProveedor(e.target.value)}
                            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />

                        {/* Select */}
                        {cargandoProveedores ? (
                            <div className="text-xs text-slate-500 py-2">Cargando proveedores...</div>
                        ) : (
                            <select
                                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                value={proveedorId}
                                onChange={(e) => setProveedorId(e.target.value)}
                                size={Math.min(proveedoresFiltrados.length + 1, 6)}
                            >
                                <option value="">Seleccionar proveedor</option>
                                {proveedoresFiltrados.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.nombre || p.razon_social} {p.cuit ? `(${p.cuit})` : ""}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Botones */}
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onCancelar}
                            className="text-sm px-3 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || cargandoProveedores}
                            className="text-sm px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading ? "Procesando..." : "Endosar"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default ModalEndosarCheques
