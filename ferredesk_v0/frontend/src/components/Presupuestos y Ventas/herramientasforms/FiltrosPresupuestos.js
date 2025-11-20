import React, { useState } from 'react';
import BotonNuevoComprobante from './BotonNuevoComprobante';

const tiposComprobanteUnicos = (comprobantes) => {
  // Tipos permitidos en el orden específico solicitado
  const tiposPermitidos = [
    { tipo: 'factura', label: 'Factura' },
    { tipo: 'factura_interna', label: 'Cotización' },
    { tipo: 'presupuesto', label: 'Presupuesto' },
    { tipo: 'nota_credito', label: 'Nota de Crédito' },
    { tipo: 'nota_credito_interna', label: 'Modif. de Contenido' },
    { tipo: 'nota_debito', label: 'Nota de Débito' },
    { tipo: 'nota_debito_interna', label: 'Extensión de Contenido' }
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
  onFiltroChange,
  onNuevoPresupuesto,
  onNuevaVenta,
  onNuevaNotaCredito,
  onNuevaModificacionContenido,
  onNuevaNotaDebito,
  onNuevaExtensionContenido,
  onEliminarPresupuestosViejos
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

  // Constantes de clases para el formato compacto
  const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
  const CLASES_INPUT = "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
  const CLASES_FILTRO = "bg-white border border-slate-200 rounded-md p-2 h-16 flex flex-col justify-between"

  return (
    <div className="flex items-start gap-3 w-full">
      {/* Tipo de Comprobante */}
      <div className={`${CLASES_FILTRO} flex-1`}>
        <div className={CLASES_ETIQUETA}>Tipo de Comprobante</div>
        <div className="mt-0.5">
          <select
            name="comprobanteTipo"
            value={comprobanteTipo || ''}
            onChange={handleTipoComprobanteChange}
            className={CLASES_INPUT}
          >
            <option value="">Todos</option>
            {tipos.map(tipo => (
              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Letra (solo si hay múltiples letras) */}
      {mostrarLetra && (
        <div className={`${CLASES_FILTRO} flex-1`}>
          <div className={CLASES_ETIQUETA}>Letra</div>
          <div className="mt-0.5">
            <select
              name="comprobanteLetra"
              value={comprobanteLetra || ''}
              onChange={handleLetraChange}
              className={CLASES_INPUT}
            >
              <option value="">Todas</option>
              {letras.map(letra => (
                <option key={letra} value={letra}>{letra}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Fecha Desde */}
      <div className={`${CLASES_FILTRO} flex-1`}>
        <div className={CLASES_ETIQUETA}>Desde</div>
        <div className="mt-0.5">
          <input
            type="date"
            value={fechaDesde || ''}
            onChange={handleFechaDesdeChange}
            className={CLASES_INPUT}
          />
        </div>
      </div>

      {/* Fecha Hasta */}
      <div className={`${CLASES_FILTRO} flex-1`}>
        <div className={CLASES_ETIQUETA}>Hasta</div>
        <div className="mt-0.5">
          <input
            type="date"
            value={fechaHasta || ''}
            onChange={handleFechaHastaChange}
            className={CLASES_INPUT}
          />
        </div>
      </div>

      {/* Cliente */}
      <div className={`${CLASES_FILTRO} flex-1 relative`}>
        <div className={CLASES_ETIQUETA}>Cliente</div>
        <div className="mt-0.5">
          <input
            type="text"
            value={clienteInput}
            onChange={handleClienteInputChange}
            onFocus={() => setShowClienteDropdown(true)}
            onBlur={handleClienteBlur}
            placeholder="Buscar cliente..."
            className={CLASES_INPUT}
          />
          {showClienteDropdown && sugerenciasClientes.length > 0 && (
            <ul className="absolute z-10 bg-white border border-slate-200 rounded-md mt-1 w-full max-h-56 overflow-auto shadow-lg">
              {sugerenciasClientes.map(c => (
                <li
                  key={c.id}
                  className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-xs"
                  onMouseDown={() => handleClienteSelect(c)}
                >
                  <span className="font-medium">{c.razon || c.nombre}</span>
                  {c.cuit ? <span className="ml-2 text-slate-500">{c.cuit}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Vendedor */}
      <div className={`${CLASES_FILTRO} flex-1`}>
        <div className={CLASES_ETIQUETA}>Vendedor</div>
        <div className="mt-0.5">
          <select
            value={vendedorId || ''}
            onChange={handleVendedorChange}
            className={CLASES_INPUT}
          >
            <option value="">Todos</option>
            {vendedores.map(v => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Botones de Acciones */}
      <div className={`${CLASES_FILTRO} flex-1`}>
        <div className={CLASES_ETIQUETA}>Acciones</div>
        <div className="mt-0.5 flex gap-2 items-center">
                <BotonNuevoComprobante
                  onNuevoPresupuesto={onNuevoPresupuesto}
                  onNuevaVenta={onNuevaVenta}
                  onNuevaNotaCredito={onNuevaNotaCredito}
                  onNuevaModificacionContenido={onNuevaModificacionContenido}
                  onNuevaNotaDebito={onNuevaNotaDebito}
                  onNuevaExtensionContenido={onNuevaExtensionContenido}
                />
          <button
            onClick={onEliminarPresupuestosViejos}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 rounded-lg flex items-center gap-1 text-xs px-3 py-1 h-8"
            title="Eliminar Presupuestos Viejos"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FiltrosPresupuestos; 