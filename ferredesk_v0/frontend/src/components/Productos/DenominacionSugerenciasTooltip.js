import React from 'react'

const DenominacionSugerenciasTooltip = ({ sugerencias, onIgnorar, isLoading, error, mostrarTooltip, onToggle }) => {
  if (isLoading) {
    return (
      <div className="absolute z-50 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-lg max-w-2xl">
        <div className="flex items-center text-blue-700">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
          <span className="text-sm">Buscando productos similares...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="absolute z-50 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg shadow-lg max-w-2xl">
        <div className="flex items-center text-red-700">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm">Error: {error}</span>
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
      case 'exacta': return 'text-red-600 bg-red-50'
      case 'dimensiones': return 'text-orange-600 bg-orange-50'
      case 'especificaciones': return 'text-yellow-600 bg-yellow-50'
      case 'parcial': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-600 bg-gray-50'
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
    <div className="absolute z-50 mt-2 p-4 bg-white border border-gray-200 rounded-lg shadow-lg max-w-4xl max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-semibold text-gray-800">
          Productos similares encontrados
        </h4>
        <div className="flex space-x-2">
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-gray-600 text-sm"
            aria-label="Cerrar sugerencias"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-3">
        {sugerencias.sugerencia}
      </div>

      <div className="space-y-3">
        {Object.entries(grupos).map(([tipo, productos]) => {
          if (productos.length === 0) return null
          
          return (
            <div key={tipo} className="border border-gray-100 rounded-lg overflow-hidden">
              <div className={`px-3 py-2 text-xs font-medium ${obtenerColorTipo(tipo)}`}>
                {tipo.charAt(0).toUpperCase() + tipo.slice(1)} ({productos.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium text-gray-700">Código Venta</th>
                      <th className="px-2 py-1 text-left font-medium text-gray-700">Código Compra</th>
                      <th className="px-2 py-1 text-left font-medium text-gray-700">Denominación</th>
                      <th className="px-2 py-1 text-left font-medium text-gray-700">Unidad</th>
                      <th className="px-3 py-1 text-left font-medium text-gray-700 w-32">Similitud</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((producto, index) => (
                      <tr key={index} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-2 py-1 text-gray-900 font-mono">{producto.codigo_venta}</td>
                        <td className="px-2 py-1 text-gray-900 font-mono">{producto.codigo_compra}</td>
                        <td className="px-2 py-1 text-gray-900 max-w-xs truncate" title={producto.denominacion}>
                          {producto.denominacion}
                        </td>
                        <td className="px-2 py-1 text-gray-600">{producto.unidad}</td>
                        <td className="px-3 py-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${obtenerColorTipo(producto.tipo_similitud)}`}>
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

      <div className="mt-3 pt-3 border-t border-gray-200">
        <button
          onClick={onIgnorar}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Ignorar sugerencias
        </button>
      </div>
    </div>
  )
}

export default DenominacionSugerenciasTooltip 