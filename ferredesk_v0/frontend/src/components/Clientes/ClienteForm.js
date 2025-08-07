"use client"

import { useState, useCallback } from "react"
import { getCookie } from "../../utils/csrf"
import FilterableSelect from "./FilterableSelect"
import useValidacionCUIT from "../../utils/useValidacionCUIT"
import CUITValidacionTooltip from "./CUITValidacionTooltip"

const ClienteForm = ({
  onSave,
  onCancel,
  initialData,
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
  setVendedores,
  setPlazos,
  setCategorias,
  tiposIVA,
  apiError,
}) => {
  const [form, setForm] = useState({
    codigo: initialData?.codigo || "",
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
  })

  const [error, setError] = useState("")
  const [modal, setModal] = useState(null)
  const [modalForm, setModalForm] = useState({})
  const [modalLoading, setModalLoading] = useState(false)

  // Hook para validación de CUIT
  const { 
    resultado, 
    isLoading: isLoadingCUIT, 
    error: errorCUIT, 
    mostrarTooltip, 
    handleCUITBlur, 
    limpiarResultado, 
    toggleTooltip 
  } = useValidacionCUIT()

  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    // Validación de campo código únicamente números
    if (name === "codigo" && value && !/^\d*$/.test(value)) {
      return
    }
    
    // Actualizamos de forma inmutable manteniendo resto del estado
    setForm((f) => ({ ...f, [name]: value }))
  }, [])

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

  const handleAddModalSave = async () => {
    setModalLoading(true)
    try {
      let url = ""
      let body = {}
      let setList = null
      switch (modal.type) {
        case "barrio":
          url = "/api/clientes/barrios/"
          body = { nombre: modalForm.nombre, activo: modalForm.activo || "S" }
          setList = setBarrios
          break
        case "localidad":
          url = "/api/clientes/localidades/"
          body = { nombre: modalForm.nombre, activo: modalForm.activo || "S" }
          setList = setLocalidades
          break
        case "provincia":
          url = "/api/clientes/provincias/"
          body = { nombre: modalForm.nombre, activo: modalForm.activo || "S" }
          setList = setProvincias
          break
        case "transporte":
          url = "/api/clientes/transportes/"
          body = { nombre: modalForm.nombre, localidad: modalForm.localidad, activo: modalForm.activo || "S" }
          setList = setTransportes
          break
        case "vendedor":
          url = "/api/clientes/vendedores/"
          body = {
            nombre: modalForm.nombre,
            dni: modalForm.dni,
            comivta: modalForm.comivta,
            liquivta: modalForm.liquivta,
            comicob: modalForm.comicob,
            liquicob: modalForm.liquicob,
            localidad: modalForm.localidad,
            activo: modalForm.activo || "S",
          }
          setList = setVendedores
          break
        case "plazo":
          url = "/api/clientes/plazos/"
          body = { nombre: modalForm.nombre, activo: modalForm.activo || "S" }
          setList = setPlazos
          break
        case "categoria":
          url = "/api/clientes/categorias/"
          body = { nombre: modalForm.nombre, activo: modalForm.activo || "S" }
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
    if (
      !form.codigo ||
      !form.razon ||
      !form.domicilio ||
      !form.zona
    ) {
      setError("Por favor completa todos los campos obligatorios.")
      return
    }
    if (form.zona && form.zona.length > 10) {
      setError("El campo Zona no debe exceder los 10 caracteres.")
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
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30 p-4">
        <div className="w-full max-w-none">
          <form
            className="w-full bg-white rounded-2xl shadow-md border border-slate-200/50 relative overflow-visible"
            onSubmit={handleSubmit}
          >
            {/* Gradiente decorativo superior */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600"></div>

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

              {/* Sección 1: Información Básica */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800">Información Básica</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100/80 rounded-xl border border-slate-200/40">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Código *</label>
                    <input
                      name="codigo"
                      value={form.codigo}
                      onChange={handleChange}
                      required
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      type="number"
                      min="0"
                    />
                    {form.codigo && isNaN(Number(form.codigo)) && (
                      <div className="mt-1 text-xs text-red-600">El código debe ser un número entero.</div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Razón Social *</label>
                    <input
                      name="razon"
                      value={form.razon}
                      onChange={handleChange}
                      required
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Domicilio *</label>
                    <input
                      name="domicilio"
                      value={form.domicilio}
                      onChange={handleChange}
                      required
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Estado</label>
                    <select
                      name="activo"
                      value={form.activo}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="A">Activo</option>
                      <option value="I">Inactivo</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre Comercial</label>
                    <input
                      name="fantasia"
                      value={form.fantasia}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Zona *</label>
                    <input
                      name="zona"
                      value={form.zona}
                      onChange={handleChange}
                      required
                      maxLength={10}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    {form.zona && form.zona.length > 10 && (
                      <div className="mt-1 text-xs text-red-600">La zona no debe exceder los 10 caracteres.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sección 2: Información Fiscal */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-lg">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800">Información Fiscal</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-gradient-to-r from-emerald-50 to-emerald-100/80 rounded-xl border border-emerald-200/40">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">CUIT</label>
                    <div className="relative">
                      <input
                        name="cuit"
                        value={form.cuit}
                        onChange={handleChange}
                        onBlur={(e) => handleCUITBlur(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCUITBlur(e.target.value)
                          }
                        }}
                        maxLength={11}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      
                      {/* Botón de alerta para mostrar validación */}
                      {resultado && !isLoadingCUIT && !errorCUIT && (
                        <button
                          type="button"
                          onClick={toggleTooltip}
                          className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 transition-colors ${
                            resultado.es_valido ? 'text-green-600 hover:text-green-800' : 'text-red-600 hover:text-red-800'
                          }`}
                          title={resultado.es_valido ? 'CUIT válido' : 'CUIT inválido'}
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            {resultado.es_valido ? (
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            ) : (
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            )}
                          </svg>
                        </button>
                      )}
                      
                      {/* Tooltip de validación */}
                      {resultado && (
                        <CUITValidacionTooltip
                          resultado={resultado}
                          onIgnorar={limpiarResultado}
                          isLoading={isLoadingCUIT}
                          error={errorCUIT}
                          mostrarTooltip={mostrarTooltip}
                          onToggle={toggleTooltip}
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">IB</label>
                    <input
                      name="ib"
                      value={form.ib}
                      onChange={handleChange}
                      maxLength={10}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FilterableSelect
                      label="Tipo de IVA"
                      name="iva"
                      options={tiposIVA}
                      value={form.iva}
                      onChange={handleChange}
                      placeholder="Buscar tipo de IVA..."
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Información Financiera */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center shadow-lg">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800">Información Financiera</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3 p-4 bg-gradient-to-r from-purple-50 to-purple-100/80 rounded-xl border border-purple-200/40">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Línea de Crédito</label>
                    <input
                      name="lineacred"
                      value={form.lineacred}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      type="number"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Importe Saldo Cta.</label>
                    <input
                      name="impsalcta"
                      value={form.impsalcta}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      type="number"
                      step="any"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha Saldo Cta.</label>
                    <input
                      name="fecsalcta"
                      value={form.fecsalcta}
                      onChange={handleChange}
                      type="date"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Descuento 1</label>
                    <input
                      name="descu1"
                      value={form.descu1}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Descuento 2</label>
                    <input
                      name="descu2"
                      value={form.descu2}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Descuento 3</label>
                    <input
                      name="descu3"
                      value={form.descu3}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Cancela</label>
                    <input
                      name="cancela"
                      value={form.cancela}
                      onChange={handleChange}
                      maxLength={1}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 4: Información de Contacto */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center shadow-lg">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800">Información de Contacto</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 p-4 bg-gradient-to-r from-amber-50 to-amber-100/80 rounded-xl border border-amber-200/40">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Código Postal</label>
                    <input
                      name="cpostal"
                      value={form.cpostal}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono 1</label>
                    <input
                      name="tel1"
                      value={form.tel1}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono 2</label>
                    <input
                      name="tel2"
                      value={form.tel2}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono 3</label>
                    <input
                      name="tel3"
                      value={form.tel3}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      type="email"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Contacto</label>
                    <input
                      name="contacto"
                      value={form.contacto}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div className="md:col-span-3 xl:col-span-6">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Comentario</label>
                    <textarea
                      name="comentario"
                      value={form.comentario}
                      onChange={handleChange}
                      rows={2}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 5: Ubicación y Relaciones */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-lg">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800">Ubicación y Relaciones Comerciales</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 p-4 bg-gradient-to-r from-indigo-50 to-indigo-100/80 rounded-xl border border-indigo-200/40">
                  <div>
                    <FilterableSelect
                      label="Barrio"
                      name="barrio"
                      options={barrios}
                      value={form.barrio}
                      onChange={handleChange}
                      onAdd={() => openAddModal("barrio")}
                      placeholder="Buscar barrio..."
                      addLabel="Agregar"
                    />
                  </div>
                  <div>
                    <FilterableSelect
                      label="Localidad"
                      name="localidad"
                      options={localidades}
                      value={form.localidad}
                      onChange={handleChange}
                      onAdd={() => openAddModal("localidad")}
                      placeholder="Buscar localidad..."
                      addLabel="Agregar"
                    />
                  </div>
                  <div>
                    <FilterableSelect
                      label="Provincia"
                      name="provincia"
                      options={provincias}
                      value={form.provincia}
                      onChange={handleChange}
                      onAdd={() => openAddModal("provincia")}
                      placeholder="Buscar provincia..."
                      addLabel="Agregar"
                    />
                  </div>
                  <div>
                    <FilterableSelect
                      label="Transporte"
                      name="transporte"
                      options={transportes}
                      value={form.transporte}
                      onChange={handleChange}
                      onAdd={() => openAddModal("transporte")}
                      placeholder="Buscar transporte..."
                      addLabel="Agregar"
                    />
                  </div>
                  <div>
                    <FilterableSelect
                      label="Vendedor"
                      name="vendedor"
                      options={vendedores}
                      value={form.vendedor}
                      onChange={handleChange}
                      placeholder="Buscar vendedor..."
                    />
                  </div>
                  <div>
                    <FilterableSelect
                      label="Plazo"
                      name="plazo"
                      options={plazos}
                      value={form.plazo}
                      onChange={handleChange}
                      onAdd={() => openAddModal("plazo")}
                      placeholder="Buscar plazo..."
                      addLabel="Agregar"
                    />
                  </div>
                  <div>
                    <FilterableSelect
                      label="Categoría"
                      name="categoria"
                      options={categorias}
                      value={form.categoria}
                      onChange={handleChange}
                      onAdd={() => openAddModal("categoria")}
                      placeholder="Buscar categoría..."
                      addLabel="Agregar"
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onCancel}
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

      {/* Modal para alta de entidades relacionales */}
      {modal?.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-md relative border border-slate-200/50 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-slate-800">
                  Agregar {modal.type.charAt(0).toUpperCase() + modal.type.slice(1)}
                </h4>
                <button onClick={closeModal} className="p-2 rounded-lg hover:bg-slate-100">
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-800 rounded-lg">
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
              {renderModalForm()}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddModalSave}
                disabled={modalLoading}
                className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {modalLoading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ClienteForm;
