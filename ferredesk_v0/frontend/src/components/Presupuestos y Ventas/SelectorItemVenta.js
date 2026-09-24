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
            className="shrink-0 h-8 px-3 rounded-sm text-xs font-semibold bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-300 transition-colors disabled:opacity-50"
            title="Agregar promoción"
          >
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
