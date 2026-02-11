"use client"

import { useEffect, useCallback, useState } from "react"
import { formatearFecha, formatearMoneda } from "../../utils/formatters"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { useCajaAPI } from "../../utils/useCajaAPI"
import Tabla from "../Tabla"
import ModalDepositarCheque from "./ModalDepositarCheque"
import ModalEndosarCheques from "./ModalEndosarCheques"
import ModalMarcarChequeRechazado from "./ModalMarcarChequeRechazado"
import ModalDetalleCheque from "./ModalDetalleCheque"
import ModalEditarCheque from "./ModalEditarCheque"
import ModalRegistrarChequeCaja from "./ModalRegistrarChequeCaja"
import HistorialCheques from "./HistorialCheques"
import AccionesMenu from "../Presupuestos y Ventas/herramientasforms/AccionesMenu"
import { BotonVerDetalle, BotonEditar, BotonMarcarRechazado, BotonDepositar } from "../Botones"

const ESTADO_EN_CARTERA = "EN_CARTERA"

/**
 * Listado de cheques en cartera y acceso al Historial.
 * Fase 6+: Muestra cheques operativos por defecto. Toggle para ver Historial completo.
 */
const ValoresEnCartera = () => {
  const theme = useFerreDeskTheme()
  const { obtenerCheques, obtenerCuentasBanco, depositarCheque, endosarCheques, marcarChequeRechazado, obtenerAlertasVencimientoCheques, crearChequeCaja } = useCajaAPI()

  // Estado de vista: false = Operativo (En Cartera), true = Historial
  const [mostrarHistorial, setMostrarHistorial] = useState(false)

  const [cheques, setCheques] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")

  // Selección múltiple para endoso
  const [seleccionados, setSeleccionados] = useState(new Set())

  // Modales
  const [modalDepositar, setModalDepositar] = useState({ abierto: false, cheque: null })
  const [modalEndosar, setModalEndosar] = useState(false)
  const [modalMarcarRechazado, setModalMarcarRechazado] = useState({ abierto: false, cheque: null })
  const [modalDetalle, setModalDetalle] = useState(null)
  const [modalEditar, setModalEditar] = useState(null)
  const [modalRegistrarCheque, setModalRegistrarCheque] = useState(false)
  const [cuentasBanco, setCuentasBanco] = useState([])
  const [procesando, setProcesando] = useState(false)

  // Alertas de vencimiento
  const [alertasVencimiento, setAlertasVencimiento] = useState({ cantidad: 0, dias: 5 })

  const cargar = useCallback(async () => {
    // Si estamos en historial, no cargamos aquí (lo hace el componente hijo)
    if (mostrarHistorial) return

    setCargando(true)
    try {
      const [resC, resB, resAlertas] = await Promise.all([
        obtenerCheques(ESTADO_EN_CARTERA),
        obtenerCuentasBanco(true), // solo activas
        obtenerAlertasVencimientoCheques(5).catch(() => ({ cantidad: 0, dias: 5 })), // Si falla, usar valores por defecto
      ])
      const lista = resC?.results ?? (Array.isArray(resC) ? resC : [])
      const bancos = resB?.results ?? (Array.isArray(resB) ? resB : [])
      setCheques(lista)
      setCuentasBanco(bancos)
      setAlertasVencimiento(resAlertas || { cantidad: 0, dias: 5 })
      setSeleccionados(new Set()) // limpiar selección al recargar
    } catch (err) {
      console.error("Error cargando cheques:", err)
      alert(err.message || "Error al cargar cheques")
      setCheques([])
    } finally {
      setCargando(false)
    }
  }, [obtenerCheques, obtenerCuentasBanco, obtenerAlertasVencimientoCheques, mostrarHistorial])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Si estamos en modo historial, renderizamos solo el componente de historial y el botón para volver
  if (mostrarHistorial) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Historial de Cheques</h3>
          <button
            type="button"
            onClick={() => setMostrarHistorial(false)}
            className="text-sm px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-medium shadow-sm"
          >
            ← Volver a Valores en Cartera
          </button>
        </div>
        <HistorialCheques />
      </div>
    )
  }

  // --- VISTA OPERATIVA (EN CARTERA) ---

  // Se usan formateadores centralizados de ../../utils/formatters

  // Toggle selección de un cheque
  const toggleSeleccion = (chequeId) => {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(chequeId)) {
        nuevo.delete(chequeId)
      } else {
        nuevo.add(chequeId)
      }
      return nuevo
    })
  }

  // Seleccionar/deseleccionar todos
  const toggleTodos = () => {
    if (seleccionados.size === cheques.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(cheques.map((c) => c.id)))
    }
  }

  // Abrir modal de depósito
  const abrirDepositar = (cheque) => {
    setModalDepositar({ abierto: true, cheque })
  }

  // Confirmar depósito
  const confirmarDeposito = async (cuentaBancoId) => {
    if (!modalDepositar.cheque) return
    setProcesando(true)
    try {
      await depositarCheque(modalDepositar.cheque.id, cuentaBancoId)
      setModalDepositar({ abierto: false, cheque: null })
      await cargar() // recargar lista
    } catch (err) {
      console.error("Error depositando cheque:", err)
      alert(err.message || "Error al depositar cheque")
    } finally {
      setProcesando(false)
    }
  }

  // Abrir modal de endoso
  const abrirEndosar = () => {
    if (seleccionados.size === 0) {
      alert("Seleccione al menos un cheque para endosar.")
      return
    }
    setModalEndosar(true)
  }

  // Confirmar endoso
  const confirmarEndoso = async (proveedorId) => {
    setProcesando(true)
    try {
      const ids = Array.from(seleccionados)
      await endosarCheques(proveedorId, ids)
      setModalEndosar(false)
      setSeleccionados(new Set())
      await cargar() // recargar lista
    } catch (err) {
      console.error("Error endosando cheques:", err)
      alert(err.message || "Error al endosar cheques")
    } finally {
      setProcesando(false)
    }
  }

  const abrirModalMarcarRechazado = (cheque) => {
    setModalMarcarRechazado({ abierto: true, cheque })
  }

  const confirmarMarcarRechazado = () => {
    if (!modalMarcarRechazado.cheque) return
    setProcesando(true)
    marcarChequeRechazado(modalMarcarRechazado.cheque.id)
      .then(() => {
        setModalMarcarRechazado({ abierto: false, cheque: null })
        return cargar()
      })
      .catch((err) => {
        console.error("Error marcando cheque rechazado:", err)
        alert(err.message || "Error al marcar cheque rechazado")
      })
      .finally(() => setProcesando(false))
  }

  const abrirDetalle = (cheque) => {
    setModalDetalle(cheque)
  }

  const cerrarDetalle = () => {
    setModalDetalle(null)
  }

  const abrirEditar = (cheque) => {
    setModalEditar(cheque)
  }

  const cerrarEditar = () => {
    setModalEditar(null)
  }

  const confirmarEditar = async (chequeActualizado) => {
    setModalEditar(null)
    await cargar() // Recargar lista después de editar
  }

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

  // Obtener cheques seleccionados para el modal
  const chequesSeleccionados = cheques.filter((c) => seleccionados.has(c.id))

  // Función para generar botones del menú de acciones para cada cheque
  const generarBotonesCheque = (cheque) => {
    const botones = []

    // Ver detalle - siempre disponible
    botones.push({
      componente: BotonVerDetalle,
      onClick: () => abrirDetalle(cheque),
      titulo: "Ver detalle",
      disabled: false,
    })

    // Editar - solo si está EN_CARTERA
    if (cheque.estado === ESTADO_EN_CARTERA) {
      botones.push({
        componente: BotonEditar,
        onClick: () => abrirEditar(cheque),
        titulo: "Editar",
        disabled: false,
      })
    }

    // Depositar - solo si está EN_CARTERA
    if (cheque.estado === ESTADO_EN_CARTERA) {
      botones.push({
        componente: BotonDepositar,
        onClick: () => abrirDepositar(cheque),
        titulo: "Depositar",
        disabled: procesando,
      })
    }

    // Marcar rechazado - siempre disponible para cheques EN_CARTERA
    if (cheque.estado === ESTADO_EN_CARTERA) {
      botones.push({
        componente: BotonMarcarRechazado,
        onClick: () => abrirModalMarcarRechazado(cheque),
        titulo: "Marcar rechazado",
        disabled: procesando,
      })
    }

    return botones
  }

  const columnas = [
    // Checkbox de selección (título vacío, el "seleccionar todos" está en el banner)
    {
      id: "seleccionar",
      titulo: "",
      ancho: "40px",
      render: (c) => (
        <input
          type="checkbox"
          checked={seleccionados.has(c.id)}
          onChange={() => toggleSeleccion(c.id)}
          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
      ),
    },
    { id: "numero", titulo: "N°", render: (c) => <span className="text-sm font-medium text-slate-800">{c.numero}</span> },
    {
      id: "tipo",
      titulo: "TIPO",
      render: (c) => (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${c.tipo_cheque === "DIFERIDO" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
          }`}>
          {c.tipo_cheque === "DIFERIDO" ? "Dif" : "Día"}
        </span>
      ),
    },
    { id: "librador_nombre", titulo: "LIBRADOR", render: (c) => <span className="text-xs text-slate-700 truncate max-w-[120px]" title={c.librador_nombre}>{c.librador_nombre}</span> },
    { id: "banco_emisor", titulo: "BANCO", render: (c) => <span className="text-xs text-slate-600 truncate max-w-[100px]" title={c.banco_emisor}>{c.banco_emisor}</span> },
    { id: "monto", titulo: "MONTO", align: "right", render: (c) => <span className="text-sm font-semibold text-slate-800">${formatearMoneda(c.monto)}</span> },
    { id: "fecha_pago", titulo: "F. PAGO", render: (c) => <span className="text-xs font-medium text-slate-700">{formatearFecha(c.fecha_pago)}</span> },
    // Columna de acciones
    {
      id: "acciones",
      titulo: "ACCIONES",
      render: (c) => <AccionesMenu botones={generarBotonesCheque(c)} />,
    },
  ]

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-slate-800">Valores en Cartera</h3>

        <div className="flex items-center gap-2">
          {/* Botón Registrar cheque */}
          <button
            type="button"
            onClick={() => setModalRegistrarCheque(true)}
            className="text-sm px-3 py-1.5 rounded border border-orange-500 text-orange-600 hover:bg-orange-50 font-medium flex items-center gap-1 mr-2"
          >
            Registrar cheque
          </button>

          {/* Botón Ver Historial */}
          <button
            type="button"
            onClick={() => setMostrarHistorial(true)}
            className="text-sm px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium flex items-center gap-1 mr-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 117.78 122.88" className="w-4 h-4" fill="currentColor">
              <path d="M70.71,116.29H7.46a7.48,7.48,0,0,1-5.27-2.19L2,113.87a7.43,7.43,0,0,1-2-5V7.46A7.45,7.45,0,0,1,2.19,2.19L2.42,2a7.42,7.42,0,0,1,5-2H91.88a7.48,7.48,0,0,1,7.46,7.46V66.63a3.21,3.21,0,0,1-.06.63,28.75,28.75,0,1,1-28.57,49ZM85.18,82.12h2.89a2,2,0,0,1,1.43.59,2.06,2.06,0,0,1,.6,1.44V94.77h9.59a2,2,0,0,1,2,2v3a2.12,2.12,0,0,1-.6,1.44l-.08.07a2,2,0,0,1-1.35.52H84a1,1,0,0,1-1-1V84a2,2,0,0,1,.59-1.29,2,2,0,0,1,1.43-.6Zm7.75-16.47V7.46a1.1,1.1,0,0,0-1.05-1H7.46a1.08,1.08,0,0,0-.66.23l-.08.08a1.06,1.06,0,0,0-.31.74V108.84a1,1,0,0,0,.23.65l.09.08a1,1,0,0,0,.73.32H65A28.75,28.75,0,0,1,89,65.38a28,28,0,0,1,3.9.27Zm12.36,12.22A23,23,0,1,0,112,94.13a22.92,22.92,0,0,0-6.73-16.26Zm-84.5-3.78h9A1.18,1.18,0,0,1,31,75.27v9a1.18,1.18,0,0,1-1.18,1.18h-9a1.18,1.18,0,0,1-1.18-1.18v-9a1.18,1.18,0,0,1,1.18-1.18Zm22,9.28a3.65,3.65,0,0,1,0-7.18h9.58a3.65,3.65,0,0,1,0,7.18Zm-22-61.22h9A1.18,1.18,0,0,1,31,23.33v9a1.18,1.18,0,0,1-1.18,1.18h-9a1.18,1.18,0,0,1-1.18-1.18v-9a1.18,1.18,0,0,1,1.18-1.18Zm22,9.27a3.33,3.33,0,0,1-3-3.58,3.34,3.34,0,0,1,3-3.59H78.25a3.34,3.34,0,0,1,3,3.59,3.33,3.33,0,0,1-3,3.58ZM18.34,54.1a2,2,0,0,1,.38-2.82,2.23,2.23,0,0,1,3-.09l2.1,2.17L29.07,48a1.93,1.93,0,0,1,2.82.3,2.23,2.23,0,0,1,.18,3l-7,7.14a1.94,1.94,0,0,1-2.82-.3l-.16-.19a1.94,1.94,0,0,1-.31-.26L18.34,54.1Zm24.4,2.69a3.34,3.34,0,0,1-3-3.59,3.34,3.34,0,0,1,3-3.59H78.25a3.34,3.34,0,0,1,3,3.59,3.34,3.34,0,0,1-3,3.59Z" />
            </svg>
            Ver Historial
          </button>

          {/* Botón Endosar (múltiple - solo si hay selección) */}
          {seleccionados.size > 0 && (
            <button
              type="button"
              onClick={abrirEndosar}
              className="text-sm px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 font-medium flex items-center gap-1 shadow-sm transition-all"
            >
              <span>Endosar</span>
              <span className="bg-indigo-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {seleccionados.size}
              </span>
            </button>
          )}

          <button type="button" onClick={cargar} className={theme.botonPrimario} disabled={cargando}>
            {cargando ? "Cargando..." : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Banner de alertas de vencimiento */}
      {alertasVencimiento.cantidad > 0 && (
        <div className="rounded-md px-4 py-3 bg-yellow-50 border border-yellow-200 text-yellow-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-yellow-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0M3.124 7.5A8.969 8.969 0 0 1 5.292 3m13.416 0a8.969 8.969 0 0 1 2.168 4.5" />
              </svg>
              <span className="text-sm font-medium">
                {alertasVencimiento.cantidad} cheque{alertasVencimiento.cantidad !== 1 ? "s" : ""} por vencer en los próximos {alertasVencimiento.dias} días
              </span>
            </div>
          </div>
          {/* Lista de cheques por vencer */}
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full divide-y divide-yellow-200">
              <thead>
                <tr>
                  <th className="px-1 py-1 text-left text-[10px] uppercase tracking-wider font-bold">N°</th>
                  <th className="px-1 py-1 text-left text-[10px] uppercase tracking-wider font-bold">Librador</th>
                  <th className="px-1 py-1 text-right text-[10px] uppercase tracking-wider font-bold">Monto</th>
                  <th className="px-1 py-1 text-right text-[10px] uppercase tracking-wider font-bold">F. Pago</th>
                  <th className="px-1 py-1 text-center text-[10px] uppercase tracking-wider font-bold">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-100">
                {(alertasVencimiento.cheques || []).map((ch) => (
                  <tr key={ch.id} className="hover:bg-yellow-100/50">
                    <td className="px-1 py-1 text-xs whitespace-nowrap">{ch.numero}</td>
                    <td className="px-1 py-1 text-xs truncate max-w-[120px]" title={ch.librador_nombre}>{ch.librador_nombre}</td>
                    <td className="px-1 py-1 text-xs text-right whitespace-nowrap font-medium">${formatearMoneda(ch.monto)}</td>
                    <td className="px-1 py-1 text-xs text-right whitespace-nowrap">{formatearFecha(ch.fecha_pago)}</td>
                    <td className="px-1 py-1 text-center">
                      <button
                        onClick={() => abrirDetalle(ch)}
                        className="text-[10px] text-yellow-700 hover:text-yellow-900 font-bold underline"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Barra de selección */}
      {cheques.length > 0 && (
        <div className={`rounded-md px-3 py-2 flex items-center justify-between text-xs transition-colors duration-200 ${seleccionados.size > 0
          ? "bg-indigo-50 border border-indigo-200 text-indigo-800"
          : "bg-slate-50 border border-slate-200 text-slate-600"
          }`}>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={cheques.length > 0 && seleccionados.size === cheques.length}
                onChange={toggleTodos}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Seleccionar todos</span>
            </label>
            {seleccionados.size > 0 && (
              <>
                <span className="text-indigo-600 font-medium">
                  {seleccionados.size} cheque{seleccionados.size !== 1 ? "s" : ""} seleccionado{seleccionados.size !== 1 ? "s" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setSeleccionados(new Set())}
                  className="underline hover:no-underline text-indigo-700"
                >
                  Limpiar
                </button>
              </>
            )}
          </div>
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

      {/* Modal Depositar */}
      {modalDepositar.abierto && (
        <ModalDepositarCheque
          cuentasBanco={cuentasBanco}
          onConfirmar={confirmarDeposito}
          onCancelar={() => setModalDepositar({ abierto: false, cheque: null })}
          loading={procesando}
        />
      )}

      {/* Modal Endosar */}
      {modalEndosar && (
        <ModalEndosarCheques
          chequesSeleccionados={chequesSeleccionados}
          onConfirmar={confirmarEndoso}
          onCancelar={() => setModalEndosar(false)}
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

      {/* Modal Registrar cheque desde caja */}
      {modalRegistrarCheque && (
        <ModalRegistrarChequeCaja
          abierto={modalRegistrarCheque}
          onConfirmar={confirmarRegistrarCheque}
          onCancelar={() => setModalRegistrarCheque(false)}
          loading={procesando}
        />
      )}

      {/* Modal Detalle */}
      {modalDetalle && (
        <ModalDetalleCheque cheque={modalDetalle} onCerrar={cerrarDetalle} />
      )}

      {/* Modal Editar */}
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

