import React from 'react';
import { Link } from 'react-router-dom';
import AnimatedBackground from './AnimatedBackground';

const Landing = () => (
  <div className="min-h-screen flex flex-col items-center justify-center relative">
    <AnimatedBackground />
    <div className="z-10 max-w-lg w-full bg-white/80 dark:bg-gray-900/80 rounded-2xl shadow-xl p-10 flex flex-col items-center">
      <h1 className="text-5xl font-bold text-gray-800 dark:text-gray-100 mb-4 text-center">Bienvenido a FerreDesk</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 text-center">
        Tu sistema moderno para la gestión de ferreterías. Organiza clientes, productos, ventas y más desde un solo lugar.
      </p>
      <div className="flex gap-4 w-full justify-center">
        <Link
          to="/login"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Iniciar Sesión
        </Link>
        <Link
          to="/register"
          className="bg-white dark:bg-gray-800 border border-blue-600 text-blue-600 dark:text-blue-300 font-medium py-3 px-8 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:bg-blue-50 dark:hover:bg-gray-700"
        >
          Registrarse
        </Link>
      </div>
    </div>
  </div>
);

export default Landing; 