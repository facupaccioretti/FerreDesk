import { useState, useEffect } from 'react';

function normalizarEstadoSetup(datos) {
  return {
    setup_completo: datos?.setup_completo === true,
    campos_setup_faltantes: Array.isArray(datos?.campos_setup_faltantes)
      ? datos.campos_setup_faltantes
      : [],
    no_configurada: datos?.no_configurada === true,
  };
}

function calcularArcaListoParaEmitir(ferreteria) {
  if (!ferreteria) {
    return false;
  }

  return Boolean(
    ferreteria.tiene_certificado_arca &&
    ferreteria.tiene_clave_privada_arca &&
    ferreteria.punto_venta_arca
  );
}

export function useFerreteriaAPI() {
  const [ferreteria, setFerreteria] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [estadoSetup, setEstadoSetup] = useState({
    setup_completo: false,
    campos_setup_faltantes: [],
    no_configurada: true,
  });

  const fetchFerreteria = async () => {
    setLoading(true);
    setError(null);
    try {
      const [respuestaFerreteria, respuestaEstadoSetup] = await Promise.all([
        fetch('/api/ferreteria/', { credentials: 'include' }),
        fetch('/api/ferreteria/estado-setup/', { credentials: 'include' }),
      ]);

      if (!respuestaFerreteria.ok) {
        throw new Error('Error al obtener configuracion de ferreteria');
      }

      if (!respuestaEstadoSetup.ok) {
        throw new Error('Error al obtener estado de setup');
      }

      const [datosFerreteria, datosEstadoSetup] = await Promise.all([
        respuestaFerreteria.json(),
        respuestaEstadoSetup.json(),
      ]);

      setFerreteria(datosFerreteria);
      setEstadoSetup(normalizarEstadoSetup(datosEstadoSetup));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFerreteria();
  }, []);

  const camposSetupFaltantes = estadoSetup.campos_setup_faltantes;
  const setupCompleto = estadoSetup.setup_completo === true;
  const bloqueoTotalSetup = !setupCompleto;
  const arcaListoParaEmitir = calcularArcaListoParaEmitir(ferreteria);

  return {
    ferreteria,
    estadoSetup,
    setupCompleto,
    bloqueoTotalSetup,
    camposSetupFaltantes,
    arcaListoParaEmitir,
    loading,
    error,
    fetchFerreteria,
  };
}
