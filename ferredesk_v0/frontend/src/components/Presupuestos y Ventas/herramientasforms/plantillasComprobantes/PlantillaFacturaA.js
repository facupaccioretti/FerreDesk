// PlantillaFacturaA.js
// Componente visual para mostrar el detalle de una Factura A
import React from 'react';
import { formatearDescuentosVisual, formatearMoneda } from './helpers';

const PlantillaFacturaA = ({ data }) => {
  // data: objeto con todos los datos mapeados de la venta/comprobante
  // Se espera: data.items, data.bonificacionGeneral, data.ven_descu1, data.ven_descu2, etc.

  return (
    <div className="plantilla-comprobante bg-white p-8 max-w-7xl mx-auto">
      {/* Encabezado principal: tres bloques */}
      <div className="encabezado-comprobante grid grid-cols-3 gap-8 mb-8 p-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border">
        {/* Cliente (izquierda) */}
        <div className="cliente text-sm space-y-1">
          <div className="font-bold text-lg text-gray-800 mb-2">{data.cliente || "Cliente"}</div>
          <div className="text-gray-600">{data.domicilio || ""}</div>
          <div className="text-gray-600">{data.localidad || ""}</div>
          <div className="text-gray-600">{data.provincia || ""}</div>
          <div className="text-gray-700">
            <span className="font-medium">CUIT/DNI:</span> {data.cuit || ""}
          </div>
          <div className="text-gray-700">
            <span className="font-medium">Condición IVA:</span> {data.condicion_iva_cliente || ""}
          </div>
          <div className="text-gray-700">
            <span className="font-medium">Teléfono:</span> {data.telefono_cliente || ""}
          </div>
        </div>
        {/* Centro: letra, código, tipo, número, fecha */}
        <div className="centro text-center flex flex-col items-center justify-center bg-white rounded-lg p-4 shadow-sm border-2 border-blue-200">
          <div className="letra-comprobante text-5xl font-black text-blue-600 leading-none mb-1">
            {data.comprobante?.letra || "A"}
          </div>
          <div className="codigo-comprobante text-xs font-semibold text-gray-500 mb-2">
            Cód. {data.comprobante?.codigo_afip || "01"}
          </div>
          <div className="tipo-comprobante text-xl font-bold uppercase text-gray-800 mb-1">
            {data.comprobante?.tipo || "FACTURA"}
          </div>
          <div className="numero-comprobante text-lg font-bold tracking-wider text-blue-700 mb-2">
            {data.numero_formateado || "0000-00000001"}
          </div>
          <div className="fecha-emision text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded">
            Fecha de emisión: {data.fecha || ""}
          </div>
        </div>
        {/* Emisor (derecha) */}
        <div className="emisor text-sm text-right space-y-1">
          <div className="font-bold text-lg text-gray-800 mb-2">
            {data.emisor_razon_social || "Nombre de la Empresa"}
          </div>
          <div className="text-gray-600">{data.emisor_direccion || ""}</div>
          <div className="text-gray-700">
            <span className="font-medium">CUIT:</span> {data.emisor_cuit || ""}
          </div>
          <div className="text-gray-700">
            <span className="font-medium">Ing. Brutos:</span> {data.emisor_ingresos_brutos || ""}
          </div>
          <div className="text-gray-700">
            <span className="font-medium">Inicio Actividad:</span> {data.emisor_inicio_actividad || ""}
          </div>
          <div className="text-gray-700">
            <span className="font-medium">Condición IVA:</span> {data.emisor_condicion_iva || ""}
          </div>
        </div>
      </div>

      {/* Tabla de ítems */}
      <div className="overflow-x-auto rounded-xl border border-gray-300 shadow-lg mb-8">
        <table className="min-w-full divide-y divide-gray-300 bg-white">
          <thead className="bg-gradient-to-r from-blue-600 to-blue-700">
            <tr>
              <th className="px-4 py-4 text-center text-sm font-bold text-white uppercase tracking-wider min-w-[120px]">
                Código
              </th>
              <th className="px-4 py-4 text-center text-sm font-bold text-white uppercase tracking-wider min-w-[220px]">
                Descripción
              </th>
              <th className="px-4 py-4 text-center text-sm font-bold text-white uppercase tracking-wider min-w-[100px]">
                Cantidad
              </th>
              <th className="px-4 py-4 text-center text-sm font-bold text-white uppercase tracking-wider min-w-[140px]">
                Precio Unitario
              </th>
              <th className="px-4 py-4 text-center text-sm font-bold text-white uppercase tracking-wider min-w-[100px]">
                Desc. %
              </th>
              <th className="px-4 py-4 text-center text-sm font-bold text-white uppercase tracking-wider min-w-[180px]">
                Precio Unit. Bonificado
              </th>
              <th className="px-4 py-4 text-center text-sm font-bold text-white uppercase tracking-wider min-w-[100px]">
                Alicuota
              </th>
              <th className="px-4 py-4 text-center text-sm font-bold text-white uppercase tracking-wider min-w-[100px]">
                IVA
              </th>
              <th className="px-4 py-4 text-center text-sm font-bold text-white uppercase tracking-wider min-w-[140px]">
                Importe
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.items?.map((item, idx) => (
              <tr
                key={idx}
                className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors duration-150`}
              >
                <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">{item.codigo ?? "-"}</td>
                <td className="px-4 py-3 text-left text-sm text-gray-900">{item.vdi_detalle1 ?? "-"}</td>
                <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">{item.vdi_cantidad ?? 0}</td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  ${formatearMoneda(item.precio_unitario_sin_iva || 0)}
                </td>
                <td className="px-4 py-3 text-center text-sm font-medium text-orange-600">
                  {formatearDescuentosVisual(item.vdi_bonifica, data.ven_descu1, data.ven_descu2, data.ven_descu3)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600">
                  ${formatearMoneda(item.precio_unitario_bonificado || 0)}
                </td>
                <td className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                  {item.ali_porce ? `${item.ali_porce}%` : "-"}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600">
                  ${formatearMoneda(item.iva_monto || 0)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                  ${formatearMoneda(item.subtotal_neto || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bloque de totales y desglose */}
      <div className="w-full mt-8 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 w-full">
          <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Importe Neto Gravado
            </span>
            <span className="block text-xl font-bold text-gray-900">${formatearMoneda(data.ven_impneto)}</span>
          </div>
          <div className="bg-gradient-to-br from-white to-orange-50 p-6 rounded-xl shadow-md border border-orange-200 hover:shadow-lg transition-shadow">
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bonif. Gral.</span>
            <span className="block text-xl font-bold text-orange-600">{data.bonificacionGeneral || 0}%</span>
          </div>
          <div className="bg-gradient-to-br from-white to-red-50 p-6 rounded-xl shadow-md border border-red-200 hover:shadow-lg transition-shadow">
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Descuento 1</span>
            <span className="block text-xl font-bold text-red-600">{data.ven_descu1 || 0}%</span>
          </div>
          <div className="bg-gradient-to-br from-white to-red-50 p-6 rounded-xl shadow-md border border-red-200 hover:shadow-lg transition-shadow">
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Descuento 2</span>
            <span className="block text-xl font-bold text-red-600">{data.ven_descu2 || 0}%</span>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-xl shadow-lg border-2 border-emerald-300 md:col-span-1 col-span-2">
            <span className="block text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">
              Importe Total
            </span>
            <span className="block text-2xl font-black text-emerald-700">
              ${formatearMoneda(data.ven_total) || formatearMoneda(data.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Desglose de IVA */}
      {data.iva_desglose && Object.keys(data.iva_desglose).length > 0 && (
        <div className="mt-8 mb-8 bg-gradient-to-r from-gray-50 to-blue-50 p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Desglose de IVA</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-300 shadow-md">
            <table className="min-w-full divide-y divide-gray-300 bg-white">
              <thead className="bg-gradient-to-r from-gray-600 to-gray-700">
                <tr>
                  <th className="px-6 py-4 text-center text-sm font-bold text-white uppercase tracking-wider">
                    Alícuota
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-white uppercase tracking-wider">
                    Neto gravado
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-white uppercase tracking-wider">IVA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {Object.entries(data.iva_desglose).map(([ali, val], idx) => (
                  <tr
                    key={ali}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors duration-150`}
                  >
                    <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900">{ali}%</td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                      ${formatearMoneda(val.neto)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-blue-600">
                      ${formatearMoneda(val.iva)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pie de comprobante */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-xl shadow-md border border-gray-200">
          <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Información AFIP</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">CAE:</span>{" "}
              <span className="font-mono text-gray-900">{data.cae || ""}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">Vencimiento CAE:</span>{" "}
              <span className="font-mono text-gray-900">{data.cae_vencimiento || ""}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">QR:</span>{" "}
              <span className="text-gray-500">{/* Aquí podría ir un componente QR o imagen si hay dato */}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlantillaFacturaA;
export { PlantillaFacturaA }; 