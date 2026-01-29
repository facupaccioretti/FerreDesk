/**
 * Modal para gestionar código de barras de un producto
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useCodigoBarras } from '../hooks/useCodigoBarras';
import { validarCodigoBarras } from '../services/codigoBarrasApi';
import { FORMATOS_GENERACION, TIPO_EAN13, TIPO_EXTERNO } from '../constants';

// Pestañas disponibles
const PESTANA_ASOCIAR = 'asociar';
const PESTANA_GENERAR = 'generar';

function CodigoBarrasModal({ 
  open, 
  onClose, 
  producto, 
  onActualizado,
  // Props para modo local (producto nuevo)
  codigoBarrasInicial = null,
  tipoCodigoBarrasInicial = null,
  onCodigoChange = null, // Callback: (codigo, tipo) => void
}) {
  const productoId = producto?.id;
  // Determinar si el producto existe en BD (tiene ID numérico real)
  const esProductoExistente = productoId && typeof productoId === 'number' && productoId > 0;
  
  // Hook para modo persistido (solo si producto existe)
  const {
    codigoBarras: codigoBarrasBD,
    tipoCodigoBarras: tipoCodigoBarrasBD,
    cargando: cargandoBD,
    validacion,
    tieneCodigoBarras: tieneCodigoBarrasBD,
    cargar,
    asociar,
    generar,
    eliminar,
    validar,
    limpiarValidacion,
  } = useCodigoBarras(esProductoExistente ? productoId : null);

  // Estado local para modo no persistido
  const [codigoLocal, setCodigoLocal] = useState(codigoBarrasInicial);
  const [tipoLocal, setTipoLocal] = useState(tipoCodigoBarrasInicial);
  const [cargandoLocal, setCargandoLocal] = useState(false);
  const [validacionLocal, setValidacionLocal] = useState(null);

  const [pestanaActiva, setPestanaActiva] = useState(PESTANA_ASOCIAR);
  const [codigoInput, setCodigoInput] = useState('');
  const [formatoSeleccionado, setFormatoSeleccionado] = useState(TIPO_EAN13);
  const [mensaje, setMensaje] = useState(null);
  const [tipoMensaje, setTipoMensaje] = useState('exito');

  // Valores efectivos según el modo
  const codigoBarras = esProductoExistente ? codigoBarrasBD : codigoLocal;
  const tipoCodigoBarras = esProductoExistente ? tipoCodigoBarrasBD : tipoLocal;
  const cargando = esProductoExistente ? cargandoBD : cargandoLocal;
  const tieneCodigoBarras = esProductoExistente ? tieneCodigoBarrasBD : !!codigoLocal;
  const validacionActual = esProductoExistente ? validacion : validacionLocal;

  // Sincronizar código local con props cuando cambian
  useEffect(() => {
    if (!esProductoExistente) {
      setCodigoLocal(codigoBarrasInicial);
      setTipoLocal(tipoCodigoBarrasInicial);
    }
  }, [codigoBarrasInicial, tipoCodigoBarrasInicial, esProductoExistente]);

  // Cargar datos al abrir (solo si producto existe en BD)
  useEffect(() => {
    if (open && esProductoExistente) {
      cargar();
    }
    if (open) {
      setCodigoInput('');
      setMensaje(null);
      if (esProductoExistente) {
        limpiarValidacion();
      } else {
        setValidacionLocal(null);
      }
    }
  }, [open, esProductoExistente, cargar, limpiarValidacion]);

  // Validar código mientras se escribe (debounce)
  useEffect(() => {
    if (!codigoInput || codigoInput.length < 3) {
      if (esProductoExistente) {
        limpiarValidacion();
      } else {
        setValidacionLocal(null);
      }
      return;
    }

    const timeout = setTimeout(async () => {
      if (esProductoExistente) {
        validar(codigoInput);
      } else {
        // Modo local: validar directamente
        setCargandoLocal(true);
        try {
          const resultado = await validarCodigoBarras(codigoInput);
          setValidacionLocal(resultado);
        } catch (err) {
          setValidacionLocal({ valido: false, error: err.message });
        } finally {
          setCargandoLocal(false);
        }
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [codigoInput, esProductoExistente, validar, limpiarValidacion]);

  // Mostrar mensaje temporal
  const mostrarMensaje = useCallback((texto, tipo = 'exito') => {
    setMensaje(texto);
    setTipoMensaje(tipo);
    setTimeout(() => setMensaje(null), 4000);
  }, []);

  // Asociar código existente
  const handleAsociar = async () => {
    if (!codigoInput.trim()) return;

    if (esProductoExistente) {
      // Modo persistido: guardar en BD
      const resultado = await asociar(codigoInput.trim());
      if (resultado.exito) {
        mostrarMensaje(resultado.mensaje, 'exito');
        setCodigoInput('');
        // Notificar al padre para actualizar la vista en tiempo real
        onCodigoChange?.(resultado.codigo, resultado.tipo || TIPO_EXTERNO);
        onActualizado?.();
      } else {
        mostrarMensaje(resultado.error, 'error');
      }
    } else {
      // Modo local: notificar al padre
      const codigo = codigoInput.trim();
      setCodigoLocal(codigo);
      setTipoLocal(TIPO_EXTERNO);
      onCodigoChange?.(codigo, TIPO_EXTERNO);
      mostrarMensaje('Código de barras asociado (se guardará con el producto)', 'exito');
      setTimeout(() => onClose(), 1500);
    }
  };

  // Generar código interno (solo disponible para productos existentes)
  const handleGenerar = async () => {
    if (!esProductoExistente) {
      mostrarMensaje('Debe guardar el producto primero para generar un código automático', 'error');
      return;
    }
    
    const resultado = await generar(formatoSeleccionado);
    if (resultado.exito) {
      mostrarMensaje(`${resultado.mensaje}: ${resultado.codigo}`, 'exito');
      // Notificar al padre para actualizar la vista en tiempo real
      onCodigoChange?.(resultado.codigo, formatoSeleccionado);
      onActualizado?.();
    } else {
      mostrarMensaje(resultado.error, 'error');
    }
  };

  // Eliminar código
  const handleEliminar = async () => {
    if (!window.confirm('¿Está seguro de eliminar el código de barras?')) return;

    if (esProductoExistente) {
      const resultado = await eliminar();
      if (resultado.exito) {
        mostrarMensaje(resultado.mensaje, 'exito');
        // Notificar al padre para actualizar la vista en tiempo real
        onCodigoChange?.(null, null);
        onActualizado?.();
      } else {
        mostrarMensaje(resultado.error, 'error');
      }
    } else {
      // Modo local
      setCodigoLocal(null);
      setTipoLocal(null);
      onCodigoChange?.(null, null);
      mostrarMensaje('Código de barras eliminado', 'exito');
    }
  };

  // Obtener label del tipo de código
  const obtenerLabelTipo = (tipo) => {
    const formato = FORMATOS_GENERACION.find((f) => f.value === tipo);
    if (formato) return formato.label;
    if (tipo === TIPO_EXTERNO) return 'Código externo/escaneado';
    return tipo || 'Desconocido';
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
                    Código de Barras
                  </Dialog.Title>
                  <p className="text-slate-300 text-sm mt-1">
                    {producto?.codvta || 'Nuevo producto'} - {producto?.deno || 'Sin denominación'}
                  </p>
                  {!esProductoExistente && (
                    <p className="text-amber-300 text-xs mt-1">
                      ⚠️ Producto nuevo - el código se guardará junto con el producto
                    </p>
                  )}
                </div>

                {/* Código actual si existe */}
                {tieneCodigoBarras && (
                  <div className="p-4 bg-green-50 border-b border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-green-600 font-medium">Código actual</p>
                        <p className="text-lg font-mono font-bold text-green-800">{codigoBarras}</p>
                        <p className="text-xs text-green-600">{obtenerLabelTipo(tipoCodigoBarras)}</p>
                      </div>
                      <button
                        onClick={handleEliminar}
                        disabled={cargando}
                        className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}

                {/* Mensaje */}
                {mensaje && (
                  <div
                    className={`p-3 text-sm ${
                      tipoMensaje === 'exito'
                        ? 'bg-green-50 border-b border-green-200 text-green-700'
                        : 'bg-red-50 border-b border-red-200 text-red-700'
                    }`}
                  >
                    {mensaje}
                  </div>
                )}

                {/* Pestañas */}
                {!tieneCodigoBarras && (
                  <div className="flex border-b border-slate-200 bg-slate-50">
                    <button
                      onClick={() => setPestanaActiva(PESTANA_ASOCIAR)}
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                        pestanaActiva === PESTANA_ASOCIAR
                          ? 'text-orange-600 border-b-2 border-orange-600 bg-white'
                          : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      Tengo un código
                    </button>
                    <button
                      onClick={() => setPestanaActiva(PESTANA_GENERAR)}
                      disabled={!esProductoExistente}
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                        pestanaActiva === PESTANA_GENERAR
                          ? 'text-orange-600 border-b-2 border-orange-600 bg-white'
                          : !esProductoExistente
                            ? 'text-slate-400 cursor-not-allowed'
                            : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                      }`}
                      title={!esProductoExistente ? 'Guarde el producto primero para generar códigos automáticos' : ''}
                    >
                      Generar automático
                      {!esProductoExistente && <span className="ml-1 text-xs">(guardar primero)</span>}
                    </button>
                  </div>
                )}

                {/* Contenido */}
                <div className="p-4">
                  {/* Pestaña Asociar */}
                  {!tieneCodigoBarras && pestanaActiva === PESTANA_ASOCIAR && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600">
                        Escanee o ingrese el código de barras existente del producto.
                      </p>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Código de barras
                        </label>
                        <input
                          type="text"
                          value={codigoInput}
                          onChange={(e) => setCodigoInput(e.target.value)}
                          placeholder="Escanee o escriba el código"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          autoFocus
                        />
                      </div>

                      {/* Validación en tiempo real */}
                      {validacionActual && (
                        <div
                          className={`p-3 rounded-lg text-sm ${
                            validacionActual.valido
                              ? validacionActual.ya_asignado
                                ? 'bg-amber-50 border border-amber-200 text-amber-700'
                                : 'bg-green-50 border border-green-200 text-green-700'
                              : 'bg-red-50 border border-red-200 text-red-700'
                          }`}
                        >
                          {validacionActual.valido ? (
                            validacionActual.ya_asignado ? (
                              <>
                                 Este código ya está asignado a:{' '}
                                <strong>
                                  {validacionActual.producto_asignado?.codvta} -{' '}
                                  {validacionActual.producto_asignado?.deno}
                                </strong>
                              </>
                            ) : (
                              <>✓ Código válido ({validacionActual.tipo_detectado})</>
                            )
                          ) : (
                            <>✗ {validacionActual.error}</>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={onClose}
                          className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleAsociar}
                          disabled={
                            cargando ||
                            !codigoInput.trim() ||
                            (validacionActual && (!validacionActual.valido || validacionActual.ya_asignado))
                          }
                          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                            cargando ||
                            !codigoInput.trim() ||
                            (validacionActual && (!validacionActual.valido || validacionActual.ya_asignado))
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              : 'bg-orange-600 text-white hover:bg-orange-700'
                          }`}
                        >
                          {cargando ? 'Guardando...' : 'Asociar código'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Pestaña Generar */}
                  {!tieneCodigoBarras && pestanaActiva === PESTANA_GENERAR && (
                    <div className="space-y-4">
                      {!esProductoExistente ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                          <p className="font-medium">⚠️ Producto no guardado</p>
                          <p className="mt-1">
                            Para generar un código de barras automático, primero debe guardar el producto.
                            Use la pestaña "Tengo un código" para escanear un código existente.
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-slate-600">
                            Genere un código de barras interno para este producto.
                          </p>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Formato
                            </label>
                            <select
                              value={formatoSeleccionado}
                              onChange={(e) => setFormatoSeleccionado(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            >
                              {FORMATOS_GENERACION.map((formato) => (
                                <option key={formato.value} value={formato.value}>
                                  {formato.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                            {formatoSeleccionado === TIPO_EAN13 ? (
                              <>
                                <strong>EAN-13:</strong> Código estándar de 13 dígitos compatible con
                                cualquier lector de códigos de barras. Ideal para productos de venta al
                                público.
                              </>
                            ) : (
                              <>
                                <strong>Code 128:</strong> Código alfanumérico con las siglas configuradas
                                en la empresa. Ideal para productos internos, producción propia o
                                identificación interna.
                              </>
                            )}
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              onClick={onClose}
                              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleGenerar}
                              disabled={cargando}
                              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                                cargando
                                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                  : 'bg-orange-600 text-white hover:bg-orange-700'
                              }`}
                            >
                              {cargando ? 'Generando...' : 'Generar código'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Si ya tiene código */}
                  {tieneCodigoBarras && (
                    <div className="text-center py-4 text-slate-600">
                      <p>Este producto ya tiene un código de barras asignado.</p>
                      <p className="text-sm mt-2">
                        Puede eliminarlo para asignar uno nuevo.
                      </p>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default CodigoBarrasModal;
