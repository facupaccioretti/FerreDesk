"use client"

import { useEffect, useCallback, useState } from "react"
import { formatearFecha, formatearMoneda } from "../../utils/formatters"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { useCajaAPI } from "../../utils/useCajaAPI"
import Tabla from "../Tabla"
import ModalDepositarCheque from "./ModalDepositarCheque"
import ModalMarcarChequeRechazado from "./ModalMarcarChequeRechazado"
import ModalDetalleCheque from "./ModalDetalleCheque"
import ModalEditarCheque from "./ModalEditarCheque"
import ModalRegistrarChequeCaja from "./ModalRegistrarChequeCaja"
import HistorialCheques from "./HistorialCheques"
import AccionesMenu from "../Presupuestos y Ventas/herramientasforms/AccionesMenu"
import { BotonVerDetalle, BotonEditar, BotonMarcarRechazado, BotonDepositar } from "../Botones"
const NAVY = "#1e2d3d"
const ORANGE = "#e8641a"
const ESTADO_EN_CARTERA = "EN_CARTERA"

const ValoresEnCartera = ({ drilldownIntent = null }) => {
  const theme = useFerreDeskTheme()
  const { obtenerCheques, obtenerCuentasBanco, depositarCheque, marcarChequeRechazado, obtenerAlertasVencimientoCheques, crearChequeCaja } = useCajaAPI()

  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [cheques, setCheques] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")

  const [modalDepositar, setModalDepositar] = useState({ abierto: false, cheque: null })
  const [modalMarcarRechazado, setModalMarcarRechazado] = useState({ abierto: false, cheque: null })
  const [modalDetalle, setModalDetalle] = useState(null)
  const [modalEditar, setModalEditar] = useState(null)
  const [modalRegistrarCheque, setModalRegistrarCheque] = useState(false)
  const [cuentasBanco, setCuentasBanco] = useState([])
  const [procesando, setProcesando] = useState(false)
  const [alertasVencimiento, setAlertasVencimiento] = useState({ cantidad: 0, dias: 5 })

  useEffect(() => {
    if (!drilldownIntent?.nonce) return
    setMostrarHistorial(drilldownIntent.vistaInicial === "historial")
  }, [drilldownIntent])

  const cargar = useCallback(async () => {
    if (mostrarHistorial) return
    setCargando(true)
    try {
      const [resC, resB, resAlertas] = await Promise.all([
        obtenerCheques(ESTADO_EN_CARTERA),
        obtenerCuentasBanco(true),
        obtenerAlertasVencimientoCheques(5).catch(() => ({ cantidad: 0, dias: 5 })),
      ])
      setCheques(resC?.results ?? (Array.isArray(resC) ? resC : []))
      setCuentasBanco(resB?.results ?? (Array.isArray(resB) ? resB : []))
      setAlertasVencimiento(resAlertas || { cantidad: 0, dias: 5 })
    } catch (err) {
      console.error("Error cargando cheques:", err)
      alert(err.message || "Error al cargar cheques")
      setCheques([])
    } finally {
      setCargando(false)
    }
  }, [obtenerCheques, obtenerCuentasBanco, obtenerAlertasVencimientoCheques, mostrarHistorial])

  useEffect(() => { cargar() }, [cargar])

  // --- VISTA HISTORIAL ---
  if (mostrarHistorial) {
    return (
      <div className="space-y-3">
        {/* Barra de regreso */}
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Historial de Cheques</span>
          <button
            type="button"
            onClick={() => setMostrarHistorial(false)}
            className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-slate-50"
            style={{ borderColor: NAVY, color: NAVY }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Cartera
          </button>
        </div>
        <HistorialCheques filtroEstadoInicial={drilldownIntent?.filtroEstadoInicial || ""} />
      </div>
    )
  }

  // --- VISTA OPERATIVA (EN CARTERA) ---

  const abrirDepositar = (cheque) => setModalDepositar({ abierto: true, cheque })

  const confirmarDeposito = async (cuentaBancoId) => {
    if (!modalDepositar.cheque) return
    setProcesando(true)
    try {
      await depositarCheque(modalDepositar.cheque.id, cuentaBancoId)
      setModalDepositar({ abierto: false, cheque: null })
      await cargar()
    } catch (err) {
      console.error("Error depositando cheque:", err)
      alert(err.message || "Error al depositar cheque")
    } finally {
      setProcesando(false)
    }
  }

  const abrirModalMarcarRechazado = (cheque) => setModalMarcarRechazado({ abierto: true, cheque })

  const confirmarMarcarRechazado = () => {
    if (!modalMarcarRechazado.cheque) return
    setProcesando(true)
    marcarChequeRechazado(modalMarcarRechazado.cheque.id)
      .then(() => { setModalMarcarRechazado({ abierto: false, cheque: null }); return cargar() })
      .catch((err) => { console.error("Error marcando cheque rechazado:", err); alert(err.message || "Error al marcar cheque rechazado") })
      .finally(() => setProcesando(false))
  }

  const abrirDetalle = (cheque) => setModalDetalle(cheque)
  const cerrarDetalle = () => setModalDetalle(null)
  const abrirEditar = (cheque) => setModalEditar(cheque)
  const cerrarEditar = () => setModalEditar(null)
  const confirmarEditar = async () => { setModalEditar(null); await cargar() }

  const confirmarRegistrarCheque = async (payload) => {
    setProcesando(true)
    try {
      await crearChequeCaja(payload)
      setModalRegistrarCheque(false)
      await cargar()
    } catch (err) {
      console.error("Error registrando cheque:", err)
      alert(err.message || "Error al registrar el cheque")
    } finally {
      setProcesando(false)
    }
  }

  const handleAbrirRegistrarCheque = async () => {
    setModalRegistrarCheque(true)
  }

  const generarBotonesCheque = (cheque) => {
    const botones = []
    botones.push({ componente: BotonVerDetalle, onClick: () => abrirDetalle(cheque), titulo: "Ver detalle", disabled: false })
    if (cheque.estado === ESTADO_EN_CARTERA) {
      botones.push({ componente: BotonEditar, onClick: () => abrirEditar(cheque), titulo: "Editar", disabled: false })
      botones.push({ componente: BotonDepositar, onClick: () => abrirDepositar(cheque), titulo: "Depositar", disabled: procesando })
      botones.push({ componente: BotonMarcarRechazado, onClick: () => abrirModalMarcarRechazado(cheque), titulo: "Marcar rechazado", disabled: procesando })
    }
    return botones
  }

  const columnas = [
    {
      id: "numero",
      titulo: "N°",
      render: (c) => <span className="text-xs font-semibold text-[#1e2d3d]">{c.numero}</span>,
    },
    {
      id: "tipo",
      titulo: "TIPO",
      render: (c) => (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-bold uppercase ${
          c.tipo_cheque === "DIFERIDO"
            ? "border border-[#e8641a] text-[#e8641a]"
            : "bg-[#1e2d3d] text-white"
        }`}>
          {c.tipo_cheque === "DIFERIDO" ? "Dif" : "Día"}
        </span>
      ),
    },
    {
      id: "librador_nombre",
      titulo: "LIBRADOR",
      render: (c) => (
        <span className="text-xs text-[#1e2d3d] font-medium truncate max-w-[120px]" title={c.librador_nombre}>
          {c.librador_nombre}
        </span>
      ),
    },
    {
      id: "banco_emisor",
      titulo: "BANCO",
      render: (c) => <span className="text-xs text-slate-600 truncate max-w-[100px]" title={c.banco_emisor}>{c.banco_emisor}</span>,
    },
    {
      id: "monto",
      titulo: "MONTO",
      align: "right",
      render: (c) => <span className="text-xs font-semibold tabular-nums text-[#1e2d3d]">${formatearMoneda(c.monto)}</span>,
    },
    {
      id: "fecha_pago",
      titulo: "F. PAGO",
      render: (c) => <span className="text-xs tabular-nums text-slate-600">{formatearFecha(c.fecha_pago)}</span>,
    },
    {
      id: "acciones",
      titulo: "ACCIONES",
      render: (c) => <AccionesMenu botones={generarBotonesCheque(c)} />,
    },
  ]

  return (
    <div className="space-y-3">
      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Valores en Cartera</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleAbrirRegistrarCheque}
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: ORANGE }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Registrar cheque
          </button>

          <button
            type="button"
            onClick={() => setMostrarHistorial(true)}
            className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-slate-50"
            style={{ borderColor: NAVY, color: NAVY }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 117.78 122.88" className="w-3.5 h-3.5" fill="currentColor">
              <path d="M70.71,116.29H7.46a7.48,7.48,0,0,1-5.27-2.19L2,113.87a7.43,7.43,0,0,1-2-5V7.46A7.45,7.45,0,0,1,2.19,2.19L2.42,2a7.42,7.42,0,0,1,5-2H91.88a7.48,7.48,0,0,1,7.46,7.46V66.63a3.21,3.21,0,0,1-.06.63,28.75,28.75,0,1,1-28.57,49ZM85.18,82.12h2.89a2,2,0,0,1,1.43.59,2.06,2.06,0,0,1,.6,1.44V94.77h9.59a2,2,0,0,1,2,2v3a2.12,2.12,0,0,1-.6,1.44l-.08.07a2,2,0,0,1-1.35.52H84a1,1,0,0,1-1-1V84a2,2,0,0,1,.59-1.29,2,2,0,0,1,1.43-.6Zm7.75-16.47V7.46a1.1,1.1,0,0,0-1.05-1H7.46a1.08,1.08,0,0,0-.66.23l-.08.08a1.06,1.06,0,0,0-.31.74V108.84a1,1,0,0,0,.23.65l.09.08a1,1,0,0,0,.73.32H65A28.75,28.75,0,0,1,89,65.38a28,28,0,0,1,3.9.27Zm12.36,12.22A23,23,0,1,0,112,94.13a22.92,22.92,0,0,0-6.73-16.26Zm-84.5-3.78h9A1.18,1.18,0,0,1,31,75.27v9a1.18,1.18,0,0,1-1.18,1.18h-9a1.18,1.18,0,0,1-1.18-1.18v-9a1.18,1.18,0,0,1,1.18-1.18Zm22,9.28a3.65,3.65,0,0,1,0-7.18h9.58a3.65,3.65,0,0,1,0,7.18Zm-22-61.22h9A1.18,1.18,0,0,1,31,23.33v9a1.18,1.18,0,0,1-1.18,1.18h-9a1.18,1.18,0,0,1-1.18-1.18v-9a1.18,1.18,0,0,1,1.18-1.18Zm22,9.27a3.33,3.33,0,0,1-3-3.58,3.34,3.34,0,0,1,3-3.59H78.25a3.34,3.34,0,0,1,3,3.59,3.33,3.33,0,0,1-3,3.58ZM18.34,54.1a2,2,0,0,1,.38-2.82,2.23,2.23,0,0,1,3-.09l2.1,2.17L29.07,48a1.93,1.93,0,0,1,2.82.3,2.23,2.23,0,0,1,.18,3l-7,7.14a1.94,1.94,0,0,1-2.82-.3l-.16-.19a1.94,1.94,0,0,1-.31-.26L18.34,54.1Zm24.4,2.69a3.34,3.34,0,0,1-3-3.59,3.34,3.34,0,0,1,3-3.59H78.25a3.34,3.34,0,0,1,3,3.59,3.34,3.34,0,0,1-3,3.59Z" />
            </svg>
            Ver Historial
          </button>

          <button
            type="button"
            onClick={cargar}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-slate-50 disabled:opacity-50"
            style={{ borderColor: NAVY, color: NAVY }}
          >
            {cargando ? "Cargando..." : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Banner alertas de vencimiento */}
      {alertasVencimiento.cantidad > 0 && (
        <div
          className="rounded-lg border px-4 py-3 space-y-2"
          style={{ borderColor: ORANGE, backgroundColor: "#fff7f3" }}
        >
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={ORANGE} className="w-4 h-4 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0M3.124 7.5A8.969 8.969 0 0 1 5.292 3m13.416 0a8.969 8.969 0 0 1 2.168 4.5" />
            </svg>
            <span className="text-xs font-semibold" style={{ color: ORANGE }}>
              {alertasVencimiento.cantidad} cheque{alertasVencimiento.cantidad !== 1 ? "s" : ""} por vencer en los próximos {alertasVencimiento.dias} días
            </span>
          </div>

          {(alertasVencimiento.cheques || []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-orange-200">
                    {["N°", "Librador", "Monto", "F. Pago", ""].map((h, i) => (
                      <th key={i} className={`py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${i >= 2 ? "text-right" : "text-left"} ${i === 4 ? "text-center" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100">
                  {alertasVencimiento.cheques.map((ch) => (
                    <tr key={ch.id} className="hover:bg-orange-50/50 transition-colors">
                      <td className="py-1 pr-2 text-[#1e2d3d] font-medium">{ch.numero}</td>
                      <td className="py-1 pr-2 text-slate-600 truncate max-w-[120px]" title={ch.librador_nombre}>{ch.librador_nombre}</td>
                      <td className="py-1 pr-2 text-right font-semibold tabular-nums text-[#1e2d3d]">${formatearMoneda(ch.monto)}</td>
                      <td className="py-1 pr-2 text-right tabular-nums text-slate-600">{formatearFecha(ch.fecha_pago)}</td>
                      <td className="py-1 text-center">
                        <button
                          onClick={() => abrirDetalle(ch)}
                          className="text-[10px] font-semibold underline"
                          style={{ color: ORANGE }}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Tabla
        columnas={columnas}
        datos={cheques}
        valorBusqueda={busqueda}
        onCambioBusqueda={setBusqueda}
        mostrarBuscador={true}
        mostrarOrdenamiento={false}
        filasPorPaginaInicial={20}
        paginadorVisible={true}
        cargando={cargando}
        sinEstilos={false}
        filasCompactas={true}
        tamañoEncabezado="pequeño"
      />

      {modalDepositar.abierto && (
        <ModalDepositarCheque
          cuentasBanco={cuentasBanco}
          onConfirmar={confirmarDeposito}
          onCancelar={() => setModalDepositar({ abierto: false, cheque: null })}
          loading={procesando}
        />
      )}

      {modalMarcarRechazado.abierto && modalMarcarRechazado.cheque && (
        <ModalMarcarChequeRechazado
          cheque={modalMarcarRechazado.cheque}
          formatearMoneda={formatearMoneda}
          onConfirmar={confirmarMarcarRechazado}
          onCancelar={() => setModalMarcarRechazado({ abierto: false, cheque: null })}
          loading={procesando}
        />
      )}

      {modalRegistrarCheque && (
        <ModalRegistrarChequeCaja
          abierto={modalRegistrarCheque}
          onConfirmar={confirmarRegistrarCheque}
          onCancelar={() => setModalRegistrarCheque(false)}
          loading={procesando}
        />
      )}

      {modalDetalle && (
        <ModalDetalleCheque cheque={modalDetalle} onCerrar={cerrarDetalle} />
      )}

      {modalEditar && (
        <ModalEditarCheque
          cheque={modalEditar}
          onGuardar={confirmarEditar}
          onCancelar={cerrarEditar}
        />
      )}
    </div>
  )
}

export default ValoresEnCartera
