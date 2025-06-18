import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './components/Landing';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import ClientesManager from './components/Clientes/ClientesManager';
import PrivateRoute from './components/PrivateRoute';
import ProductosManager from './components/Productos/ProductosManager';
import ProveedoresManager from './components/ProveedoresManager';
import PresupuestosManager from './components/PresupuestosManager';
import NotasManager from './components/NotasManager';
import NotasAlertasNotificaciones from './components/NotasAlertasNotificaciones';

// Componente principal con rutas
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/clientes"
          element={
            <PrivateRoute>
              <ClientesManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/productos"
          element={
            <PrivateRoute>
              <ProductosManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/proveedores"
          element={
            <PrivateRoute>
              <ProveedoresManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/presupuestos"
          element={
            <PrivateRoute>
              <PresupuestosManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/notas"
          element={
            <PrivateRoute>
              <NotasManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/notas-alertas-notificaciones"
          element={
            <PrivateRoute>
              <NotasAlertasNotificaciones />
            </PrivateRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </Router>
  );
}


