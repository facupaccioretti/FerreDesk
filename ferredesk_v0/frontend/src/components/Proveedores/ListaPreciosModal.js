import React, { useRef, useState, useEffect } from 'react';
import * as XLSX from 'xlsx'; // Import the xlsx library
import { getCookie } from '../../utils/csrf'; // Ajusta el path si es necesario

const ListaPreciosModal = ({ open, onClose, proveedor, onImport }) => {
  const fileInputRef = useRef();
  const [file, setFile] = useState(null);
  const [colCodigo, setColCodigo] = useState('A');
  const [colPrecio, setColPrecio] = useState('B');
  const [colDenominacion, setColDenominacion] = useState('C');
  const [filaInicio, setFilaInicio] = useState(2);
  const [vistaPrevia, setVistaPrevia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorVistaPrevia, setErrorVistaPrevia] = useState('');

  const csrftoken = getCookie('csrftoken');

  // Helper to convert column letter to index (A=0, B=1, AA=26)
  const letterToColumnIndex = (letter) => {
    let column = 0, length = letter.length;
    for (let i = 0; i < length; i++) {
      column += (letter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
    }
    return column - 1;
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) {
      setFile(null);
      setVistaPrevia([]);
      setErrorVistaPrevia('');
      return;
    }
    setFile(f);
    setErrorVistaPrevia('');
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0]; // Use the first sheet
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert sheet to an array of arrays (rows)
        const dataRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });

        if (dataRows.length < filaInicio) {
          setErrorVistaPrevia(`La fila de inicio (${filaInicio}) es mayor que el número de filas en el archivo (${dataRows.length}).`);
          setVistaPrevia([]);
          setLoading(false);
          return;
        }

        const codigoIdx = letterToColumnIndex(colCodigo.toUpperCase());
        const precioIdx = letterToColumnIndex(colPrecio.toUpperCase());
        const denominacionIdx = letterToColumnIndex(colDenominacion.toUpperCase());
        
        const previewData = [];
        // Start from filaInicio - 1 (because dataRows is 0-indexed)
        // and take up to, say, 10 rows for preview
        for (let i = filaInicio - 1; i < dataRows.length && previewData.length < 10; i++) {
          const row = dataRows[i];
          const codigo = row[codigoIdx];
          const precio = row[precioIdx];
          const denominacion = row[denominacionIdx];

          if (codigo !== undefined && precio !== undefined) { // Only add if both values exist
            previewData.push({ 
              codigo: String(codigo).trim(), 
              // Attempt to convert precio to number, handle potential errors
              precio: !isNaN(parseFloat(precio)) ? parseFloat(precio) : String(precio).trim(),
              denominacion: denominacion !== undefined ? String(denominacion).trim() : ''
            });
          } else if (previewData.length === 0 && i >= filaInicio -1 + 5) {
            // If after 5 data rows we still haven't found valid data, likely wrong columns/start row
            setErrorVistaPrevia('No se encontraron datos válidos con las columnas y fila de inicio especificadas. Verifique la configuración.');
            break;
          }
        }
        
        if(previewData.length === 0 && !errorVistaPrevia) {
           setErrorVistaPrevia('No se pudo extraer una vista previa. Verifique las columnas y la fila de inicio.');
        }
        setVistaPrevia(previewData);

      } catch (err) {
        console.error("Error parsing Excel file:", err);
        setErrorVistaPrevia('Error al procesar el archivo Excel. Asegúrese de que sea un formato válido y la configuración de columnas sea correcta.');
        setVistaPrevia([]);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = (err) => {
      console.error("FileReader error:", err);
      setErrorVistaPrevia('Error al leer el archivo.');
      setLoading(false);
    };
    reader.readAsBinaryString(f); // Read as binary string for XLSX library
  };

  // Trigger re-parsing if columns or start row change and a file is selected
  useEffect(() => {
    if (file) {
      // This will re-trigger the parsing logic by calling handleFileChange
      // We simulate a file change event to reuse the existing logic
      handleFileChange({ target: { files: [file] } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colCodigo, colPrecio, colDenominacion, filaInicio]); // Removed 'file' from deps to avoid loop if handleFileChange sets file

  // --- CSRF: Forzar obtención de cookie al abrir el modal ---
  useEffect(() => {
    if (open) {
      fetch('/api/productos/proveedores/', { credentials: 'include' });
    }
  }, [open]);

  const handleImport = async () => {
    if (!file) {
      alert("Por favor, seleccione un archivo primero.");
      return;
    }
    if (errorVistaPrevia && vistaPrevia.length === 0) {
      alert("Hay errores en la configuración de la vista previa. Por favor, corríjalos antes de importar.");
      return;
    }
    if (vistaPrevia.length === 0) {
      alert("No hay datos en la vista previa para importar. Verifique el archivo y la configuración.");
      return;
    }

    setLoading(true);
    
    // The actual data to send will be the file itself,
    // the backend will do the full parsing using the column/row info.
    const formData = new FormData();
    formData.append('excel_file', file);
    formData.append('col_codigo', colCodigo.toUpperCase());
    formData.append('col_precio', colPrecio.toUpperCase());
    formData.append('col_denominacion', colDenominacion.toUpperCase());
    formData.append('fila_inicio', String(filaInicio));
    // also pass proveedor.id so backend knows which provider this file belongs to.
    // The endpoint will be specific to the provider, e.g., /api/productos/proveedores/${proveedor.id}/upload-price-list/

    try {
      const response = await fetch(`/api/productos/proveedores/${proveedor.id}/upload-price-list/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrftoken },
        body: formData,
        credentials: 'include',
      });

      setLoading(false);
      if (response.ok) {
        const result = await response.json();
        // Pass relevant info from result to onImport if needed
        onImport({
          proveedor,
          fileName: file.name,
          status: 'success',
          message: result.message || 'Lista importada correctamente.',
          registrosProcesados: result.registros_procesados || 0
        });
        onClose(); // Close modal on success
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Error desconocido al importar.' }));
        alert(`Error al importar: ${errorData.detail || response.statusText}`);
      }
    } catch (err) {
      setLoading(false);
      console.error("Error during import request:", err);
      alert(`Error de red o conexión al importar: ${err.message}`);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-2xl relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-2xl text-gray-400 hover:text-red-500">×</button>
        <h2 className="text-xl font-bold mb-4">Cargar Lista de Precios - {proveedor?.razon}</h2>
        <div className="mb-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="mb-2 block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
          />
          <div className="grid grid-cols-4 gap-4 mb-2">
            <div>
              <label htmlFor={`colCodigo-${proveedor?.id}`} className="block text-sm font-medium">Columna Código</label>
              <input id={`colCodigo-${proveedor?.id}`} type="text" value={colCodigo} onChange={e => setColCodigo(e.target.value.toUpperCase())} className="border rounded p-2 w-full" maxLength={2} />
            </div>
            <div>
              <label htmlFor={`colPrecio-${proveedor?.id}`} className="block text-sm font-medium">Columna Precio</label>
              <input id={`colPrecio-${proveedor?.id}`} type="text" value={colPrecio} onChange={e => setColPrecio(e.target.value.toUpperCase())} className="border rounded p-2 w-full" maxLength={2} />
            </div>
            <div>
              <label htmlFor={`colDenominacion-${proveedor?.id}`} className="block text-sm font-medium">Columna Denominación</label>
              <input id={`colDenominacion-${proveedor?.id}`} type="text" value={colDenominacion} onChange={e => setColDenominacion(e.target.value.toUpperCase())} className="border rounded p-2 w-full" maxLength={2} />
            </div>
            <div>
              <label htmlFor={`filaInicio-${proveedor?.id}`} className="block text-sm font-medium">Fila de Inicio</label>
              <input id={`filaInicio-${proveedor?.id}`} type="number" value={filaInicio} onChange={e => setFilaInicio(Number(e.target.value))} className="border rounded p-2 w-full" min={1} />
            </div>
          </div>
        </div>

        {errorVistaPrevia && (
          <div className="my-3 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">
            {errorVistaPrevia}
          </div>
        )}

        {loading && file && <div className="my-3 text-blue-600">Procesando vista previa...</div>}

        {vistaPrevia.length > 0 && (
          <div className="mb-4 max-h-60 overflow-y-auto">
            <h3 className="text-md font-semibold mb-2">Vista Previa (primeros {vistaPrevia.length} registros):</h3>
            <table className="min-w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-1 text-left">Código ({colCodigo})</th>
                  <th className="border px-2 py-1 text-left">Precio ({colPrecio})</th>
                  <th className="border px-2 py-1 text-left">Denominación ({colDenominacion})</th>
                </tr>
              </thead>
              <tbody>
                {vistaPrevia.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border px-2 py-1">{item.codigo}</td>
                    <td className="border px-2 py-1">{typeof item.precio === 'number' ? item.precio.toFixed(2) : item.precio}</td>
                    <td className="border px-2 py-1">{item.denominacion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {(vistaPrevia.length === 0 && file && !loading && !errorVistaPrevia) && (
            <div className="my-3 p-3 bg-yellow-100 text-yellow-700 border border-yellow-300 rounded-md">
                No se encontraron datos para la vista previa con la configuración actual.
            </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors">Cancelar</button>
          <button 
            onClick={handleImport} 
            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
            disabled={loading || !file || (errorVistaPrevia && vistaPrevia.length === 0)}
          >
            {loading && !file ? 'Cargando...' : loading && file ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListaPreciosModal; 
