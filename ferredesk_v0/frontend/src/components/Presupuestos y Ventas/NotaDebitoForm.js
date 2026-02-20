import React, { useEffect, useMemo, useRef, useState } from 'react'
import useNavegacionForm from '../../hooks/useNavegacionForm'
import { manejarCambioFormulario } from './herramientasforms/manejoFormulario'
import SelectorDocumento from './herramientasforms/SelectorDocumento'
import useValidacionCUIT from '../../utils/useValidacionCUIT'
import { useArcaEstado } from '../../utils/useArcaEstado'
import { useArcaResultadoHandler } from '../../utils/useArcaResultadoHandler'
import ArcaEsperaOverlay from './herramientasforms/ArcaEsperaOverlay'
import CuitStatusBanner from '../Alertas/CuitStatusBanner'
import { useFerreDeskTheme } from '../../hooks/useFerreDeskTheme'
import { fechaHoyLocal } from '../../utils/fechas'

// Constantes descriptivas
const TIPO_NOTA_DEBITO = 'nota_debito'
const TIPO_NOTA_DEBITO_INTERNA = 'nota_debito_interna'
const LETRAS_FISCALES = ['A', 'B', 'C']
const LETRA_INTERNA = 'I'
// Límite de observación del ítem genérico (mantener configurable)
const LONGITUD_MAX_OBSERVACION = 100 // Ver PRODUCTO_DENOMINACION_MAX_CARACTERES en backend

const obtenerTipoYLetraNotaDebito = (facturasAsociadas) => {
  if (!facturasAsociadas || facturasAsociadas.length === 0) {
    return { tipo: TIPO_NOTA_DEBITO, letra: null }
  }
  const letras = [...new Set(facturasAsociadas.map(f => f.comprobante?.letra))]
  if (letras.length > 1) return { tipo: null, letra: null }
  if (letras[0] === LETRA_INTERNA) return { tipo: TIPO_NOTA_DEBITO_INTERNA, letra: LETRA_INTERNA }
  if (LETRAS_FISCALES.includes(letras[0])) return { tipo: TIPO_NOTA_DEBITO, letra: letras[0] }
  return { tipo: TIPO_NOTA_DEBITO, letra: letras[0] }
}

const getInitialFormState = (clienteSeleccionado, facturasAsociadas, sucursales = [], puntosVenta = [], vendedores = [], plazos = []) => {
  if (!clienteSeleccionado) return {}
  return {
    clienteId: clienteSeleccionado.id,
    clienteNombre: clienteSeleccionado.razon || clienteSeleccionado.nombre,
    cuit: clienteSeleccionado.cuit || '',
    domicilio: clienteSeleccionado.domicilio || '',
    plazoId: clienteSeleccionado.plazo_id || plazos[0]?.id || '',
    vendedorId: vendedores[0]?.id || '',
    sucursalId: sucursales[0]?.id || '',
    puntoVentaId: puntosVenta[0]?.id || '',
    fecha: fechaHoyLocal(),
    copia: 1,
    facturasAsociadas: facturasAsociadas || [],
    exentoIVA: false,
    montoNeto: '',
    observacion: '',
    cobrado: false,
  }
}

const NotaDebitoForm = ({
  onSave,
  onCancel,
  clienteSeleccionado,
  facturasAsociadas = [],
  comprobantes,
  plazos,
  vendedores,
  sucursales,
  puntosVenta,
  tabKey,
}) => {
  const { getFormProps } = useNavegacionForm()
  const theme = useFerreDeskTheme()
  const temporizadorArcaRef = useRef(null)

  // Estado CUIT/ARCA
  const {
    estadoARCAStatus,
    mensajesARCAStatus,
    isLoadingARCAStatus,
    consultarARCAStatus,
    limpiarEstadosARCAStatus
  } = useValidacionCUIT()

  // Estado del formulario base
  const [formulario, setFormulario] = useState(
    getInitialFormState(clienteSeleccionado, facturasAsociadas, sucursales, puntosVenta, vendedores, plazos)
  )

  useEffect(() => {
    setFormulario(getInitialFormState(clienteSeleccionado, facturasAsociadas, sucursales, puntosVenta, vendedores, plazos))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSeleccionado?.id])

  const handleChange = manejarCambioFormulario(setFormulario)

  // Documento (CUIT/DNI) con lógica fiscal para ND
  const [documentoInfo, setDocumentoInfo] = useState({ tipo: 'cuit', valor: formulario.cuit || '' })
  const handleDocumentoChange = (nuevaInfo) => {
    setDocumentoInfo(nuevaInfo)
    setFormulario(prev => ({ ...prev, cuit: nuevaInfo.valor }))
  }

  const ocultarBannerCuit = () => {
    limpiarEstadosARCAStatus()
  }
  // Estado ARCA (igual patrón que NotaCreditoForm)
  const {
    esperandoArca,
    respuestaArca,
    errorArca,
    iniciarEsperaArca,
    finalizarEsperaArcaExito,
    finalizarEsperaArcaError,
    limpiarEstadoArca,
    aceptarResultadoArca,
    requiereEmisionArca,
    obtenerMensajePersonalizado
  } = useArcaEstado()

  // Estados para manejar el envío
  const [, setIsSaving] = useState(false)

  const {
    procesarResultadoArca,
    manejarErrorArca,
    crearHandleAceptarResultadoArca
  } = useArcaResultadoHandler({
    requiereEmisionArca,
    finalizarEsperaArcaExito,
    finalizarEsperaArcaError,
    esperandoArca,
    iniciarEsperaArca
  })

  const handleAceptarResultadoArca = crearHandleAceptarResultadoArca(
    aceptarResultadoArca,
    () => { limpiarEstadoArca(); onCancel(); },
    () => respuestaArca,
    () => errorArca
  )

  // Detección de tipo/letra de ND según facturas asociadas
  const { tipo: tipoNotaDebito, letra: letraNotaDebito } = useMemo(() => obtenerTipoYLetraNotaDebito(facturasAsociadas), [facturasAsociadas])
  const comprobanteND = useMemo(() => {
    if (!tipoNotaDebito) return null
    return (comprobantes || []).find(c => c.tipo === tipoNotaDebito && (letraNotaDebito ? c.letra === letraNotaDebito : true))
  }, [comprobantes, tipoNotaDebito, letraNotaDebito])

  const esInterna = tipoNotaDebito === TIPO_NOTA_DEBITO_INTERNA || letraNotaDebito === 'I' || comprobanteND?.letra === 'I'
  const tituloForm = esInterna ? 'Nueva Extensión de Contenido' : 'Nueva Nota de Débito'
  const tituloSubmit = esInterna ? 'Crear Extensión de Contenido' : 'Crear Nota de Débito'
  const codigoAfipND = comprobanteND?.codigo_afip || ''
  const letraND = comprobanteND?.letra || 'X'

  // Verificación de padrón (solo ND A)
  useEffect(() => {
    if (!formulario.clienteId || !(facturasAsociadas || []).length) {
      limpiarEstadosARCAStatus();
      return
    }
    // Solo consultar si es una Nota de Débito fiscal (no interna)
    if (esInterna) {
      limpiarEstadosARCAStatus();
      return
    }
    const cuitLimpio = (formulario.cuit || '').replace(/[-\s]/g, '')
    if (!cuitLimpio || cuitLimpio.length !== 11 || !/^\d{11}$/.test(cuitLimpio)) {
      return
    }
    consultarARCAStatus(cuitLimpio)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letraND, formulario.cuit, formulario.clienteId, facturasAsociadas])

  const validarConsistenciaLetras = () => {
    if (!facturasAsociadas || facturasAsociadas.length === 0) return true
    const letrasFacturas = [...new Set(facturasAsociadas.map(f => f.comprobante?.letra))]
    if (letrasFacturas.length > 1) {
      alert(
        `Error: Todas las facturas asociadas deben tener la misma letra.\n` +
        `Se encontraron letras: ${letrasFacturas.join(', ')}\n\n` +
        `Una Nota de Débito solo puede referenciar facturas de una misma letra.`
      )
      return false
    }
    return true
  }

  const construirPayloadBase = () => {
    const montoNeto = parseFloat(formulario.montoNeto)
    const observacion = (formulario.observacion || (esInterna ? 'Extensión de Contenido' : 'Nota de Débito')).slice(0, LONGITUD_MAX_OBSERVACION)
    const tipoComprobanteSeleccionado = comprobanteND?.tipo || TIPO_NOTA_DEBITO
    return {
      ven_estado: 'CE',
      ven_tipo: 'Nota de Débito',
      tipo_comprobante: tipoComprobanteSeleccionado,
      comprobante_id: comprobanteND?.codigo_afip || '',
      comprobantes_asociados_ids: (formulario.facturasAsociadas || facturasAsociadas || []).map(f => f.id || f.ven_id),
      ven_fecha: formulario.fecha,
      ven_idcli: formulario.clienteId,
      ven_idpla: formulario.plazoId,
      ven_idvdo: formulario.vendedorId,
      ven_sucursal: formulario.sucursalId,
      ven_copia: formulario.copia || 1,
      ven_cuit: formulario.cuit || '',
      detalle_item_generico: observacion,
      exento_iva: !!formulario.exentoIVA,
      monto_neto_item_generico: montoNeto,
    }
  }

  const realizarEnvioDirecto = async () => {
    const payload = construirPayloadBase()

    // Las Notas de Débito/Extensiones siempre van a cuenta corriente por defecto en este formulario simplificado
    payload.comprobante_pagado = false
    payload.monto_pago = 0
    payload.pagos = []

    const tipoComprobanteSeleccionado = comprobanteND?.tipo || TIPO_NOTA_DEBITO

    if (requiereEmisionArca(tipoComprobanteSeleccionado) && !temporizadorArcaRef.current) {
      temporizadorArcaRef.current = setTimeout(() => iniciarEsperaArca(), 400)
    }

    try {
      setIsSaving(true)
      const resultado = await onSave(payload, () => { })
      if (temporizadorArcaRef.current) {
        clearTimeout(temporizadorArcaRef.current)
        temporizadorArcaRef.current = null
      }
      procesarResultadoArca(resultado, tipoComprobanteSeleccionado)
    } catch (error) {
      if (temporizadorArcaRef.current) {
        clearTimeout(temporizadorArcaRef.current)
        temporizadorArcaRef.current = null
      }
      manejarErrorArca(error, 'Error al procesar la nota de débito')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validarConsistenciaLetras()) return
    if (!formulario.clienteId) {
      alert('No se ha seleccionado un cliente.')
      return
    }

    const montoNeto = parseFloat(formulario.montoNeto)
    if (!montoNeto || montoNeto <= 0) {
      alert('Ingrese un monto neto válido (mayor a 0).')
      return
    }

    if (!window.confirm(`¿Está seguro de crear esta ${tituloForm.toLowerCase()}?`)) {
      return
    }

    realizarEnvioDirecto()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/30 py-6">
      <div className="px-6">
        <form className="venta-form w-full bg-white rounded-2xl shadow-2xl border border-slate-200/50 relative overflow-hidden" onSubmit={handleSubmit} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} {...getFormProps()}>
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.primario}`}></div>

          <div className="px-8 pt-4 pb-6">
            {/* Banner de estado CUIT para notas de débito fiscales */}
            {(
              <CuitStatusBanner
                cuit={formulario.cuit}
                estado={(() => {
                  const cuitLimpio = (formulario.cuit || '').replace(/[-\s]/g, '')
                  if (!cuitLimpio || cuitLimpio.length !== 11 || !/^\d{11}$/.test(cuitLimpio)) return 'error'
                  return estadoARCAStatus || 'ok'
                })()}
                mensajes={mensajesARCAStatus || []}
                onDismiss={ocultarBannerCuit}
                isLoading={isLoadingARCAStatus}
              />
            )}

            <div className="absolute top-6 right-6 z-10">
              <div className="w-14 h-14 flex flex-col items-center justify-center border-2 border-slate-800 shadow-xl bg-gradient-to-br from-white to-slate-50 rounded-xl ring-1 ring-slate-200/50">
                <span className="text-2xl font-extrabold font-mono text-slate-900 leading-none">{letraND}</span>
                <span className="text-[9px] font-mono text-slate-600 mt-0.5 font-medium">COD {codigoAfipND}</span>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-md">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                {tituloForm}
              </h3>
            </div>

            <div className="p-2 bg-slate-50 rounded-sm border border-slate-200">
              <div className="grid grid-cols-3 gap-4 mb-3">
                {/* Cliente */}
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">Cliente *</label>
                  <input
                    type="text"
                    value={formulario.clienteNombre || ''}
                    readOnly
                    disabled
                    className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 bg-slate-100 text-slate-600 cursor-not-allowed"
                  />
                </div>

                {/* Documento */}
                <div>
                  <SelectorDocumento
                    tipoComprobante={letraND || 'A'}
                    esObligatorio={letraND === 'A'}
                    valorInicial={documentoInfo.valor}
                    tipoInicial={documentoInfo.tipo}
                    onChange={handleDocumentoChange}
                    readOnly={false}
                    className="w-full"
                  />
                </div>

                {/* Fecha */}
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">Fecha</label>
                  <input
                    name="fecha"
                    type="date"
                    value={formulario.fecha}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-3">
                {/* Exento IVA */}
                <div className="flex items-center gap-2">
                  <input
                    id="exentoIVA"
                    type="checkbox"
                    checked={!!formulario.exentoIVA}
                    onChange={(e) => setFormulario(f => ({ ...f, exentoIVA: e.target.checked }))}
                  />
                  <label htmlFor="exentoIVA" className="text-[12px] font-semibold text-slate-700">Exento de IVA</label>
                </div>


                {/* Monto neto */}
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">Monto neto *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formulario.montoNeto}
                    onChange={(e) => setFormulario(f => ({ ...f, montoNeto: e.target.value }))}
                    className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    required
                  />
                </div>

                {/* Observación */}
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">Observación</label>
                  <input
                    type="text"
                    value={formulario.observacion}
                    onChange={(e) => setFormulario(f => ({ ...f, observacion: e.target.value.slice(0, LONGITUD_MAX_OBSERVACION) }))}
                    placeholder={esInterna ? 'Extensión de Contenido' : 'Nota de Débito'}
                    className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Facturas seleccionadas */}
              <div className="mt-2">
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">{esInterna ? 'Cotizaciones asociadas' : 'Facturas asociadas'}</label>
                <div className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-24 bg-slate-50 overflow-y-auto">
                  {(formulario.facturasAsociadas || facturasAsociadas || []).map(factura => (
                    <div key={factura.id || factura.ven_id} className="text-xs font-semibold bg-slate-200 rounded px-1 py-0.5 mb-1">
                      {factura.comprobante?.letra || 'FC'} {String(factura.ven_punto || '1').padStart(4, '0')}-{String(factura.ven_numero || factura.numero || '').padStart(8, '0')}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {tituloSubmit}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Overlay de espera de ARCA */}
      <ArcaEsperaOverlay
        estaEsperando={esperandoArca}
        mensajePersonalizado={obtenerMensajePersonalizado(comprobanteND?.tipo)}
        mostrarDetalles={true}
        respuestaArca={respuestaArca}
        errorArca={errorArca}
        onAceptar={handleAceptarResultadoArca}
      />
    </div>
  )
}

export default NotaDebitoForm


