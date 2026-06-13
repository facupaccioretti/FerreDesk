import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFerreDeskTheme } from '../hooks/useFerreDeskTheme';

function Login() {
  const theme = useFerreDeskTheme();
  const navigate = useNavigate();
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const hostname = window.location.hostname;
  const isPublicDomain = hostname === 'lvh.me' || hostname === 'localhost' || hostname.includes('railway');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');

    try {
      const response = await fetch('/api/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Redirigir al dashboard después del login exitoso
        window.location.href = '/home/';
      } else {
        // Mejoramos el manejo de error para guiar al usuario
        let msg = data.message || 'Error al iniciar sesión.';
        msg += ' Por favor, verifica tus credenciales y asegúrate de estar ingresando al subdominio correcto de tu negocio.';
        setError(msg);
      }
    } catch (err) {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)`, backgroundSize: "20px 20px" }}></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-300/20 via-transparent to-slate-100/30"></div>

      <div className="relative z-10 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-orange-600 mb-2">
              {isPublicDomain ? 'Portal SaaS' : 'Acceso al Negocio'}
            </h2>
            <p className="text-slate-600 mb-2">
              Ingrese sus credenciales de administrador para operar
            </p>
            {!isPublicDomain && (
              <div className="inline-block bg-white/50 px-4 py-1 rounded-full text-sm font-medium text-slate-700 shadow-sm border border-slate-200">
                Subdominio activo: <span className="text-orange-600">{hostname}</span>
              </div>
            )}
            {isPublicDomain && (
               <div className="mt-2 bg-yellow-100 border border-yellow-300 text-yellow-800 text-sm px-4 py-2 rounded-lg text-left shadow-sm">
                  <strong>Atención:</strong> Estás en el dominio público base. Para acceder a tu ERP y operar, debes iniciar sesión directamente en el <strong>subdominio</strong> de tu negocio (ej: <em>tu-negocio.lvh.me/login</em>).
               </div>
            )}
          </div>

          <div className={`${theme.tarjetaClara} p-8 rounded-2xl shadow-xl`}>
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 transform transition-all duration-300 ease-in-out">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-medium text-slate-700">
                  Usuario o Correo
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                  placeholder="admin@ejemplo.com"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                  placeholder="Ingrese su contraseña"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${theme.botonManager} disabled:opacity-50`}
              >
                {loading ? 'Verificando...' : 'Ingresar a mi Negocio'}
              </button>
            </form>
            
            <div className="text-center mt-6 pt-6 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                ¿Aún no tienes tu espacio de trabajo?{' '}
                <br className="sm:hidden" />
                <button
                  onClick={() => {
                     // Redirige al dominio publico para crear negocio si estamos en subdominio
                     if (!isPublicDomain) {
                         window.location.href = `http://${window.location.host.split('.').slice(1).join('.')}/register`;
                     } else {
                         navigate('/register');
                     }
                  }}
                  className={`font-medium ${theme.azulSecundario} hover:text-blue-500 mt-1 inline-block`}
                >
                  Registrar un nuevo Negocio SaaS
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;