/**
cambiar el nombre de esta carpeta 
 */
export const useFerreDeskTheme = () => {
  return {
    // Colores principales
    primario: "from-slate-800 to-slate-700",
    secundario: "ring-orange-500/20",
    azulSecundario: "text-blue-400",
    
    // Iconos
    iconoNaranja: "text-orange-600",
    
    // Tarjetas
    tarjeta: "bg-gradient-to-br from-slate-800 to-slate-700 rounded-lg shadow-md border border-slate-800 ring-1 ring-orange-500/20",
    tarjetaClara: "bg-white rounded-lg shadow-md border border-slate-200",
    tarjetaMetrica: "bg-gradient-to-br from-slate-800 to-slate-700 rounded-lg shadow-md border border-slate-800 ring-1 ring-orange-500/20 p-2 flex items-center space-x-2",
    
    // Contenedores
    contenedor: "bg-gradient-to-br from-slate-800 to-slate-700 rounded-lg shadow-lg border border-slate-800 ring-1 ring-orange-500/20 p-4",
    contenedorDashboard: "bg-gradient-to-br from-slate-800 to-slate-700 rounded-lg shadow-lg border border-slate-800 ring-1 ring-orange-500/20 p-3",
    
    // Fuentes
    fuente: "text-slate-300",
    fuenteSecundaria: "text-slate-400", 
    fuenteMuted: "text-slate-500",
    
    // Botones
    botonPrimario: "bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-lg px-4 py-2 transition-all duration-300 shadow-lg hover:shadow-xl text-sm font-semibold",
    botonSecundario: "bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg px-4 py-2 transition-all duration-300",
    botonManager: "bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white rounded-lg px-4 py-2 transition-all duration-300 shadow-lg hover:shadow-xl text-sm font-semibold",
    
    // Tabs
    tabActiva: "bg-gradient-to-r from-orange-600 to-orange-700 border border-b-0 border-orange-600 font-semibold text-white shadow-sm",
    tabInactiva: "bg-slate-600/50 text-slate-200 hover:bg-slate-600 hover:text-white",
    
    // Selects
    select: "text-sm font-semibold text-slate-300 bg-slate-800/70 border border-slate-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all duration-200",
    
    // Fondo de página
    fondo: "min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative",
    patron: "absolute inset-0 opacity-30",
    overlay: "absolute inset-0 bg-gradient-to-t from-slate-300/20 via-transparent to-slate-100/30",
    
    // Configuración de gráficos
    grafico: {
      titulo: "#e2e8f0",
      leyenda: "#cbd5e1", 
      ticks: "#94a3b8",
      grilla: "rgba(148, 163, 184, 0.15)"
    }
  };
};
