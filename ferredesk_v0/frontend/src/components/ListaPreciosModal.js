import React, { useRef, useState } from 'react';
// Puedes instalar xlsx para la lectura real de archivos: npm install xlsx
// import * as XLSX from 'xlsx';

const ListaPreciosModal = ({ open, onClose, proveedor, onImport }) => {
  const fileInputRef = useRef();
  const [file, setFile] = useState(null);
  const [colCodigo, setColCodigo] = useState('A');
  const [colPrecio, setColPrecio] = useState('B');
  const [filaInicio, setFilaInicio] = useState(2);
  const [vistaPrevia, setVistaPrevia] = useState([]);
  const [loading, setLoading] = useState(false);

  // Simulación de lectura de Excel (reemplazar por lógica real con XLSX)
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    // Aquí iría la lógica real de lectura y preview
    // Por ahora, mock:
    setVistaPrevia([
      { codigo: '1050', precio: 123.45 },
      { codigo: '1051', precio: 234.56 },
    ]);
  };

  const handleImport = () => {
    setLoading(true);
    // Aquí iría la lógica real de importación
    // Por ahora, simula delay y llama onImport
    setTimeout(() => {
      setLoading(false);
      onImport({
        proveedor,
        file,
        colCodigo,
        colPrecio,
        filaInicio,
        datos: vistaPrevia,
      });
      onClose();
    }, 1000);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-xl relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-2xl text-gray-400 hover:text-red-500">×</button>
        <h2 className="text-xl font-bold mb-4">Cargar Lista de Precios - {proveedor?.razon}</h2>
        <div className="mb-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="mb-2"
          />
          <div className="grid grid-cols-3 gap-4 mb-2">
            <div>
              <label className="block text-sm font-medium">Columna Código</label>
              <input type="text" value={colCodigo} onChange={e => setColCodigo(e.target.value.toUpperCase())} className="border rounded p-2 w-full" maxLength={2} />
            </div>
            <div>
              <label className="block text-sm font-medium">Columna Precio</label>
              <input type="text" value={colPrecio} onChange={e => setColPrecio(e.target.value.toUpperCase())} className="border rounded p-2 w-full" maxLength={2} />
            </div>
            <div>
              <label className="block text-sm font-medium">Fila de Inicio</label>
              <input type="number" value={filaInicio} onChange={e => setFilaInicio(Number(e.target.value))} className="border rounded p-2 w-full" min={1} />
            </div>
          </div>
        </div>
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Vista Previa</h3>
          <table className="min-w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1">Código</th>
                <th className="px-2 py-1">Precio</th>
              </tr>
            </thead>
            <tbody>
              {vistaPrevia.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-1">{row.codigo}</td>
                  <td className="px-2 py-1">{row.precio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-red-500 hover:text-white">Cancelar</button>
          <button onClick={handleImport} disabled={loading || !file} className="px-4 py-2 bg-black text-white rounded hover:bg-gray-700 font-semibold transition-colors disabled:opacity-50">
            {loading ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListaPreciosModal; 