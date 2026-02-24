import { useState, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import PlantillaFacturaAPDF from './PlantillaFacturaAPDF';
import PlantillaFacturaBPDF from './PlantillaFacturaBPDF';
import PlantillaFacturaCPDF from './PlantillaFacturaCPDF';
import { mapearTipoComprobante } from '../helpers';

export const useGeneradorPDF = () => {
  const [generando, setGenerando] = useState(false);

  const obtenerPlantillaPDF = useCallback((data, tipoComprobante, ferreteriaConfig) => {
    const letra = data?.comprobante?.letra || tipoComprobante;

    switch (letra) {
      case 'A':
      case 'M':
        return <PlantillaFacturaAPDF data={data} ferreteriaConfig={ferreteriaConfig} />;
      case 'B':
        return <PlantillaFacturaBPDF data={data} ferreteriaConfig={ferreteriaConfig} />;
      case 'C':
      case 'P':
      case 'V':
        return <PlantillaFacturaCPDF data={data} ferreteriaConfig={ferreteriaConfig} />;
      default:
        return <PlantillaFacturaCPDF data={data} ferreteriaConfig={ferreteriaConfig} />;
    }
  }, []);

  const generarNombreArchivo = useCallback((data, tipoComprobante) => {
    const nombre = mapearTipoComprobante(data?.comprobante || { tipo: tipoComprobante });
    const numeroRaw = data?.numero_formateado || '0000-00000001';

    // Combinamos nombre y número, asegurándonos de que los espacios sean guiones bajos
    const nombreLimpio = nombre.replace(/\s+/g, '_');
    const numeroLimpio = numeroRaw.replace(/\s+/g, '_');

    return `${nombreLimpio}_${numeroLimpio}.pdf`;
  }, []);

  const descargarPDF = useCallback(async (data, tipoComprobante, ferreteriaConfig) => {
    if (generando) return;

    setGenerando(true);
    try {
      const plantilla = obtenerPlantillaPDF(data, tipoComprobante, ferreteriaConfig);
      const blob = await pdf(plantilla).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generarNombreArchivo(data, tipoComprobante);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Error al generar el PDF');
      return false;
    } finally {
      setGenerando(false);
    }
  }, [generando, obtenerPlantillaPDF, generarNombreArchivo]);

  const generarPDFBlob = useCallback(async (data, tipoComprobante, ferreteriaConfig) => {
    try {
      const plantilla = obtenerPlantillaPDF(data, tipoComprobante, ferreteriaConfig);
      return await pdf(plantilla).toBlob();
    } catch (error) {
      console.error('Error al generar PDF blob:', error);
      throw error;
    }
  }, [obtenerPlantillaPDF]);

  return {
    descargarPDF,
    generarPDFBlob,
    generando,
    obtenerPlantillaPDF,
    generarNombreArchivo
  };
}; 