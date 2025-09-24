import React from 'react';
import { Link } from 'react-router-dom';
import { useFerreDeskTheme } from '../hooks/useFerreDeskTheme';

const Landing = () => {
  const theme = useFerreDeskTheme();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative">
      {/* Patrón de puntos característico de FerreDesk */}
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)`, backgroundSize: "20px 20px" }}></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-300/20 via-transparent to-slate-100/30"></div>
      
      {/* Header */}
      <header className="relative z-20 w-full px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg ring-2 ring-orange-400/30">
              <img
                src="/static/favicon.ico"
                alt="Logo FerreDesk"
                className="w-6 h-6 object-contain"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Headline principal */}
          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="text-orange-600">Ferre</span>
            <span className="bg-gradient-to-r from-slate-800 to-slate-700 bg-clip-text text-transparent">Desk</span>
          </h1>

          {/* Descripción */}
          <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            Optimiza tu ferretería gestiona productos, clientes, ventas y más.
          </p>

          {/* Botones de acción principal */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/login/"
              className={`${theme.botonPrimario} text-lg px-8 py-4 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300`}
            >
              Iniciar Sesión
            </Link>
            <Link
              to="/register"
              className={`${theme.botonManager} text-lg px-8 py-4 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300`}
            >
              Registrarse
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Landing; 