import React, { useState, useEffect, useCallback } from 'react';
import { Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Typography, Box, Grid, FormControlLabel, Checkbox, Chip, MenuItem, Select, InputLabel, FormControl, Tooltip, Badge, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Pagination } from '@mui/material';
import { Add as AddIcon, Star as StarIcon, StarBorder as StarBorderIcon, Delete as DeleteIcon, Edit as EditIcon, Archive as ArchiveIcon, Unarchive as UnarchiveIcon, Label as LabelIcon } from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Navbar from './Navbar';
import { getCookie } from '../utils/csrf';

const filtros = [
  { key: 'todas', label: 'Todas' },
  { key: 'importantes', label: 'Importantes' },
  { key: 'temporales', label: 'Temporales' },
  { key: 'sin_caducidad', label: 'Sin Caducidad' },
  { key: 'archivadas', label: 'Archivadas' },
  { key: 'eliminadas', label: 'Eliminadas' },
];

const estados = [
  { key: 'AC', label: 'Activa', color: 'primary' },
  { key: 'AR', label: 'Archivada', color: 'default' },
  { key: 'EL', label: 'Eliminada', color: 'error' },
];

const getEstadoBadge = (estado) => {
  const e = estados.find(x => x.key === estado);
  if (!e) return <Chip label={estado} size="small" />;
  return <Chip label={e.label} color={e.color} size="small" />;
};

const NOTAS_POR_PAGINA = 12;

const NotasManager = () => {
  const [user, setUser] = useState(null);
  const [notas, setNotas] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentNota, setCurrentNota] = useState({ titulo: '', contenido: '', fecha_caducidad: null, es_importante: false, categoria: '', etiquetas_lista: [], metadata: '', estado: 'AC' });
  const [editMode, setEditMode] = useState(false);
  const [filtro, setFiltro] = useState('todas');
  const [loading, setLoading] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [estadisticas, setEstadisticas] = useState({});
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [etiquetaFiltro, setEtiquetaFiltro] = useState('');
  const [previewNota, setPreviewNota] = useState(null);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    document.title = "Notas FerreDesk";
    fetchUser();
    fetchEstadisticas();
  }, []);

  const fetchNotas = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/notas/?filtro=${filtro}`;
      if (buscar) url += `&buscar=${encodeURIComponent(buscar)}`;
      if (categoriaFiltro) url += `&categoria=${encodeURIComponent(categoriaFiltro)}`;
      if (etiquetaFiltro) url += `&etiqueta=${encodeURIComponent(etiquetaFiltro)}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar notas');
      const data = await response.json();
      setNotas(data);
    } catch (error) {
      setNotas([]);
      console.error('Error al cargar notas:', error);
    } finally {
      setLoading(false);
    }
  }, [filtro, buscar, categoriaFiltro, etiquetaFiltro]);

  useEffect(() => {
    fetchNotas();
  }, [fetchNotas]);

  const fetchUser = async () => {
    try {
      const response = await fetch("/api/user/", { credentials: "include" });
      const data = await response.json();
      if (data.status === "success") setUser(data.user);
    } catch (error) {
      console.error('Error al obtener el usuario:', error);
    }
  };

  const fetchEstadisticas = async () => {
    try {
      const response = await fetch('/api/notas/estadisticas/', { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar estadísticas');
      const data = await response.json();
      setEstadisticas(data);
    } catch (error) {
      setEstadisticas({});
    }
  };

  const handleLogout = () => {
    setUser(null);
    window.location.href = "/login";
  };

  const handleOpenDialog = (nota = null) => {
    if (nota) {
      setCurrentNota({
        ...nota,
        fecha_caducidad: nota.fecha_caducidad ? new Date(nota.fecha_caducidad) : null,
        etiquetas_lista: nota.etiquetas_lista || [],
        metadata: nota.metadata || '',
        estado: nota.estado || 'AC',
      });
      setEditMode(true);
    } else {
      setCurrentNota({ titulo: '', contenido: '', fecha_caducidad: null, es_importante: false, categoria: '', etiquetas_lista: [], metadata: '', estado: 'AC' });
      setEditMode(false);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentNota({ titulo: '', contenido: '', fecha_caducidad: null, es_importante: false, categoria: '', etiquetas_lista: [], metadata: '', estado: 'AC' });
    setEditMode(false);
  };

  const handleSaveNota = async () => {
    try {
      if (currentNota.es_importante && currentNota.fecha_caducidad) {
        alert('Las notas importantes no pueden tener fecha de caducidad.');
        return;
      }
      const notaData = {
        ...currentNota,
        fecha_caducidad: currentNota.fecha_caducidad ? format(currentNota.fecha_caducidad, 'yyyy-MM-dd') : null,
        etiquetas_lista: currentNota.etiquetas_lista,
      };
      const csrftoken = getCookie('csrftoken');
      const url = editMode ? `/api/notas/${currentNota.id}/` : '/api/notas/';
      const method = editMode ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken
        },
        credentials: 'include',
        body: JSON.stringify(notaData)
      });
      if (!response.ok) {
        throw new Error('Error al guardar la nota');
      }
      handleCloseDialog();
      fetchNotas();
      fetchEstadisticas();
    } catch (error) {
      console.error('Error al guardar nota:', error);
    }
  };

  const handleDeleteNota = async (id) => {
    const nota = notas.find(n => n.id === id);
    const mensaje = (nota && nota.estado === 'EL')
      ? '¿Seguro que deseas eliminar DEFINITIVAMENTE esta nota? Esta acción no se puede deshacer.'
      : '¿Seguro que deseas eliminar esta nota?';
    if (window.confirm(mensaje)) {
      try {
        const csrftoken = getCookie('csrftoken');
        const response = await fetch(`/api/notas/${id}/eliminar/`, {
          method: 'POST',
          headers: { 'X-CSRFToken': csrftoken },
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Error al eliminar la nota');
        }
        await fetchNotas();
        await fetchEstadisticas();
      } catch (error) {
        console.error('Error al eliminar nota:', error);
        alert('Error al eliminar la nota. Por favor, intente nuevamente.');
      }
    }
  };

  const handleArchivarNota = async (id) => {
    try {
      const csrftoken = getCookie('csrftoken');
      const response = await fetch(`/api/notas/${id}/archivar/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrftoken },
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al archivar la nota');
      await fetchNotas();
      await fetchEstadisticas();
    } catch (error) {
      console.error('Error al archivar nota:', error);
    }
  };

  const handleRestaurarNota = async (id) => {
    try {
      const csrftoken = getCookie('csrftoken');
      const response = await fetch(`/api/notas/${id}/restaurar/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrftoken },
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al restaurar la nota');
      await fetchNotas();
      await fetchEstadisticas();
    } catch (error) {
      console.error('Error al restaurar nota:', error);
    }
  };

  const handleToggleImportante = async (nota) => {
    try {
      const csrftoken = getCookie('csrftoken');
      const response = await fetch(`/api/notas/${nota.id}/marcar_importante/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrftoken },
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al marcar como importante');
      fetchNotas();
      fetchEstadisticas();
    } catch (error) {
      console.error('Error al marcar como importante:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentNota({ ...currentNota, [name]: value });
  };

  const handleDateChange = (date) => {
    setCurrentNota({ ...currentNota, fecha_caducidad: date });
  };

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setCurrentNota({ ...currentNota, [name]: checked });
  };

  const handleAddEtiqueta = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      setCurrentNota({
        ...currentNota,
        etiquetas_lista: [...(currentNota.etiquetas_lista || []), e.target.value.trim()]
      });
      e.target.value = '';
    }
  };

  const handleDeleteEtiqueta = (etiqueta) => {
    setCurrentNota({
      ...currentNota,
      etiquetas_lista: currentNota.etiquetas_lista.filter((tag) => tag !== etiqueta)
    });
  };

  const handlePreviewNota = (nota) => {
    setPreviewNota(nota);
  };

  const handleClosePreview = () => {
    setPreviewNota(null);
  };

  const handleEditFromPreview = () => {
    setCurrentNota({
      ...previewNota,
      fecha_caducidad: previewNota.fecha_caducidad ? new Date(previewNota.fecha_caducidad) : null,
      etiquetas_lista: previewNota.etiquetas_lista || [],
      metadata: previewNota.metadata || '',
      estado: previewNota.estado || 'AC',
    });
    setEditMode(true);
    setOpenDialog(true);
    setPreviewNota(null);
  };

  // Restaurar la función getFiltroCount para usar estadísticas (o el conteo real de cada filtro si tienes endpoint)
  const getFiltroCount = (key) => {
    if (!estadisticas) return 0;
    switch (key) {
      case 'todas': return estadisticas.total || 0;
      case 'importantes': return estadisticas.importantes || 0;
      case 'temporales': return estadisticas.temporales || 0;
      case 'sin_caducidad': return (estadisticas.total || 0) - (estadisticas.importantes || 0) - (estadisticas.temporales || 0) - (estadisticas.archivadas || 0) - (estadisticas.eliminadas || 0) - (estadisticas.caducadas || 0);
      case 'archivadas': return estadisticas.archivadas || 0;
      case 'eliminadas': return estadisticas.eliminadas || 0;
      default: return 0;
    }
  };

  // La paginación debe funcionar sobre la lista de notas del filtro activo, como antes
  const totalPaginas = Math.ceil(notas.length / NOTAS_POR_PAGINA) || 1;
  const notasPagina = notas.slice((pagina - 1) * NOTAS_POR_PAGINA, pagina * NOTAS_POR_PAGINA);
  const handleChangePagina = (event, value) => setPagina(value);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={handleLogout} />
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <Box className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
            <Typography variant="h4" className="font-bold">Gestión de Notas</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{
                backgroundColor: '#111',
                color: '#fff',
                borderRadius: 2,
                fontWeight: 700,
                textTransform: 'none',
                px: 3,
                py: 1.2,
                boxShadow: 2,
                '&:hover': { backgroundColor: '#222' }
              }}
            >
              Nueva Nota
            </Button>
          </Box>
          <Box className="flex flex-wrap items-center gap-2 mb-4">
            {filtros.map(f => {
              const activo = filtro === f.key;
              return (
                <Button
                  key={f.key}
                  onClick={() => { setFiltro(f.key); setPagina(1); }}
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
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                      minWidth: 22,
                      height: 22,
                      borderRadius: '50%',
                      fontSize: 13,
                      fontWeight: 700,
                      background: activo ? '#fff' : '#e0e0e0',
                      color: activo ? '#111' : '#666',
                      padding: '0 6px',
                      transition: 'all 0.2s',
                    }}
                  >
                    {getFiltroCount(f.key)}
                  </span>
                </Button>
              );
            })}
            <Box flex={1} />
          </Box>
          <Box className="flex flex-wrap gap-2 mb-4 items-center">
            <TextField label="Buscar" value={buscar} onChange={e => setBuscar(e.target.value)} size="small" variant="outlined" sx={{ minWidth: 160 }} />
            <TextField label="Categoría" value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)} size="small" variant="outlined" sx={{ minWidth: 140 }} />
            <TextField label="Etiqueta" value={etiquetaFiltro} onChange={e => setEtiquetaFiltro(e.target.value)} size="small" variant="outlined" sx={{ minWidth: 140 }} />
            <Button variant="contained" color="primary" onClick={fetchNotas} sx={{ borderRadius: 2, fontWeight: 700 }}>Filtrar</Button>
            <Button variant="outlined" color="primary" onClick={() => { setBuscar(''); setCategoriaFiltro(''); setEtiquetaFiltro(''); setFiltro('todas'); }} sx={{ borderRadius: 2, fontWeight: 700 }}>Limpiar</Button>
          </Box>
          {loading ? (
            <div className="text-center text-gray-500 py-8">Cargando notas...</div>
          ) : (
            <>
              <Grid container spacing={3}>
                {notasPagina.map((nota) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={nota.id}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        boxShadow: 3,
                        backgroundColor: nota.es_importante ? '#FFF9C4' : '#FFFFFF',
                        width: 340,
                        height: 220,
                        display: 'flex',
                        flexDirection: 'column',
                        border: '1.5px solid #E0E0E0',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        '&:hover': {
                          boxShadow: 6,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.3s ease',
                          borderColor: '#1976d2',
                        }
                      }}
                      onClick={e => {
                        if (e.target.closest('.nota-action')) return;
                        handlePreviewNota(nota);
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography
                          variant="h6"
                          component="div"
                          sx={{
                            fontWeight: 700,
                            maxWidth: 220,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {nota.titulo} <span className="text-xs text-gray-400 font-mono">#{nota.numero}</span>
                        </Typography>
                        <Tooltip title={nota.es_importante ? "Quitar importante" : "Marcar importante"}>
                          <IconButton className="nota-action" onClick={() => handleToggleImportante(nota)} size="small">
                            {nota.es_importante ? <StarIcon color="warning" /> : <StarBorderIcon />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {getEstadoBadge(nota.estado)}
                        {nota.categoria && <Chip icon={<LabelIcon fontSize="small" />} label={nota.categoria} size="small" />}
                      </Box>
                      <Box className="flex flex-wrap gap-1 mb-1">
                        {(nota.etiquetas_lista || []).map((tag) => (
                          <Chip key={tag} label={tag} size="small" />
                        ))}
                      </Box>
                      <Typography
                        variant="body1"
                        sx={{
                          flexGrow: 1,
                          mb: 2,
                          fontWeight: 500,
                          maxHeight: 60,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {nota.contenido}
                      </Typography>
                      {nota.fecha_caducidad && (
                        <Typography variant="caption" color="text.secondary">
                          Caduca: {format(new Date(nota.fecha_caducidad), 'dd/MM/yyyy')} ({nota.dias_hasta_caducidad} días)
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, gap: 1, position: 'absolute', bottom: 8, right: 8 }}>
                        <Tooltip title="Editar"><IconButton className="nota-action" onClick={e => { e.stopPropagation(); handleOpenDialog(nota); }} size="small"><EditIcon /></IconButton></Tooltip>
                        {nota.estado === 'AC' && nota.fecha_caducidad && new Date(nota.fecha_caducidad) <= new Date() && (
                          <Tooltip title="Archivar"><IconButton className="nota-action" onClick={e => { e.stopPropagation(); handleArchivarNota(nota.id); }} size="small"><ArchiveIcon /></IconButton></Tooltip>
                        )}
                        {nota.estado === 'AR' && (
                          <Tooltip title="Restaurar"><IconButton className="nota-action" onClick={e => { e.stopPropagation(); handleRestaurarNota(nota.id); }} size="small"><UnarchiveIcon /></IconButton></Tooltip>
                        )}
                        <Tooltip title={nota.estado === 'EL' ? "Eliminar definitivamente" : "Eliminar"}><IconButton className="nota-action" onClick={e => { e.stopPropagation(); handleDeleteNota(nota.id); }} size="small"><DeleteIcon /></IconButton></Tooltip>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Box className="flex justify-center mt-6">
                <Pagination
                  count={totalPaginas}
                  page={pagina}
                  onChange={handleChangePagina}
                  color="primary"
                  shape="rounded"
                  size="large"
                  showFirstButton
                  showLastButton
                />
              </Box>
            </>
          )}
        </div>
      </div>
      <Dialog open={!!previewNota} onClose={handleClosePreview} maxWidth="sm" fullWidth>
        <DialogTitle>Detalle de Nota</DialogTitle>
        <DialogContent sx={{ maxHeight: 400, overflowY: 'auto', overflowX: 'hidden' }}>
          {previewNota && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{previewNota.titulo} <span className="text-xs text-gray-400 font-mono">#{previewNota.numero}</span></Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
                {getEstadoBadge(previewNota.estado)}
                {previewNota.categoria && <Chip icon={<LabelIcon fontSize="small" />} label={previewNota.categoria} size="small" />}
              </Box>
              <Box className="flex flex-wrap gap-1 mb-2">
                {(previewNota.etiquetas_lista || []).map((tag) => (
                  <Chip key={tag} label={tag} size="small" />
                ))}
              </Box>
              <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-line', overflowX: 'hidden' }}>{previewNota.contenido}</Typography>
              {previewNota.fecha_caducidad && (
                <Typography variant="caption" color="text.secondary">
                  Caduca: {format(new Date(previewNota.fecha_caducidad), 'dd/MM/yyyy')} ({previewNota.dias_hasta_caducidad} días)
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Creada: {format(new Date(previewNota.fecha_creacion), 'dd/MM/yyyy HH:mm')}
                {previewNota.fecha_modificacion && ` | Modificada: ${format(new Date(previewNota.fecha_modificacion), 'dd/MM/yyyy HH:mm')}`}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePreview}>Cerrar</Button>
          <Button onClick={handleEditFromPreview} variant="contained" color="primary">Editar</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editMode ? 'Editar Nota' : 'Nueva Nota'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="titulo"
            label="Título"
            type="text"
            fullWidth
            value={currentNota.titulo}
            onChange={handleInputChange}
          />
          <TextField
            margin="dense"
            name="contenido"
            label="Contenido"
            type="text"
            fullWidth
            multiline
            rows={4}
            value={currentNota.contenido}
            onChange={handleInputChange}
          />
          <TextField
            margin="dense"
            name="categoria"
            label="Categoría"
            type="text"
            fullWidth
            value={currentNota.categoria}
            onChange={handleInputChange}
          />
          <Box className="mb-2">
            <InputLabel>Etiquetas</InputLabel>
            <Box className="flex flex-wrap gap-1 mb-1">
              {(currentNota.etiquetas_lista || []).map((tag) => (
                <Chip key={tag} label={tag} onDelete={() => handleDeleteEtiqueta(tag)} size="small" />
              ))}
              <input
                type="text"
                placeholder="Agregar etiqueta y presiona Enter"
                onKeyDown={handleAddEtiqueta}
                className="border rounded px-2 py-1 text-sm"
                style={{ minWidth: 120 }}
              />
            </Box>
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={currentNota.es_importante}
                onChange={handleCheckboxChange}
                name="es_importante"
              />
            }
            label="Marcar como importante"
          />
          {!currentNota.es_importante && (
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
              <DateTimePicker
                label="Fecha y hora de Caducidad"
                value={currentNota.fecha_caducidad}
                onChange={handleDateChange}
                renderInput={(params) => <TextField {...params} fullWidth margin="dense" />}
                ampm={false}
                minutesStep={5}
              />
            </LocalizationProvider>
          )}
          <TextField
            margin="dense"
            name="metadata"
            label="Metadata (opcional, formato JSON)"
            type="text"
            fullWidth
            value={currentNota.metadata}
            onChange={handleInputChange}
          />
          {editMode && (
            <FormControl fullWidth margin="dense">
              <InputLabel>Estado</InputLabel>
              <Select
                name="estado"
                value={currentNota.estado}
                onChange={handleInputChange}
                label="Estado"
              >
                {estados.map(e => <MenuItem key={e.key} value={e.key}>{e.label}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSaveNota} variant="contained" color="primary">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default NotasManager; 