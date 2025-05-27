import React, { useState, useEffect } from 'react';
import Navbar from "./Navbar";
import { useVentasAPI } from '../utils/useVentasAPI';
import { useProductosAPI } from '../utils/useProductosAPI';
import { useFamiliasAPI } from '../utils/useFamiliasAPI';
import { useProveedoresAPI } from '../utils/useProveedoresAPI';
import { useAlicuotasIVAAPI } from '../utils/useAlicuotasIVAAPI';
import { useComprobantesAPI } from '../utils/useComprobantesAPI';
import { useClientesAPI } from '../utils/useClientesAPI';
import { usePlazosAPI } from '../utils/usePlazosAPI';
import { useVendedoresAPI } from '../utils/useVendedoresAPI';
import VendedorForm from './VendedorForm';
import { useLocalidadesAPI } from '../utils/useLocalidadesAPI';
import VendedoresTable from './VendedoresTable';
import PresupuestoForm from './PresupuestoForm';
import VentaForm from './VentaForm';
import ItemsGrid from './ItemsGrid';
import { BotonEditar, BotonEliminar, BotonImprimir, BotonConvertir, BotonVerDetalle } from './Botones';
import PresupuestoVentaVista from './PresupuestoVentaVista';
import { getCookie } from '../utils/csrf';
import { IconVenta, IconFactura, IconCredito, IconPresupuesto, IconRecibo } from './ComprobanteIcono';
import EditarPresupuestoForm from './EditarPresupuestoForm';
import ConversionModal from './ConversionModal';
import ConVentaForm from './ConVentaForm';

const filtros = [
  { key: 'todos', label: 'Todos' },
  { key: 'presupuestos', label: 'Presupuestos' },
  { key: 'ventas', label: 'Ventas' }
];

// Badge de estado
const EstadoBadge = ({ estado }) => {
  if (estado === 'Cerrado') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        Cerrado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
      Abierto
    </span>
  );
};

const mainTabs = [
  { key: 'presupuestos', label: 'Presupuestos y Ventas', closable: false },
  { key: 'vendedores', label: 'Vendedores', closable: false }
];

const getComprobanteIconAndLabel = (tipo, nombre = '') => {
  const n = String(nombre || '').toLowerCase();
  if (n.includes('presupuesto')) return { icon: <IconPresupuesto />, label: 'Presupuesto' };
  if (n.includes('venta')) return { icon: <IconVenta />, label: 'Venta' };
  if (n.includes('factura')) return { icon: <IconFactura />, label: 'Factura' };
  if (n.includes('nota de crédito interna')) return { icon: <IconCredito />, label: 'N. Cred. Int.' };
  if (n.includes('nota de crédito')) return { icon: <IconCredito />, label: 'N. Cred.' };
  if (n.includes('nota de débito')) return { icon: <IconCredito />, label: 'N. Deb.' };
  if (n.includes('recibo')) return { icon: <IconRecibo />, label: 'Recibo' };
  return { icon: <IconFactura />, label: String(nombre) };
};

const PresupuestosManager = () => {
  // Estado y fetch para el usuario
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/api/user/", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") setUser(data.user);
      });
  }, []);

  const handleLogout = () => {
    setUser(null);
    window.location.href = "/login";
  };

  useEffect(() => {
    document.title = "Presupuestos y Ventas FerreDesk";
  }, []);

  const { ventas, error, addVenta, updateVenta, deleteVenta, fetchVentas } = useVentasAPI();
  const fetchPresupuestos = fetchVentas;
  const { productos, loading: loadingProductos, error: errorProductos } = useProductosAPI();
  const { familias, loading: loadingFamilias, error: errorFamilias } = useFamiliasAPI();
  const { proveedores, loading: loadingProveedores, error: errorProveedores } = useProveedoresAPI();
  const { alicuotas, loading: loadingAlicuotas, error: errorAlicuotas } = useAlicuotasIVAAPI();
  const { comprobantes, loading: loadingComprobantes, error: errorComprobantes } = useComprobantesAPI();
  const { clientes } = useClientesAPI();
  const { plazos } = usePlazosAPI();
  const {
    vendedores,
    loading: loadingVendedores,
    error: errorVendedores,
    fetchVendedores,
    addVendedor,
    updateVendedor,
    deleteVendedor
  } = useVendedoresAPI();
  const sucursales = [ { id: 1, nombre: 'Casa Central' } ]; // Ajusta según tu negocio
  const puntosVenta = [ { id: 1, nombre: 'PV 1' } ];        // Ajusta según tu negocio
  const [filtro, setFiltro] = useState('todos');
  const [tabs, setTabs] = useState([...mainTabs]);
  const [activeTab, setActiveTab] = useState('presupuestos');
  const [editPresupuesto, setEditPresupuesto] = useState(null);
  const { localidades } = useLocalidadesAPI();
  const [autoSumarDuplicados, setAutoSumarDuplicados] = useState(false);
  const [draggedTabKey, setDraggedTabKey] = useState(null);
  const tiposComprobante = comprobantes.map(c => ({ value: c.id, label: c.nombre, campo: c.codigo_afip, tipo: c.tipo }));
  const presupuestoComprobanteIds = comprobantes.filter(c => (c.tipo || '').toLowerCase() === 'presupuesto').map(c => c.id);
  const ventaComprobanteIds = comprobantes.filter(c => (c.tipo || '').toLowerCase() !== 'presupuesto').map(c => c.id);
  const [tipoComprobante, setTipoComprobante] = useState(1); // 1=Factura A por defecto
  const [searchVendedor, setSearchVendedor] = useState('');
  const [editVendedorData, setEditVendedorData] = useState(null);
  const [filtroAlicuota, setFiltroAlicuota] = useState('');
  const [filtroTipoComprobante, setFiltroTipoComprobante] = useState('');
  const [conversionModal, setConversionModal] = useState({ open: false, presupuesto: null });

  // Guardar estado de pestañas en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('presupuestosTabs', JSON.stringify(tabs));
    localStorage.setItem('presupuestosActiveTab', activeTab);
  }, [tabs, activeTab]);

  // Al montar, NO abrir automáticamente la tab de 'nuevo' aunque haya draft
  // (el draft se mantiene, pero la tab solo se abre si el usuario la elige)
  // eslint-disable-next-line
  useEffect(() => {
    // Solo restaurar tabs guardadas, no abrir 'nuevo' por draft
    // (el draft se mantiene, pero la tab solo se abre si el usuario la elige)
    // eslint-disable-next-line
  }, []);

  // Filtros
  const filtrar = (lista) => {
    let res = lista;
    switch (filtro) {
      case 'presupuestos':
        res = res.filter(p => p.tipo === 'Presupuesto' && p.estado === 'Abierto');
        break;
      case 'ventas':
        res = res.filter(p => p.tipo === 'Venta' && p.estado === 'Cerrado');
        break;
      case 'todos':
      default:
        break;
    }
    if (filtroAlicuota) {
      res = res.filter(p => p.iva_desglose && Object.keys(p.iva_desglose).includes(filtroAlicuota));
    }
    if (filtroTipoComprobante) {
      res = res.filter(p => String(p.comprobante) === filtroTipoComprobante);
    }
    return res;
  };

  // Funciones para tabs
  const openTab = (key, label, data = null) => {
    setEditVendedorData(data);
    setTabs((prev) => {
      if (prev.find((t) => t.key === key)) return prev;
      return [...prev, { key, label, closable: true, data }];
    });
    setActiveTab(key);
  };
  const closeTab = (key) => {
    setTabs((prev) => prev.filter((t) => t.key !== key));
    if (activeTab === key) setActiveTab('presupuestos');
    setEditVendedorData(null);
  };

  // Acciones
  const handleNuevo = () => {
    const newKey = `nuevo-${Date.now()}`;
    setTabs(prev => [...prev, { key: newKey, label: 'Nuevo Presupuesto', closable: true }]);
    setEditPresupuesto(null);
    setActiveTab(newKey);
    setTipoComprobante(4); // Forzar tipoComprobante a 4 para presupuesto
    localStorage.removeItem('presupuestoFormDraft');
  };

  const handleNuevaVenta = () => {
    const newKey = `nueva-venta-${Date.now()}`;
    setTabs(prev => [...prev, { key: newKey, label: 'Nueva Venta', closable: true }]);
    setActiveTab(newKey);
    setTipoComprobante(1); // Forzar tipoComprobante a 1 para venta
    localStorage.removeItem('ventaFormDraft');
  };

  const handleEdit = (presupuesto) => {
    setEditPresupuesto(presupuesto);
    openTab('editar', 'Editar Presupuesto', presupuesto);
  };

  const handleImprimir = async (presupuesto) => {
    try {
      const response = await fetch(`/api/ventas/${presupuesto.id}/imprimir/`, { method: 'GET' });
      if (!response.ok) throw new Error('No se pudo imprimir');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url);
    } catch (err) {
      alert('Error al imprimir: ' + (err.message || ''));
    }
  };

  const handleConvertir = async (presupuesto) => {
    setConversionModal({ open: true, presupuesto });
  };

  const handleConversionConfirm = (selectedItems) => {
    const presupuesto = conversionModal.presupuesto;
    const itemsSeleccionadosObjs = (presupuesto.items || []).filter(item => selectedItems.includes(item.id));
    const tabKey = `conventa-${presupuesto.id}-${Date.now()}`;
    setTabs(prev => [
      ...prev,
      {
        key: tabKey,
        label: `Conversión a Venta #${presupuesto.numero || presupuesto.id}`,
        closable: true,
        data: {
          presupuestoOrigen: presupuesto,
          itemsSeleccionados: itemsSeleccionadosObjs,
          itemsSeleccionadosIds: selectedItems
        },
        tipo: 'conventa'
      }
    ]);
    setActiveTab(tabKey);
    setConversionModal({ open: false, presupuesto: null });
  };

  const handleConVentaFormSave = async (payload, tabKey) => {
    try {
      const csrftoken = getCookie('csrftoken');
      const response = await fetch('/api/convertir-presupuesto/', {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrftoken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      
      if (!response.ok) {
        let msg = 'No se pudo convertir';
        try {
          const data = await response.json();
          msg = data.detail || msg;
        } catch {}
        throw new Error(msg);
      }

      const data = await response.json();
      
      // Actualizar la lista de ventas y presupuestos
      await fetchVentas();
      await fetchPresupuestos();
      // Cerrar la tab de conversión
      closeTab(tabKey);
      // Mostrar mensaje de éxito
      if (data.presupuesto === null) {
        alert('Venta creada correctamente. El presupuesto fue eliminado por no tener items restantes.');
      } else {
        alert('Venta creada correctamente. El presupuesto fue actualizado con los items restantes.');
      }
    } catch (err) {
      alert('Error al convertir: ' + (err.message || ''));
    }
  };

  const handleConVentaFormCancel = (tabKey) => {
    closeTab(tabKey);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este presupuesto/venta?')) {
      try {
        await deleteVenta(id);
      } catch (err) {
        alert('Error al eliminar: ' + (err.message || ''));
      }
    }
  };

  // Nueva función para abrir subtab de vista no editable
  const openVistaTab = (presupuesto) => {
    setTabs(prev => {
      if (prev.find(t => t.key === `vista-${presupuesto.id}`)) return prev;
      return [...prev, { key: `vista-${presupuesto.id}`, label: `Vista ${presupuesto.tipo} ${presupuesto.numero}`, closable: true, data: presupuesto }];
    });
    setActiveTab(`vista-${presupuesto.id}`);
  };

  // Vendedores: abrir nuevo/editar
  const handleNuevoVendedor = () => {
    const newKey = `nuevo-vendedor-${Date.now()}`;
    openTab(newKey, 'Nuevo Vendedor');
  };
  const handleEditVendedor = (vendedor) => {
    const editKey = `editar-vendedor-${vendedor.id}`;
    openTab(editKey, `Editar Vendedor: ${vendedor.nombre.substring(0,15)}...`, vendedor);
  };
  const handleSaveVendedor = async (data) => {
    try {
      if (editVendedorData) {
        await updateVendedor(editVendedorData.id, data);
      } else {
        await addVendedor(data);
      }
      fetchVendedores();
      closeTab(activeTab);
    } catch (err) {
      // Manejo de error opcional
    }
  };
  const handleDeleteVendedor = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este vendedor?')) {
      try {
        await deleteVendedor(id);
        fetchVendedores();
      } catch (err) {}
    }
  };

  // Normalizar datos de ventas/presupuestos para la grilla
  const normalizarVenta = (venta) => {
    let tipo = '';
    if (venta.comprobante && typeof venta.comprobante === 'object') {
      tipo = venta.comprobante.tipo ? venta.comprobante.tipo.charAt(0).toUpperCase() + venta.comprobante.tipo.slice(1) : '';
    } else if (venta.comprobante && presupuestoComprobanteIds.includes(venta.comprobante)) {
      tipo = 'Presupuesto';
    } else if (venta.comprobante && ventaComprobanteIds.includes(venta.comprobante)) {
      tipo = 'Venta';
    } else {
      tipo = venta.tipo || '';
    }
    const estado = venta.estado || (venta.ven_estado === 'AB' ? 'Abierto' : venta.ven_estado === 'CE' ? 'Cerrado' : '');
    const items = (venta.items || venta.detalle || venta.productos || []).map(item => {
      const producto = productos.find(p => p.id === (item.vdi_idsto || item.producto?.id));
      const cantidad = parseFloat(item.vdi_cantidad || item.cantidad || 0);
      const costo = parseFloat(item.vdi_importe || item.precio || item.costo || 0);
      const bonificacion = parseFloat(item.vdi_bonifica || item.bonificacion || 0);
      const subtotalSinIva = (costo * cantidad) * (1 - bonificacion / 100);
      const alicuotaIva = producto ? (parseFloat(producto.aliiva?.porce || producto.aliiva || 0) || 0) : 0;
      const iva = subtotalSinIva * (alicuotaIva / 100);
      return {
        ...item,
        producto,
        codigo: producto?.codvta || producto?.codigo || item.codigo || item.codvta || item.id || '-',
        denominacion: producto?.deno || producto?.nombre || item.denominacion || item.nombre || '',
        unidad: producto?.unidad || producto?.unidadmedida || item.unidad || item.unidadmedida || '-',
        cantidad,
        precio: costo,
        bonificacion,
        alicuotaIva,
        iva,
      };
    });
    return {
      ...venta,
      tipo,
      estado,
      letra: (venta.comprobante && typeof venta.comprobante === 'object' && venta.comprobante.letra) ? venta.comprobante.letra : venta.letra || '',
      numero: venta.numero_formateado || venta.ven_numero || venta.numero || '',
      cliente: clientes.find(c => c.id === venta.ven_idcli)?.razon || venta.cliente || '',
      fecha: venta.ven_fecha || venta.fecha || new Date().toISOString().split('T')[0],
      id: venta.id || venta.ven_id || venta.pk,
      items,
      plazoId: venta.ven_idpla || venta.plazoId || '',
      vendedorId: venta.ven_idvdo || venta.vendedorId || '',
      sucursalId: venta.ven_sucursal || venta.sucursalId || 1,
      puntoVentaId: venta.ven_punto || venta.puntoVentaId || 1,
      bonificacionGeneral: venta.ven_bonificacion_general ?? venta.bonificacionGeneral ?? 0,
      descu1: venta.ven_descu1 || venta.descu1 || 0,
      descu2: venta.ven_descu2 || venta.descu2 || 0,
      descu3: venta.ven_descu3 || venta.descu3 || 0,
      copia: venta.ven_copia || venta.copia || 1,
      cae: venta.ven_cae || venta.cae || '',
      comprobante: venta.comprobante && typeof venta.comprobante === 'object' ? venta.comprobante.id : venta.comprobante,
      total: venta.total || venta.ven_total || venta.importe_total || 0
    };
  };

  // En el render, usar ventasNormalizadas en vez de ventas
  const ventasNormalizadas = ventas.map(normalizarVenta);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar user={user} onLogout={handleLogout} />
      <div className="container mx-auto px-6 py-8 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Gestión de Presupuestos y Ventas</h2>
        </div>
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 shadow-sm">
            <div className="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {error}
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-md overflow-hidden">
          {/* Tabs tipo browser */}
          <div className="flex items-center border-b border-gray-200 px-6 pt-3">
            {tabs.map((tab) => (
              <div
                key={tab.key}
                className={`flex items-center px-5 py-3 mr-2 rounded-t-lg cursor-pointer transition-colors ${
                  activeTab === tab.key
                    ? "bg-white border border-b-0 border-gray-200 font-semibold text-gray-900"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => setActiveTab(tab.key)}
                style={{ position: "relative", zIndex: 1 }}
                draggable={tab.closable}
                onDragStart={
                  tab.closable
                    ? (e) => {
                        setDraggedTabKey(tab.key)
                        e.dataTransfer.effectAllowed = "move"
                      }
                    : undefined
                }
                onDrop={
                  tab.closable
                    ? (e) => {
                        e.preventDefault()
                        if (draggedTabKey && draggedTabKey !== tab.key) {
                          const dynamicTabs = tabs.filter((t) => t.closable)
                          const fixedTabs = tabs.filter((t) => !t.closable)
                          const draggedIdx = dynamicTabs.findIndex((t) => t.key === draggedTabKey)
                          const dropIdx = dynamicTabs.findIndex((t) => t.key === tab.key)
                          if (draggedIdx !== -1 && dropIdx !== -1) {
                            const newDynamicTabs = [...dynamicTabs]
                            const [draggedTab] = newDynamicTabs.splice(draggedIdx, 1)
                            newDynamicTabs.splice(dropIdx, 0, draggedTab)
                            setTabs([...fixedTabs, ...newDynamicTabs])
                          }
                        }
                        setDraggedTabKey(null)
                      }
                    : undefined
                }
                onDragEnd={() => {
                  setDraggedTabKey(null)
                }}
              >
                {tab.label}
                {tab.closable && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.key)
                    }}
                    className="ml-3 text-lg font-bold text-gray-400 hover:text-red-500 focus:outline-none transition-colors"
                    title="Cerrar"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex-1 p-6">
            {/* Presupuestos y Ventas */}
            {activeTab === 'presupuestos' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex gap-2">
                    {filtros.map(f => (
                      <button
                        key={f.key}
                        onClick={() => setFiltro(f.key)}
                        className={`px-4 py-1.5 rounded-lg font-semibold text-sm transition-colors border border-gray-200 focus:outline-none ${filtro === f.key ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {filtro === 'presupuestos' || filtro === 'todos' ? (
                    <button
                      onClick={handleNuevo}
                      className="bg-black hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm"
                    >
                      <span className="text-lg">+</span> Nuevo Presupuesto
                    </button>
                  ) : filtro === 'ventas' ? (
                    <button
                      onClick={handleNuevaVenta}
                      className="bg-black hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm"
                    >
                      <span className="text-lg">+</span> Nueva Venta
                    </button>
                  ) : null}
                </div>
                {/* Filtros adicionales */}
                <div className="flex gap-2 items-center mb-2">
                  <label className="text-sm">Filtrar por alícuota:</label>
                  <select value={filtroAlicuota} onChange={e => setFiltroAlicuota(e.target.value)} className="px-2 py-1 border rounded">
                    <option value="">Todas</option>
                    <option value="21">21%</option>
                    <option value="10.5">10.5%</option>
                    <option value="27">27%</option>
                    <option value="0">Exento</option>
                  </select>
                  <label className="text-sm ml-4">Filtrar por comprobante:</label>
                  <select value={filtroTipoComprobante} onChange={e => setFiltroTipoComprobante(e.target.value)} className="px-2 py-1 border rounded">
                    <option value="">Todos</option>
                    {comprobantes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N°</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comprobante</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filtrar(ventasNormalizadas).map(p => {
                      let comprobanteObj = null;
                      if (typeof p.comprobante === 'object' && p.comprobante !== null) {
                        comprobanteObj = p.comprobante;
                      } else if (p.comprobante) {
                        comprobanteObj = comprobantes.find(c => c.id === p.comprobante) || null;
                      }
                      const comprobanteNombre = comprobanteObj ? comprobanteObj.nombre : '';
                      const comprobanteLetra = comprobanteObj ? comprobanteObj.letra : '';
                      const comprobanteTipo = comprobanteObj ? comprobanteObj.tipo : '';
                      const { icon, label } = getComprobanteIconAndLabel(comprobanteTipo, comprobanteNombre);
                      return (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center">{icon}</span>
                              {p.numero}
                              <EstadoBadge estado={p.estado} />
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{p.cliente}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{p.fecha}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{p.estado}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {label}
                              {comprobanteLetra && (label.startsWith('Factura') || label.startsWith('N. Cred') || label.startsWith('N. Deb')) ? ' ' + comprobanteLetra : ''}
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">${p.total}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex gap-2">
                              {p.tipo === 'Presupuesto' && p.estado === 'Abierto' ? (
                                <>
                                  <BotonEditar onClick={() => handleEdit(p)} />
                                  <BotonImprimir onClick={() => handleImprimir(p)} />
                                  <BotonVerDetalle onClick={() => openVistaTab(p)} />
                                  <BotonConvertir onClick={() => handleConvertir(p)} />
                                  <BotonEliminar onClick={() => handleDelete(p.id)} />
                                </>
                              ) : p.tipo === 'Venta' && p.estado === 'Cerrado' ? (
                                <>
                                  <BotonImprimir onClick={() => handleImprimir(p)} />
                                  <BotonVerDetalle onClick={() => openVistaTab(p)} />
                                  <BotonEliminar onClick={() => handleDelete(p.id)} />
                                </>
                              ) : (
                                <>
                                  <BotonVerDetalle onClick={() => openVistaTab(p)} />
                                  <BotonImprimir onClick={() => handleImprimir(p)} />
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
            {/* Vendedores: lista */}
            {activeTab === 'vendedores' && (
              <>
                <div className="flex justify-end mb-4">
                  <button
                    onClick={handleNuevoVendedor}
                    className="bg-black hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm"
                  >
                    <span className="text-lg">+</span> Nuevo Vendedor
                  </button>
                </div>
                <VendedoresTable
                  vendedores={vendedores}
                  onEdit={handleEditVendedor}
                  onDelete={handleDeleteVendedor}
                  search={searchVendedor}
                  setSearch={setSearchVendedor}
                />
              </>
            )}
            {/* Vendedores: nuevo/editar */}
            {(activeTab.startsWith('nuevo-vendedor') || activeTab.startsWith('editar-vendedor')) && (
              <div className="flex justify-center items-center min-h-[60vh]">
                <VendedorForm
                  initialData={editVendedorData}
                  onSave={handleSaveVendedor}
                  onCancel={() => closeTab(activeTab)}
                  loading={loadingVendedores}
                  error={errorVendedores}
                  localidades={localidades}
                />
              </div>
            )}
            {/* Presupuestos: nuevo/editar/vista */}
            {(activeTab.startsWith('nuevo-') || activeTab.startsWith('editar') || activeTab.startsWith('nueva-venta-') || activeTab.startsWith('vista-')) &&
             !activeTab.startsWith('nuevo-vendedor') && !activeTab.startsWith('editar-vendedor') && (
              activeTab.startsWith('nueva-venta-') ? (
                <VentaForm
                  onSave={async (payload) => {
                    await addVenta({ ...payload, tipo: 'Venta', estado: 'Cerrado' });
                    closeTab(activeTab);
                  }}
                  onCancel={() => closeTab(activeTab)}
                  initialData={null}
                  readOnlyOverride={false}
                  comprobantes={comprobantes}
                  tiposComprobante={tiposComprobante}
                  tipoComprobante={tipoComprobante}
                  setTipoComprobante={setTipoComprobante}
                  clientes={clientes}
                  plazos={plazos}
                  vendedores={vendedores}
                  sucursales={sucursales}
                  puntosVenta={puntosVenta}
                  loadingComprobantes={loadingComprobantes}
                  errorComprobantes={errorComprobantes}
                  productos={productos}
                  loadingProductos={loadingProductos}
                  familias={familias}
                  loadingFamilias={loadingFamilias}
                  proveedores={proveedores}
                  loadingProveedores={loadingProveedores}
                  alicuotas={alicuotas}
                  loadingAlicuotas={loadingAlicuotas}
                  errorProductos={errorProductos}
                  errorFamilias={errorFamilias}
                  errorProveedores={errorProveedores}
                  errorAlicuotas={errorAlicuotas}
                  autoSumarDuplicados={autoSumarDuplicados}
                  setAutoSumarDuplicados={setAutoSumarDuplicados}
                  ItemsGrid={ItemsGrid}
                />
              ) : activeTab.startsWith('vista-') ? (
                <PresupuestoVentaVista
                  data={tabs.find(t => t.key === activeTab)?.data}
                  clientes={clientes}
                  vendedores={vendedores}
                  plazos={plazos}
                  sucursales={sucursales}
                  puntosVenta={puntosVenta}
                  comprobantes={comprobantes}
                  onImprimir={handleImprimir}
                  onEliminar={async (id) => {
                    await handleDelete(id);
                    closeTab(activeTab);
                  }}
                  onCerrar={() => closeTab(activeTab)}
                />
              ) : (
                activeTab.startsWith('editar') ? (
                  <EditarPresupuestoForm
                    onSave={async (payload) => {
                      await updateVenta(editPresupuesto.id, { ...payload, tipoOriginal: editPresupuesto.tipo, estadoOriginal: editPresupuesto.estado });
                      closeTab(activeTab);
                    }}
                    onCancel={() => closeTab(activeTab)}
                    initialData={tabs.find(t => t.key === activeTab)?.data || editPresupuesto}
                    comprobantes={comprobantes}
                    tiposComprobante={tiposComprobante}
                    tipoComprobante={tipoComprobante}
                    setTipoComprobante={setTipoComprobante}
                    clientes={clientes}
                    plazos={plazos}
                    vendedores={vendedores}
                    sucursales={sucursales}
                    puntosVenta={puntosVenta}
                    productos={productos}
                    proveedores={proveedores}
                    alicuotas={alicuotas}
                    autoSumarDuplicados={autoSumarDuplicados}
                    setAutoSumarDuplicados={setAutoSumarDuplicados}
                    ItemsGrid={ItemsGrid}
                  />
                ) : (
                  <PresupuestoForm
                    onSave={async (payload) => {
                      await addVenta({ ...payload, tipo: 'Presupuesto', estado: 'Abierto' });
                      closeTab(activeTab);
                    }}
                    onCancel={() => closeTab(activeTab)}
                    initialData={tabs.find(t => t.key === activeTab)?.data || editPresupuesto}
                    readOnlyOverride={false}
                    comprobantes={comprobantes}
                    tiposComprobante={tiposComprobante}
                    tipoComprobante={tipoComprobante}
                    setTipoComprobante={setTipoComprobante}
                    clientes={clientes}
                    plazos={plazos}
                    vendedores={vendedores}
                    sucursales={sucursales}
                    puntosVenta={puntosVenta}
                    loadingComprobantes={loadingComprobantes}
                    errorComprobantes={errorComprobantes}
                    productos={productos}
                    loadingProductos={loadingProductos}
                    familias={familias}
                    loadingFamilias={loadingFamilias}
                    proveedores={proveedores}
                    loadingProveedores={loadingProveedores}
                    alicuotas={alicuotas}
                    loadingAlicuotas={loadingAlicuotas}
                    errorProductos={errorProductos}
                    errorFamilias={errorFamilias}
                    errorProveedores={errorProveedores}
                    errorAlicuotas={errorAlicuotas}
                    autoSumarDuplicados={autoSumarDuplicados}
                    setAutoSumarDuplicados={setAutoSumarDuplicados}
                    ItemsGrid={ItemsGrid}
                  />
                )
              )
            )}
            {tabs.map(tab => (
              activeTab === tab.key && tab.tipo === 'conventa' && (
                <ConVentaForm
                  key={tab.key}
                  presupuestoOrigen={tab.data.presupuestoOrigen}
                  itemsSeleccionados={tab.data.itemsSeleccionados}
                  onSave={(payload, tk) => {
                    console.info('[PresupuestosManager] onSave de ConVentaForm, tabKey:', tk);
                    handleConVentaFormSave(payload, tk);
                  }}
                  onCancel={() => handleConVentaFormCancel(tab.key)}
                  comprobantes={comprobantes}
                  ferreteria={null}
                  clientes={clientes}
                  plazos={plazos}
                  vendedores={vendedores}
                  sucursales={sucursales}
                  puntosVenta={puntosVenta}
                  loadingComprobantes={loadingComprobantes}
                  errorComprobantes={errorComprobantes}
                  productos={productos}
                  loadingProductos={loadingProductos}
                  familias={familias}
                  loadingFamilias={loadingFamilias}
                  proveedores={proveedores}
                  loadingProveedores={loadingProveedores}
                  alicuotas={alicuotas}
                  loadingAlicuotas={loadingAlicuotas}
                  errorProductos={errorProductos}
                  errorFamilias={errorFamilias}
                  errorProveedores={errorProveedores}
                  errorAlicuotas={errorAlicuotas}
                  autoSumarDuplicados={autoSumarDuplicados}
                  setAutoSumarDuplicados={setAutoSumarDuplicados}
                  tabKey={tab.key}
                />
              )
            ))}
          </div>
        </div>
      </div>
      
      <ConversionModal
        open={conversionModal.open}
        presupuesto={conversionModal.presupuesto}
        onClose={() => setConversionModal({ open: false, presupuesto: null })}
        onConvertir={handleConversionConfirm}
        clientes={clientes}
        vendedores={vendedores}
        plazos={plazos}
        sucursales={sucursales}
        puntosVenta={puntosVenta}
        comprobantes={comprobantes}
      />
    </div>
  );
};

export default PresupuestosManager; 