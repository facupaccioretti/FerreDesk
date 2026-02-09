"use client"

import { useState } from "react"

const ModalDepositarCheque = ({ cuentasBanco = [], onConfirmar, onCancelar, loading }) => {
  const [cuentaId, setCuentaId] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!cuentaId) {
      setError("Seleccione una cuenta de destino.")
      return
    }
    setError("")
    onConfirmar(Number(cuentaId))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancelar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-800 to-slate-700 text-white text-sm font-semibold">
          Depositar cheque
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>}
          <div className="space-y-1">
            <label className="text-xs text-slate-600 font-medium">Cuenta bancaria destino</label>
            <select
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={cuentaId}
              onChange={(e) => setCuentaId(e.target.value)}
            >
              <option value="">Seleccionar cuenta</option>
              {cuentasBanco.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}{c.alias ? ` (${c.alias})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCancelar} className="text-sm px-3 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="text-sm px-3 py-2 rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50">
              {loading ? "Guardando..." : "Depositar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ModalDepositarCheque
