import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './components/Landing';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import ClientesManager from './components/ClientesManager';
import PrivateRoute from './components/PrivateRoute';
import ProductosManager from './components/ProductosManager';
import ProveedoresManager from './components/ProveedoresManager';

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
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </Router>
  );
}


