import React, { useState, useMemo } from 'react';
import Tabla from '../../Tabla';
import { formatearFecha } from '../../../utils/formatters';

const LibroIvaTable = ({ libroIva, loading }) => {
  const [filterTipo, setFilterTipo] = useState('');
  const [filterCondicion, setFilterCondicion] = useState('');
  const [valorBusqueda, setValorBusqueda] = useState('');

  // Función para formatear moneda
  const formatearMoneda = (valor) => {
    // Asegurar que el valor sea numérico
    const monto = typeof valor === 'string' ? parseFloat(valor) : valor;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(isNaN(monto) ? 0 : monto);
  };

  // Se usa formateador centralizado de ../../../utils/formatters

  // Función para filtrar datos específicos del libro IVA
  const datosLibroIvaFiltrados = useMemo(() => {
    if (!libroIva?.lineas) return [];

    return libroIva.lineas.filter(linea => {
      // Extraer letra del comprobante (último carácter)
      const letra = (linea.comprobante || '').trim().slice(-1);
      const cumpleTipo = !filterTipo || letra === filterTipo;
      const cumpleCondicion = !filterCondicion || linea.condicion_iva === filterCondicion;
      return cumpleTipo && cumpleCondicion;
    });
  }, [libroIva?.lineas, filterTipo, filterCondicion]);

  // Definición de columnas para el componente Tabla genérico
  const columnas = [
    {
      id: 'fecha',
      titulo: 'Fecha',
      render: (linea) => formatearFecha(linea.fecha),
    },
    {
      id: 'comprobante',
      titulo: 'Comprobante',
      render: (linea) => linea.comprobante,
    },
    {
      id: 'numero',
      titulo: 'Número',
      render: (linea) => linea.numero,
    },
    {
      id: 'cuit_cliente',
      titulo: 'CUIT',
      render: (linea) => linea.cuit_cliente,
    },
    {
      id: 'razon_social',
      titulo: 'Comprador',
      render: (linea) => (
        <span className="max-w-xs truncate" title={linea.razon_social}>
          {linea.razon_social}
        </span>
      ),
    },
    {
      id: 'condicion_iva',
      titulo: 'Cond.IVA',
      render: (linea) => linea.condicion_iva,
    },
    {
      id: 'neto_sin_iva',
      titulo: 'Neto (sin IVA)',
      align: 'right',
      render: (linea) => formatearMoneda(linea.neto_sin_iva),
    },
    {
      id: 'iva_21',
      titulo: 'IVA 21%',
      align: 'right',
      render: (linea) => formatearMoneda(linea.iva_21),
    },
    {
      id: 'iva_105',
      titulo: 'IVA 10.5%',
      align: 'right',
      render: (linea) => formatearMoneda(linea.iva_105),
    },
    {
      id: 'iva_27',
      titulo: 'IVA 27%',
      align: 'right',
      render: (linea) => formatearMoneda(linea.iva_27),
    },
    {
      id: 'importe_exento',
      titulo: 'Exentos',
      align: 'right',
      render: (linea) => formatearMoneda(linea.importe_exento),
    },
    {
      id: 'total',
      titulo: 'Total',
      align: 'right',
      render: (linea) => (
        <span className="font-medium">
          {formatearMoneda(linea.total)}
        </span>
      ),
    },
  ];

  // Función para renderizar cada fila personalizada
  const renderFila = (linea, indice) => {
    return (
      <tr key={linea.id} className="hover:bg-slate-100 transition-colors">
        <td className="px-4 py-3 text-sm border-b border-gray-200">
          {formatearFecha(linea.fecha)}
        </td>
        <td className="px-4 py-3 text-sm border-b border-gray-200">
          {linea.comprobante}
        </td>
        <td className="px-4 py-3 text-sm border-b border-gray-200">
          {linea.numero}
        </td>
        <td className="px-4 py-3 text-sm border-b border-gray-200">
          {linea.cuit}
        </td>
        <td className="px-4 py-3 text-sm border-b border-gray-200">
          {linea.razon_social}
        </td>
        <td className="px-4 py-3 text-sm border-b border-gray-200">
          {linea.condicion_iva}
        </td>
        <td className="px-4 py-3 text-sm border-b border-gray-200 text-right">
          {formatearMoneda(linea.neto_sin_iva)}
        </td>
        <td className="px-4 py-3 text-sm border-b border-gray-200 text-right">
          {formatearMoneda(linea.iva_21)}
        </td>
        <td className="px-4 py-3 text-sm border-b border-gray-200 text-right">
          {formatearMoneda(linea.iva_105)}
        </td>
        <td className="px-4 py-3 text-sm border-b border-gray-200 text-right">
          {formatearMoneda(linea.iva_27)}
        </td>
        <td className="px-4 py-3 text-sm border-b border-gray-200 text-right">
          {formatearMoneda(linea.importe_exento)}
        </td>
        <td className="px-4 py-3 text-sm border-b border-gray-200 text-right font-medium">
          {formatearMoneda(linea.total)}
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-center">
          <svg className="animate-spin h-8 w-8 text-orange-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-3 text-gray-600">Cargando datos del libro IVA...</span>
        </div>
      </div>
    );
  }

  if (!libroIva?.lineas || libroIva.lineas.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay datos</h3>
          <p className="mt-1 text-sm text-gray-500">
            No se encontraron comprobantes para el período seleccionado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con información del libro IVA */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Libro IVA Ventas - {libroIva.periodo?.mes?.toString().padStart(2, '0')}/{libroIva.periodo?.anio}
            </h3>
            <p className="text-sm text-gray-600">
              {datosLibroIvaFiltrados.length} comprobantes • Generado el {formatearFecha(libroIva.periodo?.fecha_generacion, true)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">
              Débito Fiscal Total
            </div>
            <div className="text-lg font-semibold text-green-600">
              {formatearMoneda(libroIva.subtotales?.debito_fiscal || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Filtros específicos del libro IVA */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Tipo:</label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Todos</option>
              <option value="A">Factura A</option>
              <option value="B">Factura B</option>
              <option value="C">Factura C</option>
              <option value="I">Interna</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Condición IVA:</label>
            <select
              value={filterCondicion}
              onChange={(e) => setFilterCondicion(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Todas</option>
              <option value="RI">Responsable Inscripto</option>
              <option value="CF">Consumidor Final</option>
              <option value="EX">Exento</option>
              <option value="MT">Monotributista</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla usando componente genérico */}
      <Tabla
        columnas={columnas}
        datos={datosLibroIvaFiltrados}
        valorBusqueda={valorBusqueda}
        onCambioBusqueda={setValorBusqueda}
        filasPorPaginaInicial={20}
        opcionesFilasPorPagina={[10, 20, 35, 50]}
        paginadorVisible={true}
        mostrarBuscador={true}
        mostrarOrdenamiento={false}
        renderFila={renderFila}
        cargando={loading}
      />
    </div>
  );
};

export default LibroIvaTable; 