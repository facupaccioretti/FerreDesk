import React, { useState, useEffect } from 'react';

function PrecioExcelItem({ proveedorId, codigoProducto }) {
  const [precio, setPrecio] = useState(null);
  const [error, setError] = useState('');
  const [origen, setOrigen] = useState('');
  const [fecha, setFecha] = useState('');

  useEffect(() => {
    if (proveedorId && codigoProducto) {
      fetch(`/api/productos/precio-producto-proveedor/?proveedor_id=${proveedorId}&codigo_producto=${encodeURIComponent(codigoProducto)}`)
        .then(res => res.json())
        .then(data => {
          if (data.precio) {
            setPrecio(data.precio);
            setOrigen(data.origen || '');
            setFecha(data.fecha || '');
            setError('');
          } else {
            setPrecio(null);
            setOrigen('');
            setFecha('');
            setError(data.detail || 'Sin precio Excel');
          }
        })
        .catch(() => {
          setPrecio(null);
          setOrigen('');
          setFecha('');
          setError('Error al consultar precio Excel');
        });
    } else {
      setPrecio(null);
      setOrigen('');
      setFecha('');
      setError('');
    }
  }, [proveedorId, codigoProducto]);

  if (precio !== null) {
    return (
      <span className="text-blue-700">
        ${precio}
        {origen && (
          <span className="ml-2 text-xs text-gray-500">({origen === 'manual' ? 'manual' : 'excel'}{fecha ? `, ${new Date(fecha).toLocaleString()}` : ''})</span>
        )}
      </span>
    );
  }
  if (error) return <span className="text-red-600">{error}</span>;
  return null;
}

export default PrecioExcelItem; 