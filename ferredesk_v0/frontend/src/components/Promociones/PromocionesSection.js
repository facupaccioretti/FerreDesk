"use client"

// PromocionesSection.js — Seccion "Promociones" dentro de Productos.
//
// POR QUE: Una promocion no es un producto del catalogo, pero se administra
// desde el mismo lugar que los productos (spec explicita: subseccion de
// Productos, no una entrada propia del Navbar). Es un mini-manager
// autocontenido: pestanas propias (Activas/Inactivas/Revisar) + alta/edicion,
// siguiendo el mismo patron de tabs que ProductosManager pero sin tocarlo.

import { useState } from "react"
import Tabla from "../Tabla"
import PromocionForm from "./PromocionForm"
import { usePromocionesAPI } from "./hooks/usePromocionesAPI"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { BotonEditar, BotonDesactivar, BotonReactivar, BotonRevisar } from "../Botones"

function resumenComponentes(promocion) {
  const partesFijas = (promocion.items || []).map((it) => `${it.denominacion} x${it.cantidad}`)
  const partesGrupos = (promocion.grupos || []).map((g) => `${g.nombre} (${(g.alternativas || []).length} opciones)`)
  const partes = [...partesFijas, ...partesGrupos]
  return partes.length > 0 ? partes.join(" · ") : "Sin componentes"
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
    if (formularioActivo && formularioActivo !== "nuevo") {
      await editarPromocion(formularioActivo.id, payload)
    } else {
      await crearPromocion(payload)
    }
    setFormularioActivo(null)
  }

  const handleDesactivar = async (promocion) => {
    if (!window.confirm(`¿Desactivar la promoción "${promocion.nombre}"? No se podrá seguir vendiendo hasta reactivarla.`)) return
    await desactivarPromocion(promocion.id)
  }

  const handleReactivar = async (promocion) => {
    await activarPromocion(promocion.id)
  }

  const handleRevisar = async (promocion) => {
    await revisarPromocion(promocion.id)
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
        ? <span className="text-xs text-slate-600">{p.fecha_inicio || "—"} a {p.fecha_fin || "—"}</span>
        : <span className="text-xs text-slate-400">Sin límite</span>
    ) },
    { id: "estado", titulo: "Estado", render: (p) => (
      <div className="flex flex-col gap-1">
        <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${p.activa ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
          {p.activa ? "Activa" : "Inactiva"}
        </span>
        {p.desactualizada && (
          <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-100 text-yellow-800">
            Costo cambió
          </span>
        )}
      </div>
    ) },
    { id: "acciones", titulo: "Acciones", align: "center", render: (p) => (
      <div className="flex items-center justify-center gap-1">
        <BotonEditar onClick={() => setFormularioActivo(p)} />
        {p.desactualizada && <BotonRevisar onClick={() => handleRevisar(p)} />}
        {p.activa ? (
          <BotonDesactivar onClick={() => handleDesactivar(p)} />
        ) : (
          <BotonReactivar onClick={() => handleReactivar(p)} />
        )}
      </div>
    ) },
  ]

  // ── Formulario de alta/edicion ──
  if (formularioActivo) {
    const esNuevo = formularioActivo === "nuevo"
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">
            {esNuevo ? "Nueva promoción" : `Editar promoción: ${formularioActivo.nombre}`}
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

  // ── Listado ──
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {ESTADOS_TAB.map((tab) => (
            <button
              key={tab.key}
              onClick={() => cambiarTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tabActiva === tab.key ? theme.tabActiva : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={() => setFormularioActivo("nuevo")} className={theme.botonPrimario}>
          + Nueva promoción
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
