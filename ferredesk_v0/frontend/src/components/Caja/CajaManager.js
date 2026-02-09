"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Navbar from "../Navbar"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { useCajaAPI } from "../../utils/useCajaAPI"
import CajasHistorialTable from "./CajasHistorialTable"
import CajaDetalleView from "./CajaDetalleView"
import CajaActualTab from "./CajaActualTab"
import ModalAbrirCaja from "./ModalAbrirCaja"
import MaestroBancos from "./MaestroBancos"
import ValoresEnCartera from "./ValoresEnCartera"

// Tabs principales que siempre deben estar presentes
const mainTabs = [
  { key: "historial", label: "Historial de Cajas", closable: false },
  { key: "bancos", label: "Bancos", closable: false },
  { key: "valores-en-cartera", label: "Cheques", closable: false },
]

/**
 * Componente principal del módulo de Caja y Tesorería.
 * 
 * Funcionalidades:
 * - Sistema de tabs tipo navegador
 * - Historial de cajas cerradas
 * - Vista detallada de cajas cerradas
 * - Gestión de caja abierta en tab principal
 * - Persistencia en localStorage
 */
const CajaManager = () => {
  const theme = useFerreDeskTheme()
  const {
    loading,
    error: _error, // eslint-disable-line no-unused-vars
    obtenerMiCaja,
    abrirCaja,
    cerrarCaja,
    obtenerEstadoCaja,
    registrarMovimiento,
    obtenerMovimientos,
  } = useCajaAPI()

  // Estados de tabs
  const [tabs, setTabs] = useState(() => {
    try {
      const savedTabs = localStorage.getItem("cajaTabs")
      if (savedTabs) {
        const parsedTabs = JSON.parse(savedTabs)
        // Validar que siempre esté el tab principal
        let restoredTabs = parsedTabs
        const otrosTabs = restoredTabs.filter((t) => !mainTabs.some((m) => m.key === t.key))
        return [...mainTabs, ...otrosTabs]
      }
    } catch (e) {
      console.error("[CAJA] Error restaurando tabs:", e)
    }
    return [...mainTabs]
  })

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("cajaActiveTab") || "historial"
  })

  const [draggedTabKey, setDraggedTabKey] = useState(null)

  // Persistencia en localStorage con debounce
  const persistTimeout = useRef(null)
  useEffect(() => {
    clearTimeout(persistTimeout.current)
    persistTimeout.current = setTimeout(() => {
      localStorage.setItem("cajaTabs", JSON.stringify(tabs))
      localStorage.setItem("cajaActiveTab", activeTab)
    }, 300)
    return () => clearTimeout(persistTimeout.current)
  }, [tabs, activeTab])

  // Estado de la caja abierta
  const [tieneCajaAbierta, setTieneCajaAbierta] = useState(false)
  const [sesionActual, setSesionActual] = useState(null)
  const [resumenCaja, setResumenCaja] = useState(null)
  const [movimientos, setMovimientos] = useState([])

  // Estados de modales
  const [modalAbrirVisible, setModalAbrirVisible] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  // Estados de UI
  const [, setCargando] = useState(true) // Estado interno para controlar carga, no se expone

  // Cargar estado inicial de la caja
  const cargarEstadoCaja = useCallback(async () => {
    setCargando(true)
    try {
      const resultado = await obtenerMiCaja()
      const tieneCaja = resultado.tiene_caja_abierta
      setTieneCajaAbierta(tieneCaja)
      setSesionActual(resultado.sesion)

      if (tieneCaja && resultado.sesion) {
        // Cargar resumen y movimientos
        const estadoCompleto = await obtenerEstadoCaja()
        setResumenCaja(estadoCompleto.resumen)

        const movs = await obtenerMovimientos(resultado.sesion.id)
        setMovimientos(movs.results || movs || [])
      } else {
        setResumenCaja(null)
        setMovimientos([])
      }
    } catch (err) {
      console.error("Error al cargar estado de caja:", err)
      setMensaje({ tipo: "error", texto: err.message || "Error al cargar estado de caja" })
    } finally {
      setCargando(false)
    }
  }, [obtenerMiCaja, obtenerEstadoCaja, obtenerMovimientos])

  useEffect(() => {
    document.title = "Caja y Tesorería - FerreDesk"
    cargarEstadoCaja()
  }, [cargarEstadoCaja])

  // Sincronizar tab "Caja Actual" cuando cambia el estado de caja
  useEffect(() => {
    const existeTabCajaActual = tabs.find((t) => t.key === "caja-actual")
    if (tieneCajaAbierta && !existeTabCajaActual) {
      setTabs((prev) => [
        ...prev,
        { key: "caja-actual", label: "Caja Actual", closable: false },
      ])
      // Si no hay tab activo o está en historial, cambiar a caja-actual
      if (!activeTab || activeTab === "historial") {
        setActiveTab("caja-actual")
      }
    } else if (!tieneCajaAbierta && existeTabCajaActual) {
      setTabs((prev) => prev.filter((t) => t.key !== "caja-actual"))
      if (activeTab === "caja-actual") {
        setActiveTab("historial")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tieneCajaAbierta]) // Solo depende de tieneCajaAbierta para evitar loops infinitos

  // Abrir caja
  const handleAbrirCaja = async (saldoInicial) => {
    try {
      const sesion = await abrirCaja(saldoInicial)
      setSesionActual(sesion)
      setTieneCajaAbierta(true)
      setModalAbrirVisible(false)
      setMensaje({ tipo: "exito", texto: "Caja abierta correctamente" })

      // Recargar estado completo
      await cargarEstadoCaja()

      // Cambiar a tab "Caja Actual"
      setActiveTab("caja-actual")
    } catch (err) {
      setMensaje({ tipo: "error", texto: err.message || "Error al abrir caja" })
    }
  }

  // Cerrar caja
  const handleCerrarCaja = async (saldoDeclarado, observaciones) => {
    try {
      const resultado = await cerrarCaja(saldoDeclarado, observaciones)
      setTieneCajaAbierta(false)
      setSesionActual(null)
      setResumenCaja(null)
      setMovimientos([])
      setMensaje({
        tipo: "exito",
        texto: `Caja cerrada. Diferencia: $${resultado.sesion.diferencia}`,
      })

      // Recargar estado para actualizar historial
      await cargarEstadoCaja()

      // Cambiar a tab "Historial"
      setActiveTab("historial")
    } catch (err) {
      setMensaje({ tipo: "error", texto: err.message || "Error al cerrar caja" })
    }
  }

  // Registrar movimiento
  const handleNuevoMovimiento = async (tipo, monto, descripcion) => {
    try {
      await registrarMovimiento(tipo, monto, descripcion)
      setMensaje({
        tipo: "exito",
        texto: `${tipo === "ENTRADA" ? "Ingreso" : "Egreso"} registrado correctamente`,
      })

      // Recargar estado
      await cargarEstadoCaja()
    } catch (err) {
      setMensaje({ tipo: "error", texto: err.message || "Error al registrar movimiento" })
    }
  }

  // Refrescar estado (Cierre X)
  const handleRefrescar = async () => {
    await cargarEstadoCaja()
    setMensaje({ tipo: "exito", texto: "Estado actualizado" })
  }

  // Abrir tab de detalles de caja
  const handleCajaClick = (caja) => {
    const tabKey = `caja-${caja.id}`
    const tabLabel = `Caja #${caja.id} - ${new Date(caja.fecha_hora_inicio).toLocaleDateString("es-AR")}`

    // Verificar si ya existe el tab
    const existeTab = tabs.find((t) => t.key === tabKey)
    if (!existeTab) {
      setTabs((prev) => [
        ...prev,
        { key: tabKey, label: tabLabel, closable: true, data: caja },
      ])
    }
    setActiveTab(tabKey)
  }

  // Cerrar tab
  const closeTab = (key) => {
    // No permitir cerrar tabs principales
    const tab = tabs.find((t) => t.key === key)
    if (!tab || !tab.closable) return

    setTabs((prev) => prev.filter((t) => t.key !== key))
    if (activeTab === key) {
      setActiveTab("historial")
    }
  }

  // Drag & Drop de tabs
  const handleDragStart = (key) => {
    setDraggedTabKey(key)
  }

  const handleDrop = (dropTabKey) => {
    if (draggedTabKey && draggedTabKey !== dropTabKey) {
      const dynamicTabs = tabs.filter((t) => t.closable)
      const fixedTabs = tabs.filter((t) => !t.closable)
      const draggedIdx = dynamicTabs.findIndex((t) => t.key === draggedTabKey)
      const dropIdx = dynamicTabs.findIndex((t) => t.key === dropTabKey)

      if (draggedIdx !== -1 && dropIdx !== -1) {
        const newDynamicTabs = [...dynamicTabs]
        const [draggedTab] = newDynamicTabs.splice(draggedIdx, 1)
        newDynamicTabs.splice(dropIdx, 0, draggedTab)
        setTabs([...fixedTabs, ...newDynamicTabs])
      }
    }
    setDraggedTabKey(null)
  }

  const handleDragEnd = () => {
    setDraggedTabKey(null)
  }

  // Limpiar mensaje después de 3 segundos
  useEffect(() => {
    if (mensaje) {
      const timer = setTimeout(() => setMensaje(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [mensaje])

  // Obtener datos del tab activo
  const activeTabData = tabs.find((t) => t.key === activeTab)?.data || null

  return (
    <div className={theme.fondo}>
      <div className={theme.patron}></div>
      <div className={theme.overlay}></div>

      <div className="relative z-10">
        <Navbar />

        <div className="py-8 px-4">
          <div className="max-w-[1400px] w-full mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Caja y Tesorería</h2>
            </div>

            {/* Mensaje de feedback */}
            {mensaje && (
              <div
                className={`mb-4 p-4 rounded-lg ${
                  mensaje.tipo === "exito"
                    ? "bg-green-100 text-green-800 border border-green-300"
                    : "bg-red-100 text-red-800 border border-red-300"
                }`}
              >
                {mensaje.texto}
              </div>
            )}

            {/* Contenedor principal con tabs */}
            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200 max-w-full">
              {/* Tabs tipo browser */}
              <div className="flex items-center border-b border-slate-700 px-6 pt-3 bg-gradient-to-r from-slate-800 to-slate-700">
                {tabs.map((tab) => (
                  <div
                    key={tab.key}
                    className={`flex items-center px-5 py-3 mr-2 rounded-t-lg cursor-pointer transition-colors ${
                      activeTab === tab.key ? theme.tabActiva : theme.tabInactiva
                    }`}
                    onClick={() => setActiveTab(tab.key)}
                    style={{ position: "relative", zIndex: 1 }}
                    draggable={tab.closable}
                    onDragStart={
                      tab.closable
                        ? (e) => {
                            handleDragStart(tab.key)
                            e.dataTransfer.effectAllowed = "move"
                          }
                        : undefined
                    }
                    onDrop={
                      tab.closable
                        ? (e) => {
                            e.preventDefault()
                            handleDrop(tab.key)
                          }
                        : undefined
                    }
                    onDragEnd={handleDragEnd}
                  >
                    {tab.label}
                    {tab.closable && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTab(tab.key)
                        }}
                        className="ml-3 text-lg font-bold text-slate-400 hover:text-red-500 focus:outline-none transition-colors"
                        title="Cerrar"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Contenido del tab activo */}
              <div className="flex-1 p-4 overflow-y-auto">
                {activeTab === "historial" && (
                  <CajasHistorialTable
                    onCajaClick={handleCajaClick}
                    onAbrirCaja={() => setModalAbrirVisible(true)}
                    tieneCajaAbierta={tieneCajaAbierta}
                  />
                )}

                {activeTab === "bancos" && <MaestroBancos />}
                {activeTab === "valores-en-cartera" && <ValoresEnCartera />}

                {activeTab === "caja-actual" && (
                  <CajaActualTab
                    sesion={sesionActual}
                    resumen={resumenCaja}
                    movimientos={movimientos}
                    onRefrescar={handleRefrescar}
                    onCerrarCaja={handleCerrarCaja}
                    onNuevoMovimiento={handleNuevoMovimiento}
                    loading={loading}
                    onIrValoresEnCartera={() => setActiveTab("valores-en-cartera")}
                  />
                )}

                {activeTab.startsWith("caja-") && activeTabData && (
                  <CajaDetalleView sesionId={activeTabData.id} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de abrir caja */}
      {modalAbrirVisible && (
        <ModalAbrirCaja
          onConfirmar={handleAbrirCaja}
          onCancelar={() => setModalAbrirVisible(false)}
          loading={loading}
        />
      )}
    </div>
  )
}

export default CajaManager
