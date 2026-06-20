"use client"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAppShellContext } from "../contexts/AppShellContext"
import { useFerreDeskTheme } from "../hooks/useFerreDeskTheme"

// Icono de cada item de navegacion
const NAV_ITEMS = [
  {
    path: "/home",
    label: "Panel Principal",
    hoverColor: "hover:bg-slate-500/60",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-200">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    path: "/home/clientes",
    label: "Clientes",
    hoverColor: "hover:bg-blue-500/20",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-400">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
  {
    path: "/home/productos",
    label: "Productos",
    hoverColor: "hover:bg-purple-500/20",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-5 h-5 text-purple-400">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" color="currentColor">
          <path d="M21 7v5M3 7v10.161c0 1.383 1.946 2.205 5.837 3.848C10.4 21.67 11.182 22 12 22V11.355M15 19s.875 0 1.75 2c0 0 2.78-5 5.25-6" />
          <path d="M8.326 9.691L5.405 8.278C3.802 7.502 3 7.114 3 6.5s.802-1.002 2.405-1.778l2.92-1.413C10.13 2.436 11.03 2 12 2s1.871.436 3.674 1.309l2.921 1.413C20.198 5.498 21 5.886 21 6.5s-.802 1.002-2.405 1.778l-2.92 1.413C13.87 10.564 12.97 11 12 11s-1.871-.436-3.674-1.309M6 12l2 1m9-9L7 9" />
        </g>
      </svg>
    ),
  },
  {
    path: "/home/proveedores",
    label: "Proveedores",
    hoverColor: "hover:bg-red-500/20",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-400">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  {
    path: "/home/presupuestos",
    label: "Presupuestos y Ventas",
    hoverColor: "hover:bg-emerald-500/20",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-emerald-400">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    path: "/home/compras",
    label: "Compras",
    hoverColor: "hover:bg-orange-500/20",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-orange-400">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
      </svg>
    ),
  },
  {
    path: "/home/caja",
    label: "Caja, Banco y Cheques",
    hoverColor: "hover:bg-cyan-500/20",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-cyan-400">
        <path d="M21 15h-2.5c-.398 0-.779.158-1.061.439-.281.281-.439.663-.439 1.061 0 .398.158.779.439 1.061.281.281.663.439 1.061.439h1c.398 0 .779.158 1.061.439.281.281.439.663.439 1.061 0 .398-.158.779-.439 1.061-.281.281-.663.439-1.061.439H17" />
        <path d="M19 21v1m0 -8v1" />
        <path d="M13 21h-7c-.53 0-1.039-.211-1.414-.586-.375-.375-.586-.884-.586-1.414v-10c0-.53.211-1.039.586-1.414.375-.375.884-.586 1.414-.586h2m12 3.12v-1.12c0-.53-.211-1.039-.586-1.414-.375-.375-.884-.586-1.414-.586h-2" />
        <path d="M16 10v-6c0-.53-.211-1.039-.586-1.414-.375-.375-.884-.586-1.414-.586h-4c-.53 0-1.039.211-1.414.586-.375.375-.586.884-.586 1.414v6m8 0h-8m8 0h1m-9 0h-1" />
        <path d="M8 14v.01M8 17v.01M12 13.99v.01M12 17v.01" />
      </svg>
    ),
  },
  {
    path: "/home/cuenta-corriente",
    label: "C.C. Clientes",
    hoverColor: "hover:bg-indigo-500/20",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-indigo-400">
        <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
        <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
      </svg>
    ),
  },
  {
    path: "/home/cuenta-corriente-proveedores",
    label: "C.C. Proveedor",
    hoverColor: "hover:bg-rose-500/20",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-rose-400">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    ),
  },
]

// Items del dropdown "Mas Herramientas"
const MORE_ITEMS = [
  {
    path: "/home/informes",
    label: "Informes",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-teal-400 group-hover:text-teal-300">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    path: "/home/carga-inicial-proveedor",
    label: "Carga Inicial",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-teal-400 group-hover:text-teal-300">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
      </svg>
    ),
  },
]

// Tooltip reutilizable. align controla si abre a izquierda, derecha o centro
function NavTooltip({ label, align = "center" }) {
  const posClass =
    align === "right"
      ? "right-0"
      : align === "left"
      ? "left-0"
      : "left-1/2 -translate-x-1/2"

  return (
    <span
      className={`absolute ${posClass} top-full mt-2 px-2.5 py-1.5 bg-slate-800/95 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-xl border border-slate-600 z-50 pointer-events-none`}
    >
      {label}
    </span>
  )
}

function NavSeparator() {
  return <span aria-hidden="true" className="h-3.5 w-px shrink-0 rounded-full bg-slate-400/20" />
}

export default function Navbar({ user, onLogout, forceRender = false }) {
  const navigate = useNavigate()
  const theme = useFerreDeskTheme()
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { hasGlobalNavbar } = useAppShellContext()

  if (hasGlobalNavbar && !forceRender) {
    return null
  }

  const handleNavigation = (path) => {
    navigate(path)
    setIsMoreMenuOpen(false)
    setIsMobileMenuOpen(false)
  }

  const handleLinkClick = (e, path) => {
    e.preventDefault()
    handleNavigation(path)
  }

  return (
    <>
      {/* Barra principal — altura fija h-12, nunca crece */}
      <nav className="sticky top-0 z-50 h-12 flex items-center justify-between border-b border-slate-600/60 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-3 shadow-2xl sm:px-4">

        {/* Izquierda: logo + items de navegacion (solo desktop) */}
        <div className="flex items-center gap-3 min-w-0">

          {/* Logo */}
          <a
            href="/home"
            onClick={(e) => handleLinkClick(e, "/home")}
            className="flex shrink-0 items-center gap-2 cursor-pointer"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-md ring-1 ring-orange-400/30">
              <img src="/favicon.ico" alt="Logo FerreDesk" className="h-4 w-4 object-contain" />
            </div>
            <span className="shrink-0 bg-gradient-to-r from-orange-400 to-orange-300 bg-clip-text text-base font-bold text-transparent">
              FerreDesk
            </span>
          </a>

          {/* Items de nav — visibles solo en pantallas medianas y grandes */}
          <div className="hidden md:flex items-center gap-0.5">
            {NAV_ITEMS.map((item, index) => (
              <div key={item.path} className="flex items-center gap-0.5">
                {index > 0 && <NavSeparator />}
                <div className="relative group shrink-0">
                  <a
                    href={item.path}
                    onClick={(e) => handleLinkClick(e, item.path)}
                    className={`flex items-center justify-center p-1.5 rounded-lg ${item.hoverColor} transition-colors duration-200 cursor-pointer`}
                  >
                    {item.icon}
                  </a>
                  <NavTooltip label={item.label} />
                </div>
              </div>
            ))}

            {/* Boton "Mas Herramientas" */}
            <div className="flex items-center gap-0.5">
              <NavSeparator />
              <div className="relative group shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                  className="flex items-center justify-center p-1.5 rounded-lg hover:bg-indigo-500/20 transition-colors duration-200"
                  aria-label="Mas herramientas"
                  aria-expanded={isMoreMenuOpen}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-indigo-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
                  </svg>
                </button>
                <NavTooltip label="Mas Herramientas" />

                {isMoreMenuOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-52 bg-slate-800/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-600/60 py-1.5 z-50">
                    <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-600/40">
                      Herramientas Adicionales
                    </p>
                    {MORE_ITEMS.map((item) => (
                      <a
                        key={item.path}
                        href={item.path}
                        onClick={(e) => handleLinkClick(e, item.path)}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-teal-500/10 transition-colors duration-150 group cursor-pointer"
                      >
                        {item.icon}
                        <span className="text-slate-200 text-sm font-medium group-hover:text-white">{item.label}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Derecha: configuracion, usuario, salir, hamburguesa mobile */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">

          {/* Configuracion — siempre visible */}
          <div className="relative group">
            <a
              href="/home/configuracion"
              onClick={(e) => handleLinkClick(e, "/home/configuracion")}
              className="flex items-center justify-center p-1.5 rounded-lg bg-slate-600/50 hover:bg-slate-500/60 transition-colors duration-200 border border-slate-500/40 cursor-pointer"
              aria-label="Configuracion"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </a>
            <NavTooltip label="Configuracion" align="right" />
          </div>

          {/* Usuario — nombre visible solo en sm+ */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-500/40 bg-slate-600/50 px-2 py-1 shadow-inner">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 shadow ring-1 ring-orange-400/30">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <span className="hidden sm:block max-w-[120px] truncate text-xs font-semibold text-slate-200">
              {user?.username ?? "Invitado"}
            </span>
          </div>

          {/* Salir */}
          <button
            type="button"
            onClick={onLogout}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-orange-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:from-orange-700 hover:to-orange-800 shadow"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
            <span className="hidden sm:inline">Salir</span>
          </button>

          {/* Hamburguesa — solo en mobile (md:hidden) */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="md:hidden flex items-center justify-center p-1.5 rounded-lg hover:bg-slate-500/60 transition-colors duration-200 border border-slate-500/40"
            aria-label="Menu de navegacion"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-200">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-200">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Menu mobile — se despliega DEBAJO del nav, no lo estira */}
      {isMobileMenuOpen && (
        <div className={`md:hidden sticky top-12 z-40 bg-gradient-to-r ${theme.primario} border-b border-slate-600/60 shadow-xl`}>
          <div className="grid grid-cols-4 gap-1 p-3">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => handleLinkClick(e, item.path)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl ${item.hoverColor} transition-colors duration-200 cursor-pointer`}
              >
                {item.icon}
                <span className="text-slate-300 text-[10px] text-center leading-tight">{item.label}</span>
              </a>
            ))}
            {MORE_ITEMS.map((item) => (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => handleLinkClick(e, item.path)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-teal-500/10 transition-colors duration-200 cursor-pointer"
              >
                {item.icon}
                <span className="text-slate-300 text-[10px] text-center leading-tight">{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Overlay para cerrar dropdowns al hacer click afuera */}
      {(isMoreMenuOpen || isMobileMenuOpen) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setIsMoreMenuOpen(false)
            setIsMobileMenuOpen(false)
          }}
        />
      )}
    </>
  )
}
