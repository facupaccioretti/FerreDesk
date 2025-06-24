  "use client"

  import { useState, useEffect, useMemo } from "react"
  import Navbar from "../Navbar"
  import { useVentasAPI } from "../../utils/useVentasAPI"
  import { useProductosAPI } from "../../utils/useProductosAPI"
  import { useFamiliasAPI } from "../../utils/useFamiliasAPI"
  import { useProveedoresAPI } from "../../utils/useProveedoresAPI"
  import { useAlicuotasIVAAPI } from "../../utils/useAlicuotasIVAAPI"
  import { useComprobantesAPI } from "../../utils/useComprobantesAPI"
  import { useClientesConDefecto } from "./herramientasforms/useClientesConDefecto"
  import { usePlazosAPI } from "../../utils/usePlazosAPI"
  import { useVendedoresAPI } from "../../utils/useVendedoresAPI"
  import VendedorForm from "./VendedorForm"
  import { useLocalidadesAPI } from "../../utils/useLocalidadesAPI"
  import VendedoresTable from "./VendedoresTable"
  import PresupuestoForm from "./PresupuestoForm"
  import VentaForm from "./VentaForm"
  import ItemsGrid from "./ItemsGrid"
  import { BotonEditar, BotonEliminar, BotonImprimir, BotonConvertir, BotonVerDetalle } from "../Botones"
  import PresupuestoVentaVista from "./herramientasforms/PresupuestoVentaVista"
  import { getCookie } from "../../utils/csrf"
  import { IconVenta, IconFactura, IconCredito, IconPresupuesto, IconRecibo } from "../ComprobanteIcono"
  import EditarPresupuestoForm from "./EditarPresupuestoForm"
  import ConversionModal from "./ConversionModal"
  import ConVentaForm from "./ConVentaForm"
  import Paginador from "../Paginador"
  import FiltrosPresupuestos from "./herramientasforms/FiltrosPresupuestos"
  import { useVentaDetalleAPI } from "../../utils/useVentaDetalleAPI"
  import { formatearMoneda } from "./herramientasforms/plantillasComprobantes/helpers"
  import ClienteSelectorModal from "../Clientes/ClienteSelectorModal"
  import FacturaSelectorModal from "./herramientasforms/FacturaSelectorModal"
  import NotaCreditoForm from "./NotaCreditoForm"

  const mainTabs = [
    { key: "presupuestos", label: "Presupuestos y Ventas", closable: false },
    { key: "vendedores", label: "Vendedores", closable: false },
  ]

  const getComprobanteIconAndLabel = (tipo, nombre = "", letra = "") => {
    const n = String(nombre || "").toLowerCase()
    if (n.includes("presupuesto")) return { icon: <IconPresupuesto />, label: "Presupuesto" }
    if (n.includes("venta")) return { icon: <IconVenta />, label: "Venta" }
    if (n.includes("factura")) return { icon: <IconFactura />, label: "Factura" }
    if (n.includes("nota de crédito interna")) return { icon: <IconCredito />, label: "N. Cred. Int." }
    if (n.includes("nota de crédito")) return { icon: <IconCredito />, label: "N. Cred." }
    if (n.includes("nota de débito")) return { icon: <IconCredito />, label: "N. Deb." }
    if (n.includes("recibo")) return { icon: <IconRecibo />, label: "Recibo" }
    return { icon: <IconFactura />, label: String(nombre) }
  }

  // Badge de estado para mostrar visualmente si está Abierto o Cerrado
  const EstadoBadge = ({ estado }) => {
    if (estado === "Cerrado") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-3.5 h-3.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>
          Cerrado
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-3.5 h-3.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
        Abierto
      </span>
    )
  }

  // Componente para mostrar el total correcto desde la vista calculada
  function CeldaTotalVenta({ idVenta }) {
    const { ventaCalculada, cargando, error } = useVentaDetalleAPI(idVenta)
    if (cargando) return <span className="text-slate-500">...</span>
    if (error) return <span className="text-red-500">Err</span>
    return <span className="font-semibold text-slate-800">${formatearMoneda(ventaCalculada?.ven_total)}</span>
  }

  const PresupuestosManager = () => {
    // Estado y fetch para el usuario
    const [user, setUser] = useState(null)

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
    const fetchPresupuestos = fetchVentas
    const { productos, loading: loadingProductos, error: errorProductos } = useProductosAPI()
    const { familias, loading: loadingFamilias, error: errorFamilias } = useFamiliasAPI()
    const { proveedores, loading: loadingProveedores, error: errorProveedores } = useProveedoresAPI()
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
    const sucursales = [{ id: 1, nombre: "Casa Central" }] // Ajusta según tu negocio
    const puntosVenta = [{ id: 1, nombre: "PV 1" }] // Ajusta según tu negocio
    const [comprobanteTipo, setComprobanteTipo] = useState("")
    const [comprobanteLetra, setComprobanteLetra] = useState("")
    // Inicializar rango de fechas: hoy y 30 días atrás
    const hoyISO = (() => {
      const d = new Date()
      const mes = String(d.getMonth() + 1).padStart(2, "0")
      const dia = String(d.getDate()).padStart(2, "0")
      return `${d.getFullYear()}-${mes}-${dia}`
    })()
    const hace30ISO = (() => {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      const mes = String(d.getMonth() + 1).padStart(2, "0")
      const dia = String(d.getDate()).padStart(2, "0")
      return `${d.getFullYear()}-${mes}-${dia}`
    })()
    const [fechaDesde, setFechaDesde] = useState(hace30ISO)
    const [fechaHasta, setFechaHasta] = useState(hoyISO)
    const [clienteId, setClienteId] = useState("")
    const [vendedorId, setVendedorId] = useState("")
    const [tabs, setTabs] = useState(() => {
      try {
        const savedTabs = localStorage.getItem("presupuestosTabs")
        if (savedTabs) {
          const parsedTabs = JSON.parse(savedTabs)
          // Validar que siempre estén los mainTabs al principio
          let restoredTabs = parsedTabs
          mainTabs.forEach((mainTab) => {
            if (!restoredTabs.find((t) => t.key === mainTab.key)) {
              restoredTabs = [mainTab, ...restoredTabs]
            }
          })
          console.log("[INIT] Tabs restauradas desde localStorage:", restoredTabs)
          return restoredTabs
        }
      } catch (e) {
        console.error("[INIT] Error restaurando tabs:", e)
      }
      console.log("[INIT] Tabs por defecto:", [...mainTabs])
      return [...mainTabs]
    })
    const [activeTab, setActiveTab] = useState(() => {
      return localStorage.getItem("presupuestosActiveTab") || "presupuestos"
    })
    const [editPresupuesto, setEditPresupuesto] = useState(null)

    // Memorizar los datos para la pestaña activa para evitar re-renders innecesarios
    const activeTabData = useMemo(() => {
      return tabs.find((t) => t.key === activeTab)?.data || null
    }, [tabs, activeTab])

    const { localidades } = useLocalidadesAPI()
    const [autoSumarDuplicados, setAutoSumarDuplicados] = useState(false)
    const [draggedTabKey, setDraggedTabKey] = useState(null)
    const tiposComprobante = comprobantes.map((c) => ({
      value: c.id,
      label: c.nombre,
      campo: c.codigo_afip,
      tipo: c.tipo,
    }))
    const [tipoComprobante, setTipoComprobante] = useState(1) // 1=Factura A por defecto
    const [searchVendedor, setSearchVendedor] = useState("")
    const [editVendedorData, setEditVendedorData] = useState(null)
    const [conversionModal, setConversionModal] = useState({ open: false, presupuesto: null })
    const [isFetchingForConversion, setIsFetchingForConversion] = useState(false)
    const [fetchingPresupuestoId, setFetchingPresupuestoId] = useState(null)
    // Estado para paginación
    const [paginaActual, setPaginaActual] = useState(1)
    const [itemsPorPagina, setItemsPorPagina] = useState(15)

    // --- Estados específicos para la creación de Notas de Crédito ---
    const [modalClienteNCAbierto, setModalClienteNCAbierto] = useState(false)
    const [clienteParaNC, setClienteParaNC] = useState(null)
    const [facturasParaNC, setFacturasParaNC] = useState([])
    const [modalFacturasNCAbierto, setModalFacturasNCAbierto] = useState(false)

    // Funciones para tabs
    const openTab = (key, label, data = null) => {
      setEditVendedorData(data)
      setTabs((prev) => {
        if (prev.find((t) => t.key === key)) return prev
        return [...prev, { key, label, closable: true, data }]
      })
      setActiveTab(key)
    }
    const closeTab = (key) => {
      // Eliminar borradores asociados a la pestaña que se cierra
      try {
        if (key.startsWith("editar")) {
          const tab = tabs.find((t) => t.key === key)
          const idPres = tab?.data?.id || tab?.data?.ven_id || null
          if (idPres) localStorage.removeItem(`editarPresupuestoDraft_${idPres}`)
        } else if (key.startsWith("nuevo-")) {
          localStorage.removeItem("presupuestoFormDraft")
        } else if (key.startsWith("nueva-venta-")) {
          localStorage.removeItem("ventaFormDraft")
        } else if (key.startsWith("conventa-")) {
          localStorage.removeItem(`conVentaFormDraft_${key}`)
        }
      } catch (err) {
        console.warn("[closeTab] No se pudo limpiar borrador:", err)
      }

      setTabs((prev) => prev.filter((t) => t.key !== key))
      if (activeTab === key) setActiveTab("presupuestos")
      setEditVendedorData(null)
    }

    // Acciones
    const handleNuevo = () => {
      const newKey = `nuevo-${Date.now()}`
      setTabs((prev) => {
        const newTabs = [...prev, { key: newKey, label: "Nuevo Presupuesto", closable: true }]
        console.log("[handleNuevo] Tabs después de agregar:", newTabs)
        return newTabs
      })
      setEditPresupuesto(null)
      setActiveTab(newKey)
      setTipoComprobante(4) // Forzar tipoComprobante a 4 para presupuesto
      localStorage.removeItem("presupuestoFormDraft")
    }

    const handleNuevaVenta = () => {
      const newKey = `nueva-venta-${Date.now()}`
      setTabs((prev) => {
        const newTabs = [...prev, { key: newKey, label: "Nueva Venta", closable: true }]
        console.log("[handleNuevaVenta] Tabs después de agregar:", newTabs)
        return newTabs
      })
      setActiveTab(newKey)
      setTipoComprobante(1) // Forzar tipoComprobante a 1 para venta
      localStorage.removeItem("ventaFormDraft")
    }

    const handleNuevaNotaCredito = () => {
      // Reiniciar estados relacionados
      setClienteParaNC(null)
      setFacturasParaNC([])
      setModalClienteNCAbierto(true)
    }

    const handleEdit = (presupuesto) => {
      if (!presupuesto || !presupuesto.id) return
      setEditPresupuesto(presupuesto)
      const key = `editar-${presupuesto.id}`
      const label = `Editar ${presupuesto.numero || presupuesto.id}`
      openTab(key, label, presupuesto)
    }

    const handleImprimir = async (presupuesto) => {
      try {
        const response = await fetch(`/api/ventas/${presupuesto.id}/imprimir/`, { method: "GET" })
        if (!response.ok) throw new Error("No se pudo imprimir")
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        window.open(url)
      } catch (err) {
        alert("Error al imprimir: " + (err.message || ""))
      }
    }

    const handleConvertir = async (presupuesto) => {
      if (!presupuesto || !presupuesto.id || (isFetchingForConversion && fetchingPresupuestoId === presupuesto.id)) return

      setFetchingPresupuestoId(presupuesto.id)
      setIsFetchingForConversion(true)

      try {
        const [cabecera, itemsDetalle] = await Promise.all([
          fetch(`/api/venta-calculada/${presupuesto.id}/`).then(async (res) => {
            if (!res.ok) {
              const err = await res.json().catch(() => ({ detail: "Error cabecera" }))
              throw new Error(err.detail)
            }
            return res.json()
          }),
          fetch(`/api/venta-detalle-item-calculado/?vdi_idve=${presupuesto.id}`).then(async (res) => {
            if (!res.ok) return []
            return res.json()
          }),
        ])

        const presupuestoConDetalle = {
          ...(cabecera.venta || presupuesto),
          items: Array.isArray(itemsDetalle) ? itemsDetalle : [],
        }

        const itemsConId = presupuestoConDetalle.items.map((it, idx) => ({
          ...it,
          id: it.id || it.vdi_idve || it.vdi_id || idx + 1,
        }))

        setConversionModal({ open: true, presupuesto: { ...presupuestoConDetalle, items: itemsConId } })
      } catch (error) {
        console.error("Error al obtener detalle para conversión:", error)
        alert(error.message)
      } finally {
        setIsFetchingForConversion(false)
        setFetchingPresupuestoId(null)
      }
    }

    const handleConversionConfirm = (selectedItems) => {
      const presupuesto = conversionModal.presupuesto
      const itemsSeleccionadosObjs = (presupuesto.items || []).filter((item) => selectedItems.includes(item.id))
      const tabKey = `conventa-${presupuesto.id}`
      setTabs((prev) => {
        const existente = prev.find((t) => t.key === tabKey)
        if (existente) {
          // Actualizar los datos seleccionados y reutilizar la pestaña
          return prev.map((t) =>
            t.key === tabKey
              ? {
                  ...t,
                  data: {
                    presupuestoOrigen: presupuesto,
                    itemsSeleccionados: itemsSeleccionadosObjs,
                    itemsSeleccionadosIds: selectedItems,
                  },
                }
              : t,
          )
        }
        return [
          ...prev,
          {
            key: tabKey,
            label: `Conversión a Venta #${presupuesto.numero || presupuesto.id}`,
            closable: true,
            data: {
              presupuestoOrigen: presupuesto,
              itemsSeleccionados: itemsSeleccionadosObjs,
              itemsSeleccionadosIds: selectedItems,
            },
            tipo: "conventa",
          },
        ]
      })
      setActiveTab(tabKey)
      setConversionModal({ open: false, presupuesto: null })
    }

    const handleConVentaFormSave = async (payload, tabKey) => {
      try {
        const csrftoken = getCookie("csrftoken")
        const response = await fetch("/api/convertir-presupuesto/", {
          method: "POST",
          headers: {
            "X-CSRFToken": csrftoken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          credentials: "include",
        })

        if (!response.ok) {
          let msg = "No se pudo convertir"
          try {
            const data = await response.json()
            msg = data.detail || msg
          } catch {}
          throw new Error(msg)
        }

        const data = await response.json()

        // Actualizar la lista de ventas y presupuestos
        await fetchVentas()
        await fetchPresupuestos()
        // Cerrar la tab de conversión
        closeTab(tabKey)
        // Mostrar mensaje de éxito
        if (data.presupuesto === null) {
          alert("Venta creada correctamente. El presupuesto fue eliminado por no tener items restantes.")
        } else {
          alert("Venta creada correctamente. El presupuesto fue actualizado con los items restantes.")
        }
      } catch (err) {
        alert("Error al convertir: " + (err.message || ""))
      }
    }

    const handleConVentaFormCancel = (tabKey) => {
      closeTab(tabKey)
    }

    const handleDelete = async (id) => {
      if (window.confirm("¿Seguro que deseas eliminar este presupuesto/venta?")) {
        try {
          await deleteVenta(id)
        } catch (err) {
          alert("Error al eliminar: " + (err.message || ""))
        }
      }
    }

    // Nueva función para abrir subtab de vista no editable
    const openVistaTab = (presupuesto) => {
      setTabs((prev) => {
        if (prev.find((t) => t.key === `vista-${presupuesto.id}`)) return prev
        return [
          ...prev,
          {
            key: `vista-${presupuesto.id}`,
            label: `Vista ${presupuesto.tipo} ${presupuesto.numero}`,
            closable: true,
            data: presupuesto,
          },
        ]
      })
      setActiveTab(`vista-${presupuesto.id}`)
    }

    // Vendedores: abrir nuevo/editar
    const handleNuevoVendedor = () => {
      const newKey = `nuevo-vendedor-${Date.now()}`
      openTab(newKey, "Nuevo Vendedor")
    }
    const handleEditVendedor = (vendedor) => {
      const editKey = `editar-vendedor-${vendedor.id}`
      openTab(editKey, `Editar Vendedor: ${vendedor.nombre.substring(0, 15)}...`, vendedor)
    }
    const handleSaveVendedor = async (data) => {
      try {
        if (editVendedorData) {
          await updateVendedor(editVendedorData.id, data)
        } else {
          await addVendedor(data)
        }
        fetchVendedores()
        closeTab(activeTab)
      } catch (err) {
        // Manejo de error opcional
      }
    }
    const handleDeleteVendedor = async (id) => {
      if (window.confirm("¿Seguro que deseas eliminar este vendedor?")) {
        try {
          await deleteVendedor(id)
          fetchVendedores()
        } catch (err) {}
      }
    }

    // Normalizar datos de ventas/presupuestos para la grilla
    const normalizarVenta = (venta) => {
      let tipo = ""
      const comprobanteObj = venta.comprobante && typeof venta.comprobante === "object" ? venta.comprobante : null
      if (!comprobanteObj) return null // Si no hay comprobante, no se puede clasificar

      // Determinar tipo SOLO por comprobante
      if (
        (comprobanteObj.tipo && comprobanteObj.tipo.toLowerCase() === "presupuesto") ||
        comprobanteObj.codigo_afip === "9997"
      ) {
        tipo = "Presupuesto"
      } else {
        tipo = "Venta"
      }

      const estado = venta.estado || (venta.ven_estado === "AB" ? "Abierto" : venta.ven_estado === "CE" ? "Cerrado" : "")
      const items = (venta.items || venta.detalle || venta.productos || []).map((item) => {
        const producto = productos.find((p) => p.id === (item.vdi_idsto || item.producto?.id))
        const cantidad = Number.parseFloat(item.vdi_cantidad || item.cantidad || 0)
        const costo = Number.parseFloat(item.vdi_importe || item.precio || item.costo || 0)
        const bonificacion = Number.parseFloat(item.vdi_bonifica || item.bonificacion || 0)
        const subtotalSinIva = costo * cantidad * (1 - bonificacion / 100)
        const alicuotaIva = producto ? Number.parseFloat(producto.aliiva?.porce || producto.aliiva || 0) || 0 : 0
        const iva = subtotalSinIva * (alicuotaIva / 100)
        return {
          ...item,
          producto,
          codigo: producto?.codvta || producto?.codigo || item.codigo || item.codvta || item.id || "-",
          denominacion: producto?.deno || producto?.nombre || item.denominacion || item.nombre || "",
          unidad: producto?.unidad || producto?.unidadmedida || item.unidad || item.unidadmedida || "-",
          cantidad,
          precio: costo,
          bonificacion,
          alicuotaIva,
          iva,
        }
      })
      return {
        ...venta,
        tipo,
        estado,
        letra: comprobanteObj.letra || venta.letra || "",
        numero: venta.numero_formateado || venta.ven_numero || venta.numero || "",
        cliente:
          clientes.find((c) => c.id === venta.ven_idcli)?.razon ||
          (venta.ven_idcli === 1 || venta.ven_idcli === "1" ? "Cliente Mostrador" : "") ||
          venta.cliente ||
          "",
        fecha: venta.ven_fecha || venta.fecha || new Date().toISOString().split("T")[0],
        id: venta.id || venta.ven_id || venta.pk,
        items,
        plazoId: venta.ven_idpla || venta.plazoId || "",
        vendedorId: venta.ven_idvdo || venta.vendedorId || "",
        sucursalId: venta.ven_sucursal || venta.sucursalId || 1,
        puntoVentaId: venta.ven_punto || venta.puntoVentaId || 1,
        bonificacionGeneral: venta.ven_bonificacion_general ?? venta.bonificacionGeneral ?? 0,
        descu1: venta.ven_descu1 || venta.descu1 || 0,
        descu2: venta.ven_descu2 || venta.descu2 || 0,
        descu3: venta.ven_descu3 || venta.descu3 || 0,
        copia: venta.ven_copia || venta.copia || 1,
        cae: venta.ven_cae || venta.cae || "",
        comprobante: comprobanteObj,
        total: venta.total || venta.ven_total || venta.importe_total || 0,
      }
    }

    // Normalizar datos de ventas/presupuestos para la grilla
    const ventasNormalizadas = ventas.map(normalizarVenta).filter(Boolean)

    // Usar directamente ventasNormalizadas para la paginación
    const totalItems = ventasNormalizadas.length
    const datosPagina = ventasNormalizadas.slice((paginaActual - 1) * itemsPorPagina, paginaActual * itemsPorPagina)

    useEffect(() => {
      localStorage.setItem("presupuestosTabs", JSON.stringify(tabs))
      localStorage.setItem("presupuestosActiveTab", activeTab)
    }, [tabs, activeTab])

    const handleFiltroChange = (filtros) => {
      setComprobanteTipo(filtros.comprobanteTipo)
      setComprobanteLetra(filtros.comprobanteLetra)
      setFechaDesde(filtros.fechaDesde)
      setFechaHasta(filtros.fechaHasta)
      setClienteId(filtros.clienteId)
      setVendedorId(filtros.vendedorId)
      const params = {}
      // Ya no hay filtro rápido, solo filtramos por comprobanteTipo si está presente
      if (filtros.comprobanteTipo) params["comprobante_tipo"] = filtros.comprobanteTipo
      if (filtros.comprobanteLetra) params["comprobante_letra"] = filtros.comprobanteLetra
      if (filtros.fechaDesde) params["ven_fecha_after"] = filtros.fechaDesde
      if (filtros.fechaHasta) params["ven_fecha_before"] = filtros.fechaHasta
      if (filtros.clienteId) params["ven_idcli"] = filtros.clienteId
      if (filtros.vendedorId) params["ven_idvdo"] = filtros.vendedorId
      fetchVentas(params)
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30">
        <Navbar user={user} onLogout={handleLogout} />
        <div className="py-8 px-4">
          <div className="max-w-[1400px] w-full mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-slate-800">Gestión de Presupuestos y Ventas</h2>
            </div>
            {ventasError && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 shadow-sm">
                <div className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {ventasError}
                </div>
              </div>
            )}
            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-md overflow-hidden border border-slate-200 max-w-full">
              {/* Tabs tipo browser */}
              <div className="flex items-center border-b border-slate-200 px-6 pt-3 bg-slate-50">
                {tabs.map((tab) => (
                  <div
                    key={tab.key}
                    className={`flex items-center px-5 py-3 mr-2 rounded-t-lg cursor-pointer transition-colors ${
                      activeTab === tab.key
                        ? "bg-white border border-b-0 border-slate-200 font-semibold text-slate-800 shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    onClick={() => setActiveTab(tab.key)}
                    style={{ position: "relative", zIndex: 1 }}
                    draggable={tab.closable}
                    onDragStart={
                      tab.closable
                        ? (e) => {
                            setDraggedTabKey(tab.key)
                            e.dataTransfer.effectAllowed = "move"
                          }
                        : undefined
                    }
                    onDrop={
                      tab.closable
                        ? (e) => {
                            e.preventDefault()
                            if (draggedTabKey && draggedTabKey !== tab.key) {
                              const dynamicTabs = tabs.filter((t) => t.closable)
                              const fixedTabs = tabs.filter((t) => !t.closable)
                              const draggedIdx = dynamicTabs.findIndex((t) => t.key === draggedTabKey)
                              const dropIdx = dynamicTabs.findIndex((t) => t.key === tab.key)
                              if (draggedIdx !== -1 && dropIdx !== -1) {
                                const newDynamicTabs = [...dynamicTabs]
                                const [draggedTab] = newDynamicTabs.splice(draggedIdx, 1)
                                newDynamicTabs.splice(dropIdx, 0, draggedTab)
                                setTabs([...fixedTabs, ...newDynamicTabs])
                              }
                            }
                            setDraggedTabKey(null)
                          }
                        : undefined
                    }
                    onDragEnd={() => {
                      setDraggedTabKey(null)
                    }}
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
                    <div className="mb-4 flex gap-2">
                      <button
                        onClick={handleNuevo}
                        className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
                      >
                        <span className="text-lg">+</span> Nuevo Presupuesto
                      </button>
                      <button
                        onClick={handleNuevaVenta}
                        className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
                      >
                        <span className="text-lg">+</span> Nueva Venta
                      </button>
                      <button
                        onClick={handleNuevaNotaCredito}
                        className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
                      >
                        <span className="text-lg">+</span> Nueva Nota de Crédito
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full divide-y divide-slate-200" style={{ minWidth: "1200px" }}>
                        <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                          <tr>
                            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Comprobante
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              N°
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Fecha
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Cliente
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Total
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {datosPagina.map((p) => {
                            let comprobanteObj = null
                            if (typeof p.comprobante === "object" && p.comprobante !== null) {
                              comprobanteObj = p.comprobante
                            } else if (p.comprobante) {
                              comprobanteObj = comprobantes.find((c) => c.id === p.comprobante) || null
                            }
                            const comprobanteNombre = comprobanteObj ? comprobanteObj.nombre : ""
                            const comprobanteLetra = comprobanteObj ? comprobanteObj.letra : ""
                            const comprobanteTipo = comprobanteObj ? comprobanteObj.tipo : ""
                            const { icon, label } = getComprobanteIconAndLabel(
                              comprobanteTipo,
                              comprobanteNombre,
                              comprobanteLetra,
                            )
                            // Quitar letra del numero_formateado si existe
                            let numeroSinLetra = p.numero_formateado
                            if (numeroSinLetra && comprobanteLetra && numeroSinLetra.startsWith(comprobanteLetra + " ")) {
                              numeroSinLetra = numeroSinLetra.slice(comprobanteLetra.length + 1)
                            }
                            return (
                              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                {/* Comprobante */}
                                <td className="px-3 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-2 text-slate-700">
                                    {icon} <span className="font-medium">{label}</span>
                                  </div>
                                </td>
                                {/* Número */}
                                <td className="px-3 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-800">
                                      {(comprobanteLetra ? comprobanteLetra + " " : "") + (numeroSinLetra || p.numero)}
                                    </span>
                                    <EstadoBadge estado={p.estado} />
                                  </div>
                                </td>
                                {/* Fecha */}
                                <td className="px-3 py-3 whitespace-nowrap text-slate-600">{p.fecha}</td>
                                {/* Cliente */}
                                <td className="px-3 py-3 whitespace-nowrap text-slate-700 font-medium">{p.cliente}</td>
                                {/* Total */}
                                <td className="px-3 py-3 whitespace-nowrap">
                                  <CeldaTotalVenta idVenta={p.id} />
                                </td>
                                {/* Acciones */}
                                <td className="px-3 py-3 whitespace-nowrap">
                                  <div className="flex gap-1">
                                    {p.tipo === "Presupuesto" && p.estado === "Abierto" ? (
                                      <>
                                        <BotonEditar onClick={() => handleEdit(p)} />
                                        <BotonImprimir onClick={() => handleImprimir(p)} />
                                        <BotonVerDetalle onClick={() => openVistaTab(p)} />
                                        <BotonConvertir
                                          onClick={() => handleConvertir(p)}
                                          disabled={isFetchingForConversion && fetchingPresupuestoId === p.id}
                                          title={
                                            isFetchingForConversion && fetchingPresupuestoId === p.id
                                              ? "Cargando..."
                                              : "Convertir"
                                          }
                                        />
                                        <BotonEliminar onClick={() => handleDelete(p.id)} />
                                      </>
                                    ) : p.tipo === "Venta" && p.estado === "Cerrado" ? (
                                      <>
                                        <BotonImprimir onClick={() => handleImprimir(p)} />
                                        <BotonVerDetalle onClick={() => openVistaTab(p)} />
                                        <BotonEliminar onClick={() => handleDelete(p.id)} />
                                      </>
                                    ) : (
                                      <>
                                        <BotonVerDetalle onClick={() => openVistaTab(p)} />
                                        <BotonImprimir onClick={() => handleImprimir(p)} />
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <Paginador
                      totalItems={totalItems}
                      itemsPerPage={itemsPorPagina}
                      currentPage={paginaActual}
                      onPageChange={setPaginaActual}
                      onItemsPerPageChange={(n) => {
                        setItemsPorPagina(n)
                        setPaginaActual(1)
                      }}
                      opcionesItemsPorPagina={[1, 10, 15, 25, 50]}
                    />
                  </>
                )}
                {/* Vendedores: lista */}
                {activeTab === "vendedores" && (
                  <>
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={handleNuevoVendedor}
                        className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
                      >
                        <span className="text-lg">+</span> Nuevo Vendedor
                      </button>
                    </div>
                    <VendedoresTable
                      vendedores={vendedores}
                      onEdit={handleEditVendedor}
                      onDelete={handleDeleteVendedor}
                      search={searchVendedor}
                      setSearch={setSearchVendedor}
                    />
                  </>
                )}
                {/* Vendedores: nuevo/editar */}
                {(activeTab.startsWith("nuevo-vendedor") || activeTab.startsWith("editar-vendedor")) && (
                  <div className="flex justify-center items-center min-h-[60vh]">
                    <VendedorForm
                      initialData={editVendedorData}
                      onSave={handleSaveVendedor}
                      onCancel={() => closeTab(activeTab)}
                      loading={loadingVendedores}
                      error={errorVendedores}
                      localidades={localidades}
                    />
                  </div>
                )}
                {/* Presupuestos: nuevo/editar/vista */}
                {(activeTab.startsWith("nuevo-") ||
                  activeTab.startsWith("editar") ||
                  activeTab.startsWith("nueva-venta-") ||
                  activeTab.startsWith("vista-") ||
                  activeTab.startsWith("nota-credito-")) &&
                  !activeTab.startsWith("nuevo-vendedor") &&
                  !activeTab.startsWith("editar-vendedor") &&
                  (activeTab.startsWith("nueva-venta-") ? (
                    <VentaForm
                      onSave={async (payload) => {
                        await addVenta({ ...payload, tipo: "Venta", estado: "Cerrado" })
                        closeTab(activeTab)
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
                    />
                  ) : activeTab.startsWith("vista-") ? (
                    <PresupuestoVentaVista
                      data={tabs.find((t) => t.key === activeTab)?.data}
                      clientes={clientes}
                      vendedores={vendedores}
                      plazos={plazos}
                      sucursales={sucursales}
                      puntosVenta={puntosVenta}
                      comprobantes={comprobantes}
                      onImprimir={handleImprimir}
                      onEliminar={async (id) => {
                        await handleDelete(id)
                        closeTab(activeTab)
                      }}
                      onCerrar={() => closeTab(activeTab)}
                    />
                  ) : activeTab.startsWith("editar") ? (
                    <EditarPresupuestoForm
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
                      initialData={activeTabData || editPresupuesto}
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
                          if (!response.ok) {
                            let msg = "No se pudo guardar la Nota de Crédito"
                            try {
                              const data = await response.json()
                              msg = data.detail || msg
                            } catch {}
                            throw new Error(msg)
                          }
                          // Actualizar lista
                          await fetchVentas()
                          // Cerrar pestaña
                          closeTab(activeTab)
                        } catch (err) {
                          alert(err.message)
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
                      onSave={async (payload) => {
                        await addVenta({ ...payload, tipo: "Presupuesto", estado: "Abierto" })
                        closeTab(activeTab)
                      }}
                      onCancel={() => closeTab(activeTab)}
                      initialData={activeTabData || editPresupuesto}
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
                        onSave={(payload, tk) => {
                          console.info("[PresupuestosManager] onSave de ConVentaForm, tabKey:", tk)
                          handleConVentaFormSave(payload, tk)
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
            console.log("[Nota de Crédito] Cliente seleccionado:", cli)
          }}
        />

        {/* Modal selección de facturas */}
        <FacturaSelectorModal
          abierto={modalFacturasNCAbierto}
          cliente={clienteParaNC}
          onCerrar={() => setModalFacturasNCAbierto(false)}
          onSeleccionar={(facturas) => {
            setFacturasParaNC(facturas)
            setModalFacturasNCAbierto(false)
            // Abrir pestaña con formulario de Nota de Crédito
            const newKey = `nota-credito-${Date.now()}`
            setTabs((prev) => [
              ...prev,
              {
                key: newKey,
                label: `Nueva N. Crédito`,
                closable: true,
                tipo: "nota-credito",
                data: {
                  cliente: clienteParaNC,
                  facturas: facturas,
                },
              },
            ])
            setActiveTab(newKey)
          }}
        />
      </div>
    )
  }

  export default PresupuestosManager
