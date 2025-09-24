"use client"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import Navbar from "./Navbar"
import { getCookie } from "../utils/csrf"
import Paginador from "./Paginador"

const filtros = [
  { key: "todas", label: "Todas" },
  { key: "importantes", label: "Importantes" },
  { key: "temporales", label: "Temporales" },
  { key: "sin_caducidad", label: "Sin Caducidad" },
  { key: "archivadas", label: "Archivadas" },
  { key: "eliminadas", label: "Eliminadas" },
]

const estados = [
  { key: "AC", label: "Activa", color: "emerald" },
  { key: "AR", label: "Archivada", color: "slate" },
  { key: "EL", label: "Eliminada", color: "red" },
]

const getEstadoBadge = (estado) => {
  const e = estados.find((x) => x.key === estado)
  if (!e)
    return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">{estado}</span>

  const colorClasses = {
    emerald: "bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 ring-1 ring-emerald-300/50",
    slate: "bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 ring-1 ring-slate-300/50",
    red: "bg-gradient-to-r from-red-100 to-red-200 text-red-800 ring-1 ring-red-300/50",
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${colorClasses[e.color]}`}>{e.label}</span>
  )
}

// Cantidad predeterminada de notas mostradas por página
const CANTIDAD_NOTAS_POR_PAGINA = 12

const NotasManager = () => {
  const [user, setUser] = useState(null)
  const [notas, setNotas] = useState([])
  const [openDialog, setOpenDialog] = useState(false)
  const [currentNota, setCurrentNota] = useState({
    titulo: "",
    contenido: "",
    fecha_caducidad: null,
    es_importante: false,
    categoria: "",
    etiquetas_lista: [],
    metadata: "",
    estado: "AC",
  })
  const [editMode, setEditMode] = useState(false)
  const [filtro, setFiltro] = useState("todas")
  const [loading, setLoading] = useState(false)
  const [buscar, setBuscar] = useState("")
  const [estadisticas, setEstadisticas] = useState({})
  const [categoriaFiltro, setCategoriaFiltro] = useState("")
  const [etiquetaFiltro, setEtiquetaFiltro] = useState("")
  const [previewNota, setPreviewNota] = useState(null)
  const [pagina, setPagina] = useState(1)
  const [notasPorPagina, setNotasPorPagina] = useState(CANTIDAD_NOTAS_POR_PAGINA)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("")

  useEffect(() => {
    document.title = "Notas FerreDesk"
    fetchUser()
    fetchEstadisticas()
  }, [])

  const fetchNotas = useCallback(async () => {
    setLoading(true)
    try {
      let url = `/api/notas/?filtro=${filtro}`
      if (buscar) url += `&buscar=${encodeURIComponent(buscar)}`
      if (categoriaFiltro) url += `&categoria=${encodeURIComponent(categoriaFiltro)}`
      if (etiquetaFiltro) url += `&etiqueta=${encodeURIComponent(etiquetaFiltro)}`
      const response = await fetch(url, { credentials: "include" })
      if (!response.ok) throw new Error("Error al cargar notas")
      const data = await response.json()
      setNotas(data)
    } catch (error) {
      setNotas([])
      console.error("Error al cargar notas:", error)
    } finally {
      setLoading(false)
    }
  }, [filtro, buscar, categoriaFiltro, etiquetaFiltro])

  useEffect(() => {
    fetchNotas()
  }, [fetchNotas])

  const fetchUser = async () => {
    try {
      const response = await fetch("/api/user/", { credentials: "include" })
      const data = await response.json()
      if (data.status === "success") setUser(data.user)
    } catch (error) {
      console.error("Error al obtener el usuario:", error)
    }
  }

  const fetchEstadisticas = async () => {
    try {
      const response = await fetch("/api/notas/estadisticas/", { credentials: "include" })
      if (!response.ok) throw new Error("Error al cargar estadísticas")
      const data = await response.json()
      setEstadisticas(data)
    } catch (error) {
      setEstadisticas({})
    }
  }

  const handleLogout = () => {
    setUser(null)
    window.location.href = "/login/"
  }

  const handleOpenDialog = (nota = null) => {
    if (nota) {
      setCurrentNota({
        ...nota,
        fecha_caducidad: nota.fecha_caducidad ? new Date(nota.fecha_caducidad) : null,
        etiquetas_lista: nota.etiquetas_lista || [],
        metadata: nota.metadata || "",
        estado: nota.estado || "AC",
      })
      setEditMode(true)
    } else {
      setCurrentNota({
        titulo: "",
        contenido: "",
        fecha_caducidad: null,
        es_importante: false,
        categoria: "",
        etiquetas_lista: [],
        metadata: "",
        estado: "AC",
      })
      setEditMode(false)
    }
    setOpenDialog(true)
  }

  const handleCloseDialog = () => {
    setOpenDialog(false)
    setCurrentNota({
      titulo: "",
      contenido: "",
      fecha_caducidad: null,
      es_importante: false,
      categoria: "",
      etiquetas_lista: [],
      metadata: "",
      estado: "AC",
    })
    setEditMode(false)
    setNuevaEtiqueta("")
  }

  const handleSaveNota = async () => {
    try {
      if (currentNota.es_importante && currentNota.fecha_caducidad) {
        alert("Las notas importantes no pueden tener fecha de caducidad.")
        return
      }
      const notaData = {
        ...currentNota,
        fecha_caducidad: currentNota.fecha_caducidad ? format(currentNota.fecha_caducidad, "yyyy-MM-dd") : null,
        etiquetas_lista: currentNota.etiquetas_lista,
      }
      const csrftoken = getCookie("csrftoken")
      const url = editMode ? `/api/notas/${currentNota.id}/` : "/api/notas/"
      const method = editMode ? "PUT" : "POST"
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrftoken,
        },
        credentials: "include",
        body: JSON.stringify(notaData),
      })
      if (!response.ok) {
        throw new Error("Error al guardar la nota")
      }
      handleCloseDialog()
      fetchNotas()
      fetchEstadisticas()
    } catch (error) {
      console.error("Error al guardar nota:", error)
    }
  }

  const handleDeleteNota = async (id) => {
    const nota = notas.find((n) => n.id === id)
    const mensaje =
      nota && nota.estado === "EL"
        ? "¿Seguro que deseas eliminar DEFINITIVAMENTE esta nota? Esta acción no se puede deshacer."
        : "¿Seguro que deseas eliminar esta nota?"
    if (window.confirm(mensaje)) {
      try {
        const csrftoken = getCookie("csrftoken")
        const response = await fetch(`/api/notas/${id}/eliminar/`, {
          method: "POST",
          headers: { "X-CSRFToken": csrftoken },
          credentials: "include",
        })
        if (!response.ok) {
          throw new Error("Error al eliminar la nota")
        }
        await fetchNotas()
        await fetchEstadisticas()
      } catch (error) {
        console.error("Error al eliminar nota:", error)
        alert("Error al eliminar la nota. Por favor, intente nuevamente.")
      }
    }
  }

  const handleArchivarNota = async (id) => {
    try {
      const csrftoken = getCookie("csrftoken")
      const response = await fetch(`/api/notas/${id}/archivar/`, {
        method: "POST",
        headers: { "X-CSRFToken": csrftoken },
        credentials: "include",
      })
      if (!response.ok) throw new Error("Error al archivar la nota")
      await fetchNotas()
      await fetchEstadisticas()
    } catch (error) {
      console.error("Error al archivar nota:", error)
    }
  }

  const handleRestaurarNota = async (id) => {
    try {
      const csrftoken = getCookie("csrftoken")
      const response = await fetch(`/api/notas/${id}/restaurar/`, {
        method: "POST",
        headers: { "X-CSRFToken": csrftoken },
        credentials: "include",
      })
      if (!response.ok) throw new Error("Error al restaurar la nota")
      await fetchNotas()
      await fetchEstadisticas()
    } catch (error) {
      console.error("Error al restaurar nota:", error)
    }
  }

  const handleToggleImportante = async (nota) => {
    try {
      const csrftoken = getCookie("csrftoken")
      const response = await fetch(`/api/notas/${nota.id}/marcar_importante/`, {
        method: "POST",
        headers: { "X-CSRFToken": csrftoken },
        credentials: "include",
      })
      if (!response.ok) throw new Error("Error al marcar como importante")
      fetchNotas()
      fetchEstadisticas()
    } catch (error) {
      console.error("Error al marcar como importante:", error)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setCurrentNota({ ...currentNota, [name]: value })
  }

  const handleDateChange = (e) => {
    const date = e.target.value ? new Date(e.target.value) : null
    setCurrentNota({ ...currentNota, fecha_caducidad: date })
  }

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target
    setCurrentNota({ ...currentNota, [name]: checked })
  }

  const handleAddEtiqueta = (e) => {
    if (e.key === "Enter" && nuevaEtiqueta.trim()) {
      setCurrentNota({
        ...currentNota,
        etiquetas_lista: [...(currentNota.etiquetas_lista || []), nuevaEtiqueta.trim()],
      })
      setNuevaEtiqueta("")
      e.preventDefault()
    }
  }

  const handleDeleteEtiqueta = (etiqueta) => {
    setCurrentNota({
      ...currentNota,
      etiquetas_lista: currentNota.etiquetas_lista.filter((tag) => tag !== etiqueta),
    })
  }

  const handlePreviewNota = (nota) => {
    setPreviewNota(nota)
  }

  const handleClosePreview = () => {
    setPreviewNota(null)
  }

  const handleEditFromPreview = () => {
    setCurrentNota({
      ...previewNota,
      fecha_caducidad: previewNota.fecha_caducidad ? new Date(previewNota.fecha_caducidad) : null,
      etiquetas_lista: previewNota.etiquetas_lista || [],
      metadata: previewNota.metadata || "",
      estado: previewNota.estado || "AC",
    })
    setEditMode(true)
    setOpenDialog(true)
    setPreviewNota(null)
  }

  const getFiltroCount = (key) => {
    if (!estadisticas) return 0
    switch (key) {
      case "todas":
        return estadisticas.total || 0
      case "importantes":
        return estadisticas.importantes || 0
      case "temporales":
        return estadisticas.temporales || 0
      case "sin_caducidad":
        return (
          (estadisticas.total || 0) -
          (estadisticas.importantes || 0) -
          (estadisticas.temporales || 0) -
          (estadisticas.archivadas || 0) -
          (estadisticas.eliminadas || 0) -
          (estadisticas.caducadas || 0)
        )
      case "archivadas":
        return estadisticas.archivadas || 0
      case "eliminadas":
        return estadisticas.eliminadas || 0
      default:
        return 0
    }
  }


  const notasPagina = notas.slice((pagina - 1) * notasPorPagina, pagina * notasPorPagina)

  const formatDateForInput = (date) => {
    if (!date) return ""
    const d = new Date(date)
    return d.toISOString().slice(0, 16)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30">
      <Navbar user={user} onLogout={handleLogout} />
      <div className="container mx-auto px-6 py-8">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-200/50 p-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-slate-800">Gestión de Notas</h1>
            </div>
            <button
              onClick={() => handleOpenDialog()}
              className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva Nota
            </button>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {filtros.map((f) => {
              const activo = filtro === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => {
                    setFiltro(f.key)
                    setPagina(1)
                  }}
                  className={`px-4 py-2 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 ${
                    activo
                      ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-lg"
                      : "bg-white text-slate-700 border border-slate-300 hover:border-slate-400 hover:shadow-md"
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-bold ${
                      activo ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {getFiltroCount(f.key)}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Búsqueda y filtros */}
          <div className="flex flex-wrap gap-4 mb-6 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Buscar</label>
              <input
                type="text"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                placeholder="Buscar en notas..."
              />
            </div>
            <div className="min-w-[140px]">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Categoría</label>
              <input
                type="text"
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                placeholder="Filtrar por categoría"
              />
            </div>
            <div className="min-w-[140px]">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Etiqueta</label>
              <input
                type="text"
                value={etiquetaFiltro}
                onChange={(e) => setEtiquetaFiltro(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                placeholder="Filtrar por etiqueta"
              />
            </div>
            <button
              onClick={fetchNotas}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
            >
              Filtrar
            </button>
            <button
              onClick={() => {
                setBuscar("")
                setCategoriaFiltro("")
                setEtiquetaFiltro("")
                setFiltro("todas")
              }}
              className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
            >
              Limpiar
            </button>
          </div>

          {/* Contenido */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Cargando notas...</p>
            </div>
          ) : (
            <>
              {/* Grid de notas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {notasPagina.map((nota) => (
                  <div
                    key={nota.id}
                    className={`relative p-6 rounded-2xl shadow-lg border transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1 ${
                      nota.es_importante
                        ? "bg-gradient-to-br from-amber-50 to-amber-100/80 border-amber-300/50 ring-1 ring-amber-200/50"
                        : "bg-white border-slate-200/50 hover:border-slate-300"
                    }`}
                    onClick={(e) => {
                      if (e.target.closest(".nota-action")) return
                      handlePreviewNota(nota)
                    }}
                  >
                    {/* Header de la nota */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-800 truncate">
                          {nota.titulo}
                          <span className="text-xs text-slate-400 font-mono ml-2">#{nota.numero}</span>
                        </h3>
                      </div>
                      <button
                        className="nota-action ml-2 p-1 rounded-lg hover:bg-slate-100 transition-colors duration-200"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleImportante(nota)
                        }}
                        title={nota.es_importante ? "Quitar importante" : "Marcar importante"}
                      >
                        {nota.es_importante ? (
                          <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* Estado y categoría */}
                    <div className="flex items-center gap-2 mb-3">
                      {getEstadoBadge(nota.estado)}
                      {nota.categoria && (
                        <span className="px-2 py-1 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 rounded-full text-xs font-semibold ring-1 ring-blue-300/50 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                            />
                          </svg>
                          {nota.categoria}
                        </span>
                      )}
                    </div>

                    {/* Etiquetas */}
                    {nota.etiquetas_lista && nota.etiquetas_lista.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {nota.etiquetas_lista.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 rounded-full text-xs font-medium ring-1 ring-slate-200/50"
                          >
                            {tag}
                          </span>
                        ))}
                        {nota.etiquetas_lista.length > 3 && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                            +{nota.etiquetas_lista.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Contenido */}
                    <p className="text-slate-700 text-sm leading-relaxed mb-4 line-clamp-3">{nota.contenido}</p>

                    {/* Fecha de caducidad */}
                    {nota.fecha_caducidad && (
                      <div className="text-xs text-slate-500 mb-4">
                        <span className="font-medium">Caduca:</span>{" "}
                        {format(new Date(nota.fecha_caducidad), "dd/MM/yyyy")} ({nota.dias_hasta_caducidad} días)
                      </div>
                    )}

                    {/* Acciones */}
                    <div className="absolute bottom-4 right-4 flex gap-2">
                      <button
                        className="nota-action p-2 rounded-lg bg-white/80 hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenDialog(nota)
                        }}
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>

                      {nota.estado === "AC" && nota.fecha_caducidad && new Date(nota.fecha_caducidad) <= new Date() && (
                        <button
                          className="nota-action p-2 rounded-lg bg-white/80 hover:bg-amber-50 text-amber-600 hover:text-amber-700 transition-all duration-200 shadow-sm hover:shadow-md"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleArchivarNota(nota.id)
                          }}
                          title="Archivar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 8l4 4 4-4m0 0V4a2 2 0 012-2h2a2 2 0 012 2v4m-6 0a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2v-6a2 2 0 00-2-2m-6 0H9a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2v-6a2 2 0 00-2-2H5z"
                            />
                          </svg>
                        </button>
                      )}

                      {nota.estado === "AR" && (
                        <button
                          className="nota-action p-2 rounded-lg bg-white/80 hover:bg-green-50 text-green-600 hover:text-green-700 transition-all duration-200 shadow-sm hover:shadow-md"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRestaurarNota(nota.id)
                          }}
                          title="Restaurar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 16l-4-4m0 0l4-4m-4 4h18"
                            />
                          </svg>
                        </button>
                      )}

                      <button
                        className="nota-action p-2 rounded-lg bg-white/80 hover:bg-red-50 text-red-600 hover:text-red-700 transition-all duration-200 shadow-sm hover:shadow-md"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteNota(nota.id)
                        }}
                        title={nota.estado === "EL" ? "Eliminar definitivamente" : "Eliminar"}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginación */}
              {notas.length > 0 && (
                <Paginador
                  totalItems={notas.length}
                  itemsPerPage={notasPorPagina}
                  currentPage={pagina}
                  onPageChange={(nuevaPagina) => setPagina(nuevaPagina)}
                  onItemsPerPageChange={(valor) => {
                    setNotasPorPagina(valor)
                    setPagina(1)
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de Preview */}
      {previewNota && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Detalle de Nota</h2>
                <button
                  onClick={handleClosePreview}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors duration-200"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">
                {previewNota.titulo}
                <span className="text-sm text-slate-400 font-mono ml-2">#{previewNota.numero}</span>
              </h3>
              <div className="flex items-center gap-2 mb-4">
                {getEstadoBadge(previewNota.estado)}
                {previewNota.categoria && (
                  <span className="px-3 py-1 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 rounded-full text-sm font-semibold ring-1 ring-blue-300/50 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    {previewNota.categoria}
                  </span>
                )}
              </div>
              {previewNota.etiquetas_lista && previewNota.etiquetas_lista.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {previewNota.etiquetas_lista.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 rounded-full text-sm font-medium ring-1 ring-slate-200/50"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="prose prose-slate max-w-none mb-4">
                <p className="text-slate-700 whitespace-pre-line">{previewNota.contenido}</p>
              </div>
              {previewNota.fecha_caducidad && (
                <div className="text-sm text-slate-600 mb-4">
                  <span className="font-semibold">Caduca:</span>{" "}
                  {format(new Date(previewNota.fecha_caducidad), "dd/MM/yyyy")} ({previewNota.dias_hasta_caducidad}{" "}
                  días)
                </div>
              )}
              <div className="text-xs text-slate-500 border-t border-slate-200 pt-4">
                <div>
                  <span className="font-semibold">Creada:</span>{" "}
                  {format(new Date(previewNota.fecha_creacion), "dd/MM/yyyy HH:mm")}
                </div>
                {previewNota.fecha_modificacion && (
                  <div>
                    <span className="font-semibold">Modificada:</span>{" "}
                    {format(new Date(previewNota.fecha_modificacion), "dd/MM/yyyy HH:mm")}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={handleClosePreview}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-all duration-200 font-medium"
              >
                Cerrar
              </button>
              <button
                onClick={handleEditFromPreview}
                className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
              >
                Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición/Creación */}
      {openDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">{editMode ? "Editar Nota" : "Nueva Nota"}</h2>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Título *</label>
                <input
                  type="text"
                  name="titulo"
                  value={currentNota.titulo}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                  placeholder="Título de la nota"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Contenido *</label>
                <textarea
                  name="contenido"
                  value={currentNota.contenido}
                  onChange={handleInputChange}
                  rows={6}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400 resize-none"
                  placeholder="Contenido de la nota"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Categoría</label>
                <input
                  type="text"
                  name="categoria"
                  value={currentNota.categoria}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                  placeholder="Categoría de la nota"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Etiquetas</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(currentNota.etiquetas_lista || []).map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 rounded-full text-sm font-medium ring-1 ring-slate-200/50 flex items-center gap-2"
                    >
                      {tag}
                      <button
                        onClick={() => handleDeleteEtiqueta(tag)}
                        className="text-slate-500 hover:text-red-600 transition-colors duration-200"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={nuevaEtiqueta}
                  onChange={(e) => setNuevaEtiqueta(e.target.value)}
                  onKeyDown={handleAddEtiqueta}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                  placeholder="Agregar etiqueta y presiona Enter"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="es_importante"
                    checked={currentNota.es_importante}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-orange-600 bg-white border-slate-300 rounded focus:ring-orange-500 focus:ring-2"
                  />
                  <span className="text-sm font-semibold text-slate-700">Marcar como importante</span>
                </label>
              </div>

              {!currentNota.es_importante && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Fecha y hora de caducidad</label>
                  <input
                    type="datetime-local"
                    value={formatDateForInput(currentNota.fecha_caducidad)}
                    onChange={handleDateChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Metadata (opcional, formato JSON)
                </label>
                <textarea
                  name="metadata"
                  value={currentNota.metadata}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400 resize-none font-mono"
                  placeholder='{"clave": "valor"}'
                />
              </div>

              {editMode && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Estado</label>
                  <select
                    name="estado"
                    value={currentNota.estado}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                  >
                    {estados.map((e) => (
                      <option key={e.key} value={e.key}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={handleCloseDialog}
                className="px-6 py-3 text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-all duration-200 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNota}
                className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotasManager;
