"use client"
import React from 'react';

// Iconos minimalistas para navegación
const ChevronLeft = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
)

const ChevronRight = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

const ChevronsLeft = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
)

const ChevronsRight = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
)

const ChevronDown = () => (
  <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

const generarNumerosPagina = (currentPage, totalPages) => {
  const numeros = [];
  const maxVisible = 5;
  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) {
      numeros.push(i);
    }
  } else {
    if (currentPage <= 3) {
      for (let i = 1; i <= 3; i++) {
        numeros.push(i);
      }
      numeros.push('...');
      numeros.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      numeros.push(1);
      numeros.push('...');
      for (let i = totalPages - 2; i <= totalPages; i++) {
        numeros.push(i);
      }
    } else {
      numeros.push(1);
      numeros.push('...');
      numeros.push(currentPage);
      numeros.push('...');
      numeros.push(totalPages);
    }
  }
  return numeros;
};

/**
 * Componente de paginación visualmente adaptado al ejemplo proporcionado
 */
const Paginador = ({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  onItemsPerPageChange,
  opcionesItemsPorPagina = [1, 10, 20, 30, 40, 50],
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  if (totalItems === 0) return null
  const numerosPagina = generarNumerosPagina(currentPage, totalPages);

  return (
    <div className="flex w-full items-center justify-between gap-4 text-sm px-2 py-4">
      {/* Info de elementos y selector */}
      <div className="flex items-center gap-4">
        <span className="text-slate-600 font-medium">
          {(totalItems === 0) ? 0 : ((currentPage - 1) * itemsPerPage + 1)}-{Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-slate-600">Mostrar:</span>
          <div className="relative">
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="appearance-none h-8 w-16 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all duration-200"
            >
              {opcionesItemsPorPagina.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1 top-2 flex items-center">
              <ChevronDown />
            </span>
          </div>
        </div>
      </div>
      {/* Controles de paginación */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow-md focus:z-20 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all duration-200 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Ir a la primera página"
        >
          <ChevronsLeft />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow-md focus:z-20 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all duration-200 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Ir a la página anterior"
        >
          <ChevronLeft />
        </button>
        <div className="flex items-center gap-1 mx-2">
          {numerosPagina.map((numero, idx) =>
            numero === '...'
              ? <span key={`ellipsis-${idx}`} className="px-2 py-1 text-slate-400 select-none font-semibold">...</span>
              : <button
                  key={numero}
                  onClick={() => onPageChange(numero)}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm font-medium mx-0.5 transition-all duration-200
                    ${numero === currentPage
                      ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white border-orange-600 shadow-md'
                      : 'bg-white border-slate-200 text-slate-700 shadow-sm hover:bg-orange-50 hover:text-orange-600 hover:shadow-md'}
                  `}
                  aria-current={numero === currentPage ? 'page' : undefined}
                >
                  {numero}
                </button>
          )}
        </div>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow-md focus:z-20 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all duration-200 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Ir a la página siguiente"
        >
          <ChevronRight />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow-md focus:z-20 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all duration-200 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Ir a la última página"
        >
          <ChevronsRight />
        </button>
      </div>
    </div>
  )
}

export default Paginador;
