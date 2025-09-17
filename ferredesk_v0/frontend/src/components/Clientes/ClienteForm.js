"use client"

import { useState, useCallback, useEffect, memo, useMemo, useRef } from "react"
import { getCookie } from "../../utils/csrf"
import FilterableSelect from "./FilterableSelect"
import useValidacionCUIT from "../../utils/useValidacionCUIT"
import CUITValidacionTooltip from "./CUITValidacionTooltip"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import useNavegacionForm from "../../hooks/useNavegacionForm"
import MaestroModal from "./MaestrosModales"

// --- Constantes y Componentes Auxiliares Extraídos ---

// Constantes de clases para un estilo consistente y fácil de mantener
const CLASES_TARJETA = "bg-white border border-slate-200 rounded-md p-2"
const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
const CLASES_INPUT = "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
const CLASES_SECCION_TITULO = "mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-slate-700"
const CLASES_SECCION_WRAPPER = "p-2 bg-slate-50 rounded-lg border border-slate-200 min-w-[260px]"

// Cantidad de dígitos requerida para considerar un CUIT completo
const LONGITUD_CUIT_COMPLETO = 11
// Nombre exacto de la condición de IVA para Consumidor Final
const NOMBRE_CONSUMIDOR_FINAL = "Consumidor Final"


// Chip de estado (memoizado)
const ChipEstado = memo(({ activo }) => (
  <span className={`px-2 py-0.5 rounded-full text-[11px] ${activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
    {activo ? "Activo" : "Inactivo"}
  </span>
))

// Tarjeta de campo genérica (memoizada)
const TarjetaCampo = memo(({ etiqueta, children }) => (
  <div className={CLASES_TARJETA}>
    <div className={CLASES_ETIQUETA}>{etiqueta}</div>
    <div className="mt-0.5">
      {children}
    </div>
  </div>
))

// Contenedor de sección estilo lista (memoizado)
const SeccionLista = memo(({ titulo, icono, children }) => (
  <div className={CLASES_SECCION_WRAPPER}>
    <h5 className={CLASES_SECCION_TITULO}>
      {icono} {titulo}
    </h5>
    <div className="divide-y divide-slate-200">
      {children}
    </div>
  </div>
))

// Fila editable con etiqueta e input (memoizada)
const FilaEditable = memo(({ etiqueta, children, inputProps, value, onChange, onAdd }) => {
  const theme = useFerreDeskTheme()
  
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-slate-700">{etiqueta}</span>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="w-4 h-4 flex items-center justify-center transition-all duration-300 hover:scale-110"
            title={`Agregar ${etiqueta}`}
          >
            <svg className={`w-4 h-4 text-orange-600 hover:text-orange-700 ${theme.botonPrimario.split(' ').filter(cls => cls.includes('transition')).join(' ')}`} fill="currentColor" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10s10-4.477 10-10S17.523 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
            </svg>
          </button>
        )}
      </div>
      <div className="min-w-[180px] text-right">
        {children ? children : (
          <input className={`${CLASES_INPUT} text-right`} {...inputProps} value={value ?? ""} onChange={onChange} />
        )}
      </div>
    </div>
  )
})

const ClienteForm = ({
  onSave,
  onCancel,
  initialData,
  tabKey,
  barrios,
  localidades,
  provincias,
  transportes,
  vendedores,
  plazos,
  categorias,
  setBarrios,
  setLocalidades,
  setProvincias,
  setTransportes,
  setPlazos,
  setCategorias,
  tiposIVA,
  apiError,
}) => {
  const claveBorradorCliente = useMemo(() => {
    if (tabKey) return `clienteFormDraft_${tabKey}`
    return initialData?.id ? `clienteFormDraft_${initialData.id}` : 'clienteFormDraft_nuevo'
  }, [initialData?.id, tabKey])
  const claveAnteriorRef = useRef(claveBorradorCliente)
  const estaRecargandoRef = useRef(false)
  const cuitInputRef = useRef(null)
  
  // Hook para navegación entre campos con Enter
  const { formRef, getFormProps } = useNavegacionForm()

  // Detectar recarga/navegación para no limpiar el borrador en ese caso
  useEffect(() => {
    const handleBeforeUnload = () => { estaRecargandoRef.current = true }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(claveBorradorCliente)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (_) {}
    return {
      razon: initialData?.razon || "",
      domicilio: initialData?.domicilio || "",
      lineacred: initialData?.lineacred || "",
      impsalcta: initialData?.impsalcta || "",
      fecsalcta: initialData?.fecsalcta || "",
      zona: initialData?.zona || "",
      fantasia: initialData?.fantasia || "",
      cuit: initialData?.cuit || "",
      ib: initialData?.ib || "",
      cpostal: initialData?.cpostal || "",
      tel1: initialData?.tel1 || "",
      tel2: initialData?.tel2 || "",
      tel3: initialData?.tel3 || "",
      email: initialData?.email || "",
      contacto: initialData?.contacto || "",
      comentario: initialData?.comentario || "",
      barrio: initialData?.barrio || "",
      localidad: initialData?.localidad || "",
      provincia: initialData?.provincia || "",
      iva: initialData?.iva || "",
      transporte: initialData?.transporte || "",
      vendedor: initialData?.vendedor || "",
      plazo: initialData?.plazo || "",
      categoria: initialData?.categoria || "",
      activo: initialData?.activo || "A",
      cancela: initialData?.cancela || "",
      descu1: initialData?.descu1 || "",
      descu2: initialData?.descu2 || "",
      descu3: initialData?.descu3 || "",
    }
  })

  useEffect(() => {
    try { localStorage.setItem(claveBorradorCliente, JSON.stringify(form)) } catch (_) {}
  }, [form, claveBorradorCliente])

  // Si cambia la clave (p.ej., de nuevo a edición con id), borrar la anterior para no dejar borrador huérfano
  useEffect(() => {
    if (claveAnteriorRef.current && claveAnteriorRef.current !== claveBorradorCliente) {
      try { localStorage.removeItem(claveAnteriorRef.current) } catch (_) {}
    }
    claveAnteriorRef.current = claveBorradorCliente
  }, [claveBorradorCliente])

  // Estado para trackear campos autocompletados por ARCA
  const [camposAutocompletados, setCamposAutocompletados] = useState({
    razon: false,
    fantasia: false,
    domicilio: false,
    cpostal: false,
    localidad: false,
    iva: false
  })

  const [error, setError] = useState("")
  const [modal, setModal] = useState(null)
  const [modalForm, setModalForm] = useState({})
  const [modalLoading, setModalLoading] = useState(false)

  // Hook para el tema de FerreDesk
  const theme = useFerreDeskTheme()

  // Ref para conocer el CUIT actual dentro de efectos sin agregar dependencias
  const cuitActualRef = useRef(form.cuit)
  useEffect(() => { cuitActualRef.current = form.cuit }, [form.cuit])

  // Helper: lista solo activos pero conservando la opción seleccionada aunque esté inactiva
  const filtrarActivosConSeleccion = useCallback((lista, seleccionadoId) => {
    const coleccion = Array.isArray(lista) ? lista : []
    const activos = coleccion.filter((x) => x && x.activo === "S")
    const seleccionado = coleccion.find((x) => String(x?.id) === String(seleccionadoId))
    if (seleccionado && seleccionado.activo !== "S") {
      return [...activos, seleccionado]
    }
    return activos
  }, [])

  // Opciones visibles filtradas por activos en selects de catálogos
  const opcionesLocalidades = useMemo(() => filtrarActivosConSeleccion(localidades, form.localidad), [localidades, form.localidad, filtrarActivosConSeleccion])
  const opcionesBarrios = useMemo(() => filtrarActivosConSeleccion(barrios, form.barrio), [barrios, form.barrio, filtrarActivosConSeleccion])
  const opcionesProvincias = useMemo(() => filtrarActivosConSeleccion(provincias, form.provincia), [provincias, form.provincia, filtrarActivosConSeleccion])
  const opcionesTransportes = useMemo(() => filtrarActivosConSeleccion(transportes, form.transporte), [transportes, form.transporte, filtrarActivosConSeleccion])
  const opcionesPlazos = useMemo(() => filtrarActivosConSeleccion(plazos, form.plazo), [plazos, form.plazo, filtrarActivosConSeleccion])
  const opcionesCategorias = useMemo(() => filtrarActivosConSeleccion(categorias, form.categoria), [categorias, form.categoria, filtrarActivosConSeleccion])

  // Opción de IVA: Consumidor Final
  const opcionConsumidorFinal = useMemo(() => {
    const lista = Array.isArray(tiposIVA) ? tiposIVA : []
    return lista.find((x) => x?.nombre?.toLowerCase() === NOMBRE_CONSUMIDOR_FINAL.toLowerCase()) || null
  }, [tiposIVA])

  // Opciones visibles para IVA según longitud de CUIT
  const opcionesIVAVisibles = useMemo(() => {
    const cuitLen = String(form.cuit || '').length
    const lista = Array.isArray(tiposIVA) ? tiposIVA : []
    if (cuitLen === LONGITUD_CUIT_COMPLETO) {
      // Excluir Consumidor Final cuando el CUIT es completo
      return lista.filter((x) => String(x?.id) !== String(opcionConsumidorFinal?.id))
    }
    // Antes de 11 dígitos, solo Consumidor Final (si existe)
    return opcionConsumidorFinal ? [opcionConsumidorFinal] : []
  }, [form.cuit, tiposIVA, opcionConsumidorFinal])

  // Hook para validación de CUIT
  const { 
    resultado, 
    isLoading: isLoadingCUIT, 
    error: errorCUIT, 
    mostrarTooltip, 
    handleCUITBlur, 
    limpiarResultado, 
    toggleTooltip,
    // Estados y funciones de ARCA
    datosARCA,
    errorARCA,
    limpiarEstadosARCA
  } = useValidacionCUIT()

  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    // Validación de campo código únicamente números
    if (name === "codigo" && value && !/^\d*$/.test(value)) {
      return
    }
    
    // Manejo de Tipo IVA con lógica de bloqueo/obligatoriedad
    if (name === "iva") {
      setForm((prev) => {
        const cuitLen = String(prev.cuit || '').length
        if (cuitLen !== LONGITUD_CUIT_COMPLETO) {
          // Bloqueado: forzar Consumidor Final si existe
          if (opcionConsumidorFinal) {
            return { ...prev, iva: opcionConsumidorFinal.id }
          }
          return prev
        }
        // Con 11 dígitos permitir el cambio normalmente
        return { ...prev, iva: value }
      })
      return
    }

    // Manejo de Tipo IVA con lógica de bloqueo/obligatoriedad
    if (name === "iva") {
      setForm((prev) => {
        const cuitLen = String(prev.cuit || '').length
        if (cuitLen !== LONGITUD_CUIT_COMPLETO) {
          // Bloqueado: forzar Consumidor Final si existe
          if (opcionConsumidorFinal) {
            return { ...prev, iva: opcionConsumidorFinal.id }
          }
          return prev
        }
        // Con 11 dígitos permitir el cambio normalmente
        return { ...prev, iva: value }
      })
      return
    }
    
    if (name === "cuit") {
      // Si el CUIT tenía longitud completa y el usuario modifica/borra un dígito,
      // limpiar Razón Social, Dirección y C.P. SIEMPRE (hayan sido autocompletados o no).
      setForm((prev) => {
        const cuitPrevio = prev.cuit || ""
        const teniaCuitCompleto = cuitPrevio.length === LONGITUD_CUIT_COMPLETO
        const seModificoElCuit = value !== cuitPrevio
        const nuevoEstado = { ...prev, cuit: value }
        if (teniaCuitCompleto && seModificoElCuit) {
          nuevoEstado.razon = ""
          nuevoEstado.domicilio = ""
          nuevoEstado.cpostal = ""
          nuevoEstado.fantasia = ""
          // Al salir de 11 dígitos, bloquear IVA y forzar Consumidor Final
          if (opcionConsumidorFinal) {
            nuevoEstado.iva = opcionConsumidorFinal.id
          }
        }
        return nuevoEstado
      })
      // Reiniciar flags de autocompletado tras el cambio de CUIT
      setCamposAutocompletados({
        razon: false,
        fantasia: false,
        domicilio: false,
        cpostal: false,
        localidad: false,
        iva: false
      })
      // Limpiar estados/datos de ARCA para que no vuelvan a autocompletar inmediatamente
      limpiarEstadosARCA()
      // Limpiar resultado de validación del CUIT para evitar usar un estado viejo
      limpiarResultado()
      // Quitar mensaje nativo si lo había
      if (cuitInputRef.current) {
        try { cuitInputRef.current.setCustomValidity("") } catch (_) {}
      }
      return
    }

    // Actualizamos de forma inmutable manteniendo resto del estado
    setForm((f) => ({ ...f, [name]: value }))
  }, [setCamposAutocompletados, setForm, limpiarEstadosARCA, opcionConsumidorFinal, limpiarResultado])

  // Efecto: sincronizar valor de IVA según longitud de CUIT
  useEffect(() => {
    const cuitLen = String(form.cuit || '').length
    // Si no tiene 11 dígitos y existe Consumidor Final, forzar ese valor
    if (cuitLen !== LONGITUD_CUIT_COMPLETO && opcionConsumidorFinal && String(form.iva) !== String(opcionConsumidorFinal.id)) {
      setForm((prev) => ({ ...prev, iva: opcionConsumidorFinal.id }))
    }
    // Si tiene 11 dígitos y el IVA es Consumidor Final, vaciar para obligar selección
    if (cuitLen === LONGITUD_CUIT_COMPLETO && opcionConsumidorFinal && String(form.iva) === String(opcionConsumidorFinal.id)) {
      setForm((prev) => ({ ...prev, iva: "" }))
    }
  }, [form.cuit, form.iva, opcionConsumidorFinal])

  // Función para autocompletar campos con datos de ARCA
  const autocompletarCampos = useCallback((datos) => {
    if (!datos) return
    
    // Función para buscar coincidencia en opciones de FilterableSelect
    const buscarCoincidencia = (valor, opciones) => {
      if (!valor || !opciones || !Array.isArray(opciones)) return null
      
      // Buscar coincidencia exacta (case-insensitive)
      let encontrada = opciones.find(opt => 
        opt.nombre && opt.nombre.toLowerCase() === valor.toLowerCase()
      )
      
      if (encontrada) return encontrada
      
      // Si no hay coincidencia exacta, buscar coincidencia parcial
      encontrada = opciones.find(opt => 
        opt.nombre && opt.nombre.toLowerCase().includes(valor.toLowerCase())
      )
      
      return encontrada
    }
    
    // Mapeo de tipos de IVA de ARCA a nombres de BD
    const mapearTipoIVA = (descripcionARCA) => {
      const mapeo = {
        "IVA": "Responsable Inscripto",
        "IVA EXENTO": "Sujeto Exento", 
        "MONOTRIBUTO": "Responsable Monotributo",
        "MONOTRIBUTO SOCIAL": "Monotributo Social",
        "MONOTRIBUTO TRABAJADOR": "Monotributo Trabajador"
      }
      return mapeo[descripcionARCA] || descripcionARCA
    }
    
    setForm(prev => {
      const nuevosDatos = { ...prev }
      const nuevosCamposAutocompletados = { ...camposAutocompletados }
      
      // Campos de texto simple (autocompletado directo - SIEMPRE sobreescribir)
      if (datos.razon) {
        nuevosDatos.razon = datos.razon
        nuevosCamposAutocompletados.razon = true
      }
      if (datos.fantasia) {
        nuevosDatos.fantasia = datos.fantasia
        nuevosCamposAutocompletados.fantasia = true
      }
      if (datos.domicilio) {
        nuevosDatos.domicilio = datos.domicilio
        nuevosCamposAutocompletados.domicilio = true
      }
      if (datos.cpostal) {
        nuevosDatos.cpostal = datos.cpostal
        nuevosCamposAutocompletados.cpostal = true
      }
      
      // Campos FilterableSelect (buscar coincidencias - SIEMPRE sobreescribir)
      if (datos.localidad) {
        const localidadEncontrada = buscarCoincidencia(datos.localidad, localidades)
        if (localidadEncontrada) {
          nuevosDatos.localidad = localidadEncontrada.id
          nuevosCamposAutocompletados.localidad = true
        }
      }
      
      if (datos.condicion_iva) {
        const nombreMapeado = mapearTipoIVA(datos.condicion_iva)
        const tipoIVAEncontrado = buscarCoincidencia(nombreMapeado, tiposIVA)
        if (tipoIVAEncontrado) {
          nuevosDatos.iva = tipoIVAEncontrado.id
          nuevosCamposAutocompletados.iva = true
        }
      }
      
      // Actualizar el estado de campos autocompletados
      setCamposAutocompletados(nuevosCamposAutocompletados)
      
      return nuevosDatos
    })
  }, [localidades, tiposIVA, camposAutocompletados, setForm, setCamposAutocompletados])

  // Mantener una referencia estable a la función de autocompletado para evitar dependencias en efectos
  const autocompletarCamposRef = useRef(autocompletarCampos)
  useEffect(() => { autocompletarCamposRef.current = autocompletarCampos }, [autocompletarCampos])

  // Efecto para autocompletar cuando llegan datos de ARCA
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (datosARCA && !errorARCA) {
      const lenCuit = String(cuitActualRef.current || '').length
      if (lenCuit !== LONGITUD_CUIT_COMPLETO) {
        return
      }
      autocompletarCamposRef.current(datosARCA)
      
      // Limpiar el mensaje de éxito después de 3 segundos
      const timer = setTimeout(() => {
        limpiarEstadosARCA()
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [datosARCA, errorARCA, limpiarEstadosARCA])

  // ----- Modal para agregar entidades relacionales -----
  const openAddModal = (type) => {
    setModal({ type, open: true })
    setModalForm({})
    setError("")
  }
  const closeModal = () => {
    setModal(null)
    setModalForm({})
    setError("")
  }

  const handleAddModalSave = async (values) => {
    setModalLoading(true)
    try {
      let url = ""
      let body = {}
      let setList = null
      const currentForm = values || modalForm
      switch (modal.type) {
        case "barrio":
          url = "/api/clientes/barrios/"
          body = { nombre: currentForm.nombre, activo: currentForm.activo || "S" }
          setList = setBarrios
          break
        case "localidad":
          url = "/api/clientes/localidades/"
          body = { nombre: currentForm.nombre, activo: currentForm.activo || "S" }
          setList = setLocalidades
          break
        case "provincia":
          url = "/api/clientes/provincias/"
          body = { nombre: currentForm.nombre, activo: currentForm.activo || "S" }
          setList = setProvincias
          break
        case "transporte":
          url = "/api/clientes/transportes/"
          body = { nombre: currentForm.nombre, localidad: currentForm.localidad, activo: currentForm.activo || "S" }
          setList = setTransportes
          break
        case "plazo":
          url = "/api/clientes/plazos/"
          body = { nombre: currentForm.nombre, activo: currentForm.activo || "S" }
          for (let i = 1; i <= 12; i += 1) {
            const keyPlazo = `pla_pla${i}`
            const keyPorcentaje = `pla_por${i}`
            if (Object.prototype.hasOwnProperty.call(currentForm, keyPlazo)) {
              body[keyPlazo] = currentForm[keyPlazo]
            }
            if (Object.prototype.hasOwnProperty.call(currentForm, keyPorcentaje)) {
              body[keyPorcentaje] = currentForm[keyPorcentaje]
            }
          }
          setList = setPlazos
          break
        case "categoria":
          url = "/api/clientes/categorias/"
          body = { nombre: currentForm.nombre, activo: currentForm.activo || "S" }
          setList = setCategorias
          break
        default:
          setModalLoading(false)
          return
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") },
        credentials: "include",
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Error al crear")
      // Refrescar la lista
      const data = await fetch(url).then((r) => r.json())
      setList(Array.isArray(data) ? data : data.results || [])
      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setModalLoading(false)
    }
  }

  // Importante: NO limpiar borrador al desmontar (cambio de pestañas)
  // La limpieza se hace en Cancelar o al cerrar pestaña desde el manager

  // eslint-disable-next-line no-unused-vars
  const renderModalForm = () => {
    switch (modal?.type) {
      case "barrio":
        return (
          <>
            <label className="block mb-2 text-slate-700 font-medium">Nombre *</label>
            <input
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.nombre || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Activo</label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.activo || "S"}
              onChange={(e) => setModalForm((f) => ({ ...f, activo: e.target.value }))}
            >
              <option value="S">Sí</option>
              <option value="N">No</option>
            </select>
          </>
        )
      case "localidad":
        return (
          <>
            <label className="block mb-2 text-slate-700 font-medium">Nombre *</label>
            <input
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.nombre || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Activo</label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.activo || "S"}
              onChange={(e) => setModalForm((f) => ({ ...f, activo: e.target.value }))}
            >
              <option value="S">Sí</option>
              <option value="N">No</option>
            </select>
          </>
        )
      case "provincia":
        return (
          <>
            <label className="block mb-2 text-slate-700 font-medium">Nombre *</label>
            <input
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.nombre || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Activo</label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.activo || "S"}
              onChange={(e) => setModalForm((f) => ({ ...f, activo: e.target.value }))}
            >
              <option value="S">Sí</option>
              <option value="N">No</option>
            </select>
          </>
        )
      case "transporte":
        return (
          <>
            <label className="block mb-2 text-slate-700 font-medium">Nombre *</label>
            <input
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.nombre || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Localidad *</label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.localidad || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, localidad: e.target.value }))}
              required
            >
              <option value="">Seleccionar...</option>
              {localidades.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
            <label className="block mb-2 text-slate-700 font-medium">Activo</label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.activo || "S"}
              onChange={(e) => setModalForm((f) => ({ ...f, activo: e.target.value }))}
            >
              <option value="S">Sí</option>
              <option value="N">No</option>
            </select>
          </>
        )
      case "plazo":
        return (
          <>
            <label className="block mb-2 text-slate-700 font-medium">Nombre *</label>
            <input
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.nombre || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            {[...Array(12)].map((_, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <div className="flex-1">
                  <label className="block text-xs text-slate-600">Plazo {i + 1}</label>
                  <input
                    type="number"
                    className="w-full border border-slate-300 rounded-xl px-2 py-1 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    value={modalForm[`pla_pla${i + 1}`] || ""}
                    onChange={(e) => setModalForm((f) => ({ ...f, [`pla_pla${i + 1}`]: e.target.value }))}
                    min="0"
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-600">Porcentaje {i + 1}</label>
                  <input
                    type="number"
                    className="w-full border border-slate-300 rounded-xl px-2 py-1 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    value={modalForm[`pla_por${i + 1}`] || ""}
                    onChange={(e) => setModalForm((f) => ({ ...f, [`pla_por${i + 1}`]: e.target.value }))}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>
            ))}
            <label className="block mb-2 text-slate-700 font-medium">Activo</label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.activo || "S"}
              onChange={(e) => setModalForm((f) => ({ ...f, activo: e.target.value }))}
            >
              <option value="S">Sí</option>
              <option value="N">No</option>
            </select>
          </>
        )
      case "categoria":
        return (
          <>
            <label className="block mb-2 text-slate-700 font-medium">Nombre *</label>
            <input
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.nombre || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Activo</label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.activo || "S"}
              onChange={(e) => setModalForm((f) => ({ ...f, activo: e.target.value }))}
            >
              <option value="S">Sí</option>
              <option value="N">No</option>
            </select>
          </>
        )
      default:
        return null
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Confirmación nativa antes de guardar
    const confirmar = window.confirm('¿Desea guardar los cambios del cliente?')
    if (!confirmar) {
      return
    }
    if (
      !form.razon ||
      !form.domicilio
    ) {
      if (formRef.current) {
        // Dejar que el navegador muestre la validación nativa
        formRef.current.reportValidity()
      }
      return
    }
    // Si ingresaron 11 dígitos de CUIT y el verificador es inválido, no permitir guardar
    const cuitTieneOnce = String(form.cuit || '').length === LONGITUD_CUIT_COMPLETO
    if (cuitTieneOnce && resultado && resultado.es_valido === false) {
      // Mostrar mensaje nativo en el input de CUIT
      if (cuitInputRef.current) {
        try {
          cuitInputRef.current.setCustomValidity("El CUIT ingresado es inválido.")
          cuitInputRef.current.reportValidity()
        } catch (_) {}
      }
      return
    }
    if (form.zona && form.zona.length > 10) {
      if (formRef.current) {
        // No hay input directo para zona aquí con required; mostrar mensaje general
        alert("El campo Zona no debe exceder los 10 caracteres.")
      }
      return
    }
    
    // Procesar campos antes de enviar al backend
    const processedForm = { ...form }
    
    // Convertir cadenas vacías en null para campos opcionales
    if (processedForm.fecsalcta === "") {
      processedForm.fecsalcta = null
    }
    if (processedForm.lineacred === "") {
      processedForm.lineacred = null
    }
    if (processedForm.impsalcta === "") {
      processedForm.impsalcta = null
    }
    
    setError("")
    onSave(processedForm)
  }

  return (
    <>
      <div className="w-full min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30 p-4">
        <div className="w-full max-w-none">
          <form
            className="w-full bg-white rounded-2xl shadow-md border border-slate-200/50 relative overflow-hidden"
            onSubmit={handleSubmit}
            {...getFormProps()}
          >
            {/* Gradiente decorativo superior */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.primario}`}></div>

            <div className="p-6">
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800">
                    {initialData ? "Editar Cliente" : "Nuevo Cliente"}
                  </h3>
                </div>

                {/* Mensajes de error */}
                {error && (
                  <div className="mb-3 p-3 bg-red-50 border-l-4 border-red-500 text-red-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {error}
                    </div>
                  </div>
                )}
                {/* Eliminar cualquier renderizado visual de error relacionado a apiError */}
              </div>

              {/* Header compacto con razón y chip de estado */}
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800 truncate" title={form.razon || form.fantasia}>
                  {form.razon || form.fantasia || "Nuevo Cliente"}
                  </div>
                <ChipEstado activo={form.activo === "A"} />
                </div>

              
              {/* Tarjetas horizontales al estilo del detalle */}
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                {/* Tarjeta Información Básica */}
                <SeccionLista
                  titulo="Información Básica"
                  icono={<svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                >
                  <FilaEditable etiqueta="CUIT/DNI">
                    <div className="relative h-[34px]">
                        <input
                          name="cuit"
                          value={form.cuit}
                          onChange={handleChange}
                        onBlur={(e) => { if (!initialData) { handleCUITBlur(e.target.value) } }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !initialData) { handleCUITBlur(e.target.value) } }}
                          maxLength={11}
                        className={`${CLASES_INPUT} h-full pr-8`}
                        ref={cuitInputRef}
                          disabled={!!initialData}
                        />
                        <div className="absolute top-0 right-2 h-full flex items-center">
                          {((resultado && !isLoadingCUIT && !errorCUIT) || (errorARCA && errorARCA.trim() !== '')) ? (
                            <button
                              type="button"
                              onClick={toggleTooltip}
                            className={`transition-colors ${((errorARCA && errorARCA.trim() !== '') || (resultado && !resultado.es_valido)) ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                            title={((errorARCA && errorARCA.trim() !== '') || (resultado && !resultado.es_valido)) ? 'Error en CUIT/ARCA' : 'CUIT válido'}
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              {((errorARCA && errorARCA.trim() !== '') || (resultado && !resultado.es_valido)) ? (
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              ) : (
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                )}
                              </svg>
                            </button>
                        ) : (<div className="w-4 h-4"></div>)}
                        </div>
                          {(resultado || (errorARCA && errorARCA.trim() !== '')) && (
                          <CUITValidacionTooltip resultado={resultado} onIgnorar={limpiarResultado} isLoading={isLoadingCUIT} error={errorCUIT} mostrarTooltip={mostrarTooltip} onToggle={toggleTooltip} errorARCA={errorARCA} />
                        )}
                      </div>
                  </FilaEditable>
                  <FilaEditable etiqueta="Tipo IVA">
                    <select
                      name="iva"
                      value={form.iva || ""}
                      onChange={handleChange}
                      className={CLASES_INPUT}
                      disabled={String(form.cuit || '').length !== LONGITUD_CUIT_COMPLETO}
                    >
                      {String(form.cuit || '').length === LONGITUD_CUIT_COMPLETO ? (
                        <>
                          <option value="">Seleccionar...</option>
                          {opcionesIVAVisibles.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.nombre}</option>
                          ))}
                        </>
                      ) : (
                        opcionConsumidorFinal && (
                          <option value={opcionConsumidorFinal.id}>{opcionConsumidorFinal.nombre}</option>
                        )
                      )}
                    </select>
                  </FilaEditable>
                  <FilaEditable etiqueta="Razón Social *" inputProps={{ name: "razon", required: true, disabled: camposAutocompletados.razon || String(form.cuit || '').length === LONGITUD_CUIT_COMPLETO, className: `${CLASES_INPUT}` }} value={form.razon} onChange={handleChange} />
                  <FilaEditable etiqueta="Nombre Comercial" inputProps={{ name: "fantasia" }} value={form.fantasia} onChange={handleChange} />
                  <FilaEditable etiqueta="IB" inputProps={{ name: "ib", maxLength: 10 }} value={form.ib} onChange={handleChange} />
                  <FilaEditable etiqueta="Estado">
                    <select name="activo" value={form.activo} onChange={handleChange} className={CLASES_INPUT}>
                      <option value="A">Activo</option>
                      <option value="I">Inactivo</option>
                    </select>
                  </FilaEditable>
                </SeccionLista>

                {/* Tarjeta Contacto */}
                <SeccionLista
                  titulo="Contacto"
                  icono={<svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
                >
                  <FilaEditable etiqueta="Teléfono 1" inputProps={{ name: "tel1" }} value={form.tel1} onChange={handleChange} />
                  <FilaEditable etiqueta="Teléfono 2" inputProps={{ name: "tel2" }} value={form.tel2} onChange={handleChange} />
                  <FilaEditable etiqueta="Email" inputProps={{ name: "email", type: "email" }} value={form.email} onChange={handleChange} />
                  <FilaEditable etiqueta="Contacto" inputProps={{ name: "contacto" }} value={form.contacto} onChange={handleChange} />
                </SeccionLista>

                {/* Tarjeta Ubicación */}
                <SeccionLista
                  titulo="Ubicación y Relaciones"
                  icono={<svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                >
                  <FilaEditable etiqueta="Dirección" inputProps={{ name: "domicilio", required: true }} value={form.domicilio} onChange={handleChange} />
                  <FilaEditable etiqueta="Zona" inputProps={{ name: "zona", maxLength: 10 }} value={form.zona} onChange={handleChange} />
                  <FilaEditable etiqueta="Localidad" onAdd={() => openAddModal('localidad')}>
                    <FilterableSelect compact={true} label={null} name="localidad" options={opcionesLocalidades} value={form.localidad} onChange={handleChange} placeholder="Buscar localidad..." />
                  </FilaEditable>
                  <FilaEditable etiqueta="C.P." inputProps={{ name: "cpostal" }} value={form.cpostal} onChange={handleChange} />
                  {/* Relaciones integradas */}
                  <FilaEditable etiqueta="Barrio" onAdd={() => openAddModal('barrio')}>
                    <FilterableSelect compact={true} label={null} name="barrio" options={opcionesBarrios} value={form.barrio} onChange={handleChange} placeholder="Buscar barrio..." />
                  </FilaEditable>
                  <FilaEditable etiqueta="Provincia" onAdd={() => openAddModal('provincia')}>
                    <FilterableSelect compact={true} label={null} name="provincia" options={opcionesProvincias} value={form.provincia} onChange={handleChange} placeholder="Buscar provincia..." />
                  </FilaEditable>
                  <FilaEditable etiqueta="Transporte" onAdd={() => openAddModal('transporte')}>
                    <FilterableSelect compact={true} label={null} name="transporte" options={opcionesTransportes} value={form.transporte} onChange={handleChange} placeholder="Buscar transporte..." />
                  </FilaEditable>
                  <FilaEditable etiqueta="Plazo" onAdd={() => openAddModal('plazo')}>
                    <FilterableSelect compact={true} label={null} name="plazo" options={opcionesPlazos} value={form.plazo} onChange={handleChange} placeholder="Buscar plazo..." />
                  </FilaEditable>
                </SeccionLista>

                {/* Tarjeta Comercial */}
                <SeccionLista
                  titulo="Comercial"
                  icono={<svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2" /></svg>}
                >
                  <FilaEditable etiqueta="Vendedor">
                    <FilterableSelect compact={true} label={null} name="vendedor" options={vendedores} value={form.vendedor} onChange={handleChange} placeholder="Buscar vendedor..." />
                  </FilaEditable>
                  <FilaEditable etiqueta="Categoría" onAdd={() => openAddModal('categoria')}>
                    <FilterableSelect compact={true} label={null} name="categoria" options={opcionesCategorias} value={form.categoria} onChange={handleChange} placeholder="Buscar categoría..." />
                  </FilaEditable>
                  <FilaEditable etiqueta="Línea Crédito" inputProps={{ name: "lineacred", type: "number", min: 0 }} value={form.lineacred} onChange={handleChange} />
                  <FilaEditable etiqueta="Descuentos">
                    <div className="w-[180px] grid grid-cols-2 gap-2">
                      <input className={CLASES_INPUT} name="descu1" value={form.descu1 || ""} onChange={handleChange} placeholder="%1" />
                      <input className={CLASES_INPUT} name="descu2" value={form.descu2 || ""} onChange={handleChange} placeholder="%2" />
                  </div>
                  </FilaEditable>
                </SeccionLista>
              </div>

              {/* Comentario separado */}
              {form.comentario && (
                <div className="mt-4">
                  <TarjetaCampo etiqueta="Comentario">
                    <textarea name="comentario" value={form.comentario} onChange={handleChange} rows={2} className={`${CLASES_INPUT} h-16 resize-none`} />
                  </TarjetaCampo>
                  </div>
              )}

              {/* Botones de acción */}
              <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const confirmar = window.confirm('¿Desea cancelar y descartar los cambios?')
                    if (!confirmar) return
                    try {
                      localStorage.removeItem(claveBorradorCliente)
                      if (claveAnteriorRef.current && claveAnteriorRef.current !== claveBorradorCliente) {
                        localStorage.removeItem(claveAnteriorRef.current)
                      }
                    } catch (_) {}
                    onCancel()
                  }}
                  className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-300 font-medium shadow-sm hover:shadow-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 font-semibold shadow-lg hover:shadow-xl"
                >
                  {initialData ? "Actualizar Cliente" : "Crear Cliente"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Modal para alta de entidades relacionales (modularizado) */}
      {modal?.open && (
        <MaestroModal
          open={modal.open}
          tipo={modal.type}
          modo="nuevo"
          initialValues={modalForm}
          localidades={localidades}
          loading={modalLoading}
          error={error}
          onCancel={closeModal}
          onSubmit={(values) => handleAddModalSave(values)}
        />
      )}
    </>
  )
}

export default ClienteForm;




