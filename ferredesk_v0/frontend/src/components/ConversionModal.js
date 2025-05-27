import React, { useState, useEffect } from 'react';

const ALICUOTAS = {
  1: 0, // NO GRAVADO
  2: 0, // EXENTO
  3: 0, // 0%
  4: 10.5,
  5: 21,
  6: 27
};

const getAlicuota = (item) => {
  const ali = item.vdi_idaliiva !== undefined ? Number(item.vdi_idaliiva) : undefined;
  if (ali !== undefined && ALICUOTAS[ali] !== undefined) return ALICUOTAS[ali] + '%';
  const aliKey = Object.keys(ALICUOTAS).find(k => Number(ALICUOTAS[k]) === ali);
  if (aliKey) return ALICUOTAS[aliKey] + '%';
  if (item.alicuota) return item.alicuota + '%';
  if (item.iva) return item.iva + '%';
  if (item.iva_porcentaje) return item.iva_porcentaje + '%';
  if (item.vdi_idaliiva !== undefined) return String(item.vdi_idaliiva);
  return '-';
};

const ConversionModal = ({ 
  open, 
  presupuesto, 
  onClose,
  onConvertir,
  vendedores,
  clientes,
  plazos,
  sucursales,
  puntosVenta
}) => {
  const [selectedItems, setSelectedItems] = useState([]);

  // Inicializar items seleccionados cuando se abre el modal
  useEffect(() => {
    if (open && presupuesto?.items) {
      setSelectedItems(presupuesto.items.map(item => item.id));
    }
  }, [open, presupuesto]);

  // Manejar selección individual de items
  const handleItemSelect = (itemId, checked) => {
    if (checked) {
      setSelectedItems(prev => [...prev, itemId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
    }
  };

  // Manejar click en la fila
  const handleRowClick = (itemId) => {
    const isSelected = selectedItems.includes(itemId);
    handleItemSelect(itemId, !isSelected);
  };

  if (!open) return null;

  // Datos generales
  const cliente = clientes?.find(c => c.id === (presupuesto?.clienteId || presupuesto?.ven_idcli))?.razon || presupuesto?.cliente || presupuesto?.clienteId || '-';
  const vendedor = vendedores?.find(v => v.id === (presupuesto?.vendedorId || presupuesto?.ven_idvdo))?.nombre || presupuesto?.vendedorId || '-';
  const sucursal = sucursales?.find(s => s.id === (presupuesto?.sucursalId || presupuesto?.ven_sucursal))?.nombre || presupuesto?.sucursalId || '-';
  const puntoVenta = puntosVenta?.find(pv => pv.id === (presupuesto?.puntoVentaId || presupuesto?.ven_punto))?.nombre || presupuesto?.puntoVentaId || '-';
  const plazo = plazos?.find(p => p.id === (presupuesto?.plazoId || presupuesto?.ven_idpla))?.nombre || presupuesto?.plazoId || '-';

  return (
    <div className="fixed inset-0 bg-gray-100/50 flex items-center justify-center z-50">
      <div className="w-full max-w-5xl mx-auto bg-white rounded-xl overflow-hidden shadow-lg border border-gray-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">
              Convertir Presupuesto a Venta
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-red-500"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Información General */}
        <div className="p-6 pb-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <span className="block text-sm font-medium text-gray-500 mb-1">Cliente</span>
              <span className="block text-lg font-semibold text-gray-800">{cliente}</span>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <span className="block text-sm font-medium text-gray-500 mb-1">Fecha</span>
              <span className="block text-lg font-semibold text-gray-800">{presupuesto?.fecha}</span>
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

        {/* Grilla minimalista de Items */}
        <div className="px-6 pb-6">
          <div className="mb-2">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ítems</h3>
          </div>
          <div className="rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-200">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3"></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Denominación</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cantidad</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Costo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Bonif. %</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">IVA %</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {presupuesto?.items?.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleRowClick(item.id)}
                    tabIndex={0}
                    aria-label={`Seleccionar item ${item.denominacion}`}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleRowClick(item.id); }}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <span
                        role="checkbox"
                        aria-checked={selectedItems.includes(item.id)}
                        tabIndex={0}
                        onClick={() => handleItemSelect(item.id, !selectedItems.includes(item.id))}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleItemSelect(item.id, !selectedItems.includes(item.id)); }}
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-md border border-gray-300 transition-colors duration-150 cursor-pointer ${selectedItems.includes(item.id) ? 'bg-black' : 'bg-white'}`}
                        style={{ minWidth: '20px', minHeight: '20px' }}
                      >
                        {selectedItems.includes(item.id) && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3.5 7.5L6 10L10.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">{item.codigo}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.denominacion}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">{item.cantidad}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">${Number(item.precio).toFixed(2)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.bonificacion}%</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{getAlicuota(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={() => onConvertir(selectedItems)}
            disabled={selectedItems.length === 0}
            className="px-5 py-2 rounded-md text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base transition-colors"
          >
            Convertir
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConversionModal; 