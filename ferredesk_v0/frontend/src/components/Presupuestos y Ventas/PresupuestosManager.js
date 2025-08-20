  "use client"
  // linea 252 revisar --> setTipoComprobante(4) Forzar tipoComprobante a 4 para presupuesto. Por cambios en la bd
  import { useState, useEffect, useMemo } from "react"
  import { useNavigate } from "react-router-dom"
  import Navbar from "../Navbar"
  import { useVentasAPI } from "../../utils/useVentasAPI"

  import { useAlicuotasIVAAPI } from "../../utils/useAlicuotasIVAAPI"
  import { useComprobantesAPI } from "../../utils/useComprobantesAPI"
  import { useClientesConDefecto } from "./herramientasforms/useClientesConDefecto"
  import { usePlazosAPI } from "../../utils/usePlazosAPI"
  import { useVendedoresAPI } from "../../utils/useVendedoresAPI"
  import { useLocalidadesAPI } from "../../utils/useLocalidadesAPI"
  import PresupuestoForm from "./PresupuestoForm"
  import VentaForm from "./VentaForm"
  import ItemsGrid from "./ItemsGrid"
  import PresupuestoVentaVista from "./herramientasforms/PresupuestoVentaVista"
  import { getCookie } from "../../utils/csrf"
  import EditarPresupuestoForm from "./EditarPresupuestoForm"
  import ConversionModal from "./ConversionModal"
  import ConVentaForm from "./ConVentaForm"
  import FiltrosPresupuestos from "./herramientasforms/FiltrosPresupuestos"
  import ClienteSelectorModal from "../Clientes/ClienteSelectorModal"
  import FacturaSelectorModal from "./herramientasforms/FacturaSelectorModal"
  import NotaCreditoForm from "./NotaCreditoForm"
  import { useGeneradorPDF } from "./herramientasforms/plantillasComprobantes/PDF/useGeneradorPDF"
  import { useFerreteriaAPI } from "../../utils/useFerreteriaAPI"
  import useTabsManager from "./hooks/useTabsManager"
  import useComprobantesCRUD from "./hooks/useComprobantesCRUD"
  import useFiltrosComprobantes from "./hooks/useFiltrosComprobantes"
  import useVendedoresCRUD from "./hooks/useVendedoresCRUD"
  import ComprobantesList from "./ComprobantesList"
import VendedoresTab from "./VendedoresTab"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
  





  const PresupuestosManager = () => {
    // Hook del tema de FerreDesk
    const theme = useFerreDeskTheme()
    
    // Estado y fetch para el usuario
    const [user, setUser] = useState(null)
    const navigate = useNavigate()
    
    // Hook para generación de PDFs
    const { descargarPDF } = useGeneradorPDF();

    // Hook para obtener la configuración de la ferretería
    const { ferreteria, loading: loadingFerreteria } = useFerreteriaAPI();

    useEffect(() => {
      fetch("/api/user/", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "success") setUser(data.user)
        })
    }, [])

    const handleLogout = () => {
      setUser(null)
      window.location.href = "/login"
    }

    useEffect(() => {
      document.title = "Presupuestos y Ventas FerreDesk"
    }, [])

    const { ventas, error: ventasError, addVenta, updateVenta, deleteVenta, fetchVentas } = useVentasAPI()

    // Ya no necesitamos cargar productos, familias y proveedores porque ItemsGrid hace búsquedas a demanda
    const productos = []
    const loadingProductos = false
    const errorProductos = null
    const familias = []
    const loadingFamilias = false
    const errorFamilias = null
    const proveedores = []
    const loadingProveedores = false
    const errorProveedores = null
    const { alicuotas, loading: loadingAlicuotas, error: errorAlicuotas } = useAlicuotasIVAAPI()
    const { comprobantes, loading: loadingComprobantes, error: errorComprobantes } = useComprobantesAPI()
    const { clientes } = useClientesConDefecto()
    const { plazos } = usePlazosAPI()
    const {
      vendedores,
      loading: loadingVendedores,
      error: errorVendedores,
      fetchVendedores,
      addVendedor,
      updateVendedor,
      deleteVendedor,
    } = useVendedoresAPI()
    const sucursales = [{ id: 1, nombre: "Casa Central" }]
    const puntosVenta = [{ id: 1, nombre: "PV 1" }]
    const { localidades } = useLocalidadesAPI()
    const [autoSumarDuplicados, setAutoSumarDuplicados] = useState(false)
    
    // Hook para gestión CRUD de vendedores (debe ir ANTES que useTabsManager)
    const {
      handleNuevoVendedor,
      handleEditVendedor,
      handleSaveVendedor,
      handleDeleteVendedor,
      editVendedorData,
      setEditVendedorData,
      searchVendedor,
      setSearchVendedor,
    } = useVendedoresCRUD({
      fetchVendedores,
      addVendedor,
      updateVendedor,
      deleteVendedor,
    })
    
    // Hook para gestión de tabs dinámicos
    const {
      tabs,
      activeTab,

      openTab,
      closeTab,
      setActiveTab,
      updateTabData,
      handleDragStart,
      handleDrop,
      handleDragEnd,

    } = useTabsManager(setEditVendedorData)

    // Memorizar los datos para la pestaña activa para evitar re-renders innecesarios
    const activeTabData = useMemo(() => {
      return tabs.find((t) => t.key === activeTab)?.data || null
    }, [tabs, activeTab])

    // Hook para gestión CRUD de comprobantes
    const {
      conversionModal,
      isFetchingForConversion,
      fetchingPresupuestoId,
      vistaModal,
      handleEdit,
      handleImprimir,
      handleConvertir,
      handleDelete,
      openVistaTab,
      handleConversionConfirm,
      handleConVentaFormSave,
      handleConVentaFormCancel,
      handleConVentaFormSaveFacturaI,
      handleConvertirFacturaI,
      esFacturaInternaConvertible,
      handleNotaCredito,
      setConversionModal,
      setVistaModal,
    } = useComprobantesCRUD({
      openTab,
      closeTab,
      updateTabData,
      fetchVentas,
      deleteVenta,
      descargarPDF,
      ferreteria,
      loadingFerreteria,
      navigate,
    })

    // Hook para gestión de filtros, normalización y paginación
    const {
      comprobanteTipo,
      setComprobanteTipo,
      comprobanteLetra,
      setComprobanteLetra,
      fechaDesde,
      setFechaDesde,
      fechaHasta,
      setFechaHasta,
      clienteId,
      setClienteId,
      vendedorId,
      setVendedorId,
      paginaActual,
      setPaginaActual,
      itemsPorPagina,
      setItemsPorPagina,

      totalItems,
      datosPagina,
      handleFiltroChange,

        } = useFiltrosComprobantes({
      ventas,
      productos,
      clientes,
      fetchVentas,
    })


    
    // Mostrar errores como mensajes del navegador y no en la página
    useEffect(() => {
      if (ventasError) {
        window.alert(ventasError)
      }
    }, [ventasError])

    // Tipos de comprobante con validación para evitar errores de inicialización
    const tiposComprobante = useMemo(() => {
      return (comprobantes || []).map((c) => ({
      value: c.id,
      label: c.nombre,
      campo: c.codigo_afip,
      tipo: c.tipo,
    }))
    }, [comprobantes])
    const [tipoComprobante, setTipoComprobante] = useState(1) // 1=Factura A por defecto

    // --- Estados específicos para la creación de Notas de Crédito ---
    const [modalClienteNCAbierto, setModalClienteNCAbierto] = useState(false)
    const [clienteParaNC, setClienteParaNC] = useState(null)
    const [modalFacturasNCAbierto, setModalFacturasNCAbierto] = useState(false)



    // Acciones
    const handleNuevo = () => {
      const newKey = `nuevo-${Date.now()}`
      openTab(newKey, "Nuevo Presupuesto")
      setTipoComprobante(4) // Forzar tipoComprobante a 4 para presupuesto
      localStorage.removeItem("presupuestoFormDraft")
    }

    const handleNuevaVenta = () => {
      const newKey = `nueva-venta-${Date.now()}`
      openTab(newKey, "Nueva Venta")
      setTipoComprobante(1) // Forzar tipoComprobante a 1 para venta
      localStorage.removeItem("ventaFormDraft")
    }

    const handleNuevaNotaCredito = () => {
      // Agregar validación de comprobantes NC disponibles
      const tiposNC = ['nota_credito', 'nota_credito_interna'];
      const comprobantesNC = (comprobantes || []).filter(c => tiposNC.includes(c.tipo));
      
      if (comprobantesNC.length === 0) {
        alert('No hay comprobantes de Nota de Crédito configurados en el sistema.\n' +
              'Contacte al administrador para configurar los tipos de comprobante necesarios.');
        return;
      }
      
      // Reiniciar estados relacionados
      setClienteParaNC(null)
      setModalClienteNCAbierto(true)
    }

    const handleGenerarLibroIva = () => {
      navigate('/home/libro-iva-ventas')
    }



























    return (
      <div className="ferredesk-fondo">
        <div className="ferredesk-patron"></div>
        <div className="ferredesk-overlay"></div>
        
        <div className="relative z-10">
          <Navbar user={user} onLogout={handleLogout} />
          <div className="py-8 px-4">
            <div className="max-w-[1400px] w-full mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Gestión de Presupuestos y Ventas</h2>
              </div>
              {/* Errores no se muestran en página; se alertan vía useEffect(ventasError) */}
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
                      draggable={tab.closable}
                      onDragStart={
                        tab.closable
                          ? (e) => {
                              handleDragStart(tab.key)
                              e.dataTransfer.effectAllowed = "move"
                            }
                          : undefined
                      }
                      onDrop={
                        tab.closable
                          ? (e) => {
                              e.preventDefault()
                              handleDrop(tab.key)
                            }
                          : undefined
                      }
                      onDragEnd={handleDragEnd}
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
                                     {/* Presupuestos y Ventas */}
                   {activeTab === "presupuestos" && (
                     <>
                       <div className="mb-4 flex gap-2">
                         <button
                           onClick={handleNuevo}
                           className={theme.botonPrimario}
                         >
                           <span className="text-lg">+</span> Nuevo Presupuesto
                         </button>
                         <button
                           onClick={handleNuevaVenta}
                           className={theme.botonPrimario}
                         >
                           <span className="text-lg">+</span> Nueva Venta
                         </button>
                         <button
                           onClick={handleNuevaNotaCredito}
                           className={theme.botonPrimario}
                         >
                           <span className="text-lg">+</span> Nueva Nota de Crédito
                         </button>
                         <button
                           onClick={handleGenerarLibroIva}
                           className={theme.botonPrimario}
                         >
                           <span className="text-lg">+</span> Generar Libro IVA
                         </button>
                       </div>
                       <div className="mb-4">
                         <FiltrosPresupuestos
                           comprobantes={comprobantes}
                           clientes={clientes}
                           vendedores={vendedores}
                           onFiltroChange={handleFiltroChange}
                           comprobanteTipo={comprobanteTipo}
                           setComprobanteTipo={setComprobanteTipo}
                           comprobanteLetra={comprobanteLetra}
                           setComprobanteLetra={setComprobanteLetra}
                           fechaDesde={fechaDesde}
                           setFechaDesde={setFechaDesde}
                           fechaHasta={fechaHasta}
                           setFechaHasta={setFechaHasta}
                           clienteId={clienteId}
                           setClienteId={setClienteId}
                           vendedorId={vendedorId}
                           setVendedorId={setVendedorId}
                         />
                       </div>
                      <ComprobantesList
                        comprobantes={comprobantes}
                        datosPagina={datosPagina}
                        acciones={{
                          handleImprimir,
                          openVistaTab,
                          handleEdit,
                          handleConvertir,
                          handleDelete,
                          handleConvertirFacturaI,
                          handleNotaCredito,
                        }}
                        isFetchingForConversion={isFetchingForConversion}
                        fetchingPresupuestoId={fetchingPresupuestoId}
                        esFacturaInternaConvertible={esFacturaInternaConvertible}
                        totalItems={totalItems}
                        itemsPorPagina={itemsPorPagina}
                        paginaActual={paginaActual}
                        setPaginaActual={setPaginaActual}
                        setItemsPorPagina={setItemsPorPagina}
                      />
                    </>
                  )}
                  {/* Vendedores */}
                  <VendedoresTab
                    activeTab={activeTab}
                        vendedores={vendedores}
                    loadingVendedores={loadingVendedores}
                    errorVendedores={errorVendedores}
                    searchVendedor={searchVendedor}
                    setSearchVendedor={setSearchVendedor}
                    editVendedorData={editVendedorData}
                        localidades={localidades}
                    acciones={{
                      handleNuevoVendedor: () => handleNuevoVendedor(openTab),
                      handleEditVendedor: (vendedor) => handleEditVendedor(vendedor, openTab),
                      handleSaveVendedor: (data) => handleSaveVendedor(data, closeTab, activeTab),
                      handleDeleteVendedor,
                    }}
                    closeTab={closeTab}
                  />
                  {/* Presupuestos: nuevo/editar/vista */}
                                    {(activeTab.startsWith("nuevo-") ||
                  activeTab.startsWith("editar") ||
                  activeTab.startsWith("nueva-venta-") ||
                  activeTab.startsWith("nota-credito-")) &&
                    !activeTab.startsWith("nuevo-vendedor") &&
                    !activeTab.startsWith("editar-vendedor") &&
                    (activeTab.startsWith("nueva-venta-") ? (
                      <VentaForm
                        key={activeTab}
                        onSave={async (payload) => {
                          const resultado = await addVenta({ ...payload, tipo: "Venta", estado: "Cerrado" })
                          // Solo cerrar la pestaña si no hay emisión ARCA o si ya se procesó
                          if (!resultado?.arca_emitido) {
                            closeTab(activeTab)
                          }
                          return resultado
                        }}
                        onCancel={() => closeTab(activeTab)}
                        initialData={null}
                        readOnlyOverride={false}
                        comprobantes={comprobantes}
                        tiposComprobante={tiposComprobante}
                        tipoComprobante={tipoComprobante}
                        setTipoComprobante={setTipoComprobante}
                        clientes={clientes}
                        plazos={plazos}
                        vendedores={vendedores}
                        sucursales={sucursales}
                        puntosVenta={puntosVenta}
                        loadingComprobantes={loadingComprobantes}
                        errorComprobantes={errorComprobantes}
                        productos={productos}
                        loadingProductos={loadingProductos}
                        familias={familias}
                        loadingFamilias={loadingFamilias}
                        proveedores={proveedores}
                        loadingProveedores={loadingProveedores}
                        alicuotas={alicuotas}
                        loadingAlicuotas={loadingAlicuotas}
                        errorProductos={errorProductos}
                        errorFamilias={errorFamilias}
                        errorProveedores={errorProveedores}
                        errorAlicuotas={errorAlicuotas}
                        autoSumarDuplicados={autoSumarDuplicados}
                        setAutoSumarDuplicados={setAutoSumarDuplicados}
                        ItemsGrid={ItemsGrid}
                        tabKey={activeTab}
                      />
                    ) : activeTab.startsWith("editar") ? (
                      <EditarPresupuestoForm
                        key={activeTab}
                        onSave={async (payload) => {
                          const idOriginal = activeTabData?.id || activeTabData?.ven_id
                          if (!idOriginal) {
                            alert("No se encontró el ID del presupuesto a editar.")
                            return
                          }
                          await updateVenta(idOriginal, {
                            ...payload,
                            tipoOriginal: activeTabData?.tipo,
                            estadoOriginal: activeTabData?.estado,
                          })
                          closeTab(activeTab)
                        }}
                        onCancel={() => closeTab(activeTab)}
                        initialData={activeTabData}
                        comprobantes={comprobantes}
                        tiposComprobante={tiposComprobante}
                        tipoComprobante={tipoComprobante}
                        setTipoComprobante={setTipoComprobante}
                        clientes={clientes}
                        plazos={plazos}
                        vendedores={vendedores}
                        sucursales={sucursales}
                        puntosVenta={puntosVenta}
                        productos={productos}
                        proveedores={proveedores}
                        alicuotas={alicuotas}
                        autoSumarDuplicados={autoSumarDuplicados}
                        setAutoSumarDuplicados={setAutoSumarDuplicados}
                        ItemsGrid={ItemsGrid}
                      />
                    ) : activeTab.startsWith("nota-credito-") ? (
                      <NotaCreditoForm
                        key={activeTab}
                        onSave={async (payload) => {
                          try {
                            const csrftoken = getCookie("csrftoken")
                            const response = await fetch("/api/ventas/", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                "X-CSRFToken": csrftoken,
                              },
                              credentials: "include",
                              body: JSON.stringify(payload),
                            })
                            
                            const data = await response.json()
                            
                            if (!response.ok) {
                              let msg = "No se pudo guardar la Nota de Crédito"
                              try {
                                msg = data.detail || msg
                              } catch {}
                              throw new Error(msg)
                            }
                            
                            // Actualizar lista
                            await fetchVentas()
                            
                            // Solo cerrar la pestaña si no hay emisión ARCA o si ya se procesó
                            if (!data?.arca_emitido) {
                              closeTab(activeTab)
                            }
                            
                            // Devolver la respuesta del backend para que NotaCreditoForm pueda procesar los datos de ARCA
                            return data
                          } catch (err) {
                            throw err
                          }
                        }}
                        onCancel={() => closeTab(activeTab)}
                        clienteSeleccionado={tabs.find((t) => t.key === activeTab)?.data?.cliente}
                        facturasAsociadas={tabs.find((t) => t.key === activeTab)?.data?.facturas}
                        comprobantes={comprobantes}
                        plazos={plazos}
                        vendedores={vendedores}
                        sucursales={[{ id: 1, nombre: "Casa Central" }]}
                        puntosVenta={[{ id: 1, nombre: "PV 1" }]}
                        productos={productos}
                        loadingProductos={loadingProductos}
                        familias={familias}
                        loadingFamilias={loadingFamilias}
                        proveedores={proveedores}
                        loadingProveedores={loadingProveedores}
                        autoSumarDuplicados={autoSumarDuplicados}
                        setAutoSumarDuplicados={setAutoSumarDuplicados}
                        tabKey={activeTab}
                      />
                    ) : (
                      <PresupuestoForm
                        key={activeTab}
                        onSave={async (payload) => {
                          await addVenta({ ...payload, tipo: "Presupuesto", estado: "Abierto" })
                          closeTab(activeTab)
                        }}
                        onCancel={() => closeTab(activeTab)}
                        initialData={activeTabData}
                        readOnlyOverride={false}
                        comprobantes={comprobantes}
                        tiposComprobante={tiposComprobante}
                        tipoComprobante={tipoComprobante}
                        setTipoComprobante={setTipoComprobante}
                        clientes={clientes}
                        plazos={plazos}
                        vendedores={vendedores}
                        sucursales={sucursales}
                        puntosVenta={puntosVenta}
                        loadingComprobantes={loadingComprobantes}
                        errorComprobantes={errorComprobantes}
                        productos={productos}
                        loadingProductos={loadingProductos}
                        familias={familias}
                        loadingFamilias={loadingFamilias}
                        proveedores={proveedores}
                        loadingProveedores={loadingProveedores}
                        alicuotas={alicuotas}
                        loadingAlicuotas={loadingAlicuotas}
                        errorProductos={errorProductos}
                        errorFamilias={errorFamilias}
                        errorProveedores={errorProveedores}
                        errorAlicuotas={errorAlicuotas}
                        autoSumarDuplicados={autoSumarDuplicados}
                        setAutoSumarDuplicados={setAutoSumarDuplicados}
                        ItemsGrid={ItemsGrid}
                        tabKey={activeTab}
                      />
                    ))}
                  {tabs.map(
                    (tab) =>
                      activeTab === tab.key &&
                      tab.tipo === "conventa" && (
                        <ConVentaForm
                          key={tab.key}
                          presupuestoOrigen={tab.data.presupuestoOrigen}
                          itemsSeleccionados={tab.data.itemsSeleccionados}
                          onSave={async (payload, tk) => {
                            const resultado = await handleConVentaFormSave(payload, tk)
                            // Solo cerrar la pestaña si no hay emisión ARCA o si ya se procesó
                            if (!resultado?.arca_emitido) {
                              closeTab(tk)
                            }
                            return resultado
                          }}
                          onCancel={() => handleConVentaFormCancel(tab.key)}
                          comprobantes={comprobantes}
                          ferreteria={null}
                          clientes={clientes}
                          plazos={plazos}
                          vendedores={vendedores}
                          sucursales={sucursales}
                          puntosVenta={puntosVenta}
                          loadingComprobantes={loadingComprobantes}
                          errorComprobantes={errorComprobantes}
                          productos={productos}
                          loadingProductos={loadingProductos}
                          familias={familias}
                          loadingFamilias={loadingFamilias}
                          proveedores={proveedores}
                          loadingProveedores={loadingProveedores}
                          alicuotas={alicuotas}
                          loadingAlicuotas={loadingAlicuotas}
                          errorProductos={errorProductos}
                          errorFamilias={errorFamilias}
                          errorProveedores={errorProveedores}
                          errorAlicuotas={errorAlicuotas}
                          autoSumarDuplicados={autoSumarDuplicados}
                          setAutoSumarDuplicados={setAutoSumarDuplicados}
                          tabKey={tab.key}
                        />
                      ),
                  )}
                  {tabs.map(
                    (tab) =>
                      activeTab === tab.key &&
                      tab.tipo === "conv-factura-i" && (
                        <ConVentaForm
                          key={tab.key}
                          facturaInternaOrigen={tab.data.facturaInternaOrigen}
                          tipoConversion={tab.data.tipoConversion}
                          itemsSeleccionados={tab.data.itemsSeleccionados}
                          itemsSeleccionadosIds={tab.data.itemsSeleccionadosIds}
                          onSave={async (payload, tk, endpoint) => {
                            const resultado = await handleConVentaFormSaveFacturaI(payload, tk, endpoint)
                            // Solo cerrar la pestaña si no hay emisión ARCA o si ya se procesó
                            if (!resultado?.arca_emitido) {
                              closeTab(tk)
                            }
                            return resultado
                          }}
                          onCancel={() => handleConVentaFormCancel(tab.key)}
                          comprobantes={comprobantes}
                          ferreteria={null}
                          clientes={clientes}
                          plazos={plazos}
                          vendedores={vendedores}
                          sucursales={sucursales}
                          puntosVenta={puntosVenta}
                          loadingComprobantes={loadingComprobantes}
                          errorComprobantes={errorComprobantes}
                          productos={productos}
                          loadingProductos={loadingProductos}
                          familias={familias}
                          loadingFamilias={loadingFamilias}
                          proveedores={proveedores}
                          loadingProveedores={loadingProveedores}
                          alicuotas={alicuotas}
                          loadingAlicuotas={loadingAlicuotas}
                          errorProductos={errorProductos}
                          errorFamilias={errorFamilias}
                          errorProveedores={errorProveedores}
                          errorAlicuotas={errorAlicuotas}
                          autoSumarDuplicados={autoSumarDuplicados}
                          setAutoSumarDuplicados={setAutoSumarDuplicados}
                          tabKey={tab.key}
                        />
                      ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <ConversionModal
          open={conversionModal.open}
          presupuesto={conversionModal.presupuesto}
          onClose={() => setConversionModal({ open: false, presupuesto: null })}
          onConvertir={handleConversionConfirm}
          clientes={clientes}
          vendedores={vendedores}
          plazos={plazos}
          sucursales={sucursales}
          puntosVenta={puntosVenta}
          comprobantes={comprobantes}
        />

        {/* Modal para seleccionar cliente al crear Nota de Crédito */}
        <ClienteSelectorModal
          abierto={modalClienteNCAbierto}
          onCerrar={() => setModalClienteNCAbierto(false)}
          clientes={clientes}
          onSeleccionar={(cli) => {
            setClienteParaNC(cli)
            setModalClienteNCAbierto(false)
            // Abrir selección de facturas
            setModalFacturasNCAbierto(true)

          }}
        />

        {/* Modal selección de facturas */}
        <FacturaSelectorModal
          abierto={modalFacturasNCAbierto}
          cliente={clienteParaNC}
          onCerrar={() => setModalFacturasNCAbierto(false)}
          onSeleccionar={(facturas) => {
            setModalFacturasNCAbierto(false)
            // Abrir pestaña con formulario de Nota de Crédito
            const newKey = `nota-credito-${Date.now()}`
            const label = `Nueva N. Crédito`
            const data = {
                  cliente: clienteParaNC,
                  facturas: facturas,
            }
            updateTabData(newKey, label, data, "nota-credito")
          }}
        />

        {/* Modal de vista de presupuesto/venta */}
        {vistaModal.open && (
          <PresupuestoVentaVista
            data={vistaModal.data}
            clientes={clientes}
            vendedores={vendedores}
            plazos={plazos}
            sucursales={sucursales}
            puntosVenta={puntosVenta}
            comprobantes={comprobantes}
            onImprimir={handleImprimir}
            onEliminar={async (id) => {
              await handleDelete(id)
              setVistaModal({ open: false, data: null })
            }}
            onCerrar={() => setVistaModal({ open: false, data: null })}
          />
        )}
      </div>
    )
  }

  export default PresupuestosManager
