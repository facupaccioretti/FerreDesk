"use client"

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import useCuentaCorrienteProveedorAPI from '../../utils/useCuentaCorrienteProveedorAPI'

function LabelValor({ label, value }) {
    return (
        <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
            <span className="text-sm text-slate-900">{value || '-'}</span>
        </div>
    )
}

export default function DetalleComprobanteProveedorModal({ open, onClose, itemBase }) {
    const theme = useFerreDeskTheme()
    const { getDetalleComprobanteProveedor } = useCuentaCorrienteProveedorAPI()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [data, setData] = useState(null)

    // Constantes de clases FerreDesk
    const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
    const CLASES_TARJETA = "bg-white border border-slate-200 rounded-md p-4"

    // El ID en la tabla es comprobante_id (negativo para OP, positivo para Compra)
    const comprobanteId = itemBase?.id

    useEffect(() => {
        let activo = true
        const cargar = async () => {
            if (!open || comprobanteId === undefined) return
            setLoading(true)
            setError(null)
            try {
                const detalle = await getDetalleComprobanteProveedor(comprobanteId)
                if (activo) setData(detalle)
            } catch (e) {
                console.error(e)
                if (activo) setError('No se pudo cargar el detalle del comprobante.')
            } finally {
                if (activo) setLoading(false)
            }
        }
        cargar()
        return () => { activo = false }
    }, [open, comprobanteId, getDetalleComprobanteProveedor])

    const cab = data?.cabecera || {
        numero_formateado: itemBase?.numero_formateado,
        comprobante_nombre: itemBase?.comprobante_nombre,
        fecha: itemBase?.fecha,
        proveedor: {},
    }
    const resumen = data?.resumen_comprobante || { total: '0.00', imputado: '0.00', restante: '0.00' }
    const asociados = data?.asociados || []

    return (
        <Transition show={open} as={Fragment} appear>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/60" />
                </Transition.Child>

                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                >
                    <div className="fixed inset-0 flex items-center justify-center p-4">
                        <Dialog.Panel className="w-full max-w-3xl bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            {/* Header */}
                            <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}>
                                <Dialog.Title className="text-lg font-bold text-white">
                                    Detalle: {cab.comprobante_nombre} {cab.numero_formateado}
                                </Dialog.Title>
                                <button onClick={onClose} className="text-slate-200 hover:text-white transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Contenido */}
                            <div className="px-6 py-4 overflow-y-auto flex-1">
                                {loading ? (
                                    <div className="flex justify-center items-center py-12">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                                        <span className="ml-3 text-slate-600">Cargando detalle...</span>
                                    </div>
                                ) : error ? (
                                    <div className={`${CLASES_TARJETA} bg-red-50 border-red-200 text-red-700`}>
                                        <p>{error}</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Cabecera */}
                                        <div className={`${CLASES_TARJETA} mb-4`}>
                                            <div className={CLASES_ETIQUETA}>Información del comprobante</div>
                                            <div className="grid grid-cols-3 gap-4 mt-3">
                                                <LabelValor label="Fecha" value={cab.fecha} />
                                                <LabelValor label="Proveedor" value={cab.proveedor?.razon} />
                                                <LabelValor label="ID" value={cab.id} />
                                            </div>
                                        </div>

                                        {/* Resumen */}
                                        <div className={`${CLASES_TARJETA} mb-4`}>
                                            <div className={CLASES_ETIQUETA}>Resumen de montos</div>
                                            <div className="grid grid-cols-3 gap-4 mt-3">
                                                <LabelValor label="Total" value={`$${resumen.total}`} />
                                                <LabelValor label="Imputado" value={`$${resumen.imputado}`} />
                                                <LabelValor label="Restante" value={`$${resumen.restante}`} />
                                            </div>
                                        </div>

                                        {/* Asociados */}
                                        <div className={CLASES_TARJETA}>
                                            <div className={CLASES_ETIQUETA}>Documentos Relacionados ({asociados.length})</div>
                                            <div className="overflow-auto mt-3">
                                                <table className="min-w-full text-sm">
                                                    <thead>
                                                        <tr className={`text-left border-b border-slate-200 bg-slate-50`}>
                                                            <th className="px-4 py-2 text-[10px] uppercase tracking-wide text-slate-500">Comprobante</th>
                                                            <th className="px-4 py-2 text-[10px] uppercase tracking-wide text-slate-500">Fecha</th>
                                                            <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wide text-slate-500">Monto Imputado</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {asociados.length === 0 ? (
                                                            <tr><td className="py-4 text-slate-400 text-center italic" colSpan={3}>No hay imputaciones asociadas</td></tr>
                                                        ) : asociados.map((a, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50">
                                                                <td className="px-4 py-3 font-medium text-slate-700">
                                                                    {a.comprobante_nombre} {a.numero_formateado}
                                                                </td>
                                                                <td className="px-4 py-3 text-slate-600">{a.fecha}</td>
                                                                <td className="px-4 py-3 text-right font-semibold text-slate-900">${a.imputado}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end">
                                <button onClick={onClose} className={theme.botonPrimario}>Cerrar</button>
                            </div>
                        </Dialog.Panel>
                    </div>
                </Transition.Child>
            </Dialog>
        </Transition>
    )
}
