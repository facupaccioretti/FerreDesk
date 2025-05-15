import React, { useState, useEffect } from 'react';
import Navbar from "./Navbar";
import { BotonConvertir, BotonEditar, BotonEliminar, BotonVinculado, BotonImprimir } from "./Botones";
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
import FacturaForm from './FacturaForm';
import ItemsGrid from './ItemsGrid';

const filtros = [
  { key: 'todos', label: 'Todos' },
  { key: 'presupuestos', label: 'Presupuestos' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'facturas', label: 'Facturas' }
];

// Badge de estado
const EstadoBadge = ({ estado }) => {
  if (estado === 'Cerrado') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        Cerrado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
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

const PresupuestosManager = () => {
  useEffect(() => {
    document.title = "Presupuestos y Ventas FerreDesk";
  }, []);

  const { ventas, loading, error, addVenta, updateVenta, deleteVenta } = useVentasAPI();
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
  const tiposComprobante = [
    { value: 1, label: 'Factura A', campo: 'cbt_facturaa' },
    { value: 2, label: 'Factura B', campo: 'cbt_facturab' },
    { value: 3, label: 'Remito', campo: 'cbt_remito' },
    { value: 4, label: 'Presupuesto', campo: 'cbt_presupuesto' },
    // Agrega más si necesitas
  ];
  const [tipoComprobante, setTipoComprobante] = useState(1); // 1=Factura A por defecto
  const [searchVendedor, setSearchVendedor] = useState('');
  const [editVendedorData, setEditVendedorData] = useState(null);
  const [busquedaProducto, setBusquedaProducto] = useState('');

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
    switch (filtro) {
      case 'presupuestos':
        return lista.filter(p => p.tipo === 'Presupuesto' && p.estado === 'Abierto');
      case 'ventas':
        return lista.filter(p => p.tipo === 'Venta');
      case 'facturas':
        return lista.filter(p => p.tipo === 'Factura');
      case 'todos':
      default:
        return lista;
    }
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
    localStorage.removeItem('presupuestoFormDraft');
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
    try {
      const response = await fetch(`/api/ventas/${presupuesto.id}/convertir-a-venta/`, { method: 'POST' });
      if (!response.ok) throw new Error('No se pudo convertir');
      // Opcional: recargar lista o mostrar mensaje
      window.location.reload();
    } catch (err) {
      alert('Error al convertir: ' + (err.message || ''));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este presupuesto/venta?')) {
      await deleteVenta(id);
    }
  };

  // Nueva función para abrir subtab de vista no editable
  const openVistaTab = (presupuesto) => {
    setTabs(prev => {
      if (prev.find(t => t.key === `vista-${presupuesto.id}`)) return prev;
      return [...prev, { key: `vista-${presupuesto.id}`, label: `Vista Presupuesto ${presupuesto.numero}`, closable: true, presupuestoId: presupuesto.id }];
    });
    setEditPresupuesto(presupuesto);
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
    return {
      ...venta,
      tipo: venta.tipo || 'Presupuesto',
      estado: venta.estado || 'Abierto',
      numero: venta.ven_numero || venta.numero || '',
      cliente: clientes.find(c => c.id === venta.ven_idcli)?.razon || venta.cliente || '',
      fecha: venta.ven_fecha || venta.fecha || new Date().toISOString().split('T')[0],
      total: venta.ven_total || venta.total || 0,
      id: venta.id || venta.ven_id || venta.pk,
      items: venta.items || [],
      plazoId: venta.ven_idpla || venta.plazoId || '',
      vendedorId: venta.ven_idvdo || venta.vendedorId || '',
      sucursalId: venta.ven_sucursal || venta.sucursalId || 1,
      puntoVentaId: venta.ven_punto || venta.puntoVentaId || 1,
      bonificacionGeneral: venta.bonificacionGeneral || 0,
      descu1: venta.ven_descu1 || venta.descu1 || 0,
      descu2: venta.ven_descu2 || venta.descu2 || 0,
      descu3: venta.ven_descu3 || venta.descu3 || 0,
      copia: venta.ven_copia || venta.copia || 1,
      cae: venta.ven_cae || venta.cae || '',
    };
  };

  // En el render, usar ventasNormalizadas en vez de ventas
  const ventasNormalizadas = ventas.map(normalizarVenta);

  return (
    <div className="h-full flex flex-col">
      <Navbar onLogout={() => {}} />
      <div className="flex justify-between items-center px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-800">Gestión de Presupuestos y Ventas</h2>
      </div>
      {error && (
        <div className="mx-6 mb-2 p-3 bg-red-100 text-red-800 rounded border border-red-300">
          {error}
        </div>
      )}
      <div className="flex flex-1 px-6 gap-4 min-h-0">
        <div className="flex-1 flex flex-col">
          {/* Tabs tipo browser, todas al mismo nivel */}
          <div className="flex items-center border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2">
            {tabs.map((tab, idx) => (
              <div
                key={tab.key}
                className={`flex items-center px-5 py-2 mr-2 rounded-t-xl cursor-pointer transition-colors ${activeTab === tab.key ? 'bg-white border border-b-0 border-gray-200 font-semibold text-gray-900' : 'bg-gray-100 text-gray-500'}`}
                onClick={() => setActiveTab(tab.key)}
                style={{ position: 'relative', zIndex: 1 }}
                draggable={tab.closable}
                onDragStart={tab.closable ? (e) => { setDraggedTabKey(tab.key); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                onDrop={tab.closable ? (e) => {
                  e.preventDefault();
                  if (draggedTabKey && draggedTabKey !== tab.key) {
                    const dynamicTabs = tabs.filter(t => t.closable);
                    const fixedTabs = tabs.filter(t => !t.closable);
                    const draggedIdx = dynamicTabs.findIndex(t => t.key === draggedTabKey);
                    const dropIdx = dynamicTabs.findIndex(t => t.key === tab.key);
                    if (draggedIdx !== -1 && dropIdx !== -1) {
                      const newDynamicTabs = [...dynamicTabs];
                      const [draggedTab] = newDynamicTabs.splice(draggedIdx, 1);
                      newDynamicTabs.splice(dropIdx, 0, draggedTab);
                      setTabs([...fixedTabs, ...newDynamicTabs]);
                    }
                  }
                  setDraggedTabKey(null);
                } : undefined}
                onDragEnd={() => { setDraggedTabKey(null); }}
              >
                {tab.label}
                {tab.closable && (
                  <button
                    onClick={e => { e.stopPropagation(); closeTab(tab.key); }}
                    className="ml-2 text-lg font-bold text-gray-400 hover:text-red-400 focus:outline-none"
                    title="Cerrar"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex-1 bg-white rounded-b-xl shadow-sm min-h-0 p-6">
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
                      onClick={() => {
                        const newKey = `nueva-venta-${Date.now()}`;
                        setTabs(prev => [...prev, { key: newKey, label: 'Nueva Venta', closable: true }]);
                        setActiveTab(newKey);
                        localStorage.removeItem('ventaFormDraft');
                      }}
                      className="bg-black hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm"
                    >
                      <span className="text-lg">+</span> Nueva Venta
                    </button>
                  ) : filtro === 'facturas' ? (
                    <button
                      onClick={() => {
                        const newKey = `nueva-factura-${Date.now()}`;
                        setTabs(prev => [...prev, { key: newKey, label: 'Nueva Factura', closable: true }]);
                        setActiveTab(newKey);
                        localStorage.removeItem('facturaFormDraft');
                      }}
                      className="bg-black hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm"
                    >
                      <span className="text-lg">+</span> Nueva Factura
                    </button>
                  ) : null}
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N°</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filtrar(ventasNormalizadas).map(p => {
                      // <-- CONSOLE LOG 3
                      console.log('[PresupuestosManager] Rendering row, item p:', p, 'Estado:', p.estado, 'Tipo:', p.tipo);
                      return (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {p.numero}
                              <EstadoBadge estado={p.estado} />
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{p.cliente}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{p.fecha}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{p.estado}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{p.tipo}</td>
                          <td className="px-3 py-2 whitespace-nowrap">${p.total}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex gap-2">
                              {p.estado === 'Abierto' ? (
                                <>
                                  <BotonEditar onClick={() => handleEdit(p)} />
                                  {p.tipo === 'Presupuesto' && <BotonConvertir onClick={() => handleConvertir(p)} />}
                                  <BotonEliminar onClick={() => handleDelete(p.id)} />
                                  <BotonImprimir onClick={() => handleImprimir(p)} title="Imprimir" />
                                </>
                              ) : (
                                <>
                                  <button
                                    title="Ver presupuesto"
                                    className="transition-colors px-1 py-1 text-gray-700 hover:text-black"
                                    onClick={() => openVistaTab(p)}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12Z" />
                                      <circle cx="12" cy="12" r="3" />
                                    </svg>
                                  </button>
                                  {p.tipo === 'Venta' && p.estado === 'Cerrado' && !p.facturada && (
                                    <BotonConvertir onClick={() => handleConvertir(p)} />
                                  )}
                                  {p.presupuestoOrigenId && (
                                    <BotonVinculado
                                      onClick={() => {
                                        const vinculado = ventas.find(x => x.id === p.presupuestoOrigenId);
                                        if (vinculado) openVistaTab(vinculado);
                                      }}
                                      title="Ver presupuesto vinculado"
                                    />
                                  )}
                                  <BotonImprimir onClick={() => handleImprimir(p)} title="Imprimir" />
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
            {(activeTab.startsWith('nuevo-') || activeTab.startsWith('editar') || activeTab.startsWith('vista-') || activeTab.startsWith('nueva-venta-') || activeTab.startsWith('nueva-factura-')) &&
             !activeTab.startsWith('nuevo-vendedor') && !activeTab.startsWith('editar-vendedor') && (
              activeTab.startsWith('nueva-venta-') ? (
                <VentaForm
                  onSave={async (payload, items) => {
                    await addVenta({ ...payload, tipo: 'Venta', estado: 'Abierto', items });
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
              ) : activeTab.startsWith('nueva-factura-') ? (
                <FacturaForm
                  onSave={async (payload, items) => {
                    await addVenta({ ...payload, tipo: 'Factura', estado: 'Abierto', items });
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
              ) : (
                <>
                  <PresupuestoForm
                    onSave={async (payload, items) => {
                      if (editPresupuesto && editPresupuesto.id) {
                        await updateVenta(editPresupuesto.id, { ...payload, tipoOriginal: editPresupuesto.tipo, estadoOriginal: editPresupuesto.estado, items });
                      } else {
                        await addVenta({ ...payload, tipo: 'Presupuesto', estado: 'Abierto', items });
                      }
                      closeTab(activeTab);
                    }}
                    onCancel={() => closeTab(activeTab)}
                    initialData={tabs.find(t => t.key === activeTab)?.data || editPresupuesto}
                    readOnlyOverride={activeTab.startsWith('vista-')}
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
                  {/* Botón Editar en la vista si el presupuesto está abierto */}
                  {activeTab.startsWith('vista-') && (tabs.find(t => t.key === activeTab)?.data || editPresupuesto)?.estado === 'Abierto' && (
                    <div className="flex justify-end mt-4">
                      <BotonEditar onClick={() => handleEdit((tabs.find(t => t.key === activeTab)?.data || editPresupuesto))} />
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresupuestosManager; 