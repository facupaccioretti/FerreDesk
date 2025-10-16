"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import Navbar from "../Navbar"
import ComprasList from "./ComprasList"
import CompraForm from "./CompraForm"
import DetalleCompra from "./DetalleCompra"
import OrdenCompraList from "./OrdenCompraList"
import OrdenCompraForm from "./OrdenCompraForm"
import ConversionCompraModal from "./ConversionCompraModal"
import ProveedorSelectorModal from "./ProveedorSelectorModal"
import { useComprasAPI } from "../../utils/useComprasAPI"
import useOrdenCompraAPI from "../../utils/useOrdenCompraAPI"
import { useProveedoresAPI } from "../../utils/useProveedoresAPI"
import { useProductosAPI } from "../../utils/useProductosAPI"
import { useAlicuotasIVAAPI } from "../../utils/useAlicuotasIVAAPI"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

const MAIN_TAB_KEY = "compras"
const ORDENES_TAB_KEY = "ordenes-compra"

const ComprasManager = () => {
  const theme = useFerreDeskTheme()
  
  const [user, setUser] = useState(null)
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  
  // Estado de paginación para órdenes de compra
  const [currentPageOrdenes, setCurrentPageOrdenes] = useState(1)
  const [pageSizeOrdenes, setPageSizeOrdenes] = useState(10)
  
  // Estado de ordenamiento
  const [ordenamiento, setOrdenamiento] = useState('desc') // 'asc' o 'desc'
  
  // Estado para controlar el modal de detalle (compra u orden)
  const [detalleModal, setDetalleModal] = useState({ abierto: false, modo: "compra", compra: null, orden: null })
  
  // Estado para controlar el modal de conversión de órdenes
  const [conversionModal, setConversionModal] = useState({ 
    abierto: false, 
    ordenCompra: null,
    loading: false 
  })

  // Estado para controlar el modal de selección de proveedor
  const [proveedorSelectorModal, setProveedorSelectorModal] = useState({ 
    abierto: false 
  })

  // Tabs estado (persistencia simple en localStorage)
  const [tabs, setTabs] = useState(() => {
    try {
      const saved = localStorage.getItem("comprasTabs")
      const parsed = saved ? JSON.parse(saved) : null
      const base = [
        { key: MAIN_TAB_KEY, label: "Compras", closable: false },
        { key: ORDENES_TAB_KEY, label: "Órdenes de Compra", closable: false }
      ]
      if (!parsed || !Array.isArray(parsed) || parsed.length === 0) return base
      // Asegurar que las pestañas principales existan
      const hasMain = parsed.some((t) => t.key === MAIN_TAB_KEY)
      const hasOrdenes = parsed.some((t) => t.key === ORDENES_TAB_KEY)
      let result = parsed
      if (!hasMain) result = [base[0], ...result]
      if (!hasOrdenes) result = [...result, base[1]]
      return result
    } catch {
      return [
        { key: MAIN_TAB_KEY, label: "Compras", closable: false },
        { key: ORDENES_TAB_KEY, label: "Órdenes de Compra", closable: false }
      ]
    }
  })
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem("comprasActiveTab") || MAIN_TAB_KEY)
  const persistTimeout = useRef(null)
  useEffect(() => {
    clearTimeout(persistTimeout.current)
    persistTimeout.current = setTimeout(() => {
      localStorage.setItem("comprasTabs", JSON.stringify(tabs))
      localStorage.setItem("comprasActiveTab", activeTab)
    }, 200)
    return () => clearTimeout(persistTimeout.current)
  }, [tabs, activeTab])

  const openTab = useCallback((key, label, data = null, tipo = null) => {
    setTabs((prev) => {
      if (prev.find((t) => t.key === key)) return prev
      return [...prev, { key, label, closable: true, data, tipo }]
    })
    setActiveTab(key)
  }, []) // Las funciones setState son estables

  const closeTab = useCallback((key) => {
    setTabs((prev) => prev.filter((t) => t.key !== key))
    if (activeTab === key) {
      // Si es una pestaña de órdenes, volver a órdenes, sino a compras
      if (key.includes('orden')) {
        setActiveTab(ORDENES_TAB_KEY)
      } else {
        setActiveTab(MAIN_TAB_KEY)
      }
    }
  }, [activeTab]) // Depende del valor de activeTab

  // APIs
  const {
    compras,
    loading: loadingCompras,
    error: errorCompras,
    pagination,
    fetchCompras,
    addCompra,
    updateCompra,
    deleteCompra,
    cerrarCompra,
    anularCompra,
  } = useComprasAPI()

  const {
    ordenesCompra,
    loading: loadingOrdenesCompra,
    error: errorOrdenesCompra,
    getOrdenesCompra,
    createOrdenCompra,
    updateOrdenCompra,
    deleteOrdenCompra,
    getOrdenCompraItems,
    convertirOrdenCompraACompra,
  } = useOrdenCompraAPI()

  const { proveedores, loading: loadingProveedores, error: errorProveedores } = useProveedoresAPI()
  const { productos, loading: loadingProductos, error: errorProductos } = useProductosAPI()
  const { alicuotas, loading: loadingAlicuotas, error: errorAlicuotas } = useAlicuotasIVAAPI()

  const sucursales = [{ id: 1, nombre: "Casa Central" }]

  useEffect(() => {
    fetch("/api/user/", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") setUser(data.user)
      })
  }, [])

  const handleLogout = () => {
    setUser(null)
    window.location.href = "/login/"
  }

  useEffect(() => {
    document.title = "Compras FerreDesk"
  }, [])

  // Efecto para cargar compras con filtros y paginación
  useEffect(() => {
    const filters = {}
    if (search.trim()) {
      filters.search = search.trim()
    }
    fetchCompras(filters, currentPage, pageSize, 'id', ordenamiento)
  }, [search, currentPage, pageSize, ordenamiento, fetchCompras])

  // Efecto para cargar órdenes de compra
  useEffect(() => {
    getOrdenesCompra({}, currentPageOrdenes, pageSizeOrdenes, 'id', ordenamiento)
  }, [getOrdenesCompra, currentPageOrdenes, pageSizeOrdenes, ordenamiento])

  // Acciones tabs
  const handleNuevaCompra = useCallback(() => {
    // Abrir modal de selección de proveedor primero
    setProveedorSelectorModal({ abierto: true, tipo: "compra" })
  }, [])

  const handleNuevaOrdenCompra = useCallback(() => {
    // Abrir modal de selección de proveedor primero
    setProveedorSelectorModal({ abierto: true, tipo: "orden" })
  }, [])

  const handleProveedorSeleccionado = useCallback((proveedor) => {
    // Cerrar modal y abrir formulario con el proveedor seleccionado
    const tipo = proveedorSelectorModal.tipo
    setProveedorSelectorModal({ abierto: false })
    
    if (tipo === "compra") {
      const key = `nueva-compra-${Date.now()}`
      openTab(key, "Nueva Compra", { proveedorSeleccionado: proveedor }, "form")
    } else if (tipo === "orden") {
      const key = `nueva-orden-compra-${Date.now()}`
      openTab(key, "Nueva Orden de Compra", { proveedorSeleccionado: proveedor }, "orden-form")
    }
  }, [openTab, proveedorSelectorModal.tipo])

  // Función para manejar cambios de ordenamiento
  const handleOrdenamientoChange = useCallback((nuevoOrdenamiento) => {
    setOrdenamiento(nuevoOrdenamiento ? 'asc' : 'desc');
    setCurrentPage(1); // Resetear a página 1 cuando cambia el ordenamiento
    setCurrentPageOrdenes(1); // Resetear a página 1 para órdenes también
  }, []);

  // Funciones para manejar paginación de órdenes de compra
  const handlePageChangeOrdenes = useCallback((page) => {
    setCurrentPageOrdenes(page);
  }, []);

  const handlePageSizeChangeOrdenes = useCallback((size) => {
    setPageSizeOrdenes(size);
    setCurrentPageOrdenes(1);
  }, []);

  const handleEditarCompra = useCallback((compra) => {
    const key = `editar-${compra.comp_id}`
    openTab(key, `Editar ${compra.comp_numero_factura || compra.comp_id}`, compra, "form")
  }, [openTab])

  const handleVerCompra = useCallback((compra) => {
    setDetalleModal({ abierto: true, modo: "compra", compra, orden: null })
  }, [])

  const handleGuardarCompra = useCallback(async (tabKey, compraData, existing = null) => {
    try {
      if (existing && existing.comp_id) {
        await updateCompra(existing.comp_id, compraData)
        alert("Compra actualizada correctamente")
      } else {
        await addCompra(compraData)
        alert("Compra creada correctamente")
      }
      await fetchCompras()
      closeTab(tabKey)
    } catch (error) {
      alert(`Error al guardar compra: ${error.message || error}`)
    }
  }, [updateCompra, addCompra, fetchCompras, closeTab])

  const handleCerrarCompra = useCallback(async (compraId) => {
    try {
      await cerrarCompra(compraId)
      alert("Compra cerrada correctamente")
      fetchCompras()
    } catch (error) {
      alert(`Error al cerrar compra: ${error.message || error}`)
    }
  }, [cerrarCompra, fetchCompras])

  const handleAnularCompra = useCallback(async (compraId) => {
    try {
      await anularCompra(compraId)
      alert("Compra anulada correctamente")
      fetchCompras()
    } catch (error) {
      alert(`Error al anular compra: ${error.message || error}`)
    }
  }, [anularCompra, fetchCompras])

  const handleEliminarCompra = useCallback(async (compraId) => {
    if (window.confirm("¿Está seguro de que desea eliminar esta compra?")) {
      try {
        await deleteCompra(compraId)
        alert("Compra eliminada correctamente")
        fetchCompras({}, currentPage, pageSize)
      } catch (error) {
        alert(`Error al eliminar compra: ${error.message || error}`)
      }
    }
  }, [deleteCompra, fetchCompras, currentPage, pageSize])

  // Handlers para paginación
  const handlePageChange = useCallback((page) => {
    setCurrentPage(page)
  }, [])

  const handlePageSizeChange = useCallback((newPageSize) => {
    setPageSize(newPageSize)
    setCurrentPage(1) // Reset a la primera página
  }, [])

  // Acciones para órdenes de compra

  const handleEditarOrdenCompra = useCallback(async (ordenCompra) => {
    try {
      // Cargar items de la orden antes de abrir el formulario
      const items = await getOrdenCompraItems(ordenCompra.ord_id)
      const ordenCompleta = { ...ordenCompra, items }
      const key = `editar-orden-${ordenCompra.ord_id}`
      openTab(key, `Editar ${ordenCompra.ord_numero || ordenCompra.ord_id}`, ordenCompleta, "orden-form")
    } catch (error) {
      alert(`Error al cargar items de la orden: ${error.message || error}`)
    }
  }, [openTab, getOrdenCompraItems])

  const handleVerOrdenCompra = useCallback((ordenCompra) => {
    // Abrir modal reutilizando DetalleCompra en modo "orden"
    setDetalleModal({ abierto: true, modo: "orden", compra: null, orden: ordenCompra })
  }, [])

  const handleConvertirOrdenCompra = useCallback(async (ordenCompra) => {
    try {
      // Cargar items de la orden
      const items = await getOrdenCompraItems(ordenCompra.ord_id)
      const ordenCompleta = { ...ordenCompra, items }
      setConversionModal({ 
        abierto: true, 
        ordenCompra: ordenCompleta,
        loading: false 
      })
    } catch (error) {
      alert(`Error al cargar items de la orden: ${error.message || error}`)
    }
  }, [getOrdenCompraItems])

  const handleGuardarOrdenCompra = useCallback(async (tabKey, ordenData, existing = null) => {
    try {
      if (existing && existing.ord_id) {
        await updateOrdenCompra(existing.ord_id, ordenData)
        alert("Orden de compra actualizada correctamente")
      } else {
        await createOrdenCompra(ordenData)
        alert("Orden de compra creada correctamente")
      }
      await getOrdenesCompra()
      closeTab(tabKey)
    } catch (error) {
      alert(`Error al guardar orden de compra: ${error.message || error}`)
    }
  }, [updateOrdenCompra, createOrdenCompra, getOrdenesCompra, closeTab])

  const handleEliminarOrdenCompra = useCallback(async (ordenId) => {
    if (window.confirm("¿Está seguro de que desea eliminar esta orden de compra?")) {
      try {
        await deleteOrdenCompra(ordenId)
        alert("Orden de compra eliminada correctamente")
        getOrdenesCompra()
      } catch (error) {
        alert(`Error al eliminar orden de compra: ${error.message || error}`)
      }
    }
  }, [deleteOrdenCompra, getOrdenesCompra])

  const handleGenerarPDF = useCallback(async (ordenCompra) => {
    try {
      const response = await fetch(`/api/ordenes-compra/${ordenCompra.ord_id}/export/pdf/`, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      // Obtener el blob del PDF
      const blob = await response.blob()
      
      // Crear URL temporal para descarga
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Obtener nombre del archivo desde el header Content-Disposition
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `Orden_Compra_${ordenCompra.ord_numero || ordenCompra.ord_id}.pdf`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      link.download = filename
      document.body.appendChild(link)
      link.click()
      
      // Limpiar
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
    } catch (error) {
      alert(`Error al generar PDF: ${error.message || error}`)
    }
  }, [])

  const handleConvertirOrdenACompra = useCallback(async (data) => {
    // En lugar de procesar directamente, abrir nueva pestaña
    const key = `conversion-orden-${data.orden_origen}-${Date.now()}`
    
    // Extraer IDs de los items seleccionados (nueva estructura con cantidades)
    const itemsSeleccionadosIds = data.items_seleccionados.map(item => item.id)
    
    openTab(key, `Convertir Orden a Compra`, {
      ordenOrigen: conversionModal.ordenCompra,
      itemsSeleccionados: conversionModal.ordenCompra.items.filter(item => 
        itemsSeleccionadosIds.includes(item.id)
      ),
      itemsSeleccionadosIds: itemsSeleccionadosIds,
      cantidadesRecibidas: data.items_seleccionados // Nueva: incluir cantidades recibidas
    }, "conversion-compra")
    
    // Cerrar modal
    setConversionModal({ abierto: false, ordenCompra: null, loading: false })
  }, [openTab, conversionModal.ordenCompra])

  // NUEVO: Handler para guardar la conversión
  const handleConCompraFormSave = useCallback(async (payload, tabKey) => {
    try {
      await convertirOrdenCompraACompra(payload)
      alert("Orden convertida a compra correctamente")
      await getOrdenesCompra() // Recargar órdenes
      await fetchCompras() // Recargar compras
      closeTab(tabKey)
      // Redirigir a la pestaña de compras para ver la nueva compra
      setActiveTab(MAIN_TAB_KEY)
    } catch (error) {
      alert(`Error al convertir orden a compra: ${error.message || error}`)
    }
  }, [convertirOrdenCompraACompra, getOrdenesCompra, fetchCompras, closeTab])

  const activeTabData = useMemo(() => tabs.find((t) => t.key === activeTab)?.data || null, [tabs, activeTab])
  const activeTabInfo = useMemo(() => tabs.find((t) => t.key === activeTab) || null, [tabs, activeTab])

  return (
    <div className={theme.fondo}>
      <div className={theme.patron}></div>
      <div className={theme.overlay}></div>
      
      <Navbar user={user} onLogout={handleLogout} />

      <div className="py-8 px-4 relative z-10">
        <div className="max-w-[1400px] w-full mx-auto">
          {/* Título de la página (fuera del contenedor) */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Gestión de Compras</h2>
          </div>

          {/* Tarjeta contenedora principal con tabs */}
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-md overflow-hidden">
            {/* Barra de tabs estilo navegador con encabezado azul FerreDesk */}
            <div className="border-b border-slate-700 px-6 pt-3 bg-gradient-to-r from-slate-800 to-slate-700">
              {tabs.map((tab) => (
                <div
                  key={tab.key}
                  className={`inline-flex items-center px-5 py-3 mr-2 rounded-t-lg cursor-pointer transition-colors ${activeTab === tab.key ? theme.tabActiva : theme.tabInactiva}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  {tab.closable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        
                        const confirmado = window.confirm('¿Está seguro de cerrar? Se perderán los cambios no guardados.');
                        if (!confirmado) return;
                        
                        closeTab(tab.key)
                      }}
                      className="ml-3 text-lg font-bold text-slate-300 hover:text-red-400 focus:outline-none transition-colors"
                      title="Cerrar"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Contenido por tab */}
            <div className="flex-1 p-6">
              {activeTab === MAIN_TAB_KEY ? (
                <>
                  {/* Botón Nueva Compra arriba de la tabla */}
                  <div className="mb-4 flex justify-start">
                    <button
                      onClick={handleNuevaCompra}
                      className={theme.botonPrimario}
                    >
                      <span className="text-lg">+</span> Nueva Compra
                    </button>
                  </div>
                  
                  <ComprasList
                    compras={compras}
                    loading={loadingCompras}
                    error={errorCompras}
                    search={search}
                    setSearch={setSearch}
                    onNuevaCompra={handleNuevaCompra}
                    onEditarCompra={handleEditarCompra}
                    onVerCompra={handleVerCompra}
                    onCerrarCompra={handleCerrarCompra}
                    onAnularCompra={handleAnularCompra}
                    onEliminarCompra={handleEliminarCompra}
                    onRefresh={() => fetchCompras({}, currentPage, pageSize, 'id', ordenamiento)}
                    // Paginación controlada
                    paginacionControlada={true}
                    paginaActual={currentPage}
                    onPageChange={handlePageChange}
                    itemsPerPage={pageSize}
                    onItemsPerPageChange={handlePageSizeChange}
                    totalRemoto={pagination.count}
                    // Ordenamiento
                    onOrdenamientoChange={handleOrdenamientoChange}
                    ordenamientoControlado={ordenamiento === 'asc'}
                    cargando={loadingCompras}
                  />
                </>
              ) : activeTab === ORDENES_TAB_KEY ? (
                <>
                  {/* Botón Nueva Orden de Compra arriba de la tabla */}
                  <div className="mb-4 flex justify-start">
                    <button
                      onClick={handleNuevaOrdenCompra}
                      className={theme.botonPrimario}
                    >
                      <span className="text-lg">+</span> Nueva Orden de Compra
                    </button>
                  </div>
                  
                  <OrdenCompraList
                    ordenesCompra={ordenesCompra}
                    loading={loadingOrdenesCompra}
                    error={errorOrdenesCompra}
                    onEditarOrdenCompra={handleEditarOrdenCompra}
                    onVerOrdenCompra={handleVerOrdenCompra}
                    onConvertirOrdenCompra={handleConvertirOrdenCompra}
                    onEliminarOrdenCompra={handleEliminarOrdenCompra}
                    onGenerarPDF={handleGenerarPDF}
                    // Paginación controlada
                    paginacionControlada={true}
                    paginaActual={currentPageOrdenes}
                    onPageChange={handlePageChangeOrdenes}
                    itemsPerPage={pageSizeOrdenes}
                    onItemsPerPageChange={handlePageSizeChangeOrdenes}
                    totalRemoto={0} // TODO: obtener total desde la API
                    // Ordenamiento
                    onOrdenamientoChange={handleOrdenamientoChange}
                    ordenamientoControlado={ordenamiento === 'asc'}
                    cargando={loadingOrdenesCompra}
                  />
                </>
              ) : activeTabInfo?.tipo === "orden-form" ? (
                <OrdenCompraForm
                  key={activeTab}
                  onSave={(data) => handleGuardarOrdenCompra(activeTab, data, activeTabData)}
                  onCancel={() => closeTab(activeTab)}
                  initialData={activeTabData}
                  readOnly={activeTab.startsWith('ver-')}
                  proveedores={proveedores}
                  productos={productos}
                  sucursales={sucursales}
                  loadingProveedores={loadingProveedores}
                  loadingProductos={loadingProductos}
                  errorProveedores={errorProveedores}
                  errorProductos={errorProductos}
                />
              ) : activeTabInfo?.tipo === "form" ? (
                <CompraForm
                  key={activeTab}
                  onSave={(data) => handleGuardarCompra(activeTab, data, activeTabData)}
                  onCancel={() => closeTab(activeTab)}
                  initialData={activeTabData}
                  readOnly={false}
                  proveedores={proveedores}
                  productos={productos}
                  alicuotas={alicuotas}
                  sucursales={sucursales}
                  loadingProveedores={loadingProveedores}
                  loadingProductos={loadingProductos}
                  loadingAlicuotas={loadingAlicuotas}
                  errorProveedores={errorProveedores}
                  errorProductos={errorProductos}
                  errorAlicuotas={errorAlicuotas}
                />
              ) : activeTabInfo?.tipo === "conversion-compra" ? (
                <CompraForm
                  key={activeTab}
                  onSave={(data) => handleConCompraFormSave(data, activeTab)}
                  onCancel={() => closeTab(activeTab)}
                  // Props de conversión
                  ordenOrigen={activeTabData?.ordenOrigen}
                  itemsSeleccionados={activeTabData?.itemsSeleccionados}
                  itemsSeleccionadosIds={activeTabData?.itemsSeleccionadosIds}
                  cantidadesRecibidas={activeTabData?.cantidadesRecibidas}
                  modoConversion={true}
                  // Props normales
                  proveedores={proveedores}
                  productos={productos}
                  alicuotas={alicuotas}
                  sucursales={sucursales}
                  loadingProveedores={loadingProveedores}
                  loadingProductos={loadingProductos}
                  loadingAlicuotas={loadingAlicuotas}
                  errorProveedores={errorProveedores}
                  errorProductos={errorProductos}
                  errorAlicuotas={errorAlicuotas}
                />
              ) : (
                <CompraForm
                  key={activeTab}
                  onSave={(data) => handleGuardarCompra(activeTab, data, activeTabData)}
                  onCancel={() => closeTab(activeTab)}
                  initialData={activeTabData}
                  readOnly={false}
                  proveedores={proveedores}
                  productos={productos}
                  alicuotas={alicuotas}
                  sucursales={sucursales}
                  loadingProveedores={loadingProveedores}
                  loadingProductos={loadingProductos}
                  loadingAlicuotas={loadingAlicuotas}
                  errorProveedores={errorProveedores}
                  errorProductos={errorProductos}
                  errorAlicuotas={errorAlicuotas}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de detalle de compra / orden (reutilizado) */}
      {detalleModal.abierto && (
        <DetalleCompra
          modo={detalleModal.modo}
          compra={detalleModal.compra}
          orden={detalleModal.orden}
          onClose={() => setDetalleModal({ abierto: false, modo: "compra", compra: null, orden: null })}
        />
      )}

      {/* Modal de conversión de orden a compra */}
      {conversionModal.abierto && (
        <ConversionCompraModal
          isOpen={conversionModal.abierto}
          onClose={() => setConversionModal({ abierto: false, ordenCompra: null, loading: false })}
          ordenCompra={conversionModal.ordenCompra}
          onConvertir={handleConvertirOrdenACompra}
          loading={conversionModal.loading}
        />
      )}

      {/* Modal de selección de proveedor */}
      <ProveedorSelectorModal
        abierto={proveedorSelectorModal.abierto}
        onCerrar={() => setProveedorSelectorModal({ abierto: false })}
        onSeleccionar={handleProveedorSeleccionado}
        cargando={loadingProveedores}
        error={errorProveedores}
      />
    </div>
  )
}

export default ComprasManager
