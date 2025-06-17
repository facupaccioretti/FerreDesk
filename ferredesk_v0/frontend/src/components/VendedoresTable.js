import React, { useState, useEffect } from 'react';
import Paginador from './Paginador';

const VendedoresTable = ({ vendedores, onEdit, onDelete, search, setSearch }) => {
  const filtered = vendedores.filter((v) =>
    v.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (v.dni || '').toLowerCase().includes(search.toLowerCase())
  );

  // ------------------------------ Paginación ------------------------------
  const [paginaActual, setPaginaActual] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState(10);

  useEffect(() => {
    setPaginaActual(1);
  }, [search, vendedores]);

  const indiceInicio = (paginaActual - 1) * itemsPorPagina;
  const vendedoresPagina = filtered.slice(indiceInicio, indiceInicio + itemsPorPagina);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <input
          type="text"
          className="pl-4 pr-4 py-2 w-full rounded-lg border border-gray-200 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Buscar vendedores..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="overflow-auto flex-1">
        <table className="min-w-full">
          <thead>
            <tr className="bg-white border-b">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">NOMBRE</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">DNI</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">TELÉFONO</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">LOCALIDAD</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">ESTADO</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">ACCIONES</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {vendedoresPagina.map(v => (
              <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{v.nombre}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{v.dni}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{v.tel}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{v.localidad_nombre || v.localidad}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{v.activo === 'S' ? 'Activo' : 'Inactivo'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => onEdit(v)}
                      title="Editar"
                      className="transition-colors px-1 py-1 text-blue-500 hover:text-blue-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(v.id)}
                      title="Eliminar"
                      className="transition-colors px-1 py-1 text-red-500 hover:text-red-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Paginador */}
        <Paginador
          totalItems={filtered.length}
          itemsPerPage={itemsPorPagina}
          currentPage={paginaActual}
          onPageChange={setPaginaActual}
          onItemsPerPageChange={(n) => {
            setItemsPorPagina(n);
            setPaginaActual(1);
          }}
        />
      </div>
    </div>
  );
};

export default VendedoresTable; 