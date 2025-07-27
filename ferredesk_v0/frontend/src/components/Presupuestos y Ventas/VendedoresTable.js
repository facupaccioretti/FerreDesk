import React from 'react';
import Tabla from '../Tabla';

const VendedoresTable = ({ vendedores, onEdit, onDelete, search, setSearch }) => {
  const filtered = vendedores.filter(
    (v) =>
      v.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (v.dni || '').toLowerCase().includes(search.toLowerCase())
  );

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
      <div className="flex-1">
        <Tabla
          columnas={[
            {
              id: "nro",
              titulo: "Nº",
              align: "center",
              render: (_, idxVisible, indiceInicio) => (
                <span className="text-xs text-slate-500 font-medium">{idxVisible + indiceInicio + 1}</span>
              ),
            },
            { id: "nombre", titulo: "Nombre", render: (v) => <span className="font-medium text-slate-800">{v.nombre}</span> },
            { id: "dni", titulo: "DNI", render: (v) => <span className="text-slate-600">{v.dni}</span> },
            { id: "tel", titulo: "Teléfono", render: (v) => <span className="text-slate-600">{v.tel}</span> },
            { id: "loc", titulo: "Localidad", render: (v) => <span className="text-slate-600">{v.localidad_nombre || v.localidad}</span> },
            { id: "estado", titulo: "Estado", render: (v) => <span className="text-slate-600">{v.activo === 'S' ? 'Activo' : 'Inactivo'}</span> },
            {
              id: "acciones",
              titulo: "Acciones",
              align: "center",
              render: (v) => (
                <div className="flex gap-2 items-center justify-center">
                  <button onClick={() => onEdit(v)} title="Editar" className="transition-colors px-1 py-1 text-blue-500 hover:text-blue-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  </button>
                  <button onClick={() => onDelete(v.id)} title="Eliminar" className="transition-colors px-1 py-1 text-red-500 hover:text-red-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              ),
            },
          ]}
          datos={filtered}
          valorBusqueda=""
          onCambioBusqueda={() => {}}
          mostrarBuscador={false}
          renderFila={(v, idxVisible, indiceInicio) => (
            <tr key={v.id} className="hover:bg-slate-100 transition-colors cursor-pointer">
              {[
                {
                  id: "nro",
                  align: "center",
                  render: () => <span className="text-xs text-slate-500 font-medium">{idxVisible + indiceInicio + 1}</span>,
                },
                { id: "nombre", render: () => <span className="font-medium text-slate-800">{v.nombre}</span> },
                { id: "dni", render: () => <span className="text-slate-600">{v.dni}</span> },
                { id: "tel", render: () => <span className="text-slate-600">{v.tel}</span> },
                { id: "loc", render: () => <span className="text-slate-600">{v.localidad_nombre || v.localidad}</span> },
                { id: "estado", render: () => <span className="text-slate-600">{v.activo === 'S' ? 'Activo' : 'Inactivo'}</span> },
                {
                  id: "acciones",
                  align: "center",
                  render: () => (
                    <div className="flex gap-2 items-center justify-center">
                      <button onClick={() => onEdit(v)} title="Editar" className="transition-colors px-1 py-1 text-blue-500 hover:text-blue-700">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                      <button onClick={() => onDelete(v.id)} title="Eliminar" className="transition-colors px-1 py-1 text-red-500 hover:text-red-700">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  ),
                },
              ].map((col) => (
                <td
                  key={col.id}
                  className={`px-2 py-1 whitespace-nowrap text-sm ${
                    col.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {col.render()}
                </td>
              ))}
            </tr>
          )}
        />
      </div>
    </div>
  );
};

export default VendedoresTable; 