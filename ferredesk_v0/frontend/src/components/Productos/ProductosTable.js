"use client"

import React, { useState } from "react"
import Tabla from "../Tabla"
import { BotonEditar, BotonEliminar, BotonImprimir } from "../Botones"
import AccionesMenu from "../Presupuestos y Ventas/herramientasforms/AccionesMenu"

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



export default function ProductosTable({
  productos,
  familias,
  proveedores,
  setProveedores,
  expandedId,
  setExpandedId,
  addFamilia,
  updateFamilia,
  deleteFamilia,
  addProveedor,
  updateProveedor,
  deleteProducto,
  onEdit,
  onImprimirCodigoBarras,
  onUpdateStock,
  fam1Filtro,
  setFam1Filtro,
  fam2Filtro,
  setFam2Filtro,
  fam3Filtro,
  setFam3Filtro,
  searchProductos,
  setSearchProductos,
  paginacionControlada = false,
  paginaActual,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
  totalRemoto = null,
  busquedaRemota = true,
  onOrdenamientoChange = null,
  ordenamientoControlado = null,
  cargando = false,
}) {
  // Función para generar los botones de acciones para productos (Opción B: imprimir solo si tiene código)
  const generarBotonesProducto = (producto) => {
    const botones = [
      {
        componente: BotonEditar,
        onClick: () => onEdit(producto),
        titulo: "Editar producto"
      },
      {
        componente: BotonEliminar,
        onClick: () => handleDeleteProducto(producto.id),
        titulo: "Eliminar producto"
      }
    ]
    if (producto.codigo_barras && typeof onImprimirCodigoBarras === "function") {
      botones.push({
        componente: BotonImprimir,
        onClick: () => onImprimirCodigoBarras(producto),
        titulo: "Imprimir código de barras"
      })
    }
    return botones
  }
  const [showProvModal, setShowProvModal] = useState(false)
  // Removido el estado local search

  // Removido productosFiltrados local, ahora se maneja en Tabla.js

  // Función para manejar la expansión/colapso (comportamiento como clientes: solo una fila abierta)
  const toggleRow = (productId) => {
    setExpandedId(expandedId === productId ? null : productId)
  }

  // Función auxiliar para obtener el nombre de familia por id
  const getFamiliaNombre = (famObj) => {
    if (!famObj) return "Sin asignar"
    if (typeof famObj === "object" && famObj.deno) return famObj.deno
    return "Sin asignar"
  }

  const handleDeleteProducto = async (id) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.")) {
      try {
        await deleteProducto(id)
      } catch (error) {
        // El error ya viene parseado desde el hook con el mensaje específico
        alert(error.message)
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filtros de familias */}
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <div>
          <label className="block text-xs text-slate-600">Familia</label>
          <select
            value={fam1Filtro}
            onChange={(e) => setFam1Filtro(e.target.value)}
            className="pl-2 pr-2 py-1 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 text-sm"
          >
            <option value="">Todas</option>
            {familias
              .filter((f) => f.nivel === "1")
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.deno}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600">Subfamilia</label>
          <select
            value={fam2Filtro}
            onChange={(e) => setFam2Filtro(e.target.value)}
            className="pl-2 pr-2 py-1 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 text-sm"
          >
            <option value="">Todas</option>
            {familias
              .filter((f) => f.nivel === "2")
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.deno}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600">Sub-sub</label>
          <select
            value={fam3Filtro}
            onChange={(e) => setFam3Filtro(e.target.value)}
            className="pl-2 pr-2 py-1 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 text-sm"
          >
            <option value="">Todas</option>
            {familias
              .filter((f) => f.nivel === "3")
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.deno}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="flex-1">
        {/* Definición de columnas */}
        {(() => {
          const columnas = [
            {
              id: "nro",
              titulo: "Nº",
              align: "center",
              render: (_, __, indiceBase) => <span className="text-xs text-slate-500 font-medium">{indiceBase + 1}</span>,
            },
            {
              id: "deno",
              titulo: "Producto",
              render: (p) => <span className="text-sm font-medium text-slate-800">{p.deno}</span>,
            },
            {
              id: "cod",
              titulo: "Código",
              render: (p) => <span className="text-sm text-slate-600">{p.codvta}</span>,
            },
            {
              id: "fam1",
              titulo: "Familia",
              render: (p) => <span className="text-sm text-slate-600">{getFamiliaNombre(p.idfam1)}</span>,
            },
            {
              id: "fam2",
              titulo: "Subfamilia",
              render: (p) => <span className="text-sm text-slate-600">{getFamiliaNombre(p.idfam2)}</span>,
            },
            {
              id: "fam3",
              titulo: "Sub-sub",
              render: (p) => <span className="text-sm text-slate-600">{getFamiliaNombre(p.idfam3)}</span>,
            },
            {
              id: "stock",
              titulo: "Stock",
              align: "right",
              render: (p) => <span className="text-sm text-slate-600">{Number(p.stock_total ?? 0).toFixed(2)}</span>,
            },
            {
              id: "acciones",
              titulo: "",
              align: "center",
              ancho: 50,
              render: (p) => (
                <div className="flex items-center justify-center">
                  <AccionesMenu botones={generarBotonesProducto(p)} />
                </div>
              ),
            },
          ]

          return (
            <Tabla
              columnas={columnas}
              datos={productos}
              valorBusqueda={searchProductos}
              onCambioBusqueda={setSearchProductos}
              mostrarBuscador={true}
              mostrarOrdenamiento={true}
              paginacionControlada={paginacionControlada}
              paginaActual={paginaActual}
              onPageChange={onPageChange}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={onItemsPerPageChange}
              totalRemoto={totalRemoto}
              busquedaRemota={busquedaRemota}
              onOrdenamientoChange={onOrdenamientoChange}
              ordenamientoControlado={ordenamientoControlado}
              cargando={cargando}
              renderFila={(p, idxVis, idxInicio) => {
                const indiceGlobal = idxInicio + idxVis

                const filaPrincipal = (
                  <tr
                    key={p.id}
                    onClick={() => toggleRow(p.id)}
                    className="hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    {columnas.map((col) => {
                      let contenido
                      if (col.id === "nro") {
                        contenido = indiceGlobal + 1
                      } else if (col.render) {
                        contenido = col.render(p, idxVis, idxInicio)
                      }
                      return (
                        <td
                          key={col.id}
                          className={`px-2 py-1 whitespace-nowrap text-sm ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                        >
                          {contenido}
                        </td>
                      )
                    })}
                  </tr>
                )

                if (expandedId !== p.id) {
                  return filaPrincipal
                }

                const filaDetalle = (
                  <tr key={`det-${p.id}`}>
                    <td colSpan={columnas.length} className="px-0 py-0">
                      {/* Contenedor y encabezado */}
                      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-l-4 border-orange-500 mx-3 mb-2 rounded-lg shadow-sm">
                        <div className="p-4">
                          {/* Contenido principal detallado */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Información Básica */}
                            <div className="bg-white rounded-lg p-3 border border-slate-200">
                              <h5 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                                <svg
                                  className="w-4 h-4 text-blue-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                                Información Básica
                              </h5>
                              <div className="space-y-1 text-xs">
                                
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Unidad:</span>
                                  <span className="font-medium text-slate-700">{p.unidad || "N/A"}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Margen:</span>
                                  <span className="font-medium text-slate-700">{p.margen ? `${p.margen}%` : "N/A"}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Cant. Mínima:</span>
                                  <span className="font-medium text-slate-700">{p.cantmin ?? "N/A"}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Estado:</span>
                                  <span
                                    className={`font-medium px-2 py-0.5 rounded-full text-xs ${
                                      p.acti === "S"
                                        ? "bg-green-100 text-green-800"
                                        : p.acti === "N"
                                          ? "bg-red-100 text-red-800"
                                          : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {p.acti === "S" ? "Activo" : p.acti === "N" ? "Inactivo" : "N/A"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Categorización */}
                            <div className="bg-white rounded-lg p-3 border border-slate-200">
                              <h5 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                                <svg
                                  className="w-4 h-4 text-purple-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                  />
                                </svg>
                                Categorización
                              </h5>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Familia:</span>
                                  <span className="font-medium text-slate-700">{getFamiliaNombre(p.idfam1)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Subfamilia:</span>
                                  <span className="font-medium text-slate-700">{getFamiliaNombre(p.idfam2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Sub-subfamilia:</span>
                                  <span className="font-medium text-slate-700">{getFamiliaNombre(p.idfam3)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Alícuota IVA:</span>
                                  <span className="font-medium text-slate-700">
                                    {p.idaliiva ? `${p.idaliiva.deno} (${p.idaliiva.porce}%)` : "N/A"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Prov. Habitual:</span>
                                  <span
                                    className="font-medium text-slate-700 truncate"
                                    title={p.proveedor_habitual?.razon}
                                  >
                                    {p.proveedor_habitual?.razon || "N/A"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Stock (detalle por proveedor + total) */}
                            <div className="bg-white rounded-lg p-3 border border-slate-200">
                              <h5 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                                <svg
                                  className="w-4 h-4 text-green-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                  />
                                </svg>
                                Stock
                              </h5>
                              <div className="max-h-24 overflow-y-auto">
                                {(p.stock_proveedores || []).length > 0 ? (
                                  <div className="space-y-0.5">
                                    {p.stock_proveedores.map((sp, index) => (
                                      <div
                                        key={index}
                                        className="flex justify-between items-center text-xs bg-slate-100 rounded px-2 py-1"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div
                                            className="font-medium text-slate-700 truncate leading-tight"
                                            title={sp.proveedor?.razon}
                                          >
                                            {sp.proveedor?.razon || "N/A"}
                                          </div>
                                        </div>
                                        <div className="flex gap-2 text-right leading-tight">
                                          <span className="text-slate-600 leading-tight">
                                            Cant: <strong>{sp.cantidad}</strong>
                                          </span>
                                          <span className="text-slate-600 leading-tight">
                                            $<strong>{sp.costo}</strong>
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-500 italic text-center py-2">
                                    Sin stock de proveedores
                                  </div>
                                )}
                              </div>
                              {/* Línea de stock total */}
                              <div className="mt-2 text-xs text-right font-semibold text-slate-700">
                                Stock Total: {Number(p.stock_total ?? 0).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )

                return [filaPrincipal, filaDetalle]
              }}
            />
          )
        })()}
      </div>
      <ProveedoresModal
        open={showProvModal}
        onClose={() => setShowProvModal(false)}
        proveedores={proveedores}
        setProveedores={setProveedores}
      />
    </div>
  )
}
