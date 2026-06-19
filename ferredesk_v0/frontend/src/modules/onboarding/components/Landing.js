import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Package, Truck } from 'lucide-react';
import { useFerreDeskTheme } from '../../../hooks/useFerreDeskTheme';

const Landing = () => {
  const theme = useFerreDeskTheme();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative flex flex-col font-sans">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)",
          backgroundSize: "20px 20px",
        }}
      ></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-300/20 via-transparent to-slate-100/30 pointer-events-none"></div>

      <nav className="relative z-10 px-6 md:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-md ring-1 ring-orange-400/30">
            FD
          </div>
          <span className="text-lg font-bold text-slate-800">
            <span className="text-orange-600">Ferre</span>Desk
          </span>
        </div>
        <Link
          to="/login"
          className="border border-slate-700 text-slate-700 px-5 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-150 bg-white/50 backdrop-blur-sm"
        >
          Ingresar
        </Link>
      </nav>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-4 md:py-8 text-center">
        <span className="inline-block bg-orange-500/10 border border-orange-500/20 text-orange-700 text-xs font-semibold tracking-wider px-3.5 py-1.5 rounded-full mb-4 uppercase shadow-sm">
          Sistema de gestión para negocios
        </span>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-800 tracking-tight leading-none max-w-2xl mb-4">
          Tu negocio,<br /><em className="text-orange-600 not-italic">organizado.</em>
        </h1>

        <p className="text-base md:text-lg text-slate-600 leading-relaxed max-w-md mb-6">
          Ventas, stock, proveedores y clientes en un solo lugar. Accedé a tu sistema en minutos.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center w-full sm:w-auto">
          <Link
            to="/register"
            className={`${theme.botonPrimario} w-full sm:w-auto px-7 py-3 shadow-lg`}
          >
            Crear mi negocio gratis →
          </Link>
          <Link
            to="/login"
            className={`${theme.botonManager} w-full sm:w-auto px-7 py-3 shadow-lg`}
          >
            Ya tengo cuenta
          </Link>
        </div>

        <div className="w-10 h-[1px] bg-slate-300 my-6"></div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl w-full mx-auto">
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-800 ring-1 ring-orange-500/20 rounded-xl p-5 text-left flex flex-col gap-2 shadow-lg">
            <ShoppingCart className="w-5 h-5 text-orange-500" />
            <div className="text-sm font-bold text-slate-100">Punto de venta</div>
            <div className="text-xs text-slate-400 leading-normal">Cobrá rápido, emitís comprobantes y llevás caja.</div>
          </div>
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-800 ring-1 ring-orange-500/20 rounded-xl p-5 text-left flex flex-col gap-2 shadow-lg">
            <Package className="w-5 h-5 text-orange-500" />
            <div className="text-sm font-bold text-slate-100">Stock y productos</div>
            <div className="text-xs text-slate-400 leading-normal">Control de inventario y actualización de productos.</div>
          </div>
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-800 ring-1 ring-orange-500/20 rounded-xl p-5 text-left flex flex-col gap-2 shadow-lg">
            <Truck className="w-5 h-5 text-orange-500" />
            <div className="text-sm font-bold text-slate-100">Proveedores</div>
            <div className="text-xs text-slate-400 leading-normal">Pedidos, listas de precios y compras centralizadas.</div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center py-4 text-xs text-slate-500">
        © {new Date().getFullYear()} FerreDesk
      </footer>
    </div>
  );
};

export default Landing;
