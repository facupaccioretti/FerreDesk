"use client"

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
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-slate-700">Productos incluidos</h4>
          <p className="text-xs text-slate-500">Se entregan siempre con la promocion.</p>
        </div>
        {!disabled && <BuscadorProducto onSelect={agregarItemFijo} className="mb-3" />}
        <div className="space-y-1">
          {items.map((it, idx) => (
            <div key={it.stock_id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
                {it.denominacion} <span className="text-slate-400">({it.codigo})</span>
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={it.cantidad}
                onChange={(e) => cambiarCantidadItemFijo(idx, e.target.value)}
                disabled={disabled}
                className="h-7 w-16 rounded-sm border border-slate-300 px-2 text-xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500 disabled:bg-slate-100"
                aria-label={`Cantidad de ${it.denominacion}`}
              />
              {!disabled && <BotonEliminar onClick={() => quitarItemFijo(idx)} title="Quitar componente" />}
            </div>
          ))}
          {items.length === 0 && (
            <p className="py-2 text-xs text-slate-400">Busca y agrega los productos incluidos.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-700">Alternativas <span className="font-normal text-slate-400">(opcional)</span></h4>
            <p className="text-xs text-slate-500">Permiten elegir entre productos al vender.</p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={agregarGrupo}
              className="rounded-md border border-orange-200 bg-white px-2 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-50"
            >
              + Agregar alternativa
            </button>
          )}
        </div>
        <div className="space-y-4">
          {grupos.map((g, idxGrupo) => (
            <div key={g._clave || g.id} className="rounded-md border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Nombre del grupo (ej: Bebida a eleccion)"
                  value={g.nombre}
                  onChange={(e) => cambiarCampoGrupo(idxGrupo, "nombre", e.target.value)}
                  disabled={disabled}
                  className="h-8 flex-1 rounded-sm border border-slate-300 px-2 text-xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500 disabled:bg-slate-100"
                />
                <label className="whitespace-nowrap text-xs text-slate-500">Cant.</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={g.cantidad}
                  onChange={(e) => cambiarCampoGrupo(idxGrupo, "cantidad", e.target.value)}
                  disabled={disabled}
                  className="h-8 w-16 rounded-sm border border-slate-300 px-2 text-xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500 disabled:bg-slate-100"
                />
                {!disabled && <BotonEliminar onClick={() => quitarGrupo(idxGrupo)} title="Quitar grupo" />}
              </div>
              {!disabled && (
                <BuscadorProducto onSelect={(p) => agregarAlternativa(idxGrupo, p)} className="mb-2" />
              )}
              <div className="space-y-1">
                {g.alternativas.map((alt, idxAlt) => (
                  <div key={alt.stock_id} className="flex items-center gap-2 rounded-sm border border-slate-200 bg-slate-50 px-2 py-1">
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
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
            <p className="py-2 text-xs text-slate-400">No hay alternativas configuradas.</p>
          )}
        </div>
      </section>
    </div>
  )
}

export default EditorComponentesPromo
