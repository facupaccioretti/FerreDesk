import { useState, useEffect } from 'react';
import { useClientesAPI } from '../../../utils/useClientesAPI';

/**
 * Hook para obtener la lista de clientes combinando la lista general y el cliente por defecto (ID 1).
 * Devuelve { clientes, loading, error }.
 */
export function useClientesConDefecto() {
  const {
    clientes: clientesGenerales,
    loading: loadingGenerales,
    error: errorGenerales,
    fetchClientePorDefecto,
    clearError
  } = useClientesAPI({ con_ventas: 1 });
  const [clientePorDefecto, setClientePorDefecto] = useState(null);
  const [loadingDefecto, setLoadingDefecto] = useState(false);
  const [errorDefecto, setErrorDefecto] = useState(null);

  useEffect(() => {
    setLoadingDefecto(true);
    fetchClientePorDefecto()
      .then(data => setClientePorDefecto(data))
      .catch(err => setErrorDefecto(err?.message || 'Error al cargar cliente por defecto'))
      .finally(() => setLoadingDefecto(false));
  }, [fetchClientePorDefecto]);

  // Mostrar errores como alert nativo
  useEffect(() => {
    if (errorGenerales) {
      window.alert(errorGenerales);
      clearError();
    }
    if (errorDefecto) {
      window.alert(errorDefecto);
      setErrorDefecto(null);
    }
  }, [errorGenerales, errorDefecto, clearError]);

  // Combinar ambas listas, evitando duplicados por ID
  const clientes = [
    ...(clientePorDefecto ? [clientePorDefecto] : []),
    ...clientesGenerales.filter(c => !clientePorDefecto || String(c.id) !== String(clientePorDefecto.id))
  ];

  const loading = loadingGenerales || loadingDefecto;
  const error = errorGenerales || errorDefecto;

  return { clientes, loading, error };
} 