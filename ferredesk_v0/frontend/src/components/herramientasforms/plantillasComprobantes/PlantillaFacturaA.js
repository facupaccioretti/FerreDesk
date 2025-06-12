// PlantillaFacturaA.js
// Componente visual para mostrar el detalle de una Factura A
import React from 'react';
import { formatearDescuentosVisual, formatearMoneda } from './helpers';

const PlantillaFacturaA = ({ data }) => {
  // data: objeto con todos los datos mapeados de la venta/comprobante
  // Se espera: data.items, data.bonificacionGeneral, data.ven_descu1, data.ven_descu2, etc.

  return (
    <div className="plantilla-comprobante">
      {/* Encabezado principal: tres bloques */}
      <div className="encabezado-comprobante grid grid-cols-3 gap-12 mb-12">
        {/* Emisor (izquierda) */}
        <div className="emisor text-sm">
          <div className="font-bold text-base">{data.emisor_razon_social || 'Nombre de la Empresa'}</div>
          <div>{data.emisor_direccion || ''}</div>
          <div>CUIT: {data.emisor_cuit || ''}</div>
          <div>Ing. Brutos: {data.emisor_ingresos_brutos || ''}</div>
          <div>Inicio Actividad: {data.emisor_inicio_actividad || ''}</div>
          <div>Condición IVA: {data.emisor_condicion_iva || ''}</div>
        </div>
        {/* Centro: letra, código, tipo, número, fecha */}
        <div className="centro text-center flex flex-col items-center justify-center">
          <div className="letra-comprobante text-4xl font-extrabold leading-none">{data.comprobante?.letra || 'A'}</div>
          <div className="codigo-comprobante text-xs font-semibold mb-1">Cód. {data.comprobante?.codigo_afip || '01'} ORIGINAL</div>
          <div className="tipo-comprobante text-lg font-bold uppercase">{data.comprobante?.tipo || 'FACTURA'}</div>
          <div className="numero-comprobante text-lg font-bold tracking-wider">{data.numero_formateado || '0000-00000001'}</div>
          <div className="fecha-emision text-sm">Fecha de emisión: {data.fecha || ''}</div>
        </div>
        {/* Cliente (derecha) */}
        <div className="cliente text-sm text-right">
          <div className="font-bold text-base">{data.cliente || 'Cliente'}</div>
          <div>{data.domicilio || ''}</div>
          <div>{data.localidad || ''}</div>
          <div>{data.provincia || ''}</div>
          <div>CUIT/DNI: {data.cuit || ''}</div>
          <div>Condición IVA: {data.condicion_iva_cliente || ''}</div>
          <div>Teléfono: {data.telefono_cliente || ''}</div>
        </div>
      </div>
      {/* Tabla de ítems */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm mb-12">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="min-w-[120px]">Código</th>
              <th className="min-w-[220px]">Descripción</th>
              <th className="min-w-[100px]">Cantidad</th>
              <th className="min-w-[140px]">Precio Unitario</th>
              <th className="min-w-[100px]">Desc. %</th>
              <th className="min-w-[180px]">Precio Unit. Bonificado</th>
              <th className="min-w-[100px]">Alicuota</th>
              <th className="min-w-[100px]">IVA</th>
              <th className="min-w-[140px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items?.map((item, idx) => (
              <tr key={idx}>
                <td>{item.codigo ?? '-'}</td>
                <td>{item.vdi_detalle1 ?? '-'}</td>
                <td>{item.vdi_cantidad ?? 0}</td>
                <td>{formatearMoneda(item.vdi_importe)}</td>
                <td>{formatearDescuentosVisual(item.vdi_bonifica, data.ven_descu1, data.ven_descu2)}</td>
                <td>{formatearMoneda(item.precio_unitario_bonificado)}</td>
                <td>{item.ali_porce ? item.ali_porce + '%' : '-'}</td>
                <td>{formatearMoneda(item.iva)}</td>
                <td>{formatearMoneda(item.vdi_importe_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Bloque de totales y desglose */}
      <div className="w-full mt-12 mb-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 w-full">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <span className="block text-sm text-gray-500 mb-1">Importe Neto Gravado</span>
            <span className="block text-lg font-bold text-gray-900">${formatearMoneda(data.ven_impneto)}</span>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <span className="block text-sm text-gray-500 mb-1">Bonif. Gral.</span>
            <span className="block text-lg font-bold text-gray-900">{data.bonificacionGeneral || 0}%</span>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <span className="block text-sm text-gray-500 mb-1">Descuento 1</span>
            <span className="block text-lg font-bold text-gray-900">{data.ven_descu1 || 0}%</span>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <span className="block text-sm text-gray-500 mb-1">Descuento 2</span>
            <span className="block text-lg font-bold text-gray-900">{data.ven_descu2 || 0}%</span>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm md:col-span-1 col-span-2">
            <span className="block text-sm text-gray-500 mb-1">Importe Total</span>
            <span className="block text-2xl font-bold text-emerald-600">
              ${formatearMoneda(data.ven_total) || formatearMoneda(data.total)}
            </span>
          </div>
        </div>
      </div>
      {/* Desglose de IVA */}
      {data.iva_desglose && Object.keys(data.iva_desglose).length > 0 && (
        <div className="mt-12 mb-12 bg-gray-50 p-8 rounded-xl border border-gray-100">
          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th>Alícuota</th>
                  <th>Neto gravado</th>
                  <th>IVA</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.iva_desglose).map(([ali, val], idx) => (
                  <tr key={ali} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td>{ali === '0' ? 'Exento' : ali + '%'}</td>
                    <td>${formatearMoneda(val.neto)}</td>
                    <td>${formatearMoneda(val.iva)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Pie de comprobante */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-12 w-full">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div><b>CAE:</b> {data.cae || ''}</div>
          <div><b>Vencimiento CAE:</b> {data.cae_vencimiento || ''}</div>
          <div><b>QR:</b> {/* Aquí podría ir un componente QR o imagen si hay dato */}</div>
        </div>
      </div>
    </div>
  );
};

export default PlantillaFacturaA;
export { PlantillaFacturaA }; 