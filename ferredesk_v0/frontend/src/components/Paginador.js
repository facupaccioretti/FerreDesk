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
 * Componente de paginación moderno, profundo y elegante, inspirado en la referencia visual
 */
const Paginador = ({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  onItemsPerPageChange,
  opcionesItemsPorPagina = [10, 20, 30, 40, 50],
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  if (totalItems === 0) return null
  const numerosPagina = generarNumerosPagina(currentPage, totalPages);

  return (
    <div className="flex w-full justify-end py-4">
      <div className="flex items-center gap-8">
        {/* Selector de filas por página */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-900">Filas por página</span>
          <div className="relative">
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="appearance-none h-8 w-16 rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-50 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 transition-all duration-200"
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
        {/* Texto de página actual */}
        <span className="text-sm font-semibold text-neutral-900 select-none">
          Página {currentPage} de {totalPages}
        </span>
        {/* Paginador a la derecha */}
        <nav className="flex items-center gap-1" aria-label="Paginación">
          {/* Primera página */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-white text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-100 hover:shadow-md focus:z-20 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 transition-all duration-200 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Ir a la primera página"
          >
            <ChevronsLeft />
          </button>
          {/* Página anterior */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-white text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-100 hover:shadow-md focus:z-20 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 transition-all duration-200 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Ir a la página anterior"
          >
            <ChevronLeft />
          </button>
          {/* Números de página */}
          {numerosPagina.map((numero, idx) =>
            numero === '...'
              ? <span key={`ellipsis-${idx}`} className="px-2 py-1 text-neutral-400 select-none font-semibold">...</span>
              : <button
                  key={numero}
                  onClick={() => onPageChange(numero)}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm font-medium mx-0.5 transition-all duration-200
                    ${numero === currentPage
                      ? 'bg-neutral-100 border-neutral-400 text-neutral-900 shadow-md'
                      : 'bg-white border-neutral-300 text-neutral-900 shadow-sm hover:bg-neutral-100 hover:shadow-md'}
                  `}
                  aria-current={numero === currentPage ? 'page' : undefined}
                >
                  {numero}
                </button>
          )}
          {/* Página siguiente */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-white text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-100 hover:shadow-md focus:z-20 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 transition-all duration-200 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Ir a la página siguiente"
          >
            <ChevronRight />
          </button>
          {/* Última página */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-white text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-100 hover:shadow-md focus:z-20 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 transition-all duration-200 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Ir a la última página"
          >
            <ChevronsRight />
          </button>
        </nav>
      </div>
    </div>
  )
}

export default Paginador;
