import { useState } from "react"
import { getCookie } from "../../../utils/csrf"

/**
 * Hook personalizado para gestionar operaciones CRUD de comprobantes
 * Extraído de PresupuestosManager.js
 * 
 * @param {Object} dependencies - Dependencias requeridas
 * @param {Function} dependencies.openTab - Función para abrir tabs
 * @param {Function} dependencies.closeTab - Función para cerrar tabs
 * @param {Function} dependencies.updateTabData - Función para actualizar datos de tabs
 * @param {Function} dependencies.fetchVentas - Función para actualizar lista de ventas
 * @param {Function} dependencies.deleteVenta - Función para eliminar venta
 * @param {Function} dependencies.descargarPDF - Función para generar PDF
 * @param {Object} dependencies.ferreteria - Configuración de la ferretería
 * @param {boolean} dependencies.loadingFerreteria - Estado de carga de ferretería
 * @param {Function} dependencies.navigate - Función de navegación
 */
const useComprobantesCRUD = ({
  openTab,
  closeTab,
  updateTabData,
  fetchVentas,
  deleteVenta,
  descargarPDF,
  ferreteria,
  loadingFerreteria,
  navigate,
}) => {
  // Estados para gestión de conversiones
  const [conversionModal, setConversionModal] = useState({ open: false, presupuesto: null })
  const [isFetchingForConversion, setIsFetchingForConversion] = useState(false)
  const [fetchingPresupuestoId, setFetchingPresupuestoId] = useState(null)

  // Estado para el modal de vista
  const [vistaModal, setVistaModal] = useState({ open: false, data: null })

  /**
   * Edita un presupuesto/venta
   * @param {Object} presupuesto - Datos del presupuesto a editar
   */
  const handleEdit = async (presupuesto) => {
    if (!presupuesto || !presupuesto.id) return
    
    try {
      // Obtener cabecera completa con items desde el endpoint de detalle
      const [cabecera, itemsDetalle] = await Promise.all([
        fetch(`/api/ventas/${presupuesto.id}/`).then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Error al cargar cabecera" }))
            throw new Error(err.detail)
          }
          return res.json()
        }),
        fetch(`/api/venta-detalle-item-calculado/?vdi_idve=${presupuesto.id}`).then(async (res) => {
          if (!res.ok) return []
          return res.json()
        }),
      ])

      // Combinar cabecera con items calculados
      const presupuestoCompleto = {
        ...cabecera,
        items: Array.isArray(itemsDetalle) ? itemsDetalle : [],
      }

      const key = `editar-${presupuesto.id}`
      const label = `Editar ${presupuesto.numero || presupuesto.id}`
      openTab(key, label, presupuestoCompleto)
      
    } catch (error) {
      console.error('Error al cargar presupuesto para edición:', error)
      alert('Error al cargar el presupuesto: ' + error.message)
    }
  }

  /**
   * Genera e imprime PDF de un comprobante
   * @param {Object} presupuesto - Datos del presupuesto a imprimir
   */
  const handleImprimir = async (presupuesto) => {
    if (!presupuesto || !presupuesto.id) return;
    
    if (loadingFerreteria) {
      alert("Cargando configuración de la empresa, por favor espere...");
      return;
    }
    
    try {
      // Obtener datos reales de las vistas SQL usando useVentaDetalleAPI
      const [cabecera, itemsDetalle, ivaDiscriminado, todasAlicuotas] = await Promise.all([
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
        fetch(`/api/venta-iva-alicuota/?vdi_idve=${presupuesto.id}`).then(async (res) => {
          if (!res.ok) return []
          return res.json()
        }),
        fetch(`/api/productos/alicuotasiva/`).then(async (res) => {
          if (!res.ok) return []
          return res.json()
        })
      ]);

      // Construir datos del comprobante usando los datos reales de las vistas
      const datosComprobante = {
        // Datos del emisor (desde configuración de ferretería)
        emisor_razon_social: ferreteria?.razon_social,
        emisor_telefono: ferreteria?.telefono,
        emisor_condicion_iva: ferreteria?.situacion_iva,
        emisor_cuit: ferreteria?.cuit,
        emisor_ingresos_brutos: ferreteria?.ingresos_brutos,
        emisor_inicio_actividad: ferreteria?.inicio_actividad,
        
        // Datos del comprobante (desde VENTA_CALCULADO)
        comprobante: {
          letra: cabecera.comprobante_letra,
          codigo_afip: cabecera.comprobante_codigo_afip,
          nombre: cabecera.comprobante_nombre,
          tipo: cabecera.comprobante_tipo
        },
        numero_formateado: cabecera.numero_formateado,
        fecha: cabecera.ven_fecha,
        hora_creacion: cabecera.hora_creacion,
        
        // Datos del cliente (desde VENTA_CALCULADO)
        cliente: cabecera.cliente_razon,
        domicilio: cabecera.cliente_domicilio,
        condicion_iva_cliente: cabecera.cliente_condicion_iva,
        cuit: cabecera.cliente_cuit,
        localidad: cabecera.cliente_localidad,
        provincia: cabecera.cliente_provincia,
        telefono_cliente: cabecera.cliente_telefono,
        
        // Items reales (desde VENTADETALLEITEM_CALCULADO)
        items: itemsDetalle.map(item => ({
          ...item // Incluir absolutamente todos los campos del ítem original
        })),
        
        // Totales reales (desde VENTA_CALCULADO)
        ven_total: cabecera.ven_total,
        ven_impneto: cabecera.ven_impneto,
        iva_global: cabecera.iva_global,
        ven_descu1: cabecera.ven_descu1,
        ven_descu2: cabecera.ven_descu2,
        ven_descu3: cabecera.ven_descu3,
        
        // IVA discriminado completo (todas las alícuotas con porcentaje > 0)
        iva_discriminado: todasAlicuotas
          .filter(ali => ali.porce > 0) // Solo alícuotas con porcentaje > 0
          .map(ali => {
            // Buscar si existe esta alícuota en la factura
            const ivaEnFactura = ivaDiscriminado.find(iva => 
              parseFloat(iva.ali_porce) === parseFloat(ali.porce)
            );
            
            return {
              ali_porce: ali.porce,
              neto_gravado: ivaEnFactura ? ivaEnFactura.neto_gravado : 0,
              iva_total: ivaEnFactura ? ivaEnFactura.iva_total : 0
            };
          }),
        
        // Información AFIP (desde VENTA_CALCULADO)
        ven_cae: cabecera.ven_cae,
        ven_caevencimiento: cabecera.ven_caevencimiento ? new Date(cabecera.ven_caevencimiento).toLocaleDateString('es-AR') : '',
        ven_qr: cabecera.ven_qr, // Agregar el QR desde la cabecera
      };
      
      // Generar y descargar PDF usando el hook del componente, pasando la configuración
      await descargarPDF(datosComprobante, cabecera.comprobante_letra, ferreteria);
      
    } catch (err) {
      console.error("Error al imprimir:", err);
      alert("Error al generar PDF: " + (err.message || ""))
    }
  }

  /**
   * Inicia el proceso de conversión de un presupuesto
   * @param {Object} presupuesto - Datos del presupuesto a convertir
   */
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

  /**
   * Confirma la conversión de un presupuesto
   * @param {Array} selectedItems - Items seleccionados para conversión
   */
  const handleConversionConfirm = (selectedItems) => {
    const datos = conversionModal.presupuesto
    const itemsSeleccionadosObjs = (datos.items || []).filter((item) => selectedItems.includes(item.id))
    
    // Detectar tipo de conversión
    const esConversionFacturaI = datos.tipoConversion === 'factura_i_factura'
    const tipoTab = esConversionFacturaI ? 'conv-factura-i' : 'conventa'
    const labelPrefix = esConversionFacturaI ? 'Conv. Factura Interna' : 'Conversión a Factura'
    
    const tabKey = `${tipoTab}-${datos.id}`
    const label = `${labelPrefix} #${datos.numero || datos.id}`
    
    const tabData = {
      [esConversionFacturaI ? 'facturaInternaOrigen' : 'presupuestoOrigen']: datos,
      itemsSeleccionados: itemsSeleccionadosObjs.map(item => ({
        ...item,
        // Marcar items originales para bloqueo
        esBloqueado: esConversionFacturaI,
        noDescontarStock: esConversionFacturaI,
        idOriginal: esConversionFacturaI ? item.id : null
      })),
      itemsSeleccionadosIds: selectedItems,
      tipoConversion: datos.tipoConversion || 'presupuesto_venta'
    }
    
    updateTabData(tabKey, label, tabData, tipoTab)
    setConversionModal({ open: false, presupuesto: null })
  }

  /**
   * Guarda la conversión de presupuesto a factura
   * @param {Object} payload - Datos de la conversión
   * @param {string} tabKey - Clave del tab de conversión
   */
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

      const data = await response.json()

      if (!response.ok) {
        let msg = "No se pudo convertir"
        try {
          msg = data.detail || msg
        } catch {}
        throw new Error(msg)
      }

      await fetchVentas()
      
      // Devolver la respuesta del backend para que ConVentaForm pueda procesar los datos de ARCA
      return data
    } catch (err) {
      alert("Error al convertir: " + (err.message || ""))
      throw err
    }
  }

  /**
   * Cancela la conversión de presupuesto
   * @param {string} tabKey - Clave del tab de conversión
   */
  const handleConVentaFormCancel = (tabKey) => {
    closeTab(tabKey)
  }

  /**
   * Guarda la conversión de factura interna a factura fiscal
   * @param {Object} payload - Datos de la conversión
   * @param {string} tabKey - Clave del tab de conversión
   * @param {string} endpoint - Endpoint específico (opcional)
   */
  const handleConVentaFormSaveFacturaI = async (payload, tabKey, endpoint) => {
    try {
      const csrftoken = getCookie("csrftoken")
      const response = await fetch(endpoint || "/api/convertir-factura-interna/", {
        method: "POST",
        headers: {
          "X-CSRFToken": csrftoken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        credentials: "include",
      })

      const data = await response.json()

      if (!response.ok) {
        let msg = "No se pudo convertir la factura interna"
        try {
          msg = data.detail || msg
        } catch {}
        throw new Error(msg)
      }

      await fetchVentas()
      
      // Devolver la respuesta del backend para que ConVentaForm pueda procesar los datos de ARCA
      return data
    } catch (err) {
      alert("Error al convertir factura interna: " + (err.message || ""))
      throw err
    }
  }

  /**
   * Elimina un presupuesto/venta
   * @param {number} id - ID del presupuesto/venta a eliminar
   */
  const handleDelete = async (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este presupuesto/venta?")) {
      try {
        await deleteVenta(id)
      } catch (err) {
        alert("Error al eliminar: " + (err.message || ""))
      }
    }
  }

  /**
   * Abre una vista no editable de un presupuesto
   * @param {Object} presupuesto - Datos del presupuesto
   */
  const openVistaTab = (presupuesto) => {
    // En lugar de abrir una tab, abrimos un modal
    setVistaModal({ open: true, data: presupuesto })
  }

  /**
   * Detecta si una factura interna puede convertirse
   * @param {Object} item - Item a verificar
   * @returns {boolean} - True si es convertible
   */
  const esFacturaInternaConvertible = (item) => {
    const esFacturaInterna = item.comprobante_tipo === 'factura_interna' || 
      (item.comprobante_nombre && item.comprobante_nombre.toLowerCase().includes('interna'));
    return esFacturaInterna;
  }

  /**
   * Convierte una factura interna a factura fiscal
   * @param {Object} facturaInterna - Datos de la factura interna
   */
  const handleConvertirFacturaI = async (facturaInterna) => {
    if (!facturaInterna || !facturaInterna.id || (isFetchingForConversion && fetchingPresupuestoId === facturaInterna.id)) return;

    setFetchingPresupuestoId(facturaInterna.id);
    setIsFetchingForConversion(true);

    try {
      const [cabecera, itemsDetalle] = await Promise.all([
        fetch(`/api/venta-calculada/${facturaInterna.id}/`).then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Error cabecera" }));
            throw new Error(err.detail);
          }
          return res.json();
        }),
        fetch(`/api/venta-detalle-item-calculado/?vdi_idve=${facturaInterna.id}`).then(async (res) => {
          if (!res.ok) return [];
          return res.json();
        }),
      ]);

      const facturaInternaConDetalle = {
        ...(cabecera.venta || facturaInterna),
        items: Array.isArray(itemsDetalle) ? itemsDetalle : [],
      };

      const itemsConId = facturaInternaConDetalle.items.map((it, idx) => ({
        ...it,
        id: it.id || it.vdi_idve || it.vdi_id || idx + 1,
      }));

      // Marcar que es conversión de factura interna
      setConversionModal({ 
        open: true, 
        presupuesto: { 
          ...facturaInternaConDetalle, 
          items: itemsConId,
          tipoConversion: 'factura_i_factura'
        } 
      });
    } catch (error) {
      console.error("Error al obtener detalle para conversión:", error);
      alert(error.message);
    } finally {
      setIsFetchingForConversion(false);
      setFetchingPresupuestoId(null);
    }
  }

  /**
   * Crea una nota de crédito a partir de una factura seleccionada
   * @param {Object} factura - Datos de la factura para crear NC
   */
  const handleNotaCredito = async (factura) => {
    if (!factura || !factura.id) return;
    
    // Validar que sea una factura válida para NC
    const esFacturaValida = factura.comprobante?.tipo === 'factura' || 
                           factura.comprobante?.tipo === 'venta' || 
                           factura.comprobante?.tipo === 'factura_interna';
    const letraValida = ['A', 'B', 'C', 'I'].includes(factura.comprobante?.letra);
    const estaCerrada = factura.estado === 'Cerrado';
    
    if (!esFacturaValida || !letraValida) {
      alert('Esta factura no puede tener una nota de crédito asociada.');
      return;
    }
    
    if (!estaCerrada) {
      alert('Solo se pueden crear notas de crédito para facturas cerradas.');
      return;
    }
    
    // Obtener datos del cliente
    // Robustez: poblar datos del cliente con múltiples posibles campos
    const cliente = {
      id: factura.ven_idcli,
      razon: factura.cliente_nombre || factura.cliente,
      nombre: factura.cliente_nombre || factura.cliente,
      cuit: factura.cuit || factura.ven_cuit || '',
      domicilio: factura.domicilio || factura.ven_domicilio || '',
      plazo_id: factura.ven_idpla
    };
    
    // Crear tab de nota de crédito con datos pre-seleccionados
    const newKey = `nota-credito-${Date.now()}`;
    const label = `N. Crédito - ${factura.numero_formateado}`;
    const data = {
      cliente: cliente,
      facturas: [factura]
    };
    
    updateTabData(newKey, label, data, "nota-credito");
  }

  return {
    // Estados
    conversionModal,
    isFetchingForConversion,
    fetchingPresupuestoId,
    vistaModal, // Exponer el estado del modal de vista
    
    // Funciones CRUD
    handleEdit,
    handleImprimir,
    handleConvertir,
    handleDelete,
    openVistaTab,
    
    // Funciones de conversión
    handleConversionConfirm,
    handleConVentaFormSave,
    handleConVentaFormCancel,
    handleConVentaFormSaveFacturaI,
    handleConvertirFacturaI,
    
    // Funciones de utilidad
    esFacturaInternaConvertible,
    handleNotaCredito,
    
    // Setters para estados
    setConversionModal,
    setVistaModal, // Exponer el setter para el modal de vista
  }
}

export default useComprobantesCRUD 