"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import Navbar from "../Navbar"
import StockForm from "./StockForm"
import ProductosTable from "./ProductosTable"
import { useProductosAPI } from "../../utils/useProductosAPI"
import { useFamiliasAPI } from "../../utils/useFamiliasAPI"
import { useProveedoresAPI } from "../../utils/useProveedoresAPI"
import { useStockProveAPI } from "../../utils/useStockProveAPI"

// Importar el modal de familias
import FamiliasModal from "./FamiliasModal"

// Hook del tema de FerreDesk
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

const ProductosManager = () => {
  // Hook del tema de FerreDesk
  const theme = useFerreDeskTheme()
  
  useEffect(() => {
    document.title = "Productos FerreDesk"
  }, [])

  // Hooks API
  const { productos, total, loading: loadingProductos, fetchProductos, addProducto, updateProducto, deleteProducto } = useProductosAPI()
  const { familias, addFamilia, updateFamilia, deleteFamilia } = useFamiliasAPI()
  const { proveedores, addProveedor, updateProveedor, deleteProveedor } = useProveedoresAPI()
  const { stockProve, updateStockProve } = useStockProveAPI()

  // Filtros de familia (nivel 1/2/3)
  const [fam1Filtro, setFam1Filtro] = useState("")
  const [fam2Filtro, setFam2Filtro] = useState("")
  const [fam3Filtro, setFam3Filtro] = useState("")

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
  const [updateStockModal, setUpdateStockModal] = useState({ show: false, stockId: null, providerId: null })
  const [showFamiliasModal, setShowFamiliasModal] = useState(false)
  const [user, setUser] = useState({ username: "ferreadmin" })

  // Estado de búsqueda para ProductosTable
  const [searchProductos, setSearchProductos] = useState("")

  // Estado de paginación
  const [pagina, setPagina] = useState(1)
  const [itemsPorPagina, setItemsPorPagina] = useState(10)
  
  // Estado de ordenamiento
  const [ordenamiento, setOrdenamiento] = useState('desc') // 'asc' o 'desc'

  // Guardar estado de pestañas en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem("productosTabs", JSON.stringify(tabs))
    localStorage.setItem("productosActiveTab", activeTab)
  }, [tabs, activeTab])

  // Eliminado manejo antiguo de draft global; cada pestaña tendrá su propia clave de borrador

  // Tabs y edición
  const openTab = (key, label, producto = null) => {
    setTabs((prev) => {
      if (prev.find((t) => t.key === key)) return prev
      return [...prev, { key, label, closable: true, producto }]
    })
    setActiveTab(key)
    setEditStates((prev) => ({ ...prev, [key]: producto }))
  }
  const closeTab = (key) => {
    setTabs((prev) => prev.filter((t) => t.key !== key))
    if (activeTab === key) setActiveTab("lista")
    setEditStates((prev) => {
      const newStates = { ...prev }
      delete newStates[key]
      return newStates
    })
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
    } catch (err) {
      throw err
    }
  }

  // Editar producto
  const handleEditProducto = async (producto) => {
    const editKey = `editar-${producto.id}-${Date.now()}`
    // Abrir tab con placeholder rápido
    openTab(editKey, `Editar Producto: ${producto.deno.substring(0, 15)}...`, producto)
    try {
      // Cargar DETALLE optimizado (incluye stock_proveedores con proveedor)
      const res = await fetch(`/api/productos/stock/${producto.id}/`, { credentials: 'include' })
      if (res.ok) {
        const detalle = await res.json()
        setEditStates((prev) => ({ ...prev, [editKey]: detalle }))
      }
    } catch (_) {}
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
  // Si el campo acti no está presente, mostrar todos los productos como activos
  const productosActivosBase = useMemo(() => {
    if (productos.length > 0 && productos[0].acti === undefined) {
      // Si el campo acti no está presente, mostrar todos los productos
      return productos
    }
    return productos.filter((p) => p.acti === "S")
  }, [productos])
  
  const productosInactivosBase = useMemo(() => {
    if (productos.length > 0 && productos[0].acti === undefined) {
      // Si el campo acti no está presente, no mostrar productos inactivos
      return []
    }
    return productos.filter((p) => p.acti === "N")
  }, [productos])

  const aplicaFiltrosFamilia = useCallback((prod) => {
    const fam1 = prod.idfam1 && typeof prod.idfam1 === "object" ? prod.idfam1.id : prod.idfam1
    const fam2 = prod.idfam2 && typeof prod.idfam2 === "object" ? prod.idfam2.id : prod.idfam2
    const fam3 = prod.idfam3 && typeof prod.idfam3 === "object" ? prod.idfam3.id : prod.idfam3
    if (fam1Filtro && String(fam1Filtro) !== String(fam1)) return false
    if (fam2Filtro && String(fam2Filtro) !== String(fam2)) return false
    if (fam3Filtro && String(fam3Filtro) !== String(fam3)) return false
    return true
  }, [fam1Filtro, fam2Filtro, fam3Filtro])

  const productosActivos = useMemo(() => productosActivosBase.filter(aplicaFiltrosFamilia), [productosActivosBase, aplicaFiltrosFamilia])
  const productosInactivos = useMemo(() => productosInactivosBase.filter(aplicaFiltrosFamilia), [productosInactivosBase, aplicaFiltrosFamilia])

  // ------------------------------------------------------------------
  // Paginación controlada y recarga server-side
  // Función para manejar cambios de ordenamiento
  const handleOrdenamientoChange = useCallback((nuevoOrdenamiento) => {
    setOrdenamiento(nuevoOrdenamiento ? 'asc' : 'desc');
    setPagina(1); // Resetear a página 1 cuando cambia el ordenamiento
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const filtros = {};
      if (fam1Filtro) filtros.idfam1 = fam1Filtro;
      if (fam2Filtro) filtros.idfam2 = fam2Filtro;
      if (fam3Filtro) filtros.idfam3 = fam3Filtro;
      // Filtro por estado según la tab activa
      if (activeTab === "lista") {
        filtros.acti = "S";
      } else if (activeTab === "inactivos") {
        filtros.acti = "N";
      }
      // Búsqueda remota por denominación
      if ((searchProductos || '').trim()) {
        filtros['deno__icontains'] = searchProductos.trim();
      }
      fetchProductos(filtros, pagina, itemsPorPagina, 'id', ordenamiento);
    }, 200);
    return () => clearTimeout(timeout);
  }, [fam1Filtro, fam2Filtro, fam3Filtro, activeTab, pagina, itemsPorPagina, searchProductos, ordenamiento, fetchProductos]);

  // Resetear a página 1 cuando cambian filtros o búsqueda
  useEffect(() => {
    setPagina(1)
  }, [fam1Filtro, fam2Filtro, fam3Filtro, activeTab, searchProductos])

  // Exponer handlers para ProductosTable sin romper la API del componente
  if (typeof window !== 'undefined') {
    window.__productos_paginacion_controlada = true
    window.__productos_pagina = pagina
    window.__productos_setPagina = setPagina
    window.__productos_itemsPorPagina = itemsPorPagina
    window.__productos_setItemsPorPagina = setItemsPorPagina
    window.__productos_total = total
  }

  return (
    <div className={theme.fondo}>
      <div className={theme.patron}></div>
      <div className={theme.overlay}></div>
      
      <div className="relative z-10">
        <Navbar user={user} onLogout={handleLogout} />

        {/* Contenedor central con ancho máximo fijo */}
        <div className="py-8 px-4">
          <div className="max-w-[1400px] w-full mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Gestión de Productos y Stock</h2>
            </div>

          {/* Área principal: pestañas y contenido */}
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200 max-w-full">
            {/* Tabs tipo browser - Encabezado azul oscuro */}
            <div className="flex items-center border-b border-slate-700 px-6 pt-3 bg-gradient-to-r from-slate-800 to-slate-700">
              {tabs.map((tab) => (
                <div
                  key={tab.key}
                  className={`flex items-center px-5 py-3 mr-2 rounded-t-lg cursor-pointer transition-colors ${
                    activeTab === tab.key
                      ? theme.tabActiva
                      : theme.tabInactiva
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                  style={{ position: "relative", zIndex: 1 }}
                >
                  {tab.label}
                  {tab.closable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(tab.key)
                      }}
                      className="ml-3 text-lg font-bold text-slate-400 hover:text-red-500 focus:outline-none transition-colors"
                      title="Cerrar"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex-1 p-6">
              {/* Botones de acción solo en la tab de lista */}
              {activeTab === "lista" && (
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={() => openTab(`nuevo-${Date.now()}`, "Nuevo Producto")}
                    className={theme.botonPrimario}
                  >
                    <span className="text-lg">+</span> Nuevo Producto
                  </button>
                  <button
                    onClick={() => setShowFamiliasModal(true)}
                    className={theme.botonPrimario}
                  >
                    Gestionar Familias
                  </button>
                </div>
              )}
              {/* Contenido de pestañas */}
              {activeTab === "lista" && (
                <ProductosTable
                  productos={productosActivos}
                  familias={familias}
                  proveedores={proveedores}
                  setProveedores={addProveedor}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  fam1Filtro={fam1Filtro}
                  setFam1Filtro={setFam1Filtro}
                  fam2Filtro={fam2Filtro}
                  setFam2Filtro={setFam2Filtro}
                  fam3Filtro={fam3Filtro}
                  setFam3Filtro={setFam3Filtro}
                  addFamilia={addFamilia}
                  updateFamilia={updateFamilia}
                  deleteFamilia={deleteFamilia}
                  addProveedor={addProveedor}
                  updateProveedor={updateProveedor}
                  deleteProveedor={deleteProveedor}
                  deleteProducto={deleteProducto}
                  onEdit={handleEditProducto}
                  onUpdateStock={handleUpdateStock}
                  searchProductos={searchProductos}
                  setSearchProductos={setSearchProductos}
                  paginacionControlada={true}
                  paginaActual={pagina}
                  onPageChange={setPagina}
                  itemsPerPage={itemsPorPagina}
                  onItemsPerPageChange={setItemsPorPagina}
                  totalRemoto={total}
                  busquedaRemota={true}
                  onOrdenamientoChange={handleOrdenamientoChange}
                  ordenamientoControlado={ordenamiento === 'asc'}
                  cargando={loadingProductos}
                />
              )}
              {activeTab === "inactivos" && (
                <ProductosTable
                  productos={productosInactivos}
                  familias={familias}
                  proveedores={proveedores}
                  setProveedores={addProveedor}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  fam1Filtro={fam1Filtro}
                  setFam1Filtro={setFam1Filtro}
                  fam2Filtro={fam2Filtro}
                  setFam2Filtro={setFam2Filtro}
                  fam3Filtro={fam3Filtro}
                  setFam3Filtro={setFam3Filtro}
                  addFamilia={addFamilia}
                  updateFamilia={updateFamilia}
                  deleteFamilia={deleteFamilia}
                  addProveedor={addProveedor}
                  updateProveedor={updateProveedor}
                  deleteProveedor={deleteProveedor}
                  deleteProducto={deleteProducto}
                  onEdit={handleEditProducto}
                  onUpdateStock={handleUpdateStock}
                  searchProductos={searchProductos}
                  setSearchProductos={setSearchProductos}
                  paginacionControlada={true}
                  paginaActual={pagina}
                  onPageChange={setPagina}
                  itemsPerPage={itemsPorPagina}
                  onItemsPerPageChange={setItemsPorPagina}
                  totalRemoto={total}
                  busquedaRemota={true}
                  onOrdenamientoChange={handleOrdenamientoChange}
                  ordenamientoControlado={ordenamiento === 'asc'}
                  cargando={loadingProductos}
                />
              )}
              {activeTab !== "lista" && activeTab !== "inactivos" && (
                <StockForm
                  key={activeTab}
                  stock={editStates[activeTab]}
                  modo={activeTab.startsWith("nuevo") ? "nuevo" : "editar"}
                  tabKey={activeTab}
                  onSave={(data) => handleSaveProducto(data, activeTab)}
                  onCancel={() => closeTab(activeTab)}
                  proveedores={proveedores.filter((p) => !!p.id)}
                  familias={familias.filter((f) => !!f.id)}
                />
              )}
            </div>
          </div>
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
                  className={theme.botonPrimario}
                >
                  Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para gestionar familias */}
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

export default ProductosManager
