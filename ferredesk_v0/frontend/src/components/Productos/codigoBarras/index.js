/**
 * Módulo de códigos de barras para productos
 */

// Componentes
export { default as CodigoBarrasModal } from './components/CodigoBarrasModal';
export { default as ImprimirEtiquetasModal } from './components/ImprimirEtiquetasModal';

// Hooks
export { useCodigoBarras } from './hooks/useCodigoBarras';
export { useImpresionEtiquetas } from './hooks/useImpresionEtiquetas';

// Servicios
export * from './services/codigoBarrasApi';

// Constantes
export * from './constants';
