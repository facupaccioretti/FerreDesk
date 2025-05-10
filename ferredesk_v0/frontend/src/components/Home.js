import React, { useEffect, useState } from 'react';
import DashboardBackground from './DashboardBackground';

const cards = [
  { emoji: '⚙️', label: 'Configuración' },
  { emoji: '👥', label: 'Clientes' },
  { emoji: '📝', label: 'Presupuestos' },
  { emoji: '🛒', label: 'Productos' },
  { emoji: '💰', label: 'Ventas' },
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 relative">
      <DashboardBackground dark={darkMode} />
      <button
        onClick={toggleDarkMode}
        className="absolute top-6 right-6 z-10 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-full p-3 shadow-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition"
        aria-label="Alternar modo oscuro"
      >
        {darkMode ? '🌙' : '☀️'}
      </button>
      <h2 className="mb-10 text-4xl font-extrabold text-gray-800 dark:text-gray-100 text-center">Panel Principal</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex flex-col items-center justify-center rounded-xl shadow-lg p-8 w-56 h-56 transition-transform hover:scale-105 hover:shadow-2xl cursor-pointer border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900"
          >
            <span className="text-6xl mb-4">{card.emoji}</span>
            <span className="text-xl font-semibold mt-2 text-gray-700 dark:text-gray-200">{card.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home; 