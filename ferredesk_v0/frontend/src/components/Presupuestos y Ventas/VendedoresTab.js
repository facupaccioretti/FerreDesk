import React from "react"
import VendedoresTable from "./VendedoresTable"
import VendedorForm from "./VendedorForm"

/**
 * Componente para la gestión de vendedores
 * Extraído de PresupuestosManager.js
 * 
 * @param {Object} props - Props del componente
 * @param {string} props.activeTab - Tab activo actual
 * @param {Array} props.vendedores - Lista de vendedores
 * @param {boolean} props.loadingVendedores - Estado de carga de vendedores
 * @param {string} props.errorVendedores - Error de vendedores
 * @param {string} props.searchVendedor - Término de búsqueda
 * @param {Function} props.setSearchVendedor - Función para cambiar búsqueda
 * @param {Object} props.editVendedorData - Datos del vendedor en edición
 * @param {Array} props.localidades - Lista de localidades
 * @param {Object} props.acciones - Funciones de acciones disponibles
 * @param {Function} props.closeTab - Función para cerrar tab
 * @returns {JSX.Element} - Tab de vendedores
 */
const VendedoresTab = ({
  activeTab,
  vendedores,
  loadingVendedores,
  errorVendedores,
  searchVendedor,
  setSearchVendedor,
  editVendedorData,
  localidades,
  acciones,
  closeTab,
}) => {
  const {
    handleNuevoVendedor,
    handleEditVendedor,
    handleSaveVendedor,
    handleDeleteVendedor,
  } = acciones

  return (
    <>
      {/* Vendedores: lista */}
      {activeTab === "vendedores" && (
        <>
          <div className="flex justify-start mb-4">
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
    </>
  )
}

export default VendedoresTab 