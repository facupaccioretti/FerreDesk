"use client"

// PromocionForm.js — Alta/edicion de una Promocion: datos generales
// (nombre, precio, vigencia) mas el editor de componentes fijos/grupos.
//
// POR QUE: La validacion de composicion (al menos un fijo o un grupo, cada
// grupo con >= 2 alternativas) se replica aca en el cliente para dar
// feedback inmediato, pero el backend (validators/promociones.py) es quien
// manda: este formulario nunca asume que su validacion alcanza sola.

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
    return "La promoción debe tener al menos un componente fijo o un grupo de elección."
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
      setError(err?.message || "No se pudo guardar la promoción.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Precio promocional</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={precioPromocional}
            onChange={(e) => setPrecioPromocional(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción (opcional)</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Vigencia desde (opcional)</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Vigencia hasta (opcional)</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
      </div>

      <EditorComponentesPromo items={items} setItems={setItems} grupos={grupos} setGrupos={setGrupos} />

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancelar}
          className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className={`${theme.botonPrimario} disabled:opacity-60`}>
          {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear promoción"}
        </button>
      </div>
    </form>
  )
}

export default PromocionForm
