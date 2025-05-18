import React, { useState, useEffect } from 'react';

// Función para obtener el token CSRF de la cookie
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Este modal es usado tanto por Editar Producto como por Nuevo Producto.
// Debe ser agnóstico al modo y funcionar correctamente en ambos contextos.
// El handler onAsociarCodigoPendiente debe distinguir el contexto (edición/nuevo) y actuar en consecuencia.
// PREVENCIÓN: Siempre pasar producto/productoId correctos como props. Si se cambia de pestaña, asegurarse de cerrar el modal o refrescar las props.
// Si el modal se abre para un producto y se cambia de pestaña, podría quedar desincronizado: Solución -> cerrar el modal al cambiar de producto o pestaña.
// Los mensajes y refresco de vista dependen del handler y del cierre automático del modal.
// Cada proveedor usa sus propios códigos, las coincidencias entre proveedores son casuales y permitidas. El código solo tiene sentido dentro del contexto de cada proveedor.
const AsociarCodigoProveedorModal = ({ open, onClose, producto, productoId, proveedores, onAsociarCodigoPendiente }) => {
  const [selectedProveedor, setSelectedProveedor] = useState('');
  const [codigoProveedor, setCodigoProveedor] = useState('');
  const [codigosSugeridos, setCodigosSugeridos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [costo, setCosto] = useState('');
  const [cargandoCosto, setCargandoCosto] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedProveedor('');
      setCodigoProveedor('');
      setCodigosSugeridos([]);
      setMessage(null);
      setError(null);
      setCosto('');
    }
  }, [open]);

  useEffect(() => {
    if (selectedProveedor) {
      setLoading(true);
      fetch(`/api/productos/proveedor/${selectedProveedor}/codigos-lista/`, {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => {
          setCodigosSugeridos(data.codigos || []);
          setLoading(false);
        })
        .catch(() => {
          setCodigosSugeridos([]);
          setLoading(false);
        });
    } else {
      setCodigosSugeridos([]);
    }
  }, [selectedProveedor]);

  // Consultar costo sugerido al cambiar proveedor o código
  useEffect(() => {
    if (selectedProveedor && codigoProveedor) {
      setCargandoCosto(true);
      fetch(`/api/productos/precio-producto-proveedor/?proveedor_id=${selectedProveedor}&codigo_producto=${encodeURIComponent(codigoProveedor)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.precio !== undefined && data.precio !== null) {
            setCosto(data.precio);
          } else {
            setCosto('');
          }
          setCargandoCosto(false);
        })
        .catch(() => {
          setCosto('');
          setCargandoCosto(false);
        });
    } else {
      setCosto('');
    }
  }, [selectedProveedor, codigoProveedor]);

  const handleAsociar = async () => {
    setError(null);
    setMessage(null);
    if (!selectedProveedor || !codigoProveedor) {
      setError('Debe seleccionar proveedor y código.');
      return;
    }
    setLoading(true);
    // Si hay función de asociación pendiente y devuelve una promesa, esperar el resultado
    if (onAsociarCodigoPendiente) {
      const resultado = await onAsociarCodigoPendiente({
        proveedor_id: selectedProveedor,
        codigo_producto_proveedor: codigoProveedor,
        costo
      });
      console.log('[AsociarCodigoProveedorModal] Resultado handler:', resultado);
      if (resultado && resultado.ok) {
        setMessage('¡Código de proveedor asociado correctamente!');
        setLoading(false);
        setTimeout(() => { onClose(); }, 800); // Cierra el modal tras éxito
        return;
      } else {
        setError(resultado && resultado.error ? resultado.error : 'No se pudo asociar el código.');
        setLoading(false);
        return;
      }
    }
    try {
      const csrftoken = getCookie('csrftoken');
      const res = await fetch('/api/productos/asociar-codigo-proveedor/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken
        },
        credentials: 'include',
        body: JSON.stringify({
          stock_id: productoId,
          proveedor_id: selectedProveedor,
          codigo_producto_proveedor: codigoProveedor,
          costo: costo !== '' ? costo : 0
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al asociar');
      setMessage('¡Código de proveedor asociado correctamente!');
      setLoading(false);
      setTimeout(() => { onClose(); }, 800); // Cierra el modal tras éxito
    } catch (err) {
      setError(err.message || 'Error al asociar');
      setLoading(false);
      setTimeout(() => { onClose(); }, 1200); // Cierra el modal tras error crítico
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-2xl text-gray-400 hover:text-red-500">×</button>
        <h2 className="text-xl font-bold mb-4">Asociar Código de Proveedor</h2>
        {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-2 border border-red-300">{error}</div>}
        {message && <div className="bg-green-100 text-green-700 px-4 py-2 rounded mb-2 border border-green-300">{message}</div>}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Producto interno</label>
          <div className="bg-gray-100 rounded px-2 py-1 text-gray-700">
            {producto ? `${producto.deno} (${producto.codcom || producto.codvta || producto.id})` : 'No disponible'}
          </div>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Proveedor</label>
            <select
              value={selectedProveedor}
              onChange={e => setSelectedProveedor(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Seleccione un proveedor</option>
              {proveedores.map(p => (
                <option key={p.id} value={p.id}>{p.razon}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Código del proveedor</label>
            <input
              type="text"
              value={codigoProveedor}
              onChange={e => setCodigoProveedor(e.target.value)}
              list="codigos-sugeridos"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Ingrese o seleccione el código"
              disabled={loading || !selectedProveedor}
            />
            <datalist id="codigos-sugeridos">
              {codigosSugeridos.map((c, i) => (
                <option key={i} value={c} />
              ))}
            </datalist>
            {loading && <div className="text-gray-500 text-sm mt-1">Cargando códigos sugeridos...</div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Costo sugerido</label>
            <input
              type="number"
              value={costo}
              readOnly
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-100 text-gray-700"
              placeholder="Costo (de lista)"
              disabled={cargandoCosto}
            />
            {cargandoCosto && <div className="text-gray-500 text-sm mt-1">Buscando costo sugerido...</div>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleAsociar}
            className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-700 font-semibold"
            disabled={loading}
          >
            Asociar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AsociarCodigoProveedorModal; 