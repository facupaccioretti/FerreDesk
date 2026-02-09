"use client"

import { useEffect, useCallback, useState } from "react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { useCajaAPI } from "../../utils/useCajaAPI"
import Tabla from "../Tabla"
import ModalDepositarCheque from "./ModalDepositarCheque"
import ModalEndosarCheques from "./ModalEndosarCheques"
import ModalMarcarChequeRechazado from "./ModalMarcarChequeRechazado"
import HistorialCheques from "./HistorialCheques"

const ESTADO_EN_CARTERA = "EN_CARTERA"

/**
 * Listado de cheques en cartera y acceso al Historial.
 * Fase 6+: Muestra cheques operativos por defecto. Toggle para ver Historial completo.
 */
const ValoresEnCartera = () => {
  const theme = useFerreDeskTheme()
  const { obtenerCheques, obtenerCuentasBanco, depositarCheque, endosarCheques, marcarChequeRechazado } = useCajaAPI()

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
  const [cuentasBanco, setCuentasBanco] = useState([])
  const [procesando, setProcesando] = useState(false)

  const cargar = useCallback(async () => {
    // Si estamos en historial, no cargamos aquí (lo hace el componente hijo)
    if (mostrarHistorial) return

    setCargando(true)
    try {
      const [resC, resB] = await Promise.all([
        obtenerCheques(ESTADO_EN_CARTERA),
        obtenerCuentasBanco(true), // solo activas
      ])
      const lista = resC?.results ?? (Array.isArray(resC) ? resC : [])
      const bancos = resB?.results ?? (Array.isArray(resB) ? resB : [])
      setCheques(lista)
      setCuentasBanco(bancos)
      setSeleccionados(new Set()) // limpiar selección al recargar
    } catch (err) {
      console.error("Error cargando cheques:", err)
      alert(err.message || "Error al cargar cheques")
      setCheques([])
    } finally {
      setCargando(false)
    }
  }, [obtenerCheques, obtenerCuentasBanco, mostrarHistorial])

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

  const formatearMoneda = (v) => {
    const num = parseFloat(v) || 0
    return num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

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

  const confirmarMarcarRechazado = (cargosAdministrativosBanco) => {
    if (!modalMarcarRechazado.cheque) return
    setProcesando(true)
    marcarChequeRechazado(modalMarcarRechazado.cheque.id, { cargosAdministrativosBanco })
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

  // Obtener cheques seleccionados para el modal
  const chequesSeleccionados = cheques.filter((c) => seleccionados.has(c.id))

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
    { id: "banco_emisor", titulo: "BANCO", render: (c) => <span className="text-sm text-slate-700">{c.banco_emisor}</span> },
    { id: "monto", titulo: "MONTO", align: "right", render: (c) => <span className="text-sm font-semibold text-slate-800">${formatearMoneda(c.monto)}</span> },
    { id: "cuit_librador", titulo: "CUIT", render: (c) => <span className="text-xs font-mono text-slate-600">{c.cuit_librador}</span> },
    { id: "fecha_emision", titulo: "EMISIÓN", render: (c) => <span className="text-xs text-slate-600">{c.fecha_emision}</span> },
    { id: "fecha_presentacion", titulo: "PRESENT.", render: (c) => <span className="text-xs text-slate-600">{c.fecha_presentacion}</span> },
    // Columna de acciones
    {
      id: "acciones",
      titulo: "ACCIONES",
      render: (c) => (
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => abrirDepositar(c)}
            className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 hover:bg-orange-200 font-medium transition-colors"
            title="Depositar en cuenta propia"
          >
            Depositar
          </button>
          <button
            type="button"
            onClick={() => abrirModalMarcarRechazado(c)}
            disabled={procesando}
            className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium transition-colors disabled:opacity-50"
            title="Marcar como rechazado (genera ND)"
          >
            Marcar rechazado
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-slate-800">Valores en Cartera</h3>

        <div className="flex items-center gap-2">
          {/* Botón Ver Historial */}
          <button
            type="button"
            onClick={() => setMostrarHistorial(true)}
            className="text-sm px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium flex items-center gap-1 mr-2"
          >
            📋 Ver Historial
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
    </div>
  )
}

export default ValoresEnCartera

