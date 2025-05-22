"use client"
import React from 'react';
import { BotonImprimir, BotonEliminar } from './Botones';

const PresupuestoVista = ({
  data,
  onImprimir,
  onEliminar,
  onCerrar,
  clientes,
  vendedores,
  plazos,
  sucursales,
  puntosVenta,
}) => (
  <div className="max-w-4xl w-full mx-auto py-8 px-8 bg-white rounded-xl shadow-lg relative border border-gray-100">
    <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
      <h3 className="text-2xl font-bold text-gray-800 flex items-center">
        Presupuesto N° <span className="ml-2 text-emerald-600">{(data.letra ? data.letra + ' ' : '') + (data.numero_formateado || data.numero)}</span>
        <span className="ml-3 text-sm font-medium px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
          {data.estado}
        </span>
      </h3>
      <div className="flex gap-3">
        <BotonImprimir onClick={() => onImprimir(data)} />
        <BotonEliminar onClick={() => onEliminar(data.id)} />
        <button
          onClick={onCerrar}
          className="px-3 py-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors duration-200"
        >
          Cerrar
        </button>
      </div>
    </div>
    <DatosGenerales
      data={data}
      clientes={clientes}
      vendedores={vendedores}
      plazos={plazos}
      sucursales={sucursales}
      puntosVenta={puntosVenta}
    />
    <TablaItems data={data} />
    <Totales data={data} />
  </div>
);

const VentaVista = ({
  data,
  onImprimir,
  onEliminar,
  onCerrar,
  clientes,
  vendedores,
  plazos,
  sucursales,
  puntosVenta,
}) => (
  <div className="max-w-4xl w-full mx-auto py-8 px-8 bg-white rounded-xl shadow-lg relative border border-gray-100">
    <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
      <h3 className="text-2xl font-bold text-gray-800 flex items-center">
        Venta N° <span className="ml-2 text-purple-600">{(data.letra ? data.letra + ' ' : '') + (data.numero_formateado || data.numero)}</span>
        <span className="ml-3 text-sm font-medium px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
          {data.estado}
        </span>
      </h3>
      <div className="flex gap-3">
        <BotonImprimir onClick={() => onImprimir(data)} />
        <BotonEliminar onClick={() => onEliminar(data.id)} />
        <button
          onClick={onCerrar}
          className="px-3 py-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors duration-200"
        >
          Cerrar
        </button>
      </div>
    </div>
    <DatosGenerales
      data={data}
      clientes={clientes}
      vendedores={vendedores}
      plazos={plazos}
      sucursales={sucursales}
      puntosVenta={puntosVenta}
    />
    <TablaItems data={data} />
    <Totales data={data} />
    {data.iva_desglose && Object.keys(data.iva_desglose).length > 0 && <DesgloseIVA ivaDesglose={data.iva_desglose} />}
  </div>
);

const ALICUOTAS = {
  1: 0, // NO GRAVADO
  2: 0, // EXENTO
  3: 0, // 0%
  4: 10.5,
  5: 21,
  6: 27
};

const DatosGenerales = ({ data, clientes = [], vendedores = [], plazos = [], sucursales = [], puntosVenta = [] }) => {
  const cliente = clientes.find(c => c.id === (data.clienteId || data.ven_idcli))?.razon || data.cliente || data.clienteId || '-';
  const vendedor = vendedores.find(v => v.id === (data.vendedorId || data.ven_idvdo))?.nombre || data.vendedorId || '-';
  const sucursal = sucursales.find(s => s.id === (data.sucursalId || data.ven_sucursal))?.nombre || data.sucursalId || '-';
  const puntoVenta = puntosVenta.find(pv => pv.id === (data.puntoVentaId || data.ven_punto))?.nombre || data.puntoVentaId || '-';
  const plazo = plazos.find(p => p.id === (data.plazoId || data.ven_idpla))?.nombre || data.plazoId || '-';
  return (
    <div className="bg-gray-50 rounded-xl p-6 mb-8 border border-gray-100">
      <h4 className="text-lg font-semibold text-gray-700 mb-4 border-b border-gray-200 pb-2">Información General</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <span className="block text-sm font-medium text-gray-500 mb-1">Cliente</span>
          <span className="block text-lg font-semibold text-gray-800">{cliente}</span>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <span className="block text-sm font-medium text-gray-500 mb-1">Fecha</span>
          <span className="block text-lg font-semibold text-gray-800">{data.fecha}</span>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <span className="block text-sm font-medium text-gray-500 mb-1">Vendedor</span>
          <span className="block text-lg font-semibold text-gray-800">{vendedor}</span>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <span className="block text-sm font-medium text-gray-500 mb-1">Sucursal</span>
          <span className="block text-lg font-semibold text-gray-800">{sucursal}</span>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <span className="block text-sm font-medium text-gray-500 mb-1">Punto de Venta</span>
          <span className="block text-lg font-semibold text-gray-800">{puntoVenta}</span>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <span className="block text-sm font-medium text-gray-500 mb-1">Plazo</span>
          <span className="block text-lg font-semibold text-gray-800">{plazo}</span>
        </div>
      </div>
    </div>
  );
};

const TablaItems = ({ data, proveedores = [] }) => {
  const items = data.items || [];
  // Helper para mapear ID a nombre si es necesario
  const getProveedorNombre = (item) => {
    if (item.proveedor_usado) return item.proveedor_usado;
    if (item.proveedor_nombre) return item.proveedor_nombre;
    if (item.proveedor) return item.proveedor;
    if (item.proveedorId && Array.isArray(proveedores)) {
      const prov = proveedores.find(p => p.id === item.proveedorId);
      return prov ? prov.nombre : item.proveedorId;
    }
    return "-";
  };
  // Helper para mostrar alícuota
  const getAlicuota = (item) => {
    if (item.alicuota) return item.alicuota + '%';
    if (item.iva) return item.iva + '%';
    if (item.iva_porcentaje) return item.iva_porcentaje + '%';
    if (item.vdi_idaliiva && ALICUOTAS[item.vdi_idaliiva] !== undefined) return ALICUOTAS[item.vdi_idaliiva] + '%';
    return '-';
  };
  return (
    <div className="mb-8">
      <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
        <span className="mr-2">Ítems</span>
        <span className="text-sm font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {items.length} {items.length === 1 ? "ítem" : "ítems"}
        </span>
      </h4>
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm scrollbar-thin">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Código</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Denominación</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cantidad</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Costo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Bonif. %</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">IVA %</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Proveedor</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">{item.codigo}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.denominacion}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">{item.cantidad}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">${item.precio?.toFixed(2)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.bonificacion}%</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{getAlicuota(item)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{getProveedorNombre(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Totales = ({ data }) => {
  // Helper para formatear números
  const safeToFixed = (val, dec = 2) => {
    if (typeof val === "number") return val.toFixed(dec)
    if (typeof val === "string" && !isNaN(val)) return Number(val).toFixed(dec)
    return "0.00"
  }

  return (
    <div className="flex flex-col items-end gap-2 mt-8 bg-gray-50 p-6 rounded-xl border border-gray-100">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <span className="block text-sm text-gray-500 mb-1">Subtotal s/IVA</span>
          <span className="block text-lg font-bold text-gray-900">${safeToFixed(data.ven_impneto)}</span>
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
          <span className="block text-sm text-gray-500 mb-1">Total</span>
          <span className="block text-2xl font-bold text-emerald-600">
            ${safeToFixed(data.ven_total) || safeToFixed(data.total)}
          </span>
        </div>
      </div>
    </div>
  )
}

const DesgloseIVA = ({ ivaDesglose }) => {
  if (!ivaDesglose || Object.keys(ivaDesglose).length === 0) return null;
  const safeToFixed = (val, dec = 2) => {
    if (typeof val === 'number') return val.toFixed(dec);
    if (typeof val === 'string' && !isNaN(val)) return Number(val).toFixed(dec);
    return '0.00';
  };
  const formatAli = (ali) => ali === '0' ? 'Exento' : ali + '%';
  return (
    <div className="mt-8 bg-gray-50 p-6 rounded-xl border border-gray-100">
      <h4 className="text-lg font-semibold text-gray-700 mb-4 border-b border-gray-200 pb-2">
        Desglose de IVA por alícuota
      </h4>
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Alícuota
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Neto gravado
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">IVA</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(ivaDesglose).map(([ali, val], idx) => (
              <tr key={ali} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">{formatAli(ali)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${safeToFixed(val.neto)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${safeToFixed(val.iva)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PresupuestoVentaVista = (props) => {
  const { data, clientes = [], vendedores = [], plazos = [], sucursales = [], puntosVenta = [] } = props;
  if (!data) return <div className="p-8 text-gray-500 bg-white rounded-xl shadow-lg flex items-center justify-center min-h-[200px] border border-gray-100">
    <p className="text-center text-lg">No hay datos para mostrar.</p>
  </div>;
  if (data.tipo === 'Venta') return <VentaVista {...props} clientes={clientes} vendedores={vendedores} plazos={plazos} sucursales={sucursales} puntosVenta={puntosVenta} />;
  return <PresupuestoVista {...props} clientes={clientes} vendedores={vendedores} plazos={plazos} sucursales={sucursales} puntosVenta={puntosVenta} />;
};

export default PresupuestoVentaVista; 