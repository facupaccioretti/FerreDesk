import React, { useState, useEffect } from 'react';
import { Button, Box, Typography, IconButton, Tooltip } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

const filtros = [
  { key: 'todas', label: 'Todas' },
  { key: 'stock', label: 'Stock' },
  { key: 'presupuestos', label: 'Presupuestos' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'proveedores', label: 'Proveedores' },
];

const tipoIcono = {
  stock: <Inventory2OutlinedIcon sx={{ color: '#1976d2' }} />,
  presupuestos: <ReceiptLongOutlinedIcon sx={{ color: '#43a047' }} />,
  ventas: <MonetizationOnOutlinedIcon sx={{ color: '#fbc02d' }} />,
  proveedores: <LocalShippingOutlinedIcon sx={{ color: '#ff7043' }} />,
  general: <NotificationsNoneIcon sx={{ color: '#616161' }} />,
  alerta: <ErrorOutlineIcon sx={{ color: '#e53935' }} />,
};

const estadosColor = {
  'Activa': 'bg-green-100 text-green-800',
  'Resuelta': 'bg-gray-100 text-gray-600',
};

const tipoMap = {
  stock: 'stock',
  presupuestos: 'presupuestos',
  ventas: 'ventas',
  proveedores: 'proveedores',
  vencimiento: 'presupuestos',
  pago: 'ventas',
  otro: 'general',
};

const AlertasManager = () => {
  const [filtro, setFiltro] = useState('todas');
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAlertas();
  }, []);

  const fetchAlertas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alertas/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar alertas');
      const data = await res.json();
      setAlertas(data);
    } catch (e) {
      setAlertas([]);
    } finally {
      setLoading(false);
    }
  };

  const alertasFiltradas = filtro === 'todas'
    ? alertas
    : alertas.filter(a => tipoMap[a.tipo] === filtro);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <Box className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
            <Typography variant="h4" className="font-bold">Gestión de Alertas</Typography>
            <Button
              variant="contained"
              sx={{ backgroundColor: '#111', color: '#fff', borderRadius: 2, fontWeight: 700, textTransform: 'none', px: 3, py: 1.2, boxShadow: 2, '&:hover': { backgroundColor: '#222' } }}
              startIcon={<ErrorOutlineIcon />}
            >
              + Nueva Alerta
            </Button>
          </Box>
          <Box className="flex flex-wrap items-center gap-2 mb-4">
            {filtros.map(f => {
              const activo = filtro === f.key;
              return (
                <Button
                  key={f.key}
                  onClick={() => setFiltro(f.key)}
                  variant={activo ? 'contained' : 'outlined'}
                  sx={{
                    backgroundColor: activo ? '#111' : '#f5f5f5',
                    color: activo ? '#fff' : '#222',
                    borderRadius: 2,
                    fontWeight: 700,
                    textTransform: 'none',
                    minWidth: 110,
                    boxShadow: activo ? 2 : 0,
                    border: activo ? 'none' : '1.5px solid #e0e0e0',
                    '&:hover': {
                      backgroundColor: activo ? '#222' : '#e0e0e0',
                      color: '#111',
                    },
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                  }}
                >
                  <span>{f.label}</span>
                </Button>
              );
            })}
            <Box flex={1} />
          </Box>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full bg-white">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-sm">
                  <th className="py-3 px-4 text-left font-semibold">Tipo</th>
                  <th className="py-3 px-4 text-left font-semibold">Título</th>
                  <th className="py-3 px-4 text-left font-semibold">Descripción</th>
                  <th className="py-3 px-4 text-left font-semibold">Fecha</th>
                  <th className="py-3 px-4 text-left font-semibold">Estado</th>
                  <th className="py-3 px-4 text-center font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Cargando alertas...</td></tr>
                ) : alertasFiltradas.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No hay alertas</td></tr>
                ) : alertasFiltradas.map(alerta => (
                  <tr key={alerta.id} className="border-b last:border-b-0 hover:bg-gray-50 transition-all">
                    <td className="py-3 px-4 flex items-center gap-2">
                      {tipoIcono[tipoMap[alerta.tipo]] || tipoIcono['general']}
                      <span className="capitalize font-medium">{alerta.tipo_display || alerta.tipo}</span>
                    </td>
                    <td className="py-3 px-4">{alerta.titulo}</td>
                    <td className="py-3 px-4">{alerta.descripcion}</td>
                    <td className="py-3 px-4">{alerta.fecha_creacion?.slice(0, 10)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${alerta.activa ? estadosColor['Activa'] : estadosColor['Resuelta']}`}>{alerta.activa ? 'Activa' : 'Resuelta'}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Tooltip title="Ver"><IconButton><VisibilityOutlinedIcon sx={{ color: '#1976d2' }} /></IconButton></Tooltip>
                      <Tooltip title="Editar"><IconButton><EditOutlinedIcon sx={{ color: '#43a047' }} /></IconButton></Tooltip>
                      <Tooltip title="Eliminar"><IconButton><DeleteOutlineIcon sx={{ color: '#e53935' }} /></IconButton></Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertasManager; 