import React, { useState } from 'react';

const tiposComprobanteUnicos = (comprobantes) => {
  // Tipos permitidos en el orden específico solicitado
  const tiposPermitidos = [
    { tipo: 'factura', label: 'Factura' },
    { tipo: 'factura_interna', label: 'Cotización' },
    { tipo: 'presupuesto', label: 'Presupuesto' },
    { tipo: 'nota_credito', label: 'Nota de Crédito' }
  ];
  
  // Obtener tipos únicos de los comprobantes
  const tiposExistentes = Array.from(new Set(comprobantes.map(c => (c.tipo || '').toLowerCase())));
  
  // Filtrar y ordenar según el orden específico
  return tiposPermitidos
    .filter(tipoPermitido => tiposExistentes.includes(tipoPermitido.tipo))
    .map(tipoPermitido => ({
      value: tipoPermitido.tipo, // Tipo original para enviar al backend
      label: tipoPermitido.label // Label específico para mostrar
    }));
};

const letrasUnicasPorTipo = (comprobantes, tipo) => {
  return Array.from(new Set(
    comprobantes.filter(c => (c.tipo || '').toLowerCase() === tipo.toLowerCase())
      .map(c => c.letra)
  )).filter(Boolean);
};

const FiltrosPresupuestos = ({
  comprobantes = [],
  clientes = [],
  vendedores = [],
  comprobanteTipo,
  setComprobanteTipo,
  comprobanteLetra,
  setComprobanteLetra,
  fechaDesde,
  setFechaDesde,
  fechaHasta,
  setFechaHasta,
  clienteId,
  setClienteId,
  vendedorId,
  setVendedorId,
  onFiltroChange
}) => {
  const tipos = tiposComprobanteUnicos(comprobantes);
  const letras = comprobanteTipo ? letrasUnicasPorTipo(comprobantes, comprobanteTipo) : [];
  const mostrarLetra = letras.length > 1;

  // Autocomplete para clientes
  const [clienteInput, setClienteInput] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  const sugerenciasClientes = clienteInput.length >= 2
    ? clientes.filter(c =>
        (c.razon || '').toLowerCase().includes(clienteInput.toLowerCase()) ||
        (c.nombre || '').toLowerCase().includes(clienteInput.toLowerCase())
      )
    : [];

  // Handlers controlados
  const handleTipoComprobanteChange = (e) => {
    setComprobanteTipo(e.target.value);
    setComprobanteLetra('');
    onFiltroChange && onFiltroChange({
      comprobanteTipo: e.target.value,
      comprobanteLetra: '',
      fechaDesde,
      fechaHasta,
      clienteId,
      vendedorId
    });
  };

  const handleLetraChange = (e) => {
    setComprobanteLetra(e.target.value);
    onFiltroChange && onFiltroChange({
      comprobanteTipo,
      comprobanteLetra: e.target.value,
      fechaDesde,
      fechaHasta,
      clienteId,
      vendedorId
    });
  };

  const handleFechaDesdeChange = (e) => {
    setFechaDesde(e.target.value);
    onFiltroChange && onFiltroChange({
      comprobanteTipo,
      comprobanteLetra,
      fechaDesde: e.target.value,
      fechaHasta,
      clienteId,
      vendedorId
    });
  };

  const handleFechaHastaChange = (e) => {
    setFechaHasta(e.target.value);
    onFiltroChange && onFiltroChange({
      comprobanteTipo,
      comprobanteLetra,
      fechaDesde,
      fechaHasta: e.target.value,
      clienteId,
      vendedorId
    });
  };

  // Nuevo: autocomplete de clientes
  const handleClienteInputChange = (e) => {
    const value = e.target.value;
    setClienteInput(value);
    setShowClienteDropdown(true);
    if (value.length === 0) {
      setClienteId('');
      onFiltroChange && onFiltroChange({
        comprobanteTipo,
        comprobanteLetra,
        fechaDesde,
        fechaHasta,
        clienteId: '',
        vendedorId
      });
    }
  };

  const handleClienteSelect = (c) => {
    setClienteId(c.id);
    setClienteInput(c.razon || c.nombre);
    setShowClienteDropdown(false);
    onFiltroChange && onFiltroChange({
      comprobanteTipo,
      comprobanteLetra,
      fechaDesde,
      fechaHasta,
      clienteId: c.id,
      vendedorId
    });
  };

  const handleClienteBlur = () => {
    setTimeout(() => setShowClienteDropdown(false), 150);
  };

  const handleVendedorChange = (e) => {
    setVendedorId(e.target.value);
    onFiltroChange && onFiltroChange({
      comprobanteTipo,
      comprobanteLetra,
      fechaDesde,
      fechaHasta,
      clienteId,
      vendedorId: e.target.value
    });
  };

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-white rounded-lg shadow-sm">
      <div className="flex-1 min-w-[180px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Comprobante</label>
        <select
          name="comprobanteTipo"
          value={comprobanteTipo || ''}
          onChange={handleTipoComprobanteChange}
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {tipos.map(tipo => (
            <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
          ))}
        </select>
      </div>
      {mostrarLetra && (
        <div className="flex-1 min-w-[120px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Letra</label>
          <select
            name="comprobanteLetra"
            value={comprobanteLetra || ''}
            onChange={handleLetraChange}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Todas</option>
            {letras.map(letra => (
              <option key={letra} value={letra}>{letra}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex-1 min-w-[140px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha desde</label>
        <input
          type="date"
          value={fechaDesde || ''}
          onChange={handleFechaDesdeChange}
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>
      <div className="flex-1 min-w-[140px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha hasta</label>
        <input
          type="date"
          value={fechaHasta || ''}
          onChange={handleFechaHastaChange}
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>
      <div className="flex-1 min-w-[220px] relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
        <input
          type="text"
          value={clienteInput}
          onChange={handleClienteInputChange}
          onFocus={() => setShowClienteDropdown(true)}
          onBlur={handleClienteBlur}
          placeholder="Buscar cliente..."
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
        {showClienteDropdown && sugerenciasClientes.length > 0 && (
          <ul className="absolute z-10 bg-white border border-gray-200 rounded-lg mt-1 w-full max-h-56 overflow-auto shadow-lg">
            {sugerenciasClientes.map(c => (
              <li
                key={c.id}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                onMouseDown={() => handleClienteSelect(c)}
              >
                <span className="font-semibold">{c.razon || c.nombre}</span>
                {c.cuit ? <span className="ml-2 text-xs text-gray-500">{c.cuit}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex-1 min-w-[180px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">Vendedor</label>
        <select
          value={vendedorId || ''}
          onChange={handleVendedorChange}
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {vendedores.map(v => (
            <option key={v.id} value={v.id}>{v.nombre}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default FiltrosPresupuestos; 