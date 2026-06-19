"use client"

import { useEffect, useState, useCallback } from "react"
import Navbar from "./Navbar"
import { useFerreDeskTheme } from "../hooks/useFerreDeskTheme"
import Tabla from "./Tabla"
import { BotonEditar } from "./Botones"
import ModernFileInput from "./ModernFileInput"
import ConfirmacionPeligroModal from "./ConfirmacionPeligroModal"
import { toast } from "react-toastify"
import { Building2, Receipt, Settings2, FileKey2, Save, Loader2 } from "lucide-react"

// Hooks de catálogos de Clientes (reutilizamos exactamente los mismos)
import { useBarriosAPI } from "../utils/useBarriosAPI"
import { useLocalidadesAPI } from "../utils/useLocalidadesAPI"
import { useProvinciasAPI } from "../utils/useProvinciasAPI"
import { useTransportesAPI } from "../utils/useTransportesAPI"
import { usePlazosAPI } from "../utils/usePlazosAPI"
import { useCategoriasAPI } from "../utils/useCategoriasAPI"
import MaestroModal from "./Clientes/MaestrosModales"
import { clienteAPI } from "../utils/clienteAPI"
import { useLogoutMutation } from "../domains/session/useLogoutMutation"
import { useSessionUserQuery } from "../domains/session/useSessionUserQuery"

// Estilos de campos claros consistentes con FerreDesk (ClientesManager)
const CLASES_INPUT = "w-full text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-2.5 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-400"
const CLASES_SELECT = "w-full text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-400"

// Pestaña: Información del Negocio
const InformacionNegocio = ({ config, onConfigChange, loading, onSave, saving }) => {
  const theme = useFerreDeskTheme()
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Building2 className="text-orange-600" size={24} />
        Información del Negocio
      </h3>

      <div className="space-y-4">
        <div className="flex items-center border-b border-slate-200 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Nombre del Negocio <span className="text-red-500">*</span>
          </label>
          <div className="w-2/3">
            <input
              type="text"
              value={config.nombre || ""}
              onChange={(e) => onConfigChange("nombre", e.target.value)}
              className={CLASES_INPUT}
              placeholder="Ej: Ferretería Central"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex items-center border-b border-slate-200 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Dirección <span className="text-red-500">*</span>
          </label>
          <div className="w-2/3">
            <input
              type="text"
              value={config.direccion || ""}
              onChange={(e) => onConfigChange("direccion", e.target.value)}
              className={CLASES_INPUT}
              placeholder="Ej: Av. San Martín 123"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex items-center border-b border-slate-200 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Teléfono <span className="text-red-500">*</span>
          </label>
          <div className="w-2/3">
            <input
              type="tel"
              value={config.telefono || ""}
              onChange={(e) => onConfigChange("telefono", e.target.value)}
              className={CLASES_INPUT}
              placeholder="Ej: 011-1234-5678"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex items-center border-b border-slate-200 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Email
          </label>
          <div className="w-2/3">
            <input
              type="email"
              value={config.email || ""}
              onChange={(e) => onConfigChange("email", e.target.value)}
              className={CLASES_INPUT}
              placeholder="Ej: info@ferreteria.com"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6 mt-2">
        <button onClick={() => onSave("negocio")} disabled={saving} className={`flex items-center gap-2 ${theme.botonPrimario}`}>
          {saving ? <><Loader2 className="animate-spin" size={18}/> Guardando...</> : <><Save size={18}/> Guardar Sección</>}
        </button>
      </div>
    </div>
  )
}

// Pestaña: Configuración Fiscal
const ConfiguracionFiscal = ({ config, onConfigChange, loading, onSave, saving }) => {
  const theme = useFerreDeskTheme()
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Receipt className="text-orange-600" size={24} />
        Configuración Fiscal
      </h3>

      <div className="space-y-4">
        <div className="flex items-center border-b border-slate-200 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Situación Fiscal <span className="text-red-500">*</span>
          </label>
          <div className="w-2/3">
            <select
              value={config.situacion_iva || "RI"}
              onChange={(e) => onConfigChange("situacion_iva", e.target.value)}
              className={CLASES_SELECT}
              disabled={loading}
            >
              <option value="RI">Responsable Inscripto</option>
              <option value="MO">Monotributista</option>
            </select>
          </div>
        </div>

        <div className="flex items-center border-b border-slate-200 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            CUIT/CUIL
          </label>
          <div className="w-2/3">
            <input
              type="text"
              value={config.cuit_cuil || ""}
              onChange={(e) => onConfigChange("cuit_cuil", e.target.value)}
              className={CLASES_INPUT}
              placeholder="Ej: 20-12345678-9"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex items-center border-b border-slate-200 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Razón Social
          </label>
          <div className="w-2/3">
            <input
              type="text"
              value={config.razon_social || ""}
              onChange={(e) => onConfigChange("razon_social", e.target.value)}
              className={CLASES_INPUT}
              placeholder="Ej: FERRETERÍA CENTRAL S.A."
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex items-center border-b border-slate-200 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Ingresos Brutos
          </label>
          <div className="w-2/3">
            <input
              type="text"
              value={config.ingresos_brutos || ""}
              onChange={(e) => onConfigChange("ingresos_brutos", e.target.value)}
              className={CLASES_INPUT}
              placeholder="Ej: 901-123456-7"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex items-center border-b border-slate-200 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Logo de la Empresa
          </label>
          <div className="w-2/3">
            <ModernFileInput 
              label="Seleccionar imagen"
              helperText="PNG o JPG, max. 2 MB"
              accept="image/*"
              currentFile={config.logo_empresa_file || (config.logo_empresa ? { name: "Logo actual cargado" } : null)}
              onChange={(file) => {
                onConfigChange("logo_empresa_file", file);
                onConfigChange("logo_empresa", URL.createObjectURL(file));
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6 mt-2">
        <button onClick={() => onSave("fiscal")} disabled={saving} className={`flex items-center gap-2 ${theme.botonPrimario}`}>
          {saving ? <><Loader2 className="animate-spin" size={18}/> Guardando...</> : <><Save size={18}/> Guardar Sección</>}
        </button>
      </div>
    </div>
  )
}

const Notificaciones = ({ config, onConfigChange, loading, onSave, saving }) => {
  const theme = useFerreDeskTheme()
  const handleToggle = (field) => {
    onConfigChange(field, !config[field])
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-orange-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        Notificaciones
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="w-1/3">
            <h5 className="font-semibold text-slate-700">Stock Bajo</h5>
            <p className="text-sm text-slate-500">Notificar cuando los productos tengan stock bajo</p>
          </div>
          <div className="w-2/3 flex justify-end">
            <button
              onClick={() => handleToggle("notificaciones_stock_bajo")}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${config.notificaciones_stock_bajo ? "bg-orange-600" : "bg-slate-300"
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.notificaciones_stock_bajo ? "translate-x-6" : "translate-x-1"
                  }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6 mt-2">
        <button onClick={() => onSave("notificaciones")} disabled={saving} className={`flex items-center gap-2 ${theme.botonPrimario}`}>
          {saving ? <><Loader2 className="animate-spin" size={18}/> Guardando...</> : <><Save size={18}/> Guardar Sección</>}
        </button>
      </div>
    </div>
  )
}

// Pestaña: Configuración de Sistema
const ConfiguracionSistema = ({ config, onConfigChange, loading, onSave, saving }) => {
  const theme = useFerreDeskTheme()
  const handleToggle = (field) => {
    onConfigChange(field, !config[field])
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Settings2 className="text-orange-600" size={24} />
        Configuración de Sistema
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="w-1/3">
            <h5 className="font-semibold text-slate-700">Permitir Stock Negativo</h5>
            <p className="text-sm text-slate-500">Permitir que los productos tengan stock negativo</p>
          </div>
          <div className="w-2/3 flex justify-end">
            <button
              onClick={() => handleToggle("permitir_stock_negativo")}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${config.permitir_stock_negativo ? "bg-orange-600" : "bg-slate-300"
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.permitir_stock_negativo ? "translate-x-6" : "translate-x-1"
                  }`}
              />
            </button>
          </div>
        </div>

        {/* Códigos de Barras */}
        <div className="flex items-center border-b border-slate-200 pb-3">
          <div className="w-1/3">
            <h5 className="font-semibold text-slate-700">Prefijo Códigos de Barras</h5>
            <p className="text-sm text-slate-500">Siglas para códigos (ej: ABC)</p>
          </div>
          <div className="w-2/3">
            <input
              type="text"
              value={config.prefijo_codigo_barras || ""}
              onChange={(e) => onConfigChange("prefijo_codigo_barras", e.target.value.toUpperCase())}
              className={`${CLASES_INPUT} max-w-[200px] uppercase`}
              placeholder="Ej: ABC"
              maxLength={10}
              disabled={loading}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              {config.prefijo_codigo_barras
                ? `Los códigos se generarán como: ${config.prefijo_codigo_barras}-00000001`
                : "Si está vacío, se generará solo el número: 00000001"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6 mt-2">
        <button onClick={() => onSave("sistema")} disabled={saving} className={`flex items-center gap-2 ${theme.botonPrimario}`}>
          {saving ? <><Loader2 className="animate-spin" size={18}/> Guardando...</> : <><Save size={18}/> Guardar Sección</>}
        </button>
      </div>
    </div>
  )
}

// Pestaña: Configuración ARCA
const ConfiguracionARCA = ({ config, onConfigChange, loading, onSave, saving }) => {
  const theme = useFerreDeskTheme()
  const handleFileChange = (field, file) => {
    onConfigChange(field, file)
  }
  const permiteHomologacionUI = config.arca_permitir_homologacion_ui === true

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
        <FileKey2 className="text-orange-600" size={24} />
        Configuración ARCA
      </h3>

      <div className="space-y-4">
        {/* Estado de configuración */}
        {config.arca_configurado && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
            <FileKey2 size={20} className="text-emerald-600" />
            <span className="text-sm font-semibold">Configuración ARCA válida</span>
          </div>
        )}

        {config.arca_error_configuracion && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <span className="text-sm font-semibold">{config.arca_error_configuracion}</span>
          </div>
        )}
        <div className="flex items-center border-b border-slate-200 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Punto de Venta
          </label>
          <div className="w-2/3">
            <input
              type="text"
              value={config.punto_venta_arca || ""}
              onChange={(e) => onConfigChange("punto_venta_arca", e.target.value)}
              className={CLASES_INPUT}
              placeholder="Ej: 0001"
              disabled={loading}
            />
          </div>
        </div>
        {permiteHomologacionUI && (
          <div className="flex items-center border-b border-slate-200 pb-3">
            <label className="w-1/3 text-sm font-medium text-slate-700">
              Modo ARCA
            </label>
            <div className="w-2/3">
              <select
                value={config.modo_arca || "HOM"}
                onChange={(e) => onConfigChange("modo_arca", e.target.value)}
                className={CLASES_SELECT}
                disabled={loading}
              >
                <option value="HOM">Homologación (Pruebas)</option>
                <option value="PROD">Producción</option>
              </select>
            </div>
          </div>
        )}
        <div className="flex items-center border-b border-slate-200 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Certificado (.pem) <span className="text-red-500">*</span>
          </label>
          <div className="w-2/3">
            <ModernFileInput 
              label="Seleccionar certificado"
              helperText="Solo archivos .pem"
              accept=".pem"
              currentFile={config.certificado_arca_file || (config.certificado_arca ? { name: "Certificado actual cargado" } : null)}
              onChange={(file) => handleFileChange("certificado_arca_file", file)}
            />
          </div>
        </div>

        <div className="flex items-center border-b border-slate-200 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Clave Privada (.pem) <span className="text-red-500">*</span>
          </label>
          <div className="w-2/3">
            <ModernFileInput 
              label="Seleccionar clave"
              helperText="Solo archivos .pem"
              accept=".pem"
              currentFile={config.clave_privada_arca_file || (config.clave_privada_arca ? { name: "Clave privada actual cargada" } : null)}
              onChange={(file) => handleFileChange("clave_privada_arca_file", file)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6 mt-2">
        <button onClick={() => onSave("arca")} disabled={saving} className={`flex items-center gap-2 ${theme.botonPrimario}`}>
          {saving ? <><Loader2 className="animate-spin" size={18}/> Guardando...</> : <><Save size={18}/> Guardar Sección</>}
        </button>
      </div>
    </div>
  )
}

const ConfiguracionManager = () => {
  // Hook del tema de FerreDesk
  const theme = useFerreDeskTheme()

  const { user } = useSessionUserQuery()
  const { logout } = useLogoutMutation()
  const [config, setConfig] = useState({})
  const [loading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("negocio")
  const [originalConfig, setOriginalConfig] = useState({})
  const [modalSeguridad, setModalSeguridad] = useState({ open: false, mensaje: "", onConfirm: null })

  // --------- Estado y lógica de Maestros (Clientes) movido desde ClientesManager ---------
  const { barrios, setBarrios, fetchBarrios } = useBarriosAPI()
  const { localidades, setLocalidades, fetchLocalidades } = useLocalidadesAPI()
  const { provincias, setProvincias, fetchProvincias } = useProvinciasAPI()
  const { transportes, setTransportes, fetchTransportes } = useTransportesAPI()
  const { plazos, setPlazos, fetchPlazos } = usePlazosAPI()
  const { categorias, setCategorias, fetchCategorias } = useCategoriasAPI()

  const [catalogoSeleccionado, setCatalogoSeleccionado] = useState("categorias")
  const [searchMaestros, setSearchMaestros] = useState("")
  const [ocultarInactivos, setOcultarInactivos] = useState(true)
  const [modalMaestro, setModalMaestro] = useState({ open: false, tipo: null, modo: null, data: null })
  const [modalForm, setModalForm] = useState({})
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState("")
  const esAdminTenant = user?.es_admin_tenant === true || user?.tipo_usuario === "admin"

  const obtenerColeccionActual = () => {
    switch (catalogoSeleccionado) {
      case "barrios":
        return { datos: barrios, fetch: fetchBarrios, set: setBarrios, url: "/api/clientes/barrios/", tipo: "barrio" }
      case "localidades":
        return { datos: localidades, fetch: fetchLocalidades, set: setLocalidades, url: "/api/clientes/localidades/", tipo: "localidad" }
      case "provincias":
        return { datos: provincias, fetch: fetchProvincias, set: setProvincias, url: "/api/clientes/provincias/", tipo: "provincia" }
      case "transportes":
        return { datos: transportes, fetch: fetchTransportes, set: setTransportes, url: "/api/clientes/transportes/", tipo: "transporte" }
      case "plazos":
        return { datos: plazos, fetch: fetchPlazos, set: setPlazos, url: "/api/clientes/plazos/", tipo: "plazo" }
      case "categorias":
      default:
        return { datos: categorias, fetch: fetchCategorias, set: setCategorias, url: "/api/clientes/categorias/", tipo: "categoria" }
    }
  }

  const abrirModalNuevo = () => {
    const { tipo } = obtenerColeccionActual()
    setModalForm({})
    setModalError("")
    setModalMaestro({ open: true, tipo, modo: "nuevo", data: null })
  }

  const abrirModalEditar = (fila) => {
    const { tipo } = obtenerColeccionActual()
    setModalForm({ ...fila })
    setModalError("")
    setModalMaestro({ open: true, tipo, modo: "editar", data: fila })
  }

  const cerrarModal = () => {
    setModalMaestro({ open: false, tipo: null, modo: null, data: null })
    setModalForm({})
    setModalError("")
  }

  const guardarModal = async (values) => {
    const { url, fetch: refetchColeccion, tipo } = obtenerColeccionActual()
    setModalLoading(true)
    setModalError("")
    try {
      const esEdicion = modalMaestro.modo === "editar"
      const endpoint = esEdicion ? `${url}${modalMaestro?.data?.id || ""}/` : url
      let body = {}
      switch (tipo) {
        case "barrio":
          body = { nombre: (values?.nombre ?? modalForm.nombre), activo: (values?.activo ?? modalForm.activo) || "S" }
          break
        case "localidad":
          body = { nombre: (values?.nombre ?? modalForm.nombre), activo: (values?.activo ?? modalForm.activo) || "S" }
          break
        case "provincia":
          body = { nombre: (values?.nombre ?? modalForm.nombre), activo: (values?.activo ?? modalForm.activo) || "S" }
          break
        case "transporte":
          body = { nombre: (values?.nombre ?? modalForm.nombre), localidad: (values?.localidad ?? modalForm.localidad), activo: (values?.activo ?? modalForm.activo) || "S" }
          break
        case "plazo": {
          const fuente = values || modalForm
          body = { nombre: fuente.nombre, activo: fuente.activo || "S" }
          for (let i = 1; i <= 12; i += 1) {
            const keyPlazo = `pla_pla${i}`
            const keyPorcentaje = `pla_por${i}`
            if (Object.prototype.hasOwnProperty.call(fuente, keyPlazo)) {
              body[keyPlazo] = fuente[keyPlazo]
            }
            if (Object.prototype.hasOwnProperty.call(fuente, keyPorcentaje)) {
              body[keyPorcentaje] = fuente[keyPorcentaje]
            }
          }
          break
        }
        case "categoria":
          body = { nombre: (values?.nombre ?? modalForm.nombre), activo: (values?.activo ?? modalForm.activo) || "S" }
          break
        default:
          break
      }

      await clienteAPI(endpoint, {
        method: esEdicion ? "PATCH" : "POST",
        body,
      })
      await refetchColeccion()
      cerrarModal()
    } catch (e) {
      setModalError(e.message || "Error al guardar")
    } finally {
      setModalLoading(false)
    }
  }

  useEffect(() => {
    document.title = "Configuración FerreDesk"
  }, [])

  useEffect(() => {
    // Cargar configuración
    fetch("/api/ferreteria/", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setConfig(data)
          setOriginalConfig(data)
        }
      })
      .catch((error) => {
        console.error("Error cargando configuración:", error)
        toast.error("Error al cargar la configuración")
      })
  }, [])

  const handleConfigChange = useCallback((field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }, [])

  const handleSave = async () => {
    setSaving(true)

    try {
      // Validar que los archivos no estén vacíos
      if (config.certificado_arca_file && config.certificado_arca_file.size === 0) {
        toast.error("Error: El archivo de certificado seleccionado está vacío.");
        setSaving(false);
        return;
      }
      if (config.clave_privada_arca_file && config.clave_privada_arca_file.size === 0) {
        toast.error("Error: El archivo de clave privada seleccionado está vacío.");
        setSaving(false);
        return;
      }

      // Preparar datos para envío
      const formData = new FormData()

      // Agregar todos los campos de configuración excepto archivos
      Object.keys(config).forEach(key => {
        if (key !== 'logo_empresa_file' && key !== 'logo_empresa' &&
          key !== 'certificado_arca_file' && key !== 'certificado_arca' &&
          key !== 'clave_privada_arca_file' && key !== 'clave_privada_arca' &&
          key !== 'no_configurada' &&
          key !== 'setup_completo' &&
          key !== 'campos_setup_faltantes' &&
          key !== 'tiene_certificado_arca' &&
          key !== 'tiene_clave_privada_arca' &&
          key !== 'arca_permitir_homologacion_ui') {
          if (config[key] !== null && config[key] !== undefined) {
            formData.append(key, config[key])
          }
        }
      })

      // Agregar el archivo del logo si existe
      if (config.logo_empresa_file) {
        formData.append('logo_empresa', config.logo_empresa_file)
      }

      // Agregar archivos ARCA si existen
      if (config.certificado_arca_file) {
        formData.append('certificado_arca', config.certificado_arca_file)
      }

      if (config.clave_privada_arca_file) {
        formData.append('clave_privada_arca', config.clave_privada_arca_file)
      }

      const data = await clienteAPI("/api/ferreteria/", {
        method: "PATCH",
        // NO incluir Content-Type, dejar que el navegador lo establezca automáticamente para FormData
        body: formData,
      })

      setConfig(data)
      setOriginalConfig(data) // Actualizar copia original

      toast.success("Configuración guardada correctamente")
    } catch (error) {
      console.error("Error guardando configuración:", error)
      toast.error("Error al guardar la configuración")
    } finally {
      setSaving(false)
      setModalSeguridad({ open: false, mensaje: "", onConfirm: null })
    }
  }

  const handleGuardarClick = (seccion) => {
    if (seccion === 'fiscal') {
      if (config.cuit_cuil !== originalConfig.cuit_cuil) {
        setModalSeguridad({
          open: true,
          mensaje: "Estás a punto de modificar el CUIT de la empresa. Esto afecta la facturación electrónica.",
          onConfirm: () => handleSave()
        });
        return;
      }
    }
    
    if (seccion === 'arca') {
      if (config.certificado_arca_file || config.clave_privada_arca_file) {
        setModalSeguridad({
          open: true,
          mensaje: "Estás a punto de modificar los certificados de facturación de ARCA. Asegurate de que correspondan a tu CUIT y Punto de Venta.",
          onConfirm: () => handleSave()
        });
        return;
      }
    }
    
    handleSave();
  }

  const handleLogout = useCallback(() => {
    logout().finally(() => {
      window.location.href = "/login/"
    })
  }, [logout])

  const tabs = [
    {
      key: "negocio",
      label: "Negocio"
    },
    {
      key: "fiscal",
      label: "Fiscal"
    },
    {
      key: "sistema",
      label: "Operación"
    },
    {
      key: "arca",
      label: "ARCA"
    },
    {
      key: "maestros_clientes",
      label: "Datos Maestros"
    }
  ]

  const renderActiveTab = () => {
    // Si el usuario no es admin y está en la pestaña ARCA, redirigir a negocio
    if (activeTab === "arca" && !esAdminTenant) {
      setActiveTab("negocio")
      return <InformacionNegocio config={config} onConfigChange={handleConfigChange} loading={loading} onSave={handleGuardarClick} saving={saving} />
    }

    switch (activeTab) {
      case "negocio":
        return <InformacionNegocio config={config} onConfigChange={handleConfigChange} loading={loading} onSave={handleGuardarClick} saving={saving} />
      case "fiscal":
        return <ConfiguracionFiscal config={config} onConfigChange={handleConfigChange} loading={loading} onSave={handleGuardarClick} saving={saving} />
      case "notificaciones":
        return <Notificaciones config={config} onConfigChange={handleConfigChange} loading={loading} />
      case "sistema":
        return <ConfiguracionSistema config={config} onConfigChange={handleConfigChange} loading={loading} onSave={handleGuardarClick} saving={saving} />
      case "arca":
        return <ConfiguracionARCA config={config} onConfigChange={handleConfigChange} loading={loading} onSave={handleGuardarClick} saving={saving} />
      case "maestros_clientes": {
        const { datos } = obtenerColeccionActual()
        const datosVisibles = ocultarInactivos ? datos.filter((d) => d.activo === "S") : datos

        const columnas = [
          { id: "nombre", titulo: "Nombre" },
          {
            id: "estado",
            titulo: "Estado",
            render: (fila) => (
              <span className={`px-2 py-0.5 rounded-full text-[11px] ${fila.activo === "S" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                {fila.activo === "S" ? "Activo" : "Inactivo"}
              </span>
            ),
            align: "center",
            ancho: 120,
          },
          {
            id: "acciones",
            titulo: "Acciones",
            render: (fila) => (
              <div className="flex items-center gap-2 justify-end">
                <BotonEditar onClick={() => abrirModalEditar(fila)} />
              </div>
            ),
            align: "right",
            ancho: 100,
          },
        ]

        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-2">
                {["categorias", "provincias", "localidades", "barrios", "transportes", "plazos"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCatalogoSeleccionado(cat)}
                    className={`${catalogoSeleccionado === cat
                      ? "bg-slate-700 text-white shadow-md font-semibold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 border border-slate-200"
                      } px-4 py-2 rounded-lg transition-all text-sm`}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm text-slate-600 font-medium">
                  <input type="checkbox" checked={ocultarInactivos} onChange={(e) => setOcultarInactivos(e.target.checked)} />
                  Ocultar inactivos
                </label>
                <button onClick={abrirModalNuevo} className={theme.botonPrimario}>Nuevo</button>
              </div>
            </div>

            <Tabla
              columnas={columnas}
              datos={datosVisibles}
              valorBusqueda={searchMaestros}
              onCambioBusqueda={setSearchMaestros}
            />
          </div>
        )
      }
      default:
        return <InformacionNegocio config={config} onConfigChange={handleConfigChange} loading={loading} onSave={handleGuardarClick} saving={saving} />
    }
  }

  return (
    <div className={theme.fondo}>
      <Navbar user={user} onLogout={handleLogout} />

      <div className="py-8 px-4 relative z-10">
        <div className="max-w-[1400px] w-full mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Configuración del Sistema</h2>
          </div>

          {/* Contenedor principal estilo browser - Blanco con bordes slate */}
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200 max-w-full">
            {/* Tabs tipo browser - Encabezado oscuro azul/gris */}
            <div className="flex items-center border-b border-slate-200 px-6 pt-3 bg-gradient-to-r from-slate-800 to-slate-700">
              {tabs.map((tab) => {
                // Solo mostrar pestaña ARCA a usuarios admin
                if (tab.key === "arca" && !esAdminTenant) {
                  return null
                }

                return (
                  <div
                    key={tab.key}
                    className={`flex items-center px-5 py-3 mr-2 rounded-t-lg cursor-pointer transition-colors ${activeTab === tab.key
                      ? theme.tabActiva
                      : theme.tabInactiva
                      }`}
                    onClick={() => setActiveTab(tab.key)}
                    style={{ position: "relative", zIndex: 1 }}
                  >
                    {tab.label}
                  </div>
                )
              })}
            </div>

            <div className="p-6">
              {/* Tab Content */}
              {renderActiveTab()}
            </div>

            {/* Modal de Peligro (Confirmación Estricta) */}
            <ConfirmacionPeligroModal
              isOpen={modalSeguridad.open}
              mensaje={modalSeguridad.mensaje}
              onClose={() => setModalSeguridad({ open: false, mensaje: "", onConfirm: null })}
              onConfirm={() => {
                if (modalSeguridad.onConfirm) {
                  modalSeguridad.onConfirm();
                }
              }}
            />

            {/* Modal de Maestros */}
            {modalMaestro.open && (
              <MaestroModal
                open={modalMaestro.open}
                tipo={modalMaestro.tipo}
                modo={modalMaestro.modo}
                initialValues={modalForm}
                localidades={localidades}
                loading={modalLoading}
                error={modalError}
                onCancel={cerrarModal}
                onSubmit={(values) => guardarModal(values)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfiguracionManager 




