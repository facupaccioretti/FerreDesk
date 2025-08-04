import React, { useEffect, useState } from 'react';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { useStockBajoAPI } from '../../utils/useStockBajoAPI';

const StockBajoList = () => {
  const { productos, loading, error, totalProductos, obtenerProductosStockBajo, generarPDF } = useStockBajoAPI();
  const [generandoPDF, setGenerandoPDF] = useState(false);

  useEffect(() => {
    document.title = "Informe Stock Bajo - FerreDesk";
  }, []);

  const handleGenerarPDF = async () => {
    setGenerandoPDF(true);
    try {
      await generarPDF();
    } finally {
      setGenerandoPDF(false);
    }
  };

  const handleRefresh = () => {
    obtenerProductosStockBajo();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30">
      <div className="py-8 px-4">
        <div className="max-w-[1400px] w-full mx-auto">
          {/* Header en el fondo */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Informe de Stock Bajo</h2>
            <p className="text-slate-600 mt-1">Productos que requieren reposición de stock</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
            {/* Botones de acción */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-end mb-6 gap-4">
              <div className="flex gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all duration-200 font-semibold flex items-center gap-2 text-sm shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshOutlinedIcon className="w-4 h-4" />
                  {loading ? 'Actualizando...' : 'Actualizar'}
                </button>
                
                <button
                  onClick={handleGenerarPDF}
                  disabled={generandoPDF || loading || productos.length === 0}
                  className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 text-sm shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PictureAsPdfOutlinedIcon className="w-4 h-4" />
                  {generandoPDF ? 'Generando PDF...' : 'Generar PDF'}
                </button>
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <Inventory2OutlinedIcon className="w-7 h-7 text-slate-600" />
                <div>
                  <h3 className="font-semibold text-slate-800 text-lg">
                    Resumen
                  </h3>
                  <p className="text-slate-600">
                    {totalProductos} producto{totalProductos !== 1 ? 's' : ''} con stock bajo
                  </p>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            )}

            {/* Tabla */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full bg-white">
                <thead>
                  <tr className="bg-slate-700 text-white text-sm">
                    <th className="py-3 px-4 text-left font-semibold">Código</th>
                    <th className="py-3 px-4 text-left font-semibold">Denominación</th>
                    <th className="py-3 px-4 text-center font-semibold">Stock Mínimo</th>
                    <th className="py-3 px-4 text-center font-semibold">Stock Actual</th>
                    <th className="py-3 px-4 text-center font-semibold">Diferencia</th>
                    <th className="py-3 px-4 text-left font-semibold">Proveedor</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        Cargando productos...
                      </td>
                    </tr>
                  ) : productos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        {error ? 'Error al cargar datos' : 'No hay productos con stock bajo'}
                      </td>
                    </tr>
                  ) : (
                    productos.map((producto, index) => (
                      <tr key={producto.id} className={`border-b last:border-b-0 hover:bg-slate-50 transition-all ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {producto.codigo_venta}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {producto.denominacion}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-slate-900">
                          {producto.cantidad_minima}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            producto.stock_total <= 0 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {producto.stock_total}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            {producto.diferencia}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {producto.proveedor_razon || producto.proveedor_fantasia || 'Sin proveedor'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            {productos.length > 0 && (
              <div className="mt-6 text-center text-sm text-slate-500">
                <p>Última actualización: {new Date().toLocaleString('es-AR')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockBajoList; 