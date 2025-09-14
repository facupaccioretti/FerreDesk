"use client"

import { useState, useRef, useEffect } from "react"
import { BotonEditar, BotonEliminar, BotonGenerarPDF, BotonConvertir, BotonVerDetalle, BotonNotaCredito } from "../../Botones"

/**
 * Componente para mostrar un menú de acciones con botón de 3 puntos
 * @param {Object} props - Props del componente
 * @param {Object} props.comprobante - Datos del comprobante
 * @param {Object} props.acciones - Funciones de acciones disponibles
 * @param {boolean} props.isFetchingForConversion - Estado de carga para conversión
 * @param {number} props.fetchingPresupuestoId - ID del presupuesto siendo convertido
 * @param {Function} props.esFacturaInternaConvertible - Función para verificar si es factura interna convertible
 * @returns {JSX.Element} - Botón de 3 puntos con menú de acciones
 */
const AccionesMenu = ({
  comprobante,
  acciones,
  isFetchingForConversion,
  fetchingPresupuestoId,
  esFacturaInternaConvertible,
}) => {
  const [visible, setVisible] = useState(false)
  const menuRef = useRef(null)
  const buttonRef = useRef(null)

  const {
    handleImprimir,
    openVistaTab,
    handleEdit,
    handleConvertir,
    handleDelete,
    handleConvertirFacturaI,
    handleNotaCredito,
  } = acciones

  const toggleVisibilidad = (e) => {
    e.stopPropagation()
    setVisible(!visible)
  }

  const handleClickAfuera = (event) => {
    if (
      menuRef.current &&
      !menuRef.current.contains(event.target) &&
      buttonRef.current &&
      !buttonRef.current.contains(event.target)
    ) {
      setVisible(false)
    }
  }

  useEffect(() => {
    if (visible) {
      document.addEventListener("mousedown", handleClickAfuera)
    } else {
      document.removeEventListener("mousedown", handleClickAfuera)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickAfuera)
    }
  }, [visible])

  // Función para determinar si una factura puede tener NC
  const puedeTenerNotaCredito = (comp) => {
    const esFactura = comp.comprobante?.tipo === 'factura' || 
                     comp.comprobante?.tipo === 'venta' || 
                     comp.comprobante?.tipo === 'factura_interna';
    const letraValida = ['A', 'B', 'C', 'I'].includes(comp.comprobante?.letra);
    const estaCerrada = comp.estado === 'Cerrado';
    return esFactura && letraValida && estaCerrada;
  };

  // Función para obtener las acciones disponibles según el tipo de comprobante
  const obtenerAccionesDisponibles = () => {
    const accionesDisponibles = []

    // Presupuesto abierto
    if (comprobante.tipo === "Presupuesto" && comprobante.estado === "Abierto") {
      accionesDisponibles.push(
        { 
          componente: BotonGenerarPDF, 
          onClick: () => handleImprimir(comprobante),
          titulo: "Generar PDF"
        },
        { 
          componente: BotonVerDetalle, 
          onClick: () => openVistaTab(comprobante),
          titulo: "Ver detalle"
        },
        { 
          componente: BotonEditar, 
          onClick: () => handleEdit(comprobante),
          titulo: "Editar"
        },
        { 
          componente: BotonConvertir, 
          onClick: () => handleConvertir(comprobante),
          titulo: isFetchingForConversion && fetchingPresupuestoId === comprobante.id ? "Cargando..." : "Convertir",
          disabled: isFetchingForConversion && fetchingPresupuestoId === comprobante.id
        },
        { 
          componente: BotonEliminar, 
          onClick: () => handleDelete(comprobante.id),
          titulo: "Eliminar"
        }
      )
    }
    // Facturas cerradas que pueden tener NC
    else if (puedeTenerNotaCredito(comprobante)) {
      const esFacturaInternaConvertibleActual = comprobante.comprobante?.tipo === 'factura_interna' && 
        esFacturaInternaConvertible(comprobante);

      accionesDisponibles.push(
        { 
          componente: BotonGenerarPDF, 
          onClick: () => handleImprimir(comprobante),
          titulo: "Generar PDF"
        },
        { 
          componente: BotonVerDetalle, 
          onClick: () => openVistaTab(comprobante),
          titulo: "Ver detalle"
        },
        { 
          componente: BotonNotaCredito, 
          onClick: () => handleNotaCredito(comprobante),
          titulo: "Crear Nota de Crédito"
        }
      )

      // Botón de conversión para facturas internas
      if (esFacturaInternaConvertibleActual) {
        accionesDisponibles.push({
          componente: BotonConvertir,
          onClick: () => handleConvertirFacturaI(comprobante),
          titulo: isFetchingForConversion && fetchingPresupuestoId === comprobante.id ? "Cargando..." : "Convertir a Factura",
          disabled: isFetchingForConversion && fetchingPresupuestoId === comprobante.id
        })
      }

      accionesDisponibles.push({
        componente: BotonEliminar,
        onClick: () => handleDelete(comprobante.id),
        titulo: "Eliminar"
      })
    }
    // Venta cerrada (sin botón NC)
    else if (comprobante.tipo === "Venta" && comprobante.estado === "Cerrado") {
      accionesDisponibles.push(
        { 
          componente: BotonGenerarPDF, 
          onClick: () => handleImprimir(comprobante),
          titulo: "Generar PDF"
        },
        { 
          componente: BotonVerDetalle, 
          onClick: () => openVistaTab(comprobante),
          titulo: "Ver detalle"
        },
        { 
          componente: BotonEliminar, 
          onClick: () => handleDelete(comprobante.id),
          titulo: "Eliminar"
        }
      )
    }
    // Otros casos (solo ver y generar PDF)
    else {
      accionesDisponibles.push(
        { 
          componente: BotonVerDetalle, 
          onClick: () => openVistaTab(comprobante),
          titulo: "Ver detalle"
        },
        { 
          componente: BotonGenerarPDF, 
          onClick: () => handleImprimir(comprobante),
          titulo: "Generar PDF"
        }
      )
    }

    return accionesDisponibles
  }

  const accionesDisponibles = obtenerAccionesDisponibles()

  if (accionesDisponibles.length === 0) {
    return null
  }

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleVisibilidad}
        className="group flex items-center justify-center w-8 h-8 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 rounded-lg border border-slate-300/50 hover:from-orange-50 hover:to-orange-100 hover:text-orange-700 hover:border-orange-300/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 shadow-sm hover:shadow-md"
        aria-label="Mostrar acciones"
      >
        <svg
          className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </button>

      {visible && (
        <div
          ref={menuRef}
          className="absolute z-50 w-48 right-0 mt-2 bg-white rounded-lg shadow-2xl border border-slate-200/80"
          role="menu"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-t-lg">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
              <h4 className="font-bold text-xs text-slate-800">Acciones</h4>
            </div>
            <button
              onClick={() => setVisible(false)}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded transition-all duration-150"
              aria-label="Cerrar menú"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-1">
            <div className="space-y-0.5">
              {accionesDisponibles.map((accion, index) => {
                const ComponenteAccion = accion.componente
                return (
                  <div key={index} className="group">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        accion.onClick()
                        setVisible(false)
                      }}
                      disabled={accion.disabled}
                      className="w-full flex items-center gap-3 p-2 bg-slate-50/50 hover:bg-slate-100/80 rounded transition-all duration-200 border border-transparent hover:border-slate-200/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={accion.titulo}
                    >
                      <div className="flex-shrink-0">
                        <ComponenteAccion 
                          onClick={() => {}} // El onClick se maneja en el botón padre
                          disabled={accion.disabled}
                          className="!p-0 !m-0" // Resetear estilos del botón individual
                        />
                      </div>
                      <span className="text-xs text-slate-700 font-medium text-left">
                        {accion.titulo}
                      </span>
                    </button>

                    {/* Separador sutil entre elementos */}
                    {index < accionesDisponibles.length - 1 && (
                      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mx-2 my-0.5"></div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccionesMenu
