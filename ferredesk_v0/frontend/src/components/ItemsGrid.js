import React, { useState, useImperativeHandle, forwardRef, useRef } from 'react';
import { BotonExpandir } from './Botones';

const MIN_ROWS = 5;

function getEmptyRow() {
  return { codigo: '', denominacion: '', unidad: '', cantidad: 1, costo: '', bonificacion: 0, producto: null };
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

const ProveedorCambioModal = ({ open, proveedores, onSelect, onClose, cantidadExtra }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">Stock insuficiente</h3>
        <p className="mb-4">La cantidad supera el stock del proveedor seleccionado. Selecciona un nuevo proveedor para los <b>{cantidadExtra}</b> ítems extra:</p>
        <select className="w-full mb-4 px-2 py-1 border rounded" onChange={e => onSelect(e.target.value)}>
          <option value="">Seleccionar proveedor</option>
          {proveedores.map(p => (
            <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stock}, Costo: {p.costo})</option>
          ))}
        </select>
        <button onClick={onClose} className="mt-2 text-gray-500 hover:text-black">Cancelar</button>
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
}, ref) => {
  const esPresupuesto = modo === 'presupuesto';
  const [rows, setRows] = useState([getEmptyRow()]);
  const [stockNegativo, setStockNegativo] = useState(false);
  const [stockAlert, setStockAlert] = useState("");
  const [duplicadoModal, setDuplicadoModal] = useState({ open: false, idx: null, producto: null, proveedor: null, action: null });
  const [toastMsg, setToastMsg] = useState("");
  const toastTimeout = useRef(null);
  const [proveedorCambio, setProveedorCambio] = useState({ open: false, idx: null, cantidadExtra: 0, proveedores: [], producto: null });

  // Eliminar la checkbox y el modal de duplicado, y simplificar la lógica de duplicados
  // ... existing code ...
  // handleAddItem: solo delega a addItemWithDuplicado
  const handleAddItem = (producto) => {
    const proveedores = getProveedoresProducto(producto.id);
    const proveedorHabitual = proveedores.find(p => p.esHabitual) || proveedores[0];
    const proveedorId = proveedorHabitual ? proveedorHabitual.id : '';
    addItemWithDuplicado(producto, proveedorId, 1);
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

  // Exponer método para obtener los ítems cargados
  useImperativeHandle(ref, () => ({
    getItems: () => rows.filter(r => r.producto && r.codigo).map((row, idx) => ({
      vdi_orden: idx + 1,
      vdi_idsto: row.producto.id,
      vdi_idpro: row.proveedorId,
      vdi_cantidad: parseFloat(row.cantidad) || 0,
      vdi_importe: parseFloat(row.costo) || 0,
      vdi_bonifica: parseFloat(row.bonificacion) || 0,
      vdi_detalle1: row.denominacion || '',
      vdi_detalle2: row.unidad || '',
      vdi_idaliiva: row.producto.idaliiva || 0
    })),
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
    // Validar stock sumando todas las filas con ese producto/proveedor
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
    if (totalCantidad > totalStock && !stockNegativo) {
      const cantidadExtra = totalCantidad - totalStock;
      const otrosProveedores = proveedores.filter(p => String(p.id) !== String(proveedorId) && p.stock > 0);
      setProveedorCambio({ open: true, idx, cantidadExtra, proveedores: otrosProveedores, producto: row.producto });
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
    // Sumar la cantidad total de ese producto/proveedor en todas las filas
    const totalCantidad = rows.reduce((sum, r, i) => {
      if (r.producto && r.producto.id === row.producto?.id && String(r.proveedorId) === String(row.proveedorId)) {
        return sum + (i === idx ? Number(cantidad) : Number(r.cantidad));
      }
      return sum;
    }, 0);
    if (totalCantidad > totalStock && !stockNegativo) {
      // Abrir modal para elegir nuevo proveedor para los ítems extra
      const cantidadExtra = totalCantidad - totalStock;
      const otrosProveedores = proveedores.filter(p => String(p.id) !== String(row.proveedorId) && p.stock > 0);
      setProveedorCambio({ open: true, idx, cantidadExtra, proveedores: otrosProveedores, producto: row.producto });
    }
    if (totalCantidad > totalStock) {
      setStockNegativo(true);
      setStockAlert("El stock total se ha agotado. Si continúas, el conteo será negativo.");
    } else {
      setStockNegativo(false);
      setStockAlert("");
    }
  };

  // Acción al seleccionar nuevo proveedor en el modal
  const handleProveedorCambioSelect = (proveedorId) => {
    setRows(rows => {
      const { idx, cantidadExtra, producto } = proveedorCambio;
      const lastRow = rows[rows.length - 1];
      const proveedores = getProveedoresProducto(producto.id);
      const proveedorNuevo = proveedores.find(p => String(p.id) === String(proveedorId));
      // Actualiza la fila original con el stock máximo del proveedor original
      const updatedRows = rows.map((row, i) => i === idx ? { ...row, cantidad: proveedorNuevo ? proveedorNuevo.stock : row.cantidad } : row);
      // Verificar si ya existe un renglón para este producto y proveedor
      const idxExistente = updatedRows.findIndex(r => r.producto && r.producto.id === producto.id && r.proveedorId === proveedorId);
      if (idxExistente !== -1) {
        // Sumar cantidades en el renglón existente
        return updatedRows.map((row, i) => i === idxExistente ? { ...row, cantidad: Number(row.cantidad) + cantidadExtra } : row);
      } else {
        // Agrega nueva fila con el proveedor nuevo y la cantidad extra
        const nuevoItem = {
          ...lastRow,
          codigo: producto.codvta || producto.codigo || '',
          denominacion: producto.deno || producto.nombre || '',
          unidad: producto.unidad || producto.unidadmedida || '-',
          costo: proveedorNuevo?.costo || 0,
          cantidad: cantidadExtra,
          bonificacion: 0,
          producto: producto,
          proveedorId: proveedorId
        };
        return [...updatedRows, nuevoItem, getEmptyRow()];
      }
    });
    setProveedorCambio({ open: false, idx: null, cantidadExtra: 0, proveedores: [], producto: null });
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

  // Cálculo de subtotal y bonificaciones
  const getSubtotal = (row) => {
    const cantidad = parseFloat(row.cantidad) || 0;
    const costo = parseFloat(row.costo) || 0;
    const bonifParticular = parseFloat(row.bonificacion) || 0;
    // Bonificación particular primero
    return (costo * cantidad) * (1 - bonifParticular / 100);
  };

  // Cálculo de totales considerando bonificación general solo a ítems sin bonif particular
  const getTotal = () => {
    let total = 0;
    rows.forEach(row => {
      if (row.producto && row.codigo) {
        const bonifParticular = parseFloat(row.bonificacion) || 0;
        let subtotal = getSubtotal(row);
        // Si bonif particular es 0, aplicar bonif general
        if (bonifParticular === 0 && bonificacionGeneral > 0) {
          subtotal = subtotal * (1 - bonificacionGeneral / 100);
        }
        total += subtotal;
      }
    });
    return total;
  };

  // handleRowChange: al escribir código o denominación, si ambos quedan vacíos y no es el primer renglón, eliminar el renglón
  const handleRowChange = (idx, field, value) => {
    setRows(rows => {
      // Si borra código y denominación, eliminar el renglón (excepto el primero)
      if ((field === 'codigo' || field === 'denominacion') && value === '') {
        const row = rows[idx];
        const otroCampo = field === 'codigo' ? row.denominacion : row.codigo;
        if (otroCampo === '' && idx > 0) {
          return rows.filter((_, i) => i !== idx);
        }
      }
      return rows.map((row, i) => {
        if (i !== idx) return row;
        if (field === 'codigo' || field === 'denominacion') {
          let prod = null;
          if (field === 'codigo') {
            prod = productosDisponibles.find(p => (p.codvta || p.codigo)?.toString().toLowerCase() === value.toLowerCase());
          } else if (field === 'denominacion') {
            prod = productosDisponibles.find(p => (p.deno || p.nombre)?.toLowerCase() === value.toLowerCase());
          }
          if (prod) {
            const proveedores = getProveedoresProducto(prod.id);
            const proveedorHabitual = proveedores.find(p => p.esHabitual) || proveedores[0];
            const proveedorId = proveedorHabitual ? proveedorHabitual.id : '';
            // Duplicado: si sumar, sumar y limpiar este renglón
            const idxExistente = rows.findIndex(r => r.producto && r.producto.id === prod.id && r.proveedorId === proveedorId);
            if (autoSumarDuplicados === 'sumar' && idxExistente !== -1 && idxExistente !== idx) {
              return null; // marcar para limpiar
            }
            return {
              ...row,
              codigo: prod.codvta || prod.codigo || '',
              denominacion: prod.deno || prod.nombre || '',
              unidad: prod.unidad || prod.unidadmedida || '-',
              costo: proveedorHabitual?.costo || 0,
              cantidad: 1,
              bonificacion: 0,
              producto: prod,
              proveedorId: proveedorId
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
      }).filter((row, i, arr) => row !== null || i === arr.length - 1); // limpiar nulos salvo el último
    });
    // Si sumar cantidades, sumar y limpiar
    if (field === 'codigo' || field === 'denominacion') {
      let prod = null;
      if (field === 'codigo') {
        prod = productosDisponibles.find(p => (p.codvta || p.codigo)?.toString().toLowerCase() === value.toLowerCase());
      } else if (field === 'denominacion') {
        prod = productosDisponibles.find(p => (p.deno || p.nombre)?.toLowerCase() === value.toLowerCase());
      }
      if (prod) {
        const proveedores = getProveedoresProducto(prod.id);
        const proveedorHabitual = proveedores.find(p => p.esHabitual) || proveedores[0];
        const proveedorId = proveedorHabitual ? proveedorHabitual.id : '';
        const idxExistente = rows.findIndex(r => r.producto && r.producto.id === prod.id && r.proveedorId === proveedorId);
        if (autoSumarDuplicados === 'sumar' && idxExistente !== -1 && idxExistente !== idx) {
          setRows(rows => rows.map((row, i) => i === idxExistente ? { ...row, cantidad: Number(row.cantidad) + 1 } : row).filter((_, i) => i !== idx));
        }
      }
    }
  };

  // handleRowKeyDown: solo agrega renglón vacío si el actual tiene datos
  const handleRowKeyDown = (e, idx, field) => {
    if ((e.key === 'Enter' || (e.key === 'Tab' && field === 'bonificacion'))) {
      // Solo si el renglón tiene datos, agregar uno nuevo
      if (rows[idx].producto && rows[idx].codigo) {
        e.preventDefault();
        e.stopPropagation();
        if (idx === rows.length - 1) {
          const lastRow = rows[rows.length - 1];
          if (lastRow.codigo || lastRow.denominacion || lastRow.producto) {
            setRows(rows => [...rows, getEmptyRow()]);
          }
        }
      }
      // Si el renglón está vacío, no hacer nada
    }
  };

  // Validación visual de cantidad vs stock: desactivada en presupuesto
  const isCantidadInvalida = (row) => {
    if (esPresupuesto) return false;
    if (!row.producto || !row.proveedorId) return false;
    const proveedores = getProveedoresProducto(row.producto.id);
    const proveedor = proveedores.find(p => String(p.id) === String(row.proveedorId));
    if (!proveedor) return false;
    return Number(row.cantidad) > Number(proveedor.stock) && !stockNegativo;
  };

  // Limpiar renglones vacíos extra
  const limpiarRenglonesVacios = () => {
    setRows(rows => {
      const llenos = rows.filter(r => r.producto && r.codigo);
      return llenos.length === 0 ? [getEmptyRow()] : [...llenos, getEmptyRow()];
    });
  };

  // isDuplicado: solo marcar el duplicado, no el original
  const isDuplicado = (row, idx) => {
    if (!row.producto || !row.proveedorId) return false;
    return rows.findIndex((r, i) => r.producto && r.producto.id === row.producto.id && r.proveedorId === row.proveedorId) !== idx;
  };

  return (
    <div className="space-y-4">
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
        onClose={() => setProveedorCambio({ open: false, idx: null, cantidadExtra: 0, proveedores: [], producto: null })}
      />
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
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Proveedor habitual</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Proveedor usado</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row, idx) => (
              <tr key={`row-${idx}`}
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
                    aria-label="Denominación producto"
                    tabIndex={0}
                  />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{row.unidad || '-'}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <input
                    type="number"
                    value={row.cantidad}
                    onChange={e => handleCantidadChange(idx, e.target.value)}
                    onKeyDown={e => handleRowKeyDown(e, idx, 'cantidad')}
                    min="1"
                    className={`w-full px-2 py-1 border rounded ${isCantidadInvalida(row) ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    aria-label="Cantidad"
                    tabIndex={0}
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
                  {/* Proveedor habitual solo lectura */}
                  {row.producto ? (
                    <span>{getProveedoresProducto(row.producto.id).find(p => p.esHabitual)?.nombre}</span>
                  ) : null}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {/* Proveedor usado (editable) */}
                  {row.producto ? (
                    <select
                      value={row.proveedorId || ''}
                      onChange={e => handleProveedorChange(idx, e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                      aria-label="Proveedor"
                      tabIndex={0}
                    >
                      <option value="">Seleccionar proveedor</option>
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
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          // Duplicar la fila
                          setRows(prevRows => {
                            const nuevoItem = { ...row, id: undefined };
                            return [...prevRows.slice(0, idx + 1), nuevoItem, ...prevRows.slice(idx + 1)];
                          });
                        }}
                        className="text-blue-600 hover:text-blue-800"
                        title="Duplicar fila"
                        aria-label="Duplicar fila"
                        tabIndex={0}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75v10.5m7.5-10.5v10.5M3.75 9.75h16.5m-16.5 4.5h16.5" />
                        </svg>
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {stockNegativo && (
        <div className="text-red-600 font-semibold mt-2">{stockAlert} <br />
          <label className="inline-flex items-center mt-2">
            <input type="checkbox" checked={stockNegativo} readOnly className="mr-2" />
            Permitir stock negativo
          </label>
        </div>
      )}
      <div className="mt-4 text-right font-bold text-lg">
        Total: ${getTotal().toFixed(2)}
      </div>
    </div>
  );
});

export function ItemsGridVenta(props, ref) {
  return <ItemsGridPresupuesto {...props} ref={ref} />;
}

export default ItemsGridPresupuesto; 