"use client"

import { useState, useEffect, useCallback } from "react"
import { useCajaAPI } from "../../utils/useCajaAPI"
import { X, TrendingUp, TrendingDown, DollarSign } from "lucide-react"
import Tabla from "../Tabla"

const ModalHistorialBanco = ({ banco, onCerrar }) => {
    const { obtenerHistorialBanco, loading } = useCajaAPI()

    const [data, setData] = useState({
        movimientos: [],
        total_ingresos: 0,
        total_egresos: 0,
        saldo_periodo: 0,
        rango: { desde: "", hasta: "" }
    })

    const [fechaDesde, setFechaDesde] = useState(() => {
        const fecha = new Date()
        fecha.setDate(fecha.getDate() - 30)
        return fecha.toLocaleDateString('en-CA')
    })

    const [fechaHasta, setFechaHasta] = useState(() => {
        return new Date().toLocaleDateString('en-CA')
    })

    const [error, setError] = useState(null)

    const cargarHistorial = useCallback(async () => {
        if (!banco?.id) return
        try {
            setError(null)
            const res = await obtenerHistorialBanco(banco.id, fechaDesde, fechaHasta)
            setData(res)
        } catch (err) {
            console.error("Error cargando historial:", err)
            setError("No se pudo cargar el historial del banco.")
        }
    }, [banco, fechaDesde, fechaHasta, obtenerHistorialBanco])

    useEffect(() => {
        cargarHistorial()
    }, [cargarHistorial])

    const columnas = [
        {
            id: "fecha",
            titulo: "Fecha",
            render: (m) => new Date(m.fecha).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })
        },
        {
            id: "tipo",
            titulo: "Tipo",
            align: "center",
            render: (m) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${m.tipo === 'INGRESO'
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                    {m.tipo}
                </span>
            )
        },
        {
            id: "monto",
            titulo: "Monto",
            align: "right",
            render: (m) => (
                <span className={`font-mono font-bold ${m.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
                    {m.tipo === 'INGRESO' ? '+' : '-'}${Number(m.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
            )
        },
        {
            id: "metodo_pago",
            titulo: "Medio",
            render: (m) => (
                <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200 uppercase">
                    {m.metodo_pago || "---"}
                </span>
            )
        },
        {
            id: "descripcion",
            titulo: "Descripción",
            render: (m) => <span className="text-xs font-medium text-slate-600 truncate max-w-sm block" title={m.descripcion}>{m.descripcion}</span>
        },
        {
            id: "comprobante",
            titulo: "Comprobante",
            render: (m) => (
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">{m.comprobante_tipo}</span>
                    <span className="text-xs font-mono">{m.comprobante_numero || "---"}</span>
                </div>
            )
        },
        {
            id: "origen",
            titulo: "Origen",
            render: (m) => <span className="text-[10px] text-slate-600 italic">{m.origen}</span>
        }
    ]

    const formatCurrency = (val) => Number(val).toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2
    })

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onCerrar} />

            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
                {/* Header */}
                <div className="px-4 py-2.5 border-b border-slate-200 bg-gradient-to-r from-slate-800 to-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30`}>
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-base leading-tight">Historial: {banco.nombre}</h3>
                            <p className="text-slate-400 text-[10px] font-medium leading-tight">
                                {banco.tipo_entidad === 'BCO' ? 'Banco' : 'Billetera Virtual'} • {banco.alias || 'Sin alias'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCerrar}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Filters & Summary */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        {/* Date Filters */}
                        <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Desde</label>
                                <input
                                    type="date"
                                    className="block text-xs border-none focus:ring-0 text-slate-700 bg-transparent p-0"
                                    value={fechaDesde}
                                    onChange={(e) => setFechaDesde(e.target.value)}
                                />
                            </div>
                            <div className="w-px h-6 bg-slate-200 mx-1" />
                            <div className="flex items-center gap-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Hasta</label>
                                <input
                                    type="date"
                                    className="block text-xs border-none focus:ring-0 text-slate-700 bg-transparent p-0"
                                    value={fechaHasta}
                                    onChange={(e) => setFechaHasta(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Metrics */}
                        <div className="flex items-center gap-3">
                            <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2.5 min-w-[130px]">
                                <div className="p-1.5 rounded-md bg-green-50 text-green-600">
                                    <TrendingUp className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Ingresos</p>
                                    <p className="text-[13px] font-bold text-green-600 leading-none">{formatCurrency(data.total_ingresos)}</p>
                                </div>
                            </div>

                            <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2.5 min-w-[130px]">
                                <div className="p-1.5 rounded-md bg-red-50 text-red-600">
                                    <TrendingDown className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Egresos</p>
                                    <p className="text-[13px] font-bold text-red-600 leading-none">{formatCurrency(data.total_egresos)}</p>
                                </div>
                            </div>

                            <div className="bg-slate-800 px-3 py-2 rounded-lg border border-slate-700 shadow-lg flex items-center gap-2.5 min-w-[150px] ring-1 ring-orange-500/20">
                                <div className="p-1.5 rounded-md bg-orange-500 text-white">
                                    <DollarSign className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Saldo Período</p>
                                    <p className="text-[13px] font-bold text-white leading-none">{formatCurrency(data.saldo_periodo)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-hidden p-4 flex flex-col">
                    {error ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-600 space-y-2">
                            <p className="font-bold">{error}</p>
                            <button
                                onClick={cargarHistorial}
                                className="text-sm text-slate-600 hover:text-orange-600 underline"
                            >
                                Reintentar
                            </button>
                        </div>
                    ) : (
                        <Tabla
                            columnas={columnas}
                            datos={data.movimientos}
                            cargando={loading}
                            mostrarOrdenamiento={true}
                            filasPorPaginaInicial={12}
                            filasCompactas={true}
                            tamañoEncabezado="pequeño"
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex justify-end">
                    <button
                        onClick={onCerrar}
                        className="px-5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg text-xs"
                    >
                        Cerrar Historial
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ModalHistorialBanco
