"use client"

import { useState } from "react"
import EditorComponentesPromo from "./EditorComponentesPromo"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

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
  const inputClass = "w-full h-8 rounded-sm border border-slate-300 bg-white px-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"

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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-slate-700">Datos de la promocion</h4>
          <p className="text-xs text-slate-500">Defini el nombre, precio y periodo de vigencia.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={inputClass}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Precio promocional</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={precioPromocional}
              onChange={(e) => setPrecioPromocional(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Descripcion <span className="font-normal text-slate-400">(opcional)</span></label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              className={`${inputClass} h-auto py-2`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Vigencia desde <span className="font-normal text-slate-400">(opcional)</span></label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Vigencia hasta <span className="font-normal text-slate-400">(opcional)</span></label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <EditorComponentesPromo items={items} setItems={setItems} grupos={grupos} setGrupos={setGrupos} />

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={handleCancelar}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className={`${theme.botonPrimario} disabled:opacity-60`}>
          {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear promocion"}
        </button>
      </div>
    </form>
  )
}

export default PromocionForm
