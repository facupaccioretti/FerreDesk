"use client"

import React, { useState, useEffect } from "react"
import Paginador from "./Paginador"

function ProveedoresModal({ open, onClose, proveedores, setProveedores }) {
  const [form, setForm] = useState({ razon: "", fantasia: "", domicilio: "", tel1: "", cuit: "" })
  const [editId, setEditId] = useState(null)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSave = () => {
    if (!form.razon) return alert("La razón social es obligatoria")
    if (editId) {
      setProveedores((prev) => prev.map((p) => (p.id === editId ? { ...p, ...form } : p)))
    } else {
      const newId = Math.max(0, ...proveedores.map((p) => p.id)) + 1
      setProveedores((prev) => [...prev, { ...form, id: newId }])
    }
    setForm({ razon: "", fantasia: "", domicilio: "", tel1: "", cuit: "" })
    setEditId(null)
  }

  const handleEdit = (prov) => {
    setForm({
      razon: prov.razon,
      fantasia: prov.fantasia,
      domicilio: prov.domicilio,
      tel1: prov.tel1,
      cuit: prov.cuit,
    })
    setEditId(prov.id)
  }

  const handleDelete = (id) => {
    if (window.confirm("¿Eliminar proveedor?")) {
      setProveedores((prev) => prev.filter((p) => p.id !== id))
      if (editId === id) {
        setForm({ razon: "", fantasia: "", domicilio: "", tel1: "", cuit: "" })
        setEditId(null)
      }
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg relative border border-slate-200">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-2xl text-slate-400 hover:text-red-500 transition-colors"
        >
          ×
        </button>
        <h2 className="text-xl font-bold mb-4 text-slate-800">Gestión de Proveedores</h2>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <input
            name="razon"
            value={form.razon}
            onChange={handleChange}
            placeholder="Razón social*"
            className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
          />
          <input
            name="fantasia"
            value={form.fantasia}
            onChange={handleChange}
            placeholder="Nombre de fantasía"
            className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
          />
          <input
            name="domicilio"
            value={form.domicilio}
            onChange={handleChange}
            placeholder="Domicilio"
            className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
          />
          <input
            name="tel1"
            value={form.tel1}
            onChange={handleChange}
            placeholder="Teléfono"
            className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
          />
          <input
            name="cuit"
            value={form.cuit}
            onChange={handleChange}
            placeholder="CUIT"
            className="border border-slate-300 rounded-lg p-2 col-span-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
          />
        </div>
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleSave}
            className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg"
          >
            {editId ? "Guardar cambios" : "Agregar proveedor"}
          </button>
          {editId && (
            <button
              onClick={() => {
                setForm({ razon: "", fantasia: "", domicilio: "", tel1: "", cuit: "" })
                setEditId(null)
              }}
              className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="px-2 py-1 text-slate-600">Razón</th>
              <th className="px-2 py-1 text-slate-600">Fantasia</th>
              <th className="px-2 py-1 text-slate-600">Tel</th>
              <th className="px-2 py-1 text-slate-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map((p) => (
              <tr key={p.id}>
                <td className="px-2 py-1 text-slate-700">{p.razon}</td>
                <td className="px-2 py-1 text-slate-700">{p.fantasia}</td>
                <td className="px-2 py-1 text-slate-700">{p.tel1}</td>
                <td className="px-2 py-1">
                  <div className="flex justify-center items-center gap-2">
                    <button onClick={() => handleEdit(p)} className="text-blue-600 hover:underline">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Modal para ABM de Familias
function FamiliasModal({ open, onClose, familias, addFamilia, updateFamilia, deleteFamilia }) {
  const [form, setForm] = useState({ deno: "", comentario: "", nivel: "", acti: "S" })
  const [editId, setEditId] = useState(null)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSave = () => {
    if (!form.deno) return alert("El nombre es obligatorio")
    if (!form.nivel) return alert("El nivel es obligatorio")
    if (editId) {
      updateFamilia(editId, form)
    } else {
      addFamilia(form)
    }
    setForm({ deno: "", comentario: "", nivel: "", acti: "S" })
    setEditId(null)
  }

  const handleEdit = (fam) => {
    setForm({ deno: fam.deno, comentario: fam.comentario, nivel: fam.nivel, acti: fam.acti })
    setEditId(fam.id)
  }

  const handleDelete = (id) => {
    if (window.confirm("¿Eliminar familia?")) deleteFamilia(id)
    if (editId === id) {
      setForm({ deno: "", comentario: "", nivel: "", acti: "S" })
      setEditId(null)
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg relative border border-slate-200">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-2xl text-slate-400 hover:text-red-500 transition-colors"
        >
          ×
        </button>
        <h2 className="text-xl font-bold mb-4 text-slate-800">Gestión de Familias</h2>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <input
            name="deno"
            value={form.deno}
            onChange={handleChange}
            placeholder="Nombre*"
            className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
          />
          <input
            name="comentario"
            value={form.comentario}
            onChange={handleChange}
            placeholder="Comentario"
            className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
          />
          <select
            name="nivel"
            value={form.nivel}
            onChange={handleChange}
            className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
          >
            <option value="">Nivel*</option>
            <option value="1">1 (Familia)</option>
            <option value="2">2 (Subfamilia)</option>
            <option value="3">3 (Sub-subfamilia)</option>
          </select>
          <select
            name="acti"
            value={form.acti}
            onChange={handleChange}
            className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
          >
            <option value="S">Activa</option>
            <option value="N">Inactiva</option>
          </select>
        </div>
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleSave}
            className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg"
          >
            {editId ? "Guardar cambios" : "Agregar familia"}
          </button>
          {editId && (
            <button
              onClick={() => {
                setForm({ deno: "", comentario: "", nivel: "", acti: "S" })
                setEditId(null)
              }}
              className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="px-2 py-1 text-slate-600">Nombre</th>
              <th className="px-2 py-1 text-slate-600">Comentario</th>
              <th className="px-2 py-1 text-slate-600">Nivel</th>
              <th className="px-2 py-1 text-slate-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {familias.map((f) => (
              <tr key={f.id}>
                <td className="px-2 py-1 text-slate-700">{f.deno}</td>
                <td className="px-2 py-1 text-slate-700">{f.comentario}</td>
                <td className="px-2 py-1 text-slate-700">{f.nivel}</td>
                <td className="px-2 py-1">
                  <div className="flex justify-center items-center gap-2">
                    <button
                      onClick={() => handleEdit(f)}
                      title="Editar"
                      className="transition-colors px-1 py-1 text-blue-500 hover:text-blue-700"
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
                      onClick={() => handleDelete(f.id)}
                      title="Eliminar"
                      className="transition-colors px-1 py-1 text-red-500 hover:text-red-700"
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ProductosTable({
  productos,
  familias,
  proveedores,
  setProveedores,
  search,
  setSearch,
  expandedId,
  setExpandedId,
  groupByFamilia,
  setGroupByFamilia,
  selectedNivel,
  setSelectedNivel,
  addFamilia,
  updateFamilia,
  deleteFamilia,
  addProveedor,
  updateProveedor,
  deleteProducto,
  onEdit,
  onUpdateStock,
}) {
  const [showProvModal, setShowProvModal] = useState(false)
  const [showFamiliasModal, setShowFamiliasModal] = useState(false)
  const [expandedRows, setExpandedRows] = useState(new Set())

  // --- Buscador adaptativo ---
  // Si está en modo familia, filtra familias por nombre
  const familiasFiltradas = groupByFamilia
    ? familias.filter((fam) => fam.deno.toLowerCase().includes(search.toLowerCase()))
    : familias

  // Si está en modo normal, filtra productos por atributos
  const productosFiltrados = !groupByFamilia
    ? productos.filter(
        (prod) =>
          prod.codvta?.toLowerCase().includes(search.toLowerCase()) ||
          prod.codcom?.toLowerCase().includes(search.toLowerCase()) ||
          prod.deno?.toLowerCase().includes(search.toLowerCase()),
      )
    : productos

  // Agrupación por familia (solo muestra familias filtradas)
  const productosPorFamilia = (familiasFiltradas || [])
    .filter((fam) => fam.nivel === selectedNivel)
    .map((fam) => ({
      familia: fam,
      productos: productosFiltrados.filter((p) => {
        if (selectedNivel === "1") return p.idfam1 === fam.id
        if (selectedNivel === "2") return p.idfam2 === fam.id
        if (selectedNivel === "3") return p.idfam3 === fam.id
        return false
      }),
    }))

  // Función para manejar la expansión/colapso
  const toggleRow = (productId) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }

  // Función auxiliar para obtener el nombre de familia por id
  const getFamiliaNombre = (famObj) => {
    if (!famObj) return "Sin asignar"
    if (typeof famObj === "object" && famObj.deno) return famObj.deno
    return "Sin asignar"
  }

  const handleDeleteProducto = (id) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.")) {
      deleteProducto(id)
    }
  }

  // ------------------------------ Paginación ------------------------------
  const [paginaActual, setPaginaActual] = useState(1)
  const [itemsPorPagina, setItemsPorPagina] = useState(10)

  // Reiniciar página cuando cambian búsqueda o modo
  useEffect(() => {
    setPaginaActual(1)
  }, [search, groupByFamilia])

  const indiceInicio = (paginaActual - 1) * itemsPorPagina
  const productosPagina = productosFiltrados.slice(indiceInicio, indiceInicio + itemsPorPagina)

  return (
    <div className="flex flex-col h-full">
      <div className="mb-2 flex items-center gap-2">
        <input
          type="text"
          className="pl-3 pr-3 py-1 w-64 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm transition-all duration-200"
          placeholder={groupByFamilia ? "Buscar familia..." : "Buscar producto..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={() => setShowFamiliasModal(true)}
          className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
        >
          Gestionar Familias
        </button>
      </div>

      <div className="overflow-auto flex-1">
        {groupByFamilia && (
          <div className="mb-4 flex items-center gap-2">
            <select
              value={selectedNivel}
              onChange={(e) => setSelectedNivel(e.target.value)}
              className="pl-3 pr-3 py-1 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm transition-all duration-200"
            >
              <option value="1">Nivel 1 (Familia)</option>
              <option value="2">Nivel 2 (Subfamilia)</option>
              <option value="3">Nivel 3 (Sub-subfamilia)</option>
            </select>
            <button
              onClick={() => setGroupByFamilia(false)}
              className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
            >
              Ver Lista Normal
            </button>
          </div>
        )}

        {!groupByFamilia && (
          <div className="mb-4">
            <button
              onClick={() => setGroupByFamilia(true)}
              className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
            >
              Agrupar por Familias
            </button>
          </div>
        )}

        {groupByFamilia ? (
          <div className="overflow-auto flex-1">
            {(productosPorFamilia || []).map(({ familia, productos }) => (
              <div key={familia.id} className="mb-4">
                <h3 className="text-base font-bold text-slate-700 mb-1">{familia.deno}</h3>
                {productos.length === 0 ? (
                  <div className="text-slate-500 italic mb-2 text-xs">Sin productos en esta familia.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                            Producto
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                            Código
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                            Familia
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                            Subfamilia
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                            Sub-subfamilia
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                            Stock
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {productos.map((product) => (
                          <React.Fragment key={product.id}>
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 whitespace-nowrap">
                                <div className="flex items-center">
                                  <button
                                    onClick={() => toggleRow(product.id)}
                                    className={`flex items-center justify-center w-6 h-6 mx-1 text-slate-600 hover:text-orange-600 transition-all duration-200 ${expandedRows.has(product.id) ? "rotate-90" : "rotate-0"}`}
                                    aria-label={expandedRows.has(product.id) ? "Ocultar detalles" : "Mostrar detalles"}
                                    style={{ padding: 0 }}
                                  >
                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      className="block m-auto"
                                    >
                                      <polygon points="5,3 15,10 5,17" />
                                    </svg>
                                  </button>
                                  <span className="text-sm font-medium text-slate-800">{product.deno}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">{product.codvta}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">
                                {getFamiliaNombre(product.idfam1)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">
                                {getFamiliaNombre(product.idfam2)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">
                                {getFamiliaNombre(product.idfam3)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">
                                {product.stock_proveedores?.reduce((acc, sp) => acc + sp.cantidad, 0) || 0}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600 align-middle">
                                <div className="flex items-center justify-center gap-2 h-full">
                                  <button
                                    onClick={() => onEdit(product)}
                                    title="Editar"
                                    className="transition-colors px-1 py-1 text-blue-500 hover:text-blue-700"
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
                                    onClick={() => handleDeleteProducto(product.id)}
                                    title="Eliminar"
                                    className="transition-colors px-1 py-1 text-red-500 hover:text-red-700"
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
                            {expandedRows.has(product.id) && (
                              <tr>
                                <td colSpan="8" className="px-3 py-2 bg-slate-50/50">
                                  <div className="p-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <h4 className="font-medium mb-2 text-slate-700">Información General</h4>
                                        <p className="text-slate-600">
                                          <span className="font-medium">Orden:</span> {product.orden ?? "Sin asignar"}
                                        </p>
                                        <p className="text-slate-600">
                                          <span className="font-medium">Unidad:</span> {product.unidad ?? "Sin asignar"}
                                        </p>
                                        <p className="text-slate-600">
                                          <span className="font-medium">Margen:</span> {product.margen ?? "Sin asignar"}
                                        </p>
                                        <p className="text-slate-600">
                                          <span className="font-medium">Cantidad Mínima:</span>{" "}
                                          {product.cantmin ?? "Sin asignar"}
                                        </p>
                                        <p className="text-slate-600">
                                          <span className="font-medium">Alícuota de IVA:</span>{" "}
                                          {product.idaliiva
                                            ? `${product.idaliiva.deno} (${product.idaliiva.porce}%)`
                                            : "Sin asignar"}
                                        </p>
                                        <p className="text-slate-600">
                                          <span className="font-medium">Activo:</span>{" "}
                                          {product.acti === "S"
                                            ? "Activo"
                                            : product.acti === "N"
                                              ? "Inactivo"
                                              : "Sin asignar"}
                                        </p>
                                        <p className="text-slate-600">
                                          <span className="font-medium">Familia:</span>{" "}
                                          {getFamiliaNombre(product.idfam1)}
                                        </p>
                                        <p className="text-slate-600">
                                          <span className="font-medium">Subfamilia:</span>{" "}
                                          {getFamiliaNombre(product.idfam2)}
                                        </p>
                                        <p className="text-slate-600">
                                          <span className="font-medium">Sub-subfamilia:</span>{" "}
                                          {getFamiliaNombre(product.idfam3)}
                                        </p>
                                        <p className="text-slate-600">
                                          <span className="font-medium">Proveedor Habitual:</span>{" "}
                                          {product.proveedor_habitual?.razon || "Sin asignar"}
                                        </p>
                                      </div>
                                      <div>
                                        <h4 className="font-medium mb-2 text-slate-700">Stock por Proveedor</h4>
                                        <table className="min-w-full text-sm">
                                          <thead>
                                            <tr className="bg-slate-100">
                                              <th className="px-2 py-1 text-left text-slate-600">Proveedor</th>
                                              <th className="px-2 py-1 text-left text-slate-600">Cantidad</th>
                                              <th className="px-2 py-1 text-left text-slate-600">Costo</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(product.stock_proveedores || []).map((sp, index) => (
                                              <tr key={index}>
                                                <td className="px-2 py-1 text-slate-700">
                                                  {sp.proveedor?.razon || "-"}
                                                </td>
                                                <td className="px-2 py-1 text-slate-700">{sp.cantidad}</td>
                                                <td className="px-2 py-1 text-slate-700">${sp.costo}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
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
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Código Venta
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Código Compra
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Familia
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Subfamilia
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Sub-subfamilia
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Stock Total
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {(productosPagina || []).map((product) => (
                  <React.Fragment key={product.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <button
                            onClick={() => toggleRow(product.id)}
                            className={`flex items-center justify-center w-6 h-6 mx-1 text-slate-600 hover:text-orange-600 transition-all duration-200 ${expandedRows.has(product.id) ? "rotate-90" : "rotate-0"}`}
                            aria-label={expandedRows.has(product.id) ? "Ocultar detalles" : "Mostrar detalles"}
                            style={{ padding: 0 }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="block m-auto"
                            >
                              <polygon points="5,3 15,10 5,17" />
                            </svg>
                          </button>
                          <span className="text-sm font-medium text-slate-800">{product.deno}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">{product.codvta}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">{product.codcom}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">
                        {getFamiliaNombre(product.idfam1)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">
                        {getFamiliaNombre(product.idfam2)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">
                        {getFamiliaNombre(product.idfam3)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">
                        {product.stock_proveedores?.reduce((acc, sp) => acc + (Number(sp.cantidad) || 0), 0) || 0}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600 align-middle">
                        <div className="flex items-center justify-center gap-2 h-full">
                          <button
                            onClick={() => onEdit(product)}
                            title="Editar"
                            className="transition-colors px-1 py-1 text-blue-500 hover:text-blue-700"
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
                            onClick={() => handleDeleteProducto(product.id)}
                            title="Eliminar"
                            className="transition-colors px-1 py-1 text-red-500 hover:text-red-700"
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
                    {expandedRows.has(product.id) && (
                      <tr>
                        <td colSpan="8" className="px-3 py-2 bg-slate-50/50">
                          <div className="p-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-medium mb-2 text-slate-700">Información General</h4>
                                <p className="text-slate-600">
                                  <span className="font-medium">Orden:</span> {product.orden ?? "Sin asignar"}
                                </p>
                                <p className="text-slate-600">
                                  <span className="font-medium">Unidad:</span> {product.unidad ?? "Sin asignar"}
                                </p>
                                <p className="text-slate-600">
                                  <span className="font-medium">Margen:</span> {product.margen ?? "Sin asignar"}
                                </p>
                                <p className="text-slate-600">
                                  <span className="font-medium">Cantidad Mínima:</span>{" "}
                                  {product.cantmin ?? "Sin asignar"}
                                </p>
                                <p className="text-slate-600">
                                  <span className="font-medium">Alícuota de IVA:</span>{" "}
                                  {product.idaliiva
                                    ? `${product.idaliiva.deno} (${product.idaliiva.porce}%)`
                                    : "Sin asignar"}
                                </p>
                                <p className="text-slate-600">
                                  <span className="font-medium">Activo:</span>{" "}
                                  {product.acti === "S" ? "Activo" : product.acti === "N" ? "Inactivo" : "Sin asignar"}
                                </p>
                                <p className="text-slate-600">
                                  <span className="font-medium">Familia:</span> {getFamiliaNombre(product.idfam1)}
                                </p>
                                <p className="text-slate-600">
                                  <span className="font-medium">Subfamilia:</span> {getFamiliaNombre(product.idfam2)}
                                </p>
                                <p className="text-slate-600">
                                  <span className="font-medium">Sub-subfamilia:</span>{" "}
                                  {getFamiliaNombre(product.idfam3)}
                                </p>
                                <p className="text-slate-600">
                                  <span className="font-medium">Proveedor Habitual:</span>{" "}
                                  {product.proveedor_habitual?.razon || "Sin asignar"}
                                </p>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2 text-slate-700">Stock por Proveedor</h4>
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="bg-slate-100">
                                      <th className="px-2 py-1 text-left text-slate-600">Proveedor</th>
                                      <th className="px-2 py-1 text-left text-slate-600">Cantidad</th>
                                      <th className="px-2 py-1 text-left text-slate-600">Costo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(product.stock_proveedores || []).map((sp, index) => (
                                      <tr key={index}>
                                        <td className="px-2 py-1 text-slate-700">{sp.proveedor?.razon || "-"}</td>
                                        <td className="px-2 py-1 text-slate-700">{sp.cantidad}</td>
                                        <td className="px-2 py-1 text-slate-700">${sp.costo}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {/* Paginador */}
            <Paginador
              totalItems={productosFiltrados.length}
              itemsPerPage={itemsPorPagina}
              currentPage={paginaActual}
              onPageChange={setPaginaActual}
              onItemsPerPageChange={(n) => {
                setItemsPorPagina(n)
                setPaginaActual(1)
              }}
            />
          </div>
        )}
      </div>
      <ProveedoresModal
        open={showProvModal}
        onClose={() => setShowProvModal(false)}
        proveedores={proveedores}
        setProveedores={setProveedores}
      />
      <FamiliasModal
        open={showFamiliasModal}
        onClose={() => setShowFamiliasModal(false)}
        familias={familias}
        addFamilia={addFamilia}
        updateFamilia={updateFamilia}
        deleteFamilia={deleteFamilia}
      />
    </div>
  )
}
