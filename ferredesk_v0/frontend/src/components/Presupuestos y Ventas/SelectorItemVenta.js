"use client"

// SelectorItemVenta.js — Reemplazo drop-in de BuscadorProducto para los
// formularios de venta que aceptan promociones: mismo buscador de productos
// de siempre, mas un boton "Promociones" que abre el selector/configurador.
//
// POR QUE UN SOLO COMPONENTE: toda la logica de abrir el selector, decidir si
// una promo necesita configurador (tiene grupos) o se agrega directo, y de
// reconfigurar una linea ya cargada vive ACA UNA SOLA VEZ. Los 4 formularios
// que integran promociones (VentaForm, PresupuestoForm, EditarPresupuestoForm,
// PostventaForm en modo cambio) lo usan igual, sin reimplementar nada de esto.

import { forwardRef, useImperativeHandle, useState } from "react"
import BuscadorProducto from "../BuscadorProducto"
import SelectorPromocionModal from "../Promociones/SelectorPromocionModal"
import ConfiguradorPromocionModal from "../Promociones/ConfiguradorPromocionModal"
import { obtenerPromocionPorId } from "../Promociones/hooks/usePromocionesAPI"
import { resolverEleccionesDesdeComponentes } from "./herramientasforms/tipoItem"

const SelectorItemVenta = forwardRef(
  ({ onSelectProducto, onAgregarPromocion, onReconfigurarPromocion, disabled = false, readOnly = false, className = "" }, ref) => {
    const [selectorAbierto, setSelectorAbierto] = useState(false)
    // { modo: 'agregar'|'reconfigurar', promocion, eleccionesIniciales, idx? }
    const [configurador, setConfigurador] = useState(null)
    const [cargandoPromocion, setCargandoPromocion] = useState(false)

    useImperativeHandle(ref, () => ({
      // Llamado por el padre cuando el usuario aprieta "Reconfigurar" en una
      // fila de promocion ya cargada en la grilla (ver ItemsGrid.js).
      iniciarReconfiguracion: async (idx, row) => {
        if (!row?.promocionId) return
        setCargandoPromocion(true)
        try {
          const promocionCompleta = await obtenerPromocionPorId(row.promocionId)
          const eleccionesIniciales = row.eleccionesGrupos?.length
            ? row.eleccionesGrupos
            : resolverEleccionesDesdeComponentes(promocionCompleta, row.componentesPromocion)
          setConfigurador({ modo: "reconfigurar", promocion: promocionCompleta, eleccionesIniciales, idx })
        } catch (err) {
          alert(err?.message || "No se pudo cargar la promoción para reconfigurarla.")
        } finally {
          setCargandoPromocion(false)
        }
      },
    }))

    const handleSeleccionarPromocion = (promocion) => {
      setSelectorAbierto(false)
      const tieneGrupos = (promocion.grupos || []).length > 0
      if (!tieneGrupos) {
        onAgregarPromocion(promocion, [], 1)
        return
      }
      setConfigurador({ modo: "agregar", promocion, eleccionesIniciales: [] })
    }

    const handleConfirmarConfigurador = (eleccionesGrupos, cantidad) => {
      if (configurador.modo === "agregar") {
        onAgregarPromocion(configurador.promocion, eleccionesGrupos, cantidad)
      } else {
        onReconfigurarPromocion(configurador.idx, configurador.promocion, eleccionesGrupos)
      }
      setConfigurador(null)
    }

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <BuscadorProducto onSelect={onSelectProducto} disabled={disabled} readOnly={readOnly} className="flex-1" />
        {!disabled && !readOnly && (
          <button
            type="button"
            onClick={() => setSelectorAbierto(true)}
            disabled={cargandoPromocion}
            className="shrink-0 h-8 px-3 rounded-sm text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 hover:text-orange-600 border border-slate-300 hover:border-slate-400 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            title="Agregar promoción"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Promociones
          </button>
        )}

        <SelectorPromocionModal
          abierto={selectorAbierto}
          onCerrar={() => setSelectorAbierto(false)}
          onSeleccionar={handleSeleccionarPromocion}
        />

        <ConfiguradorPromocionModal
          abierto={!!configurador}
          modo={configurador?.modo}
          promocion={configurador?.promocion}
          eleccionesIniciales={configurador?.eleccionesIniciales || []}
          onConfirmar={handleConfirmarConfigurador}
          onCancelar={() => setConfigurador(null)}
        />
      </div>
    )
  },
)

export default SelectorItemVenta
