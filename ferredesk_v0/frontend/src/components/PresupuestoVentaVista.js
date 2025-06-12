"use client"
import React from 'react';
import { BotonImprimir, BotonEliminar } from './Botones';
import { IconVenta, IconFactura, IconCredito, IconPresupuesto, IconRecibo } from './ComprobanteIcono';
import { useVentaDetalleAPI } from '../utils/useVentaDetalleAPI';
import { mapearVentaDetalle } from '../components/herramientasforms/MapeoVentaDetalle';

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
  comprobantes = []
}) => {
  // Obtener comprobante
  const comprobanteObj = (data.comprobante && typeof data.comprobante === 'object') ? data.comprobante : null;
  if (!comprobanteObj) return <div className="p-8 text-gray-500 bg-white rounded-xl shadow-lg flex items-center justify-center min-h-[200px] border border-gray-100">No hay comprobante asociado.</div>;
  const comprobanteNombre = comprobanteObj.nombre || '';
  const comprobanteLetra = comprobanteObj.letra || '';
  const comprobanteTipo = comprobanteObj.tipo || '';

  // Determinar tipo SOLO por comprobante
  let tipo = '';
  if ((comprobanteObj.tipo && comprobanteObj.tipo.toLowerCase() === 'presupuesto') || comprobanteObj.codigo_afip === '9997') {
    tipo = 'Presupuesto';
  } else {
    tipo = 'Venta';
  }
  const { icon, label } = getComprobanteIconAndLabel(comprobanteTipo, comprobanteNombre, comprobanteLetra);

  // Función para mapear tipo de comprobante a nombre amigable
  const mapearTipoComprobante = (tipo) => {
    if (!tipo) return '';
    const t = tipo.toLowerCase();
    if (t === 'factura') return 'Factura';
    if (t === 'recibo') return 'Recibo';
    if (t === 'nota de crédito interna') return 'Nota de Crédito Interna';
    if (t === 'nota de crédito') return 'Nota de Crédito';
    if (t === 'nota de débito') return 'Nota de Débito';
    if (t === 'presupuesto') return 'Presupuesto';
    return tipo.charAt(0).toUpperCase() + tipo.slice(1);
  };

  const tipoAmigable = mapearTipoComprobante(comprobanteTipo);

  return (
    <div className="max-w-4xl w-full mx-auto py-8 px-8 bg-white rounded-xl shadow-lg relative border border-gray-100">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center">
            {tipoAmigable} N° <span className="ml-2 text-emerald-600">{data.numero_formateado || (comprobanteLetra ? comprobanteLetra + ' ' : '') + (data.numero || '')}</span>
            <span className="ml-3 text-sm font-medium px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {data.estado}
            </span>
          </h3>
          <div className="flex gap-2 ml-6">
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
        <div className="flex flex-col items-end">
          {icon}
          <span className="mt-1 text-base font-semibold text-gray-800">
            {label}{comprobanteLetra && (label.startsWith('Factura') || label.startsWith('N. Cred') || label.startsWith('N. Deb')) ? ' ' + comprobanteLetra : ''}
          </span>
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
};

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
  comprobantes = []
}) => {
  // Obtener comprobante
  const comprobanteObj = (data.comprobante && typeof data.comprobante === 'object') ? data.comprobante : null;
  if (!comprobanteObj) return <div className="p-8 text-gray-500 bg-white rounded-xl shadow-lg flex items-center justify-center min-h-[200px] border border-gray-100">No hay comprobante asociado.</div>;
  const comprobanteNombre = comprobanteObj.nombre || '';
  const comprobanteLetra = comprobanteObj.letra || '';
  const comprobanteTipo = comprobanteObj.tipo || '';

  // Determinar tipo SOLO por comprobante
  let tipo = '';
  if ((comprobanteObj.tipo && comprobanteObj.tipo.toLowerCase() === 'presupuesto') || comprobanteObj.codigo_afip === '9997') {
    tipo = 'Presupuesto';
  } else {
    tipo = 'Venta';
  }
  const { icon, label } = getComprobanteIconAndLabel(comprobanteTipo, comprobanteNombre, comprobanteLetra);

  // Función para mapear tipo de comprobante a nombre amigable
  const mapearTipoComprobante = (tipo) => {
    if (!tipo) return '';
    const t = tipo.toLowerCase();
    if (t === 'factura') return 'Factura';
    if (t === 'recibo') return 'Recibo';
    if (t === 'nota de crédito interna') return 'Nota de Crédito Interna';
    if (t === 'nota de crédito') return 'Nota de Crédito';
    if (t === 'nota de débito') return 'Nota de Débito';
    if (t === 'presupuesto') return 'Presupuesto';
    return tipo.charAt(0).toUpperCase() + tipo.slice(1);
  };

  const tipoAmigable = mapearTipoComprobante(comprobanteTipo);

  return (
    <div className="max-w-4xl w-full mx-auto py-8 px-8 bg-white rounded-xl shadow-lg relative border border-gray-100">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center">
            {tipoAmigable} N° <span className="ml-2 text-purple-600">{(comprobanteLetra ? comprobanteLetra + ' ' : '') + (data.numero_formateado || data.numero)}</span>
            <span className="ml-3 text-sm font-medium px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
              {data.estado}
            </span>
          </h3>
          <div className="flex gap-2 ml-6">
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
        <div className="flex flex-col items-end">
          {icon}
          <span className="mt-1 text-base font-semibold text-gray-800">
            {label}{comprobanteLetra && (label.startsWith('Factura') || label.startsWith('N. Cred') || label.startsWith('N. Deb')) ? ' ' + comprobanteLetra : ''}
          </span>
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
};

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

const TablaItems = ({ data }) => {
  const items = data.items || [];
  // LOG: Mostrar todos los ítems y sus campos
  console.log('DEBUG - Ítems recibidos en TablaItems:', items);
  if (items.length > 0) {
    items.forEach((item, idx) => {
      console.log(`DEBUG - Ítem #${idx + 1}:`, item);
    });
  }
  // Helper para mostrar alícuota
  const getAlicuota = (item) => {
    if (item.ali_porce !== undefined && item.ali_porce !== null) return item.ali_porce + '%';
    return '-';
  };
  // Usar siempre los campos de la vista calculada
  const getCodigo = (item) => item.codigo ?? item.vdi_idsto ?? '-';
  const getDenominacion = (item) => item.vdi_detalle1 ?? '-';
  const getUnidad = (item) => item.unidad ?? item.vdi_detalle2 ?? '-';
  const getCantidad = (item) => item.vdi_cantidad ?? 0;
  const getPrecioUnitario = (item) => parseFloat(item.vdi_importe ?? 0);
  const getBonificacion = (item) => parseFloat(item.vdi_bonifica ?? 0);
  const getPrecioBonificado = (item) => {
    return getPrecioUnitario(item) * (1 - getBonificacion(item) / 100);
  };
  const getTotal = (item) => parseFloat(item.vdi_importe_total ?? 0);
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nro.</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Código</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Denominación</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Unidad</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cantidad</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Precio Unitario</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Bonif. %</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Precio Bonificado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">IVA</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700 text-center">{idx + 1}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">{getCodigo(item)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{getDenominacion(item)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{getUnidad(item)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium text-center">{getCantidad(item)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium text-right">{getPrecioUnitario(item).toFixed(2)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">{getBonificacion(item)}%</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium text-right">{getPrecioBonificado(item).toFixed(2)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">{getAlicuota(item)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium text-right">{getTotal(item).toFixed(2)}</td>
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

// Utilidad para icono y nombre corto
const getComprobanteIconAndLabel = (tipo, nombre = '', letra = '') => {
  const n = String(nombre || '').toLowerCase();
  if (n.includes('presupuesto')) return { icon: <IconPresupuesto className="w-10 h-10 text-blue-500" />, label: 'Presupuesto' };
  if (n.includes('venta')) return { icon: <IconVenta className="w-10 h-10 text-green-500" />, label: 'Venta' };
  if (n.includes('factura')) return { icon: <IconFactura className="w-10 h-10 text-purple-500" />, label: 'Factura' };
  if (n.includes('nota de crédito interna')) return { icon: <IconCredito className="w-10 h-10 text-pink-500" />, label: 'N. Cred. Int.' };
  if (n.includes('nota de crédito')) return { icon: <IconCredito className="w-10 h-10 text-pink-500" />, label: 'N. Cred.' };
  if (n.includes('nota de débito')) return { icon: <IconCredito className="w-10 h-10 text-yellow-500" />, label: 'N. Deb.' };
  if (n.includes('recibo')) return { icon: <IconRecibo className="w-10 h-10 text-orange-500" />, label: 'Recibo' };
  return { icon: <IconFactura className="w-10 h-10 text-gray-400" />, label: String(nombre) };
};

const mapearEstado = (ven_estado) => {
  if (ven_estado === 'AB') return 'Abierto';
  if (ven_estado === 'CE') return 'Cerrado';
  return ven_estado || '-';
};

const armarNumeroFormateado = (letra, punto, numero) => {
  if (letra && punto != null && numero != null) {
    return `${letra} ${String(punto).padStart(4, '0')}-${String(numero).padStart(8, '0')}`;
  }
  if (punto != null && numero != null) {
    return `${String(punto).padStart(4, '0')}-${String(numero).padStart(8, '0')}`;
  }
  return '-';
};

const PresupuestoVentaVista = (props) => {
  const { data, clientes = [], vendedores = [], plazos = [], sucursales = [], puntosVenta = [] } = props;
  const idVenta = data?.ven_id || data?.id;
  const { ventaCalculada, itemsCalculados, cargando, error } = useVentaDetalleAPI(idVenta);

  if (cargando) return <div className="p-8 text-gray-500 bg-white rounded-xl shadow-lg flex items-center justify-center min-h-[200px] border border-gray-100">Cargando datos de la venta/presupuesto...</div>;
  if (error) return <div className="p-8 text-red-600 bg-white rounded-xl shadow-lg flex items-center justify-center min-h-[200px] border border-gray-100">Error: {error}</div>;

  // Usar el helper centralizado para mapear todos los campos
  const datos = ventaCalculada
    ? mapearVentaDetalle({
        ventaCalculada,
        itemsCalculados,
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
  if (datos.tipo === 'Venta') return <VentaVista {...props} data={datos} clientes={clientes} vendedores={vendedores} plazos={plazos} sucursales={sucursales} puntosVenta={puntosVenta} />;
  return <PresupuestoVista {...props} data={datos} clientes={clientes} vendedores={vendedores} plazos={plazos} sucursales={sucursales} puntosVenta={puntosVenta} />;
};

export default PresupuestoVentaVista; 