"use client"

import React, { useState, useEffect } from 'react';
import Navbar from '../Navbar';
import StockBajoList from './StockBajoList';
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme";

const InformesManager = () => {
  const theme = useFerreDeskTheme();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("stock-bajo");

  useEffect(() => {
    document.title = "Informes - FerreDesk";
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
      try {
        setUser(JSON.parse(userInfo));
      } catch (error) {
        console.error('Error al parsear información del usuario:', error);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const tabs = [
    { key: "stock-bajo", label: "Stock Bajo" },
    // Aquí se podrían agregar más informes en el futuro
    // { key: "compras", label: "Informe de Compras" },
    // { key: "ventas", label: "Informe de Ventas" },
  ];

  return (
    <div className={theme.fondo}>
      <div className={theme.patron}></div>
      <div className={theme.overlay}></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar user={user} onLogout={handleLogout} />

        <div className="flex-1 py-6 px-4">
          <div className="max-w-[1400px] w-full mx-auto flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Informes</h2>
            </div>

            {/* Área principal: similar al ProductosManager */}
            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
              {/* Tabs */}
              <div className="flex items-center border-b border-slate-700 px-6 pt-3 bg-gradient-to-r from-slate-800 to-slate-700">
                {tabs.map((tab) => (
                  <div
                    key={tab.key}
                    className={`flex items-center px-5 py-3 mr-2 rounded-t-lg cursor-pointer transition-colors ${activeTab === tab.key
                      ? theme.tabActiva
                      : theme.tabInactiva
                      }`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <span className="text-sm font-medium">{tab.label}</span>
                  </div>
                ))}
              </div>

              {/* Contenido Dinámico */}
              <div className="flex-1 p-6 overflow-auto">
                {activeTab === "stock-bajo" && <StockBajoList />}

                {/* Fallback para otras pestañas */}
                {activeTab !== "stock-bajo" && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <p>Este informe estará disponible próximamente.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InformesManager;