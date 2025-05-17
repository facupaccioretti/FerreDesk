import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { BotonExpandir } from './Botones';

const MIN_ROWS = 5;

function getEmptyRow() {
  return { codigo: '', denominacion: '', unidad: '', cantidad: 1, costo: '', bonificacion: 0, producto: null };
}

const ItemsGridPresupuesto = forwardRef(({
  productosDisponibles,
  autoSumarDuplicados,
  setAutoSumarDuplicados,
  bonificacionGeneral,
  setBonificacionGeneral
}, ref) => {
  const [rows, setRows] = useState(() => Array(MIN_ROWS).fill().map(getEmptyRow));

  // Exponer método para obtener los ítems cargados
  useImperativeHandle(ref, () => ({
    getItems: () => rows.filter(r => r.producto && r.codigo).map((row, idx) => ({
      vdi_orden: idx + 1,
      vdi_idsto: row.producto.id,
      vdi_cantidad: parseFloat(row.cantidad) || 0,
      vdi_importe: parseFloat(row.costo) || 0,
      vdi_bonifica: parseFloat(row.bonificacion) || 0,
      vdi_detalle1: row.denominacion || '',
      vdi_detalle2: row.unidad || '',
      vdi_idaliiva: row.producto.idaliiva || 0
    }))
  }), [rows]);

  const handleRowChange = (idx, field, value) => {
    setRows(rows => rows.map((row, i) => {
      if (i !== idx) return row;
      if (field === 'codigo' || field === 'denominacion') {
        let prod = null;
        if (field === 'codigo') {
          prod = productosDisponibles.find(p => (p.codvta || p.codigo)?.toString().toLowerCase() === value.toLowerCase());
        } else if (field === 'denominacion') {
          prod = productosDisponibles.find(p => (p.deno || p.nombre)?.toLowerCase() === value.toLowerCase());
        }
        if (prod) {
          return {
            ...row,
            codigo: prod.codvta || prod.codigo || '',
            denominacion: prod.deno || prod.nombre || '',
            unidad: prod.unidad || prod.unidadmedida || '-',
            costo: prod.precio || prod.preciovta || prod.preciounitario || '',
            cantidad: 1,
            bonificacion: 0,
            producto: prod
          };
        } else {
          return {
            ...row,
            producto: null,
            codigo: field === 'codigo' ? value : '',
            denominacion: field === 'denominacion' ? value : '',
            unidad: '',
            costo: '',
            cantidad: 1,
            bonificacion: 0
          };
        }
      } else {
        return { ...row, [field]: value };
      }
    }));
  };

  const handleRowKeyDown = (e, idx, field) => {
    if ((e.key === 'Enter' || (e.key === 'Tab' && field === 'bonificacion')) && rows[idx].producto && rows[idx].codigo) {
      e.preventDefault();
      e.stopPropagation();
      if (idx === rows.length - 1) {
        const lastRow = rows[rows.length - 1];
        if (lastRow.codigo || lastRow.denominacion || lastRow.producto) {
          setRows(rows => [...rows, getEmptyRow()]);
        }
      }
    }
  };

  const handleDeleteRow = (idx) => {
    setRows(rows => rows.map((row, i) => i === idx ? getEmptyRow() : row));
  };

  const getSubtotal = (row) => {
    const cantidad = parseInt(row.cantidad) || 0;
    const costo = parseFloat(row.costo) || 0;
    const bonif = parseFloat(row.bonificacion) || 0;
    return (costo * cantidad) * (1 - bonif / 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center gap-4 mb-4">
        <label className="text-sm font-medium text-gray-700">Bonificación general (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={bonificacionGeneral}
          onChange={e => {
            const value = Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 100);
            setBonificacionGeneral(value);
          }}
          className="w-24 px-2 py-1 border border-gray-300 rounded"
        />
      </div>
      <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
        <table className="min-w-full divide-y divide-gray-200" style={{ maxWidth: '100%' }}>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Código</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Denominación</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Unidad</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Cantidad</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Costo</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Bonif. %</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Subtotal</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row, idx) => (
              <tr key={`row-${idx}`}> 
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    type="text"
                    value={row.codigo}
                    onChange={e => handleRowChange(idx, 'codigo', e.target.value)}
                    onKeyDown={e => handleRowKeyDown(e, idx, 'codigo')}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Código"
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    type="text"
                    value={row.denominacion || ''}
                    onChange={e => handleRowChange(idx, 'denominacion', e.target.value)}
                    onKeyDown={e => handleRowKeyDown(e, idx, 'denominacion')}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Denominación"
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{row.unidad || '-'}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    type="number"
                    value={row.cantidad}
                    onChange={e => handleRowChange(idx, 'cantidad', e.target.value)}
                    onKeyDown={e => handleRowKeyDown(e, idx, 'cantidad')}
                    min="1"
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    type="number"
                    value={row.costo}
                    onChange={e => handleRowChange(idx, 'costo', e.target.value)}
                    onKeyDown={e => handleRowKeyDown(e, idx, 'costo')}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    type="number"
                    value={row.bonificacion}
                    onChange={e => handleRowChange(idx, 'bonificacion', e.target.value)}
                    onKeyDown={e => handleRowKeyDown(e, idx, 'bonificacion')}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-right">{row.producto ? `$${getSubtotal(row).toFixed(2)}` : ''}</td>
                <td className="px-2 py-2 whitespace-nowrap text-center">
                  {row.producto && (
                    <button
                      onClick={() => handleDeleteRow(idx)}
                      className="text-red-600 hover:text-red-800"
                      title="Eliminar"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export function ItemsGridVenta(props, ref) {
  return <ItemsGridPresupuesto {...props} ref={ref} />;
}

export default ItemsGridPresupuesto; 