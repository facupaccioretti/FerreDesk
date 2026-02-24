"use client"

import { useState, useMemo } from "react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

/**
 * Modal para cerrar la caja (Cierre Z).
 * Muestra el resumen y solicita el saldo declarado.
 */
const ModalCerrarCaja = ({ sesion, resumen, onConfirmar, onCancelar, loading }) => {
    const theme = useFerreDeskTheme()
    const [saldoDeclarado, setSaldoDeclarado] = useState('')
    const [observaciones, setObservaciones] = useState('')
    const [error, setError] = useState('')

    // Calcular saldo teórico
    const saldoTeorico = useMemo(() => {
        return parseFloat(resumen?.saldo_teorico_efectivo) || 0
    }, [resumen?.saldo_teorico_efectivo])

    // Calcular diferencia
    const diferencia = useMemo(() => {
        const declarado = parseFloat(saldoDeclarado) || 0
        return declarado - saldoTeorico
    }, [saldoDeclarado, saldoTeorico])

    // Formatear moneda
    const formatMoney = (value) => {
        const num = parseFloat(value) || 0
        return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const [mostrarConfirmacionFinal, setMostrarConfirmacionFinal] = useState(false)

    const handleSubmit = (e) => {
        e.preventDefault()

        // Validar
        const monto = parseFloat(saldoDeclarado)
        if (isNaN(monto) || monto < 0) {
            setError('Ingrese un monto válido (0 o mayor)')
            return
        }

        setError('')
        // Mostrar confirmación final antes de cerrar
        setMostrarConfirmacionFinal(true)
    }

    const handleConfirmarFinal = () => {
        const monto = parseFloat(saldoDeclarado)
        onConfirmar(monto.toFixed(2), observaciones)
    }

    const handleMontoChange = (e) => {
        const value = e.target.value
        if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
            setSaldoDeclarado(value)
            setError('')
        }
    }

    const hayExcedentes = (parseFloat(resumen?.excedente_no_facturado_propina) > 0 || parseFloat(resumen?.vuelto_pendiente) > 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancelar} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] mx-2 flex flex-col overflow-hidden">
                {/* Header compacto */}
                <div className={`bg-gradient-to-r ${theme.primario} px-4 py-2.5 flex-shrink-0`}>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Cierre Z — Cerrar Caja
                    </h3>
                </div>

                {/* Body con scroll */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                        {/* Aviso Cierre X vs Z */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                            <p className="font-medium">¿Ya controlaste la caja con un Cierre X?</p>
                            <p className="mt-0.5 text-amber-700">El Cierre X te muestra los números sin cerrar. Una vez hecho el Z, no hay vuelta atrás.</p>
                        </div>

                        {/* Resumen compacto */}
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <h4 className="text-xs font-semibold text-slate-600 mb-2">Resumen de la sesión</h4>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                <div><span className="text-slate-500">Saldo inicial:</span><span className="ml-1 font-medium text-slate-700">${formatMoney(resumen?.saldo_inicial)}</span></div>
                                <div><span className="text-slate-500">Ingresos manuales:</span><span className="ml-1 font-medium text-green-600">+${formatMoney(resumen?.total_ingresos_manuales)}</span></div>
                                <div><span className="text-slate-500">Egresos manuales:</span><span className="ml-1 font-medium text-red-600">−${formatMoney(resumen?.total_egresos_manuales)}</span></div>
                                {hayExcedentes && (
                                    <>
                                        {parseFloat(resumen?.excedente_no_facturado_propina) > 0 && (
                                            <div><span className="text-slate-500">Propina/redondeo:</span><span className="ml-1 font-medium text-slate-700">${formatMoney(resumen.excedente_no_facturado_propina)}</span></div>
                                        )}
                                        {parseFloat(resumen?.vuelto_pendiente) > 0 && (
                                            <div><span className="text-slate-500">Vuelto pend.:</span><span className="ml-1 font-medium text-slate-700">${formatMoney(resumen.vuelto_pendiente)}</span></div>
                                        )}
                                    </>
                                )}
                                <div className="col-span-2 pt-1.5 mt-1 border-t border-slate-200">
                                    <span className="text-slate-700 font-medium">Saldo teórico:</span>
                                    <span className="ml-1 font-bold text-amber-600">${formatMoney(saldoTeorico)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Saldo declarado */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Saldo final contado</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={saldoDeclarado}
                                    onChange={handleMontoChange}
                                    placeholder="0.00"
                                    autoFocus
                                    className={`w-full pl-7 pr-3 py-2 text-lg font-semibold rounded-lg border text-right focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${error ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                                />
                            </div>
                            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                        </div>

                        {/* Diferencia */}
                        {saldoDeclarado && (
                            <div className={`p-3 rounded-lg border text-xs ${diferencia === 0 ? 'bg-green-50 border-green-200' : diferencia > 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-slate-700">Diferencia:</span>
                                    <span className={`font-bold ${diferencia === 0 ? 'text-green-600' : diferencia > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                        {diferencia >= 0 ? '+' : ''}{formatMoney(diferencia)}
                                    </span>
                                </div>
                                <p className="text-slate-500 mt-0.5">
                                    {diferencia === 0 ? '✓ La caja cuadra' : diferencia > 0 ? 'Sobrante en caja' : 'Faltante en caja'}
                                </p>
                            </div>
                        )}

                        {/* Observaciones */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Observaciones (opcional)</label>
                            <textarea
                                value={observaciones}
                                onChange={(e) => setObservaciones(e.target.value)}
                                placeholder="Notas sobre el cierre..."
                                rows={2}
                                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                            />
                        </div>
                    </div>

                    {/* Botones fijos abajo */}
                    <div className="flex gap-2 p-4 pt-2 border-t border-slate-200 flex-shrink-0">
                        <button type="button" onClick={onCancelar} disabled={loading}
                            className="flex-1 px-3 py-2 text-sm text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 font-medium">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading || !saldoDeclarado}
                            className={`flex-1 py-2 text-sm ${theme.botonPrimario} disabled:opacity-50 disabled:cursor-not-allowed font-medium`}>
                            Continuar
                        </button>
                    </div>
                </form>

                {/* Confirmación final */}
                {mostrarConfirmacionFinal && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                        <div className="w-full max-w-sm">
                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <svg className="w-10 h-10 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-base font-bold text-red-800 mb-1">Confirmación Cierre Z</h4>
                                        <p className="text-xs text-red-700 mb-2 font-medium"></p>
                                        <p className="text-xs text-red-700 mb-3"></p>
                                        <ul className="text-xs text-red-600 space-y-1 mb-3">
                                            <li>• Este proceso es <strong>irreversible</strong>.</li>
                                            <li>• La caja se cerrará y no podrá seguir operando.</li>
                                            <li>• Verifique que no queden comprobantes pendientes.</li>
                                        </ul>
                                        <div className="flex gap-2">
                                            <button onClick={() => setMostrarConfirmacionFinal(false)}
                                                className="flex-1 px-3 py-2 text-xs text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium">
                                                Volver
                                            </button>
                                            <button onClick={handleConfirmarFinal} disabled={loading}
                                                className={`flex-1 py-2 text-xs ${theme.botonPrimario} disabled:opacity-50 font-medium`}>
                                                {loading ? <> <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Cerrando... </> : 'Sí, Cerrar Caja (Z)'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ModalCerrarCaja
