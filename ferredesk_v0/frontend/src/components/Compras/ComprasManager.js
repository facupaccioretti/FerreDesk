"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import Navbar from "../Navbar"
import ComprasList from "./ComprasList"
import CompraForm from "./CompraForm"
import DetalleCompra from "./DetalleCompra"
import { useComprasAPI } from "../../utils/useComprasAPI"
import { useProveedoresAPI } from "../../utils/useProveedoresAPI"
import { useProductosAPI } from "../../utils/useProductosAPI"
import { useAlicuotasIVAAPI } from "../../utils/useAlicuotasIVAAPI"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

const MAIN_TAB_KEY = "compras"

const ComprasManager = () => {
  const theme = useFerreDeskTheme()
  
  const [user, setUser] = useState(null)
  const [search, setSearch] = useState("")
  
  // Estado para controlar el modal de detalle
  const [detalleModal, setDetalleModal] = useState({ abierto: false, compra: null })

  // Tabs estado (persistencia simple en localStorage)
  const [tabs, setTabs] = useState(() => {
    try {
      const saved = localStorage.getItem("comprasTabs")
      const parsed = saved ? JSON.parse(saved) : null
      const base = [{ key: MAIN_TAB_KEY, label: "Compras", closable: false }]
      if (!parsed || !Array.isArray(parsed) || parsed.length === 0) return base
      // Asegurar que la pestaña principal exista
      const hasMain = parsed.some((t) => t.key === MAIN_TAB_KEY)
      return hasMain ? parsed : [base[0], ...parsed]
    } catch {
      return [{ key: MAIN_TAB_KEY, label: "Compras", closable: false }]
    }
  })
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem("comprasActiveTab") || MAIN_TAB_KEY)
  const persistTimeout = useRef(null)
  useEffect(() => {
    clearTimeout(persistTimeout.current)
    persistTimeout.current = setTimeout(() => {
      localStorage.setItem("comprasTabs", JSON.stringify(tabs))
      localStorage.setItem("comprasActiveTab", activeTab)
    }, 200)
    return () => clearTimeout(persistTimeout.current)
  }, [tabs, activeTab])

  const openTab = useCallback((key, label, data = null, tipo = null) => {
    setTabs((prev) => {
      if (prev.find((t) => t.key === key)) return prev
      return [...prev, { key, label, closable: true, data, tipo }]
    })
    setActiveTab(key)
  }, []) // Las funciones setState son estables

  const closeTab = useCallback((key) => {
    setTabs((prev) => prev.filter((t) => t.key !== key))
    if (activeTab === key) setActiveTab(MAIN_TAB_KEY)
  }, [activeTab]) // Depende del valor de activeTab

  // APIs
  const {
    compras,
    loading: loadingCompras,
    error: errorCompras,
    fetchCompras,
    addCompra,
    updateCompra,
    deleteCompra,
    cerrarCompra,
    anularCompra,
  } = useComprasAPI()

  const { proveedores, loading: loadingProveedores, error: errorProveedores } = useProveedoresAPI()
  const { productos, loading: loadingProductos, error: errorProductos } = useProductosAPI()
  const { alicuotas, loading: loadingAlicuotas, error: errorAlicuotas } = useAlicuotasIVAAPI()

  const sucursales = [{ id: 1, nombre: "Casa Central" }]

  useEffect(() => {
    fetch("/api/user/", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") setUser(data.user)
      })
  }, [])

  const handleLogout = () => {
    setUser(null)
    window.location.href = "/login"
  }

  useEffect(() => {
    document.title = "Compras FerreDesk"
  }, [])

  // Efecto para cargar compras con filtros
  useEffect(() => {
    const filters = {}
    if (search.trim()) {
      // Buscar en número de factura o razón social del proveedor
      filters.search = search.trim()
    }
    fetchCompras(filters)
  }, [search, fetchCompras])

  // Acciones tabs
  const handleNuevaCompra = useCallback(() => {
    const key = `nueva-compra-${Date.now()}`
    openTab(key, "Nueva Compra", null, "form")
  }, [openTab])

  const handleEditarCompra = useCallback((compra) => {
    const key = `editar-${compra.comp_id}`
    openTab(key, `Editar ${compra.comp_numero_factura || compra.comp_id}`, compra, "form")
  }, [openTab])

  const handleVerCompra = useCallback((compra) => {
    setDetalleModal({ abierto: true, compra })
  }, [])

  const handleGuardarCompra = useCallback(async (tabKey, compraData, existing = null) => {
    try {
      if (existing && existing.comp_id) {
        await updateCompra(existing.comp_id, compraData)
      } else {
        await addCompra(compraData)
      }
      await fetchCompras()
      closeTab(tabKey)
    } catch (error) {
      console.error("Error al guardar compra:", error)
    }
  }, [updateCompra, addCompra, fetchCompras, closeTab])

  const handleCerrarCompra = useCallback(async (compraId) => {
    try {
      await cerrarCompra(compraId)
      fetchCompras()
    } catch (error) {
      console.error("Error al cerrar compra:", error)
    }
  }, [cerrarCompra, fetchCompras])

  const handleAnularCompra = useCallback(async (compraId) => {
    try {
      await anularCompra(compraId)
      fetchCompras()
    } catch (error) {
      console.error("Error al anular compra:", error)
    }
  }, [anularCompra, fetchCompras])

  const handleEliminarCompra = useCallback(async (compraId) => {
    if (window.confirm("¿Está seguro de que desea eliminar esta compra?")) {
      try {
        await deleteCompra(compraId)
        fetchCompras()
      } catch (error) {
        console.error("Error al eliminar compra:", error)
      }
    }
  }, [deleteCompra, fetchCompras])

  const activeTabData = useMemo(() => tabs.find((t) => t.key === activeTab)?.data || null, [tabs, activeTab])

  return (
    <div className={theme.fondo}>
      <div className={theme.patron}></div>
      <div className={theme.overlay}></div>
      
      <Navbar user={user} onLogout={handleLogout} />

      <div className="py-8 px-4 relative z-10">
        <div className="max-w-[1400px] w-full mx-auto">
          {/* Título de la página (fuera del contenedor) */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Gestión de Compras</h2>
          </div>

          {/* Tarjeta contenedora principal con tabs */}
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-md overflow-hidden">
            {/* Barra de tabs estilo navegador con encabezado azul FerreDesk */}
            <div className="border-b border-slate-700 px-6 pt-3 bg-gradient-to-r from-slate-800 to-slate-700">
              {tabs.map((tab) => (
                <div
                  key={tab.key}
                  className={`inline-flex items-center px-5 py-3 mr-2 rounded-t-lg cursor-pointer transition-colors ${activeTab === tab.key ? theme.tabActiva : theme.tabInactiva}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  {tab.closable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(tab.key)
                      }}
                      className="ml-3 text-lg font-bold text-slate-300 hover:text-red-400 focus:outline-none transition-colors"
                      title="Cerrar"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Contenido por tab */}
            <div className="flex-1 p-6">
              {activeTab === MAIN_TAB_KEY ? (
                <>
                  {/* Botón Nueva Compra arriba de la tabla */}
                  <div className="mb-4 flex justify-start">
                    <button
                      onClick={handleNuevaCompra}
                      className={theme.botonPrimario}
                    >
                      <span className="text-lg">+</span> Nueva Compra
                    </button>
                  </div>
                  
                  <ComprasList
                    compras={compras}
                    loading={loadingCompras}
                    error={errorCompras}
                    search={search}
                    setSearch={setSearch}
                    onNuevaCompra={handleNuevaCompra}
                    onEditarCompra={handleEditarCompra}
                    onVerCompra={handleVerCompra}
                    onCerrarCompra={handleCerrarCompra}
                    onAnularCompra={handleAnularCompra}
                    onEliminarCompra={handleEliminarCompra}
                    onRefresh={fetchCompras}
                  />
                </>
              ) : (
                <CompraForm
                  key={activeTab}
                  onSave={(data) => handleGuardarCompra(activeTab, data, activeTabData)}
                  onCancel={() => closeTab(activeTab)}
                  initialData={activeTabData}
                  readOnly={false}
                  proveedores={proveedores}
                  productos={productos}
                  alicuotas={alicuotas}
                  sucursales={sucursales}
                  loadingProveedores={loadingProveedores}
                  loadingProductos={loadingProductos}
                  loadingAlicuotas={loadingAlicuotas}
                  errorProveedores={errorProveedores}
                  errorProductos={errorProductos}
                  errorAlicuotas={errorAlicuotas}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de detalle de compra */}
      {detalleModal.abierto && (
        <DetalleCompra
          compra={detalleModal.compra}
          onClose={() => setDetalleModal({ abierto: false, compra: null })}
        />
      )}
    </div>
  )
}

export default ComprasManager
