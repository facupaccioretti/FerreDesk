import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Paper,
    Typography,
    Box,
    Alert,
    CircularProgress
} from '@mui/material';
import { useCuentaCorrienteAPI } from '../../utils/useCuentaCorrienteAPI';

/**
 * Modal para imputar recibos o notas de crédito existentes contra facturas pendientes
 * 
 * @param {boolean} open - Si el modal está abierto
 * @param {function} onClose - Función para cerrar el modal
 * @param {object} comprobante - El recibo o NC a imputar (con ven_id, saldo_pendiente, etc.)
 * @param {number} clienteId - ID del cliente
 * @param {function} onImputado - Callback cuando se completa la imputación
 */
export default function ImputarExistenteModal({ 
    open, 
    onClose, 
    comprobante, 
    clienteId,
    onImputado 
}) {
    const { cargarFacturasPendientes, imputarExistente } = useCuentaCorrienteAPI();
    
    const [facturasPendientes, setFacturasPendientes] = useState([]);
    const [imputaciones, setImputaciones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const cargarFacturasPendientesHandler = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const facturas = await cargarFacturasPendientes(clienteId);
            setFacturasPendientes(facturas || []);
        } catch (err) {
            console.error('Error cargando facturas pendientes:', err);
            setError('Error al cargar las facturas pendientes');
            setFacturasPendientes([]);
        } finally {
            setLoading(false);
        }
    }, [clienteId, cargarFacturasPendientes]);

    // Cargar facturas pendientes cuando se abre el modal
    useEffect(() => {
        if (open && clienteId) {
            cargarFacturasPendientesHandler();
        }
    }, [open, clienteId, cargarFacturasPendientesHandler]);

    // Inicializar imputaciones cuando cambian las facturas
    useEffect(() => {
        if (facturasPendientes.length > 0) {
            setImputaciones(
                facturasPendientes.map(f => ({
                    imp_id_venta: f.ven_id,
                    imp_monto: 0,
                    imp_observacion: ''
                }))
            );
        }
    }, [facturasPendientes]);

    // Calcular monto total de imputaciones
    const montoImputaciones = imputaciones.reduce(
        (sum, imp) => sum + (parseFloat(imp.imp_monto) || 0),
        0
    );

    // Saldo disponible del comprobante
    const saldoDisponible = comprobante?.saldo_pendiente || 0;

    const handleImputacionChange = (index, campo, valor) => {
        const nuevasImputaciones = [...imputaciones];
        nuevasImputaciones[index] = {
            ...nuevasImputaciones[index],
            [campo]: valor
        };
        setImputaciones(nuevasImputaciones);
    };

    const handleAceptar = async () => {
        // Validaciones
        if (montoImputaciones === 0) {
            setError('Debe ingresar al menos un monto a imputar');
            return;
        }

        if (montoImputaciones > saldoDisponible) {
            setError(`El monto total (${montoImputaciones.toFixed(2)}) no puede superar el saldo disponible (${saldoDisponible.toFixed(2)})`);
            return;
        }

        // Filtrar solo las imputaciones con monto > 0
        const imputacionesValidas = imputaciones.filter(imp => parseFloat(imp.imp_monto) > 0);

        if (imputacionesValidas.length === 0) {
            setError('Debe ingresar al menos un monto a imputar');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await imputarExistente({
                comprobante_id: comprobante.ven_id,
                cliente_id: clienteId,
                imputaciones: imputacionesValidas
            });

            // Callback de éxito
            if (onImputado) {
                onImputado();
            }

            // Cerrar modal
            handleCancelar();
        } catch (err) {
            console.error('Error al imputar:', err);
            setError(err.response?.data?.detail || err.message || 'Error al crear las imputaciones');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelar = () => {
        resetearModal();
        onClose();
    };

    const resetearModal = () => {
        setFacturasPendientes([]);
        setImputaciones([]);
        setError(null);
        setLoading(false);
    };

    if (!comprobante) return null;

    const tipoComprobante = comprobante.comprobante_tipo === 'recibo' ? 'Recibo' : 'Nota de Crédito';

    return (
        <Dialog 
            open={open} 
            onClose={handleCancelar}
            maxWidth="lg"
            fullWidth
        >
            <DialogTitle>
                Imputar {tipoComprobante}: {comprobante.numero_formateado}
            </DialogTitle>
            
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        <strong>Saldo disponible:</strong> ${saldoDisponible.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        <strong>Fecha:</strong> {comprobante.ven_fecha}
                    </Typography>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                ) : facturasPendientes.length === 0 ? (
                    <Alert severity="info">
                        No hay facturas o cotizaciones pendientes de imputar para este cliente.
                    </Alert>
                ) : (
                    <>
                        <Typography variant="h6" gutterBottom>
                            Seleccione las facturas a imputar
                        </Typography>
                        
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Fecha</TableCell>
                                        <TableCell>Comprobante</TableCell>
                                        <TableCell align="right">Importe</TableCell>
                                        <TableCell align="right">Imputado</TableCell>
                                        <TableCell align="right">Pago Actual</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {facturasPendientes.map((factura, index) => {
                                        const imputado = factura.ven_total - factura.saldo_pendiente;
                                        return (
                                            <TableRow key={factura.ven_id}>
                                                <TableCell>{factura.ven_fecha}</TableCell>
                                                <TableCell>{factura.numero_formateado}</TableCell>
                                                <TableCell align="right">
                                                    ${parseFloat(factura.ven_total).toFixed(2)}
                                                </TableCell>
                                                <TableCell align="right">
                                                    ${imputado.toFixed(2)}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <TextField
                                                        type="number"
                                                        size="small"
                                                        value={imputaciones[index]?.imp_monto || ''}
                                                        onChange={(e) => handleImputacionChange(index, 'imp_monto', e.target.value)}
                                                        inputProps={{
                                                            min: 0,
                                                            max: factura.saldo_pendiente,
                                                            step: 0.01
                                                        }}
                                                        sx={{ width: 120 }}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                {imputaciones.filter(i => parseFloat(i.imp_monto) > 0).length} factura(s) seleccionada(s)
                            </Typography>
                            <Typography 
                                variant="h6" 
                                color={montoImputaciones > saldoDisponible ? 'error' : 'primary'}
                            >
                                Monto: ${montoImputaciones.toFixed(2)}
                            </Typography>
                        </Box>

                        {montoImputaciones > saldoDisponible && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                El monto total excede el saldo disponible del {tipoComprobante.toLowerCase()}
                            </Alert>
                        )}
                    </>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={handleCancelar} disabled={loading}>
                    Cancelar
                </Button>
                <Button 
                    onClick={handleAceptar} 
                    variant="contained" 
                    disabled={loading || montoImputaciones === 0 || montoImputaciones > saldoDisponible}
                >
                    {loading ? <CircularProgress size={24} /> : 'Aceptar'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

