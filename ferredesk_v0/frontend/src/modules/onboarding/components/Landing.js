import React from 'react';
import { Link } from 'react-router-dom';
import { useFerreDeskTheme } from '../../../hooks/useFerreDeskTheme';

const Landing = () => {
  const theme = useFerreDeskTheme();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)",
          backgroundSize: "20px 20px",
        }}
      ></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-300/20 via-transparent to-slate-100/30"></div>

      <header className="relative z-20 w-full px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg ring-2 ring-orange-400/30">
              <img
                src="/favicon.ico"
                alt="Logo FerreDesk"
                className="w-6 h-6 object-contain"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-6xl mx-auto grid gap-10 lg:grid-cols-[1.2fr_0.8fr] items-center">
          <section className="text-center lg:text-left">
            <div className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 shadow-sm mb-6">
              Plataforma SaaS con acceso por subdominio
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-orange-600">Ferre</span>
              <span className="bg-gradient-to-r from-slate-800 to-slate-700 bg-clip-text text-transparent">
                Desk
              </span>
            </h1>

            <p className="text-xl text-slate-600 mb-8 max-w-3xl leading-relaxed">
              Crea tu negocio, obten tu subdominio y trabaja dentro de un tenant aislado.
              Este portal publico sirve para onboarding y acceso, no para operar el ERP
              como si fuera un negocio activo.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center mb-8">
              <Link
                to="/register"
                className={`${theme.botonManager} text-lg px-8 py-4 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300`}
              >
                Crear mi negocio
              </Link>
              <Link
                to="/login"
                className={`${theme.botonPrimario} text-lg px-8 py-4 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300`}
              >
                Ya tengo subdominio
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3 text-left">
              <div className={`${theme.tarjetaClara} rounded-2xl p-5 shadow-lg`}>
                <p className="text-sm font-semibold text-slate-800 mb-2">Alta SaaS</p>
                <p className="text-sm text-slate-600">
                  Registra tu negocio desde este portal y FerreDesk crea tenant, dominio y admin inicial.
                </p>
              </div>

              <div className={`${theme.tarjetaClara} rounded-2xl p-5 shadow-lg`}>
                <p className="text-sm font-semibold text-slate-800 mb-2">Tu URL propia</p>
                <p className="text-sm text-slate-600">
                  Luego ingresaras desde una direccion como
                  <span className="font-medium text-slate-800"> tu-negocio.lvh.me</span>.
                </p>
              </div>

              <div className={`${theme.tarjetaClara} rounded-2xl p-5 shadow-lg`}>
                <p className="text-sm font-semibold text-slate-800 mb-2">Operacion aislada</p>
                <p className="text-sm text-slate-600">
                  Ventas, clientes y configuracion viven dentro de tu tenant, no en el schema publico.
                </p>
              </div>
            </div>
          </section>

          <aside className={`${theme.tarjetaClara} rounded-3xl p-8 shadow-2xl text-left`}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 mb-4">
              Acceso correcto
            </p>

            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-5">
                <p className="text-sm font-semibold text-slate-800 mb-2">Si ya tienes negocio creado</p>
                <p className="text-sm text-slate-600 mb-3">
                  Inicia sesion con tus credenciales y continua hacia tu tenant operativo.
                </p>
                <Link
                  to="/login"
                  className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white ${theme.botonPrimario}`}
                >
                  Ir al login tenant
                </Link>
              </div>

              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                <p className="text-sm font-semibold text-orange-800 mb-2">Si aun no tienes tenant</p>
                <p className="text-sm text-orange-700 mb-3">
                  Comienza el onboarding SaaS desde aqui. El dominio publico no reemplaza la URL de tu negocio.
                </p>
                <Link
                  to="/register"
                  className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white ${theme.botonManager}`}
                >
                  Comenzar onboarding
                </Link>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-slate-100">
                <p className="text-sm font-semibold mb-2">Importante</p>
                <p className="text-sm leading-relaxed text-slate-300">
                  El portal publico orienta y registra negocios. La operacion diaria del ERP ocurre dentro del subdominio asignado a cada empresa.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Landing;
