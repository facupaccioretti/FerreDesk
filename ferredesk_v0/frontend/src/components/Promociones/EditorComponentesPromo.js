"use client"

import BuscadorProducto from "../BuscadorProducto"
import { BotonEliminar } from "../Botones"

const CLASES_SECCION_TITULO = "flex items-center gap-2 text-[12px] font-semibold text-slate-700"
const CLASES_SECCION_WRAPPER = "p-2 bg-slate-50 rounded-lg border border-slate-200 min-w-[260px] overflow-visible"

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
    <>
      {/* Tarjeta 2: Productos incluidos */}
      <div className={CLASES_SECCION_WRAPPER}>
        <div className="mb-1.5">
          <h5 className={CLASES_SECCION_TITULO}>
            <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Productos incluidos
          </h5>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">Se entregan siempre con la promoción.</p>
        </div>
        {!disabled && (
          <div className="mb-2 relative z-20">
            <BuscadorProducto onSelect={agregarItemFijo} />
          </div>
        )}
        <div className="space-y-1">
          {items.map((it, idx) => (
            <div key={it.stock_id} className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1">
              <span className="min-w-0 flex-1 truncate text-xs text-slate-700" title={it.denominacion}>
                {it.denominacion} <span className="text-[10px] text-slate-400 font-mono">({it.codigo})</span>
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={it.cantidad}
                onChange={(e) => cambiarCantidadItemFijo(idx, e.target.value)}
                disabled={disabled}
                className="h-7 w-16 text-right rounded-sm border border-slate-300 px-1 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-100"
                aria-label={`Cantidad de ${it.denominacion}`}
              />
              {!disabled && <BotonEliminar onClick={() => quitarItemFijo(idx)} title="Quitar componente" />}
            </div>
          ))}
          {items.length === 0 && (
            <p className="py-3 text-center text-xs text-slate-400">Busca y agrega los productos incluidos.</p>
          )}
        </div>
      </div>

      {/* Tarjeta 3: Alternativas (opcional) */}
      <div className={CLASES_SECCION_WRAPPER}>
        <div className="mb-1.5">
          <div className="flex items-center justify-between">
            <h5 className={CLASES_SECCION_TITULO}>
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Alternativas <span className="text-[10px] font-normal text-slate-400">(opcional)</span>
            </h5>
            {!disabled && (
              <button
                type="button"
                onClick={agregarGrupo}
                className="rounded border border-orange-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-orange-700 hover:bg-orange-50 transition-colors shadow-sm"
              >
                + Agregar alternativa
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">Permiten elegir entre productos al vender.</p>
        </div>
        <div className="space-y-2">
          {grupos.map((g, idxGrupo) => (
            <div key={g._clave || g.id} className="rounded border border-slate-200 bg-white p-2 overflow-visible">
              <div className="flex items-center gap-1.5 mb-1.5">
                <input
                  type="text"
                  placeholder="Nombre grupo (ej: Bebida)"
                  value={g.nombre}
                  onChange={(e) => cambiarCampoGrupo(idxGrupo, "nombre", e.target.value)}
                  disabled={disabled}
                  className="h-7 flex-1 rounded-sm border border-slate-300 px-2 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-100"
                />
                <span className="text-[11px] text-slate-500 whitespace-nowrap">Cant.</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={g.cantidad}
                  onChange={(e) => cambiarCampoGrupo(idxGrupo, "cantidad", e.target.value)}
                  disabled={disabled}
                  className="h-7 w-14 text-right rounded-sm border border-slate-300 px-1 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-100"
                />
                {!disabled && <BotonEliminar onClick={() => quitarGrupo(idxGrupo)} title="Quitar grupo" />}
              </div>
              {!disabled && (
                <div className="mb-1.5 relative z-20">
                  <BuscadorProducto onSelect={(p) => agregarAlternativa(idxGrupo, p)} />
                </div>
              )}
              <div className="space-y-1">
                {g.alternativas.map((alt, idxAlt) => (
                  <div key={alt.stock_id} className="flex items-center gap-2 rounded-sm border border-slate-200 bg-slate-50 px-2 py-0.5">
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-700" title={alt.denominacion}>
                      {alt.denominacion} <span className="text-[10px] text-slate-400 font-mono">({alt.codigo})</span>
                    </span>
                    {!disabled && (
                      <BotonEliminar onClick={() => quitarAlternativa(idxGrupo, idxAlt)} title="Quitar alternativa" />
                    )}
                  </div>
                ))}
              </div>
              {g.alternativas.length < 2 && (
                <p className="text-[11px] text-amber-600 mt-1">Requiere al menos dos alternativas.</p>
              )}
            </div>
          ))}
          {grupos.length === 0 && (
            <p className="py-3 text-center text-xs text-slate-400">No hay alternativas configuradas.</p>
          )}
        </div>
      </div>
    </>
  )
}

export default EditorComponentesPromo
