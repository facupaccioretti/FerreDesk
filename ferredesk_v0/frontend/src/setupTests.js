try {
    require('@testing-library/jest-dom');
} catch (error) {
    // El proyecto no siempre instala jest-dom en este workspace local.
}

// Polyfills para módulos de Node.js
import { Buffer } from 'buffer';
import process from 'process';

// Hacer disponibles globalmente
window.Buffer = Buffer;
window.process = process;
