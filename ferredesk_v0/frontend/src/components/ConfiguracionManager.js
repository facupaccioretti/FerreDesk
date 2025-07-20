"use client"

import { useEffect, useState, useCallback } from "react"
import Navbar from "./Navbar"

// Función para obtener el valor de una cookie por nombre
function getCookie(name) {
  let cookieValue = null
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";")
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim()
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1))
        break
      }
    }
  }
  return cookieValue
}

// Componente de pestaña individual
const TabButton = ({ isActive, onClick, children, icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-6 py-4 rounded-xl transition-all duration-300 font-semibold text-sm ${
      isActive
        ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-lg"
        : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
    }`}
  >
    {icon}
    {children}
  </button>
)

// Componente de campo de formulario
const FormField = ({ label, children, required = false }) => (
  <div className="space-y-2">
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
)

// Pestaña: Información del Negocio
const InformacionNegocio = ({ config, onConfigChange, loading }) => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-blue-100/60 rounded-2xl p-6 border border-blue-200/50">
        <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v.249A2.25 2.25 0 0 0 6.75 9.349m0 0a2.25 2.25 0 0 0 2.25 2.25v.249a2.25 2.25 0 0 1-2.25 2.25H6.75a2.25 2.25 0 0 1-2.25-2.25v-.249a2.25 2.25 0 0 0 2.25-2.25Z" />
          </svg>
          Información del Negocio
        </h3>
        <p className="text-blue-700 text-sm mb-6">Configura los datos básicos de tu ferretería</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="Nombre del Negocio" required>
          <input
            type="text"
            value={config.nombre || ""}
            onChange={(e) => onConfigChange("nombre", e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            placeholder="Ej: Ferretería Central"
            disabled={loading}
          />
        </FormField>

        <FormField label="Dirección" required>
          <input
            type="text"
            value={config.direccion || ""}
            onChange={(e) => onConfigChange("direccion", e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            placeholder="Ej: Av. San Martín 123"
            disabled={loading}
          />
        </FormField>

        <FormField label="Teléfono" required>
          <input
            type="tel"
            value={config.telefono || ""}
            onChange={(e) => onConfigChange("telefono", e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            placeholder="Ej: 011-1234-5678"
            disabled={loading}
          />
        </FormField>

        <FormField label="Email">
          <input
            type="email"
            value={config.email || ""}
            onChange={(e) => onConfigChange("email", e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            placeholder="Ej: info@ferreteria.com"
            disabled={loading}
          />
        </FormField>
      </div>
    </div>
  )
}

// Pestaña: Configuración Fiscal
const ConfiguracionFiscal = ({ config, onConfigChange, loading }) => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-50 to-emerald-100/60 rounded-2xl p-6 border border-emerald-200/50">
        <h3 className="text-lg font-bold text-emerald-800 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Configuración Fiscal
        </h3>
        <p className="text-emerald-700 text-sm mb-6">Configura los parámetros fiscales y de comprobantes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="Situación Fiscal" required>
          <select
            value={config.situacion_iva || "RI"}
            onChange={(e) => onConfigChange("situacion_iva", e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            disabled={loading}
          >
            <option value="RI">Responsable Inscripto</option>
            <option value="MO">Monotributista</option>
          </select>
        </FormField>

        <FormField label="Alícuota IVA por Defecto" required>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={config.alicuota_iva_por_defecto || "21.00"}
              onChange={(e) => onConfigChange("alicuota_iva_por_defecto", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 pr-12"
              placeholder="21.00"
              disabled={loading}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
          </div>
        </FormField>

        <FormField label="Punto de Venta (ARCA)">
          <input
            type="text"
            value={config.punto_venta_arca || ""}
            onChange={(e) => onConfigChange("punto_venta_arca", e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            placeholder="Ej: 0001"
            disabled={loading}
          />
        </FormField>

        <FormField label="CUIT/CUIL">
          <input
            type="text"
            value={config.cuit_cuil || ""}
            onChange={(e) => onConfigChange("cuit_cuil", e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            placeholder="Ej: 20-12345678-9"
            disabled={loading}
          />
        </FormField>

        <FormField label="Razón Social">
          <input
            type="text"
            value={config.razon_social || ""}
            onChange={(e) => onConfigChange("razon_social", e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            placeholder="Ej: FERRETERÍA CENTRAL S.A."
            disabled={loading}
          />
        </FormField>

        <FormField label="Logo de la Empresa">
          <div className="space-y-3">
            {config.logo_empresa && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <img 
                  src={config.logo_empresa} 
                  alt="Logo actual" 
                  className="w-12 h-12 object-contain rounded"
                />
                <span className="text-sm text-slate-600">Logo actual cargado</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  // Guardar el archivo para subirlo cuando se guarde la configuración
                  onConfigChange("logo_empresa_file", file);
                  // Mostrar preview temporal
                  onConfigChange("logo_empresa", URL.createObjectURL(file));
                }
              }}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              disabled={loading}
            />
          </div>
        </FormField>
      </div>
    </div>
  )
}

// Pestaña: Notificaciones
const Notificaciones = ({ config, onConfigChange, loading }) => {
  const handleToggle = (field) => {
    onConfigChange(field, !config[field])
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-purple-100/60 rounded-2xl p-6 border border-purple-200/50">
        <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          Notificaciones
        </h3>
        <p className="text-purple-700 text-sm mb-6">Configura las notificaciones del sistema</p>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="text-base font-semibold text-slate-800 mb-4">Configuración de Notificaciones</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-slate-800">Notificaciones por Email</h5>
                <p className="text-sm text-slate-600">Recibir notificaciones importantes por correo electrónico</p>
              </div>
              <button
                onClick={() => handleToggle("notificaciones_email")}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                  config.notificaciones_email ? "bg-orange-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.notificaciones_email ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-slate-800">Stock Bajo</h5>
                <p className="text-sm text-slate-600">Notificar cuando los productos tengan stock bajo</p>
              </div>
              <button
                onClick={() => handleToggle("notificaciones_stock_bajo")}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                  config.notificaciones_stock_bajo ? "bg-orange-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.notificaciones_stock_bajo ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-slate-800">Vencimientos</h5>
                <p className="text-sm text-slate-600">Notificar vencimientos próximos de productos</p>
              </div>
              <button
                onClick={() => handleToggle("notificaciones_vencimientos")}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                  config.notificaciones_vencimientos ? "bg-orange-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.notificaciones_vencimientos ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-slate-800">Pagos Pendientes</h5>
                <p className="text-sm text-slate-600">Notificar pagos pendientes de clientes</p>
              </div>
              <button
                onClick={() => handleToggle("notificaciones_pagos_pendientes")}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                  config.notificaciones_pagos_pendientes ? "bg-orange-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.notificaciones_pagos_pendientes ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Pestaña: Configuración de Sistema
const ConfiguracionSistema = ({ config, onConfigChange, loading }) => {
  const handleToggle = (field) => {
    onConfigChange(field, !config[field])
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/60 rounded-2xl p-6 border border-indigo-200/50">
        <h3 className="text-lg font-bold text-indigo-800 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
          </svg>
          Configuración de Sistema
        </h3>
        <p className="text-indigo-700 text-sm mb-6">Configura los parámetros del sistema</p>
      </div>

      <div className="space-y-6">
        {/* Configuración de Stock */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="text-base font-semibold text-slate-800 mb-4">Configuración de Stock</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-slate-800">Permitir Stock Negativo</h5>
                <p className="text-sm text-slate-600">Permitir que los productos tengan stock negativo</p>
              </div>
              <button
                onClick={() => handleToggle("permitir_stock_negativo")}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                  config.permitir_stock_negativo ? "bg-orange-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.permitir_stock_negativo ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Configuración de Comprobantes */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="text-base font-semibold text-slate-800 mb-4">Configuración de Comprobantes</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Comprobante por Defecto" required>
              <select
                value={config.comprobante_por_defecto || "FA"}
                onChange={(e) => onConfigChange("comprobante_por_defecto", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                disabled={loading}
              >
                <option value="FA">Factura A</option>
                <option value="FB">Factura B</option>
                <option value="FC">Factura C</option>
                <option value="BA">Boleta A</option>
                <option value="BB">Boleta B</option>
                <option value="BC">Boleta C</option>
              </select>
            </FormField>

            <FormField label="Margen de Ganancia por Defecto" required>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={config.margen_ganancia_por_defecto || "30.00"}
                  onChange={(e) => onConfigChange("margen_ganancia_por_defecto", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 pr-12"
                  placeholder="30.00"
                  disabled={loading}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
              </div>
            </FormField>
          </div>
        </div>
      </div>
    </div>
  )
}

const ConfiguracionManager = () => {
  const [user, setUser] = useState(null)
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("negocio")
  const [feedback, setFeedback] = useState("")

  useEffect(() => {
    document.title = "Configuración FerreDesk"
  }, [])

  useEffect(() => {
    // Cargar datos del usuario y configuración
    fetch("/api/user/", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") setUser(data.user)
      })

    fetch("/api/ferreteria/", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setConfig(data)
        }
      })
      .catch((error) => {
        console.error("Error cargando configuración:", error)
        setFeedback("Error al cargar la configuración")
      })
  }, [])

  const handleConfigChange = useCallback((field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }, [])

  const handleSave = async () => {
    if (!user?.is_staff) {
      setFeedback("No tienes permisos para modificar la configuración")
      return
    }

    setSaving(true)
    setFeedback("")
    
    try {
      const csrftoken = getCookie("csrftoken")
      
      // Preparar datos para envío
      const formData = new FormData()
      
      // Agregar todos los campos de configuración excepto el archivo
      Object.keys(config).forEach(key => {
        if (key !== 'logo_empresa_file' && key !== 'logo_empresa') {
          if (config[key] !== null && config[key] !== undefined) {
            formData.append(key, config[key])
          }
        }
      })
      
      // Agregar el archivo del logo si existe
      if (config.logo_empresa_file) {
        formData.append('logo_empresa', config.logo_empresa_file)
      }
      
      const res = await fetch("/api/ferreteria/", {
        method: "PATCH",
        headers: {
          "X-CSRFToken": csrftoken,
          // NO incluir Content-Type, dejar que el navegador lo establezca automáticamente para FormData
        },
        credentials: "include",
        body: formData,
      })
      
      if (!res.ok) throw new Error("Error al guardar configuración")
      
      const data = await res.json()
      setConfig(data)
      setFeedback("Configuración guardada correctamente")
      
      // Limpiar feedback después de 3 segundos
      setTimeout(() => setFeedback(""), 3000)
    } catch (error) {
      console.error("Error guardando configuración:", error)
      setFeedback("Error al guardar la configuración")
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = useCallback(() => {
    setUser(null)
    window.location.href = "/login"
  }, [])

  const tabs = [
    {
      key: "negocio",
      label: "Información del Negocio",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v.249A2.25 2.25 0 0 0 6.75 9.349m0 0a2.25 2.25 0 0 0 2.25 2.25v.249a2.25 2.25 0 0 1-2.25 2.25H6.75a2.25 2.25 0 0 1-2.25-2.25v-.249a2.25 2.25 0 0 0 2.25-2.25Z" />
        </svg>
      )
    },
    {
      key: "fiscal",
      label: "Configuración Fiscal",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      )
    },
    {
      key: "notificaciones",
      label: "Notificaciones",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
      )
    },
    {
      key: "sistema",
      label: "Configuración de Sistema",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
        </svg>
      )
    }
  ]

  const renderActiveTab = () => {
    switch (activeTab) {
      case "negocio":
        return <InformacionNegocio config={config} onConfigChange={handleConfigChange} loading={loading} />
      case "fiscal":
        return <ConfiguracionFiscal config={config} onConfigChange={handleConfigChange} loading={loading} />
      case "notificaciones":
        return <Notificaciones config={config} onConfigChange={handleConfigChange} loading={loading} />
      case "sistema":
        return <ConfiguracionSistema config={config} onConfigChange={handleConfigChange} loading={loading} />
      default:
        return <InformacionNegocio config={config} onConfigChange={handleConfigChange} loading={loading} />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative">
      {/* Patrón de textura sutil */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)`,
          backgroundSize: "20px 20px",
        }}
      ></div>

      {/* Gradiente adicional para profundidad */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-300/20 via-transparent to-slate-100/30"></div>

      <div className="relative z-10">
        <Navbar user={user} onLogout={handleLogout} />

        <div className="container mx-auto px-6 py-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-extrabold text-slate-800 text-center mb-2">
                Configuración del Sistema
              </h1>
              <p className="text-slate-600 text-center">
                Gestiona la configuración de tu ferretería
              </p>
            </div>

            {/* Tabs */}
            <div className="bg-white/80 rounded-2xl border border-slate-300/60 shadow-xl mb-8">
              <div className="flex flex-wrap gap-2 p-6 border-b border-slate-200">
                {tabs.map((tab) => (
                  <TabButton
                    key={tab.key}
                    isActive={activeTab === tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    icon={tab.icon}
                  >
                    {tab.label}
                  </TabButton>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-8">
                {renderActiveTab()}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-center gap-4">
              <button
                onClick={handleSave}
                disabled={saving || !user?.is_staff}
                className="px-8 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Guardar Configuración
                  </>
                )}
              </button>
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`mt-6 text-center p-4 rounded-xl ${
                feedback.includes("Error") 
                  ? "bg-red-50 border border-red-200 text-red-700" 
                  : "bg-emerald-50 border border-emerald-200 text-emerald-700"
              }`}>
                {feedback}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfiguracionManager 