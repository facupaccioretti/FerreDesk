"use client"

import React from "react"
import BotonAccionesProductos from "./BotonAccionesProductos"

const FiltrosProductos = ({
  familias = [],
  fam1Filtro,
  setFam1Filtro,
  fam2Filtro,
  setFam2Filtro,
  fam3Filtro,
  setFam3Filtro,
  buscarPorCodigoProveedor,
  setBuscarPorCodigoProveedor,
  setSearchProductos,
  onNuevoProducto,
  onGestionarFamilias,
  onActualizarListas,
}) => {
  const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500 font-semibold"
  const CLASES_INPUT = "w-full border border-slate-300 rounded-lg px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 bg-white transition-all duration-200"
  const CLASES_FILTRO = "bg-white border border-slate-200/60 rounded-xl p-2.5 h-16 flex flex-col justify-between shadow-sm"

  return (
    <div className="flex items-start gap-3 w-full mb-4 flex-wrap sm:flex-nowrap">
      {/* Familia */}
      <div className={`${CLASES_FILTRO} flex-1 min-w-[120px]`}>
        <div className={CLASES_ETIQUETA}>Familia</div>
        <div className="mt-0.5">
          <select
            value={fam1Filtro}
            onChange={(e) => setFam1Filtro(e.target.value)}
            className={CLASES_INPUT}
          >
            <option value="">Todas</option>
            {familias
              .filter((f) => f.nivel === "1")
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.deno}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Subfamilia */}
      <div className={`${CLASES_FILTRO} flex-1 min-w-[120px]`}>
        <div className={CLASES_ETIQUETA}>Subfamilia</div>
        <div className="mt-0.5">
          <select
            value={fam2Filtro}
            onChange={(e) => setFam2Filtro(e.target.value)}
            className={CLASES_INPUT}
          >
            <option value="">Todas</option>
            {familias
              .filter((f) => f.nivel === "2")
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.deno}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Sub-subfamilia */}
      <div className={`${CLASES_FILTRO} flex-1 min-w-[120px]`}>
        <div className={CLASES_ETIQUETA}>Sub-sub</div>
        <div className="mt-0.5">
          <select
            value={fam3Filtro}
            onChange={(e) => setFam3Filtro(e.target.value)}
            className={CLASES_INPUT}
          >
            <option value="">Todas</option>
            {familias
              .filter((f) => f.nivel === "3")
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.deno}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Modo de Búsqueda */}
      <div className={`${CLASES_FILTRO} flex-1 justify-center items-start min-w-[150px]`}>
        <div className={CLASES_ETIQUETA}>Modo de Búsqueda</div>
        <div className="mt-1 flex items-center h-8">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none hover:text-orange-600 transition-colors">
            <input
              type="checkbox"
              checked={buscarPorCodigoProveedor}
              onChange={(e) => {
                setBuscarPorCodigoProveedor(e.target.checked)
                setSearchProductos("") // Limpiar búsqueda al cambiar modo para evitar resultados cruzados
              }}
              className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
            />
            Buscar por codigo de proveedor
          </label>
        </div>
      </div>

      {/* Acciones */}
      <div className={`${CLASES_FILTRO} w-36 justify-between flex-none`}>
        <div className={CLASES_ETIQUETA}>Acciones</div>
        <div className="mt-0.5">
          <BotonAccionesProductos
            onNuevoProducto={onNuevoProducto}
            onGestionarFamilias={onGestionarFamilias}
            onActualizarListas={onActualizarListas}
          />
        </div>
      </div>
    </div>
  )
}

export default FiltrosProductos
