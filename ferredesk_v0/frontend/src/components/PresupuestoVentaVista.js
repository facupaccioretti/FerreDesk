import React from 'react';
import { BotonImprimir, BotonEliminar } from './Botones';

const PresupuestoVista = ({ data, onImprimir, onEliminar, onCerrar, clientes, vendedores, plazos, sucursales, puntosVenta }) => (
  <div className="max-w-4xl w-full mx-auto py-8 px-8 bg-white rounded-xl shadow relative">
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-xl font-semibold text-gray-800">
        Presupuesto N° {data.numero} <span className="ml-2 text-sm font-normal text-gray-500">({data.estado})</span>
      </h3>
      <div className="flex gap-2">
        <BotonImprimir onClick={() => onImprimir(data)} />
        <BotonEliminar onClick={() => onEliminar(data.id)} />
        <button onClick={onCerrar} className="px-2 py-1 text-gray-500 hover:text-black">Cerrar</button>
      </div>
    </div>
    <DatosGenerales data={data} clientes={clientes} vendedores={vendedores} plazos={plazos} sucursales={sucursales} puntosVenta={puntosVenta} />
    <TablaItems data={data} />
    <Totales data={data} />
  </div>
);

const VentaVista = ({ data, onImprimir, onEliminar, onCerrar, clientes, vendedores, plazos, sucursales, puntosVenta }) => (
  <div className="max-w-4xl w-full mx-auto py-8 px-8 bg-white rounded-xl shadow relative">
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-xl font-semibold text-gray-800">
        Venta N° {data.numero} <span className="ml-2 text-sm font-normal text-gray-500">({data.estado})</span>
      </h3>
      <div className="flex gap-2">
        <BotonImprimir onClick={() => onImprimir(data)} />
        <BotonEliminar onClick={() => onEliminar(data.id)} />
        <button onClick={onCerrar} className="px-2 py-1 text-gray-500 hover:text-black">Cerrar</button>
      </div>
    </div>
    <DatosGenerales data={data} clientes={clientes} vendedores={vendedores} plazos={plazos} sucursales={sucursales} puntosVenta={puntosVenta} />
    <TablaItems data={data} />
    <Totales data={data} />
  </div>
);

const DatosGenerales = ({ data, clientes = [], vendedores = [], plazos = [], sucursales = [], puntosVenta = [] }) => {
  const cliente = clientes.find(c => c.id === (data.clienteId || data.ven_idcli))?.razon || data.cliente || data.clienteId || '-';
  const vendedor = vendedores.find(v => v.id === (data.vendedorId || data.ven_idvdo))?.nombre || data.vendedorId || '-';
  const sucursal = sucursales.find(s => s.id === (data.sucursalId || data.ven_sucursal))?.nombre || data.sucursalId || '-';
  const puntoVenta = puntosVenta.find(pv => pv.id === (data.puntoVentaId || data.ven_punto))?.nombre || data.puntoVentaId || '-';
  const plazo = plazos.find(p => p.id === (data.plazoId || data.ven_idpla))?.nombre || data.plazoId || '-';
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <div>
        <span className="block text-sm font-medium text-gray-500 mb-1">Cliente</span>
        <span className="block text-lg text-gray-800">{cliente}</span>
      </div>
      <div>
        <span className="block text-sm font-medium text-gray-500 mb-1">Fecha</span>
        <span className="block text-lg text-gray-800">{data.fecha}</span>
      </div>
      <div>
        <span className="block text-sm font-medium text-gray-500 mb-1">Vendedor</span>
        <span className="block text-lg text-gray-800">{vendedor}</span>
      </div>
      <div>
        <span className="block text-sm font-medium text-gray-500 mb-1">Sucursal</span>
        <span className="block text-lg text-gray-800">{sucursal}</span>
      </div>
      <div>
        <span className="block text-sm font-medium text-gray-500 mb-1">Punto de Venta</span>
        <span className="block text-lg text-gray-800">{puntoVenta}</span>
      </div>
      <div>
        <span className="block text-sm font-medium text-gray-500 mb-1">Plazo</span>
        <span className="block text-lg text-gray-800">{plazo}</span>
      </div>
    </div>
  );
};

const TablaItems = ({ data }) => {
  // Soporta items con o sin objeto producto
  const items = (data.items || []).map(item => {
    if (item.producto) {
      return {
        codigo: item.producto.codvta || item.producto.codigo || '',
        denominacion: item.producto.deno || item.producto.nombre || '',
        unidad: item.producto.unidad || item.producto.unidadmedida || '-',
        cantidad: item.cantidad,
        precio: item.costo,
        bonificacion: item.bonificacion || 0,
        subtotal: item.subtotal
      };
    } else {
      return {
        codigo: item.codigo || item.codvta || item.id || '-',
        denominacion: item.denominacion || item.nombre || '',
        unidad: item.unidad || item.unidadmedida || '-',
        cantidad: item.cantidad,
        precio: item.precio || item.costo,
        bonificacion: item.bonificacion || 0,
        subtotal: item.subtotal
      };
    }
  });
  // Asegura al menos 5 filas
  while (items.length < 5) items.push({ isEmpty: true });
  return (
    <div className="mb-8">
      <h4 className="text-lg font-medium text-gray-800 mb-4">Ítems</h4>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Denominación</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bonif.</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item, idx) => (
            <tr key={idx} className={item.isEmpty ? 'bg-yellow-50' : ''}>
              <td className="px-3 py-2 whitespace-nowrap">{item.isEmpty ? '' : item.codigo}</td>
              <td className="px-3 py-2 whitespace-nowrap">{item.isEmpty ? '' : item.denominacion}</td>
              <td className="px-3 py-2 whitespace-nowrap">{item.isEmpty ? '' : item.unidad}</td>
              <td className="px-3 py-2 whitespace-nowrap">{item.isEmpty ? '' : item.cantidad}</td>
              <td className="px-3 py-2 whitespace-nowrap">{item.isEmpty ? '' : (item.precio !== undefined ? `$${item.precio}` : '')}</td>
              <td className="px-3 py-2 whitespace-nowrap">{item.isEmpty ? '' : `${item.bonificacion || 0}%`}</td>
              <td className="px-3 py-2 whitespace-nowrap">{item.isEmpty ? '' : (item.subtotal !== undefined ? `$${Number(item.subtotal).toFixed(2)}` : '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Totales = ({ data }) => (
  <div className="flex justify-end gap-8 mt-8">
    <div>
      <span className="block text-sm text-gray-500">Bonificación General</span>
      <span className="block text-lg text-gray-800">{data.bonificacionGeneral || 0}%</span>
    </div>
    <div>
      <span className="block text-sm text-gray-500">Total</span>
      <span className="block text-2xl font-bold text-gray-900">${data.total}</span>
    </div>
  </div>
);

const PresupuestoVentaVista = (props) => {
  const { data, clientes = [], vendedores = [], plazos = [], sucursales = [], puntosVenta = [] } = props;
  if (!data) return <div className="p-8 text-gray-500">No hay datos para mostrar.</div>;
  if (data.tipo === 'Venta') return <VentaVista {...props} clientes={clientes} vendedores={vendedores} plazos={plazos} sucursales={sucursales} puntosVenta={puntosVenta} />;
  return <PresupuestoVista {...props} clientes={clientes} vendedores={vendedores} plazos={plazos} sucursales={sucursales} puntosVenta={puntosVenta} />;
};

export default PresupuestoVentaVista; 