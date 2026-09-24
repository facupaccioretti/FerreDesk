"use client"

// EditorComponentesPromo.js — Editor de los componentes de una promocion:
// componentes fijos (siempre incluidos) y grupos de productos a eleccion
// (el vendedor distribuye la cantidad del grupo al vender).
//
// POR QUE: Vive aparte de PromocionForm.js para que la logica de armar
// items/grupos (agregar, quitar, cambiar cantidad) no se mezcle con el resto
// del formulario (nombre, precio, vigencia). Reutiliza BuscadorProducto tal
// cual (solo onSelect/disabled/className), sin tocar su implementacion.

import BuscadorProducto from "../BuscadorProducto"
import { BotonEliminar } from "../Botones"

let contadorClaveTemporal = 0
const generarClaveTemporal = () => `tmp-${Date.now()}-${contadorClaveTemporal++}`

function EditorComponentesPromo({ items, setItems, grupos, setGrupos, disabled = false }) {
  const agregarItemFijo = (producto) => {
    if (!producto) return
    if (items.some((it) => it.stock_id === producto.id)) return
    setItems([...items, {
      stock_id: producto.id,
      codigo: producto.codvta || producto.codigo || "",
      denominacion: producto.deno || producto.nombre || "",
      cantidad: 1,
    }])
  }
  const quitarItemFijo = (idx) => setItems(items.filter((_, i) => i !== idx))
  const cambiarCantidadItemFijo = (idx, cantidad) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, cantidad } : it)))

  const agregarGrupo = () =>
    setGrupos([...grupos, { _clave: generarClaveTemporal(), nombre: "", cantidad: 1, alternativas: [] }])
  const quitarGrupo = (idx) => setGrupos(grupos.filter((_, i) => i !== idx))
  const cambiarCampoGrupo = (idx, campo, valor) =>
    setGrupos(grupos.map((g, i) => (i === idx ? { ...g, [campo]: valor } : g)))

  const agregarAlternativa = (idxGrupo, producto) => {
    if (!producto) return
    setGrupos(grupos.map((g, i) => {
      if (i !== idxGrupo) return g
      if (g.alternativas.some((a) => a.stock_id === producto.id)) return g
      return {
        ...g,
        alternativas: [...g.alternativas, {
          stock_id: producto.id,
          codigo: producto.codvta || producto.codigo || "",
          denominacion: producto.deno || producto.nombre || "",
        }],
      }
    }))
  }
  const quitarAlternativa = (idxGrupo, idxAlt) =>
    setGrupos(grupos.map((g, i) =>
      i === idxGrupo ? { ...g, alternativas: g.alternativas.filter((_, j) => j !== idxAlt) } : g
    ))

  return (
    <div className="space-y-6">
      {/* Componentes fijos */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Componentes fijos (siempre incluidos)</h4>
        {!disabled && <BuscadorProducto onSelect={agregarItemFijo} className="mb-2" />}
        <div className="space-y-1">
          {items.map((it, idx) => (
            <div key={it.stock_id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="flex-1 text-sm text-slate-700">
                {it.denominacion} <span className="text-slate-400">({it.codigo})</span>
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={it.cantidad}
                onChange={(e) => cambiarCantidadItemFijo(idx, e.target.value)}
                disabled={disabled}
                className="w-20 px-2 py-1 border border-slate-300 rounded text-sm disabled:bg-slate-100"
                aria-label={`Cantidad de ${it.denominacion}`}
              />
              {!disabled && <BotonEliminar onClick={() => quitarItemFijo(idx)} title="Quitar componente" />}
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-xs text-slate-400 italic">Sin componentes fijos.</p>
          )}
        </div>
      </div>

      {/* Grupos de eleccion */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-slate-700">Grupos de productos a elección</h4>
          {!disabled && (
            <button
              type="button"
              onClick={agregarGrupo}
              className="text-xs font-semibold text-orange-600 hover:text-orange-800"
            >
              + Agregar grupo
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-3">
          En cada grupo el vendedor distribuye la cantidad entre las alternativas al momento de vender.
        </p>
        <div className="space-y-4">
          {grupos.map((g, idxGrupo) => (
            <div key={g._clave || g.id} className="border border-slate-200 rounded-lg p-3 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Nombre del grupo (ej: Bebida a elección)"
                  value={g.nombre}
                  onChange={(e) => cambiarCampoGrupo(idxGrupo, "nombre", e.target.value)}
                  disabled={disabled}
                  className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm disabled:bg-slate-100"
                />
                <label className="text-xs text-slate-500 whitespace-nowrap">Cantidad</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={g.cantidad}
                  onChange={(e) => cambiarCampoGrupo(idxGrupo, "cantidad", e.target.value)}
                  disabled={disabled}
                  className="w-20 px-2 py-1 border border-slate-300 rounded text-sm disabled:bg-slate-100"
                />
                {!disabled && <BotonEliminar onClick={() => quitarGrupo(idxGrupo)} title="Quitar grupo" />}
              </div>
              {!disabled && (
                <BuscadorProducto onSelect={(p) => agregarAlternativa(idxGrupo, p)} className="mb-2" />
              )}
              <div className="space-y-1">
                {g.alternativas.map((alt, idxAlt) => (
                  <div key={alt.stock_id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                    <span className="flex-1 text-sm text-slate-700">
                      {alt.denominacion} <span className="text-slate-400">({alt.codigo})</span>
                    </span>
                    {!disabled && (
                      <BotonEliminar onClick={() => quitarAlternativa(idxGrupo, idxAlt)} title="Quitar alternativa" />
                    )}
                  </div>
                ))}
              </div>
              {g.alternativas.length < 2 && (
                <p className="text-xs text-amber-600 mt-1">Necesita al menos dos alternativas.</p>
              )}
            </div>
          ))}
          {grupos.length === 0 && (
            <p className="text-xs text-slate-400 italic">Sin grupos de elección.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default EditorComponentesPromo
