/**
 * Modal para imprimir etiquetas de códigos de barras
 */
import React, { useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useImpresionEtiquetas } from '../hooks/useImpresionEtiquetas';
import { FORMATOS_ETIQUETAS, LISTAS_PRECIO } from '../constants';

function ImprimirEtiquetasModal({ open, onClose, productos = [] }) {
  const {
    opciones,
    imprimiendo,
    error,
    tieneProductos,
    cantidadProductos,
    establecerProductos,
    actualizarOpcion,
    resetearOpciones,
    imprimir,
  } = useImpresionEtiquetas();

  // Establecer productos al abrir el modal
  useEffect(() => {
    if (open && productos.length > 0) {
      // Filtrar solo productos con código de barras
      const productosConCodigo = productos
        .filter((p) => p.codigo_barras)
        .map((p) => p.id);
      establecerProductos(productosConCodigo);
    }
  }, [open, productos, establecerProductos]);

  // Resetear al cerrar
  useEffect(() => {
    if (!open) {
      resetearOpciones();
    }
  }, [open, resetearOpciones]);

  // Calcular total de etiquetas
  const totalEtiquetas = cantidadProductos * opciones.cantidadPorProducto;

  // Obtener productos sin código de barras
  const productosSinCodigo = productos.filter((p) => !p.codigo_barras);

  // Manejar impresión
  const handleImprimir = async () => {
    const resultado = await imprimir();
    if (resultado.exito) {
      onClose();
    }
  };

  return (
    <Transition show={open} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden">
                {/* Encabezado */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-4 relative">
                  <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-2xl text-slate-300 hover:text-white transition-colors"
                  >
                    ×
                  </button>
                  <Dialog.Title className="text-lg font-bold text-white">
                    Imprimir Etiquetas
                  </Dialog.Title>
                  <p className="text-slate-300 text-sm mt-1">
                    Configure las opciones de impresión
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">
                    {error}
                  </div>
                )}

                {/* Advertencia productos sin código */}
                {productosSinCodigo.length > 0 && (
                  <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-700 text-sm">
                    ⚠️ {productosSinCodigo.length} producto(s) no tienen código de barras y no se
                    incluirán en la impresión.
                  </div>
                )}

                {/* Contenido */}
                <div className="p-4 space-y-4">
                  {/* Resumen de productos */}
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Productos seleccionados:</span>
                      <span className="font-medium text-slate-800">{cantidadProductos}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm text-slate-600">Total de etiquetas:</span>
                      <span className="font-medium text-slate-800">{totalEtiquetas}</span>
                    </div>
                  </div>

                  {/* Formato de etiquetas */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Formato de etiquetas
                    </label>
                    <select
                      value={opciones.formatoEtiqueta}
                      onChange={(e) => actualizarOpcion('formatoEtiqueta', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {FORMATOS_ETIQUETAS.map((formato) => (
                        <option key={formato.value} value={formato.value}>
                          {formato.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Cantidad por producto */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Cantidad por producto
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={opciones.cantidadPorProducto}
                      onChange={(e) =>
                        actualizarOpcion('cantidadPorProducto', parseInt(e.target.value) || 1)
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>

                  {/* Opciones de contenido */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Contenido de la etiqueta
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={opciones.incluirNombre}
                        onChange={(e) => actualizarOpcion('incluirNombre', e.target.checked)}
                        className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm text-slate-700">Incluir nombre del producto</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={opciones.incluirPrecio}
                        onChange={(e) => actualizarOpcion('incluirPrecio', e.target.checked)}
                        className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm text-slate-700">Incluir precio</span>
                    </label>
                  </div>

                  {/* Selector de lista de precios (si incluye precio) */}
                  {opciones.incluirPrecio && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Lista de precios
                      </label>
                      <select
                        value={opciones.listaPrecio}
                        onChange={(e) =>
                          actualizarOpcion('listaPrecio', parseInt(e.target.value))
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        {LISTAS_PRECIO.map((lista) => (
                          <option key={lista.value} value={lista.value}>
                            {lista.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Botones */}
                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleImprimir}
                      disabled={imprimiendo || !tieneProductos}
                      className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                        imprimiendo || !tieneProductos
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-orange-600 text-white hover:bg-orange-700'
                      }`}
                    >
                      {imprimiendo ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Generando PDF...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                            />
                          </svg>
                          Imprimir PDF
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default ImprimirEtiquetasModal;
