"use client"

import React, { useState, useMemo, useCallback } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import Tabla from "../Tabla"

// Modal para ABM de Familias con estilo FerreDesk y Tabla.js
function FamiliasModal({ open, onClose, familias, addFamilia, updateFamilia, deleteFamilia }) {
  const theme = useFerreDeskTheme()
  const [form, setForm] = useState({ deno: "", comentario: "", nivel: "", acti: "S" })
  const [editId, setEditId] = useState(null)
  const [searchFamilias, setSearchFamilias] = useState("")

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

  const handleEdit = useCallback((fam) => {
    setForm({ deno: fam.deno, comentario: fam.comentario, nivel: fam.nivel, acti: fam.acti })
    setEditId(fam.id)
  }, [])

  const handleDelete = useCallback((id) => {
    if (window.confirm("¿Eliminar familia?")) deleteFamilia(id)
    if (editId === id) {
      setForm({ deno: "", comentario: "", nivel: "", acti: "S" })
      setEditId(null)
    }
  }, [editId, deleteFamilia])

  // Definición de columnas para Tabla.js
  const columnas = [
    { id: "deno", titulo: "Nombre", align: "left" },
    { id: "comentario", titulo: "Comentario", align: "left" },
    { id: "nivel", titulo: "Nivel", align: "left" },
    { id: "acti", titulo: "Estado", align: "left" },
    { id: "acciones", titulo: "Acciones", align: "center" }
  ]

  // Preparar datos para Tabla.js
  const datosTabla = useMemo(() => {
    return familias.map((f) => ({
      ...f,
      nivel: f.nivel === "1" ? "Familia" : f.nivel === "2" ? "Subfamilia" : "Sub-subfamilia",
      comentario: f.comentario || "-",
      acciones: (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => handleEdit(f)}
            title="Editar"
            className="transition-colors p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
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
            className="transition-colors p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
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
      )
    }))
  }, [familias, handleEdit, handleDelete])

  return (
    <Transition show={open} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden">
                {/* Encabezado azul FerreDesk */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6 relative">
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-2xl text-slate-300 hover:text-white transition-colors"
                  >
                    ×
                  </button>
                  <Dialog.Title className="text-xl font-bold text-white">
                    Gestión de Familias
                  </Dialog.Title>
                  <p className="text-slate-300 text-sm mt-1">
                    Administra las categorías de productos
                  </p>
                </div>

                {/* Contenido del modal */}
                <div className="flex-1 p-6 overflow-hidden flex flex-col bg-white">
                  {/* Formulario de alta/edición */}
                  <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-200">
                    <h3 className="font-medium text-slate-700 mb-3">
                      {editId ? "Editar Familia" : "Nueva Familia"}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
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
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={handleSave}
                        className={theme.botonPrimario}
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
                  </div>

                  {/* Tabla con Tabla.js */}
                  <div className="flex-1 overflow-hidden">
                    <Tabla
                      columnas={columnas}
                      datos={datosTabla}
                      valorBusqueda={searchFamilias}
                      onCambioBusqueda={setSearchFamilias}
                      mostrarBuscador={true}
                      mostrarOrdenamiento={false}
                      paginadorVisible={false}
                      sinEstilos={false}
                    />
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export default FamiliasModal
