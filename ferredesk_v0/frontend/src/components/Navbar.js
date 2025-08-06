"use client"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate()
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)

  const handleNavigation = (path) => {
    navigate(path)
    setIsMoreMenuOpen(false) // Close dropdown after navigation
  }

  const handleLinkClick = (e, path) => {
    e.preventDefault()
    handleNavigation(path)
  }

  const toggleMoreMenu = () => {
    setIsMoreMenuOpen(!isMoreMenuOpen)
  }

  return (
    <nav
      className="w-full flex items-center justify-between px-6 py-3 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border-b border-slate-600/60 shadow-2xl relative"
      style={{ minHeight: 60 }}
    >
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg ring-2 ring-orange-400/30">
            {(() => {
              const RUTA_ICONO_NAVBAR = "/static/favicon.ico"
              return (
                <img
                  src={RUTA_ICONO_NAVBAR || "/placeholder.svg"}
                  alt="Logo FerreDesk"
                  className="w-6 h-6 object-contain"
                />
              )
            })()}
          </div>
          <span className="font-bold text-xl text-white bg-gradient-to-r from-orange-400 to-orange-300 bg-clip-text text-transparent drop-shadow-sm">
            FerreDesk
          </span>
        </div>

        <div className="flex items-center gap-2 bg-slate-600/50 rounded-2xl p-2 shadow-lg border border-slate-500/40">
          {/* Panel Principal */}
          <a
            href="/dashboard"
            onClick={(e) => handleLinkClick(e, "/dashboard")}
            className="p-3 rounded-xl hover:bg-slate-500/60 transition-all duration-300 relative group shadow-sm hover:shadow-md transform hover:scale-105 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-slate-200"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-3 px-3 py-2 bg-slate-800/95 text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap shadow-xl border border-slate-600 z-50">
              Panel Principal
            </span>
          </a>

          {/* Clientes */}
          <a
            href="/dashboard/clientes"
            onClick={(e) => handleLinkClick(e, "/dashboard/clientes")}
            className="p-3 rounded-xl hover:bg-blue-500/20 transition-all duration-300 relative group shadow-sm hover:shadow-md transform hover:scale-105 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-blue-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
              />
            </svg>
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-3 px-3 py-2 bg-slate-800/95 text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap shadow-xl border border-slate-600 z-50">
              Clientes
            </span>
          </a>

          {/* Presupuestos y Ventas */}
          <a
            href="/dashboard/presupuestos"
            onClick={(e) => handleLinkClick(e, "/dashboard/presupuestos")}
            className="p-3 rounded-xl hover:bg-emerald-500/20 transition-all duration-300 relative group shadow-sm hover:shadow-md transform hover:scale-105 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-emerald-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-3 px-3 py-2 bg-slate-800/95 text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap shadow-xl border border-slate-600 z-50">
              Presupuestos y Ventas
            </span>
          </a>

          {/* Productos */}
          <a
            href="/dashboard/productos"
            onClick={(e) => handleLinkClick(e, "/dashboard/productos")}
            className="p-3 rounded-xl hover:bg-purple-500/20 transition-all duration-300 relative group shadow-sm hover:shadow-md transform hover:scale-105 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-purple-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
              />
            </svg>
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-3 px-3 py-2 bg-slate-800/95 text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap shadow-xl border border-slate-600 z-50">
              Productos
            </span>
          </a>

          {/* Proveedores */}
          <a
            href="/dashboard/proveedores"
            onClick={(e) => handleLinkClick(e, "/dashboard/proveedores")}
            className="p-3 rounded-xl hover:bg-red-500/20 transition-all duration-300 relative group shadow-sm hover:shadow-md transform hover:scale-105 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-red-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
              />
            </svg>
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-3 px-3 py-2 bg-slate-800/95 text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap shadow-xl border border-slate-600 z-50">
              Proveedores
            </span>
          </a>

          {/* Menú Más Herramientas */}
          <div className="relative">
            <button
              onClick={toggleMoreMenu}
              className="p-3 rounded-xl hover:bg-indigo-500/20 transition-all duration-300 relative group shadow-sm hover:shadow-md transform hover:scale-105"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-indigo-400"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
              </svg>
              <span className="absolute left-1/2 -translate-x-1/2 top-full mt-3 px-3 py-2 bg-slate-800/95 text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap shadow-xl border border-slate-600 z-50">
                Más Herramientas
              </span>
            </button>

            {/* Dropdown Menu */}
            {isMoreMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-600/60 py-2 z-50">
                <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-600/40 mb-1">
                  Herramientas Adicionales
                </div>

                <a
                  href="/dashboard/notas"
                  onClick={(e) => handleLinkClick(e, "/dashboard/notas")}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-yellow-500/10 transition-all duration-200 text-left group cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-4 h-4 text-yellow-400 group-hover:text-yellow-300"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                  <span className="text-slate-200 text-sm font-medium group-hover:text-white">Notas</span>
                </a>

                <a
                  href="/dashboard/notas-alertas-notificaciones"
                  onClick={(e) => handleLinkClick(e, "/dashboard/notas-alertas-notificaciones")}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-all duration-200 text-left group cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-4 h-4 text-red-400 group-hover:text-red-300"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                    />
                  </svg>
                  <span className="text-slate-200 text-sm font-medium group-hover:text-white">Alertas</span>
                </a>

                <a
                  href="/dashboard/dashboards"
                  onClick={(e) => handleLinkClick(e, "/dashboards")}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cyan-500/10 transition-all duration-200 text-left group cursor-pointer"
                >
                  <svg
                    className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <span className="text-slate-200 text-sm font-medium group-hover:text-white">Dashboards</span>
                </a>

                <a
                  href="/dashboard/informes"
                  onClick={(e) => handleLinkClick(e, "/dashboard/informes")}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-teal-500/10 transition-all duration-200 text-left group cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-4 h-4 text-teal-400 group-hover:text-teal-300"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                  <span className="text-slate-200 text-sm font-medium group-hover:text-white">Informes</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right side - User info and actions */}
      <div className="flex items-center gap-3">
        {/* Configuration Button */}
        <a
          href="/dashboard/configuracion"
          onClick={(e) => handleLinkClick(e, "/dashboard/configuracion")}
          className="p-2.5 rounded-xl bg-slate-600/50 hover:bg-slate-500/60 transition-all duration-300 relative group shadow-sm hover:shadow-md transform hover:scale-105 border border-slate-500/40 cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 text-slate-300"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          <span className="absolute right-0 top-full mt-3 px-3 py-2 bg-slate-800/95 text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap shadow-xl border border-slate-600 z-50">
            Configuración
          </span>
        </a>

        {/* User Info */}
        <div className="flex items-center gap-3 bg-slate-600/50 rounded-2xl px-4 py-2 shadow-lg border border-slate-500/40">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md ring-2 ring-orange-400/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 text-white"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
              />
            </svg>
          </div>
          <span className="text-slate-200 text-sm font-semibold">
            {user?.username ? user.username : "Usuario Invitado"}
          </span>
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white text-sm font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4"
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

      {/* Overlay to close dropdown when clicking outside */}
      {isMoreMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsMoreMenuOpen(false)} />}
    </nav>
  )
}
