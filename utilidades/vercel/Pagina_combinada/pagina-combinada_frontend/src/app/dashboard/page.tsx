'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Users, Package, ShoppingCart, Settings, LogOut } from 'lucide-react';

export default function Dashboard() {
  const [dark, setDark] = useState(false);
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedDark = localStorage.getItem('dark');
    if (savedDark) {
      setDark(savedDark === 'true');
    }
    // Simulamos que ya cargó el usuario después de 500ms
    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, []);

  const toggleDark = () => {
    const newDark = !dark;
    setDark(newDark);
    localStorage.setItem('dark', newDark.toString());
  };

  const handleLogout = async () => {
    try {
      await fetch('http://127.0.0.1:8000/api/auth/logout/', {
        method: 'POST',
        credentials: 'include',
      });
      // Añadir parámetro de autenticación a la URL
      window.location.href = '/login?authFlow=true';
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800"></div>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className={`text-3xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
            FerreDesk Dashboard
          </h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleDark}
              className={`p-2 rounded-lg ${
                dark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'
              }`}
            >
              {dark ? '☀️' : '🌙'}
            </button>
            <Button variant="outline" onClick={handleLogout} className={dark ? "text-white" : ""}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <a
            href="/clients"
            target="_blank"
            rel="noopener noreferrer"
            className="h-32 flex flex-col items-center justify-center gap-2 bg-card hover:bg-accent rounded-lg border border-input transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            style={{ textDecoration: 'none' }}
          >
            <Users className="h-8 w-8" />
            <span className="text-lg">Clientes</span>
          </a>
          
          <Button 
            variant="outline" 
            className="h-32 flex flex-col items-center justify-center gap-2 bg-card hover:bg-accent"
          >
            <Package className="h-8 w-8" />
            <span className="text-lg">Productos</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-32 flex flex-col items-center justify-center gap-2 bg-card hover:bg-accent"
          >
            <ShoppingCart className="h-8 w-8" />
            <span className="text-lg">Ventas</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-32 flex flex-col items-center justify-center gap-2 bg-card hover:bg-accent"
          >
            <Settings className="h-8 w-8" />
            <span className="text-lg">Configuración</span>
          </Button>
        </div>
      </div>
    </div>
  );
} 