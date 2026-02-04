import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Importar estilos del sistema de diseño FerreDesk
import './styles/design-tokens.css';
import './styles/utilities.css';

import Landing from './components/Landing';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import ClientesManager from './components/Clientes/ClientesManager';
import PrivateRoute from './components/PrivateRoute';
import ProductosManager from './components/Productos/ProductosManager';
import ProveedoresManager from './components/Proveedores/ProveedoresManager';
import PresupuestosManager from './components/Presupuestos y Ventas/PresupuestosManager';
import LibroIvaVentasManager from './components/Presupuestos y Ventas/LibroIvaVentas/LibroIvaVentasManager';
import NotasManager from './components/NotasManager';
import NotasAlertasNotificaciones from './components/NotasAlertasNotificaciones';
import ConfiguracionManager from './components/ConfiguracionManager';
import InformesManager from './components/Informes/InformesManager';
import DashboardsManager from './components/DashboardsManager';
import ComprasManager from './components/Compras/ComprasManager';
import CargaInicialProveedor from './components/Carga Inicial/CargaInicialProveedor';
import CuentaCorrienteManager from './components/CuentaCorriente/CuentaCorrienteManager';
import CajaManager from './components/Caja/CajaManager';

// Componente principal con rutas
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/home"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/home/carga-inicial-proveedor"
          element={
            <PrivateRoute>
              <CargaInicialProveedor />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboards"
          element={
            <PrivateRoute>
              <DashboardsManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/home/clientes"
          element={
            <PrivateRoute>
              <ClientesManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/home/productos"
          element={
            <PrivateRoute>
              <ProductosManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/home/proveedores"
          element={
            <PrivateRoute>
              <ProveedoresManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/home/compras"
          element={
            <PrivateRoute>
              <ComprasManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/home/presupuestos"
          element={
            <PrivateRoute>
              <PresupuestosManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/home/libro-iva-ventas"
          element={
            <PrivateRoute>
              <LibroIvaVentasManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/home/notas"
          element={
            <PrivateRoute>
              <NotasManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/home/notas-alertas-notificaciones"
          element={
            <PrivateRoute>
              <NotasAlertasNotificaciones />
            </PrivateRoute>
          }
        />
        <Route
          path="/home/configuracion"
          element={
            <PrivateRoute>
              <ConfiguracionManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/home/informes"
          element={
            <PrivateRoute>
              <InformesManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/home/cuenta-corriente"
          element={
            <PrivateRoute>
              <CuentaCorrienteManager />
            </PrivateRoute>
          }
        />
        <Route
          path="/home/caja"
          element={
            <PrivateRoute>
              <CajaManager />
            </PrivateRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Ruta catch-all para URLs erróneas - debe ir AL FINAL */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}


