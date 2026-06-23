"use client"

import { useState } from "react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import CajaEstado from "./CajaEstado"
import CajaMovimientos from "./CajaMovimientos"
import ModalCierreX from "./ModalCierreX"
import ModalCerrarCaja from "./ModalCerrarCaja"
import ModalNuevoMovimiento from "./ModalNuevoMovimiento"
import ModalObservacionesCaja from "./ModalObservacionesCaja"

/**
 * Componente que muestra el contenido del tab "Caja Actual".
 * Contiene el estado de la caja abierta, movimientos y acciones disponibles.
 */
const CajaActualTab = ({
  sesion,
  resumen,
  movimientos,
  onRefrescar,
  onCerrarCaja,
  onNuevoMovimiento,
  loading,
  onIrValoresEnCartera,
}) => {
  const theme = useFerreDeskTheme()

  const [modalCierreXVisible, setModalCierreXVisible] = useState(false)
  const [modalCerrarVisible, setModalCerrarVisible] = useState(false)
  const [modalMovimientoVisible, setModalMovimientoVisible] = useState(false)
  const [modalObservacionesVisible, setModalObservacionesVisible] = useState(false)
  const [tipoMovimiento, setTipoMovimiento] = useState("ENTRADA")

  const abrirModalMovimiento = (tipo) => {
    setTipoMovimiento(tipo)
    setModalMovimientoVisible(true)
  }

  const handleNuevoMovimiento = async (monto, descripcion) => {
    await onNuevoMovimiento(tipoMovimiento, monto, descripcion)
    setModalMovimientoVisible(false)
  }

  const handleCerrarCaja = async (saldoDeclarado, observaciones) => {
    await onCerrarCaja(saldoDeclarado, observaciones)
    setModalCerrarVisible(false)
  }

  if (!sesion) {
    return (
      <div className="py-10 text-center">
        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-[#1e2d3d] mb-1">No hay caja abierta</h3>
        <p className="text-slate-500 text-xs">Para registrar ventas y movimientos, primero debe abrir una caja.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {/* Barra de acciones */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Acciones
          </span>
          <div className="flex flex-wrap gap-1.5">
            {/* Ingreso — acción primaria */}
            <button
              onClick={() => abrirModalMovimiento("ENTRADA")}
              className="inline-flex items-center gap-1.5 bg-[#e8641a] hover:bg-[#cf5815] text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m0-16l-4 4m4-4l4 4" />
              </svg>
              Ingreso
            </button>

            {/* Egreso */}
            <button
              onClick={() => abrirModalMovimiento("SALIDA")}
              className="inline-flex items-center gap-1.5 border border-[#e8641a] text-[#e8641a] hover:bg-orange-50 text-xs font-semibold px-3 py-1.5 rounded transition-colors active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 20V4m0 16l4-4m-4 4l-4-4" />
              </svg>
              Egreso
            </button>

            {/* Separador visual */}
            <span className="w-px bg-slate-200 self-stretch mx-0.5" />

            {/* Acciones secundarias — estilo navy outline */}
            <button
              onClick={onRefrescar}
              disabled={loading}
              className="inline-flex items-center gap-1.5 border border-[#1e2d3d] text-[#1e2d3d] hover:bg-slate-100 text-xs font-semibold px-3 py-1.5 rounded transition-colors active:scale-95 disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar
            </button>

            <button
              onClick={() => setModalCierreXVisible(true)}
              className="inline-flex items-center gap-1.5 border border-[#1e2d3d] text-[#1e2d3d] hover:bg-slate-100 text-xs font-semibold px-3 py-1.5 rounded transition-colors active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Cierre X
            </button>

            <button
              onClick={() => setModalCerrarVisible(true)}
              className="inline-flex items-center gap-1.5 bg-[#1e2d3d] hover:bg-[#162230] text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Cerrar Caja (Z)
            </button>
          </div>
        </div>

        {/* Estado de la caja */}
        <CajaEstado
          sesion={sesion}
          resumen={resumen}
          theme={theme}
          onVerObservaciones={() => setModalObservacionesVisible(true)}
        />

        {/* Lista de movimientos */}
        <CajaMovimientos movimientos={movimientos} theme={theme} />
      </div>

      {/* Modales */}
      {modalObservacionesVisible && (
        <ModalObservacionesCaja
          tramites={resumen?.tramites_con_observaciones || []}
          onCerrar={() => setModalObservacionesVisible(false)}
        />
      )}
      {modalCierreXVisible && (
        <ModalCierreX
          sesion={sesion}
          resumen={resumen}
          onCerrar={() => setModalCierreXVisible(false)}
        />
      )}
      {modalCerrarVisible && (
        <ModalCerrarCaja
          sesion={sesion}
          resumen={resumen}
          onConfirmar={handleCerrarCaja}
          onCancelar={() => setModalCerrarVisible(false)}
          loading={loading}
        />
      )}
      {modalMovimientoVisible && (
        <ModalNuevoMovimiento
          tipo={tipoMovimiento}
          onConfirmar={handleNuevoMovimiento}
          onCancelar={() => setModalMovimientoVisible(false)}
          loading={loading}
        />
      )}
    </>
  )
}

export default CajaActualTab
