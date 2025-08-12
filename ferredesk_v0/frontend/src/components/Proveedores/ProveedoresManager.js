"use client"

import React, { useEffect, useState } from "react"
import Navbar from "../Navbar"
import ListaPreciosModal from "./ListaPreciosModal"
import HistorialListasModal from "../HistorialListasModal"
import ProveedorForm from "./ProveedorForm"
import { useProveedoresAPI } from "../../utils/useProveedoresAPI"
import { BotonEditar, BotonEliminar, BotonHistorial, BotonCargarLista } from "../Botones"
import Tabla from "../Tabla"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

const ProveedoresManager = () => {
  const theme = useFerreDeskTheme()
  
  // Hook API real
  const { proveedores, addProveedor, updateProveedor, deleteProveedor, loading, error } = useProveedoresAPI()

  // Estados para búsqueda y UI
  const [searchProveedores, setSearchProveedores] = useState("")
  const [expandedId, setExpandedId] = useState(null)
  const [tabs, setTabs] = useState([{ key: "lista", label: "Lista de Proveedores", closable: false }])
  const [activeTab, setActiveTab] = useState("lista")
  const [editProveedor, setEditProveedor] = useState(null)
  const [formError, setFormError] = useState(null)

  // Modales
  const [showListaModal, setShowListaModal] = React.useState(false)
  const [proveedorSeleccionado, setProveedorSeleccionado] = React.useState(null)
  const [showHistorialModal, setShowHistorialModal] = React.useState(false)
  const [proveedorHistorial, setProveedorHistorial] = React.useState(null)

  // --------------------------- Estado de usuario ---------------------------
  const [user, setUser] = useState(null)

  // ------------------------------ Paginación ------------------------------

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

  useEffect(() => {
    document.title = "Proveedores FerreDesk"
  }, [])

  // Tabs y edición
  const openTab = (key, label, proveedor = null) => {
    setEditProveedor(proveedor)
    setFormError(null)
    setTabs((prev) => {
      if (prev.find((t) => t.key === key)) return prev
      return [...prev, { key, label, closable: true }]
    })
    setActiveTab(key)
  }
  const closeTab = (key) => {
    setTabs((prev) => prev.filter((t) => t.key !== key))
    if (activeTab === key) setActiveTab("lista")
    setEditProveedor(null)
    setFormError(null)
  }

  // Guardar proveedor (alta o edición)
  const handleSaveProveedor = async (data) => {
    setFormError(null)
    try {
      if (editProveedor) {
        await updateProveedor(editProveedor.id, data)
      } else {
        await addProveedor(data)
      }
      closeTab("nuevo")
    } catch (err) {
      setFormError(err.message || "Error al guardar el proveedor")
    }
  }

  const handleEditProveedor = (prov) => {
    openTab("nuevo", "Editar Proveedor", prov)
  }

  const handleDelete = async (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este proveedor?")) {
      try {
        await deleteProveedor(id)
      } catch (err) {
        alert(err.message || "Error al eliminar proveedor")
      }
    }
  }

  // Modales
  const handleOpenListaModal = (proveedor) => {
    setProveedorSeleccionado(proveedor)
    setShowListaModal(true)
  }
  const handleImportLista = (info) => {
    alert(
      `Lista importada para ${info.proveedor.razon}\n${info.message || ""}\nRegistros procesados: ${info.registrosProcesados ?? "N/D"}`,
    )
  }
  const handleOpenHistorialModal = (proveedor) => {
    setProveedorHistorial(proveedor)
    setShowHistorialModal(true)
  }

  return (
    <div className={theme.fondo}>
      <div className={theme.patron}></div>
      <div className={theme.overlay}></div>
      
      <Navbar user={user} onLogout={handleLogout} />

      {/* Contenedor central con ancho máximo fijo */}
      <div className="py-8 px-4 flex-1 flex flex-col relative z-10">
        <div className="max-w-[1400px] w-full mx-auto flex flex-col flex-1">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Gestión de Proveedores</h2>
          </div>
          
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-md overflow-hidden">
            {/* Tabs tipo browser con encabezado azul FerreDesk */}
            <div className="border-b border-slate-700 px-6 pt-3 bg-gradient-to-r from-slate-800 to-slate-700">
              {tabs.map((tab) => (
                <div
                  key={tab.key}
                  className={`inline-flex items-center px-5 py-3 mr-2 rounded-t-lg cursor-pointer transition-colors ${activeTab === tab.key ? theme.tabActiva : theme.tabInactiva}`}
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
                      className="ml-3 text-lg font-bold text-slate-300 hover:text-red-400 focus:outline-none transition-colors"
                      title="Cerrar"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex-1 p-6">
              {activeTab === "lista" && (
                <>
                  {/* Botón Nuevo Proveedor arriba de la tabla */}
                  <div className="mb-4 flex justify-start">
                    <button
                      onClick={() => openTab("nuevo", "Nuevo Proveedor")}
                      className={theme.botonPrimario}
                    >
                      <span className="text-lg">+</span> Nuevo Proveedor
                    </button>
                  </div>
                  
                  {loading && (
                    <div className="text-slate-600 mb-4 flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-600"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Cargando proveedores...
                    </div>
                  )}
                  {error && (
                    <div className="text-red-600 mb-4 p-3 bg-red-50 rounded-lg border border-red-200">{error}</div>
                  )}
                  {/* Tabla compacta reutilizable */}
                  <Tabla
                    columnas={[
                      {
                        id: "nro",
                        titulo: "Nº",
                        align: "center",
                        render: (_, __, idxBase) => (
                          <span className="text-xs text-slate-500 font-medium">{idxBase + 1}</span>
                        ),
                      },
                      {
                        id: "razon",
                        titulo: "Razón Social",
                        render: (p) => <span className="font-medium text-slate-800">{p.razon}</span>,
                      },
                      {
                        id: "fantasia",
                        titulo: "Fantasia",
                        render: (p) => <span className="text-slate-600">{p.fantasia}</span>,
                      },
                      {
                        id: "domicilio",
                        titulo: "Domicilio",
                        render: (p) => <span className="text-slate-600">{p.domicilio}</span>,
                      },
                      {
                        id: "tel1",
                        titulo: "Teléfono",
                        render: (p) => <span className="text-slate-600">{p.tel1}</span>,
                      },
                      {
                        id: "cuit",
                        titulo: "CUIT",
                        render: (p) => <span className="text-slate-600">{p.cuit}</span>,
                      },
                      {
                        id: "sigla",
                        titulo: "Sigla",
                        render: (p) => <span className="text-slate-600">{p.sigla}</span>,
                      },
                      {
                        id: "acciones",
                        titulo: "Acciones",
                        align: "center",
                        render: (p) => (
                          <div className="flex gap-3 items-center justify-center">
                            <BotonEditar
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditProveedor(p)
                              }}
                              title="Editar proveedor"
                            />
                            <BotonEliminar
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(p.id)
                              }}
                              title="Eliminar proveedor"
                            />
                            <BotonCargarLista
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenListaModal(p)
                              }}
                              title="Cargar lista de precios"
                            />
                            <BotonHistorial
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenHistorialModal(p)
                              }}
                              title="Ver historial de listas"
                            />
                          </div>
                        ),
                      },
                    ]}
                    datos={proveedores}
                    valorBusqueda={searchProveedores}
                    onCambioBusqueda={setSearchProveedores}
                    mostrarBuscador={true}
                    renderFila={(p, idxVis, idxInicio) => {
                      const indiceGlobal = idxInicio + idxVis
                      const filaPrincipal = (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-200 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                        >
                          {/* Celda enumeración */}
                          <td className="px-2 py-1 text-center text-xs text-slate-500 font-medium">{indiceGlobal + 1}</td>
                          <td className="px-2 py-1 whitespace-nowrap font-medium text-slate-800">{p.razon}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-slate-600">{p.fantasia}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-slate-600">{p.domicilio}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-slate-600">{p.tel1}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-slate-600">{p.cuit}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-slate-600">{p.sigla}</td>
                          {/* Acciones */}
                          <td className="px-2 py-1 whitespace-nowrap text-center">
                            <div className="flex gap-3 items-center justify-center">
                              {/* Botones reutilizados */}
                              <BotonEditar
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditProveedor(p)
                                }}
                                title="Editar proveedor"
                              />
                              <BotonEliminar
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(p.id)
                                }}
                                title="Eliminar proveedor"
                              />
                              <BotonCargarLista
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenListaModal(p)
                                }}
                                title="Cargar lista de precios"
                              />
                              <BotonHistorial
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenHistorialModal(p)
                                }}
                                title="Ver historial de listas"
                              />
                            </div>
                          </td>
                        </tr>
                      )

                      if (expandedId !== p.id) return filaPrincipal

                      const filaDetalle = (
                        <tr key={`det-${p.id}`} className="bg-slate-50/50">
                          <td colSpan={8} className="px-6 py-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                              <div>
                                <span className="block text-slate-500 font-medium mb-1">Razón Social</span>
                                <span className="block text-slate-700 font-medium">{p.razon}</span>
                              </div>
                              <div>
                                <span className="block text-slate-500 font-medium mb-1">Nombre de Fantasía</span>
                                <span className="block text-slate-700 font-medium">{p.fantasia}</span>
                              </div>
                              <div>
                                <span className="block text-slate-500 font-medium mb-1">Domicilio</span>
                                <span className="block text-slate-700 font-medium">{p.domicilio}</span>
                              </div>
                              <div>
                                <span className="block text-slate-500 font-medium mb-1">Teléfono</span>
                                <span className="block text-slate-700 font-medium">{p.tel1}</span>
                              </div>
                              <div>
                                <span className="block text-slate-500 font-medium mb-1">CUIT</span>
                                <span className="block text-slate-700 font-medium">{p.cuit}</span>
                              </div>
                              <div>
                                <span className="block text-slate-500 font-medium mb-1">Sigla</span>
                                <span className="block text-slate-700 font-medium">{p.sigla}</span>
                              </div>
                              <div className="col-span-2 mt-4 flex gap-3">
                                <button
                                  onClick={() => handleOpenListaModal(p)}
                                  className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow-lg font-semibold"
                                >
                                  Cargar Lista de Precios
                                </button>
                                <button
                                  onClick={() => handleOpenHistorialModal(p)}
                                  className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow-lg font-semibold"
                                >
                                  Ver Historial
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )

                      return [filaPrincipal, filaDetalle]
                    }}
                  />
                </>
              )}
              {activeTab === "nuevo" && (
                <div className="flex justify-center items-start py-4">
                  <ProveedorForm
                    onSave={handleSaveProveedor}
                    onCancel={() => closeTab("nuevo")}
                    initialData={editProveedor}
                    formError={formError}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Modales */}
      <ListaPreciosModal
        open={showListaModal}
        onClose={() => setShowListaModal(false)}
        proveedor={proveedorSeleccionado}
        onImport={handleImportLista}
      />
      <HistorialListasModal
        open={showHistorialModal}
        onClose={() => setShowHistorialModal(false)}
        proveedor={proveedorHistorial}
      />
    </div>
  )
}

export default ProveedoresManager
