"use client"

import React, { useEffect, useState, useMemo } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Tabs, Tab
} from '@mui/material'
import useCuentaCorrienteAPI from '../../utils/useCuentaCorrienteAPI'

function LabelValor({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value || '-'}</span>
    </div>
  )
}

export default function ModalDetalleComprobante({ open, onClose, itemBase }) {
  const { getDetalleComprobante } = useCuentaCorrienteAPI()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [tab, setTab] = useState(0)

  const venId = itemBase?.ven_id

  useEffect(() => {
    let activo = true
    const cargar = async () => {
      if (!open || !venId) return
      setLoading(true)
      setError(null)
      try {
        const detalle = await getDetalleComprobante(venId)
        if (activo) setData(detalle)
      } catch (e) {
        console.error(e)
        if (activo) setError('No se pudo cargar el detalle. Mostrando información básica.')
      } finally {
        if (activo) setLoading(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [open, venId, getDetalleComprobante])

  const cab = data?.cabecera || {
    numero_formateado: itemBase?.numero_formateado,
    comprobante_nombre: itemBase?.comprobante_nombre,
    ven_fecha: itemBase?.ven_fecha,
    cliente: {},
    observacion: ''
  }
  const resumen = data?.resumen_comprobante || { total: '0.00', imputado: '0.00', restante: '0.00' }
  const asociados = data?.asociados || []

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {cab.comprobante_nombre} {cab.numero_formateado}
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <div className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        {/* Cabecera */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <LabelValor label="Fecha" value={cab.ven_fecha} />
          <LabelValor label="Cliente" value={cab.cliente?.razon} />
          <LabelValor label="CUIT" value={cab.cliente?.cuit} />
        </div>

        {/* Resumen comprobante */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <LabelValor label="Total" value={`$${resumen.total}`} />
          <LabelValor label="Imputado" value={`$${resumen.imputado}`} />
          <LabelValor label="Restante" value={`$${resumen.restante}`} />
        </div>

        {/* Sólo Asociados */}
        <Tabs value={tab} onChange={(_,v)=>setTab(v)} sx={{ mb: 1 }}>
          <Tab label={`Asociados (${asociados.length})`} />
        </Tabs>

        {tab === 0 && (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 pr-2">Comprobante</th>
                  <th className="py-1 pr-2">Tipo</th>
                  <th className="py-1 pr-2">Fecha</th>
                  <th className="py-1 pr-2 text-right">Total</th>
                  <th className="py-1 pr-2 text-right">Imputado</th>
                </tr>
              </thead>
              <tbody>
                {asociados.length === 0 ? (
                  <tr><td className="py-2 text-slate-400" colSpan={5}>Sin asociados</td></tr>
                ) : asociados.map((a,idx)=> (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="py-1 pr-2">{a.numero_formateado}</td>
                    <td className="py-1 pr-2">{a.tipo}</td>
                    <td className="py-1 pr-2">{a.fecha}</td>
                    <td className="py-1 pr-2 text-right">${a.total}</td>
                    <td className="py-1 pr-2 text-right">${a.imputado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}


