import React, { useEffect, useState } from 'react';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { useStockBajoAPI } from '../../utils/useStockBajoAPI';
import Tabla from '../Tabla';
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme";

const StockBajoList = () => {
  const theme = useFerreDeskTheme();
  const { productos, loading, error, totalProductos, obtenerProductosStockBajo, generarPDF } = useStockBajoAPI();
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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

  const columnas = [
    { id: 'codigo_venta', titulo: 'Código', align: 'left', ancho: '120px' },
    { id: 'denominacion', titulo: 'Denominación', align: 'left' },
    { id: 'cantidad_minima', titulo: 'Stock Mínimo', align: 'center', ancho: '120px' },
    {
      id: 'stock_total',
      titulo: 'Stock Actual',
      align: 'center',
      ancho: '120px',
      render: (fila) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${fila.stock_total <= 0
            ? 'bg-red-100 text-red-800'
            : 'bg-orange-100 text-orange-800'
          }`}>
          {fila.stock_total}
        </span>
      )
    },
    {
      id: 'diferencia',
      titulo: 'Diferencia',
      align: 'center',
      ancho: '100px',
      render: (fila) => (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
          {fila.diferencia}
        </span>
      )
    },
    {
      id: 'proveedor',
      titulo: 'Proveedor',
      align: 'left',
      render: (fila) => fila.proveedor_razon || fila.proveedor_fantasia || 'Sin proveedor'
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Mini Header / Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 py-2 px-4 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
            <Inventory2OutlinedIcon className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-tight">Reposición</span>
            <p className="text-sm font-bold text-slate-900 leading-none">{totalProductos} productos</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all duration-200 font-semibold flex items-center gap-2 text-xs shadow-sm disabled:opacity-50"
          >
            <RefreshOutlinedIcon className="w-4 h-4" />
            Actualizar
          </button>

          <button
            onClick={handleGenerarPDF}
            disabled={generandoPDF || loading || productos.length === 0}
            className={theme.botonPrimario + " !py-2 !h-auto flex items-center gap-2 text-xs"}
          >
            <PictureAsPdfOutlinedIcon className="w-4 h-4" />
            {generandoPDF ? 'Generando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <p className="text-red-800 font-medium text-xs">{error}</p>
        </div>
      )}

      {/* Tabla Principal - Sin scroll propio, fluye con el contenedor */}
      <div className="w-full">
        <Tabla
          columnas={columnas}
          datos={productos}
          cargando={loading}
          valorBusqueda={searchTerm}
          onCambioBusqueda={setSearchTerm}
          filasPorPaginaInicial={20}
          mostrarOrdenamiento={true}
          tamañoEncabezado="pequeño"
          filasCompactas={true}
        />
      </div>

      {/* Footer Minimalista */}
      {!loading && productos.length > 0 && (
        <div className="flex justify-end pr-2">
          <span className="text-[10px] text-slate-400 font-medium italic">
            Sincronizado: {new Date().toLocaleTimeString('es-AR')}
          </span>
        </div>
      )}
    </div>
  );
};

export default StockBajoList;