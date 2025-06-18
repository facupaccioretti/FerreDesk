"use client"

import { useEffect, useState, useMemo } from "react"
import Navbar from "../Navbar"
import StockForm from "./StockForm"
import ProductosTable from "./ProductosTable"
import { useProductosAPI } from "../../utils/useProductosAPI"
import { useFamiliasAPI } from "../../utils/useFamiliasAPI"
import { useProveedoresAPI } from "../../utils/useProveedoresAPI"
import { useStockProveAPI } from "../../utils/useStockProveAPI"

const ProductosManager = () => {
  useEffect(() => {
    document.title = "Productos FerreDesk"
  }, [])

  // Hooks API
  const { productos, addProducto, updateProducto, deleteProducto, setProductos } = useProductosAPI()
  const { familias, addFamilia, updateFamilia, deleteFamilia } = useFamiliasAPI()
  const { proveedores, addProveedor, updateProveedor, deleteProveedor } = useProveedoresAPI()
  const { stockProve, updateStockProve } = useStockProveAPI()

  const [search, setSearch] = useState("")
  const [searchInactivos, setSearchInactivos] = useState("")

  // Cargar estado de pestañas desde localStorage
  const [tabs, setTabs] = useState(() => {
    const savedTabs = localStorage.getItem("productosTabs")
    let currentTabs = savedTabs ? JSON.parse(savedTabs) : []

    // Aseguramos que "Lista de Productos" esté presente y no sea cerrable
    let listaTab = currentTabs.find((t) => t.key === "lista")
    if (listaTab) {
      listaTab.closable = false
    } else {
      currentTabs.unshift({ key: "lista", label: "Lista de Productos", closable: false })
    }

    // Aseguramos que "Productos Inactivos" esté presente y no sea cerrable
    let inactivosTab = currentTabs.find((t) => t.key === "inactivos")
    if (inactivosTab) {
      inactivosTab.closable = false
    } else {
      const listaIndex = currentTabs.findIndex((t) => t.key === "lista")
      currentTabs.splice(listaIndex + 1, 0, { key: "inactivos", label: "Productos Inactivos", closable: false })
    }

    return currentTabs
  })

  const [activeTab, setActiveTab] = useState(() => {
    const savedActiveTab = localStorage.getItem("productosActiveTab")
    return savedActiveTab || "lista"
  })

  const [editStates, setEditStates] = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const [groupByFamilia, setGroupByFamilia] = useState(false)
  const [selectedNivel, setSelectedNivel] = useState("1")
  const [updateStockModal, setUpdateStockModal] = useState({ show: false, stockId: null, providerId: null })
  const [user, setUser] = useState({ username: "ferreadmin" })

  // Guardar estado de pestañas en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem("productosTabs", JSON.stringify(tabs))
    localStorage.setItem("productosActiveTab", activeTab)
  }, [tabs, activeTab])

  // Efecto para manejar la carga inicial y recargas
  useEffect(() => {
    const savedActiveTab = localStorage.getItem("productosActiveTab")
    const stockFormDraft = localStorage.getItem("stockFormDraft")

    if (savedActiveTab === "nuevo") {
      if (stockFormDraft) {
        try {
          const draftData = JSON.parse(stockFormDraft)
          // Asegurarse de que el draft no sea un producto existente (sin ID)
          if (!draftData.id) {
            setEditStates({ nuevo: draftData }) // Cargar el draft para un nuevo producto
          } else {
            // Si el draft tiene ID, es de un producto que se estaba editando.
            // Podríamos intentar buscarlo en `productos` o simplemente limpiar.
            // Por ahora, limpiamos para evitar inconsistencias si el producto ya no existe.
            localStorage.removeItem("stockFormDraft")
            setEditStates({ nuevo: null })
            setActiveTab("lista") // Volver a la lista si el draft es inválido para "nuevo"
          }
        } catch (error) {
          console.error("Error al parsear stockFormDraft:", error)
          localStorage.removeItem("stockFormDraft")
          setEditStates({ nuevo: null })
          setActiveTab("lista") // Volver a la lista en caso de error
        }
      } else {
        // No hay draft, y la tab activa era "nuevo", lo cual no tiene sentido sin un producto a editar o un draft.
        // Forzar a la pestaña de lista y limpiar editProducto.
        setActiveTab("lista")
        setEditStates({ nuevo: null }) // Asegurar que no haya un producto para editar si no hay draft
      }
    } else if (savedActiveTab && savedActiveTab.startsWith("editar-")) {
      // Lógica para restaurar un producto en edición si es necesario (más complejo)
      // Por ahora, si se recarga en una pestaña de edición, podría perderse el contexto.
      // Considerar guardar el ID del producto en edición en localStorage también.
      // O simplemente forzar a la lista para simplificar.
      // setActiveTab('lista');
      // setEditProducto(null);
    }
    // Si la activeTab no es 'nuevo', editProducto debería ser null o el producto que se está editando
    // (que se setea al hacer click en editar).
    if (savedActiveTab !== "nuevo" && !savedActiveTab?.startsWith("editar-")) {
      setEditStates({ ...editStates, [savedActiveTab]: null }) // Limpiar si no estamos en nuevo/editar explícitamente
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Se ejecuta solo al montar

  // Tabs y edición
  const openTab = (key, label, producto = null) => {
    setTabs((prev) => {
      if (prev.find((t) => t.key === key)) return prev
      return [...prev, { key, label, closable: true }]
    })
    setActiveTab(key)
    setEditStates((prev) => {
      if (key === "nuevo") {
        // Draft de nuevo producto
        const stockFormDraft = localStorage.getItem("stockFormDraft")
        if (stockFormDraft) {
          try {
            const draftData = JSON.parse(stockFormDraft)
            if (!draftData.id) {
              return { ...prev, [key]: draftData }
            } else {
              localStorage.removeItem("stockFormDraft")
              return { ...prev, [key]: null }
            }
          } catch {
            localStorage.removeItem("stockFormDraft")
            return { ...prev, [key]: null }
          }
        } else {
          return { ...prev, [key]: null }
        }
      } else {
        // Edición
        return { ...prev, [key]: producto }
      }
    })
  }
  const closeTab = (key) => {
    setTabs((prev) => prev.filter((t) => t.key !== key))
    if (activeTab === key) setActiveTab("lista")
    setEditStates((prev) => {
      const newStates = { ...prev }
      delete newStates[key]
      return newStates
    })
    if (key === "nuevo") {
      localStorage.removeItem("stockFormDraft")
    }
  }

  // Guardar producto (alta o edición)
  const handleSaveProducto = async (data, key) => {
    try {
      if (key.startsWith("editar-") && editStates[key] && editStates[key].id) {
        await updateProducto(editStates[key].id, data)
      } else if (!data.id) {
        // Solo crear si NO tiene id (es decir, si no fue creado por el endpoint atómico)
        await addProducto(data)
      }
      closeTab(key)
      // Recargar la lista de productos para actualizar la vista en tiempo real
      await fetch("/api/productos/", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          setProductos(data)
        })
    } catch (err) {
      throw err
    }
  }

  // Editar producto
  const handleEditProducto = (producto) => {
    const editKey = `editar-${producto.id}`
    openTab(editKey, `Editar Producto: ${producto.deno.substring(0, 15)}...`, producto)
  }

  // Actualizar stock de un proveedor específico
  const handleUpdateStock = (stockId, providerId) => {
    setUpdateStockModal({ show: true, stockId, providerId })
  }

  // Nuevo: obtener el registro de stockprove a editar
  const stockProveToEdit = stockProve.find(
    (sp) => sp.stock === updateStockModal.stockId && sp.proveedor === updateStockModal.providerId,
  )
  const [editStockValues, setEditStockValues] = useState({ cantidad: "", costo: "" })
  useEffect(() => {
    if (updateStockModal.show && stockProveToEdit) {
      setEditStockValues({ cantidad: stockProveToEdit.cantidad, costo: stockProveToEdit.costo })
    }
  }, [updateStockModal, stockProveToEdit])

  const handleStockUpdate = async (stockId, providerId, cantidad, costo) => {
    if (stockProveToEdit) {
      await updateStockProve(stockProveToEdit.id, {
        cantidad: Number.parseFloat(cantidad),
        costo: Number.parseFloat(costo),
      })
    }
    setUpdateStockModal({ show: false, stockId: null, providerId: null })
  }

  const handleLogout = () => {
    // Aquí tu lógica real de logout (borrar token, limpiar storage, redirigir, etc)
    setUser(null)
    window.location.href = "/login" // o la ruta de tu login
  }

  // Función global para refrescar el producto editado desde la API y actualizar el estado de edición
  window.refrescarProductoEditado = async (productoId) => {
    try {
      const res = await fetch(`/api/productos/stock/${productoId}/`, { credentials: "include" })
      if (!res.ok) throw new Error("No se pudo refrescar el producto")
      const data = await res.json()
      const editKey = `editar-${productoId}`
      // Actualiza el estado editStates solo para la pestaña correspondiente
      if (typeof window.setEditStatesProductosManager === "function") {
        window.setEditStatesProductosManager((prev) => ({ ...prev, [editKey]: data }))
      }
    } catch (e) {
      /* opcional: mostrar error */
    }
  }
  // Permite que StockForm pueda actualizar el estado de edición
  window.setEditStatesProductosManager = setEditStates

  // Filtrar productos activos/inactivos con memo para rendimiento
  const productosActivos = useMemo(() => productos.filter((p) => p.acti === "S"), [productos])
  const productosInactivos = useMemo(() => productos.filter((p) => p.acti === "N"), [productos])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30 flex flex-col">
      <Navbar user={user} onLogout={handleLogout} />
      <div className="flex justify-between items-center px-6 py-4">
        <h2 className="text-2xl font-bold text-slate-800">Gestión de Productos y Stock</h2>
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
            {/* Botón Nuevo Producto solo en la tab de lista */}
            {activeTab === "lista" && (
              <div className="flex-1 flex justify-end mb-2">
                <button
                  onClick={() => openTab("nuevo", "Nuevo Producto")}
                  className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
                >
                  <span className="text-lg">+</span> Nuevo Producto
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 bg-white rounded-b-xl shadow-md min-h-0 p-6 border border-slate-200">
            {activeTab === "lista" && (
              <ProductosTable
                productos={productosActivos}
                familias={familias}
                proveedores={proveedores}
                setProveedores={addProveedor}
                search={search}
                setSearch={setSearch}
                expandedId={expandedId}
                setExpandedId={setExpandedId}
                groupByFamilia={groupByFamilia}
                setGroupByFamilia={setGroupByFamilia}
                selectedNivel={selectedNivel}
                setSelectedNivel={setSelectedNivel}
                addFamilia={addFamilia}
                updateFamilia={updateFamilia}
                deleteFamilia={deleteFamilia}
                addProveedor={addProveedor}
                updateProveedor={updateProveedor}
                deleteProveedor={deleteProveedor}
                deleteProducto={deleteProducto}
                onEdit={handleEditProducto}
                onUpdateStock={handleUpdateStock}
              />
            )}
            {activeTab === "inactivos" && (
              <ProductosTable
                productos={productosInactivos}
                familias={familias}
                proveedores={proveedores}
                setProveedores={addProveedor}
                search={searchInactivos}
                setSearch={setSearchInactivos}
                expandedId={expandedId}
                setExpandedId={setExpandedId}
                groupByFamilia={groupByFamilia}
                setGroupByFamilia={setGroupByFamilia}
                selectedNivel={selectedNivel}
                setSelectedNivel={setSelectedNivel}
                addFamilia={addFamilia}
                updateFamilia={updateFamilia}
                deleteFamilia={deleteFamilia}
                addProveedor={addProveedor}
                updateProveedor={updateProveedor}
                deleteProveedor={deleteProveedor}
                deleteProducto={deleteProducto}
                onEdit={handleEditProducto}
                onUpdateStock={handleUpdateStock}
              />
            )}
            {(activeTab === "nuevo" || activeTab.startsWith("editar-")) && (
              <StockForm
                key={activeTab}
                stock={editStates[activeTab]}
                modo={activeTab === "nuevo" ? "nuevo" : "editar"}
                onSave={(data) => handleSaveProducto(data, activeTab)}
                onCancel={() => closeTab(activeTab)}
                proveedores={proveedores.filter((p) => !!p.id)}
                familias={familias.filter((f) => !!f.id)}
              />
            )}
          </div>
        </div>
      </div>
      {/* Modal para actualizar stock */}
      {updateStockModal.show && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-xl w-96 border border-slate-200">
            <h3 className="text-lg font-medium mb-4 text-slate-800">Actualizar Stock</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleStockUpdate(
                  updateStockModal.stockId,
                  updateStockModal.providerId,
                  editStockValues.cantidad,
                  editStockValues.costo,
                )
              }}
            >
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-600">Nueva Cantidad</label>
                <input
                  type="number"
                  name="cantidad"
                  value={editStockValues.cantidad}
                  onChange={(e) => setEditStockValues((v) => ({ ...v, cantidad: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 transition-all duration-200"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-600">Nuevo Costo</label>
                <input
                  type="number"
                  name="costo"
                  step="0.01"
                  value={editStockValues.costo}
                  onChange={(e) => setEditStockValues((v) => ({ ...v, costo: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 transition-all duration-200"
                  required
                />
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setUpdateStockModal({ show: false, stockId: null, providerId: null })}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-lg transition-all duration-200 shadow-lg"
                >
                  Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductosManager
