"use client"
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Mapeo de ruta a color de línea
  const activeColors = {
    '/dashboard': '#eeeeee',
    '/dashboard/clientes': '#2196f3',
    '/dashboard/productos': '#a259f7',
    '/dashboard/presupuestos': '#43a047',
    '/dashboard/proveedores': '#ffb300',
    '/dashboard/notas': '#FFD600',
    '/dashboard/alertas': '#e53935',
    '/dashboard/notificaciones': '#FFD600',
  };
  const activePath = Object.keys(activeColors).find(path => location.pathname.startsWith(path));
  const activeColor = activeColors[activePath] || '#111';

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <nav
      className="w-full flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm"
      style={{ minHeight: 64 }}
    >
      <div className="flex items-center gap-5">
        <span className="font-semibold text-lg text-gray-800">Sistema de Gestión</span>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            {location.pathname.startsWith('/dashboard') && (
              <div style={{ height: 4, width: 36, background: activeColor, borderRadius: 2, marginBottom: 2 }} />
            )}
            <button
              onClick={() => handleNavigation("/dashboard")}
              className="p-2 rounded-lg transition-all duration-200 relative group"
              style={{ backgroundColor: 'transparent' }}
              title="Panel Principal"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#eeeeee'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 text-gray-700"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                />
              </svg>
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap w-32 text-center shadow-lg">
                Panel Principal
              </span>
            </button>
          </div>

          <div className="flex flex-col items-center">
            {location.pathname.startsWith('/dashboard/clientes') && (
              <div style={{ height: 4, width: 36, background: activeColor, borderRadius: 2, marginBottom: 2 }} />
            )}
            <button
              onClick={() => handleNavigation("/dashboard/clientes")}
              className="p-2 rounded-lg transition-all duration-200 relative group"
              style={{ backgroundColor: 'transparent' }}
              title="Clientes"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e3f2fd'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 text-blue-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                />
              </svg>
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap w-32 text-center shadow-lg">
                Clientes
              </span>
            </button>
          </div>

          <div className="flex flex-col items-center">
            {location.pathname.startsWith('/dashboard/productos') && (
              <div style={{ height: 4, width: 36, background: activeColor, borderRadius: 2, marginBottom: 2 }} />
            )}
            <button
              onClick={() => handleNavigation("/dashboard/productos")}
              className="p-2 rounded-lg transition-all duration-200 relative group"
              style={{ backgroundColor: 'transparent' }}
              title="Productos"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3e8ff'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 text-purple-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                />
              </svg>
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap w-32 text-center shadow-lg">
                Productos
              </span>
            </button>
          </div>

          <div className="flex flex-col items-center">
            {location.pathname.startsWith('/dashboard/presupuestos') && (
              <div style={{ height: 4, width: 36, background: activeColor, borderRadius: 2, marginBottom: 2 }} />
            )}
            <button
              onClick={() => handleNavigation("/dashboard/presupuestos")}
              className="p-2 rounded-lg transition-all duration-200 relative group"
              style={{ backgroundColor: 'transparent' }}
              title="Presupuestos y Ventas"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e8f5e9'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 text-emerald-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap w-32 text-center shadow-lg">
                Presupuestos y Ventas
              </span>
            </button>
          </div>

          <div className="flex flex-col items-center">
            {location.pathname.startsWith('/dashboard/proveedores') && (
              <div style={{ height: 4, width: 36, background: activeColor, borderRadius: 2, marginBottom: 2 }} />
            )}
            <button
              onClick={() => handleNavigation("/dashboard/proveedores")}
              className="p-2 rounded-lg transition-all duration-200 relative group"
              style={{ backgroundColor: 'transparent' }}
              title="Proveedores"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff8e1'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 text-amber-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
                />
              </svg>
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap w-32 text-center shadow-lg">
                Proveedores
              </span>
            </button>
          </div>

          <div className="flex flex-col items-center">
            {location.pathname.startsWith('/dashboard/notas') && (
              <div style={{ height: 4, width: 36, background: activeColor, borderRadius: 2, marginBottom: 2 }} />
            )}
            <button
              onClick={() => handleNavigation("/dashboard/notas")}
              className="p-2 rounded-lg transition-all duration-200 relative group"
              style={{ backgroundColor: 'transparent' }}
              title="Notas"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fffde7'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 text-yellow-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap w-32 text-center shadow-lg">
                Notas
              </span>
            </button>
          </div>
          <div className="flex flex-col items-center">
            {location.pathname.startsWith('/dashboard/alertas') && (
              <div style={{ height: 4, width: 36, background: activeColor, borderRadius: 2, marginBottom: 2 }} />
            )}
            <button
              onClick={() => handleNavigation("/dashboard/alertas")}
              className="p-2 rounded-lg transition-all duration-200 relative group"
              style={{ backgroundColor: 'transparent' }}
              title="Alertas"
              aria-label="Ir a alertas"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffebee'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <ErrorOutlineIcon sx={{ color: '#e53935', fontSize: 24 }} />
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-red-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap w-24 text-center shadow-lg">
                Alertas
              </span>
            </button>
          </div>
          <div className="flex flex-col items-center">
            {location.pathname.startsWith('/dashboard/notificaciones') && (
              <div style={{ height: 4, width: 36, background: activeColor, borderRadius: 2, marginBottom: 2 }} />
            )}
            <button
              onClick={() => handleNavigation("/dashboard/notificaciones")}
              className="p-2 rounded-lg transition-all duration-200 relative group"
              style={{ backgroundColor: 'transparent' }}
              title="Notificaciones"
              aria-label="Ir a notificaciones"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fffde7'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <NotificationsNoneIcon sx={{ color: '#FFD600', fontSize: 24 }} />
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap w-28 text-center shadow-lg">
                Notificaciones
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="flex items-center text-gray-700 text-sm font-medium">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 mr-2 text-gray-600"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
            />
          </svg>
          {user?.username ? user.username : "Usuario Invitado"}
        </span>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-200 bg-white hover:bg-gray-100 text-gray-800 text-sm font-medium transition-colors duration-200 shadow-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 text-gray-600"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
            />
          </svg>
          Salir
        </button>
      </div>
    </nav>
  );
}
