import React from 'react';

// Eliminado: usaremos el SVG inline dentro del botón para evitar duplicados

export const BotonEditar = ({ onClick, title = 'Editar', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-blue-500 hover:text-blue-700"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  </button>
);

export const BotonDesactivar = ({ onClick, title = 'Desactivar', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-slate-500 hover:text-slate-700"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 96.32" className="w-4 h-4" fill="currentColor">
      <path d="M104.54,23.28c6.82,6.28,12.8,14.02,17.67,22.87l0.67,1.22l-0.67,1.21c-6.88,12.49-15.96,22.77-26.48,29.86 c-8.84,5.95-18.69,9.67-29.15,10.59l6.73-11.66c5.25-1.42,10.24-3.76,14.89-6.9c8.18-5.51,15.29-13.45,20.79-23.1 c-2.98-5.22-6.43-9.94-10.26-14.05L104.54,23.28L104.54,23.28z M88.02,0l17.84,10.3L56.2,96.32l-17.83-10.3l0.69-1.2 c-4.13-1.69-8.11-3.83-11.9-6.38C16.62,71.35,7.55,61.07,0.67,48.59L0,47.37l0.67-1.22C7.55,33.67,16.62,23.39,27.15,16.3 C37.42,9.38,49.08,5.48,61.44,5.48c7.35,0,14.44,1.38,21.14,3.94L88.02,0L88.02,0L88.02,0z M44.36,75.63l5-8.67 c-5.94-3.78-9.89-10.42-9.89-17.99c0-11.77,9.54-21.31,21.31-21.31c3.56,0,6.92,0.87,9.87,2.42l6.61-11.44 c-5.04-1.85-10.35-2.85-15.83-2.85c-9.61,0-18.71,3.06-26.76,8.48c-8.18,5.51-15.29,13.45-20.8,23.11 c5.5,9.66,12.62,17.6,20.8,23.1C37.76,72.55,41,74.28,44.36,75.63L44.36,75.63z M63.93,41.74l6.73-11.66 c-1.82-0.95-3.77-1.64-5.79-2.03c-1.45,2.18-2.31,4.82-2.31,7.67C62.56,37.88,63.06,39.93,63.93,41.74L63.93,41.74L63.93,41.74z" />
    </svg>
  </button>
);

export const BotonEliminar = ({ onClick, title = 'Eliminar', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-red-500 hover:text-red-700"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  </button>
);

export const BotonExpandir = ({ expanded, onClick, title = 'Ver más', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`flex items-center justify-center w-6 h-6 mr-2 text-gray-700 transition-transform duration-200 ${expanded ? 'rotate-90' : 'rotate-0'}`}
    style={{ padding: 0 }}
    {...props}
  >
    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="block m-auto">
      <polygon points="5,3 15,10 5,17" />
    </svg>
  </button>
);

export const BotonHistorial = ({ onClick, title = 'Historial', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-gray-800 hover:text-black"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
      <path d="M3 3v5h5"></path>
      <path d="M12 7v5l4 2"></path>
    </svg>
  </button>
);

export const BotonCargarLista = ({ onClick, title = 'Cargar Lista', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-green-600 hover:text-green-800"
    {...props}
  >
    <span className="inline-flex items-center justify-center w-4 h-4">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-4 h-4">
        <path fill="#20744a" fillRule="evenodd" d="M28.781 4.405h-10.13V2.018L2 4.588v22.527l16.651 2.868v-3.538h10.13A1.162 1.162 0 0 0 30 25.349V5.5a1.162 1.162 0 0 0-1.219-1.095Zm.16 21.126H18.617l-.017-1.889h2.487v-2.2h-2.506l-.012-1.3h2.518v-2.2H18.55l-.012-1.3h2.549v-2.2H18.53v-1.3h2.557v-2.2H18.53v-1.3h2.557v-2.2H18.53v-2h10.411Z" />
        <path fill="#20744a" d="M22.487 7.439h4.323v2.2h-4.323zm0 3.501h4.323v2.2h-4.323zm0 3.501h4.323v2.2h-4.323zm0 3.501h4.323v2.2h-4.323zm0 3.501h4.323v2.2h-4.323z" />
        <path fill="#fff" fillRule="evenodd" d="m6.347 10.673l2.146-.123l1.349 3.709l1.594-3.862l2.146-.123l-2.606 5.266l2.606 5.279l-2.269-.153l-1.532-4.024l-1.533 3.871l-2.085-.184l2.422-4.663l-2.238-4.993z" />
      </svg>
    </span>
  </button>
);

export const BotonConvertir = ({ onClick, title = 'Convertir', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-purple-600 hover:text-purple-800"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  </button>
);

export const BotonNotaCredito = ({ onClick, title = 'Nota de Crédito', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-blue-600 hover:text-blue-800"
    {...props}
  >
    <svg width="20" height="20" viewBox="0 0 48 48" className="w-5 h-5">
      <rect x="6" y="6" width="36" height="36" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="24" y="30" textAnchor="middle" className="fill-current font-bold text-lg">NC</text>
    </svg>
  </button>
);

export const BotonVinculado = ({ onClick, title = 'Ver presupuesto vinculado', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-blue-700 hover:text-blue-900"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.49 12 3.74 8.248m0 0 3.75-3.75m-3.75 3.75h16.5V19.5" />
    </svg>
  </button>
);

export const BotonImprimir = ({ onClick, title = 'Imprimir', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-blue-700 hover:text-blue-900"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
    </svg>
  </button>
);

export const BotonVerTicket = ({ onClick, title = 'Ver Ticket', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-orange-600 hover:text-orange-900"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
    </svg>
  </button>
);

export const BotonDescargar = ({ onClick, title = 'Descargar', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-green-700 hover:text-green-900"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  </button>
);

export const BotonVerDetalle = ({ onClick, title = 'Ver detalle', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-gray-700 hover:text-black"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  </button>
);

export const BotonDuplicar = ({ onClick, title = 'Duplicar fila', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    className="text-blue-600 hover:text-blue-800"
    title={title}
    aria-label={title}
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
    </svg>
  </button>
);

export const BotonGenerarPDF = ({ onClick, title = 'Generar PDF', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-red-600 hover:text-red-800"
    {...props}
  >
    <svg className="w-5 h-5" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink">
      <g transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)">
        <path d="M 19.309 0 C 15.04 0 11.58 3.46 11.58 7.729 v 47.153 v 27.389 c 0 4.269 3.46 7.729 7.729 7.729 h 51.382 c 4.269 0 7.729 -3.46 7.729 -7.729 V 54.882 V 25.82 L 52.601 0 H 19.309 z" fill="#E2262B" />
        <path d="M 78.42 25.82 H 60.159 c -4.175 0 -7.559 -3.384 -7.559 -7.559 V 0 L 78.42 25.82 z" fill="#EB676A" />
        <path d="M 30.116 46.949 h -5.944 c -0.966 0 -1.75 0.783 -1.75 1.75 v 9.854 v 6.748 c 0 0.967 0.784 1.75 1.75 1.75 s 1.75 -0.783 1.75 -1.75 v -4.998 h 4.194 c 2.53 0 4.588 -2.059 4.588 -4.588 v -4.177 C 34.704 49.008 32.646 46.949 30.116 46.949 z M 31.204 55.715 c 0 0.6 -0.488 1.088 -1.088 1.088 h -4.194 v -6.354 h 4.194 c 0.6 0 1.088 0.488 1.088 1.089 V 55.715 z" fill="#FFFFFF" />
        <path d="M 43.703 46.949 h -3.246 c -0.966 0 -1.75 0.783 -1.75 1.75 v 16.602 c 0 0.967 0.784 1.75 1.75 1.75 h 3.246 c 4.018 0 7.286 -3.269 7.286 -7.287 v -5.527 C 50.989 50.218 47.721 46.949 43.703 46.949 z M 47.489 59.764 c 0 2.088 -1.698 3.787 -3.786 3.787 h -1.496 V 50.449 h 1.496 c 2.088 0 3.786 1.699 3.786 3.787 V 59.764 z" fill="#FFFFFF" />
        <path d="M 65.828 46.949 h -8.782 c -0.967 0 -1.75 0.783 -1.75 1.75 v 16.602 c 0 0.967 0.783 1.75 1.75 1.75 s 1.75 -0.783 1.75 -1.75 V 58.75 h 4.001 c 0.967 0 1.75 -0.783 1.75 -1.75 s -0.783 -1.75 -1.75 -1.75 h -4.001 v -4.801 h 7.032 c 0.967 0 1.75 -0.783 1.75 -1.75 S 66.795 46.949 65.828 46.949 z" fill="#FFFFFF" />
      </g>
    </svg>
  </button>
);

// Icono de archivo Excel solicitado
export const FileTypeExcel = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 32 32" {...props}>
    <defs>
      <linearGradient id="vscodeIconsFileTypeExcel0" x1="4.494" x2="13.832" y1="-2092.086" y2="-2075.914" gradientTransform="translate(0 2100)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#18884f"></stop>
        <stop offset=".5" stopColor="#117e43"></stop>
        <stop offset="1" stopColor="#0b6631"></stop>
      </linearGradient>
    </defs>
    <path fill="#185c37" d="M19.581 15.35L8.512 13.4v14.409A1.192 1.192 0 0 0 9.705 29h19.1A1.192 1.192 0 0 0 30 27.809V22.5Z"></path>
    <path fill="#21a366" d="M19.581 3H9.705a1.192 1.192 0 0 0-1.193 1.191V9.5L19.581 16l5.861 1.95L30 16V9.5Z"></path>
    <path fill="#107c41" d="M8.512 9.5h11.069V16H8.512Z"></path>
    <path d="M16.434 8.2H8.512v16.25h7.922a1.2 1.2 0 0 0 1.194-1.191V9.391A1.2 1.2 0 0 0 16.434 8.2Z" opacity=".1"></path>
    <path d="M15.783 8.85H8.512V25.1h7.271a1.2 1.2 0 0 0 1.194-1.191V10.041a1.2 1.2 0 0 0-1.194-1.191Z" opacity=".2"></path>
    <path d="M15.783 8.85H8.512V23.8h7.271a1.2 1.2 0 0 0 1.194-1.191V10.041a1.2 1.2 0 0 0-1.194-1.191Z" opacity=".2"></path>
    <path d="M15.132 8.85h-6.62V23.8h6.62a1.2 1.2 0 0 0 1.194-1.191V10.041a1.2 1.2 0 0 0-1.194-1.191Z" opacity=".2"></path>
    <path fill="url(#vscodeIconsFileTypeExcel0)" d="M3.194 8.85h11.938a1.193 1.193 0 0 1 1.194 1.191v11.918a1.193 1.193 0 0 1-1.194 1.191H3.194A1.192 1.192 0 0 1 2 21.959V10.041A1.192 1.192 0 0 1 3.194 8.85Z"></path>
    <path fill="#fff" d="m5.7 19.873l2.511-3.884l-2.3-3.862h1.847L9.013 14.6c.116.234.2.408.238.524h.017c.082-.188.169-.369.26-.546l1.342-2.447h1.7l-2.359 3.84l2.419 3.905h-1.809l-1.45-2.711A2.355 2.355 0 0 1 9.2 16.8h-.024a1.688 1.688 0 0 1-.168.351l-1.493 2.722Z"></path>
    <path fill="#33c481" d="M28.806 3h-9.225v6.5H30V4.191A1.192 1.192 0 0 0 28.806 3Z"></path>
    <path fill="#107c41" d="M19.581 16H30v6.5H19.581Z"></path>
  </svg>
);

export const BotonMarcarRechazado = ({ onClick, title = 'Marcar rechazado', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-red-500 hover:text-red-700"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  </button>
);

export const BotonEndosar = ({ onClick, title = 'Endosar', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-indigo-500 hover:text-indigo-700"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 122.88 70.36" className="w-4 h-4" fill="currentColor">
      <g>
        <path d="M97.85,14.17c-0.02,0.19-0.08,0.37-0.17,0.55c-0.1,0.42-0.15,0.9-0.15,1.43c0,0.05,0.01,0.1,0.01,0.15v34.74 c0.44,1.09,0.98,1.91,1.63,2.42c0.6,0.48,1.34,0.71,2.24,0.67c0.06-0.01,0.13-0.01,0.19-0.01h9.96v0c0.02,0,0.05,0,0.08,0 c1.55,0.08,2.67-0.34,3.42-1.2c0.85-0.98,1.34-2.55,1.51-4.66l0,0l0-0.03l3.03-31.34c0-0.05,0-0.1,0.01-0.15 c0.21-1.78-0.18-2.94-1.06-3.62c-1.01-0.78-2.68-1.1-4.85-1.1c-0.05,0-0.1,0.01-0.15,0.01h-11.22v-0.01 c-1.71,0-2.97,0.34-3.74,1.04C98.27,13.35,98.03,13.72,97.85,14.17L97.85,14.17z M86.87,52.6c-0.24-0.23-0.41-0.53-0.48-0.86 l-16-28.8c-1.78-2.97-3.38-3.04-4.93-2.12c-1.1,0.65-2.26,1.71-3.42,2.77c-0.7,0.64-1.4,1.28-1.99,1.77l-2.75,2.27l0,0l-0.02,0.01 c-2,1.61-4.26,2.48-6.4,2.65c-1.41,0.12-2.77-0.06-4.01-0.53c-1.27-0.48-2.39-1.25-3.23-2.3c-0.91-1.13-1.51-2.57-1.65-4.27l0.01,0 c-0.03-0.41,0.09-0.82,0.37-1.16l8.74-10.4c-1.84-0.03-3.47,0.22-5,0.7c-2.33,0.73-4.51,1.99-6.89,3.62 c-0.27,0.21-0.62,0.34-0.99,0.34H28.16v19.03l0.04,12.17h5.86v0c0.56,0,1.1,0.29,1.39,0.81l7.28,12.69c1.06,1.85,2,3.45,3.17,4.5 c1.1,0.99,2.54,1.6,4.76,1.66c0.83,0.02,1.63-0.12,2.38-0.43c0.46-0.19,0.92-0.45,1.37-0.78l-4.72-8.82 c-0.42-0.78-0.12-1.75,0.66-2.16c0.78-0.42,1.75-0.12,2.16,0.66l5.13,9.59c1.91,0.97,3.64,1.27,5.19,0.94 c1.42-0.31,2.76-1.16,4.02-2.54l-7.39-11.6c-0.47-0.74-0.26-1.73,0.49-2.21c0.74-0.47,1.73-0.26,2.21,0.49l7.78,12.22 c1.37,0.56,2.68,0.68,3.93,0.34c1.19-0.33,2.39-1.09,3.58-2.33l-7.05-13.28c-0.42-0.78-0.12-1.76,0.67-2.17 c0.78-0.42,1.76-0.12,2.17,0.67l7.3,13.74c0.95,0.55,2.05,0.69,3.1,0.52c0.92-0.15,1.81-0.55,2.54-1.12 c0.7-0.56,1.25-1.28,1.51-2.1c0.29-0.89,0.26-1.93-0.21-3.06L86.87,52.6L86.87,52.6z M88.99,49.82h5.34V16.3 c0-0.04,0-0.09,0.01-0.13c0-0.52,0.03-1.02,0.1-1.49L89,11.07c-0.03-0.02-0.06-0.04-0.09-0.06c-0.71-0.47-1.56-1.07-2.41-1.67 c-3.09-2.16-6.26-4.39-9.69-5.29c-1.85-0.49-3.99-0.81-6.17-0.85c-1.91-0.04-3.85,0.14-5.68,0.62c-1.09,0.28-2.15,0.67-3.13,1.19 c-0.87,0.46-1.68,1.02-2.4,1.7l-3.64,4.33c-0.11,0.22-0.27,0.4-0.46,0.55L45.29,23.55c0.15,0.76,0.45,1.4,0.86,1.92 c0.48,0.59,1.12,1.03,1.85,1.31c0.78,0.29,1.68,0.4,2.62,0.32c1.53-0.13,3.17-0.76,4.64-1.94l0,0l2.75-2.27 c0.7-0.58,1.29-1.12,1.88-1.65c1.29-1.18,2.57-2.35,3.93-3.16c3.13-1.87,6.25-1.93,9.33,3.24l0.03,0.05L88.99,49.82L88.99,49.82z M94.93,53.03h-4.27c0.58,1.69,0.55,3.29,0.09,4.71c-0.47,1.46-1.39,2.7-2.57,3.64c-1.15,0.91-2.55,1.54-4.02,1.78 c-1.43,0.24-2.93,0.11-4.33-0.47c-1.62,1.69-3.33,2.76-5.11,3.25c-1.79,0.49-3.6,0.39-5.43-0.25c-1.74,1.93-3.66,3.14-5.78,3.59 c-2.16,0.47-4.45,0.14-6.88-1c-0.76,0.59-1.55,1.06-2.38,1.4c-1.17,0.49-2.4,0.71-3.69,0.67c-3.08-0.09-5.15-1-6.8-2.48 c-1.58-1.41-2.63-3.21-3.83-5.29l-6.81-11.88h-5.28c-0.31,1.53-0.84,2.83-1.64,3.87c-1.35,1.74-3.32,2.66-6.06,2.6 c-0.03,0-0.06,0-0.09,0h-9.05c-2.28,0.37-4.23-0.19-5.76-1.96c-1.36-1.57-2.28-4.12-2.68-7.86c-0.01-0.04-0.01-0.09-0.02-0.14 l-2.38-29.5c-0.47-3.18,0.05-5.43,1.33-6.97c1.29-1.55,3.24-2.25,5.63-2.36c0.07-0.01,0.13-0.01,0.2-0.01h12.19v0.01 c2.3-0.03,4.28,0.36,5.78,1.33c1.21,0.78,2.08,1.88,2.52,3.38h9.93c2.5-1.68,4.83-3,7.41-3.81c2.54-0.79,5.25-1.07,8.5-0.68 L57,4.64c0.06-0.08,0.12-0.15,0.2-0.22c0.95-0.9,2.01-1.64,3.15-2.24c1.2-0.63,2.48-1.11,3.82-1.46C66.29,0.17,68.52-0.04,70.7,0 c2.47,0.05,4.87,0.41,6.94,0.95C81.6,2,85.02,4.39,88.34,6.72c0.74,0.52,1.48,1.04,2.36,1.62c0.03,0.02,0.06,0.04,0.09,0.06 l4.82,3.22c0.24-0.34,0.52-0.65,0.84-0.93c1.38-1.24,3.35-1.85,5.89-1.85V8.83h11.22c0.04,0,0.09,0,0.13,0.01 c2.87-0.01,5.21,0.51,6.83,1.76c1.8,1.39,2.65,3.5,2.29,6.53c0,0.03-0.01,0.05-0.01,0.08l-3.03,31.31l0,0 c-0.22,2.8-0.97,4.99-2.29,6.51c-1.41,1.62-3.36,2.42-5.92,2.31v0h-9.96h-0.01c-1.72,0.09-3.19-0.38-4.42-1.36 C96.27,55.25,95.52,54.27,94.93,53.03L94.93,53.03z M14,40.86c1.2,0,2.17,0.97,2.17,2.17c0,1.2-0.97,2.17-2.17,2.17 c-1.2,0-2.17-0.97-2.17-2.17C11.83,41.83,12.8,40.86,14,40.86L14,40.86z M108.45,40.86c1.2,0,2.17,0.97,2.17,2.17 c0,1.2-0.97,2.17-2.17,2.17c-1.2,0-2.17-0.97-2.17-2.17C106.28,41.83,107.25,40.86,108.45,40.86L108.45,40.86z M24.95,31.62 l-0.06-16.93c0-0.03,0-0.06,0-0.1c-0.17-1.06-0.63-1.77-1.31-2.21c-0.93-0.6-2.32-0.83-4.03-0.81h-0.02v0.01H7.33 c-0.02,0-0.04,0-0.06,0c-1.51,0.07-2.66,0.43-3.31,1.21c-0.7,0.83-0.94,2.27-0.61,4.5c0.01,0.05,0.01,0.09,0.01,0.14l2.38,29.53 l0,0.05c0.32,3.06,0.98,5.02,1.91,6.1c0.74,0.86,1.75,1.1,2.96,0.88c0.09-0.02,0.19-0.03,0.28-0.03v-0.01h9.15 c0.06,0,0.12,0,0.17,0.01c1.62,0.03,2.74-0.45,3.44-1.36c0.82-1.06,1.22-2.72,1.28-4.86h-0.01V31.62L24.95,31.62z M73.18,21.36 L73.18,21.36L73.18,21.36L73.18,21.36z" />
      </g>
    </svg>
  </button>
);

export const BotonDepositar = ({ onClick, title = 'Depositar', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-orange-500 hover:text-orange-700"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 115.53 122.88" className="w-4 h-4" fill="currentColor">
      <g>
        <path d="M97.65,36.83c0.95,0,1.77,0.58,2.13,1.4l15.49,23.96c0.2,0.38,0.28,0.79,0.25,1.18l-1.03,57.19c0,1.27-1.03,2.31-2.31,2.31 v0.01H3.55c-1.28,0-2.32-1.04-2.32-2.32L0,63.26l0-0.02l0-0.02v0l0-0.02l0-0.02l0-0.02l0-0.01l0-0.02l0-0.03v0l0-0.01l0-0.04 l0-0.01l0-0.01l0-0.04l0-0.01l0-0.01l0.01-0.04l0,0l0-0.02l0.01-0.04l0,0l0,0l0.01-0.04l0-0.02v0l0.01-0.04l0.01-0.02l0-0.02 l0-0.02l0-0.01l0-0.01l0.01-0.02l0.01-0.02l0-0.01l0-0.01l0.01-0.02L0.1,62.6l0-0.01l0-0.01l0.01-0.02l0-0.01l0.01-0.03l0.01-0.02 l0.01-0.02l0.01-0.02l0.01-0.02l0.01-0.02v0l0.01-0.02l0.01-0.02v0l0.02-0.04l0.01-0.02l0.02-0.03l0,0l0.01-0.02l0.01-0.01l0-0.01 l0.01-0.02l0.01-0.02l0.01-0.02l0.01-0.02l0.02-0.03l0.01-0.02l0,0l0.02-0.03l0.01-0.02l0.01-0.02l0.01-0.02l15.7-23.99 c0.41-0.78,1.22-1.23,2.05-1.23v-0.01l31.05,0L67.16,0l29.47,13.19L85.25,36.83H97.65L97.65,36.83z M46.88,41.47h-27.4L6.15,60.96 h103.28l-13.18-19.5H83.03l-3.49,7.26l2.56,0c1.28,0,2.32,1.04,2.32,2.32s-1.04,2.32-2.32,2.32H36.84c-1.28,0-2.32-1.04-2.32-2.32 c0-1.28,1.04-2.32,2.32-2.3h3.9l2.58,0L46.88,41.47L46.88,41.47z M74.04,48.73l13.7-28.58c-2.3-1.12-3.25-3.91-2.13-6.21L73.21,9.1 c-1.12,2.3-3.91,3.25-6.21,2.13l-17.66,36.1l0,0c0.69,0.34,1.26,0.83,1.69,1.41C58.49,48.73,66.76,48.73,74.04,48.73L74.04,48.73z M61.76,31.35c1.79-3.66,6.19-5.17,9.85-3.38c3.66,1.79,5.17,6.19,3.38,9.85c-1.79,3.66-6.19,5.17-9.85,3.38 C61.48,39.42,59.97,35.01,61.76,31.35L61.76,31.35z M4.63,65.59l1.23,52.65h104.01l1.04-52.65H4.63L4.63,65.59z" />
      </g>
    </svg>
  </button>
);

export const BotonReactivar = ({ onClick, title = 'Reactivar', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-green-500 hover:text-green-700"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 512 512" className="w-4 h-4" fill="currentColor">
      <path fillRule="nonzero" d="M256 0c70.69 0 134.69 28.66 181.02 74.98C483.34 121.3 512 185.31 512 256c0 70.69-28.66 134.69-74.98 181.02C390.69 483.35 326.69 512 256 512c-70.69 0-134.7-28.65-181.02-74.98C28.66 390.69 0 326.69 0 256c0-70.69 28.66-134.7 74.98-181.02C121.3 28.66 185.31 0 256 0zm-89.53 236.97c18 10.36 29.7 18.99 43.61 34.34 36.18-58.19 75.43-90.48 126.48-136.26l4.98-1.91h55.85c-74.89 83.19-132.94 151.75-184.96 252.08-27.05-57.92-51.19-97.84-105.16-134.87l59.2-13.38zm244.92-136.36C371.62 60.85 316.68 36.25 256 36.25c-60.69 0-115.63 24.6-155.39 64.36-39.76 39.77-64.36 94.7-64.36 155.39 0 60.68 24.6 115.62 64.36 155.39 39.76 39.76 94.7 64.36 155.39 64.36 60.68 0 115.62-24.6 155.39-64.36 39.76-39.77 64.36-94.71 64.36-155.39 0-60.69-24.6-115.62-64.36-155.39z" />
    </svg>
  </button>
);

export const BotonAcreditar = ({ onClick, title = 'Acreditar', ...props }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-emerald-500 hover:text-emerald-700"
    {...props}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M3 7h18" />
      <path d="M5 21V7" />
      <path d="M19 21V7" />
      <path d="M9 7V3h6v4" />
      <path d="M9 15l2 2 4-4" />
    </svg>
  </button>
);