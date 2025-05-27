import React, { useState, useEffect } from 'react';
import { useStockProveAPI, useStockProveEditAPI } from '../utils/useStockProveAPI';
import { useAlicuotasIVAAPI } from '../utils/useAlicuotasIVAAPI';
import AsociarCodigoProveedorModal from './AsociarCodigoProveedorModal';

// Función para obtener el token CSRF de la cookie
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

const StockForm = ({ stock, onSave, onCancel, proveedores, familias, modo }) => {
  // Estado principal del formulario
  const [form, setForm] = useState(() => {
    if (modo === 'nuevo') {
      const savedForm = localStorage.getItem('stockFormDraft');
      if (savedForm && !stock) {
        return JSON.parse(savedForm);
      }
      return stock || {
        codvta: '', codcom: '', deno: '', unidad: '', cantmin: 0, proveedor_habitual_id: '', idfam1: null, idfam2: null, idfam3: null, idaliiva: '', id: undefined
      };
    } else {
      // Siempre incluir el id del stock en el form
      return stock ? { ...stock, id: stock.id } : {
        codvta: '', codcom: '', deno: '', unidad: '', cantmin: 0, proveedor_habitual_id: '', idfam1: null, idfam2: null, idfam3: null, idaliiva: '', id: undefined
      };
    }
  });

  // Estado para stock y códigos pendientes SOLO en modo nuevo
  const [stockProvePendientes, setStockProvePendientes] = useState(modo === 'nuevo' ? [] : []);
  const [codigosPendientes, setCodigosPendientes] = useState(modo === 'nuevo' ? [] : []);

  const [newStockProve, setNewStockProve] = useState({
    stock: stock?.id || '',
    proveedor: '',
    cantidad: '',
    costo: ''
  });

  const stockProveAPI = useStockProveAPI();
  const stockProveEditAPI = useStockProveEditAPI();
  const isEdicion = !!stock?.id;
  const {
    stockProve,
    addStockProve,
    updateStockProve,
    fetchStockProve
  } = isEdicion ? stockProveEditAPI : stockProveAPI;

  const { alicuotas } = useAlicuotasIVAAPI();

  const [formError, setFormError] = useState(null);
  const [permitirCostoManual, setPermitirCostoManual] = useState(false);
  const [showAsociarModal, setShowAsociarModal] = useState(false);
  const [cargarPrecioManual, setCargarPrecioManual] = useState(false);
  const [editandoCantidadId, setEditandoCantidadId] = useState(null);
  const [nuevaCantidad, setNuevaCantidad] = useState('');

  // Array de códigos pendientes solo para edición
  const [codigosPendientesEdicion, setCodigosPendientesEdicion] = useState([]);

  useEffect(() => {
    if (stock) {
      // Construir stock_proveedores para edición con solo proveedor_id
      const stockProveedores = stock.stock_proveedores && stock.stock_proveedores.length > 0
        ? stock.stock_proveedores.map(sp => ({
            ...sp,
            proveedor_id: sp.proveedor_id || (sp.proveedor && (sp.proveedor.id || sp.proveedor))
          }))
        : stockProve
            .filter(sp => sp.stock === stock.id)
            .map(sp => ({
              proveedor_id: sp.proveedor?.id || sp.proveedor,
              cantidad: sp.cantidad,
              costo: sp.costo,
              codigo_producto_proveedor: sp.codigo_producto_proveedor || ''
            }));

      setForm({
        codvta: stock.codvta || '',
        codcom: stock.codcom || '',
        deno: stock.deno || '',
        unidad: stock.unidad || '',
        cantmin: stock.cantmin || 0,
        proveedor_habitual_id:
          stock.proveedor_habitual && typeof stock.proveedor_habitual === 'object'
            ? String(stock.proveedor_habitual.id)
            : stock.proveedor_habitual && typeof stock.proveedor_habitual === 'string'
              ? stock.proveedor_habitual
              : '',
        idfam1: stock.idfam1 && typeof stock.idfam1 === 'object'
          ? stock.idfam1.id
          : stock.idfam1 ?? null,
        idfam2: stock.idfam2 && typeof stock.idfam2 === 'object'
          ? stock.idfam2.id
          : stock.idfam2 ?? null,
        idfam3: stock.idfam3 && typeof stock.idfam3 === 'object'
          ? stock.idfam3.id
          : stock.idfam3 ?? null,
        idaliiva: stock.idaliiva && typeof stock.idaliiva === 'object'
          ? stock.idaliiva.id
          : stock.idaliiva ?? '',
        id: stock.id,
        stock_proveedores: stockProveedores // Agregamos stock_proveedores al form
      });
      setNewStockProve(prev => ({ ...prev, stock: stock.id }));
    }
  }, [stock, stockProve]);

  useEffect(() => {
    if (modo === 'nuevo' && !stock) {
      localStorage.setItem('stockFormDraft', JSON.stringify(form));
    }
  }, [form, stock, modo]);

  useEffect(() => {
    if (modo === 'nuevo' && !form.id) {
      fetch('/api/productos/obtener-nuevo-id-temporal/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.id) {
            setForm(prev => ({ ...prev, id: data.id }));
            setNewStockProve(prev => ({ ...prev, stock: data.id }));
          }
        });
    }
  }, [modo, form.id]);

  useEffect(() => {
    const proveedorId = newStockProve.proveedor;
    let codigoProveedor = '';
    if (proveedorId) {
      const codigoPendiente = codigosPendientes.find(
        c => String(c.proveedor_id) === String(proveedorId)
      );
      if (codigoPendiente) {
        codigoProveedor = codigoPendiente.codigo_producto_proveedor;
      }
      if (!codigoProveedor && stock?.id) {
        const sp = stockProve.find(
          sp => (sp.proveedor?.id || sp.proveedor) === Number(proveedorId)
        );
        if (sp && sp.codigo_producto_proveedor) {
          codigoProveedor = sp.codigo_producto_proveedor;
        }
      }
    }
    if (proveedorId && codigoProveedor) {
      fetch(`/api/productos/precio-producto-proveedor/?proveedor_id=${proveedorId}&codigo_producto=${encodeURIComponent(codigoProveedor)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.precio) {
            setNewStockProve(prev => ({ ...prev, costo: String(data.precio) }));
            setPermitirCostoManual(true);
            setCargarPrecioManual(false);
          } else {
            setNewStockProve(prev => ({ ...prev, costo: '' }));
            setPermitirCostoManual(false);
            setCargarPrecioManual(false);
          }
        })
        .catch(() => {
          setPermitirCostoManual(false);
          setCargarPrecioManual(false);
        });
    } else if (proveedorId) {
      setPermitirCostoManual(false);
      setCargarPrecioManual(false);
      setNewStockProve(prev => ({ ...prev, costo: '' }));
    }
  }, [newStockProve.proveedor, stock?.id, stockProve, codigosPendientes]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === "proveedor_habitual_id"
        ? value === "" ? '' : String(value)
        : ["idfam1", "idfam2", "idfam3", "idaliiva"].includes(name)
          ? value === "" ? null : Number(value)
          : value
    }));
  };

  const handleNewStockProveChange = (e) => {
    const { name, value } = e.target;
    console.log('[handleNewStockProveChange] Cambio:', name, value);
    setNewStockProve(prev => ({
      ...prev,
      [name]: name === "proveedor" ? String(value) : value
    }));
  };

  const addStockProveHandler = async () => {
    if (!newStockProve.proveedor || !newStockProve.cantidad) {
      alert('Por favor complete todos los campos del proveedor');
      return;
    }
    if ((permitirCostoManual && !newStockProve.costo) || (!permitirCostoManual && cargarPrecioManual && !newStockProve.costo)) {
      alert('Debe ingresar el costo.');
      return;
    }
    const proveedorExiste = proveedores.some(p => String(p.id) === String(newStockProve.proveedor));
    if (!proveedorExiste) {
      alert('Debe seleccionar un proveedor válido.');
      return;
    }
    const newProveedorId = parseInt(newStockProve.proveedor);
    const newCantidad = parseFloat(newStockProve.cantidad);
    let newCosto = parseFloat(newStockProve.costo);

    if (!isEdicion) {
      setStockProvePendientes(prev => {
        const existente = prev.find(sp => sp.proveedor === newProveedorId);
        if (existente) {
          return prev.map(sp =>
            sp.proveedor === newProveedorId
              ? { ...sp, cantidad: Number(sp.cantidad) + newCantidad, costo: newCosto }
              : sp
          );
        } else {
          return [
            ...prev,
            {
              proveedor: newProveedorId,
              cantidad: newCantidad,
              costo: newCosto
            }
          ];
        }
      });
      setNewStockProve({ stock: '', proveedor: '', cantidad: '', costo: '' });
      return;
    }

    // EDICIÓN: directo a la API
    const currentStockId = stock.id;
    const existingEntry = stockProve.find(sp => sp.stock === currentStockId && (sp.proveedor?.id || sp.proveedor) === newProveedorId);
    let codigoProductoProveedor = '';
    if (existingEntry && existingEntry.codigo_producto_proveedor) {
      codigoProductoProveedor = existingEntry.codigo_producto_proveedor;
    } else {
      alert('Debes asociar un código de proveedor antes de agregar stock para este proveedor.');
      return;
    }
    try {
      if (existingEntry) {
        await updateStockProve(existingEntry.id, {
          stockId: currentStockId,
          proveedorId: newProveedorId,
          cantidad: parseFloat(existingEntry.cantidad) + newCantidad,
          costo: newCosto,
          codigo_producto_proveedor: codigoProductoProveedor
        });
      } else {
        await addStockProve({
          stock: currentStockId,
          proveedor: newProveedorId,
          cantidad: newCantidad,
          costo: newCosto,
          codigo_producto_proveedor: codigoProductoProveedor
        });
      }
      if (typeof fetchStockProve === 'function') fetchStockProve();
      setNewStockProve({ stock: currentStockId, proveedor: '', cantidad: '', costo: '' });
    } catch (err) {
      alert('Error al procesar stock de proveedor: ' + (err.response?.data?.non_field_errors?.[0] || err.message || 'Error desconocido'));
    }
  };

  // Handler para asociar código de proveedor (ahora solo modifica el estado local en edición)
  const handleAsociarCodigoPendiente = async ({ proveedor_id, codigo_producto_proveedor, costo }) => {
    console.log('[handleAsociarCodigoPendiente] INICIO', { proveedor_id, codigo_producto_proveedor, costo, isEdicion, form });
    if (!isEdicion) {
      // Validar duplicados en pendientes
      const codigoYaUsado = (codigosPendientes || []).some(
        c => c.codigo_producto_proveedor === codigo_producto_proveedor && String(c.proveedor_id) !== String(proveedor_id)
      );
      if (codigoYaUsado) {
        console.log('[handleAsociarCodigoPendiente] Código ya usado en pendientes');
        return { ok: false, error: 'Este código ya se encuentra asociado a otro producto.' };
      }
      // Si el producto aún no fue guardado (ID temporal), solo guardar en pendientes
      if (!stock) {
        setCodigosPendientes(prev => {
          const otros = (prev || []).filter(c => String(c.proveedor_id) !== String(proveedor_id));
          return [
            ...otros,
            {
              proveedor_id,
              codigo_producto_proveedor,
              costo: costo !== '' ? costo : 0
            }
          ];
        });
        setStockProvePendientes(prev => (prev || []).map(sp =>
          String(sp.proveedor) === String(proveedor_id)
            ? { ...sp, costo: costo !== '' ? costo : 0 }
            : sp
        ));
        return { ok: true };
      }
    }

    // Log antes del condicional de edición
    console.log('[handleAsociarCodigoPendiente] isEdicion:', isEdicion, typeof isEdicion, 'form.id:', form.id, typeof form.id);
    // Refuerzo el condicional para aceptar cualquier valor no vacío de form.id
    if (isEdicion && form.id != null && String(form.id).length > 0) {
      // Validar contra los códigos ya asociados (guardados y pendientes)
      const codigosActuales = [
        ...stockProve.map(sp => sp.codigo_producto_proveedor).filter(Boolean),
        ...codigosPendientesEdicion.map(c => c.codigo_producto_proveedor)
      ];
      // Si el código ya está en uso para otro proveedor, error
      const yaUsado = codigosActuales.some((c, idx, arr) => c === codigo_producto_proveedor && (
        // Si ya está en pendientes, que no sea para el mismo proveedor
        codigosPendientesEdicion[idx]?.proveedor_id !== proveedor_id
      ));
      if (yaUsado) {
        return { ok: false, error: 'Este código ya se encuentra asociado a otro producto.' };
      }
      setCodigosPendientesEdicion(prev => {
        // Reemplaza si ya existe para ese proveedor
        const otros = prev.filter(c => String(c.proveedor_id) !== String(proveedor_id));
        return [
          ...otros,
          { proveedor_id, codigo_producto_proveedor, costo }
        ];
      });
      // Actualizar form.stock_proveedores en el estado local para reflejar el nuevo código asociado
      setForm(prevForm => {
        if (!Array.isArray(prevForm.stock_proveedores)) return prevForm;
        const actualizado = prevForm.stock_proveedores.map(sp =>
          String(sp.proveedor_id) === String(proveedor_id)
            ? { ...sp, codigo_producto_proveedor, costo }
            : sp
        );
        // Si no existe, agregarlo
        const existe = actualizado.some(sp => String(sp.proveedor_id) === String(proveedor_id));
        return {
          ...prevForm,
          stock_proveedores: existe ? actualizado : [...actualizado, { proveedor_id, codigo_producto_proveedor, costo }]
        };
      });
      return { ok: true };
    }

    if (!isEdicion && form.id) {
      try {
        const res = await fetch('/api/productos/asociar-codigo-proveedor/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
          },
          credentials: 'include',
          body: JSON.stringify({
            stock_id: form.id,
            proveedor_id,
            codigo_producto_proveedor,
            costo: costo !== '' ? costo : 0
          })
        });
        const data = await res.json();
        console.log('[handleAsociarCodigoPendiente] Respuesta backend (nuevo):', data);
        if (!res.ok) {
          // Si el error es producto/proveedor no encontrado, mostrar mensaje claro
          if (data.detail && data.detail.includes('Producto o proveedor no encontrado')) {
            return { ok: false, error: 'Debes guardar el producto antes de asociar un código de proveedor.' };
          }
          console.log('[handleAsociarCodigoPendiente] Error backend (nuevo):', data.detail);
          return { ok: false, error: data.detail || 'Error al validar código de proveedor' };
        }
        setCodigosPendientes(prev => {
          const otros = (prev || []).filter(c => String(c.proveedor_id) !== String(proveedor_id));
          return [
            ...otros,
            {
              proveedor_id,
              codigo_producto_proveedor,
              costo: costo !== '' ? costo : 0
            }
          ];
        });
        setStockProvePendientes(prev => (prev || []).map(sp =>
          String(sp.proveedor) === String(proveedor_id)
            ? { ...sp, costo: costo !== '' ? costo : 0 }
            : sp
        ));
        console.log('[handleAsociarCodigoPendiente] Asociación exitosa (nuevo)');
        return { ok: true };
      } catch (err) {
        console.log('[handleAsociarCodigoPendiente] Excepción (nuevo):', err);
        return { ok: false, error: err.message || 'Error al validar código de proveedor' };
      }
    }
    console.log('[handleAsociarCodigoPendiente] Fallback error');
    return { ok: false, error: 'No se pudo asociar el código.' };
  };

  // Al guardar, aplicar los códigos pendientes de edición
  const handleSave = async (e) => {
    e.preventDefault();
    localStorage.removeItem('stockFormDraft');
    setFormError(null);
    let formToSave = { ...form };
    if (!isEdicion && form.id) {
      formToSave.id = form.id;
    }
    if (isEdicion && stock?.id) {
      formToSave.id = stock.id;
    }
    try {
      let productoGuardado = null;
      if (!isEdicion) {
        // NUEVO FLUJO ATÓMICO: enviar todo junto
        const stockProveedores = stockProvePendientes.map(sp => {
          const codigoPendiente = codigosPendientes.find(
            c => String(c.proveedor_id) === String(sp.proveedor)
          );
          return {
            proveedor_id: sp.proveedor,
            cantidad: sp.cantidad,
            costo: sp.costo,
            codigo_producto_proveedor: codigoPendiente ? codigoPendiente.codigo_producto_proveedor : ''
          };
        });
        const res = await fetch('/api/productos/crear-producto-con-relaciones/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || ''
          },
          credentials: 'include',
          body: JSON.stringify({
            producto: formToSave,
            stock_proveedores: stockProveedores
          })
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.detail || 'Error al guardar el producto.');
          return;
        }
        productoGuardado = { ...formToSave, id: data.producto_id };
        setStockProvePendientes([]);
        setCodigosPendientes([]);
        if (typeof fetchStockProve === 'function') fetchStockProve();
        await onSave(productoGuardado);
      } else {
        // EDICIÓN ATÓMICA: enviar todo junto
        // Construir stock_proveedores a partir de stockProve (los reales) y codigosPendientesEdicion (los editados)
        const stockProveedores = stockProve
          .filter(sp => sp.stock === stock.id)
          .map(sp => {
            // Si hay un pendiente de edición para este proveedor, usar su código/costo
            const pendiente = codigosPendientesEdicion.find(c => String(c.proveedor_id) === String(sp.proveedor?.id || sp.proveedor));
            return {
              proveedor_id: sp.proveedor?.id || sp.proveedor,
              cantidad: sp.cantidad,
              costo: pendiente && pendiente.costo !== undefined ? pendiente.costo : sp.costo,
              codigo_producto_proveedor: pendiente ? pendiente.codigo_producto_proveedor : sp.codigo_producto_proveedor || ''
            };
          });
        const res = await fetch('/api/productos/editar-producto-con-relaciones/', {
          method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || ''
            },
            credentials: 'include',
            body: JSON.stringify({
            producto: formToSave,
            stock_proveedores: stockProveedores
            })
          });
            const data = await res.json();
        if (!res.ok) {
          setFormError(data.detail || 'Error al actualizar el producto.');
            return;
          }
        productoGuardado = { ...formToSave, id: data.producto_id || stock.id };
        setCodigosPendientesEdicion([]);
        if (typeof fetchStockProve === 'function') fetchStockProve();
        await onSave(productoGuardado);
        }
    } catch (err) {
      setFormError('Error al guardar el producto o sus relaciones.');
      return;
    }
  };

  const handleCancel = () => {
    localStorage.removeItem('stockFormDraft');
    onCancel();
  };

  const stockProveForThisStock = stockProve.filter(sp => sp.stock === stock?.id);

  const handleEditStockProve = (sp) => {
    setEditandoCantidadId(sp.id);
    setNuevaCantidad(sp.cantidad);
  };

  const handleEditStockProveCancel = () => {
    setEditandoCantidadId(null);
    setNuevaCantidad('');
  };

  const handleEditStockProveSave = async (id) => {
    const sp = stockProve.find(sp => sp.id === id);
    if (!sp) return;
    // Permitir negativos y decimales
    const cantidadNum = parseFloat(String(nuevaCantidad).replace(',', '.'));
    if (isNaN(cantidadNum)) {
      setFormError('Ingrese una cantidad válida');
      return;
    }
    // Calcular nuevo costo proporcional si corresponde
    const cantidadOriginal = parseFloat(sp.cantidad);
    const costoUnitario = cantidadOriginal !== 0 ? sp.costo / cantidadOriginal : 0;
    let nuevoCosto = cantidadNum * costoUnitario;
    nuevoCosto = Math.round((nuevoCosto + Number.EPSILON) * 100) / 100;
    if (isNaN(nuevoCosto) || !isFinite(nuevoCosto)) {
      setFormError('El costo calculado no es válido');
      return;
    }
    await updateStockProve(id, {
      stockId: sp.stock,
      proveedorId: sp.proveedor?.id || sp.proveedor,
      cantidad: cantidadNum,
      costo: nuevoCosto,
    });
    setEditandoCantidadId(null);
    setNuevaCantidad('');
    if (typeof fetchStockProve === 'function') fetchStockProve();
  };

  const handleCloseAsociarModal = () => {
    setShowAsociarModal(false);
    if (typeof fetchStockProve === 'function') fetchStockProve();
  };

  console.log('form state:', JSON.stringify(form));
  console.log('select value:', form.proveedor_habitual_id);

  // Calcular el stock total sumando las cantidades de todos los proveedores
  const stockTotal = stockProveForThisStock.reduce((sum, sp) => sum + (Number(sp.cantidad) || 0), 0);

  // Calcular proveedores asociados dinámicamente según el estado actual del formulario
  const proveedoresAsociados = stock?.id
    ? stockProveForThisStock.map(sp => (typeof sp.proveedor === 'object' ? sp.proveedor : proveedores.find(p => p.id === sp.proveedor))).filter(Boolean)
    : stockProvePendientes.map(sp => (typeof sp.proveedor === 'object' ? sp.proveedor : proveedores.find(p => p.id === sp.proveedor))).filter(Boolean);
  const unProveedor = proveedoresAsociados.length === 1;

  // Si hay un solo proveedor, autocompletar y deshabilitar
  useEffect(() => {
    if (unProveedor && form.proveedor_habitual_id !== String(proveedoresAsociados[0].id)) {
      setForm(prev => ({ ...prev, proveedor_habitual_id: String(proveedoresAsociados[0].id) }));
    }
  }, [unProveedor, proveedoresAsociados, form.proveedor_habitual_id]);

  // Mezclar stock de proveedor real y pendientes de edición para mostrar en la tabla
  const stockProveParaMostrar = (() => {
    if (isEdicion) {
      // Mapear por proveedor los datos guardados
      const guardadosPorProveedor = Object.fromEntries(
        stockProveForThisStock.map(sp => [String(sp.proveedor?.id || sp.proveedor), sp])
      );
      // Mapear por proveedor los pendientes
      const pendientesPorProveedor = Object.fromEntries(
        codigosPendientesEdicion.map(c => [String(c.proveedor_id), c])
      );
      // Unir claves
      const proveedoresUnicos = Array.from(new Set([
        ...Object.keys(guardadosPorProveedor),
        ...Object.keys(pendientesPorProveedor)
      ]));
      // Construir array final
      return proveedoresUnicos.map(provId => {
        const pendiente = pendientesPorProveedor[provId];
        const guardado = guardadosPorProveedor[provId];
        if (pendiente) {
          // Mostrar datos pendientes (pero tomar cantidad/costo del guardado si no se editan en el modal)
          return {
            ...guardado,
            ...pendiente,
            pendiente: true,
            cantidad: guardado?.cantidad,
            costo: pendiente.costo !== undefined ? pendiente.costo : guardado?.costo
          };
        } else {
          return guardado;
        }
      }).filter(Boolean);
    } else if (stock?.id) {
      return stockProveForThisStock;
    } else {
      // Nuevo producto: mostrar pendientes
      return [
        ...stockProvePendientes.map((sp, idx) => ({
          ...sp,
          id: `pendiente-${sp.proveedor}`,
          proveedor: typeof sp.proveedor === 'object' ? sp.proveedor : proveedores.find(p => p.id === sp.proveedor) || sp.proveedor,
          codigo_producto_proveedor: '', // No hay código asociado aún
        }))
      ];
    }
  })();

  // Al asociar stock, autocompletar proveedor habitual si hay uno solo
  useEffect(() => {
    if (proveedoresAsociados.length === 1 && form.proveedor_habitual_id !== String(proveedoresAsociados[0].id)) {
      setForm(prev => ({ ...prev, proveedor_habitual_id: String(proveedoresAsociados[0].id) }));
    }
  }, [proveedoresAsociados, form.proveedor_habitual_id]);

  // useEffect para autocompletar costo y controlar la checkbox (idéntico a Nuevo Producto, solo adaptando la ID real)
  useEffect(() => {
    const proveedorId = newStockProve.proveedor;
    let codigoProveedor = '';
    if (proveedorId && form && Array.isArray(form.stock_proveedores)) {
      const relacion = form.stock_proveedores.find(
        sp => String(sp.proveedor_id) === String(proveedorId)
      );
      if (relacion && relacion.codigo_producto_proveedor) {
        codigoProveedor = relacion.codigo_producto_proveedor;
      }
    }
    if (proveedorId && codigoProveedor) {
      fetch(`/api/productos/precio-producto-proveedor/?proveedor_id=${proveedorId}&codigo_producto=${encodeURIComponent(codigoProveedor)}`)
        .then(res => res.json())
        .then(data => {
          if (data && typeof data.precio === 'number' && data.precio > 0) {
            setNewStockProve(prev => ({ ...prev, costo: String(data.precio) }));
            setPermitirCostoManual(true);
            setCargarPrecioManual(false);
          } else {
            setNewStockProve(prev => ({ ...prev, costo: '' }));
            setPermitirCostoManual(false);
            setCargarPrecioManual(false);
          }
        })
        .catch(() => {
          setNewStockProve(prev => ({ ...prev, costo: '' }));
          setPermitirCostoManual(false);
          setCargarPrecioManual(false);
        });
    } else if (proveedorId) {
      setPermitirCostoManual(false);
      setCargarPrecioManual(false);
      setNewStockProve(prev => ({ ...prev, costo: '' }));
    }
  }, [newStockProve.proveedor, form.stock_proveedores]);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <form onSubmit={handleSave} className="space-y-6">
        {formError && (
          <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-2 border border-red-300">
            {formError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Código de Venta</label>
            <input
              type="text"
              name="codvta"
              value={form.codvta}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Código de Compra</label>
            <input
              type="text"
              name="codcom"
              value={form.codcom}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Denominación</label>
          <input
            type="text"
            name="deno"
            value={form.deno}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Stock total</label>
            <input
              type="number"
              value={stockTotal}
              readOnly
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 text-gray-700 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Cantidad Mínima</label>
            <input
              type="number"
              name="cantmin"
              value={form.cantmin}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Proveedor Habitual</label>
          <select
            name="proveedor_habitual_id"
            value={form.proveedor_habitual_id ?? ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            disabled={proveedoresAsociados.length === 1}
            required={proveedoresAsociados.length > 1}
          >
            <option value="">Seleccione un proveedor</option>
            {proveedoresAsociados.map(prov => (
              <option key={prov.id} value={String(prov.id)}>{prov.razon}</option>
            ))}
          </select>
          {proveedoresAsociados.length > 1 && !form.proveedor_habitual_id && (
            <div className="text-red-600 text-xs mt-1">Debe seleccionar un proveedor habitual si hay más de un proveedor asociado.</div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Familia</label>
          <select
            name="idfam1"
            value={typeof form.idfam1 === 'number' || typeof form.idfam1 === 'string' ? form.idfam1 : ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Sin familia</option>
            {familias.filter(fam => String(fam.nivel) === '1').map(fam => (
              <option key={fam.id} value={fam.id}>{fam.deno}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Subfamilia</label>
          <select
            name="idfam2"
            value={typeof form.idfam2 === 'number' || typeof form.idfam2 === 'string' ? form.idfam2 : ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Sin subfamilia</option>
            {familias.filter(fam => String(fam.nivel) === '2').map(fam => (
              <option key={fam.id} value={fam.id}>{fam.deno}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Sub-subfamilia</label>
          <select
            name="idfam3"
            value={typeof form.idfam3 === 'number' || typeof form.idfam3 === 'string' ? form.idfam3 : ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Sin sub-subfamilia</option>
            {familias.filter(fam => String(fam.nivel) === '3').map(fam => (
              <option key={fam.id} value={fam.id}>{fam.deno}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Alicuota de IVA</label>
          <select
            name="idaliiva"
            value={typeof form.idaliiva === 'number' || typeof form.idaliiva === 'string' ? form.idaliiva : ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          >
            <option value="">Seleccione una alícuota</option>
            {alicuotas.map(a => (
              <option key={a.id} value={a.id}>{a.deno} ({a.porce}%)</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end mb-4">
          {(stock?.id || form.id) && (
            <button
              type="button"
              onClick={() => setShowAsociarModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold"
            >
              Asociar código de proveedor
            </button>
          )}
        </div>

        <div className="border-t pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Agregar Stock por Proveedor</h3>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <select
              name="proveedor"
              value={typeof newStockProve.proveedor === 'string' || typeof newStockProve.proveedor === 'number' ? newStockProve.proveedor : ''}
              onChange={handleNewStockProveChange}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Seleccione un proveedor</option>
              {proveedores.map(proveedor => (
                <option key={proveedor.id} value={String(proveedor.id)}>
                  {proveedor.razon}
                </option>
              ))}
            </select>
            <input
              type="number"
              name="cantidad"
              value={newStockProve.cantidad}
              onChange={handleNewStockProveChange}
              placeholder="Cantidad"
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <div className="relative flex items-center">
              <input
                type="number"
                name="costo"
                value={newStockProve.costo}
                onChange={handleNewStockProveChange}
                placeholder="Costo"
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={permitirCostoManual && !cargarPrecioManual}
                required
              />
              {permitirCostoManual && (
                <label className="ml-2 flex items-center text-xs">
                  <input
                    type="checkbox"
                    checked={cargarPrecioManual}
                    onChange={e => setCargarPrecioManual(e.target.checked)}
                    className="mr-1"
                  />
                  Cargar precio manual
                </label>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={addStockProveHandler}
            className="mb-4 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:ring-offset-2 transition-colors"
          >
            Agregar Stock de Proveedor
          </button>
        </div>

        {((stock && stock.id) || (!stock?.id && stockProvePendientes.length > 0)) && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Stock por Proveedor</h3>
            <div className="mb-4 space-y-2">
              {stockProveParaMostrar.map((sp, index) => {
                // Buscar código pendiente si corresponde
                let codigoProveedor = sp.codigo_producto_proveedor;
                if (!codigoProveedor && !stock?.id) {
                  const codigoPendiente = codigosPendientes.find(
                    c => String(c.proveedor_id) === String(sp.proveedor.id || sp.proveedor)
                  );
                  if (codigoPendiente) {
                    codigoProveedor = codigoPendiente.codigo_producto_proveedor;
                  }
                }
                return (
                  <div key={sp.id || index} className={`bg-gray-50 rounded-lg p-3${sp.pendiente ? ' bg-yellow-100 border border-yellow-300' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className="font-medium">
                          {typeof sp.proveedor === 'object'
                            ? sp.proveedor.razon
                            : proveedores.find(p => p.id === sp.proveedor)?.razon || sp.proveedor}
                        </span>
                        <span className="text-sm text-gray-500">
                          Código proveedor: <b>{codigoProveedor || 'No asociado'}</b>
                        </span>
                        <span className="text-sm text-gray-500">
                          Cantidad: {editandoCantidadId === sp.id ? (
                            <>
                              <input
                                type="number"
                                value={nuevaCantidad}
                                onChange={e => setNuevaCantidad(e.target.value)}
                                className="w-20 border rounded px-1 py-0.5 mx-1"
                                min="0"
                              />
                              <button
                                type="button"
                                className="ml-1 px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                                onClick={() => handleEditStockProveSave(sp.id)}
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                className="ml-1 px-2 py-0.5 bg-gray-300 text-black rounded hover:bg-gray-400 text-xs"
                                onClick={handleEditStockProveCancel}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              {sp.cantidad}
                              <button
                                type="button"
                                className="ml-2 px-2 py-0.5 bg-yellow-400 text-black rounded hover:bg-yellow-500 text-xs"
                                onClick={() => handleEditStockProve(sp)}
                              >
                                Editar
                              </button>
                            </>
                          )}
                          {' | '}Costo: ${sp.costo}
                          {sp.pendiente && <span className="ml-2 text-xs text-yellow-700 font-semibold">(pendiente de guardar)</span>}
                        </span>
                      </div>
                      {/* No permitir eliminar ni editar pendientes hasta guardar */}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-red-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:ring-offset-2 transition-colors"
          >
            {stock && stock.id ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </form>
      <AsociarCodigoProveedorModal
        // Este modal es seguro para ambos contextos (editar/nuevo) si se pasan las props correctas.
        open={showAsociarModal}
        onClose={handleCloseAsociarModal}
        producto={stock}
        productoId={stock?.id || form.id}
        proveedores={proveedores}
        onAsociarCodigoPendiente={handleAsociarCodigoPendiente}
      />
    </div>
  );
};

export default StockForm; 