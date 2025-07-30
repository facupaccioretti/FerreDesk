import React, { useState, useEffect } from 'react';
import Navbar from '../../Navbar';
import { useLibroIvaAPI } from '../../../utils/useLibroIVAAPI';
import LibroIvaPeriodoSelector from './LibroIvaPeriodoSelector';
import LibroIvaTable from './LibroIvaTable';
import LibroIvaExport from './LibroIvaExport';

const LibroIvaVentasManager = () => {
  const [user, setUser] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null);
  
  
  const {
    libroIva,
    loading,
    error,
    validaciones,
    generarLibroIva,
    exportarLibroIva,
    limpiarLibroIva,
  } = useLibroIvaAPI();

  useEffect(() => {
    document.title = "Libro IVA Ventas - FerreDesk";
    
    // Obtener información del usuario desde localStorage
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
      try {
        setUser(JSON.parse(userInfo));
      } catch (error) {
        console.error('Error al parsear información del usuario:', error);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const handleGenerarLibro = async (mes, anio, tipoLibro = 'convencional', incluirPresupuestos = false) => {
    try {
      setPeriodoSeleccionado({ mes, anio, tipoLibro, incluirPresupuestos });
      await generarLibroIva(mes, anio, tipoLibro, incluirPresupuestos);
    } catch (error) {
      console.error('Error al generar libro IVA:', error);
    }
  };

  const handleExportar = async (formato, mes, anio, tipoLibro = 'convencional', incluirPresupuestos = false) => {
    try {
      await exportarLibroIva(formato, mes, anio, tipoLibro, incluirPresupuestos);
    } catch (error) {
      console.error('Error al exportar:', error);
      throw error;
    }
  };

  const handleNuevoPeriodo = () => {
    limpiarLibroIva();
    setPeriodoSeleccionado(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={handleLogout} />
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Libro IVA Ventas
              </h1>
              <p className="mt-2 text-gray-600">
                Genera y exporta el Libro IVA Ventas para cumplimiento fiscal
              </p>
            </div>
            {libroIva && (
              <button
                onClick={handleNuevoPeriodo}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Nuevo Período
              </button>
            )}
          </div>
        </div>

        {/* Selector de Período */}
        {!libroIva && (
          <div className="mb-8">
            <LibroIvaPeriodoSelector
              onGenerar={handleGenerarLibro}
              loading={loading}
            />
          </div>
        )}

        {/* Mensaje de Error */}
        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-lg font-medium text-red-800">Error</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Validaciones */}
        {validaciones && (validaciones.errores.length > 0 || validaciones.advertencias.length > 0) && (
          <div className="mb-8">
            {validaciones.errores.length > 0 && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-6">
                <h3 className="text-lg font-medium text-red-800 mb-3">Errores Encontrados</h3>
                <ul className="space-y-1">
                  {validaciones.errores.map((error, index) => (
                    <li key={index} className="text-red-700 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {validaciones.advertencias.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                <h3 className="text-lg font-medium text-yellow-800 mb-3">Advertencias</h3>
                <ul className="space-y-1">
                  {validaciones.advertencias.map((advertencia, index) => (
                    <li key={index} className="text-yellow-700 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      {advertencia}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tabla del Libro IVA */}
        {libroIva && (
          <div className="mb-8">
            <LibroIvaTable 
              libroIva={libroIva}
              periodoSeleccionado={periodoSeleccionado}
            />
          </div>
        )}

        {/* Exportación */}
        {libroIva && (
          <div className="mb-8">
            <LibroIvaExport
              libroIva={libroIva}
              onExportar={handleExportar}
              periodoSeleccionado={periodoSeleccionado}
              loading={loading}
            />
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Generando Libro IVA...</span>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default LibroIvaVentasManager;