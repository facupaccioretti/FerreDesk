"use client"

import { Fragment, useState, useMemo, useEffect } from "react"
import { Dialog, Transition } from "@headlessui/react"
import Buscador from "../../Buscador"
import Tabla from "../../Tabla"
import { useFerreDeskTheme } from "../../../hooks/useFerreDeskTheme"

// --- Configuración ---
export const ALTURA_MAX_TABLA = "60vh" // Altura máxima de tabla dentro del modal
export const MIN_CARACTERES_BUSQUEDA = 1 // Mínimo de caracteres para que se active filtrado
// Array de posibles nombres para el tipo de comprobante "Factura" que la API podría esperar.
// Se utiliza el primer valor para la petición directa, los demás son para un posible filtrado local de respaldo.
export const TIPOS_COMPROBANTE_FACTURA = ["Factura", "factura", "factura_interna", "Factura Interna", "Cotización", "cotizacion"]
export const LETRA_FACTURA_INTERNA = 'I';

/**
 * FacturaSelectorModal
 * Modal reutilizable para seleccionar una o varias facturas de un cliente.
 *
 * Props:
 *  - abierto: boolean              -> controla visibilidad
 *  - cliente: object|null          -> cliente del cual buscar facturas
 *  - onCerrar: function()          -> callback para cerrar sin seleccionar
 *  - onSeleccionar: function(arr)  -> callback con array de facturas elegidas
 */
export default function FacturaSelectorModal({ abierto = false, cliente = null, onCerrar = () => {}, onSeleccionar = () => {} }) {
  // Hook para el tema de FerreDesk
  const theme = useFerreDeskTheme()
  
  // --- Estado interno ---
  const [termino, setTermino] = useState("")
  const [facturas, setFacturas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [seleccionadas, setSeleccionadas] = useState([]) // array de IDs seleccionados (string|number)

  // Reiniciar estado cada vez que abre o cambia cliente
  useEffect(() => {
    if (abierto) {
      setTermino("")
      setSeleccionadas([])
      obtenerFacturas()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, cliente?.id])

  // Fetch de facturas del cliente
  const obtenerFacturas = async () => {
    if (!cliente?.id) return
    setCargando(true)
    setError(null)
    try {
      // NUEVO: Usar filtro backend para obtener solo facturas válidas
      const params = new URLSearchParams({
        ven_idcli: cliente.id,
        para_nota_credito: 'true'  // ← NUEVO: Filtro backend
      })
      const url = `/api/ventas/?${params.toString()}`
      console.log("[FacturaSelectorModal] URL de la petición:", url)
      
      const resp = await fetch(url, { credentials: "include" })
      if (!resp.ok) throw new Error("No se pudieron obtener las facturas")
      const data = await resp.json()
      
      // Normalizar para asegurar estructura mínima y soportar paginación
      const lista = Array.isArray(data) ? data : data.results || []
      console.log("[FacturaSelectorModal] Datos recibidos del backend:", lista.length, "registros")
      
      // DEBUG: Mostrar tipos de comprobantes recibidos
      const tiposRecibidos = [...new Set(lista.map(f => f.comprobante?.tipo))];
      console.log("[FacturaSelectorModal] Tipos de comprobantes recibidos:", tiposRecibidos);
      
      // NUEVO: Backend ya filtró, solo validación adicional en frontend
      const facturasValidas = lista.filter(f => {
        const letra = f.comprobante?.letra;
        const tipo = f.comprobante?.tipo;
        // Doble verificación: letra + tipo (seguridad adicional)
        const esValida = ['A', 'B', 'C', LETRA_FACTURA_INTERNA].includes(letra) && 
                        ['factura', 'venta'].includes(tipo);
        
        // DEBUG: Mostrar qué comprobantes se están filtrando
        if (!esValida) {
          console.log("[FacturaSelectorModal] Comprobante filtrado:", {
            numero: f.numero_formateado,
            tipo: tipo,
            letra: letra,
            razon: `Tipo: ${tipo}, Letra: ${letra}`
          });
        }
        
        return esValida;
      });
      
      console.log("[FacturaSelectorModal] Facturas válidas después del filtro:", facturasValidas.length);
      setFacturas(facturasValidas)
    } catch (err) {
      console.error("[FacturaSelectorModal] Error al obtener facturas:", err)
      setError(err.message || "Error desconocido")
    } finally {
      setCargando(false)
    }
  }

  // Filtrado por término de búsqueda
  const facturasFiltradas = useMemo(() => {
    if (termino.length < MIN_CARACTERES_BUSQUEDA) return facturas
    const lower = termino.toLowerCase()
    return facturas.filter((f) => {
      const campos = [f.numero_formateado, f.numero, f.ven_fecha, f.ven_total, f.ven_estado]
      return campos.some((c) => String(c || "").toLowerCase().includes(lower))
    })
  }, [facturas, termino])

  // Helpers de selección
  const getId = (fac) => fac.id ?? fac.ven_id ?? fac.idventa ?? fac.vdi_idve ?? fac.vdi_id ?? null

  // Validación en tiempo real de letras
  const validarSeleccionLetras = (nuevasFacturas) => {
    if (nuevasFacturas.length <= 1) return { valido: true };
    
    const letras = [...new Set(nuevasFacturas.map(f => f.comprobante?.letra))];
    
    if (letras.length > 1) {
      return {
        valido: false,
        mensaje: `No se pueden seleccionar facturas de distinto tipo.\n` +
                 `Facturas encontradas: ${letras.join(', ')}\n\n` +
                 `Una Nota de Crédito solo puede anular facturas del mismo tipo.`
      };
    }
    
    return { valido: true };
  };

  // Modificar toggleSeleccion para incluir validación
  const toggleSeleccion = (fac) => {
    const id = getId(fac)
    if (id === null) return
    
    const nuevasSeleccionadas = seleccionadas.includes(id)
      ? seleccionadas.filter(s => s !== id)
      : [...seleccionadas, id];
    
    // Obtener facturas correspondientes a las nuevas selecciones
    const facturasNuevas = facturas.filter(f => nuevasSeleccionadas.includes(getId(f)));
    
    // Validar consistencia de letras
    const validacion = validarSeleccionLetras(facturasNuevas);
    
    if (!validacion.valido) {
      alert(validacion.mensaje);
      return; // No actualizar selección si es inválida
    }
    
    setSeleccionadas(nuevasSeleccionadas);
  }
  const estaSeleccionada = (fac) => seleccionadas.includes(getId(fac))

  // Confirmar selección
  const handleConfirmar = () => {
    const elegidas = facturas.filter((f) => seleccionadas.includes(getId(f)))
    onSeleccionar(elegidas)
  }

  // Configuración de columnas para Tabla.js
  const columnas = [
    {
      id: "seleccion",
      titulo: "Sel.",
      align: "center",
      ancho: "60px",
      render: (fila) => (
        estaSeleccionada(fila) ? (
          <div className="w-4 h-4 bg-orange-600 rounded flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        ) : (
          <div className="w-4 h-4 border-2 border-slate-300 rounded"></div>
        )
      )
    },
    {
      id: "numero",
      titulo: "Número",
      align: "left",
      render: (fila) => (
        <span className="font-mono">{fila.numero_formateado || fila.numero}</span>
      )
    },
    {
      id: "fecha",
      titulo: "Fecha",
      align: "left",
      render: (fila) => fila.ven_fecha
    },
    {
      id: "total",
      titulo: "Total",
      align: "right",
      render: (fila) => `$${fila.ven_total}`
    }
  ]

  // Renderizado personalizado de fila para manejar el click en toda la fila
  const renderFila = (fila, idxVisible, indiceInicio) => (
    <tr 
      key={getId(fila)} 
      className={`hover:bg-orange-50 cursor-pointer transition-colors duration-150 ${estaSeleccionada(fila) ? "bg-orange-100/60" : ""}`}
      onClick={() => toggleSeleccion(fila)}
    >
      {columnas.map((col) => (
        <td
          key={col.id}
          className={`px-3 py-2 whitespace-nowrap text-sm text-slate-700 bg-white ${
            { left: "text-left", center: "text-center", right: "text-right" }[col.align || "left"]
          }`}
          style={col.ancho ? { width: col.ancho } : undefined}
        >
          {col.render ? col.render(fila, idxVisible, indiceInicio) : fila[col.id]}
        </td>
      ))}
    </tr>
  )

  return (
    <Transition show={abierto} as={Fragment} appear>
      <Dialog as="div" className="relative z-40" onClose={onCerrar}>
        {/* Fondo oscuro */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        {/* Panel */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              {/* Encabezado */}
              <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${theme.primario} text-white`}>
                <Dialog.Title className="text-lg font-bold">
                  Seleccionar Facturas de {cliente?.razon || cliente?.nombre || "cliente"}
                </Dialog.Title>
                <button
                  onClick={onCerrar}
                  aria-label="Cerrar"
                  className="text-white hover:text-slate-200 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6"
                  >
                    <path strokeLinecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Buscador */}
              <div className="px-6 py-4">
                <Buscador
                  items={facturas}
                  camposBusqueda={["numero_formateado", "numero", "fecha"]}
                  deshabilitarDropdown={true}
                  onInputChange={setTermino}
                  obtenerEtiqueta={() => termino}
                  placeholder="Buscar factura..."
                />
              </div>

              {/* Contenido */}
              {cargando ? (
                <div className="p-8 text-center text-slate-500">Cargando facturas…</div>
              ) : error ? (
                <div className="p-8 text-center text-red-600">{error}</div>
              ) : facturasFiltradas.length === 0 ? (
                <div className="p-8 text-center text-slate-500">Sin resultados</div>
              ) : (
                <div className="px-6 pb-6" style={{ height: ALTURA_MAX_TABLA }}>
                  <Tabla
                    columnas={columnas}
                    datos={facturasFiltradas}
                    valorBusqueda=""
                    onCambioBusqueda={() => {}}
                    mostrarBuscador={false}
                    mostrarOrdenamiento={false}
                    paginadorVisible={false}
                    renderFila={renderFila}
                    sinEstilos={true}
                  />
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
                <span className="text-sm text-slate-600">
                  {seleccionadas.length} seleccionada{seleccionadas.length === 1 ? "" : "s"}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={onCerrar}
                    className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmar}
                    disabled={seleccionadas.length === 0}
                    className={`px-4 py-1.5 rounded-lg text-white transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${theme.botonPrimario}`}
                  >
                    Seleccionar
                  </button>
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  )
} 