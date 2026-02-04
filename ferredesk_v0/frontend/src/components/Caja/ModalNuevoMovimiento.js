"use client"

import { useState } from "react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

/**
 * Modal para registrar un nuevo movimiento de caja (ingreso o egreso).
 */
const ModalNuevoMovimiento = ({ tipo, onConfirmar, onCancelar, loading }) => {
    const theme = useFerreDeskTheme()
    const [monto, setMonto] = useState('')
    const [descripcion, setDescripcion] = useState('')
    const [error, setError] = useState('')

    const esIngreso = tipo === 'ENTRADA'
    const titulo = esIngreso ? 'Registrar Ingreso' : 'Registrar Egreso'
    const subtitulo = esIngreso
        ? 'Dinero que entra a la caja (ej: fondo adicional, cobro externo)'
        : 'Dinero que sale de la caja (ej: pago a proveedor, retiro parcial)'

    const handleSubmit = (e) => {
        e.preventDefault()

        // Validar monto
        const montoNum = parseFloat(monto)
        if (isNaN(montoNum) || montoNum <= 0) {
            setError('Ingrese un monto válido mayor a 0')
            return
        }

        // Validar descripción
        if (!descripcion.trim()) {
            setError('Ingrese una descripción')
            return
        }

        setError('')
        onConfirmar(montoNum.toFixed(2), descripcion.trim())
    }

    const handleMontoChange = (e) => {
        const value = e.target.value
        if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
            setMonto(value)
            setError('')
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onCancelar}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className={`bg-gradient-to-r ${theme.primario} px-6 py-4`}>
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        {esIngreso ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M12 4v16m0-16l-4 4m4-4l4 4" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M12 20V4m0 16l4-4m-4 4l-4-4" />
                            </svg>
                        )}
                        {titulo}
                    </h3>
                    <p className="text-white/80 text-sm mt-1">{subtitulo}</p>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6">
                    {/* Monto */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Monto
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                                $
                            </span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={monto}
                                onChange={handleMontoChange}
                                placeholder="0.00"
                                autoFocus
                                className={`w-full pl-8 pr-4 py-3 text-xl font-semibold rounded-lg border 
                           focus:ring-2 focus:ring-orange-500 focus:border-orange-500 
                           transition-colors text-right ${error && !monto ? 'border-red-300 bg-red-50' : 'border-slate-300'
                                    }`}
                            />
                        </div>
                    </div>

                    {/* Descripción */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Descripción
                        </label>
                        <input
                            type="text"
                            value={descripcion}
                            onChange={(e) => {
                                setDescripcion(e.target.value)
                                setError('')
                            }}
                            placeholder={esIngreso
                                ? "ej: Fondo adicional, Cobro cheque cliente..."
                                : "ej: Pago proveedor, Retiro para compras..."}
                            maxLength={200}
                            className={`w-full px-4 py-3 rounded-lg border 
                         focus:ring-2 focus:ring-orange-500 focus:border-orange-500 
                         transition-colors ${error && !descripcion ? 'border-red-300 bg-red-50' : 'border-slate-300'
                                }`}
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    {/* Botones */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onCancelar}
                            disabled={loading}
                            className="flex-1 px-4 py-3 text-slate-700 bg-slate-100 rounded-lg 
                         hover:bg-slate-200 transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !monto || !descripcion}
                            className={`flex-1 ${theme.botonPrimario} disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white 
                                  rounded-full animate-spin" />
                                    Registrando...
                                </>
                            ) : (
                                <>Registrar {esIngreso ? 'Ingreso' : 'Egreso'}</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default ModalNuevoMovimiento
