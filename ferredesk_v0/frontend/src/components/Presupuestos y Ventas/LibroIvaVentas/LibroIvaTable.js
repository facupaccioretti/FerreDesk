import React, { useState, useMemo, useCallback } from 'react';

const LibroIvaTable = ({ libroIva, loading }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [sortField, setSortField] = useState('fecha');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterCondicion, setFilterCondicion] = useState('');

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

  // Función para formatear fecha
  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-AR');
  };

  // Función para ordenar
  const ordenarDatos = useCallback((datos) => {
    return [...datos].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Convertir fechas para comparación
      if (sortField === 'fecha') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sortField, sortDirection]);

  // Función para filtrar
  const filtrarDatos = useCallback((datos) => {
    return datos.filter(linea => {
      // Extraer letra del comprobante (último carácter)
      const letra = (linea.comprobante || '').trim().slice(-1);
      const cumpleTipo = !filterTipo || letra === filterTipo;
      const cumpleCondicion = !filterCondicion || linea.condicion_iva === filterCondicion;
      return cumpleTipo && cumpleCondicion;
    });
  }, [filterTipo, filterCondicion]);

  // Procesar datos
  const datosProcesados = useMemo(() => {
    if (!libroIva?.lineas) return [];
    
    let datos = ordenarDatos(libroIva.lineas);
    datos = filtrarDatos(datos);
    return datos;
  }, [libroIva?.lineas, ordenarDatos, filtrarDatos]);

  // Calcular paginación
  const totalPages = Math.ceil(datosProcesados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const datosPaginados = datosProcesados.slice(startIndex, endIndex);

  // Función para cambiar ordenamiento
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Función para renderizar header de columna ordenable
  const renderSortableHeader = (field, label) => (
    <th
      onClick={() => handleSort(field)}
      className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={sortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
            />
          </svg>
        )}
      </div>
    </th>
  );

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
    <div className="bg-white rounded-xl shadow-lg border border-gray-100">
      {/* Header con información */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Libro IVA Ventas - {libroIva.periodo?.mes?.toString().padStart(2, '0')}/{libroIva.periodo?.anio}
            </h3>
            <p className="text-sm text-gray-600">
              {datosProcesados.length} comprobantes • Generado el {new Date(libroIva.periodo?.fecha_generacion).toLocaleString('es-AR')}
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

      {/* Filtros */}
      <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
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

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {renderSortableHeader('fecha', 'Fecha')}
              {renderSortableHeader('comprobante', 'Comprobante')}
              {renderSortableHeader('numero', 'Número')}
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                CUIT
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Comprador
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cond.IVA
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Neto (sin IVA)
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                IVA 21%
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                IVA 10.5%
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                IVA 27%
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Exentos
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {datosPaginados.map((linea, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                  {formatearFecha(linea.fecha)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                  {linea.comprobante}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                  {linea.numero}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                  {linea.cuit_cliente}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate">
                  {linea.razon_social}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                  {linea.condicion_iva}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                  {formatearMoneda(linea.neto_sin_iva)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                  {formatearMoneda(linea.iva_21)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                  {formatearMoneda(linea.iva_105)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                  {formatearMoneda(linea.iva_27)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                  {formatearMoneda(linea.importe_exento)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                  {formatearMoneda(linea.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {startIndex + 1} a {Math.min(endIndex, datosProcesados.length)} de {datosProcesados.length} resultados
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Anterior
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibroIvaTable; 