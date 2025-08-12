"use client"
import React from 'react';
import { useVentaDetalleAPI } from '../../../utils/useVentaDetalleAPI';
import { useFerreteriaAPI } from '../../../utils/useFerreteriaAPI';
import { mapearVentaDetalle } from './MapeoVentaDetalle';
import { PlantillaFacturaA } from './plantillasComprobantes/PlantillaFacturaA';
import { PlantillaFacturaB } from './plantillasComprobantes/PlantillaFacturaB';
import { PlantillaFacturaC } from './plantillasComprobantes/PlantillaFacturaC';

const MAPEO_PLANTILLAS = {
  'A': PlantillaFacturaA,
  'M': PlantillaFacturaA,
  'B': PlantillaFacturaB,
  'C': PlantillaFacturaC,
  'P': PlantillaFacturaC,
  'V': PlantillaFacturaC,
};

function obtenerLetraComprobante(comprobante) {
  if (!comprobante) return 'C';
  if (comprobante.letra) return comprobante.letra.toUpperCase();
  if (comprobante.tipo) {
    const tipo = comprobante.tipo.toUpperCase();
    if (tipo.includes('PRESUPUESTO')) return 'P';
    if (tipo.includes('VENTA')) return 'V';
  }
  if (comprobante.nombre) {
    const nombre = comprobante.nombre.toUpperCase();
    if (nombre.includes('PRESUPUESTO')) return 'P';
    if (nombre.includes('FACTURA VENTA')) return 'V';
    if (nombre.includes('FACTURA A')) return 'A';
    if (nombre.includes('FACTURA B')) return 'B';
    if (nombre.includes('FACTURA C')) return 'C';
    if (nombre.includes('FACTURA M')) return 'M';
  }
  return 'C';
}

const PresupuestoVentaVista = (props) => {
  const { data, clientes = [], vendedores = [], plazos = [], sucursales = [], puntosVenta = [], onCerrar } = props;
  const idVenta = data?.ven_id || data?.id;
  const { ventaCalculada, itemsCalculados, ivaDiscriminado, cargando, error } = useVentaDetalleAPI(idVenta);
  const { ferreteria: ferreteriaConfig, loading: configLoading, error: configError } = useFerreteriaAPI();

  if (cargando || configLoading) return <div className="p-8 text-gray-500 bg-white rounded-xl shadow-lg flex items-center justify-center min-h-[200px] border border-gray-100">Cargando datos...</div>;
  if (error) return <div className="p-8 text-red-600 bg-white rounded-xl shadow-lg flex items-center justify-center min-h-[200px] border border-gray-100">Error: {error}</div>;
  if (configError) return <div className="p-8 text-red-600 bg-white rounded-xl shadow-lg flex items-center justify-center min-h-[200px] border border-gray-100">Error de configuración: {configError}</div>;

  const datos = ventaCalculada
    ? mapearVentaDetalle({
        ventaCalculada,
        itemsCalculados,
        ivaDiscriminado,
        clientes,
        vendedores,
        plazos,
        sucursales,
        puntosVenta
      })
    : null;

  if (!datos) return <div className="p-8 text-gray-500 bg-white rounded-xl shadow-lg flex items-center justify-center min-h-[200px] border border-gray-100">
    <p className="text-center text-lg">No hay datos para mostrar.</p>
  </div>;

  const letra = obtenerLetraComprobante(datos.comprobante);
  datos.letra = letra;

  const Plantilla = MAPEO_PLANTILLAS[letra] || PlantillaFacturaC;

  return (
    <div className="w-full h-full py-8 bg-white rounded-xl shadow-lg relative border border-gray-100">
      <Plantilla data={datos} ferreteriaConfig={ferreteriaConfig} onClose={onCerrar} />
    </div>
  );
};

export default PresupuestoVentaVista; 