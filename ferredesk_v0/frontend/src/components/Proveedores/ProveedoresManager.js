"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
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
  const { proveedores, total, addProveedor, updateProveedor, deleteProveedor, loading, error, fetchProveedores } = useProveedoresAPI()

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
  const [pagina, setPagina] = useState(1)
  const [itemsPorPagina, setItemsPorPagina] = useState(10)
  
  // Estado de ordenamiento
  const [ordenamiento, setOrdenamiento] = useState('desc') // 'asc' o 'desc'
  
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const filtros = {}
    if (searchProveedores && searchProveedores.trim()) {
      filtros['razon__icontains'] = searchProveedores.trim()
      filtros['fantasia__icontains'] = searchProveedores.trim()
    }
    const t = setTimeout(() => fetchProveedores(pagina, itemsPorPagina, filtros, 'id', ordenamiento), 300)
    return () => clearTimeout(t)
  }, [pagina, itemsPorPagina, searchProveedores, ordenamiento, fetchProveedores])

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

  // ------------------------------------------------------------------
  // Función para manejar cambios de ordenamiento
  const handleOrdenamientoChange = useCallback((nuevoOrdenamiento) => {
    setOrdenamiento(nuevoOrdenamiento ? 'asc' : 'desc');
    setPagina(1); // Resetear a página 1 cuando cambia el ordenamiento
  }, []);

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
      `Lista importada para ${info.proveedor.razon}\n${info.message || ""}\nRegistros procesados: ${info.registrosProcesados ?? "N/D"}\nRegistros actualizados: ${info.registrosActualizados ?? "N/D"}`,
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
                    mostrarBuscador={true}
                    valorBusqueda={searchProveedores}
                    onCambioBusqueda={setSearchProveedores}
                    busquedaRemota={true}
                    paginacionControlada={true}
                    paginaActual={pagina}
                    onPageChange={setPagina}
                    itemsPerPage={itemsPorPagina}
                    onItemsPerPageChange={setItemsPorPagina}
                    totalRemoto={total}
                    filasCompactas={true}
                    claseTbody="leading-tight"
                    mostrarOrdenamiento={true}
                    onOrdenamientoChange={handleOrdenamientoChange}
                    ordenamientoControlado={ordenamiento === 'asc'}
                    renderFila={(p, idxVis, idxInicio) => {
                      const indiceGlobal = idxInicio + idxVis
                      const filaPrincipal = (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-200 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                        >
                          {/* Celda enumeración */}
                          <td className="px-2 py-0.5 text-center text-xs text-slate-500 font-medium">{indiceGlobal + 1}</td>
                          <td className="px-2 py-0.5 whitespace-nowrap font-medium text-slate-800">{p.razon}</td>
                          <td className="px-2 py-0.5 whitespace-nowrap text-slate-600">{p.fantasia}</td>
                          <td className="px-2 py-0.5 whitespace-nowrap text-slate-600">{p.domicilio}</td>
                          <td className="px-2 py-0.5 whitespace-nowrap text-slate-600">{p.tel1}</td>
                          <td className="px-2 py-0.5 whitespace-nowrap text-slate-600">{p.cuit}</td>
                          <td className="px-2 py-0.5 whitespace-nowrap text-slate-600">{p.sigla}</td>
                          {/* Acciones */}
                          <td className="px-2 py-0.5 whitespace-nowrap text-center">
                            <div className="flex gap-3 items-center justify-center">
                              {/* Orden deseado: Cargar lista, Historial, Editar, Borrar */}
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
                            </div>
                          </td>
                        </tr>
                      )

                      if (expandedId !== p.id) return filaPrincipal

                      const filaDetalle = (
                        <tr key={`det-${p.id}`} className="bg-slate-50/50">
                          <td colSpan={8} className="px-6 py-5">
                            <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-l-4 border-orange-500 mx-0 mb-2 rounded-lg shadow-sm">
                              <div className="p-4">
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 text-sm">
                                  {/* Información Básica */}
                                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                                    <h5 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      Información Básica
                                    </h5>
                                    <div className="space-y-1 text-xs">
                                      {(() => {
                                        const estado = p.acti === "S" ? "Activo" : "Inactivo"
                                        return (
                                          <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Estado:</span>
                                            <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${estado === "Activo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                              {estado}
                                            </span>
                                          </div>
                                        )
                                      })()}
                                      <div className="flex justify-between"><span className="text-slate-500">Razón Social:</span><span className="font-medium text-slate-700 truncate" title={p.razon}>{p.razon || "N/A"}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Sigla:</span><span className="font-medium text-slate-700">{p.sigla || "N/A"}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">CUIT:</span><span className="font-medium text-slate-700">{p.cuit || "N/A"}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">IIBB:</span><span className="font-medium text-slate-700">{p.ib || "N/A"}</span></div>
                                    </div>
                                  </div>

                                  {/* Contacto */}
                                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                                    <h5 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-purple-600">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                                      </svg>
                                      Contacto
                                    </h5>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between"><span className="text-slate-500">Teléfono 1:</span><span className="font-medium text-slate-700">{p.tel1 || "N/A"}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Teléfono 2:</span><span className="font-medium text-slate-700">{p.tel2 || "N/A"}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Teléfono 3:</span><span className="font-medium text-slate-700">{p.tel3 || "N/A"}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Contacto:</span><span className="font-medium text-slate-700 truncate" title={p.contacto}>{p.contacto || "N/A"}</span></div>
                                    </div>
                                  </div>

                                  {/* Ubicación */}
                                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                                    <h5 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      Ubicación
                                    </h5>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between"><span className="text-slate-500">Dirección:</span><span className="font-medium text-slate-700 truncate" title={p.domicilio}>{p.domicilio || "N/A"}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">C.P.:</span><span className="font-medium text-slate-700">{p.cpostal || "N/A"}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Barrio (ID):</span><span className="font-medium text-slate-700">{p.idbar ?? "N/A"}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Localidad (ID):</span><span className="font-medium text-slate-700">{p.idloc ?? "N/A"}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Provincia (ID):</span><span className="font-medium text-slate-700">{p.idprv ?? "N/A"}</span></div>
                                    </div>
                                  </div>

                                  {/* Situación Fiscal */}
                                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                                    <h5 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                                      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                      </svg>
                                      Fiscal
                                    </h5>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between"><span className="text-slate-500">IVA (ID):</span><span className="font-medium text-slate-700">{p.iva ?? "N/A"}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Imp. Saldo Cta.:</span><span className="font-medium text-slate-700">{p.impsalcta ?? "N/A"}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Fecha Saldo Cta.:</span><span className="font-medium text-slate-700">{p.fecsalcta ?? "N/A"}</span></div>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 flex gap-3">
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
