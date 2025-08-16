import React from 'react'

const DenominacionSugerenciasTooltip = ({ sugerencias, onIgnorar, isLoading, error, mostrarTooltip, onToggle }) => {

  if (isLoading) {
    return (
      <div className="absolute z-[9999] mt-2 p-2 bg-slate-50 border border-slate-200 rounded-sm shadow-lg max-w-md">
        <div className="flex items-center text-slate-700">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-600 mr-2"></div>
          <span className="text-xs">Buscando productos similares...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="absolute z-[9999] mt-2 p-2 bg-red-50 border border-red-200 rounded-sm shadow-lg max-w-md">
        <div className="flex items-center text-red-700">
          <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-xs">Error: {error}</span>
        </div>
      </div>
    )
  }

  if (!sugerencias || !mostrarTooltip) {
    return null
  }

  const agruparPorTipo = (productos) => {
    const grupos = {
      exacta: [],
      dimensiones: [],
      especificaciones: [],
      parcial: []
    }
    
    productos.forEach(producto => {
      grupos[producto.tipo_similitud].push(producto)
    })
    
    return grupos
  }

  const obtenerColorTipo = (tipo) => {
    switch (tipo) {
      case 'exacta': return 'text-red-600 bg-red-50 border-red-200'
      case 'dimensiones': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'especificaciones': return 'text-amber-600 bg-amber-50 border-amber-200'
      case 'parcial': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-slate-600 bg-slate-50 border-slate-200'
    }
  }

  const obtenerTextoSimilitud = (tipo) => {
    switch (tipo) {
      case 'exacta': return 'Exacta'
      case 'dimensiones': return 'Dimensiones'
      case 'especificaciones': return 'Especificaciones'
      case 'parcial': return 'Parcial'
      default: return 'Parcial'
    }
  }

  const grupos = agruparPorTipo(sugerencias.productos_similares)

  return (
    <div className="absolute z-[9999] mt-2 p-3 bg-white border border-slate-200 rounded-sm shadow-lg max-w-2xl max-h-80 overflow-y-auto">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-semibold text-slate-800">
          Productos similares encontrados
        </h4>
        <button
          onClick={onToggle}
          className="text-slate-400 hover:text-slate-600"
          aria-label="Cerrar sugerencias"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="text-xs text-slate-600 mb-2">
        {sugerencias.sugerencia}
      </div>

      <div className="space-y-2">
        {Object.entries(grupos).map(([tipo, productos]) => {
          if (productos.length === 0) return null
          
          return (
            <div key={tipo} className="border border-slate-100 rounded-sm overflow-hidden">
              <div className={`px-2 py-1 text-[10px] font-medium ${obtenerColorTipo(tipo)}`}>
                {tipo.charAt(0).toUpperCase() + tipo.slice(1)} ({productos.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-1 py-1 text-left font-medium text-slate-700">Cód. Venta</th>
                      <th className="px-1 py-1 text-left font-medium text-slate-700">Cód. Compra</th>
                      <th className="px-1 py-1 text-left font-medium text-slate-700">Denominación</th>
                      <th className="px-1 py-1 text-left font-medium text-slate-700">Unidad</th>
                      <th className="px-1 py-1 text-left font-medium text-slate-700 w-20">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((producto, index) => (
                      <tr key={index} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-1 py-1 text-slate-900 font-mono">{producto.codigo_venta}</td>
                        <td className="px-1 py-1 text-slate-900 font-mono">{producto.codigo_compra}</td>
                        <td className="px-1 py-1 text-slate-900 max-w-32 truncate" title={producto.denominacion}>
                          {producto.denominacion}
                        </td>
                        <td className="px-1 py-1 text-slate-600">{producto.unidad}</td>
                        <td className="px-1 py-1">
                          <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${obtenerColorTipo(producto.tipo_similitud)}`}>
                            {obtenerTextoSimilitud(producto.tipo_similitud)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2 pt-2 border-t border-slate-200">
        <button
          onClick={onIgnorar}
          className="text-xs text-slate-500 hover:text-slate-700 underline"
        >
          Ignorar sugerencias
        </button>
      </div>
    </div>
  )
}

export default DenominacionSugerenciasTooltip 