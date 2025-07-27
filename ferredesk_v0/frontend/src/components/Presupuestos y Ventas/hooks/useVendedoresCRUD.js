import { useState } from 'react'

/**
 * Hook personalizado para gestionar operaciones CRUD de vendedores
 * Extraído de PresupuestosManager.js
 * 
 * @param {Object} dependencies - Dependencias requeridas
 * @param {Function} dependencies.fetchVendedores - Función para actualizar lista de vendedores
 * @param {Function} dependencies.addVendedor - Función para agregar vendedor
 * @param {Function} dependencies.updateVendedor - Función para actualizar vendedor
 * @param {Function} dependencies.deleteVendedor - Función para eliminar vendedor
 */
const useVendedoresCRUD = ({
  fetchVendedores,
  addVendedor,
  updateVendedor,
  deleteVendedor,
}) => {
  // Estados específicos de vendedores
  const [editVendedorData, setEditVendedorData] = useState(null)
  const [searchVendedor, setSearchVendedor] = useState("")
  /**
   * Abre un nuevo tab para crear vendedor
   * @param {Function} openTab - Función para abrir tabs
   */
  const handleNuevoVendedor = (openTab) => {
    const newKey = `nuevo-vendedor-${Date.now()}`
    openTab(newKey, "Nuevo Vendedor")
  }

  /**
   * Abre un tab para editar vendedor
   * @param {Object} vendedor - Datos del vendedor a editar
   * @param {Function} openTab - Función para abrir tabs
   */
  const handleEditVendedor = (vendedor, openTab) => {
    const editKey = `editar-vendedor-${vendedor.id}`
    openTab(editKey, `Editar Vendedor: ${vendedor.nombre.substring(0, 15)}...`, vendedor)
  }

  /**
   * Guarda un vendedor (nuevo o editado)
   * @param {Object} data - Datos del vendedor
   * @param {Function} closeTab - Función para cerrar tabs
   * @param {string} activeTab - Tab activo actual
   */
  const handleSaveVendedor = async (data, closeTab, activeTab) => {
    try {
      if (editVendedorData) {
        // Combinar los datos existentes con los nuevos datos y asegurar que el ID esté incluido
        const vendedorCompleto = {
          ...editVendedorData,
          ...data,
          id: editVendedorData.id
        }
        await updateVendedor(vendedorCompleto)
      } else {
        await addVendedor(data)
      }
      fetchVendedores()
      closeTab(activeTab)
    } catch (err) {
      // Manejo de error opcional
      console.error("Error al guardar vendedor:", err)
    }
  }

  /**
   * Elimina un vendedor
   * @param {number} id - ID del vendedor a eliminar
   */
  const handleDeleteVendedor = async (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este vendedor?")) {
      try {
        await deleteVendedor(id)
        fetchVendedores()
      } catch (err) {
        console.error("Error al eliminar vendedor:", err)
      }
    }
  }

  return {
    handleNuevoVendedor,
    handleEditVendedor,
    handleSaveVendedor,
    handleDeleteVendedor,
    editVendedorData,
    setEditVendedorData,
    searchVendedor,
    setSearchVendedor,
  }
}

export default useVendedoresCRUD 