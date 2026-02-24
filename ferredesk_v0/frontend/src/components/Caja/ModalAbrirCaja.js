"use client"

import { useState } from "react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

/**
 * Modal para abrir una nueva caja.
 * Solicita el saldo inicial declarado.
 */
const ModalAbrirCaja = ({ onConfirmar, onCancelar, loading }) => {
    const theme = useFerreDeskTheme()
    const [saldoInicial, setSaldoInicial] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()

        // Validar
        const monto = parseFloat(saldoInicial)
        if (isNaN(monto) || monto < 0) {
            setError('Ingrese un monto válido (0 o mayor)')
            return
        }

        setError('')
        onConfirmar(monto.toFixed(2))
    }

    const handleMontoChange = (e) => {
        const value = e.target.value
        // Permitir solo números y un punto decimal
        if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
            setSaldoInicial(value)
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
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Abrir Caja
                    </h3>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Saldo Inicial
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                                $
                            </span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={saldoInicial}
                                onChange={handleMontoChange}
                                placeholder="0.00"
                                autoFocus
                                className={`w-full pl-8 pr-4 py-3 text-xl font-semibold rounded-lg border 
                           focus:ring-2 focus:ring-orange-500 focus:border-orange-500 
                           transition-colors text-right ${error ? 'border-red-300 bg-red-50' : 'border-slate-300'
                                    }`}
                            />
                        </div>
                        {error && (
                            <p className="mt-2 text-sm text-red-600">{error}</p>
                        )}
                        <p className="mt-2 text-sm text-slate-500">
                            Ingrese el monto de dinero que se encuentra físicamente en la caja al comenzar.
                        </p>
                    </div>

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
                            disabled={loading || !saldoInicial}
                            className={`flex-1 ${theme.botonPrimario} disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white 
                                  rounded-full animate-spin" />
                                    Abriendo...
                                </>
                            ) : (
                                'Abrir Caja'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default ModalAbrirCaja
