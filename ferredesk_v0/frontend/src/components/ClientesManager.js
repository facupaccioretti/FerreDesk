"use client"

import React, { useState, useEffect } from "react"
import Navbar from "./Navbar"
import { getCookie } from "../utils/csrf"
import { useBarriosAPI } from "../utils/useBarriosAPI"
import { useLocalidadesAPI } from "../utils/useLocalidadesAPI"
import { useProvinciasAPI } from "../utils/useProvinciasAPI"
import { useTiposIVAAPI } from "../utils/useTiposIVAAPI"
import { useTransportesAPI } from "../utils/useTransportesAPI"
import { useVendedoresAPI } from "../utils/useVendedoresAPI"
import { usePlazosAPI } from "../utils/usePlazosAPI"
import { useCategoriasAPI } from "../utils/useCategoriasAPI"
import { useClientesAPI } from "../utils/useClientesAPI"
import Paginador from "./Paginador"

const ClientesTable = ({
  clientes,
  onEdit,
  onDelete,
  search,
  setSearch,
  expandedClientId,
  setExpandedClientId,
  barrios,
  localidades,
  provincias,
  tiposIVA,
  transportes,
  vendedores,
  plazos,
  categorias,
}) => {
  const filtered = (clientes || []).filter(
    (cli) =>
      cli &&
      ((cli.razon ? cli.razon.toLowerCase() : "").includes(search.toLowerCase()) ||
        (cli.fantasia ? cli.fantasia.toLowerCase() : "").includes(search.toLowerCase())),
  )

  // ------------------------------ Paginación ------------------------------
  const [paginaActual, setPaginaActual] = useState(1) // Página mostrada actualmente
  const [itemsPorPagina, setItemsPorPagina] = useState(10) // Cantidad de filas por página (configurable)

  // Cuando cambia la búsqueda o la lista de clientes, vuelve a la primera página
  useEffect(() => {
    setPaginaActual(1)
  }, [search, clientes])

  const indiceInicio = (paginaActual - 1) * itemsPorPagina
  const clientesVisibles = filtered.slice(indiceInicio, indiceInicio + itemsPorPagina)

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <input
          type="text"
          className="pl-4 pr-4 py-2 w-full rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
          placeholder="Buscar clientes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="overflow-auto flex-1">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 tracking-wider uppercase">
                RAZÓN SOCIAL
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 tracking-wider uppercase">
                NOMBRE COMERCIAL
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 tracking-wider uppercase">
                ACCIONES
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {clientesVisibles.map((cli) => (
              <React.Fragment key={cli.id}>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">
                    <div className="flex items-center">
                      <button
                        onClick={() => setExpandedClientId(expandedClientId === cli.id ? null : cli.id)}
                        className={`flex items-center justify-center w-6 h-6 mr-2 text-slate-600 hover:text-orange-600 transition-all duration-200 ${expandedClientId === cli.id ? "rotate-90" : "rotate-0"}`}
                        aria-label={expandedClientId === cli.id ? "Ocultar detalles" : "Mostrar detalles"}
                        style={{ padding: 0 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="block m-auto">
                          <polygon points="5,3 15,10 5,17" />
                        </svg>
                      </button>
                      <span>{cli.razon}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">{cli.fantasia}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => onEdit(cli)}
                        title="Editar"
                        className="transition-colors px-1 py-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="1.5"
                          stroke="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(cli.id)}
                        title="Eliminar"
                        className="transition-colors px-1 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="1.5"
                          stroke="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedClientId === cli.id && (
                  <tr className="bg-slate-50/50">
                    <td colSpan="3" className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div>
                          <span className="block text-slate-500 font-medium">Código</span>
                          <span className="block text-slate-700 mt-1">{cli.codigo}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Razón Social</span>
                          <span className="block text-slate-700 mt-1">{cli.razon}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Nombre Comercial</span>
                          <span className="block text-slate-700 mt-1">{cli.fantasia}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">CUIT</span>
                          <span className="block text-slate-700 mt-1">{cli.cuit}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">IB</span>
                          <span className="block text-slate-700 mt-1">{cli.ib}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Estado</span>
                          <span className="block text-slate-700 mt-1">{cli.estado}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Dirección</span>
                          <span className="block text-slate-700 mt-1">{cli.domicilio}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Teléfono 1</span>
                          <span className="block text-slate-700 mt-1">{cli.tel1}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Teléfono 2</span>
                          <span className="block text-slate-700 mt-1">{cli.tel2}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Teléfono 3</span>
                          <span className="block text-slate-700 mt-1">{cli.tel3}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Email</span>
                          <span className="block text-slate-700 mt-1">{cli.email}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Contacto</span>
                          <span className="block text-slate-700 mt-1">{cli.contacto}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Comentario</span>
                          <span className="block text-slate-700 mt-1">{cli.comentario}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Código Postal</span>
                          <span className="block text-slate-700 mt-1">{cli.cpostal}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Zona</span>
                          <span className="block text-slate-700 mt-1">
                            {barrios.find((b) => String(b.id) === String(cli.barrio))?.nombre || ""}
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Barrio</span>
                          <span className="block text-slate-700 mt-1">
                            {localidades.find((l) => String(l.id) === String(cli.localidad))?.nombre || ""}
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Provincia</span>
                          <span className="block text-slate-700 mt-1">
                            {provincias.find((p) => String(p.id) === String(cli.provincia))?.nombre || ""}
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Tipo de IVA</span>
                          <span className="block text-slate-700 mt-1">
                            {tiposIVA.find((i) => String(i.id) === String(cli.iva))?.nombre || ""}
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Transporte</span>
                          <span className="block text-slate-700 mt-1">
                            {transportes.find((t) => String(t.id) === String(cli.transporte))?.nombre || ""}
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Vendedor</span>
                          <span className="block text-slate-700 mt-1">
                            {vendedores.find((v) => String(v.id) === String(cli.vendedor))?.nombre || ""}
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Plazo</span>
                          <span className="block text-slate-700 mt-1">
                            {plazos.find((p) => String(p.id) === String(cli.plazo))?.nombre || ""}
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Categoría</span>
                          <span className="block text-slate-700 mt-1">
                            {categorias.find((c) => String(c.id) === String(cli.categoria))?.nombre || ""}
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Línea de Crédito</span>
                          <span className="block text-slate-700 mt-1">{cli.lineacred}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Importe Saldo Cta.</span>
                          <span className="block text-slate-700 mt-1">{cli.impsalcta}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Fecha Saldo Cta.</span>
                          <span className="block text-slate-700 mt-1">{cli.fecsalcta}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Descuento 1</span>
                          <span className="block text-slate-700 mt-1">{cli.descu1}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Descuento 2</span>
                          <span className="block text-slate-700 mt-1">{cli.descu2}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Descuento 3</span>
                          <span className="block text-slate-700 mt-1">{cli.descu3}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {/* Paginador */}
      <Paginador
        totalItems={filtered.length}
        itemsPerPage={itemsPorPagina}
        currentPage={paginaActual}
        onPageChange={setPaginaActual}
        onItemsPerPageChange={(n) => {
          setItemsPorPagina(n)
          setPaginaActual(1)
        }}
      />
    </div>
  )
}

const FilterableSelect = ({ label, options, value, onChange, onAdd, placeholder, addLabel, name }) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const filtered = options.filter((opt) => opt.nombre.toLowerCase().includes(search.toLowerCase()))
  const selected = options.find((opt) => String(opt.id) === String(value))

  return (
    <div className="mb-2 relative">
      <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center justify-between">
        {label}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="ml-2 text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
          >
            {addLabel}
          </button>
        )}
      </label>
      <div className="relative">
        <input
          type="text"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
          placeholder={placeholder}
          value={selected ? selected.nombre : search}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
            onChange({ target: { name, value: "" } })
          }}
        />
        {open && (
          <div className="absolute z-10 bg-white border border-slate-300 rounded-lg w-full mt-1 max-h-40 overflow-auto shadow-lg">
            {filtered.length === 0 && <div className="px-3 py-2 text-slate-500 text-sm">Sin resultados</div>}
            {filtered.map((opt) => (
              <div
                key={opt.id}
                className={`px-3 py-2 cursor-pointer hover:bg-orange-50 text-sm transition-colors ${String(opt.id) === String(value) ? "bg-orange-100 font-semibold text-orange-800" : "text-slate-700"}`}
                onMouseDown={() => {
                  onChange({ target: { name, value: opt.id } })
                  setSearch(opt.nombre)
                  setOpen(false)
                }}
              >
                {opt.nombre}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const NuevoClienteForm = ({
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

  // Modal dinámico para agregar entidades relacionales
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

  // Lógica para crear entidad relacional
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
      // Refresca la lista
      const data = await fetch(url).then((r) => r.json())
      setList(Array.isArray(data) ? data : data.results || [])
      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setModalLoading(false)
    }
  }

  // Renderiza el formulario mínimo requerido para cada entidad relacional
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
    // Validación solo de los campos obligatorios según el modelo
    if (
      !form.codigo ||
      !form.razon ||
      !form.domicilio ||
      !form.lineacred ||
      !form.impsalcta ||
      !form.fecsalcta ||
      !form.zona
    ) {
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
      <form
        className="bg-white p-6 rounded-lg shadow-md w-full max-w-2xl border border-slate-200"
        onSubmit={handleSubmit}
      >
        <h3 className="text-xl font-bold mb-4 text-slate-800">Nuevo Cliente</h3>
        {error && <div className="mb-4 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{error}</div>}
        {apiError && <div className="mb-4 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{apiError}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Nombre Comercial</label>
            <input
              name="fantasia"
              value={form.fantasia}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
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
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Código Postal</label>
            <input
              name="cpostal"
              value={form.cpostal}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
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
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Contacto</label>
            <input
              name="contacto"
              value={form.contacto}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Comentario</label>
            <input
              name="comentario"
              value={form.comentario}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
          </div>
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
          <button
            type="submit"
            className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Guardar
          </button>
          <button
            type="button"
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-2 rounded-lg font-semibold transition-all duration-200"
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </form>
      {/* Modal para alta de entidades relacionales */}
      {modal?.open && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md relative border border-slate-200">
            <button
              className="absolute top-3 right-3 text-slate-400 hover:text-red-500 text-xl font-bold transition-colors"
              onClick={closeModal}
            >
              ×
            </button>
            <h4 className="text-lg font-bold mb-4 text-slate-800">
              Agregar {modal.type.charAt(0).toUpperCase() + modal.type.slice(1)}
            </h4>
            {error && <div className="mb-2 text-red-600 bg-red-50 p-2 rounded border border-red-200">{error}</div>}
            {renderModalForm()}
            <div className="flex gap-2 mt-4">
              <button
                className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200"
                onClick={handleAddModalSave}
                disabled={modalLoading}
              >
                {modalLoading ? "Guardando..." : "Guardar"}
              </button>
              <button
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-semibold transition-all duration-200"
                onClick={closeModal}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const ClientesManager = () => {
  useEffect(() => {
    document.title = "Clientes FerreDesk"
  }, [])

  const { clientes, loading, error, addCliente, updateCliente, deleteCliente } = useClientesAPI()

  const [search, setSearch] = useState("")

  // Cargar estado de pestañas desde localStorage
  const [tabs, setTabs] = useState(() => {
    const savedTabs = localStorage.getItem("clientesTabs")
    return savedTabs ? JSON.parse(savedTabs) : [{ key: "lista", label: "Lista de Clientes", closable: false }]
  })

  const [activeTab, setActiveTab] = useState(() => {
    const savedActiveTab = localStorage.getItem("clientesActiveTab")
    return savedActiveTab || "lista"
  })

  const [editCliente, setEditCliente] = useState(null)
  const [expandedClientId, setExpandedClientId] = useState(null)
  const [user, setUser] = useState(null)

  // Guardar estado de pestañas en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem("clientesTabs", JSON.stringify(tabs))
    localStorage.setItem("clientesActiveTab", activeTab)
  }, [tabs, activeTab])

  useEffect(() => {
    fetch("/api/user/", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") setUser(data.user)
      })
  }, [])

  const handleLogout = () => {
    fetch("/api/logout/", { method: "POST", credentials: "include" }).then(() => {
      window.location.href = "/login"
    })
  }

  // Abrir nueva subpestaña
  const openTab = (key, label, cliente = null) => {
    setEditCliente(cliente)
    setTabs((prev) => {
      if (prev.find((t) => t.key === key)) return prev
      return [...prev, { key, label, closable: true }]
    })
    setActiveTab(key)
  }

  // Cerrar subpestaña
  const closeTab = (key) => {
    setTabs((prev) => prev.filter((t) => t.key !== key))
    if (activeTab === key) setActiveTab("lista")
    setEditCliente(null)
  }

  // Guardar cliente (alta o edición)
  const handleSaveCliente = (data) => {
    if (editCliente) {
      updateCliente(editCliente.id, data)
    } else {
      addCliente(data)
    }
    closeTab("nuevo")
  }

  // Eliminar cliente
  const handleDeleteCliente = (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este cliente?")) {
      deleteCliente(id)
    }
  }

  // Editar cliente
  const handleEditCliente = (cliente) => {
    openTab("nuevo", "Nuevo Cliente", cliente)
  }

  // Reemplazo los estados y fetchs directos por hooks personalizados
  const { barrios, setBarrios } = useBarriosAPI()
  const { localidades, setLocalidades } = useLocalidadesAPI()
  const { provincias, setProvincias } = useProvinciasAPI()
  const { transportes, setTransportes } = useTransportesAPI()
  const { vendedores, setVendedores } = useVendedoresAPI()
  const { plazos, setPlazos } = usePlazosAPI()
  const { categorias, setCategorias } = useCategoriasAPI()
  const { tiposIVA } = useTiposIVAAPI()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30 flex flex-col">
      <Navbar user={user} onLogout={handleLogout} />
      <div className="flex justify-between items-center px-6 py-4">
        <h2 className="text-2xl font-bold text-slate-800">Gestión de Clientes</h2>
      </div>
      <div className="flex flex-1 px-6 gap-4 min-h-0">
        <div className="flex-1 flex flex-col">
          {/* Tabs tipo browser */}
          <div className="flex items-center border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 shadow-sm">
            {tabs.map((tab) => (
              <div
                key={tab.key}
                className={`flex items-center px-5 py-2 mr-2 rounded-t-xl cursor-pointer transition-colors ${activeTab === tab.key ? "bg-white border border-b-0 border-slate-200 font-semibold text-slate-800 shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                onClick={() => setActiveTab(tab.key)}
                style={{ position: "relative" }}
              >
                {tab.label}
                {tab.closable && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.key)
                    }}
                    className="ml-2 text-lg font-bold text-slate-400 hover:text-red-500 focus:outline-none transition-colors"
                    title="Cerrar"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {/* Botón Nuevo Cliente solo en la tab de lista */}
            {activeTab === "lista" && (
              <div className="flex-1 flex justify-end mb-2">
                <button
                  onClick={() => openTab("nuevo", "Nuevo Cliente")}
                  className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
                >
                  <span className="text-lg">+</span> Nuevo Cliente
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 bg-white rounded-b-xl shadow-md min-h-0 p-6 border border-slate-200">
            {activeTab === "lista" && (
              <ClientesTable
                clientes={clientes}
                onEdit={handleEditCliente}
                onDelete={handleDeleteCliente}
                search={search}
                setSearch={setSearch}
                expandedClientId={expandedClientId}
                setExpandedClientId={setExpandedClientId}
                barrios={barrios}
                localidades={localidades}
                provincias={provincias}
                tiposIVA={tiposIVA}
                transportes={transportes}
                vendedores={vendedores}
                plazos={plazos}
                categorias={categorias}
              />
            )}
            {activeTab === "nuevo" && (
              <div className="flex justify-center items-center min-h-[60vh]">
                <NuevoClienteForm
                  onSave={handleSaveCliente}
                  onCancel={() => closeTab("nuevo")}
                  initialData={editCliente}
                  barrios={barrios}
                  localidades={localidades}
                  provincias={provincias}
                  transportes={transportes}
                  vendedores={vendedores}
                  plazos={plazos}
                  categorias={categorias}
                  setBarrios={setBarrios}
                  setLocalidades={setLocalidades}
                  setProvincias={setProvincias}
                  setTransportes={setTransportes}
                  setVendedores={setVendedores}
                  setPlazos={setPlazos}
                  setCategorias={setCategorias}
                  tiposIVA={tiposIVA}
                  apiError={error}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      {loading && <div className="p-4 text-center text-slate-600">Cargando clientes...</div>}
      {error && (
        <div className="p-4 text-center text-red-600 bg-red-50 mx-6 rounded-lg border border-red-200">{error}</div>
      )}
    </div>
  )
}

// Modificar ClientesTable para alinear acciones correctamente
ClientesTable.defaultProps = {
  expandedClientId: null,
  setExpandedClientId: () => {},
}

export default ClientesManager;
