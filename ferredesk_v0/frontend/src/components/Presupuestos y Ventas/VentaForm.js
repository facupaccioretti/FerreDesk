"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import useNavegacionForm from "../../hooks/useNavegacionForm"
import ItemsGrid from "./ItemsGrid"
import BuscadorProducto from "../BuscadorProducto"
import ComprobanteDropdown from "../ComprobanteDropdown"
import { manejarCambioFormulario, manejarSeleccionClienteObjeto, validarDocumentoCliente, esDocumentoEditable } from "./herramientasforms/manejoFormulario"
import { mapearCamposItem, normalizarItemsStock } from "./herramientasforms/mapeoItems"
// import { normalizarItems } from "./herramientasforms/normalizadorItems" // Ya no se usa
import { useClientesConDefecto } from "./herramientasforms/useClientesConDefecto"
import { useCalculosFormulario } from "./herramientasforms/useCalculosFormulario"
import { useAlicuotasIVAAPI } from "../../utils/useAlicuotasIVAAPI"
import useValidacionCUIT from "../../utils/useValidacionCUIT"
import SumarDuplicar from "./herramientasforms/SumarDuplicar"
import { useFormularioDraft } from "./herramientasforms/useFormularioDraft"
import { useComprobanteFiscal } from "./herramientasforms/useComprobanteFiscal"
import ClienteSelectorModal from "../Clientes/ClienteSelectorModal"
import { useArcaEstado } from "../../utils/useArcaEstado"
import { useArcaResultadoHandler } from "../../utils/useArcaResultadoHandler"
import ArcaEsperaOverlay from "./herramientasforms/ArcaEsperaOverlay"
import SelectorDocumento from "./herramientasforms/SelectorDocumento"
import CuitStatusBanner from "../Alertas/CuitStatusBanner"
import CampoComprobantePagado from "./herramientasforms/CampoComprobantePagado"
import NuevoReciboModal from "../CuentaCorriente/NuevoReciboModal"
import { useListasPrecioAPI } from "../../utils/useListasPrecioAPI"

const getInitialFormState = (sucursales = [], puntosVenta = []) => ({
  numero: "",
  cliente: "",
  clienteId: "",
  cuit: "",
  domicilio: "",
  plazoId: "",
  vendedorId: "",
  sucursalId: sucursales[0]?.id || "",
  puntoVentaId: puntosVenta[0]?.id || "",
  fecha: new Date().toISOString().split("T")[0],
  estado: "Abierto",
  tipo: "Cotización",
  items: [],
  bonificacionGeneral: 0,
  total: 0,
  descu1: 0,
  descu2: 0,
  descu3: 0,
  copia: 1,
  // Campo para "Factura Recibo"
  montoPago: 0,
})

const mergeWithDefaults = (data, sucursales = [], puntosVenta = []) => ({
  ...getInitialFormState(sucursales, puntosVenta),
  ...data,
  items: Array.isArray(data?.items) ? normalizarItemsStock(data.items) : [],
})

const getStockProveedoresMap = (productos) => {
  const map = {}
  productos.forEach((p) => {
    if (p.stock_proveedores) {
      map[p.id] = p.stock_proveedores
    }
  })
  return map
}

const VentaForm = ({
  onSave,
  onCancel,
  initialData,
  readOnlyOverride,
  comprobantes,
  ferreteria,
  clientes,
  plazos,
  vendedores,
  sucursales,
  puntosVenta,
  loadingComprobantes,
  errorComprobantes,
  productos,
  loadingProductos,
  familias,
  loadingFamilias,
  proveedores,
  loadingProveedores,
  alicuotas,
  loadingAlicuotas,
  errorProductos,
  errorFamilias,
  errorProveedores,
  errorAlicuotas,
  autoSumarDuplicados,
  setAutoSumarDuplicados,
  tabKey = `venta-${Date.now()}` // Valor por defecto en caso de que no se pase
}) => {
  // Estados para manejar la carga
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState(null)

  // Hooks existentes movidos al inicio
  const theme = useFerreDeskTheme()

  // Hook para navegación entre campos con Enter
  const { getFormProps } = useNavegacionForm()

  const { clientes: clientesConDefecto, loading: loadingClientes, error: errorClientes } = useClientesConDefecto({ soloConMovimientos: false })
  const { alicuotas: alicuotasIVA, loading: loadingAlicuotasIVA, error: errorAlicuotasIVA } = useAlicuotasIVAAPI()
  
  // Hook para consulta de estado CUIT en ARCA
  const { 
    estadoARCAStatus,
    mensajesARCAStatus,
    isLoadingARCAStatus,
    consultarARCAStatus,
    limpiarEstadosARCAStatus
  } = useValidacionCUIT()

  // Hook para listas de precios
  const { listas: listasPrecio, loading: loadingListas } = useListasPrecioAPI()
  
  // Estado para la lista de precios activa (0 = Minorista por defecto)
  const [listaPrecioId, setListaPrecioId] = useState(0)

  // Estados sincronizados para comprobante y tipo
  const [inicializado, setInicializado] = useState(false)
  const [tipoComprobante, setTipoComprobante] = useState("")
  const [comprobanteId, setComprobanteId] = useState("")

  // Hook para manejar estado de ARCA
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

  // Hook para manejar resultados de ARCA de manera modularizada
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

  // Función personalizada para aceptar resultado de ARCA (modularizada)
  const handleAceptarResultadoArca = crearHandleAceptarResultadoArca(
    aceptarResultadoArca,
    () => { limpiarBorrador(); onCancel(); },
    () => respuestaArca,
    () => errorArca
  )

  // Función para normalizar items
  // const normalizarItemsVenta = (items) => {
  //   return normalizarItems(items, { 
  //     productos, 
  //     modo: 'venta', 
  //     alicuotasMap 
  //   })
  // }

  // Usar el hook useFormularioDraft
  const { formulario, setFormulario, limpiarBorrador, actualizarItems } = useFormularioDraft({
    claveAlmacenamiento: `ventaFormDraft_${tabKey}`,
    datosIniciales: initialData,
    combinarConValoresPorDefecto: mergeWithDefaults,
    parametrosPorDefecto: [sucursales, puntosVenta],
    normalizarItems: (items) => items, // ItemsGrid se encarga de la normalización
  })

  const alicuotasMap = useMemo(
    () =>
      Array.isArray(alicuotasIVA)
        ? alicuotasIVA.reduce((acc, ali) => {
            acc[ali.id] = Number.parseFloat(ali.porce) || 0
            return acc
          }, {})
        : {},
    [alicuotasIVA],
  )

  const { totales } = useCalculosFormulario(formulario.items, {
    bonificacionGeneral: formulario.bonificacionGeneral,
    descu1: formulario.descu1,
    descu2: formulario.descu2,
    descu3: formulario.descu3,
    alicuotas: alicuotasMap,
  })

  const itemsGridRef = useRef()
  // Temporizador para mostrar overlay ARCA solo si la espera es real (evita condiciones de carrera)
  const temporizadorArcaRef = useRef(null)
  const stockProveedores = useMemo(() => getStockProveedoresMap(productos), [productos])

  // ------------------------------------------------------------
  // LOG DE DIAGNÓSTICO: ¿Cuándo se arma stockProveedores y qué trae?
  // ------------------------------------------------------------
  useEffect(() => {
    
  }, [loadingProductos, loadingProveedores, stockProveedores])

  // Nuevo: obtener comprobantes de tipo Venta (o los que no sean Presupuesto)
  const comprobantesVenta = comprobantes.filter((c) => (c.tipo || "").toLowerCase() !== "presupuesto")

  // Efecto de inicialización sincronizada
  useEffect(() => {
    if (!inicializado && comprobantesVenta.length > 0) {
      const comprobanteFacturaInterna = comprobantesVenta.find((c) => (c.tipo || "").toLowerCase() === "factura_interna")
      if (comprobanteFacturaInterna) {
        setTipoComprobante("factura_interna")
        setComprobanteId(comprobanteFacturaInterna.id)
      } else {
        setTipoComprobante(comprobantesVenta[0].tipo?.toLowerCase() || "factura_interna")
        setComprobanteId(comprobantesVenta[0].id)
      }
      setInicializado(true)
    }
  }, [inicializado, comprobantesVenta])

  useEffect(() => {
    if (comprobantesVenta.length > 0 && !comprobanteId) {
      setComprobanteId(comprobantesVenta[0].id)
    }
  }, [comprobantesVenta, comprobanteId])

  useEffect(() => {
    if (!autoSumarDuplicados) {
      setAutoSumarDuplicados("sumar")
    }
  }, [autoSumarDuplicados, setAutoSumarDuplicados])



  // Sincronizar comprobanteId con el tipo de comprobante seleccionado
  useEffect(() => {
    const comprobanteDelTipo = comprobantesVenta.find((c) => (c.tipo || "").toLowerCase() === tipoComprobante)
    if (comprobanteDelTipo && comprobanteId !== comprobanteDelTipo.id) {
      setComprobanteId(comprobanteDelTipo.id)
    }
  }, [tipoComprobante, comprobantesVenta, comprobanteId])

  // Efecto para manejar el estado de carga
  useEffect(() => {
    if (!inicializado) {
      setIsLoading(true)
      return
    }
    if (loadingClientes || loadingAlicuotasIVA) {
      setIsLoading(true)
      return
    }
    if (errorClientes || errorAlicuotasIVA) {
      setLoadingError(errorClientes || errorAlicuotasIVA)
      setIsLoading(false)
      return
    }
    setIsLoading(false)
  }, [inicializado, loadingClientes, loadingAlicuotasIVA, errorClientes, errorAlicuotasIVA])

  // Determinar cliente seleccionado (siempre debe haber uno, por defecto el mostrador)
  const clienteSeleccionado =
    clientes.find((c) => String(c.id) === String(formulario.clienteId)) ||
    clientesConDefecto.find((c) => String(c.id) === String(formulario.clienteId))

  // Construir objeto para validación fiscal con datos actuales del formulario
  const clienteParaFiscal = useMemo(() => {
    if (!clienteSeleccionado) return null
    return {
      ...clienteSeleccionado,
      cuit: formulario.cuit,
      domicilio: formulario.domicilio,
      razon: formulario.razon || clienteSeleccionado.razon,
      nombre: formulario.nombre || clienteSeleccionado.nombre,
    }
  }, [clienteSeleccionado, formulario.cuit, formulario.domicilio, formulario.razon, formulario.nombre]);

  const usarFiscal = tipoComprobante === "factura"
  const fiscal = useComprobanteFiscal({
    tipoComprobante: usarFiscal ? "factura" : "",
    cliente: usarFiscal ? clienteParaFiscal : null,
  })
  const comprobanteRequisitos = usarFiscal ? fiscal.requisitos : null

  // Determinar el código AFIP y la letra a mostrar en el badge
  let letraComprobanteMostrar = "V"
  let codigoAfipMostrar = ""
  if (usarFiscal && fiscal.comprobanteFiscal && fiscal.comprobanteFiscal.codigo_afip) {
    letraComprobanteMostrar = fiscal.letra || ""
    codigoAfipMostrar = fiscal.comprobanteFiscal.codigo_afip
  } else if (comprobantesVenta.length > 0 && comprobanteId) {
    const compSeleccionado = comprobantesVenta.find((c) => c.id === comprobanteId)
    if (compSeleccionado) {
      letraComprobanteMostrar = compSeleccionado.letra || "V"
      codigoAfipMostrar = compSeleccionado.codigo_afip || ""
    }
  }

  // Nuevo: calcular número de comprobante según comprobante seleccionado
  const numeroComprobante = (() => {
    const comp = comprobantesVenta.find((c) => c.id === comprobanteId)
    if (!comp) return 1
    return (comp.ultimo_numero || 0) + 1
  })()

  // Función personalizada para manejar cambios, incluyendo campos de pago
  const handleChangeBase = manejarCambioFormulario(setFormulario)
  const handleChange = (e) => {
    const { name, value } = e.target
    
    // Lógica específica para campo de pago
    if (name === 'montoPago') {
      const monto = parseFloat(value) || 0
      
      // Permitir escribir libremente, validar solo al enviar
      setFormulario(prev => ({
        ...prev,
        montoPago: monto
      }))
    } else {
      // Usar la función base para otros campos
      handleChangeBase(e)
    }
  }

  const handleClienteSelect = manejarSeleccionClienteObjeto(setFormulario)

  // Estado para modal selector de clientes
  const [selectorAbierto, setSelectorAbierto] = useState(false)

  // Estado para controlar si es la carga inicial desde formularioDraft
  const [esCargaInicial, setEsCargaInicial] = useState(true)

  // Estado para manejar documento (CUIT/DNI)
  const [documentoInfo, setDocumentoInfo] = useState({
    tipo: 'cuit',
    valor: formulario.cuit || '',
    esValido: false
  })

  // Estado para controlar visibilidad del banner de estado CUIT
  const [mostrarBannerCuit, setMostrarBannerCuit] = useState(false)

  // Estados para recibo de excedente
  const [reciboExcedente, setReciboExcedente] = useState(null)
  const [mostrarModalReciboExcedente, setMostrarModalReciboExcedente] = useState(false)

  // Sincronizar documentoInfo cuando cambie el formulario (por ejemplo, al seleccionar cliente)
  // Solo se ejecuta después de la carga inicial para evitar sobrescribir datos del formularioDraft
  useEffect(() => {
    // No sincronizar durante la carga inicial
    if (esCargaInicial) return
    
    // Si el formulario tiene cuit, validar y actualizar documentoInfo
    if (formulario.cuit) {
      const cuitLimpio = formulario.cuit.replace(/[-\s]/g, '')
      
      if (cuitLimpio.length === 11 && /^\d{11}$/.test(cuitLimpio)) {
        setDocumentoInfo({
          tipo: 'cuit',
          valor: formulario.cuit,
          esValido: true
        })
      } else {
        setDocumentoInfo({
          tipo: 'dni',
          valor: formulario.cuit,
          esValido: true
        })
      }
    } else {
      // Si no tiene cuit, limpiar el documento
      setDocumentoInfo({
        tipo: 'cuit',
        valor: '',
        esValido: false
      })
    }
  }, [formulario.cuit, esCargaInicial])

  // Inicializar documentoInfo cuando se carga desde formularioDraft
  useEffect(() => {
    if (esCargaInicial && formulario.cuit) {
      const cuitLimpio = formulario.cuit.replace(/[-\s]/g, '')
      
      if (cuitLimpio.length === 11 && /^\d{11}$/.test(cuitLimpio)) {
        setDocumentoInfo({
          tipo: 'cuit',
          valor: formulario.cuit,
          esValido: true
        })
      } else {
        setDocumentoInfo({
          tipo: 'dni',
          valor: formulario.cuit,
          esValido: true
        })
      }
      // Marcar que ya no es carga inicial
      setEsCargaInicial(false)
    }
  }, [formulario.cuit, esCargaInicial])

  // Función para manejar cambios en el documento
  const handleDocumentoChange = (nuevaInfo) => {
    setDocumentoInfo(nuevaInfo)
    
    // Actualizar el formulario con el nuevo valor
    setFormulario(prevForm => ({
      ...prevForm,
      cuit: nuevaInfo.valor
    }))
    
    // Marcar que ya no es carga inicial
    setEsCargaInicial(false)
  }

  // UseEffect para consultar estado CUIT en ARCA cuando aplique (letra fiscal A)
  useEffect(() => {
    // Solo consultar si no es carga inicial y hay datos necesarios
    if (esCargaInicial) return

    // Solo consultar si es factura fiscal
    if (tipoComprobante !== 'factura') {
      setMostrarBannerCuit(false)
      limpiarEstadosARCAStatus()
      return
    }

    // Solo consultar si la letra fiscal es A
    const letraFiscal = usarFiscal && fiscal.comprobanteFiscal ? fiscal.letra : null
    if (letraFiscal !== 'A') {
      setMostrarBannerCuit(false)
      limpiarEstadosARCAStatus()
      return
    }

    // Validar que hay CUIT válido
    const cuitLimpio = (formulario.cuit || '').replace(/[-\s]/g, '')
    if (!cuitLimpio || cuitLimpio.length !== 11 || !/^\d{11}$/.test(cuitLimpio)) {
      setMostrarBannerCuit(true)
      // No consultar ARCA pero mostrar mensaje local de CUIT inválido
      return
    }

    // Consultar estado en ARCA
    consultarARCAStatus(cuitLimpio)
    setMostrarBannerCuit(true)

  }, [
    tipoComprobante, 
    usarFiscal, 
    fiscal.letra, 
    fiscal.comprobanteFiscal,
    formulario.cuit, 
    formulario.clienteId, 
    esCargaInicial,
    consultarARCAStatus,
    limpiarEstadosARCAStatus
  ])

  const abrirSelector = () => setSelectorAbierto(true)
  const cerrarSelector = () => setSelectorAbierto(false)
  
  // Función para ocultar el banner de estado CUIT
  const ocultarBannerCuit = () => {
    setMostrarBannerCuit(false)
    limpiarEstadosARCAStatus()
  }
  const onSeleccionarDesdeModal = (cli) => {
    
    // Usar la función estándar para autocompletar todos los campos del cliente
    handleClienteSelect(cli)
    
    // Usar la función centralizada para validar y actualizar el documento
    const documentoValidado = validarDocumentoCliente(cli)
    setDocumentoInfo(documentoValidado)
    
    // Actualizar lista de precios según el cliente seleccionado
    const listaCliente = cli.lista_precio_id ?? 0
    setListaPrecioId(listaCliente)
    
    // Marcar que ya no es carga inicial
    setEsCargaInicial(false)
  }

  // Bloquear envío de formulario al presionar Enter en cualquier campo
  const bloquearEnterSubmit = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!window.confirm("¿Está seguro de guardar los cambios?")) return
    if (!itemsGridRef.current) {
      return
    }

    try {
      // Validar campos de pago
      const montoPago = Number.parseFloat(formulario.montoPago) || 0
      const totalVenta = totales?.total || 0
      const estaPagado = montoPago > 0

      // Validación: Consumidor Final (ID=1) debe abonar exactamente el total (sin cero, sin parcial, sin excedente)
      const CLIENTE_GENERICO_ID = '1'
      if (String(formulario.clienteId) === CLIENTE_GENERICO_ID) {
        const totalEq = Number(totalVenta).toFixed(2)
        const pagoEq = Number(montoPago).toFixed(2)
        if (pagoEq !== totalEq) {
          alert(
            'El cliente "Consumidor Final" debe abonar exactamente el total de la venta.\n\n' +
            'Total requerido: $' + totalEq
          )
          return
        }
      }
      // Tolerancia de 1 peso para evitar mensaje de excedente por diferencias mínimas
      const TOLERANCIA_MONTO = 1.00
      if (estaPagado && montoPago > totalVenta + TOLERANCIA_MONTO) {
        const excedente = Math.max(0, Math.round((montoPago - totalVenta) * 100) / 100)
        
        // Preguntar si desea crear recibo de excedente
        const crearRecibo = window.confirm(
          `El monto del pago ($${montoPago.toFixed(2)}) excede el total de la venta ($${totalVenta.toFixed(2)}) por $${excedente.toFixed(2)}.\n\n` +
          `¿Desea generar un recibo por el excedente?`
        )
        
        if (!crearRecibo) {
          alert('No se puede recibir un monto mayor al total de la venta sin generar un recibo.')
          return
        }
        
        // Abrir modal de recibo con datos precargados
        setMostrarModalReciboExcedente(true)
        return // Detener el submit hasta que se complete el recibo
      }

      // ATENCIÓN: El payload que se envía al backend DEBE contener SOLO los campos base requeridos por el modelo físico.
      // NUNCA incluir campos calculados como vdi_importe, vdi_importe_total, vdi_ivaitem, ven_total, iva_global, etc.
      // La función mapearCamposItem ya filtra y elimina estos campos, pero si modificas este código, revisa DOCUMENTACION_VISTAS_VENTAS.md y Roadmap.txt.
      // Si tienes dudas, consulta con el equipo antes de modificar la estructura del payload.
      // El backend rechazará cualquier campo calculado y solo aceptará los campos base.

      const items = itemsGridRef.current.getItems()

      // Determinar el tipo de comprobante como string fijo
      // Si el comprobante seleccionado tiene tipo "factura", usar "factura", si no, usar "factura_interna"
      const tipoComprobanteSeleccionado =
        comprobantesVenta.find((c) => c.id === comprobanteId) &&
        (comprobantesVenta.find((c) => c.id === comprobanteId).tipo || "").toLowerCase() === "factura"
          ? "factura"
          : "factura_interna"
      
      // HÍBRIDO: Enviar solo el TIPO al backend, no código AFIP específico
      // El backend ejecutará su propia lógica fiscal autoritaria

      // Definir constantes descriptivas para valores por defecto
      // Estado cerrado para ventas
      const ESTADO_VENTA_CERRADA = "CE"
      // Tipo de operación para ventas
      const TIPO_VENTA = "Venta"

      // Construir el payload asegurando conversiones de tipo y sin valores mágicos
      const payload = {
        ven_estado: ESTADO_VENTA_CERRADA, // Estado cerrado
        ven_tipo: TIPO_VENTA, // Tipo de operación
        tipo_comprobante: tipoComprobanteSeleccionado, // "factura" o "factura_interna"
        // NO enviar comprobante_id - el backend determinará el código AFIP usando lógica fiscal
        ven_numero: Number.parseInt(formulario.numero, 10) || numeroComprobante, // Número de comprobante
        ven_sucursal: Number.parseInt(formulario.sucursalId, 10) || 1, // Sucursal
        ven_fecha: formulario.fecha, // Fecha
        ven_impneto: Number.parseFloat(formulario.ven_impneto) || 0, // Importe neto
        ven_descu1: Number.parseFloat(formulario.descu1) || 0, // Descuento 1
        ven_descu2: Number.parseFloat(formulario.descu2) || 0, // Descuento 2
        ven_descu3: Number.parseFloat(formulario.descu3) || 0, // Descuento 3
        bonificacionGeneral: Number.parseFloat(formulario.bonificacionGeneral) || 0, // Bonificación general
        ven_bonificacion_general: Number.parseFloat(formulario.bonificacionGeneral) || 0, // Bonificación general (duplicado por compatibilidad)
        ven_total: Number.parseFloat(formulario.ven_total) || 0, // Total
        ven_vdocomvta: Number.parseFloat(formulario.ven_vdocomvta) || 0, // Valor documento venta
        ven_vdocomcob: Number.parseFloat(formulario.ven_vdocomcob) || 0, // Valor documento cobro
        ven_idcli: formulario.clienteId, // ID cliente
        ven_idpla: formulario.plazoId, // ID plazo
        ven_idvdo: formulario.vendedorId, // ID vendedor
        ven_copia: Number.parseInt(formulario.copia, 10) || 1, // Cantidad de copias
        items: items.map((item, idx) => mapearCamposItem(item, idx)), // Ítems mapeados
        // Campos para "Factura Recibo"
        comprobante_pagado: estaPagado,
        monto_pago: montoPago,
        // permitir_stock_negativo: se obtiene automáticamente del backend desde la configuración de la ferretería
      }

      // Si hay recibo de excedente, agregarlo al payload
      if (reciboExcedente) {
        payload.recibo_excedente = reciboExcedente
      }

      // Agregar documento (CUIT/DNI) y domicilio si existen
      if (documentoInfo.tipo === 'cuit' && documentoInfo.valor) {
        payload.ven_cuit = documentoInfo.valor
      } else if (documentoInfo.tipo === 'dni' && documentoInfo.valor) {
        payload.ven_dni = documentoInfo.valor
      }
      if (formulario.domicilio) payload.ven_domicilio = formulario.domicilio

      // Iniciar overlay de ARCA con retardo para evitar carrera en errores rápidos
      if (requiereEmisionArca(tipoComprobanteSeleccionado) && !temporizadorArcaRef.current) {
        temporizadorArcaRef.current = setTimeout(() => {
          iniciarEsperaArca()
        }, 400)
      }

      const resultado = await onSave(payload)

      // Limpiar temporizador si había sido agendado (la respuesta ya llegó)
      if (temporizadorArcaRef.current) {
        clearTimeout(temporizadorArcaRef.current)
        temporizadorArcaRef.current = null
      }
      
      // Procesar respuesta de ARCA usando la lógica modularizada
      procesarResultadoArca(resultado, tipoComprobanteSeleccionado)
    } catch (error) {
      // Asegurar limpieza del temporizador si hubo error
      if (temporizadorArcaRef.current) {
        clearTimeout(temporizadorArcaRef.current)
        temporizadorArcaRef.current = null
      }
      // Manejar error usando la lógica modularizada
      manejarErrorArca(error, "Error al procesar la venta")
    }
  }

  const handleCancel = () => {
    const confirmado = window.confirm('¿Está seguro de cancelar? Se perderán todos los cambios no guardados.');
    if (!confirmado) return;
    
    // Limpiar temporizador si está pendiente
    if (temporizadorArcaRef.current) {
      clearTimeout(temporizadorArcaRef.current)
      temporizadorArcaRef.current = null
    }
    limpiarEstadoArca() // Limpiar estado de ARCA al cancelar
    limpiarBorrador()
    onCancel()
  }

  // Handler para cuando se guarda el recibo de excedente
  const handleReciboExcedenteGuardado = (reciboData) => {
    // Guardar recibo temporalmente
    setReciboExcedente(reciboData)
    setMostrarModalReciboExcedente(false)
    
    // Continuar con submit de venta automáticamente
    // Usar setTimeout para permitir que React actualice el estado primero
    setTimeout(() => {
      realizarSubmitVenta(reciboData)
    }, 100)
  }

  // Función para realizar submit final (sin validación de excedente)
  const realizarSubmitVenta = async (reciboData = null) => {
    if (!itemsGridRef.current) {
      return
    }

    try {
      // Validar campos de pago (sin validación de excedente)
      const montoPago = Number.parseFloat(formulario.montoPago) || 0
      const estaPagado = montoPago > 0

      const items = itemsGridRef.current.getItems()

      // Determinar el tipo de comprobante como string fijo
      const tipoComprobanteSeleccionado =
        comprobantesVenta.find((c) => c.id === comprobanteId) &&
        (comprobantesVenta.find((c) => c.id === comprobanteId).tipo || "").toLowerCase() === "factura"
          ? "factura"
          : "factura_interna"
      
      // Definir constantes descriptivas para valores por defecto
      const ESTADO_VENTA_CERRADA = "CE"
      const TIPO_VENTA = "Venta"

      // Construir el payload
      const payload = {
        ven_estado: ESTADO_VENTA_CERRADA,
        ven_tipo: TIPO_VENTA,
        tipo_comprobante: tipoComprobanteSeleccionado,
        ven_numero: Number.parseInt(formulario.numero, 10) || numeroComprobante,
        ven_sucursal: Number.parseInt(formulario.sucursalId, 10) || 1,
        ven_fecha: formulario.fecha,
        ven_impneto: Number.parseFloat(formulario.ven_impneto) || 0,
        ven_descu1: Number.parseFloat(formulario.descu1) || 0,
        ven_descu2: Number.parseFloat(formulario.descu2) || 0,
        ven_descu3: Number.parseFloat(formulario.descu3) || 0,
        bonificacionGeneral: Number.parseFloat(formulario.bonificacionGeneral) || 0,
        ven_bonificacion_general: Number.parseFloat(formulario.bonificacionGeneral) || 0,
        ven_total: Number.parseFloat(formulario.ven_total) || 0,
        ven_vdocomvta: Number.parseFloat(formulario.ven_vdocomvta) || 0,
        ven_vdocomcob: Number.parseFloat(formulario.ven_vdocomcob) || 0,
        ven_idcli: formulario.clienteId,
        ven_idpla: formulario.plazoId,
        ven_idvdo: formulario.vendedorId,
        ven_copia: Number.parseInt(formulario.copia, 10) || 1,
        items: items.map((item, idx) => mapearCamposItem(item, idx)),
        comprobante_pagado: estaPagado,
        monto_pago: montoPago,
      }

      // Si hay recibo de excedente (ya sea del estado o pasado como parámetro), agregarlo al payload
      const reciboFinal = reciboData || reciboExcedente
      if (reciboFinal) {
        payload.recibo_excedente = reciboFinal
      }

      // Agregar documento (CUIT/DNI) y domicilio si existen
      if (documentoInfo.tipo === 'cuit' && documentoInfo.valor) {
        payload.ven_cuit = documentoInfo.valor
      } else if (documentoInfo.tipo === 'dni' && documentoInfo.valor) {
        payload.ven_dni = documentoInfo.valor
      }
      if (formulario.domicilio) payload.ven_domicilio = formulario.domicilio

      // Iniciar overlay de ARCA con retardo para evitar carrera en errores rápidos
      if (requiereEmisionArca(tipoComprobanteSeleccionado) && !temporizadorArcaRef.current) {
        temporizadorArcaRef.current = setTimeout(() => {
          iniciarEsperaArca()
        }, 400)
      }

      const resultado = await onSave(payload)

      // Limpiar temporizador si había sido agendado
      if (temporizadorArcaRef.current) {
        clearTimeout(temporizadorArcaRef.current)
        temporizadorArcaRef.current = null
      }
      
      // Procesar respuesta de ARCA usando la lógica modularizada
      procesarResultadoArca(resultado, tipoComprobanteSeleccionado)
    } catch (error) {
      // Asegurar limpieza del temporizador si hubo error
      if (temporizadorArcaRef.current) {
        clearTimeout(temporizadorArcaRef.current)
        temporizadorArcaRef.current = null
      }
      // Manejar error usando la lógica modularizada
      manejarErrorArca(error, "Error al procesar la venta")
    }
  }

  // Handler para cerrar modal de recibo de excedente
  const handleCerrarModalRecibo = () => {
    setMostrarModalReciboExcedente(false)
    setReciboExcedente(null)
  }

  // Función para agregar producto a la grilla desde el buscador
  const handleAddItemToGrid = (producto) => {
    if (itemsGridRef.current) {
      itemsGridRef.current.handleAddItem(producto)
    }
  }

  // Efecto para seleccionar automáticamente Cliente Mostrador (ID 1)
  // Se ejecuta solo una vez después de que los clientes se cargan y si no hay un cliente ya seleccionado.
  useEffect(() => {
    if (esCargaInicial && clientesConDefecto.length > 0 && !formulario.clienteId) {
      const mostrador = clientesConDefecto.find((c) => String(c.id) === "1");
      if (mostrador) {
        handleClienteSelect(mostrador);
        // Marcamos que la carga inicial ha terminado para no volver a ejecutar esto.
        setEsCargaInicial(false);
      }
    }
  }, [clientesConDefecto, esCargaInicial, formulario.clienteId, handleClienteSelect]);


  const isReadOnly = readOnlyOverride || formulario.estado === "Cerrado"

  // Función para actualizar los ítems en tiempo real desde ItemsGrid (memoizada)
  const handleRowsChange = useCallback((rows) => {
    actualizarItems(rows)
  }, [actualizarItems])

  // Funciones de descuento estabilizadas con useCallback para evitar re-renders innecesarios
  const setDescu1 = useCallback((value) => {
    setFormulario(f => ({ ...f, descu1: value }))
  }, [setFormulario])

  const setDescu2 = useCallback((value) => {
    setFormulario(f => ({ ...f, descu2: value }))
  }, [setFormulario])

  const setDescu3 = useCallback((value) => {
    setFormulario(f => ({ ...f, descu3: value }))
  }, [setFormulario])

  const setBonificacionGeneral = useCallback((value) => {
    setFormulario(f => ({ ...f, bonificacionGeneral: value }))
  }, [setFormulario])

  // Opciones fijas para el dropdown
  const opcionesComprobante = [
    { value: "factura_interna", label: "Cotización", tipo: "factura_interna", letra: "I" },
    { value: "factura", label: "Factura", tipo: "factura" },
  ]

  // Renderizado condicional al final
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando formulario...</p>
        </div>
      </div>
    )
  }

  if (loadingError) {
    return (
      <div className="text-center py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
          <div className="text-red-600 font-medium mb-2">Error al cargar</div>
          <p className="text-red-700 text-sm">{loadingError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30 py-6">
      <div className="px-6">
        <form
          className="venta-form w-full bg-white rounded-2xl shadow-2xl border border-slate-200/50 relative overflow-hidden"
          onSubmit={handleSubmit}
          onKeyDown={bloquearEnterSubmit}
          {...getFormProps()}
        >
          {/* Gradiente decorativo superior */}
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.primario}`}></div>

          <div className="px-8 pt-4 pb-6">
            {/* Badge de letra de comprobante */}
            {letraComprobanteMostrar && (
              <div className="absolute top-6 right-6 z-10">
                <div className="w-14 h-14 flex flex-col items-center justify-center border-2 border-slate-800 shadow-xl bg-gradient-to-br from-white to-slate-50 rounded-xl ring-1 ring-slate-200/50">
                  <span className="text-2xl font-extrabold font-serif text-slate-900 leading-none">
                    {letraComprobanteMostrar}
                  </span>
                  <span className="text-[9px] font-mono text-slate-600 mt-0.5 font-medium">
                    COD {codigoAfipMostrar}
                  </span>
                </div>
              </div>
            )}

            {/* Mensaje de requisitos solo si es factura */}
            {usarFiscal && comprobanteRequisitos && comprobanteRequisitos.mensaje && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 mt-4 text-sm text-blue-800 bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-3 rounded-xl shadow-lg border border-blue-200/50">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {comprobanteRequisitos.mensaje}
                </div>
              </div>
            )}

            {/* Banner de estado CUIT para facturas fiscales A (oculto durante envío/espera ARCA) */}
            {mostrarBannerCuit && !esperandoArca && tipoComprobante === 'factura' && usarFiscal && fiscal.letra === 'A' && (
                          <CuitStatusBanner
              cuit={formulario.cuit}
              estado={(() => {
                const cuitLimpio = (formulario.cuit || '').replace(/[-\s]/g, '')
                if (!cuitLimpio || cuitLimpio.length !== 11 || !/^\d{11}$/.test(cuitLimpio)) {
                  return 'error'
                }
                return estadoARCAStatus || 'ok'
              })()}
              mensajes={(() => {
                const cuitLimpio = (formulario.cuit || '').replace(/[-\s]/g, '')
                if (!cuitLimpio || cuitLimpio.length !== 11 || !/^\d{11}$/.test(cuitLimpio)) {
                  return ['CUIT faltante o inválido. Verificar datos del cliente.']
                }
                return mensajesARCAStatus || []
              })()}
              onDismiss={ocultarBannerCuit}
              isLoading={isLoadingARCAStatus}
            />
            )}

            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-md">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                </div>
                {initialData ? (isReadOnly ? "Ver Factura" : "Editar Factura") : "Nueva Venta"}
              </h3>

              {isReadOnly && (
                <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-amber-100/80 border-l-4 border-amber-500 text-amber-900 rounded-xl shadow-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <span className="font-medium">
                      Este comprobante está cerrado y no puede ser editado. Solo lectura.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Una sola tarjeta con campos organizados en grid */}
            <div className="mb-6">
              <div className="p-2 bg-slate-50 rounded-sm border border-slate-200">
                
                {/* Primera fila: 6 campos */}
                <div className="grid grid-cols-6 gap-4 mb-3">
                  {/* Cliente */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Cliente *</label>
                    {loadingClientes ? (
                      <div className="flex items-center gap-2 text-slate-500 bg-slate-100 rounded-none px-2 py-1 text-xs h-8">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-600"></div>
                        Cargando...
                      </div>
                    ) : errorClientes ? (
                      <div className="text-red-600 bg-red-50 rounded-none px-2 py-1 text-xs border border-red-200 h-8">
                        {errorClientes}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={clienteSeleccionado ? (clienteSeleccionado.razon || clienteSeleccionado.nombre) : ""}
                          readOnly
                          disabled
                          className="flex-1 border border-slate-300 rounded-none px-2 py-1 text-xs h-8 bg-slate-100 text-slate-600 cursor-not-allowed"
                        />
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={abrirSelector}
                            className="p-1 rounded-none border border-slate-300 bg-white hover:bg-slate-100 transition-colors h-8 w-8 flex items-center justify-center"
                            title="Buscar en lista completa"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 text-slate-600"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Documento */}
                  <div>
                    <SelectorDocumento
                      tipoComprobante={fiscal.letra}
                      esObligatorio={usarFiscal && fiscal.camposRequeridos.cuit}
                      valorInicial={documentoInfo.valor}
                      tipoInicial={documentoInfo.tipo}
                      onChange={handleDocumentoChange}
                      readOnly={!esDocumentoEditable(formulario.clienteId, isReadOnly)}
                      className="w-full"
                    />
                  </div>

                  {/* Domicilio */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Domicilio {usarFiscal && fiscal.camposRequeridos.domicilio && fiscal.letra !== 'B' && <span className="text-orange-600">*</span>}</label>
                    <input
                      name="domicilio"
                      type="text"
                      value={formulario.domicilio}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      required={usarFiscal && fiscal.camposRequeridos.domicilio && fiscal.letra !== 'B'}
                      readOnly={isReadOnly}
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
                      readOnly={isReadOnly}
                    />
                  </div>

                  {/* Plazo */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Plazo *</label>
                    <select
                      name="plazoId"
                      value={formulario.plazoId}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      required
                      disabled={isReadOnly}
                    >
                      <option value="">Seleccionar...</option>
                      {(() => {
                        const activos = Array.isArray(plazos) ? plazos.filter(p => p && p.activo === 'S') : []
                        const seleccionado = Array.isArray(plazos) ? plazos.find(p => String(p.id) === String(formulario.plazoId)) : null
                        const visibles = seleccionado && seleccionado.activo !== 'S' ? [...activos, seleccionado] : activos
                        return visibles.map((p) => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))
                      })()}
                    </select>
                  </div>

                  {/* Vendedor */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Vendedor *</label>
                    <select
                      name="vendedorId"
                      value={formulario.vendedorId}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      required
                      disabled={isReadOnly}
                    >
                      <option value="">Seleccionar...</option>
                      {vendedores.map((v) => (
                        <option key={v.id} value={v.id}>{v.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Segunda fila: 4 campos */}
                <div className="grid grid-cols-4 gap-4 mb-3">
                  {/* Buscador */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Buscador de Producto</label>
                                         <BuscadorProducto 
                       onSelect={handleAddItemToGrid} 
                       disabled={isReadOnly}
                       readOnly={isReadOnly}
                       className="w-full"
                     />
                  </div>

                  {/* Tipo de Comprobante */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Tipo de Comprobante *</label>
                    <ComprobanteDropdown
                      opciones={opcionesComprobante}
                      value={tipoComprobante}
                      onChange={setTipoComprobante}
                      disabled={isReadOnly}
                      className="w-full"
                    />
                  </div>

                  {/* Acción por defecto */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Acción por defecto</label>
                    <SumarDuplicar
                      autoSumarDuplicados={autoSumarDuplicados}
                      setAutoSumarDuplicados={setAutoSumarDuplicados}
                      disabled={isReadOnly}
                      showLabel={false}
                    />
                  </div>

                  {/* Lista de Precios */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Lista de Precios</label>
                    <select
                      value={listaPrecioId}
                      onChange={(e) => setListaPrecioId(Number(e.target.value))}
                      disabled={isReadOnly || loadingListas}
                      className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {listasPrecio.map((lista) => (
                        <option key={lista.numero} value={lista.numero}>
                          {lista.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tercera fila: Campo Comprobante Pagado */}
                <div className="grid grid-cols-4 gap-4">
                  <CampoComprobantePagado 
                    formulario={formulario}
                    handleChange={handleChange}
                    totales={totales}
                    isReadOnly={isReadOnly}
                  />
                </div>


              </div>
            </div>

            <div className="mb-8">
              <ItemsGrid
                ref={itemsGridRef}
                autoSumarDuplicados={autoSumarDuplicados}
                setAutoSumarDuplicados={setAutoSumarDuplicados}
                bonificacionGeneral={formulario.bonificacionGeneral}
                setBonificacionGeneral={setBonificacionGeneral}
                descu1={formulario.descu1}
                descu2={formulario.descu2}
                descu3={formulario.descu3}
                setDescu1={setDescu1}
                setDescu2={setDescu2}
                setDescu3={setDescu3}
                totales={totales}
                modo="venta"
                alicuotas={alicuotasMap}
                onRowsChange={handleRowsChange}
                initialItems={formulario.items}
                listaPrecioId={listaPrecioId}
                listasPrecio={listasPrecio}
              />
            </div>

            <div className="mt-8 flex justify-end space-x-4">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
              >
                {isReadOnly ? "Cerrar" : "Cancelar"}
              </button>
              {!isReadOnly && (
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {initialData ? "Guardar Cambios" : "Crear Venta"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
      {/* Modal selector de clientes */}
      <ClienteSelectorModal
        abierto={selectorAbierto}
        onCerrar={cerrarSelector}
        clientes={clientesConDefecto}
        onSeleccionar={onSeleccionarDesdeModal}
        cargando={loadingClientes}
        error={errorClientes}
      />

      {/* Modal de recibo de excedente */}
      <NuevoReciboModal
        modal={{
          abierto: mostrarModalReciboExcedente,
          clienteId: formulario.clienteId,
        }}
        onClose={handleCerrarModalRecibo}
        onGuardar={handleReciboExcedenteGuardado}
        esReciboExcedente={true}
        montoFijo={Math.round((Number(formulario.montoPago || 0) - Number(totales?.total || 0)) * 100) / 100}
      />
      
      {/* Overlay de espera de ARCA */}
      <ArcaEsperaOverlay 
        estaEsperando={esperandoArca}
        mensajePersonalizado={obtenerMensajePersonalizado(tipoComprobante)}
        mostrarDetalles={true}
        respuestaArca={respuestaArca}
        errorArca={errorArca}
        onAceptar={handleAceptarResultadoArca}
      />
    </div>
  )
}

export default VentaForm;
