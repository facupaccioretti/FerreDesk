import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Importar estilos del sistema de diseño FerreDesk
import './styles/design-tokens.css';
import './styles/utilities.css';

// React Toastify
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Landing from './components/Landing';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import ClientesManager from './components/Clientes/ClientesManager';
import RutaPrivada from './components/RutaPrivada';
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
import CuentaCorrienteProveedorManager from './components/CuentaCorrienteProveedor/CuentaCorrienteProveedorManager';
import CajaManager from './components/Caja/CajaManager';
import AsistenteConfiguracion from './components/AsistenteConfiguracion/AsistenteConfiguracion';

// Componente principal con rutas
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/setup"
          element={
            <RutaPrivada>
              <AsistenteConfiguracion />
            </RutaPrivada>
          }
        />
        <Route
          path="/home"
          element={
            <RutaPrivada>
              <Home />
            </RutaPrivada>
          }
        />
        <Route
          path="/home/carga-inicial-proveedor"
          element={
            <RutaPrivada>
              <CargaInicialProveedor />
            </RutaPrivada>
          }
        />
        <Route
          path="/dashboards"
          element={
            <RutaPrivada>
              <DashboardsManager />
            </RutaPrivada>
          }
        />
        <Route
          path="/home/clientes"
          element={
            <RutaPrivada>
              <ClientesManager />
            </RutaPrivada>
          }
        />
        <Route
          path="/home/productos"
          element={
            <RutaPrivada>
              <ProductosManager />
            </RutaPrivada>
          }
        />
        <Route
          path="/home/proveedores"
          element={
            <RutaPrivada>
              <ProveedoresManager />
            </RutaPrivada>
          }
        />
        <Route
          path="/home/compras"
          element={
            <RutaPrivada>
              <ComprasManager />
            </RutaPrivada>
          }
        />
        <Route
          path="/home/presupuestos"
          element={
            <RutaPrivada>
              <PresupuestosManager />
            </RutaPrivada>
          }
        />
        <Route
          path="/home/libro-iva-ventas"
          element={
            <RutaPrivada>
              <LibroIvaVentasManager />
            </RutaPrivada>
          }
        />
        <Route
          path="/home/notas"
          element={
            <RutaPrivada>
              <NotasManager />
            </RutaPrivada>
          }
        />
        <Route
          path="/home/notas-alertas-notificaciones"
          element={
            <RutaPrivada>
              <NotasAlertasNotificaciones />
            </RutaPrivada>
          }
        />
        <Route
          path="/home/configuracion"
          element={
            <RutaPrivada>
              <ConfiguracionManager />
            </RutaPrivada>
          }
        />
        <Route
          path="/home/informes"
          element={
            <RutaPrivada>
              <InformesManager />
            </RutaPrivada>
          }
        />
        <Route
          path="/home/cuenta-corriente"
          element={
            <RutaPrivada>
              <CuentaCorrienteManager />
            </RutaPrivada>
          }
        />
        <Route
          path="/home/cuenta-corriente-proveedores"
          element={
            <RutaPrivada>
              <CuentaCorrienteProveedorManager />
            </RutaPrivada>
          }
        />
        <Route
          path="/home/caja"
          element={
            <RutaPrivada>
              <CajaManager />
            </RutaPrivada>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Ruta catch-all para URLs erróneas - debe ir AL FINAL */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer position="bottom-right" theme="light" autoClose={5000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover icon={false} />
    </Router >
  );
}


