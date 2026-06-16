import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturo un error:', error, errorInfo);
    // Punto de integracion para observabilidad en produccion.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 px-6 py-10">
          <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-2xl items-center justify-center">
            <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl text-amber-600">
                !
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                  FerreDesk
                </p>
                <h1 className="text-3xl font-semibold text-slate-900">
                  Ocurrio un error inesperado
                </h1>
                <p className="max-w-xl text-sm leading-6 text-slate-600">
                  La interfaz no pudo seguir cargando.
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  Recargar pagina
                </button>
                <a
                  href="/"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Ir al inicio
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
