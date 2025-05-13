import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedBackground from './AnimatedBackground';
import Navbar from './Navbar';

const cards = [
  {
    label: 'Configuración',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-14 h-14 text-black">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
  {
    label: 'Clientes',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-14 h-14 text-black">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
  {
    label: 'Presupuestos',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-14 h-14 text-black">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    ),
  },
  {
    label: 'Productos',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-14 h-14 text-black">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
      </svg>
    ),
  },
  {
    label: 'Ventas',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-14 h-14 text-black">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    label: 'Proveedores',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" className="w-20 h-20 text-black" fill="currentColor">
        <g transform="translate(0,300) scale(0.1,-0.1)">
          <path d="M905 2763 c-89 -20 -141 -58 -178 -127 -30 -57 -32 -242 -3 -296 55-105 159-156 266-130 70 17 122 58 154 121 23 47 26 65 26 153 0 110 -15 157 -62 208 -47 50 -147 85 -203 71z m106 -116 c49 -32 69 -79 69 -160 0 -116 -42 -176 -128 -185 -59 -5 -105 15 -132 61 -29 47 -29 196 0 242 39 64 129 84 191 42z"/>
          <path d="M695 2149 c-131 -19 -243 -104 -285 -217 -37 -99 -52 -314 -29 -422 19 -89 94 -149 187 -150 l42 0 0 -618 c0 -607 0 -619 20 -637 17 -15 24 -16 45 -7 l25 12 0 625 0 625 235 0 235 0 0 -619 0 -620 22 -15 c29 -20 34 -20 58 4 20 20 20 33 20 634 l0 614 54 4 c71 6 126 42 155 100 19 39 21 62 21 194 0 218 -21 293 -106 384 -52 56 -131 94 -224 109 -76 13 -389 12 -475 0z m553 -118 c30 -13 68 -42 88 -65 54 -63 68 -126 69 -303 0 -152 0 -152 -27 -179 -21 -21 -39 -28 -80 -32 -50 -4 -72 3 -317 104 -208 85 -265 113 -274 131 -5 13 -7 26 -3 30 4 4 125 -12 269 -36 l261 -43 18 22 c14 17 18 40 18 97 0 89 -10 113 -48 113 -40 0 -52 -17 -52 -75 l0 -52 -227 38 c-126 21 -231 39 -235 39 -4 0 -8 10 -10 21 -4 30 -40 42 -67 23 -19 -14 -21 -25 -21 -105 0 -145 12 -158 222 -245 l143 -59 -195 -3 c-226 -3 -254 0 -286 35 -23 25 -24 32 -24 173 0 180 18 253 76 313 77 79 111 86 409 84 230 -2 242 -3 293 -26z"/>
          <path d="M1702 2048 c-9 -9 -12 -239 -12 -975 0 -941 0 -963 19 -973 13 -6 186 -10 493 -10 412 0 476 2 496 16 l22 15 0 958 c0 731 -3 960 -12 969 -17 17 -989 17 -1006 0z m358 -199 c0 -66 5 -129 10 -140 10 -17 22 -19 128 -19 79 0 122 4 130 12 8 8 12 54 12 140 l0 129 141 -3 141 -3 -1 -414 c-1 -227 -3 -416 -5 -420 -2 -3 -191 -5 -420 -3 l-416 2 0 420 0 420 140 0 140 0 0 -121z m190 26 l0 -95 -45 0 -45 0 0 95 0 95 45 0 45 0 0 -95z m-190 -969 c0 -160 -4 -156 144 -156 74 0 116 4 124 12 8 8 12 54 12 140 l0 128 140 0 140 0 0 -420 0 -420 -420 0 -420 0 0 420 0 420 140 0 140 0 0 -124z m190 29 l0 -95 -45 0 -45 0 0 95 0 95 45 0 45 0 0 -95z"/>
          <path d="M902 1108 c-9 -9 -12 -124 -12 -500 l0 -488 24 -15 c19 -13 29 -14 45 -5 21 11 21 14 19 513 l-3 502 -30 3 c-17 2 -36 -3 -43 -10z"/>
        </g>
      </svg>
    ),
  },
];

const getInitialDarkMode = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    // Si no hay preferencia guardada, usar preferencia del sistema
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
};

const Home = () => {
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const [user, setUser] = useState({ username: "ferreadmin" });

  useEffect(() => {
    document.title = "Panel Principal FerreDesk";
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (darkMode) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const handleCardClick = (label) => {
    if (label === 'Clientes') {
      window.open('/dashboard/clientes', '_blank');
    }
    if (label === 'Productos') {
      window.open('/dashboard/productos', '_blank');
    }
    if (label === 'Proveedores') {
      window.open('/dashboard/proveedores', '_blank');
    }
    // Puedes agregar navegación para otras tarjetas aquí
  };

  const handleLogout = () => {
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />
      <Navbar user={user} onLogout={handleLogout} />
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <button
          onClick={toggleDarkMode}
          className="fixed bottom-6 right-6 z-50 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-full p-3 shadow-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition"
          aria-label="Alternar modo oscuro"
        >
          {darkMode ? '🌙' : '☀️'}
        </button>
        <h2 className="mb-10 text-4xl font-extrabold text-red dark:text-black text-center">Panel Principal</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {cards.map((card) => (
            <div
              key={card.label}
              className="flex flex-col items-center justify-center rounded-xl shadow-lg p-8 w-56 h-56 transition-transform hover:scale-105 hover:shadow-2xl cursor-pointer border border-gray-100 dark:border-gray-700 bg-white dark:bg-white"
              onClick={() => handleCardClick(card.label)}
            >
              <span className="mb-4">{card.icon}</span>
              <span className="text-xl font-semibold mt-2 text-black">{card.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home; 