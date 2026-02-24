import React, { useState, Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { fechaHoyLocal } from '../../utils/fechas';

const AjusteProveedorModal = ({
    abierto,
    onClose,
    onConfirmar,
    tipo,
    proveedor,
    loading = false
}) => {
    const [formData, setFormData] = useState({
        fecha: fechaHoyLocal(),
        pv: '0001',
        numero: '',
        monto: '',
        observacion: ''
    });

    // Resetear formulario al abrir
    useEffect(() => {
        if (abierto) {
            setFormData({
                fecha: fechaHoyLocal(),
                pv: '0001',
                numero: '',
                monto: '',
                observacion: ''
            });
        }
    }, [abierto, tipo]);

    const isDebito = tipo === 'DEBITO';
    // Colores temáticos: Débito (Deuda/Rojo/Naranja) vs Crédito (Favor/Verde/Azul)
    // Para FerreDesk: Débito = Deuda = Orange/Red; Crédito = Haber = Green/Blue
    const themeColor = isDebito ? 'orange' : 'green';

    const titulo = isDebito ? 'Nota de Débito (Ajuste)' : 'Nota de Crédito (Ajuste)';
    const descripcion = isDebito
        ? 'Este ajuste aumentará la deuda con el proveedor (Debe).'
        : 'Este ajuste disminuirá la deuda con el proveedor (Haber).';

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.numero || !formData.monto) {
            alert("Por favor, complete todos los campos obligatorios.");
            return;
        }

        const montoNum = parseFloat(formData.monto);
        if (isNaN(montoNum) || montoNum <= 0) {
            alert("El monto debe ser un número positivo.");
            return;
        }

        const numeroFormateado = `${formData.pv.padStart(4, '0')}-${formData.numero.padStart(8, '0')}`;

        onConfirmar({
            tipo,
            proveedor_id: proveedor.id,
            fecha: formData.fecha,
            numero: numeroFormateado,
            monto: montoNum,
            observacion: formData.observacion
        });
    };

    // Estilos compartidos (Mismos que OrdenPagoReciboModal)
    const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-1 block";
    const CLASES_INPUT = `w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none transition-colors`;
    const CLASES_BOTON_CANCELAR = "px-4 py-2 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors";
    const CLASES_BOTON_CONFIRMAR = `px-6 py-2 rounded text-xs font-bold text-white shadow-sm bg-${themeColor}-600 hover:bg-${themeColor}-700 transition-colors disabled:opacity-50 flex items-center gap-2`;

    return (
        <Transition show={abierto} as={Fragment} appear>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px]" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white text-left align-middle shadow-xl transition-all border border-slate-200">

                                {/* Header */}
                                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                                    <div>
                                        <Dialog.Title as="h3" className="text-base font-bold text-slate-800 leading-6">
                                            {titulo}
                                        </Dialog.Title>
                                        <div className="mt-1 text-xs text-slate-500">
                                            {proveedor?.razon || "Proveedor"}
                                        </div>
                                    </div>
                                    <div className={`p-1.5 rounded-full bg-${themeColor}-50 text-${themeColor}-600`}>
                                        {isDebito ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>
                                        )}
                                    </div>
                                </div>

                                {/* Body */}
                                <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">

                                    <div className={`text-xs p-3 rounded border border-${themeColor}-100 bg-${themeColor}-50 text-${themeColor}-800`}>
                                        {descripcion}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className={CLASES_ETIQUETA}>Fecha</label>
                                            <input
                                                type="date"
                                                className={CLASES_INPUT}
                                                value={formData.fecha}
                                                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                                required
                                            />
                                        </div>

                                        <div className="col-span-2 sm:col-span-1">
                                            <label className={CLASES_ETIQUETA}>PV</label>
                                            <input
                                                type="text"
                                                className={`${CLASES_INPUT} text-center`}
                                                value={formData.pv}
                                                maxLength={4}
                                                placeholder="0001"
                                                onChange={(e) => setFormData({ ...formData, pv: e.target.value.replace(/\D/g, '') })}
                                                required
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className={CLASES_ETIQUETA}>Número Comprobante</label>
                                            <input
                                                type="text"
                                                className={CLASES_INPUT}
                                                value={formData.numero}
                                                maxLength={8}
                                                placeholder="00000000"
                                                onChange={(e) => setFormData({ ...formData, numero: e.target.value.replace(/\D/g, '') })}
                                                required
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className={CLASES_ETIQUETA}>Importe Total</label>
                                            <div className="relative">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className={`${CLASES_INPUT} pl-6 font-bold text-slate-700`}
                                                    value={formData.monto}
                                                    placeholder="0.00"
                                                    onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="col-span-2">
                                            <label className={CLASES_ETIQUETA}>Observaciones</label>
                                            <textarea
                                                className={`${CLASES_INPUT} h-20 resize-none py-2`}
                                                value={formData.observacion}
                                                onChange={(e) => setFormData({ ...formData, observacion: e.target.value })}
                                                placeholder="Motivo del ajuste..."
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className={CLASES_BOTON_CANCELAR}
                                            disabled={loading}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            className={CLASES_BOTON_CONFIRMAR}
                                            disabled={loading}
                                        >
                                            {loading ? 'Procesando...' : 'Confirmar Ajuste'}
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default AjusteProveedorModal;
