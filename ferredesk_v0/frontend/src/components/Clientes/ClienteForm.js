"use client"

import React, { useState } from "react"
import { getCookie } from "../../utils/csrf"
import FilterableSelect from "./FilterableSelect"

// Formulario para alta y edición de clientes.
// Código copiado directamente de NuevoClienteForm dentro de ClientesManager.js
// Se ha renombrado a ClienteForm y se mantiene la misma lógica.

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

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === "codigo" && value && !/^\d*$/.test(value)) {
      return
    }
    setForm((f) => ({ ...f, [name]: value }))
  }

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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.nombre || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Activo</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.nombre || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Activo</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.nombre || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Activo</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.nombre || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Localidad *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.activo || "S"}
              onChange={(e) => setModalForm((f) => ({ ...f, activo: e.target.value }))}
            >
              <option value="S">Sí</option>
              <option value="N">No</option>
            </select>
          </>
        )
      case "vendedor":
        return (
          <>
            <label className="block mb-2 text-slate-700 font-medium">Nombre *</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.nombre || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">DNI *</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.dni || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, dni: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Comisión Venta *</label>
            <input
              type="number"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.comivta || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, comivta: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Liquida Venta *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.liquivta || "S"}
              onChange={(e) => setModalForm((f) => ({ ...f, liquivta: e.target.value }))}
              required
            >
              <option value="S">Sí</option>
              <option value="N">No</option>
            </select>
            <label className="block mb-2 text-slate-700 font-medium">Comisión Cobro *</label>
            <input
              type="number"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.comicob || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, comicob: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Liquida Cobro *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.liquicob || "S"}
              onChange={(e) => setModalForm((f) => ({ ...f, liquicob: e.target.value }))}
              required
            >
              <option value="S">Sí</option>
              <option value="N">No</option>
            </select>
            <label className="block mb-2 text-slate-700 font-medium">Localidad *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                    className="w-full border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                    className="w-full border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={modalForm.nombre || ""}
              onChange={(e) => setModalForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Activo</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
    if (!form.codigo || !form.razon || !form.domicilio || !form.lineacred || !form.impsalcta || !form.fecsalcta || !form.zona) {
      setError("Por favor completa todos los campos obligatorios.")
      return
    }
    if (form.zona && form.zona.length > 10) {
      setError("El campo Zona no debe exceder los 10 caracteres.")
      return
    }
    setError("")
    onSave(form)
  }

  return (
    <>
      <form className="bg-white p-6 rounded-lg shadow-md w-full border border-slate-200" onSubmit={handleSubmit}>
        <h3 className="text-xl font-bold mb-4 text-slate-800">{initialData ? "Editar Cliente" : "Nuevo Cliente"}</h3>
        {error && <div className="mb-4 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{error}</div>}
        {apiError && <div className="mb-4 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{apiError}</div>}

        {/* ---- BLOQUE DE INPUTS COMPLETO ---- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Código */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Código *</label>
            <input
              name="codigo"
              value={form.codigo}
              onChange={handleChange}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
              type="number"
              min="0"
            />
            {form.codigo && isNaN(Number(form.codigo)) && (
              <div className="mb-2 text-red-600">El código debe ser un número entero.</div>
            )}
          </div>
          {/* Razón Social */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Razón Social *</label>
            <input
              name="razon"
              value={form.razon}
              onChange={handleChange}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          {/* Domicilio */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Domicilio *</label>
            <input
              name="domicilio"
              value={form.domicilio}
              onChange={handleChange}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          {/* Línea de Crédito */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Línea de Crédito *</label>
            <input
              name="lineacred"
              value={form.lineacred}
              onChange={handleChange}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
              type="number"
              min="0"
            />
          </div>
          {/* Importe saldo cta */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Importe Saldo Cta. *</label>
            <input
              name="impsalcta"
              value={form.impsalcta}
              onChange={handleChange}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
              type="number"
              step="any"
              min="0"
            />
          </div>
          {/* Fecha saldo cta */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Fecha Saldo Cta. *</label>
            <input
              name="fecsalcta"
              value={form.fecsalcta}
              onChange={handleChange}
              required
              type="date"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          {/* Zona */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Zona *</label>
            <input
              name="zona"
              value={form.zona}
              onChange={handleChange}
              required
              maxLength={10}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
            {form.zona && form.zona.length > 10 && (
              <div className="mt-1 text-xs text-red-600">La zona no debe exceder los 10 caracteres.</div>
            )}
          </div>
          {/* Nombre comercial */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Nombre Comercial</label>
            <input
              name="fantasia"
              value={form.fantasia}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          {/* CUIT */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">CUIT</label>
            <input
              name="cuit"
              value={form.cuit}
              onChange={handleChange}
              maxLength={11}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          {/* IB */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">IB</label>
            <input
              name="ib"
              value={form.ib}
              onChange={handleChange}
              maxLength={10}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          {/* Código Postal */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Código Postal</label>
            <input
              name="cpostal"
              value={form.cpostal}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          {/* Teléfonos */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Teléfono 1</label>
            <input
              name="tel1"
              value={form.tel1}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Teléfono 2</label>
            <input
              name="tel2"
              value={form.tel2}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Teléfono 3</label>
            <input
              name="tel3"
              value={form.tel3}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
            <input
              name="email"
              value={form.email}
              onChange={handleChange}
              type="email"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          {/* Contacto */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Contacto</label>
            <input
              name="contacto"
              value={form.contacto}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          {/* Comentario */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Comentario</label>
            <input
              name="comentario"
              value={form.comentario}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          {/* Selects con búsqueda */}
          <div>
            <FilterableSelect
              label="Barrio"
              name="barrio"
              options={barrios}
              value={form.barrio}
              onChange={handleChange}
              onAdd={() => openAddModal("barrio")}
              placeholder="Buscar barrio..."
              addLabel="Agregar Barrio"
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
              addLabel="Agregar Localidad"
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
              addLabel="Agregar Provincia"
            />
          </div>
          <div>
            <FilterableSelect
              label="Tipo de IVA"
              name="iva"
              options={tiposIVA}
              value={form.iva}
              onChange={handleChange}
              placeholder="Buscar tipo de IVA..."
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
              addLabel="Agregar Transporte"
            />
          </div>
          <div>
            <FilterableSelect
              label="Vendedor"
              name="vendedor"
              options={vendedores}
              value={form.vendedor}
              onChange={handleChange}
              onAdd={() => openAddModal("vendedor")}
              placeholder="Buscar vendedor..."
              addLabel="Agregar Vendedor"
            />
          </div>
          <div>
            <FilterableSelect
              label="Plazo"
              name="plazo"
              options={plazos}
              value={form.plazo}
              onChange={handleChange}
              placeholder="Buscar plazo..."
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
              addLabel="Agregar Categoría"
            />
          </div>
          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Estado</label>
            <select
              name="activo"
              value={form.activo}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            >
              <option value="A">Activo</option>
              <option value="I">Inactivo</option>
            </select>
          </div>
          {/* Cancela */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Cancela</label>
            <input
              name="cancela"
              value={form.cancela}
              onChange={handleChange}
              maxLength={1}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          {/* Descuentos */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Descuento 1</label>
            <input
              name="descu1"
              value={form.descu1}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Descuento 2</label>
            <input
              name="descu2"
              value={form.descu2}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Descuento 3</label>
            <input
              name="descu3"
              value={form.descu3}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button type="submit" className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl">
            Guardar
          </button>
          <button type="button" className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-2 rounded-lg font-semibold transition-all duration-200" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>

      {/* Modal para alta de entidades relacionales */}
      {modal?.open && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md relative border border-slate-200">
            <button className="absolute top-3 right-3 text-slate-400 hover:text-red-500 text-xl font-bold transition-colors" onClick={closeModal}>
              ×
            </button>
            <h4 className="text-lg font-bold mb-4 text-slate-800">Agregar {modal.type.charAt(0).toUpperCase() + modal.type.slice(1)}</h4>
            {error && <div className="mb-2 text-red-600 bg-red-50 p-2 rounded border border-red-200">{error}</div>}
            {renderModalForm()}
            <div className="flex gap-2 mt-4">
              <button className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200" onClick={handleAddModalSave} disabled={modalLoading}>
                {modalLoading ? "Guardando..." : "Guardar"}
              </button>
              <button className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-semibold transition-all duration-200" onClick={closeModal}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ClienteForm 