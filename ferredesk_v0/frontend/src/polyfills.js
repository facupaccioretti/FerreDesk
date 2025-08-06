// Polyfills para módulos de Node.js
import { Buffer } from 'buffer';
import process from 'process';

// Hacer disponibles globalmente
window.Buffer = Buffer;
window.process = process;

// Configurar global para compatibilidad
global.Buffer = Buffer;
global.process = process; 