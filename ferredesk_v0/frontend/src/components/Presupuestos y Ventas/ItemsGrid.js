"use client"

// ItemsGrid.js — Componente de presentación para la grilla de ítems de venta/presupuesto/NC.
//
// POR QUÉ DE ESTA REFACTORIZACIÓN: Este archivo tenía ~1583 líneas mezclando estado,
// búsqueda, cálculos, duplicados, focus y renderizado. La lógica ahora vive en
// useItemsGridState.js y las fábricas de ítems en tipoItem.js.
// Este componente solo se encarga del renderizado (tabla + inputs + botones).

import { useImperativeHandle, forwardRef } from "react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { useItemsGridState } from "./hooks/useItemsGridState"

import { BotonDuplicar, BotonEliminar } from "../Botones"

const ItemsGridPresupuesto = forwardRef(
  (
    {
      autoSumarDuplicados,
      setAutoSumarDuplicados,
      bonificacionGeneral,
      setBonificacionGeneral,
      modo = "presupuesto",
      onRowsChange,
      initialItems,
      descu1 = 0,
      descu2 = 0,
      descu3 = 0,
      totales = {},
      alicuotas = {},
      setDescu1 = () => { },
      setDescu2 = () => { },
      setDescu3 = () => { },
      readOnly = false,
      listaPrecioId = 0,
      listasPrecio = [],
    },
    ref,
  ) => {
    const theme = useFerreDeskTheme()

    // ── Hook centralizado: toda la lógica de estado, búsqueda y cálculos ──
    const {
      rows,
      stockNegativo,
      modoLector,
      setModoLector,
      aliMap,
      codigoRefs,
      cantidadRefs,
      bonificacionRefs,
      handleRowChange,
      handleCantidadChange,
      handleRowKeyDown,
      handleCodigoBlur,
      handleDeleteRow,
      handleDuplicarRow,
      handleIvaChange,
      handleAddItem,
      handleMouseEnterTooltip,
      handleMouseLeaveTooltip,
      manejarFocoSeleccionCompleta,
      mostrarTooltipBonif,
      setMostrarTooltipBonif,
      mostrarTooltipDescuentos,
      setMostrarTooltipDescuentos,
      mostrarTooltipOriginal,
      posicionTooltip,
      isRowLleno,
      isDuplicado,
      getItems,
      getRows,
    } = useItemsGridState({
      initialItems,
      autoSumarDuplicados,
      modo,
      readOnly,
      listaPrecioId,
      listasPrecio,
      alicuotas,
      onRowsChange,
    })

    // ── Exponer API pública para que los forms padres puedan acceder ──
    useImperativeHandle(
      ref,
      () => ({
        getItems,
        getRows,
        handleAddItem,
        getStockNegativo: () => stockNegativo,
        _debugRows: () => { },
      }),
      [getItems, getRows, handleAddItem, stockNegativo],
    )

    // ── Render ──
    return (
      <div className="space-y-4 w-full">
        {/* ── Barra de controles: bonificación, descuentos, modo lector, totales ── */}
        <div className="grid gap-4 mb-2 items-end" style={{ gridTemplateColumns: 'auto auto auto 1fr' }}>
          {/* Bonificación general */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Bonificación general (%)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={bonificacionGeneral}
                onChange={(e) => {
                  const value = Math.min(Math.max(Number.parseFloat(e.target.value) || 0, 0), 100)
                  setBonificacionGeneral(value)
                }}
                onFocus={manejarFocoSeleccionCompleta}
                disabled={readOnly}
                className={`w-24 px-3 py-2 border border-slate-300 rounded-xl text-sm transition-all duration-200 shadow-sm ${readOnly
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-slate-400'
                  }`}
              />
              <div
                className="relative cursor-pointer"
                onMouseEnter={() => setMostrarTooltipBonif?.(true)}
                onMouseLeave={() => setMostrarTooltipBonif?.(false)}
              >
                <div className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5 text-slate-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                  </svg>
                </div>
                {mostrarTooltipBonif && (
                  <div className="absolute left-8 top-0 z-20 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                    La bonificación general solo se aplica a ítems sin bonificación particular.
                    <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Descuento 1 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Descuento 1 (%)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={descu1}
                onChange={(e) => {
                  const value = Math.min(Math.max(Number.parseFloat(e.target.value) || 0, 0), 100)
                  setDescu1(value)
                }}
                onFocus={manejarFocoSeleccionCompleta}
                disabled={readOnly}
                className={`w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm transition-all duration-200 ${readOnly
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                  }`}
              />
            </div>
          </div>

          {/* Descuento 2 + tooltip + modo lector */}
          <div className="flex items-center gap-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Descuento 2 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={descu2}
                onChange={(e) => {
                  const value = Math.min(Math.max(Number.parseFloat(e.target.value) || 0, 0), 100)
                  setDescu2(value)
                }}
                onFocus={manejarFocoSeleccionCompleta}
                disabled={readOnly}
                className={`w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm transition-all duration-200 ${readOnly
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                  }`}
              />
            </div>
            {/* Tooltip descuentos escalonados */}
            <div
              className="relative cursor-pointer mt-5"
              onMouseEnter={() => setMostrarTooltipDescuentos(true)}
              onMouseLeave={() => setMostrarTooltipDescuentos(false)}
            >
              <div className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5 text-slate-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                </svg>
              </div>
              {mostrarTooltipDescuentos && (
                <div className="absolute left-8 top-0 z-20 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                  Los descuentos se aplican de manera sucesiva sobre el subtotal neto.
                  <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                </div>
              )}
            </div>

            {/* Modo lector */}
            <label className="flex items-center gap-2 mt-5 ml-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={modoLector}
                onChange={(e) => setModoLector(e.target.checked)}
                disabled={readOnly}
                className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
              />
              <span className="text-sm font-medium text-slate-700">Modo lector</span>
            </label>
          </div>

          {/* Resumen de Totales compacto */}
          <div className="col-span-1 flex justify-end items-end">
            <div className="min-w-[420px]">
              <div className="w-full bg-slate-700 rounded-xl shadow border border-slate-600/50 px-6 py-2">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className={`${theme.fuente} font-semibold`}>Subtotal s/IVA:</span>
                    <span className="text-white font-bold text-base">${totales.subtotal?.toFixed(2) ?? "0.00"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`${theme.fuente} font-semibold`}>Subtotal c/Desc:</span>
                    <span className="text-white font-bold text-base">${totales.subtotalConDescuentos?.toFixed(2) ?? "0.00"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`${theme.fuente} font-semibold`}>IVA:</span>
                    <span className="text-white font-bold text-base">${totales.iva?.toFixed(2) ?? "0.00"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`${theme.fuente} font-semibold`}>Total c/IVA:</span>
                    <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-3 py-1 rounded-lg shadow">
                      <span className="font-bold text-base">${totales.total?.toFixed(2) ?? "0.00"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabla de ítems ── */}
        <div className="w-full">
          <div className="max-h-[20rem] overflow-y-auto overscroll-contain rounded-xl border border-slate-200/50 shadow-lg">
            <table className="items-grid min-w-full divide-y divide-slate-200">
              <thead className="bg-gradient-to-r from-slate-800 to-slate-700 sticky top-0">
                <tr className="bg-slate-700">
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-10">Nro.</th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-24">Código</th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-48">Detalle</th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-14">Unidad</th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-12">Cantidad</th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-32">Precio Unitario</th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-16">Bonif. %</th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-24">Precio Unit Bonif.</th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-20">IVA %</th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-24">Total</th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-10">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {rows.map((row, idx) => {
                  const aliPorcRow = aliMap[row.idaliiva ?? row.producto?.idaliiva?.id ?? row.producto?.idaliiva ?? 0] || 0
                  const precioConIVA =
                    row.precioFinal !== "" && row.precioFinal !== undefined
                      ? Number(row.precioFinal)
                      : (row.precio !== "" && row.precio !== undefined
                        ? Number((Number.parseFloat(row.precio) * (1 + aliPorcRow / 100)).toFixed(2))
                        : 0)
                  const bonifParticular = Number.parseFloat(row.bonificacion)
                  const bonifGeneral = Number.parseFloat(bonificacionGeneral) || 0
                  const bonifEfectiva = (Number.isFinite(bonifParticular) && bonifParticular > 0)
                    ? bonifParticular
                    : bonifGeneral
                  const precioBonificado = precioConIVA * (1 - (bonifEfectiva / 100))

                  let precioConDescuentos = precioBonificado
                  if (descu1 > 0) precioConDescuentos *= (1 - descu1 / 100)
                  if (descu2 > 0) precioConDescuentos *= (1 - descu2 / 100)
                  if (descu3 > 0) precioConDescuentos *= (1 - descu3 / 100)

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors duration-200 hover:bg-slate-50/50 ${isDuplicado(row, idx)
                        ? "bg-gradient-to-r from-red-50 to-red-100/50 border-l-4 border-red-400"
                        : row.esBloqueado
                          ? "bg-blue-50"
                          : ""
                        }`}
                    >
                      <td className="px-3 py-3 whitespace-nowrap text-center text-sm font-medium text-slate-600">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <input
                          type="text"
                          value={row.codigo}
                          onChange={(e) => handleRowChange(idx, "codigo", e.target.value)}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, "codigo")}
                          onBlur={() => handleCodigoBlur(idx)}
                          onFocus={manejarFocoSeleccionCompleta}
                          className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm transition-all duration-200 shadow-sm ${row.esBloqueado
                            ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                            : "bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-slate-400"
                            }`}
                          placeholder="Código"
                          aria-label="Código producto"
                          tabIndex={row.esBloqueado ? -1 : 0}
                          disabled={row.esBloqueado}
                          readOnly={row.esBloqueado}
                          ref={(el) => (codigoRefs.current[idx] = el)}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {row.producto ? (
                          <div className="w-full px-3 py-2 text-slate-700 min-h-[38px] flex items-center">
                            {row.denominacion || ""}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={row.denominacion}
                            onChange={(e) => handleRowChange(idx, "denominacion", e.target.value)}
                            onFocus={manejarFocoSeleccionCompleta}
                            className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm transition-all duration-200 shadow-sm ${row.esBloqueado
                              ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                              : "bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-slate-400"
                              }`}
                            placeholder="Detalle"
                            aria-label="Detalle ítem genérico"
                            disabled={row.esBloqueado}
                            readOnly={row.esBloqueado}
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600 font-medium">
                        {row.unidad || "-"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          value={row.cantidad}
                          onChange={(e) => handleCantidadChange(idx, e.target.value)}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, "cantidad")}
                          onFocus={manejarFocoSeleccionCompleta}
                          min={row.producto || (Number(row.precio) > 0) ? 1 : 0}
                          className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm transition-all duration-200 shadow-sm ${row.esBloqueado
                            ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                            : "bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-slate-400"
                            }`}
                          aria-label="Cantidad"
                          tabIndex={row.esBloqueado ? -1 : 0}
                          disabled={row.esBloqueado}
                          readOnly={row.esBloqueado}
                          ref={(el) => (cantidadRefs.current[idx] = el)}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={
                            row.precioFinal !== "" && row.precioFinal !== undefined
                              ? row.precioFinal
                              : (row.precio !== "" && row.precio !== undefined
                                ? row.precio
                                : "")
                          }
                          onChange={(e) => handleRowChange(idx, "precio", e.target.value)}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, "precio")}
                          onFocus={manejarFocoSeleccionCompleta}
                          className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm transition-all duration-200 shadow-sm appearance-none ${row.esBloqueado
                            ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                            : "bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-slate-400"
                            }`}
                          style={{ MozAppearance: 'textfield' }}
                          aria-label="Precio Unitario"
                          tabIndex={row.esBloqueado ? -1 : 0}
                          disabled={row.esBloqueado}
                          readOnly={row.esBloqueado}
                          placeholder={row.producto ? "" : ""}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          value={row.bonificacion}
                          onChange={(e) => handleRowChange(idx, "bonificacion", e.target.value)}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, "bonificacion")}
                          onFocus={manejarFocoSeleccionCompleta}
                          min="0"
                          max="100"
                          step="0.01"
                          className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm transition-all duration-200 shadow-sm ${row.esBloqueado
                            ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                            : "bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-slate-400"
                            }`}
                          aria-label="Bonificación particular"
                          tabIndex={row.esBloqueado ? -1 : 0}
                          disabled={row.esBloqueado}
                          readOnly={row.esBloqueado}
                          ref={(el) => (bonificacionRefs.current[idx] = el)}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="w-full px-3 py-2 text-sky-600 min-h-[38px] flex items-center font-semibold">
                          {(row.producto || (row.denominacion && row.denominacion.trim() !== ""))
                            ? `$${Number(precioBonificado.toFixed(2)).toLocaleString()}`
                            : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600 font-medium">
                        {(() => {
                          const alicuotaId = row.idaliiva ?? row.producto?.idaliiva?.id ?? row.producto?.idaliiva ?? 0
                          if (!row.producto && Number(row.precio) > 0 && !row.esBloqueado) {
                            return (
                              <select
                                value={alicuotaId}
                                onChange={(e) => handleIvaChange(idx, Number(e.target.value))}
                                className="px-2 py-1 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                              >
                                {[3, 4, 5, 6].filter(id => aliMap[id] !== undefined).map(id => (
                                  <option key={id} value={id}>{aliMap[id]}%</option>
                                ))}
                              </select>
                            )
                          }
                          const aliPorc = aliMap[alicuotaId] || 0
                          return aliPorc + "%"
                        })()}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="px-3 py-2 text-emerald-600 font-semibold text-sm">
                          {(row.producto || (row.denominacion && row.denominacion.trim() !== ""))
                            ? `$${Number((precioConDescuentos * (Number.parseFloat(row.cantidad) || 0)).toFixed(2)).toLocaleString()}`
                            : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isRowLleno(row) && (
                            <>
                              {row.esBloqueado ? (
                                <div
                                  className="flex items-center gap-1 text-xs text-blue-600 font-medium cursor-pointer"
                                  onMouseEnter={(e) => handleMouseEnterTooltip(idx, e)}
                                  onMouseLeave={() => handleMouseLeaveTooltip(idx)}
                                >
                                  <span>Original</span>
                                  <div className="w-4 h-4 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center transition-colors duration-200">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-2.5 h-2.5 text-blue-600">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                                    </svg>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <BotonDuplicar onClick={() => handleDuplicarRow(idx)} />
                                  <BotonEliminar onClick={() => handleDeleteRow(idx)} />
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tooltip flotante global para items originales */}
        {Object.values(mostrarTooltipOriginal).some(Boolean) && (
          <div
            className="fixed z-[9999] bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none whitespace-nowrap"
            style={{
              left: `${posicionTooltip.x}px`,
              top: `${posicionTooltip.y}px`,
              transform: 'translateX(-50%)'
            }}
          >
            Ítem original de venta - No editable.
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-slate-800"></div>
          </div>
        )}

      </div>
    )
  },
)

export function ItemsGridVenta(props, ref) {
  return <ItemsGridPresupuesto {...props} ref={ref} />
}

export default ItemsGridPresupuesto;