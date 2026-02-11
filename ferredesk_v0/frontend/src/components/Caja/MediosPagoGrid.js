import React from 'react';
import ChequeInlineForm from './ChequeInlineForm';

//Modal para medios de pago de Ordenes de Pago y recibos
const MediosPagoGrid = ({
    pagos,
    setPagos,
    metodosPago,
    cuentasBanco,
    chequesCartera,
    modo = 'RECIBO', // 'RECIBO' o 'ORDEN_PAGO'
    entidadNombre = '', // Nombre del cliente o proveedor
    cuitEntidad = '', // CUIT para pre-cargar cheques
    proveedorNombre = '', // Nombre del proveedor (para aviso endoso en OP)
    validarCUITFn = null, // Función async para validar CUIT
}) => {
    const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500";
    const CLASES_INPUT = "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500";

    const hoy = () => new Date().toISOString().split('T')[0];

    const agregarPago = () => {
        const efectivo = metodosPago.find(m => m.codigo === 'EFECTIVO');
        setPagos(prev => [...prev, {
            metodo_pago_id: efectivo ? efectivo.id : '',
            codigo: efectivo ? efectivo.codigo : '',
            monto: 0,
            detalle: ''
        }]);
    };

    const quitarPago = (index) => {
        setPagos(prev => prev.filter((_, i) => i !== index));
    };

    const actualizarPago = (index, campo, valor) => {
        setPagos(prev => prev.map((p, i) => {
            if (i !== index) return p;

            const nuevoPago = { ...p, [campo]: valor };

            if (campo === 'metodo_pago_id') {
                const metodo = metodosPago.find(m => String(m.id) === String(valor));
                const codigo = (metodo?.codigo || "").toUpperCase();
                nuevoPago.codigo = codigo;

                // Limpiar campos específicos
                delete nuevoPago.cuenta_banco_id;
                delete nuevoPago.cheque_id;
                nuevoPago.monto = 0;

                if (codigo === 'CHEQUE') {
                    if (modo === 'RECIBO') {
                        // En recibo, el cheque siempre es nuevo
                        nuevoPago.librador_nombre = entidadNombre;
                        nuevoPago.cuit_librador = cuitEntidad.replace(/\D/g, '');
                        nuevoPago.tipo_cheque = 'AL_DIA';
                        nuevoPago.fecha_emision = hoy();
                        nuevoPago.fecha_pago = hoy();
                        nuevoPago.fecha_presentacion = hoy();
                        nuevoPago.numero_cheque = '';
                        nuevoPago.banco_emisor = '';
                    } else {
                        // En orden de pago, selección de cartera
                        nuevoPago.cheque_id = null;
                    }
                }
            }

            // Si seleccionó un cheque de cartera en OP, auto-llenar monto
            if (campo === 'cheque_id' && nuevoPago.codigo === 'CHEQUE' && modo === 'ORDEN_PAGO') {
                const cheque = chequesCartera.find(c => String(c.id) === String(valor));
                if (cheque) {
                    nuevoPago.monto = parseFloat(cheque.monto);
                }
            }

            return nuevoPago;
        }));
    };

    // Función auxiliar para actualizar campos de cheque inline desde ChequeInlineForm
    const actualizarCampoCheque = (index, campo, valor) => {
        setPagos(prev => prev.map((p, i) => {
            if (i !== index) return p;
            return { ...p, [campo]: valor };
        }));
    };

    return (
        <div className="bg-white border border-slate-200 rounded-md p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-800">Medios de Pago</h3>
                <button
                    type="button"
                    onClick={agregarPago}
                    className="text-xs text-orange-600 font-semibold hover:text-orange-700 flex items-center gap-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                    </svg>
                    Agregar Medio
                </button>
            </div>

            <div className="space-y-3">
                {pagos.map((pago, idx) => (
                    <div key={idx} className="bg-slate-50 p-3 rounded border border-slate-200 relative group animate-in fade-in slide-in-from-top-1 duration-200">
                        {/* Fila Principal */}
                        <div className="grid grid-cols-12 gap-3 items-end">
                            <div className="col-span-12 md:col-span-3">
                                <label className={CLASES_ETIQUETA}>Método</label>
                                <select
                                    className={CLASES_INPUT}
                                    value={pago.metodo_pago_id}
                                    onChange={(e) => actualizarPago(idx, 'metodo_pago_id', e.target.value)}
                                >
                                    <option value="">Seleccione...</option>
                                    {metodosPago.map(m => (
                                        <option key={m.id} value={m.id}>{m.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={`col-span-12 md:col-span-2 ${pago.codigo === 'CHEQUE' && modo === 'ORDEN_PAGO' ? 'opacity-50' : ''}`}>
                                <label className={CLASES_ETIQUETA}>Monto</label>
                                <input
                                    type="number"
                                    className={CLASES_INPUT}
                                    value={pago.monto || ''}
                                    disabled={pago.codigo === 'CHEQUE' && modo === 'ORDEN_PAGO'}
                                    onChange={(e) => actualizarPago(idx, 'monto', parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="col-span-10 md:col-span-6">
                                <label className={CLASES_ETIQUETA}>Detalle / Observación</label>
                                <input
                                    type="text"
                                    className={CLASES_INPUT}
                                    value={pago.detalle || ''}
                                    placeholder="Opcional..."
                                    onChange={(e) => actualizarPago(idx, 'detalle', e.target.value)}
                                />
                            </div>

                            <div className="col-span-2 md:col-span-1 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => quitarPago(idx)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                    title="Quitar medio de pago"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 1 00-16 8 8 0 0 0 0 16zM8.707 7.293a1 1 0 0 0-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 0 0 1.414-1.414L11.414 10l1.293-1.293a1 1 0 0 0-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Fila Condicional: Transferencia */}
                        {pago.codigo === 'TRANSFERENCIA' && (
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-300">
                                <div>
                                    <label className={CLASES_ETIQUETA}>{modo === 'RECIBO' ? 'Cuenta Destino' : 'Cuenta Origen'}</label>
                                    <select
                                        className={CLASES_INPUT}
                                        value={pago.cuenta_banco_id || ''}
                                        onChange={(e) => actualizarPago(idx, 'cuenta_banco_id', e.target.value)}
                                    >
                                        <option value="">Seleccione cuenta...</option>
                                        {cuentasBanco.map(c => (
                                            <option key={c.id} value={c.id}>{c.nombre} - CC {c.tipo_cuenta}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={CLASES_ETIQUETA}>Referencia (ID Transacción / CBU)</label>
                                    <input
                                        type="text"
                                        className={CLASES_INPUT}
                                        value={pago.referencia_externa || ''}
                                        placeholder="Ej: 123456"
                                        onChange={(e) => actualizarPago(idx, 'referencia_externa', e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Fila Condicional: Cheque — Usa ChequeInlineForm */}
                        {pago.codigo === 'CHEQUE' && (
                            <div className="mt-3 bg-white p-3 rounded border border-slate-200 animate-in zoom-in-95 duration-300">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Información del Cheque</span>
                                </div>
                                <ChequeInlineForm
                                    modo={modo === 'ORDEN_PAGO' ? 'CARTERA' : 'NUEVO'}
                                    chequeData={pago}
                                    onChange={(campo, valor) => actualizarCampoCheque(idx, campo, valor)}
                                    chequesCartera={chequesCartera}
                                    entidadNombre={entidadNombre}
                                    cuitEntidad={cuitEntidad}
                                    proveedorNombre={proveedorNombre}
                                    validarCUITFn={validarCUITFn}
                                />
                            </div>
                        )}
                    </div>
                ))}

                {pagos.length === 0 && (
                    <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-md">
                        <p className="text-slate-400 text-sm italic">No se han registrado medios de pago</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MediosPagoGrid;
