"use client"

import React, { useState, useEffect } from "react"
import Navbar from "../Navbar"

// Hooks API (rutas ajustadas un nivel arriba)
import { useBarriosAPI } from "../../utils/useBarriosAPI"
import { useLocalidadesAPI } from "../../utils/useLocalidadesAPI"
import { useProvinciasAPI } from "../../utils/useProvinciasAPI"
import { useTiposIVAAPI } from "../../utils/useTiposIVAAPI"
import { useTransportesAPI } from "../../utils/useTransportesAPI"
import { useVendedoresAPI } from "../../utils/useVendedoresAPI"
import { usePlazosAPI } from "../../utils/usePlazosAPI"
import { useCategoriasAPI } from "../../utils/useCategoriasAPI"
import { useClientesAPI } from "../../utils/useClientesAPI"

// Componentes hijos extraídos
import ClientesTable from "./ClientesTable"
import ClienteForm from "./ClienteForm"

// Contenedor principal de gestión de clientes
const ClientesManager = () => {
  // ------ Cambiar título página ------
  useEffect(() => {
    document.title = "Clientes FerreDesk"
  }, [])

  // Hook centralizado de clientes (alta / edición / eliminación)
  const { clientes, loading, error, addCliente, updateCliente, deleteCliente, clearError } = useClientesAPI()

  // Búsqueda
  const [search, setSearch] = useState("")
  const [searchInactivos, setSearchInactivos] = useState("")

  // ---------- Tabs tipo navegador ----------
  const [tabs, setTabs] = useState(() => {
    const savedTabs = localStorage.getItem("clientesTabs")
    // Empezamos con un array base de las pestañas que el usuario pueda tener.
    let currentTabs = savedTabs ? JSON.parse(savedTabs) : []

    // Aseguramos que "Lista de Clientes" esté presente y configurada correctamente.
    let listaTab = currentTabs.find((t) => t.key === "lista")
    if (listaTab) {
      listaTab.closable = false // No se puede cerrar
    } else {
      // Si no existe, la añadimos al principio.
      currentTabs.unshift({ key: "lista", label: "Lista de Clientes", closable: false })
    }

    // Aseguramos que "Clientes Inactivos" esté presente y configurada.
    let inactivosTab = currentTabs.find((t) => t.key === "inactivos")
    if (inactivosTab) {
      inactivosTab.closable = false // No se puede cerrar
    } else {
      // Si no existe, la insertamos justo después de "Lista de Clientes".
      const listaIndex = currentTabs.findIndex((t) => t.key === "lista")
      currentTabs.splice(listaIndex + 1, 0, { key: "inactivos", label: "Clientes Inactivos", closable: false })
    }

    return currentTabs
  })

  const [activeTab, setActiveTab] = useState(() => {
    const savedActiveTab = localStorage.getItem("clientesActiveTab")
    return savedActiveTab || "lista"
  })

  const [editCliente, setEditCliente] = useState(null)
  const [expandedClientId, setExpandedClientId] = useState(null)
  const [user, setUser] = useState(null)

  // Persistencia de tabs
  useEffect(() => {
    localStorage.setItem("clientesTabs", JSON.stringify(tabs))
    localStorage.setItem("clientesActiveTab", activeTab)
  }, [tabs, activeTab])

  // Info usuario (para Navbar)
  useEffect(() => {
    fetch("/api/user/", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") setUser(data.user)
      })
  }, [])

  const handleLogout = () => {
    fetch("/api/logout/", { method: "POST", credentials: "include" }).then(() => {
      window.location.href = "/login"
    })
  }

  // -------- Navegación de sub-pestañas --------
  const openTab = (key, label, cliente = null) => {
    if (key === "nuevo") clearError()
    setEditCliente(cliente)
    setTabs((prev) => {
      if (prev.find((t) => t.key === key)) return prev
      return [...prev, { key, label, closable: true }]
    })
    setActiveTab(key)
  }

  const closeTab = (key) => {
    setTabs((prev) => prev.filter((t) => t.key !== key))
    if (activeTab === key) setActiveTab("lista")
    setEditCliente(null)
    if (key === "nuevo") clearError()
  }

  // Guardar cliente (alta / edición)
  const handleSaveCliente = async (data) => {
    let exito = false
    if (editCliente) {
      exito = await updateCliente(editCliente.id, data)
    } else {
      exito = await addCliente(data)
    }
    if (exito) closeTab("nuevo")
  }

  // Eliminar cliente
  const handleDeleteCliente = (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este cliente?")) {
      deleteCliente(id)
    }
  }

  // Editar cliente
  const handleEditCliente = (cliente) => {
    openTab("nuevo", "Nuevo Cliente", cliente)
  }

  // Filtrado de clientes activos e inactivos con useMemo para optimización
  const clientesActivos = React.useMemo(() => clientes.filter((c) => c.activo === "A"), [clientes])
  const clientesInactivos = React.useMemo(() => clientes.filter((c) => c.activo !== "A"), [clientes])

  // ---------- Hooks de entidades relacionales ----------
  const { barrios, setBarrios } = useBarriosAPI()
  const { localidades, setLocalidades } = useLocalidadesAPI()
  const { provincias, setProvincias } = useProvinciasAPI()
  const { transportes, setTransportes } = useTransportesAPI()
  const { vendedores, setVendedores } = useVendedoresAPI()
  const { plazos, setPlazos } = usePlazosAPI()
  const { categorias, setCategorias } = useCategoriasAPI()
  const { tiposIVA } = useTiposIVAAPI()

  // ---------- Render ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30 flex flex-col">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="flex justify-between items-center px-6 py-4">
        <h2 className="text-2xl font-bold text-slate-800">Gestión de Clientes</h2>
      </div>

      <div className="flex flex-1 px-6 gap-4 min-h-0">
        <div className="flex-1 flex flex-col">
          {/* Barra de pestañas */}
          <div className="flex items-center border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 shadow-sm">
            {tabs.map((tab) => (
              <div
                key={tab.key}
                className={`flex items-center px-5 py-2 mr-2 rounded-t-xl cursor-pointer transition-colors ${
                  activeTab === tab.key
                    ? "bg-white border border-b-0 border-slate-200 font-semibold text-slate-800 shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                onClick={() => setActiveTab(tab.key)}
                style={{ position: "relative" }}
              >
                {tab.label}
                {tab.closable && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.key)
                    }}
                    className="ml-2 text-lg font-bold text-slate-400 hover:text-red-500 focus:outline-none transition-colors"
                    title="Cerrar"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            {/* Botón Nuevo Cliente solo en la tab de lista */}
            {activeTab === "lista" && (
              <div className="flex-1 flex justify-end mb-2">
                <button
                  onClick={() => openTab("nuevo", "Nuevo Cliente")}
                  className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
                >
                  <span className="text-lg">+</span> Nuevo Cliente
                </button>
              </div>
            )}
          </div>

          {/* Contenido de pestañas */}
          <div className="flex-1 bg-white rounded-b-xl shadow-md min-h-0 p-6 border border-slate-200">
            {activeTab === "lista" && (
              <ClientesTable
                clientes={clientesActivos}
                onEdit={handleEditCliente}
                onDelete={handleDeleteCliente}
                search={search}
                setSearch={setSearch}
                expandedClientId={expandedClientId}
                setExpandedClientId={setExpandedClientId}
                barrios={barrios}
                localidades={localidades}
                provincias={provincias}
                tiposIVA={tiposIVA}
                transportes={transportes}
                vendedores={vendedores}
                plazos={plazos}
                categorias={categorias}
              />
            )}

            {activeTab === "inactivos" && (
              <ClientesTable
                clientes={clientesInactivos}
                onEdit={handleEditCliente}
                onDelete={handleDeleteCliente}
                search={searchInactivos}
                setSearch={setSearchInactivos}
                expandedClientId={expandedClientId}
                setExpandedClientId={setExpandedClientId}
                barrios={barrios}
                localidades={localidades}
                provincias={provincias}
                tiposIVA={tiposIVA}
                transportes={transportes}
                vendedores={vendedores}
                plazos={plazos}
                categorias={categorias}
              />
            )}

            {activeTab === "nuevo" && (
              <div className="flex justify-center items-center min-h-[60vh]">
                <ClienteForm
                  onSave={handleSaveCliente}
                  onCancel={() => closeTab("nuevo")}
                  initialData={editCliente}
                  barrios={barrios}
                  localidades={localidades}
                  provincias={provincias}
                  transportes={transportes}
                  vendedores={vendedores}
                  plazos={plazos}
                  categorias={categorias}
                  setBarrios={setBarrios}
                  setLocalidades={setLocalidades}
                  setProvincias={setProvincias}
                  setTransportes={setTransportes}
                  setVendedores={setVendedores}
                  setPlazos={setPlazos}
                  setCategorias={setCategorias}
                  tiposIVA={tiposIVA}
                  apiError={error}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && <div className="p-4 text-center text-slate-600">Cargando clientes...</div>}
      {error && (
        <div className="p-4 text-center text-red-600 bg-red-50 mx-6 rounded-lg border border-red-200">{error}</div>
      )}
    </div>
  )
}

export default ClientesManager 