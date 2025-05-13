import React from "react";
import { useNavigate } from "react-router-dom";

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <nav className="w-full flex items-center justify-between px-5 py-2 bg-white border-b border-gray-400" style={{ minHeight: 60 }}>
      <div className="flex items-center gap-4">
        <span className="font-semibold text-base text-gray-800">Sistema de Gestión</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleNavigation('/dashboard')}
            className="p-2 rounded hover:bg-gray-100 transition relative group"
            title="Panel Principal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
              Panel Principal
            </span>
          </button>

          <button
            onClick={() => handleNavigation('/dashboard/clientes')}
            className="p-2 rounded hover:bg-gray-100 transition relative group"
            title="Clientes"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
              Clientes
            </span>
          </button>

          <button
            onClick={() => handleNavigation('/dashboard/productos')}
            className="p-2 rounded hover:bg-gray-100 transition relative group"
            title="Productos"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
              Productos
            </span>
          </button>

          <button
            onClick={() => handleNavigation('/dashboard/proveedores')}
            className="p-2 rounded hover:bg-gray-100 transition relative group"
            title="Proveedores"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" className="w-6 h-6 text-black" fill="currentColor">
              <g transform="translate(0,300) scale(0.1,-0.1)">
                <path d="M905 2763 c-89 -20 -141 -58 -178 -127 -30 -57 -32 -242 -3 -296 55-105 159-156 266-130 70 17 122 58 154 121 23 47 26 65 26 153 0 110 -15 157 -62 208 -47 50 -147 85 -203 71z m106 -116 c49 -32 69 -79 69 -160 0 -116 -42 -176 -128 -185 -59 -5 -105 15 -132 61 -29 47 -29 196 0 242 39 64 129 84 191 42z"/>
                <path d="M695 2149 c-131 -19 -243 -104 -285 -217 -37 -99 -52 -314 -29 -422 19 -89 94 -149 187 -150 l42 0 0 -618 c0 -607 0 -619 20 -637 17 -15 24 -16 45 -7 l25 12 0 625 0 625 235 0 235 0 0 -619 0 -620 22 -15 c29 -20 34 -20 58 4 20 20 20 33 20 634 l0 614 54 4 c71 6 126 42 155 100 19 39 21 62 21 194 0 218 -21 293 -106 384 -52 56 -131 94 -224 109 -76 13 -389 12 -475 0z m553 -118 c30 -13 68 -42 88 -65 54 -63 68 -126 69 -303 0 -152 0 -152 -27 -179 -21 -21 -39 -28 -80 -32 -50 -4 -72 3 -317 104 -208 85 -265 113 -274 131 -5 13 -7 26 -3 30 4 4 125 -12 269 -36 l261 -43 18 22 c14 17 18 40 18 97 0 89 -10 113 -48 113 -40 0 -52 -17 -52 -75 l0 -52 -227 38 c-126 21 -231 39 -235 39 -4 0 -8 10 -10 21 -4 30 -40 42 -67 23 -19 -14 -21 -25 -21 -105 0 -145 12 -158 222 -245 l143 -59 -195 -3 c-226 -3 -254 0 -286 35 -23 25 -24 32 -24 173 0 180 18 253 76 313 77 79 111 86 409 84 230 -2 242 -3 293 -26z"/>
                <path d="M1702 2048 c-9 -9 -12 -239 -12 -975 0 -941 0 -963 19 -973 13 -6 186 -10 493 -10 412 0 476 2 496 16 l22 15 0 958 c0 731 -3 960 -12 969 -17 17 -989 17 -1006 0z m358 -199 c0 -66 5 -129 10 -140 10 -17 22 -19 128 -19 79 0 122 4 130 12 8 8 12 54 12 140 l0 129 141 -3 141 -3 -1 -414 c-1 -227 -3 -416 -5 -420 -2 -3 -191 -5 -420 -3 l-416 2 0 420 0 420 140 0 140 0 0 -121z m190 26 l0 -95 -45 0 -45 0 0 95 0 95 45 0 45 0 0 -95z m-190 -969 c0 -160 -4 -156 144 -156 74 0 116 4 124 12 8 8 12 54 12 140 l0 128 140 0 140 0 0 -420 0 -420 -420 0 -420 0 0 420 0 420 140 0 140 0 0 -124z m190 29 l0 -95 -45 0 -45 0 0 95 0 95 45 0 45 0 0 -95z"/>
                <path d="M902 1108 c-9 -9 -12 -124 -12 -500 l0 -488 24 -15 c19 -13 29 -14 45 -5 21 11 21 14 19 513 l-3 502 -30 3 c-17 2 -36 -3 -43 -10z"/>
              </g>
            </svg>
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
              Proveedores
            </span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex items-center text-gray-600 text-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 mr-1 opacity-60"
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
          className="flex items-center gap-1 px-3 py-1 rounded border border-gray-400 bg-white hover:bg-gray-200 text-black text-sm transition"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 opacity-60"
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
