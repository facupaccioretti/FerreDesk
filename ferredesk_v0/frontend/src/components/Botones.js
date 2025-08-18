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

export const BotonEliminar = ({ onClick, title = 'Eliminar', ...props }) => (
  <button
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
    onClick={onClick}
    title={title}
    className="transition-colors px-1 py-1 text-green-600 hover:text-green-800"
    {...props}
  >
    <span className="inline-flex items-center justify-center w-4 h-4">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-4 h-4">
        <path fill="#20744a" fillRule="evenodd" d="M28.781 4.405h-10.13V2.018L2 4.588v22.527l16.651 2.868v-3.538h10.13A1.162 1.162 0 0 0 30 25.349V5.5a1.162 1.162 0 0 0-1.219-1.095Zm.16 21.126H18.617l-.017-1.889h2.487v-2.2h-2.506l-.012-1.3h2.518v-2.2H18.55l-.012-1.3h2.549v-2.2H18.53v-1.3h2.557v-2.2H18.53v-1.3h2.557v-2.2H18.53v-2h10.411Z"/>
        <path fill="#20744a" d="M22.487 7.439h4.323v2.2h-4.323zm0 3.501h4.323v2.2h-4.323zm0 3.501h4.323v2.2h-4.323zm0 3.501h4.323v2.2h-4.323zm0 3.501h4.323v2.2h-4.323z"/>
        <path fill="#fff" fillRule="evenodd" d="m6.347 10.673l2.146-.123l1.349 3.709l1.594-3.862l2.146-.123l-2.606 5.266l2.606 5.279l-2.269-.153l-1.532-4.024l-1.533 3.871l-2.085-.184l2.422-4.663l-2.238-4.993z"/>
      </svg>
    </span>
  </button>
);

export const BotonConvertir = ({ onClick, title = 'Convertir', ...props }) => (
  <button
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

export const BotonDescargar = ({ onClick, title = 'Descargar', ...props }) => (
  <button
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