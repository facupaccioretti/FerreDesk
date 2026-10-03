"use client"

import { useState, memo } from "react"
import EditorComponentesPromo from "./EditorComponentesPromo"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

// Constantes de clases para un estilo consistente con ClienteForm
const CLASES_INPUT = "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
const CLASES_SECCION_TITULO = "flex items-center gap-2 text-[12px] font-semibold text-slate-700"
const CLASES_SECCION_WRAPPER = "p-2 bg-slate-50 rounded-lg border border-slate-200 min-w-[260px] overflow-visible"

// Contenedor de sección estilo lista (idéntico a ClienteForm)
const SeccionLista = memo(({ titulo, subtitulo, icono, children, headerRight }) => (
  <div className={CLASES_SECCION_WRAPPER}>
    <div className="mb-1.5">
      <div className="flex items-center justify-between">
        <h5 className={CLASES_SECCION_TITULO}>
          {icono} {titulo}
        </h5>
        {headerRight}
      </div>
      {subtitulo && (
        <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{subtitulo}</p>
      )}
    </div>
    <div className="divide-y divide-slate-200">
      {children}
    </div>
  </div>
))

// Fila editable con etiqueta e input (idéntico a ClienteForm)
const FilaEditable = memo(({ etiqueta, children, inputProps, value, onChange }) => (
  <div className="flex items-center justify-between py-1.5">
    <div className="flex items-center gap-1.5">
      <span className="text-[12px] text-slate-700 whitespace-nowrap">{etiqueta}</span>
    </div>
    <div className="min-w-[150px] flex-1 text-right ml-2">
      {children ? children : (
        <input className={`${CLASES_INPUT} text-right`} {...inputProps} value={value ?? ""} onChange={onChange} />
      )}
    </div>
  </div>
))

function mapearItemsParaEditar(promocion) {
  return (promocion?.items || []).map((it) => ({
    stock_id: it.stock_id,
    codigo: it.codigo,
    denominacion: it.denominacion,
    cantidad: it.cantidad,
  }))
}

function mapearGruposParaEditar(promocion) {
  return (promocion?.grupos || []).map((g) => ({
    id: g.id,
    nombre: g.nombre,
    cantidad: g.cantidad,
    alternativas: (g.alternativas || []).map((a) => ({
      stock_id: a.stock_id,
      codigo: a.codigo,
      denominacion: a.denominacion,
    })),
  }))
}

function validarFormulario({ nombre, precioPromocional, items, grupos, fechaInicio, fechaFin }) {
  if (!nombre.trim()) return "El nombre es obligatorio."
  const precio = Number.parseFloat(precioPromocional)
  if (!Number.isFinite(precio) || precio <= 0) return "El precio promocional debe ser mayor a cero."
  if (items.length === 0 && grupos.length === 0) {
    return "La promocion debe tener al menos un componente fijo o un grupo de eleccion."
  }
  const productos = [
    ...items,
    ...grupos.flatMap((grupo) => grupo.alternativas || []),
  ]
  const productosVistos = new Set()
  for (const producto of productos) {
    const stockId = String(producto.stock_id)
    if (productosVistos.has(stockId)) {
      const nombreProducto = producto.denominacion || producto.codigo || stockId
      return `El producto "${nombreProducto}" esta repetido en la promocion.`
    }
    productosVistos.add(stockId)
  }
  for (const it of items) {
    const cantidad = Number.parseFloat(it.cantidad)
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return `El componente "${it.denominacion}" debe tener una cantidad mayor a cero.`
    }
  }
  for (const g of grupos) {
    if (!g.nombre.trim()) return "Cada grupo debe tener un nombre."
    const cantidad = Number.parseFloat(g.cantidad)
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return `El grupo "${g.nombre}" debe tener una cantidad mayor a cero.`
    }
    if ((g.alternativas || []).length < 2) {
      return `El grupo "${g.nombre}" necesita al menos dos alternativas.`
    }
  }
  if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
    return "La fecha de fin no puede ser anterior a la fecha de inicio."
  }
  return ""
}

function PromocionForm({ promocion, onGuardar, onCancelar, guardando = false }) {
  const theme = useFerreDeskTheme()
  const esEdicion = !!promocion?.id

  const [nombre, setNombre] = useState(promocion?.nombre || "")
  const [descripcion, setDescripcion] = useState(promocion?.descripcion || "")
  const [precioPromocional, setPrecioPromocional] = useState(promocion?.precio_promocional ?? "")
  const [fechaInicio, setFechaInicio] = useState(promocion?.fecha_inicio || "")
  const [fechaFin, setFechaFin] = useState(promocion?.fecha_fin || "")
  const [items, setItems] = useState(() => mapearItemsParaEditar(promocion))
  const [grupos, setGrupos] = useState(() => mapearGruposParaEditar(promocion))
  const [error, setError] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    const mensajeError = validarFormulario({ nombre, precioPromocional, items, grupos, fechaInicio, fechaFin })
    if (mensajeError) {
      setError(mensajeError)
      return
    }
    setError("")
    if (!esEdicion && !window.confirm("Esta seguro de crear la promocion?")) return

    const payload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      precio_promocional: precioPromocional,
      fecha_inicio: fechaInicio || null,
      fecha_fin: fechaFin || null,
      items: items.map((it) => ({ stock_id: it.stock_id, cantidad: it.cantidad })),
      grupos: grupos.map((g) => ({
        nombre: g.nombre.trim(),
        cantidad: g.cantidad,
        alternativas: g.alternativas.map((a) => ({ stock_id: a.stock_id })),
      })),
    }

    try {
      await onGuardar(payload)
    } catch (err) {
      setError(err?.message || "No se pudo guardar la promocion.")
    }
  }

  const handleCancelar = () => {
    if (window.confirm("Esta seguro de cancelar? Los cambios se perderan.")) onCancelar()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 overflow-visible">
      {error && (
        <div className="p-2 bg-red-50 border-l-4 border-red-500 text-red-800 rounded text-xs flex items-center gap-2">
          <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Header compacto con nombre/identificador estilo ClienteForm */}
      <div className="flex items-center justify-between pb-1">
        <div className="text-sm font-semibold text-slate-800 truncate" title={nombre}>
          {nombre || (esEdicion ? "Editar Promoción" : "Nueva Promoción")}
        </div>
        {esEdicion && promocion?.activa !== undefined && (
          <span className={`px-2 py-0.5 rounded-full text-[11px] ${promocion.activa ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {promocion.activa ? "Activa" : "Inactiva"}
          </span>
        )}
      </div>

      {/* Secciones en grid compacto estilo ClienteForm */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 items-start overflow-visible">
        {/* Tarjeta 1: Datos de la promoción */}
        <SeccionLista
          titulo="Datos de la Promoción"
          subtitulo="Definí el nombre, precio y período de vigencia."
          icono={
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <FilaEditable etiqueta={<>Nombre <span className="text-red-500">*</span></>}>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={`${CLASES_INPUT} text-left`}
              required
              autoFocus
            />
          </FilaEditable>

          <FilaEditable etiqueta={<>Precio Promocional <span className="text-red-500">*</span></>}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={precioPromocional}
              onChange={(e) => setPrecioPromocional(e.target.value)}
              className={`${CLASES_INPUT} text-right font-medium`}
              placeholder="0.00"
              required
            />
          </FilaEditable>

          <FilaEditable etiqueta={<>Descripción <span className="text-[10px] font-normal text-slate-400">(opcional)</span></>}>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className={`${CLASES_INPUT} text-left`}
              placeholder="Opcional"
            />
          </FilaEditable>

          <FilaEditable etiqueta={<>Vigencia Desde <span className="text-[10px] font-normal text-slate-400">(opcional)</span></>}>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className={CLASES_INPUT}
            />
          </FilaEditable>

          <FilaEditable etiqueta={<>Vigencia Hasta <span className="text-[10px] font-normal text-slate-400">(opcional)</span></>}>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className={CLASES_INPUT}
            />
          </FilaEditable>
        </SeccionLista>

        {/* Tarjetas 2 y 3: Componentes fijos y Grupos de alternativas */}
        <EditorComponentesPromo
          items={items}
          setItems={setItems}
          grupos={grupos}
          setGrupos={setGrupos}
        />
      </div>

      {/* Botones de acción compactos */}
      <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
        <button
          type="button"
          onClick={handleCancelar}
          className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-red-50 hover:text-red-700 hover:border-red-300 font-medium text-xs transition-colors shadow-sm"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className={`${theme.botonPrimario} disabled:opacity-60 text-xs py-2 px-5`}
        >
          {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear promoción"}
        </button>
      </div>
    </form>
  )
}

export default PromocionForm
