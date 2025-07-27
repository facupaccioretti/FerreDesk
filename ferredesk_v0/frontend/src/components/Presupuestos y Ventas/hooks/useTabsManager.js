import { useState, useEffect, useRef } from "react"

// Tabs principales que siempre deben estar presentes
const mainTabs = [
  { key: "presupuestos", label: "Presupuestos y Ventas", closable: false },
  { key: "vendedores", label: "Vendedores", closable: false },
]

/**
 * Hook personalizado para gestionar el sistema de tabs dinámicos
 * Extraído de PresupuestosManager.js
 * @param {Function} setEditVendedorData - Función para actualizar datos de vendedor (opcional)
 */
const useTabsManager = (setEditVendedorData = null) => {
  // Estados principales de tabs
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
        return restoredTabs
      }
    } catch (e) {
      console.error("[INIT] Error restaurando tabs:", e)
    }
    return [...mainTabs]
  })

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("presupuestosActiveTab") || "presupuestos"
  })

  const [draggedTabKey, setDraggedTabKey] = useState(null)

  // Persistencia en localStorage con debounce para evitar escrituras en cada render
  const persistTimeout = useRef(null)
  useEffect(() => {
    clearTimeout(persistTimeout.current)
    persistTimeout.current = setTimeout(() => {
      localStorage.setItem("presupuestosTabs", JSON.stringify(tabs))
      localStorage.setItem("presupuestosActiveTab", activeTab)
    }, 300)
    return () => clearTimeout(persistTimeout.current)
  }, [tabs, activeTab])

  /**
   * Abre un nuevo tab dinámico
   * @param {string} key - Clave única del tab
   * @param {string} label - Etiqueta visible del tab
   * @param {any} data - Datos asociados al tab (opcional)
   */
  const openTab = (key, label, data = null) => {
    if (setEditVendedorData) {
      setEditVendedorData(data)
    }
    setTabs((prev) => {
      if (prev.find((t) => t.key === key)) return prev
      return [...prev, { key, label, closable: true, data }]
    })
    setActiveTab(key)
  }

  /**
   * Cierra un tab y limpia los borradores asociados
   * @param {string} key - Clave del tab a cerrar
   */
  const closeTab = (key) => {
    // Eliminar borradores asociados a la pestaña que se cierra
    try {
      if (key.startsWith("editar")) {
        const tab = tabs.find((t) => t.key === key)
        const idPres = tab?.data?.id || tab?.data?.ven_id || null
        if (idPres) localStorage.removeItem(`editarPresupuestoDraft_${idPres}`)
      } else if (key.startsWith("nuevo-")) {
        localStorage.removeItem(`presupuestoFormDraft_${key}`)
      } else if (key.startsWith("nueva-venta-")) {
        localStorage.removeItem(`ventaFormDraft_${key}`)
      } else if (key.startsWith("conventa-")) {
        localStorage.removeItem(`conVentaFormDraft_${key}`)
      } else if (key.startsWith("nota-credito-")) {
        localStorage.removeItem(`notaCreditoFormDraft_${key}`)
      }
    } catch (err) {
      console.warn("[closeTab] No se pudo limpiar borrador:", err)
    }

    setTabs((prev) => prev.filter((t) => t.key !== key))
    if (activeTab === key) setActiveTab("presupuestos")
    if (setEditVendedorData) {
      setEditVendedorData(null)
    }
  }

  /**
   * Maneja el inicio del drag & drop de tabs
   * @param {string} tabKey - Clave del tab que se está arrastrando
   */
  const handleDragStart = (tabKey) => {
    setDraggedTabKey(tabKey)
  }

  /**
   * Maneja el drop de tabs para reordenar
   * @param {string} dropTabKey - Clave del tab donde se suelta
   */
  const handleDrop = (dropTabKey) => {
    if (draggedTabKey && draggedTabKey !== dropTabKey) {
      const dynamicTabs = tabs.filter((t) => t.closable)
      const fixedTabs = tabs.filter((t) => !t.closable)
      const draggedIdx = dynamicTabs.findIndex((t) => t.key === draggedTabKey)
      const dropIdx = dynamicTabs.findIndex((t) => t.key === dropTabKey)
      
      if (draggedIdx !== -1 && dropIdx !== -1) {
        const newDynamicTabs = [...dynamicTabs]
        const [draggedTab] = newDynamicTabs.splice(draggedIdx, 1)
        newDynamicTabs.splice(dropIdx, 0, draggedTab)
        setTabs([...fixedTabs, ...newDynamicTabs])
      }
    }
    setDraggedTabKey(null)
  }

  /**
   * Maneja el fin del drag & drop
   */
  const handleDragEnd = () => {
    setDraggedTabKey(null)
  }

  /**
   * Actualiza los datos de un tab existente o crea uno nuevo
   * @param {string} key - Clave del tab
   * @param {string} label - Etiqueta del tab
   * @param {any} data - Datos del tab
   * @param {string} tipo - Tipo del tab (opcional)
   */
  const updateTabData = (key, label, data, tipo = null) => {
    setTabs((prev) => {
      const existente = prev.find((t) => t.key === key)
      if (existente) {
        return prev.map((t) =>
          t.key === key
            ? {
                ...t,
                data,
                tipo: tipo || t.tipo,
              }
            : t,
        )
      }
      return [
        ...prev,
        {
          key,
          label,
          closable: true,
          data,
          tipo,
        },
      ]
    })
    setActiveTab(key)
  }

  return {
    // Estados
    tabs,
    activeTab,
    draggedTabKey,
    
    // Funciones principales
    openTab,
    closeTab,
    setActiveTab,
    updateTabData,
    
    // Funciones de drag & drop
    handleDragStart,
    handleDrop,
    handleDragEnd,
    
    // Constantes
    mainTabs,
  }
}

export default useTabsManager 