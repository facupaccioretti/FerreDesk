"use client"

import React, { useState, useEffect } from "react"
import Navbar from "../Navbar"
import Tabla from "../Tabla"
import { getCookie } from "../../utils/csrf"

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
import MaestroModal from "./MaestrosModales"
import { BotonEditar } from "../Botones"

// Hook del tema de FerreDesk
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

// Contenedor principal de gestión de clientes
const ClientesManager = () => {
  // Hook del tema de FerreDesk
  const theme = useFerreDeskTheme()
  
  // ------ Cambiar título página ------
  useEffect(() => {
    document.title = "Clientes FerreDesk"
  }, [])

  // Hook centralizado de clientes (alta / edición / eliminación)
  const { clientes, loading, error, fetchClientes, addCliente, updateCliente, deleteCliente, clearError } = useClientesAPI()

  // Mostrar errores como alert nativo del navegador
  useEffect(() => {
    if (error) {
      window.alert(error)
      clearError()
    }
  }, [error, clearError])

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

    // Aseguramos que "Maestros" esté presente y configurada.
    let maestrosTab = currentTabs.find((t) => t.key === "maestros")
    if (maestrosTab) {
      maestrosTab.closable = false
    } else {
      // Insertar "Maestros" después de "Clientes Inactivos"
      const inactivosIndex = currentTabs.findIndex((t) => t.key === "inactivos")
      const insertIndex = inactivosIndex >= 0 ? inactivosIndex + 1 : 1
      currentTabs.splice(insertIndex, 0, { key: "maestros", label: "Maestros", closable: false })
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
    if (key.startsWith("nuevo")) clearError()
    setEditCliente(cliente)
    setTabs((prev) => {
      if (prev.find((t) => t.key === key)) return prev
      return [...prev, { key, label, closable: true, cliente }]
    })
    setActiveTab(key)
  }

  const closeTab = (key) => {
    setTabs((prev) => prev.filter((t) => t.key !== key))
    if (activeTab === key) setActiveTab("lista")
    setEditCliente(null)
    if (String(key).startsWith("nuevo")) clearError()
  }

  // Guardar cliente (alta / edición)
  const handleSaveCliente = async (data, tabKeyParam) => {
    let exito = false
    if (editCliente) {
      exito = await updateCliente(editCliente.id, data)
    } else {
      exito = await addCliente(data)
    }
    if (exito) {
      const keyToClose = tabKeyParam || activeTab || "nuevo"
      closeTab(keyToClose)
    }
  }

  // Eliminar cliente
  const handleDeleteCliente = (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este cliente?")) {
      deleteCliente(id)
    }
  }

  // Editar cliente
  const handleEditCliente = (cliente) => {
    const razon = cliente?.razon || cliente?.fantasia || cliente?.nombre || "Cliente"
    const key = `cliente-${cliente?.id || "sinid"}-${Date.now()}`
    openTab(key, `Editar: ${razon}`, cliente)
  }

  // Filtrado de clientes activos e inactivos con useMemo para optimización
  const clientesActivos = React.useMemo(() => clientes.filter((c) => c.activo === "A"), [clientes])
  const clientesInactivos = React.useMemo(() => clientes.filter((c) => c.activo !== "A"), [clientes])

  // ---------- Hooks de entidades relacionales ----------
  const { barrios, setBarrios, fetchBarrios } = useBarriosAPI()
  const { localidades, setLocalidades, fetchLocalidades } = useLocalidadesAPI()
  const { provincias, setProvincias, fetchProvincias } = useProvinciasAPI()
  const { transportes, setTransportes, fetchTransportes } = useTransportesAPI()
  const { vendedores, setVendedores } = useVendedoresAPI()
  const { plazos, setPlazos, fetchPlazos } = usePlazosAPI()
  const { categorias, setCategorias, fetchCategorias } = useCategoriasAPI()
  const { tiposIVA } = useTiposIVAAPI()

  // ------------------------ Estado pestaña Maestros ------------------------
  const [catalogoSeleccionado, setCatalogoSeleccionado] = useState("categorias")
  const [searchMaestros, setSearchMaestros] = useState("")
  const [ocultarInactivos, setOcultarInactivos] = useState(true)
  const [modalMaestro, setModalMaestro] = useState({ open: false, tipo: null, modo: null, data: null })
  const [modalForm, setModalForm] = useState({})
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState("")

  const csrftoken = getCookie("csrftoken")

  const obtenerColeccionActual = () => {
    switch (catalogoSeleccionado) {
      case "barrios":
        return { datos: barrios, fetch: fetchBarrios, set: setBarrios, url: "/api/clientes/barrios/", tipo: "barrio" }
      case "localidades":
        return { datos: localidades, fetch: fetchLocalidades, set: setLocalidades, url: "/api/clientes/localidades/", tipo: "localidad" }
      case "provincias":
        return { datos: provincias, fetch: fetchProvincias, set: setProvincias, url: "/api/clientes/provincias/", tipo: "provincia" }
      case "transportes":
        return { datos: transportes, fetch: fetchTransportes, set: setTransportes, url: "/api/clientes/transportes/", tipo: "transporte" }
      case "plazos":
        return { datos: plazos, fetch: fetchPlazos, set: setPlazos, url: "/api/clientes/plazos/", tipo: "plazo" }
      case "categorias":
      default:
        return { datos: categorias, fetch: fetchCategorias, set: setCategorias, url: "/api/clientes/categorias/", tipo: "categoria" }
    }
  }

  const abrirModalNuevo = () => {
    const { tipo } = obtenerColeccionActual()
    setModalForm({})
    setModalError("")
    setModalMaestro({ open: true, tipo, modo: "nuevo", data: null })
  }

  const abrirModalEditar = (fila) => {
    const { tipo } = obtenerColeccionActual()
    setModalForm({ ...fila })
    setModalError("")
    setModalMaestro({ open: true, tipo, modo: "editar", data: fila })
  }

  const cerrarModal = () => {
    setModalMaestro({ open: false, tipo: null, modo: null, data: null })
    setModalForm({})
    setModalError("")
  }

  const guardarModal = async (values) => {
    const { url, fetch: refetchColeccion, tipo } = obtenerColeccionActual()
    setModalLoading(true)
    setModalError("")
    try {
      const esEdicion = modalMaestro.modo === "editar"
      const endpoint = esEdicion ? `${url}${modalMaestro?.data?.id || ""}/` : url
      let body = {}
      switch (tipo) {
        case "barrio":
          body = { nombre: (values?.nombre ?? modalForm.nombre), activo: (values?.activo ?? modalForm.activo) || "S" }
          break
        case "localidad":
          body = { nombre: (values?.nombre ?? modalForm.nombre), activo: (values?.activo ?? modalForm.activo) || "S" }
          break
        case "provincia":
          body = { nombre: (values?.nombre ?? modalForm.nombre), activo: (values?.activo ?? modalForm.activo) || "S" }
          break
        case "transporte":
          body = { nombre: (values?.nombre ?? modalForm.nombre), localidad: (values?.localidad ?? modalForm.localidad), activo: (values?.activo ?? modalForm.activo) || "S" }
          break
        case "plazo": {
          const fuente = values || modalForm
          body = { nombre: fuente.nombre, activo: fuente.activo || "S" }
          for (let i = 1; i <= 12; i += 1) {
            const keyPlazo = `pla_pla${i}`
            const keyPorcentaje = `pla_por${i}`
            if (Object.prototype.hasOwnProperty.call(fuente, keyPlazo)) {
              body[keyPlazo] = fuente[keyPlazo]
            }
            if (Object.prototype.hasOwnProperty.call(fuente, keyPorcentaje)) {
              body[keyPorcentaje] = fuente[keyPorcentaje]
            }
          }
          break
        }
        case "categoria":
          body = { nombre: (values?.nombre ?? modalForm.nombre), activo: (values?.activo ?? modalForm.activo) || "S" }
          break
        default:
          break
      }

      const res = await window.fetch(endpoint, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrftoken },
        credentials: "include",
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Error al guardar")
      await refetchColeccion()
      cerrarModal()
    } catch (e) {
      setModalError(e.message || "Error al guardar")
    } finally {
      setModalLoading(false)
    }
  }

  // Inactivación deshabilitada en la tabla de Maestros (función removida)

  // Sin exportación CSV por pedido: se eliminó la funcionalidad de exportar

  // Modal inline antiguo eliminado (se usa MaestroModal). Mantengo función vacía para referencia.
  // eslint-disable-next-line no-unused-vars
  const renderModalContenido = () => null

  // ------------------------------------------------------------------
  // Efecto: cada vez que cambia 'search' realizamos consulta filtrada al
  // backend usando __icontains sobre razón y fantasía.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (search && search.trim() !== "") {
        fetchClientes({ razon__icontains: search.trim(), fantasia__icontains: search.trim() })
      } else {
        fetchClientes()
      }
    }, 300) // Debounce simple
    return () => clearTimeout(timeout)
  }, [search, fetchClientes])

  // Eliminar cualquier renderizado visual de error relacionado a 'error' en la UI

  // ---------- Render ----------
  return (
    <div className={theme.fondo}>
      <div className={theme.patron}></div>
      <div className={theme.overlay}></div>
      
      <div className="relative z-10">
        <Navbar user={user} onLogout={handleLogout} />

        {/* Contenedor central con ancho máximo fijo al estilo de PresupuestosManager */}
        <div className="py-8 px-4">
          <div className="max-w-[1400px] w-full mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Gestión de Clientes</h2>
            </div>

          {/* Área principal: pestañas y contenido */}
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200 max-w-full">
            {/* Tabs tipo browser - Encabezado azul oscuro */}
            <div className="flex items-center border-b border-slate-700 px-6 pt-3 bg-gradient-to-r from-slate-800 to-slate-700">
              {tabs.map((tab) => (
                <div
                  key={tab.key}
                  className={`flex items-center px-5 py-3 mr-2 rounded-t-lg cursor-pointer transition-colors ${
                    activeTab === tab.key
                      ? theme.tabActiva
                      : theme.tabInactiva
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                  style={{ position: "relative", zIndex: 1 }}
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
            
            <div className="flex-1 p-6">
              {/* Botón Nuevo Cliente solo en la tab de lista */}
              {activeTab === "lista" && (
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={() => openTab(`nuevo-${Date.now()}`, "Nuevo Cliente")}
                    className={theme.botonPrimario}
                  >
                    <span className="text-lg">+</span> Nuevo Cliente
                  </button>
                </div>
              )}

              {/* Contenido de pestañas */}
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

              {activeTab === "maestros" && (() => {
                const { datos } = obtenerColeccionActual()
                const datosVisibles = ocultarInactivos ? datos.filter((d) => d.activo === "S") : datos

                const columnas = [
                  { id: "nombre", titulo: "Nombre" },
                  {
                    id: "estado",
                    titulo: "Estado",
                    render: (fila) => (
                      <span className={`px-2 py-0.5 rounded-full text-[11px] ${fila.activo === "S" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {fila.activo === "S" ? "Activo" : "Inactivo"}
                      </span>
                    ),
                    align: "center",
                    ancho: 120,
                  },
                  {
                    id: "acciones",
                    titulo: "Acciones",
                    render: (fila) => (
                      <div className="flex items-center gap-2 justify-end">
                        <BotonEditar onClick={() => abrirModalEditar(fila)} />
                      </div>
                    ),
                    align: "right",
                    ancho: 100,
                  },
                ]

                return (
                  <div className="flex flex-col gap-4">
                    {/* Controles superiores de Maestros */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Selector de catálogo */}
                      <div className="flex flex-wrap gap-2">
                        {["categorias","provincias","localidades","barrios","transportes","plazos"].map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setCatalogoSeleccionado(cat)}
                            className={`${catalogoSeleccionado === cat ? theme.tabActiva : `bg-gradient-to-r ${theme.primario} text-white`} px-3 py-1 rounded-lg`}
                          >
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </button>
                        ))}
                      </div>

                      <div className="ml-auto flex items-center gap-2">
                        <label className="flex items-center gap-1 text-sm text-slate-700">
                          <input type="checkbox" checked={ocultarInactivos} onChange={(e) => setOcultarInactivos(e.target.checked)} />
                          Ocultar inactivos
                        </label>
                        <button onClick={abrirModalNuevo} className={theme.botonPrimario}><span className="text-lg">+</span> Nuevo</button>
                      </div>
                    </div>

                    {/* Tabla de catálogo */}
                    <Tabla
                      columnas={columnas}
                      datos={datosVisibles}
                      valorBusqueda={searchMaestros}
                      onCambioBusqueda={setSearchMaestros}
                    />
                  </div>
                )
              })()}

              {activeTab !== "lista" && activeTab !== "inactivos" && activeTab !== "maestros" && (
                <div className="flex justify-center items-center min-h-[60vh]">
                  {(() => {
                    const tabActual = tabs.find((t) => t.key === activeTab)
                    const initialData = tabActual?.cliente || null
                    return (
                      <ClienteForm
                        key={activeTab}
                        onSave={(data) => handleSaveCliente(data, activeTab)}
                        onCancel={() => closeTab(activeTab)}
                        initialData={initialData}
                        tabKey={activeTab}
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
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Modal genérico para Maestros modularizado */}
      {modalMaestro.open && (
        <MaestroModal
          open={modalMaestro.open}
          tipo={modalMaestro.tipo}
          modo={modalMaestro.modo}
          initialValues={modalForm}
          localidades={localidades}
          loading={modalLoading}
          error={modalError}
          onCancel={cerrarModal}
          onSubmit={(values) => guardarModal(values)}
        />
      )}

      {loading && <div className="p-4 text-center text-slate-600">Cargando clientes...</div>}
      {error && (
        <div className="p-4 text-center text-red-600 bg-red-50 mx-6 rounded-lg border border-red-200">{error}</div>
      )}
    </div>
  )
}

export default ClientesManager;