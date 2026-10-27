import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';

// Importar estilos del sistema de diseño FerreDesk
import './styles/design-tokens.css';
import './styles/utilities.css';

// React Toastify
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Landing from './modules/onboarding/components/Landing';
import Home from './components/Home';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Register from './modules/onboarding/components/Register';
import ActivarEmail from './modules/onboarding/components/ActivarEmail';
import PendienteVerificacion from './modules/onboarding/components/PendienteVerificacion';
import ClientesManager from './components/Clientes/ClientesManager';
import RutaPrivada from './components/RutaPrivada';
import ProductosManager from './components/Productos/ProductosManager';
import ProveedoresManager from './components/Proveedores/ProveedoresManager';
import PresupuestosManager from './components/Presupuestos y Ventas/PresupuestosManager';
import LibroIvaVentasManager from './components/Presupuestos y Ventas/LibroIvaVentas/LibroIvaVentasManager';
import ConfiguracionManager from './components/ConfiguracionManager';
import InformesManager from './components/Informes/InformesManager';
import DashboardsManager from './components/DashboardsManager';
import ComprasManager from './components/Compras/ComprasManager';
import CargaInicialProveedor from './components/Carga Inicial/CargaInicialProveedor';
import CuentaCorrienteManager from './components/CuentaCorriente/CuentaCorrienteManager';
import CuentaCorrienteProveedorManager from './components/CuentaCorrienteProveedor/CuentaCorrienteProveedorManager';
import CajaManager from './components/Caja/CajaManager';
import AsistenteConfiguracion from './components/AsistenteConfiguracion/AsistenteConfiguracion';
import ErrorBoundary from './components/ErrorBoundary';
import AppShell from './layouts/AppShell';

function AppShellRoutes() {
  return <AppShell><Outlet /></AppShell>;
}

// Componente principal con rutas
export default function App() {
  return (
    <Router>
      {/* Protege las rutas principales ante errores de render inesperados. */}
      <ErrorBoundary>
        <Routes>
          {/* ========================================== */}
        {/* RUTAS PÚBLICAS (Plataforma SaaS Onboarding) */}
        {/* ========================================== */}
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/activar-email" element={<ActivarEmail />} />
        <Route path="/pendiente-verificacion" element={<PendienteVerificacion />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* ========================================== */}
        {/* RUTAS TENANT (Acceso a Negocio)            */}
        {/* ========================================== */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ========================================== */}
        {/* RUTAS TENANT PROTEGIDAS (ERP Interno)      */}
        {/* ========================================== */}
        <Route element={<RutaPrivada permitirSetupIncompleto><Outlet /></RutaPrivada>}>
          <Route path="/setup" element={<RutaPrivada permitirSetupIncompleto><AsistenteConfiguracion /></RutaPrivada>} />
          <Route element={<AppShellRoutes />}>
            <Route path="/home" element={<RutaPrivada permiso="dashboard.ver"><Home /></RutaPrivada>} />
            <Route path="/home/carga-inicial-proveedor" element={<RutaPrivada permiso="proveedores.modificar"><CargaInicialProveedor /></RutaPrivada>} />
            <Route path="/dashboards" element={<RutaPrivada permiso="dashboard.ver"><DashboardsManager /></RutaPrivada>} />
            <Route path="/home/clientes" element={<RutaPrivada permiso="clientes.ver"><ClientesManager /></RutaPrivada>} />
            <Route path="/home/productos" element={<RutaPrivada permiso="productos.ver"><ProductosManager /></RutaPrivada>} />
            <Route path="/home/proveedores" element={<RutaPrivada permiso="proveedores.ver"><ProveedoresManager /></RutaPrivada>} />
            <Route path="/home/compras" element={<RutaPrivada permiso="compras.ver"><ComprasManager /></RutaPrivada>} />
            <Route path="/home/presupuestos" element={<RutaPrivada permitirSetupIncompleto permiso="ventas.ver"><PresupuestosManager /></RutaPrivada>} />
            <Route path="/home/libro-iva-ventas" element={<RutaPrivada permiso="ventas.ver"><LibroIvaVentasManager /></RutaPrivada>} />
            <Route path="/home/configuracion" element={<RutaPrivada permisos={["configuracion.negocio", "configuracion.fiscal"]} capacidad="puede_gestionar_perfiles"><ConfiguracionManager /></RutaPrivada>} />
            <Route path="/home/informes" element={<RutaPrivada permiso="informes.ver"><InformesManager /></RutaPrivada>} />
            <Route path="/home/cuenta-corriente" element={<RutaPrivada permiso="cuenta_corriente.ver"><CuentaCorrienteManager /></RutaPrivada>} />
            <Route path="/home/cuenta-corriente-proveedores" element={<RutaPrivada permiso="cuenta_corriente.ver"><CuentaCorrienteProveedorManager /></RutaPrivada>} />
            <Route path="/home/caja" element={<RutaPrivada permiso="caja.ver"><CajaManager /></RutaPrivada>} />
            <Route path="/home/notas" element={<Navigate to="/home" replace />} />
            <Route path="/home/notas-alertas-notificaciones" element={<Navigate to="/home" replace />} />
          </Route>
        </Route>
        
        {/* ========================================== */}
        {/* RUTAS CATCH-ALL                            */}
        {/* ========================================== */}
        {/* Ruta catch-all para URLs erróneas - debe ir AL FINAL */}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
      <ToastContainer position="bottom-right" theme="light" autoClose={5000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover icon={false} />
    </Router >
  );
}
