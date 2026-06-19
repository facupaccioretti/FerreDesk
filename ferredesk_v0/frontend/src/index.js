import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { instalarFetchConCSRF } from './utils/clienteAPI';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'


// Polyfills para módulos de Node.js
import { Buffer } from 'buffer';
import process from 'process';

// Hacer disponibles globalmente
window.Buffer = Buffer;
window.process = process;
window.global = window; // Ajuste para mayor compatibilidad
instalarFetchConCSRF();

// Selección automática de texto en inputs numéricos
document.addEventListener('focus', (event) => {
  const target = event.target;
  // Verificamos si es un input de tipo número o tiene un rol/clase numérica
  if (target.tagName === 'INPUT' && (target.type === 'number' || target.inputMode === 'decimal')) {
    target.select();
  }
}, true); // El 'true' es clave para usar la fase de captura

// Verificar si hay una redirección pendiente
const redirectHeader = document.querySelector('meta[name="x-redirect"]')?.content;
if (redirectHeader) {
  window.location.href = redirectHeader;
}

const container = document.getElementById('root');
const root = createRoot(container);

// QueryClient de TanStack Query: caché global de datos de FerreDesk.
// staleTime=0 por defecto → revalida al montar. Cada hook puede sobreescribirlo.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,                   // Reintentar 1 vez ante error de red
      refetchOnWindowFocus: true, // Revalidar al volver a la pestaña
    },
  },
})

root.render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
