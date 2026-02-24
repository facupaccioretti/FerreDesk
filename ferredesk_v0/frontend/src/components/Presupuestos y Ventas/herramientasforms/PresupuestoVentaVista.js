import PlantillaFacturaA from "./plantillasComprobantes/PlantillaFacturaA";
import PlantillaFacturaB from "./plantillasComprobantes/PlantillaFacturaB";
import PlantillaFacturaC from "./plantillasComprobantes/PlantillaFacturaC";
import PlantillaPagos from "./plantillasComprobantes/PlantillaPagos";
import { mapearVentaDetalle } from "./MapeoVentaDetalle";
import { useLocalidadesAPI } from "../../../utils/useLocalidadesAPI";
import { useProvinciasAPI } from "../../../utils/useProvinciasAPI";
import { useVentaDetalleAPI } from "../../../utils/useVentaDetalleAPI";
import { useState, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useFerreDeskTheme } from "../../../hooks/useFerreDeskTheme";
import { mapearTipoComprobante } from "./plantillasComprobantes/helpers";

const MAPEO_PLANTILLAS = {
  A: PlantillaFacturaA,
  B: PlantillaFacturaB,
  C: PlantillaFacturaC,
};

const PresupuestoVentaVista = ({ data, ferreteria, ferreteriaConfig, onCerrar }) => {
  const [mostrarPagos, setMostrarPagos] = useState(false);
  const tema = useFerreDeskTheme();

  // Normalizar configuración de ferretería
  const configFerreteria = ferreteriaConfig || ferreteria;

  // Extraemos el ID de la venta/presupuesto del objeto data
  const idVenta = data?.id || data?.ven_id;

  // Usamos el hook para obtener todos los cálculos e ítems necesarios
  const { ventaCalculada, itemsCalculados, ivaDiscriminado, cargando, error } = useVentaDetalleAPI(idVenta);

  const { localidades } = useLocalidadesAPI();
  const { provincias } = useProvinciasAPI();

  // Si no hay ID o hay error/está cargando, manejamos el estado visual
  if (!idVenta) return null;

  if (cargando) {
    return (
      <Transition show={true} as={Fragment}>
        <Dialog onClose={onCerrar} className="relative z-50">
          <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-xl flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-600 font-medium font-inter">Cargando detalle del comprobante...</p>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  }

  if (error || !ventaCalculada) {
    return (
      <Transition show={true} as={Fragment}>
        <Dialog onClose={onCerrar} className="relative z-50">
          <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-xl flex flex-col items-center gap-4 max-w-sm text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">Error al cargar</h3>
              <p className="text-slate-500 text-sm">{error || "No se pudo recuperar la información de la venta."}</p>
              <button onClick={onCerrar} className="mt-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold">Cerrar</button>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  }

  // Mapeamos los datos de la venta para que las plantillas los consuman
  const datosMapeados = mapearVentaDetalle({
    ventaCalculada,
    itemsCalculados,
    ivaDiscriminado,
    localidades,
    provincias
  });

  if (!datosMapeados) return null;

  // Determinar qué plantilla usar según la letra del comprobante
  const letra = datosMapeados.comprobante?.letra || "C";
  datosMapeados.letra = letra;

  const Plantilla = MAPEO_PLANTILLAS[letra] || PlantillaFacturaC;
  const tienePagos = datosMapeados.pagos_detalle && datosMapeados.pagos_detalle.length > 0;

  return (
    <Transition show={true} as={Fragment}>
      <Dialog onClose={onCerrar} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-6xl bg-white rounded-lg shadow-lg border border-slate-200 relative overflow-hidden max-h-[95vh] flex flex-col">
              {/* Header Unificado */}
              <div className="bg-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${mostrarPagos ? 'bg-emerald-600' : 'bg-orange-600'}`}>
                    {mostrarPagos ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    ) : (
                      <span className="text-white font-bold text-lg">{letra}</span>
                    )}
                  </div>
                  <div>
                    <h3 className={`text-lg font-semibold ${tema.fuente} text-white`}>
                      {mostrarPagos ? 'Medios de Pago' : mapearTipoComprobante(datosMapeados.comprobante)} {letra}
                    </h3>
                    <div className={`text-sm text-slate-400 ${tema.fuenteSecundaria}`}>
                      {datosMapeados.numero_formateado} • {datosMapeados.fecha}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {tienePagos && (
                    <button
                      onClick={() => setMostrarPagos(!mostrarPagos)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 border ${mostrarPagos ? 'bg-slate-700 hover:bg-slate-600 text-white border-slate-600' : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'}`}
                    >
                      {mostrarPagos ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          Ver Detalle Ítems
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Medios de Pago
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={onCerrar}
                    className={`${tema.botonSecundario} text-sm font-medium`}
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              {/* Cuerpo Dinámico */}
              <div className="flex-1 overflow-auto p-6">
                {mostrarPagos ? (
                  <PlantillaPagos
                    data={datosMapeados}
                    ferreteriaConfig={configFerreteria}
                  />
                ) : (
                  <Plantilla
                    data={datosMapeados}
                    ferreteriaConfig={configFerreteria}
                  />
                )}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default PresupuestoVentaVista;