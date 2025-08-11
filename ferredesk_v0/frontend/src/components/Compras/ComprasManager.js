"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import Navbar from "../Navbar"
import ComprasList from "./ComprasList"
import CompraForm from "./CompraForm"
import { useComprasAPI } from "../../utils/useComprasAPI"
import { useProveedoresAPI } from "../../utils/useProveedoresAPI"
import { useProductosAPI } from "../../utils/useProductosAPI"
import { useAlicuotasIVAAPI } from "../../utils/useAlicuotasIVAAPI"

const MAIN_TAB_KEY = "compras"

const ComprasManager = () => {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

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

  const openTab = (key, label, data = null, tipo = null) => {
    setTabs((prev) => {
      if (prev.find((t) => t.key === key)) return prev
      return [...prev, { key, label, closable: true, data, tipo }]
    })
    setActiveTab(key)
  }

  const closeTab = (key) => {
    setTabs((prev) => prev.filter((t) => t.key !== key))
    if (activeTab === key) setActiveTab(MAIN_TAB_KEY)
  }

  const updateTabData = (key, label, data, tipo = null) => {
    setTabs((prev) => {
      const exists = prev.find((t) => t.key === key)
      if (exists) {
        return prev.map((t) => (t.key === key ? { ...t, label: label || t.label, data, tipo: tipo || t.tipo } : t))
      }
      return [...prev, { key, label, closable: true, data, tipo }]
    })
    setActiveTab(key)
  }

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
    document.title = "Sistema de Compras FerreDesk"
  }, [])

  // Acciones tabs
  const handleNuevaCompra = () => {
    const key = `nueva-compra-${Date.now()}`
    openTab(key, "Nueva Compra", null, "form")
  }

  const handleEditarCompra = (compra) => {
    const key = `editar-${compra.comp_id}`
    openTab(key, `Editar ${compra.comp_numero_factura || compra.comp_id}`, compra, "form")
  }

  const handleVerCompra = (compra) => {
    const key = `ver-${compra.comp_id}`
    openTab(key, `Ver ${compra.comp_numero_factura || compra.comp_id}`, compra, "view")
  }

  const handleGuardarCompra = async (tabKey, compraData, existing = null) => {
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
  }

  const handleCerrarCompra = async (compraId) => {
    try {
      await cerrarCompra(compraId)
      fetchCompras()
    } catch (error) {
      console.error("Error al cerrar compra:", error)
    }
  }

  const handleAnularCompra = async (compraId) => {
    try {
      await anularCompra(compraId)
      fetchCompras()
    } catch (error) {
      console.error("Error al anular compra:", error)
    }
  }

  const handleEliminarCompra = async (compraId) => {
    if (window.confirm("¿Está seguro de que desea eliminar esta compra?")) {
      try {
        await deleteCompra(compraId)
        fetchCompras()
      } catch (error) {
        console.error("Error al eliminar compra:", error)
      }
    }
  }

  const activeTabData = useMemo(() => tabs.find((t) => t.key === activeTab)?.data || null, [tabs, activeTab])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="py-8 px-4">
        <div className="max-w-[1400px] w-full mx-auto">
          {/* Título de la página (fuera del contenedor) */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-slate-800">Sistema de Compras</h2>
          </div>

          {/* Tarjeta contenedora principal con tabs */}
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-md overflow-hidden border border-slate-200 max-w-[1400px] mx-auto">
            {/* Barra de tabs estilo navegador */}
            <div className="flex items-center border-b border-slate-200 px-6 pt-3 bg-slate-50">
              {tabs.map((tab) => (
                <div
                  key={tab.key}
                  className={`flex items-center px-5 py-3 mr-2 rounded-t-lg cursor-pointer transition-colors ${
                    activeTab === tab.key
                      ? "bg-white border border-b-0 border-slate-200 font-semibold text-slate-800 shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  onClick={() => setActiveTab(tab.key)}
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

            {/* Contenido por tab */}
            <div className="flex-1 p-6">
              {activeTab === MAIN_TAB_KEY ? (
                <>
                  {/* Toolbar dentro del contenedor */}
                  <div className="mb-4 flex gap-2">
                    <button
                      onClick={handleNuevaCompra}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
                    >
                      <span className="text-lg">+</span> Nueva Compra
                    </button>
                  </div>

                  <ComprasList
                    compras={compras}
                    loading={loadingCompras}
                    error={errorCompras}
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
                // Formularios de compra en pestañas dinámicas (crear/editar/ver)
                <CompraForm
                  key={activeTab}
                  onSave={(data) => handleGuardarCompra(activeTab, data, activeTabData)}
                  onCancel={() => closeTab(activeTab)}
                  initialData={activeTabData}
                  readOnly={tabs.find((t) => t.key === activeTab)?.tipo === "view"}
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
    </div>
  )
}

export default ComprasManager
