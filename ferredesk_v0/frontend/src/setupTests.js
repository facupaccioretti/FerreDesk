// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfills para módulos de Node.js
import { Buffer } from 'buffer';
import process from 'process';

// Hacer disponibles globalmente
window.Buffer = Buffer;
window.process = process;
