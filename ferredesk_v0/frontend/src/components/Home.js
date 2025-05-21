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
    label: 'Presupuestos y Ventas',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-14 h-14 text-black">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
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
    label: 'Proveedores',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-14 h-14 text-black">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
];

const SITUACION_IVA_LABELS = {
  'RI': 'Responsable Inscripto',
  'MO': 'Monotributista',
};

const getInitialDarkMode = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    // Si no hay preferencia guardada, usar preferencia del sistema
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
};

// Función para obtener el valor de una cookie por nombre
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

const Home = () => {
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const [user, setUser] = useState(null);
  const [ferreteria, setFerreteria] = useState(null);
  const [editIva, setEditIva] = useState(false);
  const [newIva, setNewIva] = useState('RI');
  const [loadingIva, setLoadingIva] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    document.title = "Panel Principal FerreDesk";
  }, []);

  useEffect(() => {
    fetch("/api/user/", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") setUser(data.user);
      });
    fetch("/api/ferreteria/", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data && data.situacion_iva) {
          setFerreteria(data);
          setNewIva(data.situacion_iva);
        }
      });
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
    if (label === 'Presupuestos y Ventas') {
      window.open('/dashboard/presupuestos', '_blank');
    }
    // Puedes agregar navegación para otras tarjetas aquí
  };

  const handleLogout = () => {
    setUser(null);
    window.location.href = "/login";
  };

  const handleIvaChange = async () => {
    if (!window.confirm('¿Estás seguro de cambiar la situación fiscal del negocio? Esto afectará la emisión de comprobantes.')) return;
    setLoadingIva(true);
    setFeedback('');
    try {
      const csrftoken = getCookie('csrftoken');
      const res = await fetch('/api/ferreteria/', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        credentials: 'include',
        body: JSON.stringify({ situacion_iva: newIva })
      });
      if (!res.ok) throw new Error('Error al actualizar situación fiscal');
      const data = await res.json();
      setFerreteria(data);
      setEditIva(false);
      setFeedback('Situación fiscal actualizada correctamente.');
    } catch (e) {
      setFeedback('Error al actualizar situación fiscal.');
    } finally {
      setLoadingIva(false);
    }
  };

  console.log('user:', user);
  console.log('ferreteria:', ferreteria);

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
        {/* Bloque de situación fiscal - ahora widget fijo abajo a la izquierda */}
        {user && user.is_staff && ferreteria && (
          <div className="fixed bottom-6 left-6 z-40 bg-white rounded-lg shadow border border-gray-200 p-3 text-xs w-60 flex flex-col items-start">
            <div className="mb-1 font-semibold text-gray-800 text-xs">Situación Fiscal del Negocio</div>
            <div className="mb-2 text-gray-700 text-xs">
              Actual: <span className="font-bold">{SITUACION_IVA_LABELS[ferreteria.situacion_iva] || ferreteria.situacion_iva}</span>
            </div>
            {editIva ? (
              <div className="flex flex-col items-start gap-1 w-full">
                <select
                  className="px-2 py-1 border border-gray-300 rounded w-full text-xs"
                  value={newIva}
                  onChange={e => setNewIva(e.target.value)}
                  disabled={loadingIva}
                >
                  <option value="RI">Responsable Inscripto</option>
                  <option value="MO">Monotributista</option>
                </select>
                <div className="flex gap-1 mt-1">
                  <button
                    className="px-2 py-1 bg-black text-white rounded hover:bg-gray-800 text-xs"
                    onClick={handleIvaChange}
                    disabled={loadingIva}
                  >
                    Guardar
                  </button>
                  <button
                    className="px-2 py-1 bg-gray-200 text-black rounded hover:bg-gray-300 text-xs"
                    onClick={() => { setEditIva(false); setNewIva(ferreteria.situacion_iva); }}
                    disabled={loadingIva}
                  >
                    Cancelar
                  </button>
                </div>
                {feedback && <div className="mt-1 text-green-700 text-xs">{feedback}</div>}
              </div>
            ) : (
              <button
                className="px-2 py-1 bg-black text-white rounded hover:bg-gray-800 text-xs"
                onClick={() => setEditIva(true)}
              >
                Cambiar Situación Fiscal
              </button>
            )}
            {!editIva && feedback && <div className="mt-1 text-green-700 text-xs">{feedback}</div>}
          </div>
        )}
        {/* Fin bloque situación fiscal */}
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