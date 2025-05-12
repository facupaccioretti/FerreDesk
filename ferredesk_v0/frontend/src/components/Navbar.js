import React from "react";

export default function Navbar({ user, onLogout }) {
  return (
    <nav className="w-full flex items-center justify-between px-5 py-2 bg-white border-b border-gray-400" style={{ minHeight: 60 }}>
      <span className="font-semibold text-base text-gray-800">Sistema de Gestión</span>
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
