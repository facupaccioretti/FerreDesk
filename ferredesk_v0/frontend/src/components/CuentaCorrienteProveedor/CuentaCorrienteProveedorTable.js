"use client"

import React from "react"
import Tabla from "../Tabla"
import AccionesMenu from "../Presupuestos y Ventas/herramientasforms/AccionesMenu"
import { formatearFecha } from "../../utils/formatters"

const CuentaCorrienteProveedorTable = ({
    items,
    loading,
    onAnularOrden,
    onImputar,
    onVerDetalle,
    saldoTotal
}) => {

    // Se usa formateador centralizado de ../../utils/formatters

    const formatearMonto = (monto) => {
        return new Intl.NumberFormat('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(monto || 0)
    }

    const generarBotonesAcciones = (item) => {
        const botones = []

        // Anular Orden de Pago (si es tipo orden_pago y está activa)
        // El estado puede venir como 'A' (Activa) o 'N' (Anulada) dependiendo del backend/serializer
        // Asumimos que si no está explícitamente anulada, se puede anular.
        if (item.comprobante_tipo === 'orden_pago' && item.estado !== 'ANULADA' && item.estado !== 'N') {
            botones.push({
                componente: () => (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3,6 5,6 21,6" />
                        <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                ),
                onClick: () => onAnularOrden(item),
                titulo: "Anular Orden Pago"
            })
        }

        // Imputar (Para deudas/créditos pendientes)
        const tiposImputables = ['orden_pago', 'nota_credito', 'nota_credito_interna', 'NOTA_CREDITO', 'compra_nota_credito', 'ajuste_credito'];
        if (tiposImputables.includes(item.comprobante_tipo)) {
            botones.push({
                componente: () => (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                ),
                onClick: () => onImputar(item),
                titulo: "Imputar"
            })
        }

        // Ver Detalle
        botones.push({
            componente: () => (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            ),
            onClick: () => onVerDetalle(item),
            titulo: "Ver detalle"
        })

        return botones
    }

    const columnas = [
        {
            id: "fecha",
            titulo: "Fecha",
            render: (item) => (
                <span className="text-sm text-slate-900">
                    {formatearFecha(item.fecha)}
                </span>
            ),
        },
        {
            id: "comprobante",
            titulo: "Comprobante",
            render: (item) => {
                let tipoLabel = '';
                let tipoColor = 'text-slate-700';

                if (item.comprobante_tipo === 'COMPRA' || item.comprobante_tipo === 'COMPRA_INTERNA') {
                    tipoLabel = `Factura ${item.numero_formateado || ''}`;
                    tipoColor = 'text-slate-700';
                } else if (item.comprobante_tipo === 'orden_pago') {
                    tipoLabel = `Orden de Pago ${item.numero_formateado || ''}`;
                    tipoColor = 'text-slate-700';
                } else if (item.comprobante_tipo === 'NOTA_CREDITO' || item.comprobante_tipo === 'nota_credito') {
                    tipoLabel = `Nota de Crédito ${item.numero_formateado || ''}`;
                    tipoColor = 'text-slate-700';
                } else if (item.comprobante_tipo === 'saldo_inicial') {
                    tipoLabel = 'Saldo Inicial';
                    tipoColor = 'text-slate-700';
                } else if (item.comprobante_tipo === 'ajuste_debito') {
                    tipoLabel = `Ajuste Débito ${item.numero_formateado || ''}`;
                    tipoColor = 'text-slate-700';
                } else if (item.comprobante_tipo === 'ajuste_credito') {
                    tipoLabel = `Ajuste Crédito ${item.numero_formateado || ''}`;
                    tipoColor = 'text-slate-700';
                } else {
                    tipoLabel = item.comprobante_nombre || item.comprobante_tipo;
                }

                if (item.estado === 'N' || item.estado === 'ANULADA') { // Anulada
                    return (
                        <span className="text-sm font-medium text-gray-400 line-through">
                            {tipoLabel} (Anulada)
                        </span>
                    )
                }

                return (
                    <span className={`text-sm font-medium ${tipoColor}`}>
                        {tipoLabel}
                    </span>
                )
            },
        },
        {
            id: "debe",
            titulo: "Debe",
            align: "right",
            render: (item) => (
                <span className="text-sm">
                    {item.debe > 0 ? (
                        <span className="text-red-600 font-medium">
                            ${formatearMonto(item.debe)}
                        </span>
                    ) : (
                        <span className="text-slate-400">-</span>
                    )}
                </span>
            ),
        },
        {
            id: "haber",
            titulo: "Haber",
            align: "right",
            render: (item) => (
                <span className="text-sm">
                    {item.haber > 0 ? (
                        <span className="text-green-600 font-medium">
                            ${formatearMonto(item.haber)}
                        </span>
                    ) : (
                        <span className="text-slate-400">-</span>
                    )}
                </span>
            ),
        },
        {
            id: "saldo",
            titulo: "Saldo",
            align: "right",
            render: (item) => (
                <span className={`text-sm font-bold ${item.saldo_acumulado > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${formatearMonto(item.saldo_acumulado)}
                </span>
            ),
        },
        {
            id: "acciones",
            titulo: "Acciones",
            align: "center",
            ancho: "100px",
            render: (item) => {
                const botones = generarBotonesAcciones(item)
                if (botones.length === 0) {
                    return <span className="text-slate-400 text-sm">-</span>
                }
                return (
                    <div className="flex items-center justify-center">
                        <AccionesMenu botones={botones} />
                    </div>
                )
            },
        },
    ]

    return (
        <>
            <Tabla
                columnas={columnas}
                datos={items}
                cargando={loading}
                sinEstilos={false}
                mostrarBuscador={false}
                mostrarOrdenamiento={false}
                paginadorVisible={false}
                customKey={(item) => `${item.comprobante_tipo}-${item.id}`}
            />
        </>
    )
}

export default CuentaCorrienteProveedorTable
