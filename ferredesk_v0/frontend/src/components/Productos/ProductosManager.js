import { useEffect, useState, useMemo, useCallback } from "react"
import Navbar from "../Navbar"
import StockForm from "./StockForm"
import ProductosTable from "./ProductosTable"
import FiltrosProductos from "./FiltrosProductos"
import { useProductosAPI } from "../../utils/useProductosAPI"
import { useFamiliasAPI } from "../../utils/useFamiliasAPI"
import { useProveedoresAPI } from "../../utils/useProveedoresAPI"
import { useStockProveAPI } from "../../utils/useStockProveAPI"
import { usePaginacionAPI } from "../../hooks/usePaginacionAPI"
import { useLogoutMutation } from "../../domains/session/useLogoutMutation"
import { useSessionUserQuery } from "../../domains/session/useSessionUserQuery"

// Importar el modal de familias
import FamiliasModal from "./FamiliasModal"

// Importar el modal de listas de precios
import ListasPrecioModal from "./ListasPrecioModal"

// Modal de impresión de etiquetas de código de barras
import { ImprimirEtiquetasModal } from "./codigoBarras"

// Hook del tema de FerreDesk
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { leerConsultaPersistida, guardarConsultaPersistida } from "../../utils/consultaPersistida"

const ProductosManager = () => {
  // Hook del tema de FerreDesk
  const theme = useFerreDeskTheme()

  useEffect(() => {
    document.title = "Productos FerreDesk"
  }, [])

  // Hooks API: mutaciones (alta, baja, modificación) siguen usando useProductosAPI
  const { addProducto, updateProducto, deleteProducto } = useProductosAPI()
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

  const [editStates, setEditStates] = useState(() => {
    const savedStates = localStorage.getItem("productosEditStates")
    return savedStates ? JSON.parse(savedStates) : {}
  })

  // Guardar editStates en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem("productosEditStates", JSON.stringify(editStates))
  }, [editStates])
  const [expandedId, setExpandedId] = useState(null)
  const [updateStockModal, setUpdateStockModal] = useState({ show: false, stockId: null, providerId: null })
  const [showFamiliasModal, setShowFamiliasModal] = useState(false)
  const [showListasPrecioModal, setShowListasPrecioModal] = useState(false)
  const [productoParaImprimirEtiquetas, setProductoParaImprimirEtiquetas] = useState(null)
  const { user } = useSessionUserQuery()
  const { logout } = useLogoutMutation()

  // Estado de búsqueda para ProductosTable
  const [searchProductos, setSearchProductos] = useState(() => leerConsultaPersistida("productos_search", ""))
  const [searchVal, setSearchVal] = useState(() => leerConsultaPersistida("productos_search", ""))

  const handleBuscarProductos = useCallback(() => {
    if (!searchVal || searchVal.trim() === "") return
    setSearchProductos(searchVal)
    guardarConsultaPersistida("productos_search", searchVal)
    setPagina(1)
  }, [searchVal])

  const handleLimpiarBusquedaProductos = useCallback(() => {
    setSearchVal("")
    setSearchProductos("")
    guardarConsultaPersistida("productos_search", "")
    setPagina(1)
  }, [])

  // Estado de paginación
  const [pagina, setPagina] = useState(1)
  const [itemsPorPagina, setItemsPorPagina] = useState(10)

  // Estado de ordenamiento
  const [ordenamiento, setOrdenamiento] = useState('desc') // 'asc' o 'desc'

  // Toggle para buscar por código de proveedor en lugar de código de venta/denominación
  const [buscarPorCodigoProveedor, setBuscarPorCodigoProveedor] = useState(false)

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
    // También limpiar el borrador del form
    // También limpiar el borrador del form y estados relacionados
    const claveBorrador = key.startsWith("editar-")
      ? `stockFormDraft_${key.split("-")[1]}`
      : `stockFormDraft_${key}`
    try {
      localStorage.removeItem(claveBorrador)
      localStorage.removeItem(`${claveBorrador}_precios`)
      localStorage.removeItem(`${claveBorrador}_spPendientes`)
      localStorage.removeItem(`${claveBorrador}_codPendientes`)
      localStorage.removeItem(`${claveBorrador}_provAgregados`)
      localStorage.removeItem(`${claveBorrador}_codPendEdic`)
    } catch (_) { }
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
      // Invalidar caché para que la tabla se refresque sin recargar la página
      invalidarCache()
      closeTab(key)
    } catch (err) {
      // Mostrar el error como alerta nativa del navegador
      alert(err.message)
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
    } catch (_) { }
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
    logout().finally(() => {
      window.location.href = "/login/"
    })
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

  // Función para manejar cambios de ordenamiento
  const handleOrdenamientoChange = useCallback((nuevoOrdenamiento) => {
    setOrdenamiento(nuevoOrdenamiento ? 'asc' : 'desc');
    setPagina(1); // Resetear a página 1 cuando cambia el ordenamiento
  }, []);

  // Construir los filtros de forma reactiva para que el hook los detecte
  const filtrosProductos = useMemo(() => {
    const f = {}
    if (fam1Filtro) f.idfam1 = fam1Filtro
    if (fam2Filtro) f.idfam2 = fam2Filtro
    if (fam3Filtro) f.idfam3 = fam3Filtro
    if (activeTab === "lista") f.acti = "S"
    else if (activeTab === "inactivos") f.acti = "N"
    if ((searchProductos || '').trim()) {
      if (buscarPorCodigoProveedor) f.search_codigo_proveedor = searchProductos.trim()
      else f.search = searchProductos.trim()
    }
    f.orden = 'id'
    f.direccion = ordenamiento
    return f
  }, [fam1Filtro, fam2Filtro, fam3Filtro, activeTab, searchProductos, buscarPorCodigoProveedor, ordenamiento])

  // Hook genérico para consultar datos paginados con caché de TanStack Query
  const { datos: productos, total, cargando: loadingProductos, invalidarCache } = usePaginacionAPI(
    'productos',
    '/api/productos/stock/',
    filtrosProductos,
    pagina,
    itemsPorPagina,
    { enabled: !!(searchProductos && searchProductos.trim() !== "") }
  )

  // Filtrar productos activos/inactivos con memo para rendimiento
  // Si el campo acti no está presente, mostrar todos los productos como activos
  const productosActivosBase = useMemo(() => {
    if (!searchProductos || searchProductos.trim() === "") return []
    if (productos.length > 0 && productos[0].acti === undefined) {
      // Si el campo acti no está presente, mostrar todos los productos
      return productos
    }
    return productos.filter((p) => p.acti === "S")
  }, [productos, searchProductos])

  const productosInactivosBase = useMemo(() => {
    if (!searchProductos || searchProductos.trim() === "") return []
    if (productos.length > 0 && productos[0].acti === undefined) {
      // Si el campo acti no está presente, no mostrar productos inactivos
      return []
    }
    return productos.filter((p) => p.acti === "N")
  }, [productos, searchProductos])

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
                    className={`flex items-center px-5 py-3 mr-2 rounded-t-lg cursor-pointer transition-colors ${activeTab === tab.key
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
                {/* Filtros y acciones para las tabs de lista y inactivos */}
                {(activeTab === "lista" || activeTab === "inactivos") && (
                  <FiltrosProductos
                    familias={familias}
                    fam1Filtro={fam1Filtro}
                    setFam1Filtro={setFam1Filtro}
                    fam2Filtro={fam2Filtro}
                    setFam2Filtro={setFam2Filtro}
                    fam3Filtro={fam3Filtro}
                    setFam3Filtro={setFam3Filtro}
                    buscarPorCodigoProveedor={buscarPorCodigoProveedor}
                    setBuscarPorCodigoProveedor={setBuscarPorCodigoProveedor}
                    setSearchProductos={setSearchVal}
                    onNuevoProducto={() => openTab(`nuevo-${Date.now()}`, "Nuevo Producto")}
                    onGestionarFamilias={() => setShowFamiliasModal(true)}
                    onActualizarListas={() => setShowListasPrecioModal(true)}
                  />
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
                    addFamilia={addFamilia}
                    updateFamilia={updateFamilia}
                    deleteFamilia={deleteFamilia}
                    addProveedor={addProveedor}
                    updateProveedor={updateProveedor}
                    deleteProveedor={deleteProveedor}
                    deleteProducto={deleteProducto}
                    onEdit={handleEditProducto}
                    onImprimirCodigoBarras={setProductoParaImprimirEtiquetas}
                    onUpdateStock={handleUpdateStock}
                    searchProductos={searchVal}
                    setSearchProductos={setSearchVal}
                    buscarPorCodigoProveedor={buscarPorCodigoProveedor}
                    onBuscar={handleBuscarProductos}
                    onLimpiar={handleLimpiarBusquedaProductos}
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
                    addFamilia={addFamilia}
                    updateFamilia={updateFamilia}
                    deleteFamilia={deleteFamilia}
                    addProveedor={addProveedor}
                    updateProveedor={updateProveedor}
                    deleteProveedor={deleteProveedor}
                    deleteProducto={deleteProducto}
                    onEdit={handleEditProducto}
                    onImprimirCodigoBarras={setProductoParaImprimirEtiquetas}
                    onUpdateStock={handleUpdateStock}
                    searchProductos={searchVal}
                    setSearchProductos={setSearchVal}
                    buscarPorCodigoProveedor={buscarPorCodigoProveedor}
                    onBuscar={handleBuscarProductos}
                    onLimpiar={handleLimpiarBusquedaProductos}
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

      {/* Modal para gestionar listas de precios */}
      <ListasPrecioModal
        open={showListasPrecioModal}
        onClose={() => setShowListasPrecioModal(false)}
        onEditProducto={handleEditProducto}
      />

      <ImprimirEtiquetasModal
        open={!!productoParaImprimirEtiquetas}
        onClose={() => setProductoParaImprimirEtiquetas(null)}
        productos={productoParaImprimirEtiquetas ? [productoParaImprimirEtiquetas] : []}
      />
    </div>
  )
}

export default ProductosManager
