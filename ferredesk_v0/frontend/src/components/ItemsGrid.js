import React, { useState, useImperativeHandle, forwardRef, useRef, useEffect, useCallback } from 'react';
import { BotonDuplicar } from './Botones';

// Diccionario de alícuotas según la tabla proporcionada
const ALICUOTAS = {
  1: 0, // NO GRAVADO
  2: 0, // EXENTO
  3: 0, // 0%
  4: 10.5,
  5: 21,
  6: 27
};

function getEmptyRow() {
  return { id: Date.now() + Math.random(), codigo: '', denominacion: '', unidad: '', cantidad: 1, costo: '', bonificacion: 0, producto: null };
}

const ProveedorCambioModal = ({ open, proveedores, onSelect, onClose, cantidadExtra, proveedorActual, nombreProveedorActual, producto, denominacion, cantidadSolicitada, stockActual, productosDisponibles }) => {
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState('');
  if (!open) return null;
  // Buscar el producto completo si solo se tiene la id
  let productoCompleto = producto;
  if (producto && typeof producto === 'number' && Array.isArray(productosDisponibles)) {
    productoCompleto = productosDisponibles.find(p => p.id === producto) || {};
  }
  return (
    <div className="fixed inset-0 bg-gray-100/50 flex items-center justify-center z-50">
      <div className="w-full max-w-md mx-auto bg-white rounded-xl overflow-hidden shadow-lg border border-gray-200">
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-6 w-6 text-black flex-shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <div>
              <h2 className="text-xl font-semibold text-black">Stock insuficiente</h2>
              <p className="text-gray-700 mt-2">
                <span className="font-semibold">Producto:</span> {denominacion || '-'}<br/>
                <span className="font-semibold">Código:</span> {productoCompleto?.codvta || productoCompleto?.codigo || '-'}<br/>
                <span className="font-semibold">Cantidad solicitada:</span> {cantidadSolicitada} <br/>
                <span className="font-semibold">Stock actual:</span> {stockActual} <br/>
                La cantidad supera el stock del proveedor seleccionado. Selecciona un nuevo proveedor para los <span className="font-semibold">{cantidadExtra} items</span> extra, o continúa con el mismo proveedor (el stock quedará negativo).
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="relative">
              <select
                className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-md hover:border-black transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-opacity-20 text-gray-800 appearance-none"
                value={proveedorSeleccionado}
                onChange={e => setProveedorSeleccionado(e.target.value)}
              >
                <option value="">Seleccionar otro proveedor</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stock}, Costo: {p.costo})</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
                <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>

            <div className="flex flex-col gap-4 mt-6">
              <button
                onClick={() => onSelect(proveedorActual, true)}
                className="w-full px-4 py-3 border border-gray-300 rounded-md text-gray-800 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-black focus:ring-opacity-20"
              >
                Seguir con {nombreProveedorActual}
                <span className="block text-xs text-gray-500 mt-1">(stock negativo)</span>
              </button>
              <div className="mt-2">
                <button
                  className="w-full px-4 py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-opacity-20"
                  disabled={!proveedorSeleccionado || proveedorSeleccionado === proveedorActual}
                  onClick={() => onSelect(proveedorSeleccionado, false)}
                >
                  Usar nuevo proveedor
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          Selecciona la opción que prefieras para continuar.
        </div>
      </div>
    </div>
  );
};

const ItemsGridPresupuesto = forwardRef(({
  productosDisponibles,
  proveedores,
  stockProveedores,
  autoSumarDuplicados,
  setAutoSumarDuplicados,
  bonificacionGeneral,
  setBonificacionGeneral,
  modo = 'presupuesto', // por defecto, para distinguir entre venta y presupuesto
  onRowsChange,
  initialItems
}, ref) => {
  const esPresupuesto = modo === 'presupuesto';
  const [rows, setRows] = useState(() => (Array.isArray(initialItems) && initialItems.length > 0 ? initialItems : [getEmptyRow()]));
  const [stockNegativo, setStockNegativo] = useState(false);
  const [proveedorCambio, setProveedorCambio] = useState({ open: false, idx: null, cantidadExtra: 0, proveedores: [], producto: null, proveedorActual: null, nombreProveedorActual: '' });
  const codigoRefs = useRef([]);
  const cantidadRefs = useRef([]);
  const [ultimoIdxAutocompletado, setUltimoIdxAutocompletado] = useState(null);
  const [pendingAddItem, setPendingAddItem] = useState(null);
  const [proveedoresIgnorados, setProveedoresIgnorados] = useState([]);

  const getProveedoresProducto = useCallback((productoId) => {
    if (!stockProveedores || !productoId) return [];
    return (stockProveedores[productoId] || []).map(sp => ({
      id: sp.proveedor.id,
      nombre: sp.proveedor.razon,
      stock: sp.cantidad,
      costo: sp.costo,
      esHabitual: !!(sp.proveedor_habitual || sp.habitual || sp.es_habitual)
    }));
  }, [stockProveedores]);

  const addItemWithDuplicado = useCallback((producto, proveedorId, cantidad = 1) => {
    const idxExistente = rows.findIndex(r => r.producto && r.producto.id === producto.id && r.proveedorId === proveedorId);
    if (idxExistente !== -1) {
      if (autoSumarDuplicados === 'sumar') {
        setRows(rows => rows.map((row, i) => i === idxExistente ? { ...row, cantidad: Number(row.cantidad) + cantidad } : row));
        return;
      }
      if (autoSumarDuplicados === 'eliminar') {
        setRows(rows => rows.filter((_, i) => i !== idxExistente));
        return;
      }
      if (autoSumarDuplicados === 'duplicar') {
        setRows(prevRows => {
          const lastRow = prevRows[prevRows.length - 1];
          const nuevoItem = {
            ...lastRow,
            codigo: producto.codvta || producto.codigo || '',
            denominacion: producto.deno || producto.nombre || '',
            unidad: producto.unidad || producto.unidadmedida || '-',
            costo: getProveedoresProducto(producto.id).find(p => p.id === proveedorId)?.costo || 0,
            cantidad,
            bonificacion: 0,
            producto: producto,
            proveedorId: proveedorId
          };
          return [...prevRows, nuevoItem, getEmptyRow()];
        });
        return;
      }
      // Si no hay acción válida, no hacer nada
      return;
    }
    setRows(prevRows => {
      const lastRow = prevRows[prevRows.length - 1];
      const nuevoItem = {
        ...lastRow,
        codigo: producto.codvta || producto.codigo || '',
        denominacion: producto.deno || producto.nombre || '',
        unidad: producto.unidad || producto.unidadmedida || '-',
        costo: getProveedoresProducto(producto.id).find(p => p.id === proveedorId)?.costo || 0,
        cantidad,
        bonificacion: 0,
        producto: producto,
        proveedorId: proveedorId
      };
      if (!lastRow.producto && !lastRow.codigo) {
        return [...prevRows.slice(0, -1), nuevoItem, getEmptyRow()];
      } else {
        return [...prevRows, nuevoItem, getEmptyRow()];
      }
    });
  }, [rows, autoSumarDuplicados, setRows, getProveedoresProducto]);

  useEffect(() => {
    // Si el primer renglón es vacío y el input de código está vacío, enfocar automáticamente
    if (rows.length > 0 && isRowVacio(rows[0]) && (!rows[0].codigo || rows[0].codigo === '')) {
      if (codigoRefs.current[0]) {
        codigoRefs.current[0].focus();
      }
    }
  }, [rows]);

  function isRowLleno(row) {
    return !!row.producto;
  }

  function isRowVacio(row) {
    return !row.producto && (!row.codigo || row.codigo.trim() === '') && (!row.denominacion || row.denominacion.trim() === '');
  }

  function ensureSoloUnEditable(rows) {
    let result = rows.slice();
    // Eliminar vacíos intermedios
    for (let i = result.length - 2; i >= 0; i--) {
      if (isRowVacio(result[i])) {
        result.splice(i, 1);
      }
    }
    const sinProducto = result.filter(row => !isRowLleno(row));
    if (sinProducto.length > 1) {
      const lastIdx = result.map(row => !isRowLleno(row)).lastIndexOf(true);
      if (lastIdx !== -1) {
        result.splice(lastIdx, 1);
      }
    }
    // Si hay algún renglón sin producto, no agrego otro vacío
    if (result.some(row => !isRowLleno(row))) {
      // Si el último renglón no tiene id, asignar uno único
      const last = result[result.length - 1];
      if (last && !last.id) {
        last.id = Date.now() + Math.random();
      }
      return result;
    }
    // Solo agrego un vacío si todos los renglones tienen producto
    result.push({ ...getEmptyRow(), id: Date.now() + Math.random() });
    return result;
  }

  const handleRowChange = (idx, field, value) => {
    console.log(`[ItemsGrid] handleRowChange - idx: ${idx}, field: ${field}, value:`, value);
    setRows(prevRows => {
      const newRows = [...prevRows];
      if (field === 'codigo') {
        newRows[idx] = {
          ...newRows[idx],
          codigo: value,
          ...(value.trim() === '' ? { producto: null, denominacion: '', unidad: '', costo: '', cantidad: 1, bonificacion: 0, proveedorId: '' } : {})
        };
        const updatedRows = ensureSoloUnEditable(newRows);
        console.log('[ItemsGrid] handleRowChange (código) - rows actualizadas:', updatedRows);
        onRowsChange?.(updatedRows);
        return updatedRows;
      } else if (field === 'costo' || field === 'bonificacion') {
        newRows[idx] = {
          ...newRows[idx],
          [field]: value
        };
        const updatedRows = ensureSoloUnEditable(newRows);
        console.log(`[ItemsGrid] handleRowChange (${field}) - rows actualizadas:`, updatedRows);
        onRowsChange?.(updatedRows);
        return updatedRows;
      }
      return newRows;
    });
  };

  const handleAddItem = useCallback((producto) => {
    const proveedores = getProveedoresProducto(producto.id);
    const proveedorHabitual = proveedores.find(p => p.esHabitual) || proveedores[0];
    const proveedorId = proveedorHabitual ? proveedorHabitual.id : '';
    const cantidad = 1;
    const proveedor = proveedores.find(p => p.id === proveedorId);
    let totalStock = proveedor ? Number(proveedor.stock) : 0;
    if (cantidad > totalStock) {
      // Disparar modal de stock insuficiente antes de agregar
      setProveedorCambio({
        open: true,
        idx: null, // No hay fila aún
        cantidadExtra: cantidad - totalStock,
        proveedores: proveedores.filter(p => p.id !== proveedorId && p.stock > 0),
        producto,
        denominacion: producto.deno || producto.nombre || '',
        proveedorActual: proveedorId,
        nombreProveedorActual: proveedor?.nombre || ''
      });
      // Guardar el producto y proveedor temporalmente para agregar después según la decisión
      setPendingAddItem({ producto, proveedorId, cantidad });
      return;
    }
    addItemWithDuplicado(producto, proveedorId, cantidad);
  }, [addItemWithDuplicado, getProveedoresProducto, setProveedorCambio, setPendingAddItem, rows]);

  // En useImperativeHandle, expongo también getRows para acceder siempre al array actualizado
  useImperativeHandle(ref, () => ({
    getItems: () => {
      const items = rows.filter(r => r.producto && (r.codigo || r.producto.id)).map((row, idx) => {
        const cantidad = parseFloat(row.cantidad) || 0;
        const costo = parseFloat(row.costo) || 0;
        const bonif = parseFloat(row.bonificacion) || 0;
        const item = {
          vdi_orden: idx + 1,
          vdi_idsto: row.producto.id,
          vdi_idpro: row.proveedorId,
          vdi_cantidad: cantidad,
          vdi_importe: costo,
          vdi_bonifica: bonif,
          vdi_detalle1: row.denominacion || '',
          vdi_detalle2: row.unidad || '',
          vdi_idaliiva: row.producto.idaliiva || row.idaliiva || 0,
          alicuotaIva: undefined,
          codigo: row.codigo || String(row.producto.id),
          producto: row.producto,
          proveedorId: row.proveedorId
        };
        return item;
      });
      return items;
    },
    getRows: () => rows,
    handleAddItem,
    getStockNegativo: () => stockNegativo,
  }), [rows, handleAddItem, stockNegativo]);

  // Actualizar costo automáticamente al cambiar proveedor
  const handleProveedorChange = (idx, proveedorId) => {
    console.log(`[ItemsGrid] handleProveedorChange - idx: ${idx}, proveedorId:`, proveedorId);
    setRows(prevRows => {
      const newRows = prevRows.map((row, i) => {
        if (i !== idx) return row;
        const productoId = row.producto?.id;
        const proveedores = getProveedoresProducto(productoId);
        const proveedor = proveedores.find(p => String(p.id) === String(proveedorId));
        let nuevoCosto = proveedor ? proveedor.costo : 0;
        console.log(`[ItemsGrid] handleProveedorChange - nuevo costo para item ${idx}:`, nuevoCosto);
        return { ...row, proveedorId, costo: nuevoCosto };
      });
      console.log('[ItemsGrid] handleProveedorChange - rows actualizadas:', newRows);
      onRowsChange?.(newRows);
      return newRows;
    });
    const row = rows[idx];
    const productoId = row.producto?.id;
    const proveedores = getProveedoresProducto(productoId);
    const proveedor = proveedores.find(p => String(p.id) === String(proveedorId));
    let totalStock = proveedor ? Number(proveedor.stock) : 0;
    const totalCantidad = rows.reduce((sum, r, i) => {
      if (r.producto && r.producto.id === productoId && String(r.proveedorId) === String(proveedorId)) {
        return sum + (i === idx ? Number(row.cantidad) : Number(r.cantidad));
      }
      return sum;
    }, 0);
    if (totalCantidad > totalStock && !proveedoresIgnorados.includes(proveedorId)) {
      const cantidadExtra = totalCantidad - totalStock;
      const otrosProveedores = proveedores.filter(p => String(p.id) !== String(proveedorId) && p.stock > 0);
      setProveedorCambio({ open: true, idx, cantidadExtra, proveedores: otrosProveedores, producto: row.producto, denominacion: row.denominacion, proveedorActual: row.proveedorId, nombreProveedorActual: proveedor?.nombre || '' });
    }
    if (totalCantidad > totalStock) {
      setStockNegativo(true);
    } else {
      setStockNegativo(false);
    }
  };

  // handleCantidadChange: Si es presupuesto, solo setea cantidad, sin alertas ni modales
  const handleCantidadChange = (idx, cantidad) => {
    console.log(`[ItemsGrid] handleCantidadChange - idx: ${idx}, cantidad:`, cantidad);
    if (esPresupuesto) {
      setRows(prevRows => {
        const newRows = prevRows.map((row, i) => i === idx ? { ...row, cantidad } : row);
        console.log('[ItemsGrid] handleCantidadChange (presupuesto) - rows actualizadas:', newRows);
        onRowsChange?.(newRows);
        return newRows;
      });
      return;
    }
    setRows(prevRows => {
      const newRows = prevRows.map((row, i) => i === idx ? { ...row, cantidad } : row);
      console.log('[ItemsGrid] handleCantidadChange - rows actualizadas:', newRows);
      onRowsChange?.(newRows);
      return newRows;
    });
    const row = rows[idx];
    const proveedores = getProveedoresProducto(row.producto?.id);
    const proveedor = proveedores.find(p => String(p.id) === String(row.proveedorId));
    let totalStock = proveedor ? Number(proveedor.stock) : 0;
    const totalCantidad = rows.reduce((sum, r, i) => {
      if (r.producto && r.producto.id === row.producto?.id && String(r.proveedorId) === String(row.proveedorId)) {
        return sum + (i === idx ? Number(cantidad) : Number(r.cantidad));
      }
      return sum;
    }, 0);
    if (totalCantidad > totalStock && !proveedoresIgnorados.includes(row.proveedorId)) {
      const cantidadExtra = totalCantidad - totalStock;
      const otrosProveedores = proveedores.filter(p => String(p.id) !== String(row.proveedorId) && p.stock > 0);
      setProveedorCambio({ open: true, idx, cantidadExtra, proveedores: otrosProveedores, producto: row.producto, denominacion: row.denominacion, proveedorActual: row.proveedorId, nombreProveedorActual: proveedor?.nombre || '' });
      setStockNegativo(true);
    } else {
      if (totalCantidad > totalStock) {
        setStockNegativo(true);
      } else {
        setStockNegativo(false);
      }
    }
  };

  // Acción al seleccionar nuevo proveedor en el modal
  const handleProveedorCambioSelect = (proveedorId, permitirNegativo = false) => {
    if (pendingAddItem) {
      const { producto, cantidad } = pendingAddItem;
      addItemWithDuplicado(producto, proveedorId, cantidad);
      setPendingAddItem(null);
    }
    // NUEVO: actualizar la fila si el modal se disparó por edición de una fila existente
    if (proveedorCambio.idx !== null && proveedorId) {
      setRows(rows => rows.map((row, i) => {
        if (i !== proveedorCambio.idx) return row;
        const productoId = row.producto?.id;
        const proveedores = getProveedoresProducto(productoId);
        const proveedor = proveedores.find(p => String(p.id) === String(proveedorId));
        let nuevoCosto = proveedor ? proveedor.costo : 0;
        return { ...row, proveedorId, costo: nuevoCosto };
      }));
    }
    setProveedorCambio({ open: false, idx: null, cantidadExtra: 0, proveedores: [], producto: null, proveedorActual: null, nombreProveedorActual: '' });
    if (permitirNegativo) setStockNegativo(true);
    setProveedoresIgnorados(prev => [...prev, proveedorId]);
  };

  // Eliminar ítem y dejar solo un renglón vacío si no quedan ítems
  const handleDeleteRow = (idx) => {
    setRows(rows => {
      const newRows = rows.filter((_, i) => i !== idx);
      onRowsChange?.(newRows);
      if (newRows.filter(r => r.producto && r.codigo).length === 0) {
        return [getEmptyRow()];
      }
      const last = newRows[newRows.length - 1];
      if (last && last.producto) {
        return [...newRows, getEmptyRow()];
      }
      return newRows;
    });
  };

  // 1. Reescribir isDuplicado para que sea robusto y solo resalte la celda de cantidad
  const getDuplicadoMap = () => {
    const map = {};
    rows.forEach((row, idx) => {
      if (!row.producto || !row.proveedorId) return;
      const key = `${row.producto.id}_${row.proveedorId}`;
      if (!map[key]) map[key] = [];
      map[key].push(idx);
    });
    return map;
  };
  const duplicadoMap = getDuplicadoMap();
  const isDuplicado = (row, idx) => {
    if (!row.producto || !row.proveedorId) return false;
    const key = `${row.producto.id}_${row.proveedorId}`;
    return duplicadoMap[key] && duplicadoMap[key].length > 1 && duplicadoMap[key].indexOf(idx) !== 0;
  };

  // Definir handleRowKeyDown si no está definida
  const handleRowKeyDown = (e, idx, field) => {
    if ((e.key === 'Enter' || (e.key === 'Tab' && field === 'bonificacion'))) {
      const row = rows[idx];
      if (field === 'codigo' && row.codigo) {
        let prod = productosDisponibles.find(p => (p.codvta || p.codigo)?.toString().toLowerCase() === row.codigo.toLowerCase());
        if (prod) {
          const proveedores = getProveedoresProducto(prod.id);
          const proveedorHabitual = proveedores.find(p => p.esHabitual) || proveedores[0];
          const proveedorId = proveedorHabitual ? proveedorHabitual.id : '';
          const idxExistente = rows.findIndex((r, i) =>
            i !== idx &&
            r.producto &&
            r.producto.id === prod.id &&
            r.proveedorId === proveedorId
          );
          if (idxExistente !== -1) {
            if (autoSumarDuplicados === 'sumar') {
              setRows(rows => {
                const newRows = rows.map((r, i) => i === idxExistente ? { ...r, cantidad: Number(r.cantidad) + Number(row.cantidad) } : r);
                newRows[idx] = getEmptyRow();
                return ensureSoloUnEditable(newRows);
              });
              setUltimoIdxAutocompletado(idxExistente);
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            if (autoSumarDuplicados === 'duplicar') {
              setRows(prevRows => {
                const lastRow = prevRows[prevRows.length - 1];
                const nuevoItem = {
                  ...lastRow,
                  codigo: prod.codvta || prod.codigo || '',
                  denominacion: prod.deno || prod.nombre || '',
                  unidad: prod.unidad || prod.unidadmedida || '-',
                  costo: proveedorHabitual?.costo || 0,
                  cantidad: row.cantidad || 1,
                  bonificacion: 0,
                  producto: prod,
                  proveedorId: proveedorId
                };
                return [...prevRows, nuevoItem, getEmptyRow()];
              });
              setUltimoIdxAutocompletado(rows.length);
              setRows(rows => {
                const newRows = [...rows];
                newRows[idx] = getEmptyRow();
                return ensureSoloUnEditable(newRows);
              });
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            // Si no hay acción válida, no mover foco
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          // Si no es duplicado, autocompletar datos y agregar ítem
          setRows(prevRows => {
            const newRows = [...prevRows];
            newRows[idx] = {
              ...newRows[idx],
              codigo: prod.codvta || prod.codigo || '',
              denominacion: prod.deno || prod.nombre || '',
              unidad: prod.unidad || prod.unidadmedida || '-',
              costo: proveedorHabitual?.costo || 0,
              cantidad: row.cantidad || 1,
              bonificacion: 0,
              producto: prod,
              proveedorId: proveedorId
            };
            // Si todos los renglones están llenos, agrego uno vacío
            if (newRows.every(isRowLleno)) {
              newRows.push(getEmptyRow());
            }
            return ensureSoloUnEditable(newRows);
          });
          setUltimoIdxAutocompletado(idx);
          e.preventDefault();
          e.stopPropagation();
          return;
        } else {
          // Si el código no es válido, limpiar la fila pero NO mover el foco
          setRows(prevRows => {
            const newRows = [...prevRows];
            newRows[idx] = { ...getEmptyRow(), id: newRows[idx].id };
            return ensureSoloUnEditable(newRows);
          });
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
      if (field === 'cantidad') {
        if (rows[idx].producto && rows[idx].codigo && idx === rows.length - 1) {
          setTimeout(() => {
            if (codigoRefs.current[idx + 1]) codigoRefs.current[idx + 1].focus();
          }, 0);
        }
      }
    }
    // Prevenir submit del formulario con Enter en cualquier input de la grilla
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // useEffect para mover el foco a cantidad tras autocompletar
  useEffect(() => {
    if (ultimoIdxAutocompletado !== null) {
      if (cantidadRefs.current[ultimoIdxAutocompletado]) {
        cantidadRefs.current[ultimoIdxAutocompletado].focus();
      }
      setUltimoIdxAutocompletado(null);
    }
  }, [rows, ultimoIdxAutocompletado]);

  // Notificar al padre cuando cambian los rows
  useEffect(() => {
    if (onRowsChange) {
      console.log('[ItemsGrid] Notificando cambio de rows al padre:', rows);
      onRowsChange(rows);
    }
  }, [rows, onRowsChange]);

  // Render igual que ItemsGridPresupuesto
  return (
    <div className="space-y-4 w-full">
      {esPresupuesto && (
        <div className="mb-2 p-2 bg-blue-50 border-l-4 border-blue-400 text-blue-800 rounded">
          Este es un presupuesto. No se descuenta stock ni se valida disponibilidad. Las validaciones se aplicarán al convertir a venta.
        </div>
      )}
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-4 mb-2">
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
        <span className="ml-4 text-gray-500" tabIndex="0" aria-label="Ayuda bonificación general">
          <svg className="inline w-4 h-4 mr-1 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>
          <span className="text-xs">La bonificación general solo se aplica a ítems sin bonificación particular.</span>
        </span>
      </div>
      <ProveedorCambioModal
        open={proveedorCambio.open}
        proveedores={proveedorCambio.proveedores}
        cantidadExtra={proveedorCambio.cantidadExtra}
        onSelect={handleProveedorCambioSelect}
        onClose={() => setProveedorCambio({ open: false, idx: null, cantidadExtra: 0, proveedores: [], producto: null, proveedorActual: null, nombreProveedorActual: '' })}
        proveedorActual={proveedorCambio.proveedorActual}
        nombreProveedorActual={proveedorCambio.nombreProveedorActual}
        producto={proveedorCambio.producto}
        denominacion={proveedorCambio.denominacion}
        cantidadSolicitada={proveedorCambio.cantidadExtra}
        stockActual={proveedorCambio.proveedores.find(p => p.id === proveedorCambio.proveedorActual)?.stock || 0}
        productosDisponibles={productosDisponibles}
      />
      <div className="overflow-x-auto w-full">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Código</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Denominación</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Unidad</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Cantidad</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Costo</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Bonif. %</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">IVA %</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Proveedor usado</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row, idx) => (
              <tr key={row.id}
                className={isDuplicado(row, idx) ? 'bg-red-50' : ''}>
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    type="text"
                    value={row.codigo}
                    onChange={e => handleRowChange(idx, 'codigo', e.target.value)}
                    onKeyDown={e => handleRowKeyDown(e, idx, 'codigo')}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Código"
                    aria-label="Código producto"
                    tabIndex={0}
                    ref={el => codigoRefs.current[idx] = el}
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {/* Denominación solo lectura */}
                  <div className="w-full px-2 py-1 bg-gray-50 rounded border border-gray-200 text-gray-700 min-h-[38px] flex items-center">
                    {row.denominacion || ''}
                  </div>
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{row.unidad || '-'}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    type="number"
                    value={row.cantidad}
                    onChange={e => handleCantidadChange(idx, e.target.value)}
                    onKeyDown={e => handleRowKeyDown(e, idx, 'cantidad')}
                    min="1"
                    className="w-full px-2 py-1 border rounded border-gray-300"
                    aria-label="Cantidad"
                    tabIndex={0}
                    ref={el => cantidadRefs.current[idx] = el}
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    type="number"
                    value={row.costo}
                    onChange={e => handleRowChange(idx, 'costo', e.target.value)}
                    onKeyDown={e => handleRowKeyDown(e, idx, 'costo')}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    aria-label="Costo"
                    tabIndex={0}
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
                    aria-label="Bonificación particular"
                    tabIndex={0}
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {row.producto ? (
                    <span>{ALICUOTAS[row.producto.idaliiva] !== undefined ? ALICUOTAS[row.producto.idaliiva] + '%' : '-'}</span>
                  ) : '-'}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {/* Proveedor usado (editable) */}
                  {row.producto ? (
                    <select
                      value={row.proveedorId || getProveedoresProducto(row.producto.id)[0]?.id || ''}
                      onChange={e => handleProveedorChange(idx, e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                      aria-label="Proveedor"
                      tabIndex={0}
                    >
                      {getProveedoresProducto(row.producto.id).map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stock})</option>
                      ))}
                    </select>
                  ) : null}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-center flex gap-2 justify-center">
                  {row.producto && (
                    <>
                      <button
                        onClick={() => handleDeleteRow(idx)}
                        className="text-red-600 hover:text-red-800"
                        title="Eliminar"
                        aria-label="Eliminar fila"
                        tabIndex={0}
                        type="button"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                      <BotonDuplicar
                        onClick={() => {
                          // Duplicar la fila
                          setRows(prevRows => {
                            const nuevoItem = { ...row, id: undefined };
                            return [...prevRows.slice(0, idx + 1), nuevoItem, ...prevRows.slice(idx + 1)];
                          });
                        }}
                        tabIndex={0}
                      />
                    </>
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

// NUEVO: Grilla para edición de productos existentes
const ItemsGridEdicion = forwardRef(({
  productosDisponibles,
  proveedores,
  stockProveedores,
  autoSumarDuplicados,
  setAutoSumarDuplicados,
  bonificacionGeneral,
  setBonificacionGeneral,
  modo = 'presupuesto', // solo 'presupuesto' o 'venta'
  onRowsChange,
  initialItems
}, ref) => {
  const autoSumarDuplicadosRef = useRef(autoSumarDuplicados);
  useEffect(() => {
    autoSumarDuplicadosRef.current = autoSumarDuplicados;
  }, [autoSumarDuplicados]);

  const [rows, setRows] = useState(() => {
    if (!Array.isArray(initialItems) || initialItems.length === 0) {
      return [getEmptyRow()];
    }
    return initialItems.map((item, idx) => {
      const producto = item.producto || productosDisponibles.find(p => p.id === (item.vdi_idsto || item.idSto || item.idsto || item.id));
      return {
        id: item.id || Date.now() + idx,
        codigo: item.codigo || producto?.codvta || producto?.codigo || '',
        denominacion: item.denominacion || producto?.deno || producto?.nombre || '',
        unidad: item.unidad || producto?.unidad || producto?.unidadmedida || '-',
        cantidad: item.cantidad || item.vdi_cantidad || 1,
        costo: item.costo || item.precio || (item.vdi_importe !== undefined ? parseFloat(item.vdi_importe) : 0) || 0,
        bonificacion: item.bonificacion || item.vdi_bonifica || 0,
        producto: producto,
        proveedorId: item.proveedorId || item.vdi_idpro || item.idPro || '',
        idaliiva: producto?.idaliiva || item.vdi_idaliiva || null
      };
    });
  });

  const [ultimoIdxAutocompletado, setUltimoIdxAutocompletado] = useState(null);
  const codigoRefs = useRef([]);
  const cantidadRefs = useRef([]);
  const [proveedoresIgnorados, setProveedoresIgnorados] = useState([]);
  const [proveedorCambio, setProveedorCambio] = useState({ open: false, idx: null, cantidadExtra: 0, proveedores: [], producto: null, proveedorActual: null, nombreProveedorActual: '' });
  const [stockNegativo, setStockNegativo] = useState(false);

  const getProveedoresProducto = useCallback((productoId) => {
    if (!stockProveedores || !productoId) return [];
    return (stockProveedores[productoId] || []).map(sp => ({
      id: sp.proveedor.id,
      nombre: sp.proveedor.razon,
      stock: sp.cantidad,
      costo: sp.costo,
      esHabitual: !!(sp.proveedor_habitual || sp.habitual || sp.es_habitual)
    }));
  }, [stockProveedores]);

  const addItemWithDuplicado = useCallback((producto, proveedorId, cantidad = 1) => {
    const idxExistente = rows.findIndex(r => r.producto && r.producto.id === producto.id && r.proveedorId === proveedorId);
    const modoDuplicado = autoSumarDuplicadosRef.current;
    if (idxExistente !== -1) {
      if (modoDuplicado === 'sumar') {
        setRows(rows => rows.map((row, i) => i === idxExistente ? { ...row, cantidad: Number(row.cantidad) + cantidad } : row));
        return;
      }
      if (modoDuplicado === 'eliminar') {
        setRows(rows => rows.filter((_, i) => i !== idxExistente));
        return;
      }
      if (modoDuplicado === 'duplicar') {
        setRows(prevRows => {
          const lastRow = prevRows[prevRows.length - 1];
          const nuevoItem = {
            ...lastRow,
            codigo: producto.codvta || producto.codigo || '',
            denominacion: producto.deno || producto.nombre || '',
            unidad: producto.unidad || producto.unidadmedida || '-',
            costo: getProveedoresProducto(producto.id).find(p => p.id === proveedorId)?.costo || 0,
            cantidad,
            bonificacion: 0,
            producto: producto,
            proveedorId: proveedorId
          };
          return [...prevRows, nuevoItem, getEmptyRow()];
        });
        return;
      }
      // Si no hay acción válida, no hacer nada
      return;
    }
    setRows(prevRows => {
      const lastRow = prevRows[prevRows.length - 1];
      const nuevoItem = {
        ...lastRow,
        codigo: producto.codvta || producto.codigo || '',
        denominacion: producto.deno || producto.nombre || '',
        unidad: producto.unidad || producto.unidadmedida || '-',
        costo: getProveedoresProducto(producto.id).find(p => p.id === proveedorId)?.costo || 0,
        cantidad,
        bonificacion: 0,
        producto: producto,
        proveedorId: proveedorId
      };
      if (!lastRow.producto && !lastRow.codigo) {
        return [...prevRows.slice(0, -1), nuevoItem, getEmptyRow()];
      } else {
        return [...prevRows, nuevoItem, getEmptyRow()];
      }
    });
  }, [rows, autoSumarDuplicadosRef, setRows, getProveedoresProducto]);

  const handleAddItem = useCallback((producto) => {
    if (!producto) return;
    const proveedores = getProveedoresProducto(producto.id);
    const proveedorHabitual = proveedores.find(p => p.esHabitual) || proveedores[0];
    const proveedorId = proveedorHabitual ? proveedorHabitual.id : '';
    const cantidad = 1;
    addItemWithDuplicado(producto, proveedorId, cantidad);
  }, [addItemWithDuplicado, getProveedoresProducto]);

  // Handlers de edición, duplicados, enter, foco, etc. igual que ItemsGridPresupuesto
  const handleRowChange = (idx, field, value) => {
    console.log(`[ItemsGrid] handleRowChange - idx: ${idx}, field: ${field}, value:`, value);
    setRows(prevRows => {
      const newRows = [...prevRows];
      if (field === 'codigo') {
        newRows[idx] = {
          ...newRows[idx],
          codigo: value,
          ...(value.trim() === '' ? { producto: null, denominacion: '', unidad: '', costo: '', cantidad: 1, bonificacion: 0, proveedorId: '' } : {})
        };
        const updatedRows = ensureSoloUnEditable(newRows);
        console.log('[ItemsGrid] handleRowChange (código) - rows actualizadas:', updatedRows);
        onRowsChange?.(updatedRows);
        return updatedRows;
      } else if (field === 'costo' || field === 'bonificacion') {
        newRows[idx] = {
          ...newRows[idx],
          [field]: value
        };
        const updatedRows = ensureSoloUnEditable(newRows);
        console.log(`[ItemsGrid] handleRowChange (${field}) - rows actualizadas:`, updatedRows);
        onRowsChange?.(updatedRows);
        return updatedRows;
      }
      return newRows;
    });
  };

  const handleCantidadChange = (idx, cantidad) => {
    console.log(`[ItemsGrid] handleCantidadChange - idx: ${idx}, cantidad:`, cantidad);
    if (modo === 'presupuesto') {
      setRows(prevRows => {
        const newRows = prevRows.map((row, i) => i === idx ? { ...row, cantidad } : row);
        console.log('[ItemsGrid] handleCantidadChange (presupuesto) - rows actualizadas:', newRows);
        onRowsChange?.(newRows);
        return newRows;
      });
      return;
    }
    setRows(prevRows => {
      const newRows = prevRows.map((row, i) => i === idx ? { ...row, cantidad } : row);
      console.log('[ItemsGrid] handleCantidadChange - rows actualizadas:', newRows);
      onRowsChange?.(newRows);
      return newRows;
    });
    const row = rows[idx];
    const proveedores = getProveedoresProducto(row.producto?.id);
    const proveedor = proveedores.find(p => String(p.id) === String(row.proveedorId));
    let totalStock = proveedor ? Number(proveedor.stock) : 0;
    const totalCantidad = rows.reduce((sum, r, i) => {
      if (r.producto && r.producto.id === row.producto?.id && String(r.proveedorId) === String(row.proveedorId)) {
        return sum + (i === idx ? Number(cantidad) : Number(r.cantidad));
      }
      return sum;
    }, 0);
    if (totalCantidad > totalStock && !proveedoresIgnorados.includes(row.proveedorId)) {
      const cantidadExtra = totalCantidad - totalStock;
      const otrosProveedores = proveedores.filter(p => String(p.id) !== String(row.proveedorId) && p.stock > 0);
      setProveedorCambio({ open: true, idx, cantidadExtra, proveedores: otrosProveedores, producto: row.producto, denominacion: row.denominacion, proveedorActual: row.proveedorId, nombreProveedorActual: proveedor?.nombre || '' });
      setStockNegativo(true);
    } else {
      if (totalCantidad > totalStock) {
        setStockNegativo(true);
      } else {
        setStockNegativo(false);
      }
    }
  };

  const handleRowKeyDown = (e, idx, field) => {
    if ((e.key === 'Enter' || (e.key === 'Tab' && field === 'bonificacion'))) {
      const row = rows[idx];
      if (field === 'codigo' && row.codigo) {
        let prod = productosDisponibles.find(p => (p.codvta || p.codigo)?.toString().toLowerCase() === row.codigo.toLowerCase());
        if (prod) {
          const proveedores = getProveedoresProducto(prod.id);
          const proveedorHabitual = proveedores.find(p => p.esHabitual) || proveedores[0];
          const proveedorId = proveedorHabitual ? proveedorHabitual.id : '';
          const idxExistente = rows.findIndex((r, i) =>
            i !== idx &&
            r.producto &&
            r.producto.id === prod.id &&
            r.proveedorId === proveedorId
          );
          if (idxExistente !== -1) {
            if (autoSumarDuplicados === 'sumar') {
              setRows(rows => {
                const newRows = rows.map((r, i) => i === idxExistente ? { ...r, cantidad: Number(r.cantidad) + Number(row.cantidad) } : r);
                newRows[idx] = getEmptyRow();
                return ensureSoloUnEditable(newRows);
              });
              setUltimoIdxAutocompletado(idxExistente);
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            if (autoSumarDuplicados === 'duplicar') {
              setRows(prevRows => {
                const lastRow = prevRows[prevRows.length - 1];
                const nuevoItem = {
                  ...lastRow,
                  codigo: prod.codvta || prod.codigo || '',
                  denominacion: prod.deno || prod.nombre || '',
                  unidad: prod.unidad || prod.unidadmedida || '-',
                  costo: proveedorHabitual?.costo || 0,
                  cantidad: row.cantidad || 1,
                  bonificacion: 0,
                  producto: prod,
                  proveedorId: proveedorId
                };
                return [...prevRows, nuevoItem, getEmptyRow()];
              });
              setUltimoIdxAutocompletado(rows.length);
              setRows(rows => {
                const newRows = [...rows];
                newRows[idx] = getEmptyRow();
                return ensureSoloUnEditable(newRows);
              });
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          // Si no es duplicado, autocompletar datos y agregar ítem
          setRows(prevRows => {
            const newRows = [...prevRows];
            newRows[idx] = {
              ...newRows[idx],
              codigo: prod.codvta || prod.codigo || '',
              denominacion: prod.deno || prod.nombre || '',
              unidad: prod.unidad || prod.unidadmedida || '-',
              costo: proveedorHabitual?.costo || 0,
              cantidad: row.cantidad || 1,
              bonificacion: 0,
              producto: prod,
              proveedorId: proveedorId
            };
            if (newRows.every(isRowLleno)) {
              newRows.push(getEmptyRow());
            }
            return ensureSoloUnEditable(newRows);
          });
          setUltimoIdxAutocompletado(idx);
          e.preventDefault();
          e.stopPropagation();
          return;
        } else {
          setRows(prevRows => {
            const newRows = [...prevRows];
            newRows[idx] = { ...getEmptyRow(), id: newRows[idx].id };
            return ensureSoloUnEditable(newRows);
          });
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
      if (field === 'cantidad') {
        if (rows[idx].producto && rows[idx].codigo && idx === rows.length - 1) {
          setTimeout(() => {
            if (codigoRefs.current[idx + 1]) codigoRefs.current[idx + 1].focus();
          }, 0);
        }
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  useEffect(() => {
    if (ultimoIdxAutocompletado !== null) {
      if (cantidadRefs.current[ultimoIdxAutocompletado]) {
        cantidadRefs.current[ultimoIdxAutocompletado].focus();
      }
      setUltimoIdxAutocompletado(null);
    }
  }, [rows, ultimoIdxAutocompletado]);

  useEffect(() => {
    if (onRowsChange) {
      console.log('[ItemsGrid] Notificando cambio de rows al padre:', rows);
      onRowsChange(rows);
    }
  }, [rows, onRowsChange]);

  // Helpers duplicados, vacíos, etc.
  function isRowLleno(row) {
    return !!row.producto;
  }
  function isRowVacio(row) {
    return !row.producto && (!row.codigo || row.codigo.trim() === '') && (!row.denominacion || row.denominacion.trim() === '');
  }
  function ensureSoloUnEditable(rows) {
    let result = rows.slice();
    // Eliminar vacíos intermedios
    for (let i = result.length - 2; i >= 0; i--) {
      if (isRowVacio(result[i])) {
        result.splice(i, 1);
      }
    }
    const sinProducto = result.filter(row => !isRowLleno(row));
    if (sinProducto.length > 1) {
      const lastIdx = result.map(row => !isRowLleno(row)).lastIndexOf(true);
      if (lastIdx !== -1) {
        result.splice(lastIdx, 1);
      }
    }
    // Si hay algún renglón sin producto, no agrego otro vacío
    if (result.some(row => !isRowLleno(row))) {
      // Si el último renglón no tiene id, asignar uno único
      const last = result[result.length - 1];
      if (last && !last.id) {
        last.id = Date.now() + Math.random();
      }
      return result;
    }
    // Solo agrego un vacío si todos los renglones tienen producto
    result.push({ ...getEmptyRow(), id: Date.now() + Math.random() });
    return result;
  }
  function getDuplicadoMap() {
    const map = {};
    rows.forEach((row, idx) => {
      if (!row.producto || !row.proveedorId) return;
      const key = `${row.producto.id}_${row.proveedorId}`;
      if (!map[key]) map[key] = [];
      map[key].push(idx);
    });
    return map;
  }
  const duplicadoMap = getDuplicadoMap();
  function isDuplicado(row, idx) {
    if (!row.producto || !row.proveedorId) return false;
    const key = `${row.producto.id}_${row.proveedorId}`;
    return duplicadoMap[key] && duplicadoMap[key].length > 1 && duplicadoMap[key].indexOf(idx) !== 0;
  }

  // Add missing handlers
  const handleProveedorChange = (idx, proveedorId) => {
    console.log(`[ItemsGrid] handleProveedorChange - idx: ${idx}, proveedorId:`, proveedorId);
    setRows(prevRows => {
      const newRows = prevRows.map((row, i) => {
        if (i !== idx) return row;
        const productoId = row.producto?.id;
        const proveedores = getProveedoresProducto(productoId);
        const proveedor = proveedores.find(p => String(p.id) === String(proveedorId));
        let nuevoCosto = proveedor ? proveedor.costo : 0;
        console.log(`[ItemsGrid] handleProveedorChange - nuevo costo para item ${idx}:`, nuevoCosto);
        return { ...row, proveedorId, costo: nuevoCosto };
      });
      console.log('[ItemsGrid] handleProveedorChange - rows actualizadas:', newRows);
      onRowsChange?.(newRows);
      return newRows;
    });
  };

  const handleDeleteRow = (idx) => {
    setRows(rows => {
      const newRows = rows.filter((_, i) => i !== idx);
      onRowsChange?.(newRows);
      if (newRows.filter(r => r.producto && r.codigo).length === 0) {
        return [getEmptyRow()];
      }
      const last = newRows[newRows.length - 1];
      if (last && last.producto) {
        return [...newRows, getEmptyRow()];
      }
      return newRows;
    });
  };

  useImperativeHandle(ref, () => ({
    handleAddItem,
    getItems: () => rows.filter(r => r.producto && (r.codigo || r.producto.id)).map((row, idx) => {
      const cantidad = parseFloat(row.cantidad) || 0;
      const costo = parseFloat(row.costo) || 0;
      const bonif = parseFloat(row.bonificacion) || 0;
      const item = {
        vdi_orden: idx + 1,
        vdi_idsto: row.producto.id,
        vdi_idpro: row.proveedorId,
        vdi_cantidad: cantidad,
        vdi_importe: costo,
        vdi_bonifica: bonif,
        vdi_detalle1: row.denominacion || '',
        vdi_detalle2: row.unidad || '',
        vdi_idaliiva: row.producto.idaliiva || row.idaliiva || 0,
        alicuotaIva: undefined,
        codigo: row.codigo || String(row.producto.id),
        producto: row.producto,
        proveedorId: row.proveedorId
      };
      return item;
    }),
  }), [rows, handleAddItem]);

  // Render igual que ItemsGridPresupuesto
  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-4 mb-2">
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
        <span className="ml-4 text-gray-500" tabIndex="0" aria-label="Ayuda bonificación general">
          <svg className="inline w-4 h-4 mr-1 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>
          <span className="text-xs">La bonificación general solo se aplica a ítems sin bonificación particular.</span>
        </span>
      </div>
      <div className="overflow-x-auto w-full">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Código</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Denominación</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Unidad</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Cantidad</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Costo</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Bonif. %</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">IVA %</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Proveedor usado</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row, idx) => (
              <tr key={row.id}
                className={isDuplicado(row, idx) ? 'bg-red-50' : ''}>
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    type="text"
                    value={row.codigo}
                    onChange={e => handleRowChange(idx, 'codigo', e.target.value)}
                    onKeyDown={e => handleRowKeyDown(e, idx, 'codigo')}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Código"
                    aria-label="Código producto"
                    tabIndex={0}
                    ref={el => codigoRefs.current[idx] = el}
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {/* Denominación solo lectura */}
                  <div className="w-full px-2 py-1 bg-gray-50 rounded border border-gray-200 text-gray-700 min-h-[38px] flex items-center">
                    {row.denominacion || ''}
                  </div>
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{row.unidad || '-'}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    type="number"
                    value={row.cantidad}
                    onChange={e => handleCantidadChange(idx, e.target.value)}
                    onKeyDown={e => handleRowKeyDown(e, idx, 'cantidad')}
                    min="1"
                    className="w-full px-2 py-1 border rounded border-gray-300"
                    aria-label="Cantidad"
                    tabIndex={0}
                    ref={el => cantidadRefs.current[idx] = el}
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    type="number"
                    value={row.costo}
                    onChange={e => handleRowChange(idx, 'costo', e.target.value)}
                    onKeyDown={e => handleRowKeyDown(e, idx, 'costo')}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    aria-label="Costo"
                    tabIndex={0}
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
                    aria-label="Bonificación particular"
                    tabIndex={0}
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {row.producto ? (
                    <span>{ALICUOTAS[row.producto.idaliiva] !== undefined ? ALICUOTAS[row.producto.idaliiva] + '%' : '-'}</span>
                  ) : '-'}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {/* Proveedor usado (editable) */}
                  {row.producto ? (
                    <select
                      value={row.proveedorId || getProveedoresProducto(row.producto.id)[0]?.id || ''}
                      onChange={e => handleProveedorChange(idx, e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                      aria-label="Proveedor"
                      tabIndex={0}
                    >
                      {getProveedoresProducto(row.producto.id).map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stock})</option>
                      ))}
                    </select>
                  ) : null}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-center flex gap-2 justify-center">
                  {row.producto && (
                    <>
                      <button
                        onClick={() => handleDeleteRow(idx)}
                        className="text-red-600 hover:text-red-800"
                        title="Eliminar"
                        aria-label="Eliminar fila"
                        tabIndex={0}
                        type="button"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                      <BotonDuplicar
                        onClick={() => {
                          setRows(prevRows => {
                            const nuevoItem = { ...row, id: undefined };
                            return [...prevRows.slice(0, idx + 1), nuevoItem, ...prevRows.slice(idx + 1)];
                          });
                        }}
                        tabIndex={0}
                      />
                    </>
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
export { ItemsGridEdicion };