"use client"

import React from "react"
import Tabla from "../Tabla"
import AccionesMenu from "../Presupuestos y Ventas/herramientasforms/AccionesMenu"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

const CuentaCorrienteTable = ({ items, loading, onImputarPago, onVerDetalle, theme, saldoTotal }) => {

  const formatearFecha = (fechaStr) => {
    try {
      const fecha = new Date(fechaStr)
      return fecha.toLocaleDateString('es-AR')
    } catch {
      return fechaStr
    }
  }

  const formatearMonto = (monto) => {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(monto || 0)
  }

  // Se eliminan chips/etiquetas visuales: solo texto del comprobante solicitado
  const getTipoComprobanteIcon = () => null

  // Función para generar los botones de acciones
  const generarBotonesAcciones = (item) => {
    const botones = []
    
    // Ver detalle - disponible para todos los comprobantes
    botones.push({
      componente: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      ),
      onClick: () => onVerDetalle(item),
      titulo: "Ver detalle"
    })
    
    // Imputar pago - solo para recibos y notas de crédito
    if (item.comprobante_tipo === 'recibo' || item.comprobante_tipo === 'nota_credito') {
      botones.push({
        componente: () => (
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4"/>
            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
          </svg>
        ),
        onClick: () => onImputarPago(item),
        titulo: item.comprobante_tipo === 'nota_credito' ? "Imputar Crédito" : "Imputar Pago"
      })
    }
    
    return botones
  }

  // Definición de columnas para la tabla genérica
  const columnas = [
    {
      id: "ven_fecha",
      titulo: "Fecha",
      render: (item) => (
        <span className="text-sm text-slate-900">
          {formatearFecha(item.ven_fecha)}
        </span>
      ),
    },
    {
      id: "comprobante",
      titulo: "Comprobante",
      render: (item) => (
        <div className="flex items-center space-x-2">
          {getTipoComprobanteIcon(item.comprobante_tipo, item.es_fac_rcbo)}
          <span className="text-sm font-medium text-slate-900">
            {`${item.comprobante_nombre} ${item.numero_formateado}`}
          </span>
        </div>
      ),
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
      id: "saldo_acumulado",
      titulo: "Saldo",
      align: "right",
      render: (item) => (
        <span className={`text-sm font-bold ${item.saldo_acumulado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          ${formatearMonto(item.saldo_acumulado)}
        </span>
      ),
    },
    {
      id: "__acciones",
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
      />
    </>
  )
}

export default CuentaCorrienteTable
