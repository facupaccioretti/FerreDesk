import React, { useState, useEffect, useRef } from 'react';
import { BotonExpandir } from './Botones';

// Grilla de ítems reutilizable para ventas, presupuestos y facturas
export default function ItemsGrid({
  items,
  onAddItem,
  onEditItem,
  onDeleteItem,
  productosDisponibles,
  autoSumarDuplicados,
  setAutoSumarDuplicados,
  isReadOnly,
  bonificacionGeneral,
  setBonificacionGeneral,
  editRow,
  setEditRow,
  setSelectedProducto,
  codigoInputRef,
  selectedProducto
}) {
  const [showDuplicadoModal, setShowDuplicadoModal] = useState(false);
  const [duplicadoInfo, setDuplicadoInfo] = useState(null);
  const cantidadInputRef = useRef();
  const costoInputRef = useRef();
  const bonifInputRef = useRef();
  const [expandedRow, setExpandedRow] = useState(null);

  // Buscar producto exacto por código (codvta o codigo)
  useEffect(() => {
    if (editRow.codigo && editRow.codigo.length > 0) {
      const prod = productosDisponibles.find(
        p => (p.codvta || p.codigo)?.toString().toLowerCase() === editRow.codigo.toLowerCase()
      );
      setSelectedProducto(prod || null);
      if (prod) {
        setEditRow(row => ({
          ...row,
          costo: prod.precio || prod.preciovta || prod.preciounitario || '',
          cantidad: row.cantidad || 1,
          bonificacion: 0
        }));
      }
    } else {
      setSelectedProducto(null);
      setEditRow(row => ({ ...row, costo: '', cantidad: 1, bonificacion: 0 }));
    }
  }, [editRow.codigo, productosDisponibles]);

  // Manejar Enter/Tab en los campos para agregar ítem y pasar foco
  const handleKeyDown = (e, field) => {
    if (e.key === 'Enter' || (e.key === 'Tab' && field === 'bonificacion')) {
      e.preventDefault();
      e.stopPropagation();
      if (selectedProducto && editRow.codigo) {
        handleAddItem();
        setTimeout(() => codigoInputRef.current?.focus(), 100);
      }
    } else if (e.key === 'Tab') {
      if (field === 'codigo') cantidadInputRef.current?.focus();
      if (field === 'cantidad') costoInputRef.current?.focus();
      if (field === 'costo') bonifInputRef.current?.focus();
    }
  };

  // Calcular desglose de proveedores para una cantidad dada
  function calcularDesgloseProveedores(producto, cantidad) {
    if (!producto || !producto.stock_proveedores || producto.stock_proveedores.length === 0) return [];
    // Ordenar por proveedor habitual primero, luego por fecha/costo
    const proveedores = [...producto.stock_proveedores].sort((a, b) => {
      if (producto.proveedor_habitual && a.proveedor.id === producto.proveedor_habitual.id) return -1;
      if (producto.proveedor_habitual && b.proveedor.id === producto.proveedor_habitual.id) return 1;
      // Si no hay proveedor habitual, ordenar por costo ascendente
      return parseFloat(a.costo) - parseFloat(b.costo);
    });
    let restante = cantidad;
    const desglose = [];
    for (const prov of proveedores) {
      const cantUsar = Math.min(restante, parseFloat(prov.cantidad));
      if (cantUsar > 0) {
        desglose.push({ proveedor: prov.proveedor, cantidad: cantUsar, costo: parseFloat(prov.costo) });
        restante -= cantUsar;
      }
      if (restante <= 0) break;
    }
    // Si no alcanza el stock, el resto queda sin proveedor
    if (restante > 0) {
      desglose.push({ proveedor: { razon: 'Sin stock', id: 0 }, cantidad: restante, costo: producto.precio || producto.preciovta || producto.preciounitario || 0 });
    }
    return desglose;
  }

  // Modificar handleAddItem para usar el costo promedio ponderado
  const handleAddItem = () => {
    if (!selectedProducto) return;
    const cantidadNum = parseInt(editRow.cantidad) || 1;
    const bonificacionItem = parseFloat(editRow.bonificacion) || 0;
    const desglose = calcularDesgloseProveedores(selectedProducto, cantidadNum);
    // Costo promedio ponderado
    const totalCosto = desglose.reduce((sum, d) => sum + d.cantidad * d.costo, 0);
    const costoPromedio = cantidadNum > 0 ? totalCosto / cantidadNum : 0;
    const subtotalCalculado = (costoPromedio * cantidadNum) * (1 - bonificacionItem / 100);

    // Buscar si el producto ya existe
    const itemExistente = items.find(item => 
      item.producto.id === selectedProducto.id || 
      item.producto.codvta === selectedProducto.codvta
    );

    if (itemExistente && !autoSumarDuplicados) {
      setDuplicadoInfo({ 
        producto: selectedProducto, 
        itemExistente, 
        cantidad: cantidadNum, 
        costo: costoPromedio, 
        bonificacion: bonificacionItem 
      });
      setShowDuplicadoModal(true);
      return;
    }

    if (itemExistente && autoSumarDuplicados) {
      const nuevaCantidad = itemExistente.cantidad + cantidadNum;
      const bonificacionExistente = itemExistente.bonificacion || 0;
      const desgloseNuevo = calcularDesgloseProveedores(selectedProducto, nuevaCantidad);
      const totalCostoNuevo = desgloseNuevo.reduce((sum, d) => sum + d.cantidad * d.costo, 0);
      const costoPromedioNuevo = nuevaCantidad > 0 ? totalCostoNuevo / nuevaCantidad : 0;
      const nuevoSubtotal = (nuevaCantidad * costoPromedioNuevo) * (1 - bonificacionExistente / 100);
      
      onEditItem(itemExistente.id, {
        ...itemExistente,
        cantidad: nuevaCantidad,
        costo: costoPromedioNuevo,
        bonificacion: bonificacionExistente,
        subtotal: nuevoSubtotal,
        desgloseProveedores: desgloseNuevo
      });
    } else {
      // Agregar nuevo item con ID único
      const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
      onAddItem({
        id: newId,
        producto: selectedProducto,
        cantidad: cantidadNum,
        costo: costoPromedio,
        bonificacion: bonificacionItem,
        subtotal: subtotalCalculado,
        desgloseProveedores: desglose
      });
    }

    // Limpiar el formulario y devolver el foco
    setEditRow({ codigo: '', cantidad: 1, costo: '', bonificacion: 0 });
    setSelectedProducto(null);
    if (codigoInputRef.current) {
      codigoInputRef.current.focus();
    }
  };

  // Modal de duplicado
  const handleDuplicadoAction = (action) => {
    if (action === 'sumar') {
      onEditItem(duplicadoInfo.itemExistente.id, {
        ...duplicadoInfo.itemExistente,
        cantidad: duplicadoInfo.itemExistente.cantidad + duplicadoInfo.cantidad,
        subtotal: (duplicadoInfo.itemExistente.cantidad + duplicadoInfo.cantidad) * duplicadoInfo.itemExistente.costo * (1 - (duplicadoInfo.itemExistente.bonificacion || 0) / 100)
      });
    } else if (action === 'eliminar') {
      onDeleteItem(duplicadoInfo.itemExistente.id);
      const subtotalNuevoItem = (duplicadoInfo.costo * duplicadoInfo.cantidad) * (1 - (duplicadoInfo.bonificacion || 0) / 100);
      onAddItem({
        id: Math.max(0, ...items.map(i => i.id)) + 1,
        producto: duplicadoInfo.producto,
        cantidad: duplicadoInfo.cantidad,
        costo: duplicadoInfo.costo,
        bonificacion: duplicadoInfo.bonificacion || 0,
        subtotal: subtotalNuevoItem
      });
    }
    setShowDuplicadoModal(false);
    setDuplicadoInfo(null);
    setTimeout(() => codigoInputRef.current?.focus(), 100);
  };

  // Calcular subtotal de ítems (con bonificación particular)
  const subtotalSinBonifGeneral = items.reduce((sum, i) => {
    const subtotal = parseFloat(i.subtotal) || 0;
    return sum + subtotal;
  }, 0);

  // Calcular total aplicando bonificación general
  const bonifGeneralNum = parseFloat(bonificacionGeneral) || 0;
  const total = subtotalSinBonifGeneral * (1 - Math.min(bonifGeneralNum, 100) / 100);

  return (
    <div className="space-y-4">
      {!isReadOnly && (
        <div className="mb-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="autoSumarDuplicados"
            checked={autoSumarDuplicados}
            onChange={e => setAutoSumarDuplicados(e.target.checked)}
            className="form-checkbox h-4 w-4 text-black"
          />
          <label htmlFor="autoSumarDuplicados" className="text-sm text-gray-700 select-none">
            Sumar cantidades automáticamente al cargar productos duplicados
          </label>
        </div>
      )}
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
          disabled={isReadOnly}
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
            {/* Fila de alta SIEMPRE visible */}
            {!isReadOnly && (
              <tr className="bg-yellow-50">
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    ref={codigoInputRef}
                    type="text"
                    value={editRow.codigo}
                    onChange={e => setEditRow(row => ({ ...row, codigo: e.target.value }))}
                    onKeyDown={e => handleKeyDown(e, 'codigo')}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Código"
                    autoFocus
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{selectedProducto?.deno || selectedProducto?.nombre || ''}</td>
                <td className="px-2 py-2 whitespace-nowrap">{selectedProducto?.unidad || selectedProducto?.unidadmedida || '-'}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    ref={cantidadInputRef}
                    type="number"
                    value={editRow.cantidad}
                    onChange={e => setEditRow(row => ({ ...row, cantidad: e.target.value }))}
                    onKeyDown={e => handleKeyDown(e, 'cantidad')}
                    min="1"
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    disabled={!selectedProducto}
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <span className="w-full px-2 py-1">{editRow.costo}</span>
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    ref={bonifInputRef}
                    type="number"
                    value={editRow.bonificacion}
                    onChange={e => setEditRow(row => ({ ...row, bonificacion: e.target.value }))}
                    onKeyDown={e => handleKeyDown(e, 'bonificacion')}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    disabled={!selectedProducto}
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {selectedProducto ? `$${((parseFloat(editRow.costo) * parseInt(editRow.cantidad)) * (1 - (parseFloat(editRow.bonificacion) || 0) / 100)).toFixed(2)}` : ''}
                </td>
                <td className="px-2 py-2 whitespace-nowrap"></td>
              </tr>
            )}
            {/* Ítems cargados: solo editables cantidad y bonificación */}
            {items.map(item => (
              <React.Fragment key={item.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-2 py-2 whitespace-nowrap">{item.producto.codvta || item.producto.codigo}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{item.producto.deno || item.producto.nombre}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{item.producto.unidad || item.producto.unidadmedida || '-'}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={e => {
                        const newCantidad = parseInt(e.target.value) || 0;
                        if (newCantidad >= 0) {
                          const desglose = calcularDesgloseProveedores(item.producto, newCantidad);
                          const totalCosto = desglose.reduce((sum, d) => sum + d.cantidad * d.costo, 0);
                          const costoPromedio = newCantidad > 0 ? totalCosto / newCantidad : 0;
                          const newSubtotal = (newCantidad * costoPromedio) * (1 - (item.bonificacion || 0) / 100);
                          onEditItem(item.id, {
                            ...item,
                            cantidad: newCantidad,
                            costo: costoPromedio,
                            subtotal: newSubtotal,
                            desgloseProveedores: desglose
                          });
                        }
                      }}
                      min="0"
                      className="w-full px-2 py-1 border border-gray-200 rounded"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <span className="w-full px-2 py-1">{item.costo}</span>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <input
                      type="number"
                      value={item.bonificacion || 0}
                      onChange={e => {
                        const newBonificacion = Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 100);
                        const newSubtotal = (item.cantidad * item.costo) * (1 - newBonificacion / 100);
                        onEditItem(item.id, {
                          ...item,
                          bonificacion: newBonificacion,
                          subtotal: newSubtotal
                        });
                      }}
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full px-2 py-1 border border-gray-200 rounded"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-right">
                    ${(item.subtotal || 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-center">
                    {!isReadOnly && (
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Eliminar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-center">
                    <BotonExpandir expanded={expandedRow === item.id} onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)} />
                  </td>
                </tr>
                {expandedRow === item.id && (
                  <tr>
                    <td colSpan={9} className="bg-gray-50 px-4 py-2">
                      <div className="text-sm text-gray-700">
                        <b>Desglose de proveedores:</b>
                        <ul className="mt-2 ml-4 list-disc">
                          {item.desgloseProveedores && item.desgloseProveedores.length > 0 ? (
                            item.desgloseProveedores.map((d, idx) => (
                              <li key={idx}>
                                {d.proveedor.razon} — {d.cantidad} unidades a ${d.costo}
                              </li>
                            ))
                          ) : (
                            <li>No hay desglose disponible.</li>
                          )}
                        </ul>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end mt-4">
        <div className="text-lg font-bold text-gray-700">Total: ${total.toFixed(2)}</div>
      </div>
      {/* Modal de duplicado */}
      {showDuplicadoModal && duplicadoInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Producto duplicado</h3>
            <p className="mb-4">
              El producto {duplicadoInfo.producto.nombre} ya fue cargado. ¿Qué desea hacer?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => handleDuplicadoAction('sumar')}
                className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
              >
                Sumar cantidades
              </button>
              <button
                onClick={() => handleDuplicadoAction('eliminar')}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Eliminar anterior
              </button>
              <button
                onClick={() => setShowDuplicadoModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 