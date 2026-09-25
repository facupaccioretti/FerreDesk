"use client"

import { useState } from "react"
import Tabla from "../Tabla"
import PromocionForm from "./PromocionForm"
import { usePromocionesAPI } from "./hooks/usePromocionesAPI"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { BotonConfirmar, BotonEditar, BotonPausar, BotonReanudar } from "../Botones"
import { toast } from "react-toastify"

function resumenComponentes(promocion) {
  const partesFijas = (promocion.items || []).map((it) => `${it.denominacion} x${it.cantidad}`)
  const partesGrupos = (promocion.grupos || []).map((g) => `${g.nombre} (${(g.alternativas || []).length} opciones)`)
  const partes = [...partesFijas, ...partesGrupos]
  return partes.length > 0 ? partes.join(" / ") : "Sin componentes"
}

function formatearFecha(fecha) {
  if (!fecha) return "-"
  const [anio, mes, dia] = String(fecha).split("-")
  return anio && mes && dia ? `${dia}/${mes}/${anio.slice(-2)}` : fecha
}

const ESTADOS_TAB = [
  { key: "activas", label: "Activas" },
  { key: "inactivas", label: "Inactivas" },
  { key: "desactualizadas", label: "A revisar" },
]

function PromocionesSection() {
  const theme = useFerreDeskTheme()

  const [tabActiva, setTabActiva] = useState("activas")
  // Pestana dinamica: null (lista) | 'nuevo' | promocion completa a editar
  const [formularioActivo, setFormularioActivo] = useState(null)
  const [pagina, setPagina] = useState(1)
  const [itemsPorPagina, setItemsPorPagina] = useState(10)

  const {
    datos: promociones,
    total,
    cargando,
    crearPromocion,
    creando,
    editarPromocion,
    editando,
    activarPromocion,
    desactivarPromocion,
    revisarPromocion,
  } = usePromocionesAPI({ estado: tabActiva, pagina, itemsPorPagina })

  const cambiarTab = (key) => {
    setTabActiva(key)
    setPagina(1)
    setFormularioActivo(null)
  }

  const handleGuardar = async (payload) => {
    const esEdicion = formularioActivo && formularioActivo !== "nuevo"
    try {
      if (esEdicion) {
        await editarPromocion(formularioActivo.id, payload)
      } else {
        await crearPromocion(payload)
      }
      toast.success(esEdicion ? "Promocion actualizada." : "Promocion creada.")
      setFormularioActivo(null)
    } catch (error) {
      toast.error(error?.message || "No se pudo guardar la promocion.")
      throw error
    }
  }

  const handleDesactivar = async (promocion) => {
    if (!window.confirm(`Desactivar la promocion "${promocion.nombre}"? No se podra seguir vendiendo hasta reactivarla.`)) return
    try {
      await desactivarPromocion(promocion.id)
      toast.success("Promocion desactivada.")
    } catch (error) {
      toast.error(error?.message || "No se pudo desactivar la promocion.")
    }
  }

  const handleReactivar = async (promocion) => {
    try {
      await activarPromocion(promocion.id)
      toast.success("Promocion reactivada.")
    } catch (error) {
      toast.error(error?.message || "No se pudo reactivar la promocion.")
    }
  }

  const handleRevisar = async (promocion) => {
    try {
      await revisarPromocion(promocion.id)
      toast.success("Promocion marcada como revisada.")
    } catch (error) {
      toast.error(error?.message || "No se pudo revisar la promocion.")
    }
  }

  const columnas = [
    { id: "nombre", titulo: "Nombre", render: (p) => (
      <div>
        <div className="font-semibold text-slate-800">{p.nombre}</div>
        {p.descripcion && <div className="text-xs text-slate-500 truncate max-w-[280px]">{p.descripcion}</div>}
      </div>
    ) },
    { id: "componentes", titulo: "Componentes", render: (p) => (
      <span className="text-xs text-slate-600">{resumenComponentes(p)}</span>
    ) },
    { id: "precio", titulo: "Precio", align: "right", render: (p) => (
      <span className="font-semibold text-emerald-600">${Number(p.precio_promocional || 0).toLocaleString()}</span>
    ) },
    { id: "vigencia", titulo: "Vigencia", render: (p) => (
      p.fecha_inicio || p.fecha_fin
        ? <span className="text-xs text-slate-600">{formatearFecha(p.fecha_inicio)} a {formatearFecha(p.fecha_fin)}</span>
        : <span className="text-xs text-slate-400">Sin limite</span>
    ) },
    { id: "alertas", titulo: "Alertas", render: (p) => (
      p.desactualizada ? (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-800">
          Costo cambio
        </span>
      ) : <span className="text-xs text-slate-400">-</span>
    ) },
    { id: "acciones", titulo: "Acciones", align: "center", render: (p) => (
      <div className="flex items-center justify-center gap-2">
        <BotonEditar
          onClick={() => setFormularioActivo(p)}
          className="px-1 py-1 text-blue-500 transition-colors hover:text-blue-700"
        />
        {p.desactualizada && (
          <BotonConfirmar
            onClick={() => handleRevisar(p)}
            className="px-1 py-1 text-amber-600 transition-colors hover:text-amber-800"
          />
        )}
        {p.activa ? (
          <BotonPausar
            onClick={() => handleDesactivar(p)}
            className="px-1 py-1 text-slate-500 transition-colors hover:text-slate-800"
          />
        ) : (
          <BotonReanudar
            onClick={() => handleReactivar(p)}
            className="px-1 py-1 text-emerald-600 transition-colors hover:text-emerald-800"
          />
        )}
      </div>
    ) },
  ]

  // Formulario de alta/edicion
  if (formularioActivo) {
    const esNuevo = formularioActivo === "nuevo"
    return (
      <div>
        <div className="mb-4 border-b border-slate-200 pb-3">
          <h3 className="text-lg font-semibold text-slate-800">
            {esNuevo ? "Nueva promocion" : `Editar promocion: ${formularioActivo.nombre}`}
          </h3>
        </div>
        <PromocionForm
          promocion={esNuevo ? null : formularioActivo}
          onGuardar={handleGuardar}
          onCancelar={() => setFormularioActivo(null)}
          guardando={creando || editando}
        />
      </div>
    )
  }

  // Listado
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {ESTADOS_TAB.map((tab) => (
            <button
              key={tab.key}
              onClick={() => cambiarTab(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                tabActiva === tab.key ? theme.tabActiva : "text-slate-600 hover:bg-white hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={() => setFormularioActivo("nuevo")} className={theme.botonPrimario}>
          + Nueva promocion
        </button>
      </div>

      <Tabla
        columnas={columnas}
        datos={promociones}
        mostrarBuscador={false}
        paginacionControlada
        paginaActual={pagina}
        onPageChange={setPagina}
        itemsPerPage={itemsPorPagina}
        onItemsPerPageChange={setItemsPorPagina}
        totalRemoto={total}
        cargando={cargando}
        mostrarOrdenamiento={false}
      />
    </div>
  )
}

export default PromocionesSection
