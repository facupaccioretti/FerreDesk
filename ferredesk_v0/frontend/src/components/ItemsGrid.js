import React, { useState, useImperativeHandle, forwardRef, useRef, useEffect } from 'react';
import { BotonExpandir, BotonDuplicar } from './Botones';

const MIN_ROWS = 5;

// Diccionario de alícuotas según la tabla proporcionada
const ALICUOTAS = {
  1: '0', // NO GRAVADO
  2: '0', // EXENTO
  3: '0', // 0%
  4: '10.5',
  5: '21',
  6: '27'
};

function getEmptyRow() {
  return { id: Date.now() + Math.random(), codigo: '', denominacion: '', unidad: '', cantidad: 1, costo: '', bonificacion: 0, producto: null };
}

const Toast = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed top-6 right-6 z-50 bg-yellow-200 text-yellow-900 px-4 py-2 rounded shadow-lg animate-fade-in">
      {message}
      <button onClick={onClose} className="ml-4 text-yellow-900 font-bold">&times;</button>
    </div>
  );
};

const DuplicadoModal = ({ open, onClose, onSumar, onDuplicar, onEliminar, producto, proveedor }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">Producto duplicado</h3>
        <p className="mb-4">El producto <b>{producto?.deno || producto?.nombre}</b> con el proveedor <b>{proveedor?.razon}</b> ya está en la grilla. ¿Qué desea hacer?</p>
        <div className="flex flex-col gap-2">
          <button onClick={onSumar} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Sumar cantidades</button>
          <button onClick={onDuplicar} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Crear duplicado</button>
          <button onClick={onEliminar} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Eliminar carga</button>
        </div>
        <button onClick={onClose} className="mt-4 text-gray-500 hover:text-black">Cancelar</button>
      </div>
    </div>
  );
};

const ProveedorCambioModal = ({ open, proveedores, onSelect, onClose, cantidadExtra, proveedorActual, nombreProveedorActual }) => {
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState('');
  if (!open) return null;
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
  onRowsChange
}, ref) => {
  const esPresupuesto = modo === 'presupuesto';
  const [rows, setRows] = useState([getEmptyRow()]);
  const [stockNegativo, setStockNegativo] = useState(false);
  const [stockAlert, setStockAlert] = useState("");
  const [duplicadoModal, setDuplicadoModal] = useState({ open: false, idx: null, producto: null, proveedor: null, action: null });
  const [toastMsg, setToastMsg] = useState("");
  const toastTimeout = useRef(null);
  const [proveedorCambio, setProveedorCambio] = useState({ open: false, idx: null, cantidadExtra: 0, proveedores: [], producto: null, proveedorActual: null, nombreProveedorActual: '' });
  const codigoRefs = useRef([]);
  const cantidadRefs = useRef([]);
  const [ultimoIdxAutocompletado, setUltimoIdxAutocompletado] = useState(null);
  const [pendingAddItem, setPendingAddItem] = useState(null);
  const [proveedoresIgnorados, setProveedoresIgnorados] = useState([]);

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
    // Si hay más de un renglón sin producto, eliminar el último
    const sinProducto = result.filter(row => !isRowLleno(row));
    if (sinProducto.length > 1) {
      // Eliminar el último sin producto
      const lastIdx = result.map(row => !isRowLleno(row)).lastIndexOf(true);
      if (lastIdx !== -1) {
        result.splice(lastIdx, 1);
      }
    }
    // Si hay algún renglón sin producto, no agrego otro vacío
    if (result.some(row => !isRowLleno(row))) {
      return result;
    }
    // Solo agrego un vacío si todos los renglones tienen producto
    result.push(getEmptyRow());
    return result;
  }

  const handleRowChange = (idx, field, value) => {
    setRows(prevRows => {
      let rows = [...prevRows];
      if (field === 'codigo') {
        // Solo actualizar el valor del input, sin buscar ni autocompletar
        rows[idx] = {
          ...rows[idx],
          codigo: value,
          // Limpiar datos autocompletados si el usuario borra el código
          ...(value.trim() === '' ? { producto: null, denominacion: '', unidad: '', costo: '', cantidad: 1, bonificacion: 0, proveedorId: '' } : {})
        };
        return ensureSoloUnEditable(rows);
      } else if (field === 'costo' || field === 'bonificacion') {
        rows[idx] = {
          ...rows[idx],
          [field]: value
        };
        return ensureSoloUnEditable(rows);
      }
      return rows;
    });
  };

  const handleAddItem = (producto) => {
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
        proveedorActual: proveedorId,
        nombreProveedorActual: proveedor?.nombre || ''
      });
      // Guardar el producto y proveedor temporalmente para agregar después según la decisión
      setPendingAddItem({ producto, proveedorId, cantidad });
      return;
    }
    addItemWithDuplicado(producto, proveedorId, cantidad);
  };

  // Simplificar addItemWithDuplicado: nunca mostrar modal, solo aplicar acción por defecto
  const addItemWithDuplicado = (producto, proveedorId, cantidad = 1) => {
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
  };

  // Exponer método para obtener los ítems cargados y si se permite stock negativo
  useImperativeHandle(ref, () => ({
    getItems: () => rows.filter(r => r.producto && r.codigo).map((row, idx) => {
      const cantidad = parseFloat(row.cantidad) || 0;
      const costo = parseFloat(row.costo) || 0;
      const bonif = parseFloat(row.bonificacion) || 0;
      const importeTotal = (costo * cantidad) * (1 - bonif / 100);
      return {
        vdi_orden: idx + 1,
        vdi_idsto: row.producto.id,
        vdi_idpro: row.proveedorId,
        vdi_cantidad: cantidad,
        vdi_importe: importeTotal,
        vdi_bonifica: bonif,
        vdi_detalle1: row.denominacion || '',
        vdi_detalle2: row.unidad || '',
        vdi_idaliiva: row.producto.idaliiva || 0
      };
    }),
    getStockNegativo: () => stockNegativo,
    handleAddItem,
  }), [rows, stockNegativo, handleAddItem]);

  // Helper para obtener proveedores y stock de un producto
  const getProveedoresProducto = (productoId) => {
    if (!stockProveedores || !productoId) return [];
    return (stockProveedores[productoId] || []).map(sp => ({
      id: sp.proveedor.id,
      nombre: sp.proveedor.razon,
      stock: sp.cantidad,
      costo: sp.costo,
      esHabitual: !!(sp.proveedor_habitual || sp.habitual || sp.es_habitual)
    }));
  };

  // Actualizar costo automáticamente al cambiar proveedor
  const handleProveedorChange = (idx, proveedorId) => {
    setRows(rows => rows.map((row, i) => {
      if (i !== idx) return row;
      const productoId = row.producto?.id;
      const proveedores = getProveedoresProducto(productoId);
      const proveedor = proveedores.find(p => String(p.id) === String(proveedorId));
      let nuevoCosto = proveedor ? proveedor.costo : 0;
      if (proveedor && proveedor.esHabitual === false) {
        if (toastTimeout.current) clearTimeout(toastTimeout.current);
        toastTimeout.current = setTimeout(() => setToastMsg(""), 3500);
      }
      return { ...row, proveedorId, costo: nuevoCosto };
    }));
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
      setProveedorCambio({ open: true, idx, cantidadExtra, proveedores: otrosProveedores, producto: row.producto, proveedorActual: row.proveedorId, nombreProveedorActual: proveedor?.nombre || '' });
    }
    if (totalCantidad > totalStock) {
      setStockNegativo(true);
      setStockAlert("El stock total se ha agotado. Si continúas, el conteo será negativo.");
    } else {
      setStockNegativo(false);
      setStockAlert("");
    }
  };

  // handleCantidadChange: Si es presupuesto, solo setea cantidad, sin alertas ni modales
  const handleCantidadChange = (idx, cantidad) => {
    if (esPresupuesto) {
      setRows(rows => rows.map((row, i) => i === idx ? { ...row, cantidad } : row));
      return;
    }
    setRows(rows => rows.map((row, i) => i === idx ? { ...row, cantidad } : row));
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
      setProveedorCambio({ open: true, idx, cantidadExtra, proveedores: otrosProveedores, producto: row.producto, proveedorActual: row.proveedorId, nombreProveedorActual: proveedor?.nombre || '' });
      setStockNegativo(true);
      setStockAlert("El stock total se ha agotado. Si continúas, el conteo será negativo.");
    } else {
      if (totalCantidad > totalStock) {
        setStockNegativo(true);
        setStockAlert("El stock total se ha agotado. Si continúas, el conteo será negativo.");
      } else {
        setStockNegativo(false);
        setStockAlert("");
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
    setProveedorCambio({ open: false, idx: null, cantidadExtra: 0, proveedores: [], producto: null, proveedorActual: null, nombreProveedorActual: '' });
    if (permitirNegativo) setStockNegativo(true);
    setProveedoresIgnorados(prev => [...prev, proveedorId]);
  };

  // Acciones del modal de duplicado
  const handleSumarDuplicado = () => {
    setRows(rows => rows.map((row, i) => i === duplicadoModal.idx ? { ...row, cantidad: Number(row.cantidad) + 1 } : row));
    setDuplicadoModal({ open: false, idx: null, producto: null, proveedor: null });
  };
  const handleCrearDuplicado = () => {
    setRows(prevRows => {
      const lastRow = prevRows[prevRows.length - 1];
      const nuevoItem = {
        ...lastRow,
        codigo: duplicadoModal.producto.codvta || duplicadoModal.producto.codigo || '',
        denominacion: duplicadoModal.producto.deno || duplicadoModal.producto.nombre || '',
        unidad: duplicadoModal.producto.unidad || duplicadoModal.producto.unidadmedida || '-',
        costo: duplicadoModal.proveedor?.costo || duplicadoModal.producto.precio || duplicadoModal.producto.preciovta || duplicadoModal.producto.preciounitario || '',
        cantidad: 1,
        bonificacion: 0,
        producto: duplicadoModal.producto,
        proveedorId: duplicadoModal.proveedor?.id || ''
      };
      return [...prevRows, nuevoItem, getEmptyRow()];
    });
    setDuplicadoModal({ open: false, idx: null, producto: null, proveedor: null });
  };
  const handleEliminarDuplicado = () => {
    setRows(rows => rows.filter((_, i) => i !== duplicadoModal.idx));
    setDuplicadoModal({ open: false, idx: null, producto: null, proveedor: null });
  };

  // Eliminar ítem y dejar solo un renglón vacío si no quedan ítems
  const handleDeleteRow = (idx) => {
    setRows(rows => {
      const newRows = rows.filter((_, i) => i !== idx);
      // Si no quedan ítems, dejar solo un renglón vacío
      if (newRows.filter(r => r.producto && r.codigo).length === 0) {
        return [getEmptyRow()];
      }
      // Si el último renglón no está vacío, aseguramos uno vacío al final
      const last = newRows[newRows.length - 1];
      if (last && last.producto) {
        return [...newRows, getEmptyRow()];
      }
      return newRows;
    });
  };

  // Resaltar la fila si el stock es negativo para ese proveedor
  const isCantidadInvalida = (row) => {
    if (esPresupuesto) return false;
    if (!row.producto || !row.proveedorId) return false;
    const proveedores = getProveedoresProducto(row.producto.id);
    const proveedor = proveedores.find(p => String(p.id) === String(row.proveedorId));
    if (!proveedor) return false;
    return Number(row.cantidad) > Number(proveedor.stock);
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
    if (onRowsChange) onRowsChange(rows);
  }, [rows]);

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
                    <span>{ALICUOTAS[row.producto.idaliiva] ? ALICUOTAS[row.producto.idaliiva] + '%' : '-'}</span>
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

export function ItemsGridVenta(props, ref) {
  return <ItemsGridPresupuesto {...props} ref={ref} />;
}

export default ItemsGridPresupuesto; 