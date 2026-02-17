"use client"

import { useEffect, useState, useCallback } from "react"
import Navbar from "./Navbar"
import { useFerreDeskTheme } from "../hooks/useFerreDeskTheme"
import Tabla from "./Tabla"
import { BotonEditar } from "./Botones"

// Hooks de catálogos de Clientes (reutilizamos exactamente los mismos)
import { useBarriosAPI } from "../utils/useBarriosAPI"
import { useLocalidadesAPI } from "../utils/useLocalidadesAPI"
import { useProvinciasAPI } from "../utils/useProvinciasAPI"
import { useTransportesAPI } from "../utils/useTransportesAPI"
import { usePlazosAPI } from "../utils/usePlazosAPI"
import { useCategoriasAPI } from "../utils/useCategoriasAPI"
import MaestroModal from "./Clientes/MaestrosModales"

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





// Pestaña: Información del Negocio
const InformacionNegocio = ({ config, onConfigChange, loading }) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
        </svg>
        Información del Negocio
      </h3>

      <div className="space-y-4">
        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Nombre del Negocio <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={config.nombre || ""}
            onChange={(e) => onConfigChange("nombre", e.target.value)}
            className="w-2/3 border border-slate-300 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder="Ej: Ferretería Central"
            disabled={loading}
          />
        </div>

        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Dirección <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={config.direccion || ""}
            onChange={(e) => onConfigChange("direccion", e.target.value)}
            className="w-2/3 border border-slate-300 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder="Ej: Av. San Martín 123"
            disabled={loading}
          />
        </div>

        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Teléfono <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={config.telefono || ""}
            onChange={(e) => onConfigChange("telefono", e.target.value)}
            className="w-2/3 border border-slate-300 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder="Ej: 011-1234-5678"
            disabled={loading}
          />
        </div>

        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            type="email"
            value={config.email || ""}
            onChange={(e) => onConfigChange("email", e.target.value)}
            className="w-2/3 border border-slate-300 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder="Ej: info@ferreteria.com"
            disabled={loading}
          />
        </div>
      </div>
    </div>
  )
}

// Pestaña: Configuración Fiscal
const ConfiguracionFiscal = ({ config, onConfigChange, loading }) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-emerald-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        Configuración Fiscal
      </h3>

      <div className="space-y-4">
        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Situación Fiscal <span className="text-red-500">*</span>
          </label>
          <select
            value={config.situacion_iva || "RI"}
            onChange={(e) => onConfigChange("situacion_iva", e.target.value)}
            className="w-2/3 border border-slate-300 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            disabled={loading}
          >
            <option value="RI">Responsable Inscripto</option>
            <option value="MO">Monotributista</option>
          </select>
        </div>



        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            CUIT/CUIL
          </label>
          <input
            type="text"
            value={config.cuit_cuil || ""}
            onChange={(e) => onConfigChange("cuit_cuil", e.target.value)}
            className="w-2/3 border border-slate-300 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder="Ej: 20-12345678-9"
            disabled={loading}
          />
        </div>

        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Razón Social
          </label>
          <input
            type="text"
            value={config.razon_social || ""}
            onChange={(e) => onConfigChange("razon_social", e.target.value)}
            className="w-2/3 border border-slate-300 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder="Ej: FERRETERÍA CENTRAL S.A."
            disabled={loading}
          />
        </div>

        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Logo de la Empresa
          </label>
          <div className="w-2/3">
            {config.logo_empresa && (
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded border border-slate-200 mb-2">
                <img
                  src={config.logo_empresa}
                  alt="Logo actual"
                  className="w-8 h-8 object-contain rounded"
                />
                <span className="text-xs text-slate-600">Logo actual cargado</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  onConfigChange("logo_empresa_file", file);
                  onConfigChange("logo_empresa", URL.createObjectURL(file));
                }
              }}
              className="w-full border border-slate-300 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              disabled={loading}
            />
          </div>
        </div>
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
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-purple-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        Notificaciones
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="w-1/3">
            <h5 className="font-medium text-slate-800">Stock Bajo</h5>
            <p className="text-sm text-slate-600">Notificar cuando los productos tengan stock bajo</p>
          </div>
          <div className="w-2/3 flex justify-end">
            <button
              onClick={() => handleToggle("notificaciones_stock_bajo")}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${config.notificaciones_stock_bajo ? "bg-orange-600" : "bg-slate-200"
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
    </div>
  )
}

// Pestaña: Configuración de Sistema
const ConfiguracionSistema = ({ config, onConfigChange, loading }) => {
  const handleToggle = (field) => {
    onConfigChange(field, !config[field])
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-indigo-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
        </svg>
        Configuración de Sistema
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="w-1/3">
            <h5 className="font-medium text-slate-800">Permitir Stock Negativo</h5>
            <p className="text-sm text-slate-600">Permitir que los productos tengan stock negativo</p>
          </div>
          <div className="w-2/3 flex justify-end">
            <button
              onClick={() => handleToggle("permitir_stock_negativo")}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${config.permitir_stock_negativo ? "bg-orange-600" : "bg-slate-200"
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
        <div className="flex items-center border-b border-slate-100 pb-3">
          <div className="w-1/3">
            <h5 className="font-medium text-slate-800">Prefijo Códigos de Barras</h5>
            <p className="text-sm text-slate-600">Siglas para códigos Code 128 internos (ej: ABC, MIF)</p>
          </div>
          <div className="w-2/3">
            <input
              type="text"
              value={config.prefijo_codigo_barras || ""}
              onChange={(e) => onConfigChange("prefijo_codigo_barras", e.target.value.toUpperCase())}
              className="w-full max-w-[200px] border border-slate-300 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 uppercase"
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
    </div>
  )
}

// Pestaña: Configuración ARCA
const ConfiguracionARCA = ({ config, onConfigChange, loading }) => {
  const handleFileChange = (field, file) => {
    onConfigChange(field, file)
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-purple-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        Configuración ARCA
      </h3>

      <div className="space-y-4">
        {/* Estado de configuración */}
        {config.arca_configurado && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-emerald-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="text-sm text-emerald-700">Configuración ARCA válida</span>
          </div>
        )}

        {config.arca_error_configuracion && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span className="text-sm text-red-700">{config.arca_error_configuracion}</span>
          </div>
        )}

        {/* Logo ARCA */}
        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Logo ARCA
          </label>
          <div className="w-2/3">
            {config.logo_arca && (
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded border border-slate-200 mb-2">
                <img
                  src={config.logo_arca}
                  alt="Logo ARCA actual"
                  className="w-8 h-8 object-contain rounded"
                />
                <span className="text-xs text-slate-600">Logo ARCA cargado</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files && e.target.files[0]
                if (file) {
                  onConfigChange('logo_arca_file', file)
                  onConfigChange('logo_arca', URL.createObjectURL(file))
                }
              }}
              className="w-full border border-slate-300 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              disabled={loading}
            />
            <p className="mt-1 text-[11px] text-slate-500">Se guardará como media/logos/logo-arca.jpg</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span className="text-sm text-blue-700">
            Configuración interna: {config.arca_habilitado ? 'Habilitado' : 'Deshabilitado'} |
            Modo: {config.modo_arca === 'PROD' ? 'Producción' : 'Homologación'}
          </span>
        </div>

        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Punto de Venta (ARCA)
          </label>
          <input
            type="text"
            value={config.punto_venta_arca || ""}
            onChange={(e) => onConfigChange("punto_venta_arca", e.target.value)}
            className="w-2/3 border border-slate-300 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder="Ej: 0001"
            disabled={loading}
          />
        </div>

        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Modo ARCA
          </label>
          <select
            value={config.modo_arca || "HOM"}
            onChange={(e) => onConfigChange("modo_arca", e.target.value)}
            className="w-2/3 border border-slate-300 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            disabled={loading}
          >
            <option value="HOM">Homologación (Pruebas)</option>
            <option value="PROD">Producción</option>
          </select>
        </div>

        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Certificado ARCA (.pem) <span className="text-red-500">*</span>
          </label>
          <div className="w-2/3">
            {config.certificado_arca && (
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <span className="text-xs text-slate-600">Certificado actual cargado</span>
              </div>
            )}
            <input
              type="file"
              accept="*"
              onChange={(e) => handleFileChange("certificado_arca_file", e.target.files[0])}
              className="w-full border border-slate-300 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex items-center border-b border-slate-100 pb-3">
          <label className="w-1/3 text-sm font-medium text-slate-700">
            Clave Privada ARCA (.pem) <span className="text-red-500">*</span>
          </label>
          <div className="w-2/3">
            {config.clave_privada_arca && (
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                </svg>
                <span className="text-xs text-slate-600">Clave privada actual cargada</span>
              </div>
            )}
            <input
              type="file"
              accept="*"
              onChange={(e) => handleFileChange("clave_privada_arca_file", e.target.files[0])}
              className="w-full border border-slate-300 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              disabled={loading}
            />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">Información Importante</h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Configuración sensible, solo administradores pueden modificarla</li>
            <li>• En modo Homologación se usan servicios de prueba</li>
            <li>• En modo Producción se usan servicios reales</li>
            <li>• Los certificados deben ser archivos .pem válidos proporcionados por ARCA</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

const ConfiguracionManager = () => {
  // Hook del tema de FerreDesk
  const theme = useFerreDeskTheme()

  const [user, setUser] = useState(null)
  const [config, setConfig] = useState({})
  const [loading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("negocio")
  const [feedback, setFeedback] = useState("")
  const [esNueva, setEsNueva] = useState(false)

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

      const res = await window.fetch(endpoint, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") },
        credentials: "include",
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Error al guardar")
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
          if (data.no_configurada === true) {
            setEsNueva(true)
          }
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

      // Validar que los archivos no estén vacíos
      if (config.certificado_arca_file && config.certificado_arca_file.size === 0) {
        setFeedback("Error: El archivo de certificado seleccionado está vacío.");
        setSaving(false);
        return;
      }
      if (config.clave_privada_arca_file && config.clave_privada_arca_file.size === 0) {
        setFeedback("Error: El archivo de clave privada seleccionado está vacío.");
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
          key !== 'no_configurada') {
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

      const esCreacion = esNueva || config?.no_configurada === true
      const res = await fetch("/api/ferreteria/", {
        method: esCreacion ? "POST" : "PATCH",
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
      setEsNueva(false)
      // Subir logo ARCA si fue seleccionado (va por endpoint dedicado)
      if (config.logo_arca_file) {
        const fd = new FormData()
        fd.append('logo_arca', config.logo_arca_file)
        const r2 = await fetch('/api/productos/subir-logo-arca/', {
          method: 'POST',
          headers: { 'X-CSRFToken': csrftoken },
          credentials: 'include',
          body: fd,
        })
        if (!r2.ok) {
          const errText = await r2.text().catch(() => '')
          throw new Error('Error al subir logo ARCA: ' + errText)
        }
      }

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
    window.location.href = "/login/"
  }, [])

  const tabs = [
    {
      key: "negocio",
      label: "Información del Negocio"
    },
    {
      key: "fiscal",
      label: "Configuración Fiscal"
    },
    {
      key: "sistema",
      label: "Configuración de Sistema"
    },
    {
      key: "arca",
      label: "Configuración ARCA"
    },
    {
      key: "maestros_clientes",
      label: "Maestros"
    }
  ]

  const renderActiveTab = () => {
    // Si el usuario no es admin y está en la pestaña ARCA, redirigir a negocio
    if (activeTab === "arca" && !user?.is_staff) {
      setActiveTab("negocio")
      return <InformacionNegocio config={config} onConfigChange={handleConfigChange} loading={loading} />
    }

    switch (activeTab) {
      case "negocio":
        return <InformacionNegocio config={config} onConfigChange={handleConfigChange} loading={loading} />
      case "fiscal":
        return <ConfiguracionFiscal config={config} onConfigChange={handleConfigChange} loading={loading} />
      case "notificaciones":
        return <Notificaciones config={config} onConfigChange={handleConfigChange} loading={loading} />
      case "sistema":
        return <ConfiguracionSistema config={config} onConfigChange={handleConfigChange} loading={loading} />
      case "arca":
        return <ConfiguracionARCA config={config} onConfigChange={handleConfigChange} loading={loading} />
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
                    className={`${catalogoSeleccionado === cat ? theme.tabActiva : `bg-gradient-to-r ${theme.primario} text-white`} px-3 py-1 rounded-lg`}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm text-slate-700">
                  <input type="checkbox" checked={ocultarInactivos} onChange={(e) => setOcultarInactivos(e.target.checked)} />
                  Ocultar inactivos
                </label>
                <button onClick={abrirModalNuevo} className={theme.botonPrimario}><span className="text-lg">+</span> Nuevo</button>
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
        return <InformacionNegocio config={config} onConfigChange={handleConfigChange} loading={loading} />
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="py-8 px-4">
        <div className="max-w-[1400px] w-full mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Configuración del Sistema</h2>
          </div>

          {/* Contenedor principal blanco */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
            {/* Tabs tipo browser - Encabezado azul oscuro */}
            <div className="flex items-center border-b border-slate-700 px-6 pt-3 bg-gradient-to-r from-slate-800 to-slate-700">
              {tabs.map((tab) => {
                // Solo mostrar pestaña ARCA a usuarios admin
                if (tab.key === "arca" && !user?.is_staff) {
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

            {/* Botones de acción (ocultos en pestaña Maestros para mantener la UX) */}
            {activeTab !== "maestros_clientes" && (
              <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 px-6 pb-6">
                <button
                  onClick={handleSave}
                  disabled={saving || !user?.is_staff}
                  className={`px-6 py-3 ${theme.botonPrimario} rounded-xl`}
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
                      Guardar Configuración
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 ml-2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}

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

            {/* Feedback */}
            {feedback && (
              <div className={`mx-6 mb-6 text-center p-4 rounded-xl ${feedback.includes("Error")
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