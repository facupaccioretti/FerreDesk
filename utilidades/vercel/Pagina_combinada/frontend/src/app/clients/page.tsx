"use client"

import { useState } from 'react'
import ClientsDataTable from '@/components/clients-data-table'
import ClientForm from '@/components/client-form'
import DashboardBackground from '@/components/DashboardBackground'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'

// Datos de ejemplo - Reemplazar con datos reales de la API
const clientesEjemplo = [
  {
    CLI_ID: 1,
    CLI_CODIGO: 1001,
    CLI_RAZON: "Empresa Ejemplo S.A.",
    CLI_FANTASIA: "Ejemplo S.A.",
    CLI_DOMI: "Calle Principal 123",
    CLI_TEL1: "123-456-7890",
    CLI_TEL2: null,
    CLI_TEL3: null,
    CLI_EMAIL: "contacto@ejemplo.com",
    CLI_CUIT: "30-12345678-9",
    CLI_IB: "123456789",
    CLI_STATUS: 1,
    CLI_IVA: 1,
    CLI_CONTACTO: "Juan Pérez",
    CLI_COMENTARIO: "Cliente preferencial",
    CLI_LINEACRED: 100000,
    CLI_IMPSALCTA: 50000,
    CLI_FECSALCTA: "2024-05-10",
    CLI_DESCU1: 10,
    CLI_DESCU2: 5,
    CLI_DESCU3: 0,
    CLI_CPOSTAL: "1234",
    CLI_ZONA: "Norte",
    CLI_CANCELA: "N",
    CLI_IDBAR: 1,
    CLI_IDLOC: 1,
    CLI_IDPRV: 1,
    CLI_IDTRA: null,
    CLI_IDVDO: null,
    CLI_IDPLA: null,
    CLI_IDCAC: null,
    CLI_ACTI: "S"
  },
  {
    CLI_ID: 2,
    CLI_CODIGO: 1002,
    CLI_RAZON: "Comercio XYZ S.R.L.",
    CLI_FANTASIA: "XYZ",
    CLI_DOMI: "Avenida Central 456",
    CLI_TEL1: "987-654-3210",
    CLI_TEL2: "987-654-3211",
    CLI_TEL3: null,
    CLI_EMAIL: "info@xyz.com",
    CLI_CUIT: "30-98765432-1",
    CLI_IB: "987654321",
    CLI_STATUS: 1,
    CLI_IVA: 2,
    CLI_CONTACTO: "María García",
    CLI_COMENTARIO: null,
    CLI_LINEACRED: 50000,
    CLI_IMPSALCTA: 25000,
    CLI_FECSALCTA: "2024-05-10",
    CLI_DESCU1: 5,
    CLI_DESCU2: 0,
    CLI_DESCU3: 0,
    CLI_CPOSTAL: "1235",
    CLI_ZONA: "Sur",
    CLI_CANCELA: "N",
    CLI_IDBAR: 2,
    CLI_IDLOC: 2,
    CLI_IDPRV: 2,
    CLI_IDTRA: null,
    CLI_IDVDO: null,
    CLI_IDPLA: null,
    CLI_IDCAC: null,
    CLI_ACTI: "S"
  }
]

// Datos de ejemplo para las entidades relacionadas
const relatedData = {
  barrios: [
    { BAR_ID: 1, BAR_DENO: "Centro", BAR_CPOSTAL: "1234", BAR_ACTI: "S" },
    { BAR_ID: 2, BAR_DENO: "Norte", BAR_CPOSTAL: "1235", BAR_ACTI: "S" },
  ],
  localidades: [
    { LOC_ID: 1, LOC_DENO: "Ciudad Ejemplo", LOC_ACTI: "S" },
    { LOC_ID: 2, LOC_DENO: "Otra Ciudad", LOC_ACTI: "S" },
  ],
  provincias: [
    { PRV_ID: 1, PRV_DENO: "Buenos Aires", PRV_ACTI: "S" },
    { PRV_ID: 2, PRV_DENO: "Córdoba", PRV_ACTI: "S" },
  ],
  tiposIVA: [
    { TIV_ID: 1, TIV_DENO: "Responsable Inscripto" },
    { TIV_ID: 2, TIV_DENO: "Monotributista" },
    { TIV_ID: 3, TIV_DENO: "Exento" },
  ],
}

export default function ClientsPage() {
  const [clientes, setClientes] = useState(clientesEjemplo)
  const [lastClientId, setLastClientId] = useState(2)
  const [lastClientCode, setLastClientCode] = useState(1002)

  // Tabs: [{ key: string, label: string, content: ReactNode, closable: boolean }]
  const [tabs, setTabs] = useState([
    { key: 'list', label: 'Lista de Clientes', content: null, closable: false }
  ])
  const [activeTab, setActiveTab] = useState('list')

  // Actualiza el contenido de la tab de lista
  const getListTabContent = () => (
    <div className="bg-card rounded-lg shadow-lg p-6">
      <ClientsDataTable clientes={clientes} onAddNew={handleAddNew} />
    </div>
  )

  // Actualiza el contenido de la tab de nuevo cliente
  const getNewClientTabContent = () => (
    <div className="mb-8">
      <ClientForm
        onClientAdded={handleClientAdded}
        relatedData={relatedData}
        lastClientId={lastClientId}
        lastClientCode={lastClientCode}
        isGuestMode={false}
        onRelatedDataUpdate={handleRelatedDataUpdate}
      />
    </div>
  )

  // Abrir tab de nuevo cliente (solo una vez)
  function handleAddNew() {
    if (!tabs.find(tab => tab.key === 'new')) {
      setTabs([...tabs, {
        key: 'new',
        label: 'Nuevo Cliente',
        content: getNewClientTabContent(),
        closable: true
      }])
    }
    setActiveTab('new')
  }

  // Cuando se agrega un cliente, cerrar el tab de nuevo cliente y actualizar la lista
  function handleClientAdded(newClient: any) {
    setClientes([...clientes, newClient])
    setLastClientId(newClient.CLI_ID)
    setLastClientCode(newClient.CLI_CODIGO)
    // Cerrar tab de nuevo cliente
    setTabs(tabs => tabs.filter(tab => tab.key !== 'new'))
    setActiveTab('list')
  }

  function handleRelatedDataUpdate(data: any) {
    // Aquí se actualizarían los datos relacionados
    console.log('Datos relacionados actualizados:', data)
  }

  // Cerrar tab
  function handleCloseTab(key: string) {
    setTabs(tabs => tabs.filter(tab => tab.key !== key))
    if (activeTab === key) setActiveTab('list')
  }

  // Renderizar contenido de la tab activa
  let activeContent = null
  if (activeTab === 'list') {
    activeContent = getListTabContent()
  } else {
    const tab = tabs.find(tab => tab.key === activeTab)
    activeContent = tab ? tab.content : null
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardBackground />
      <div className="container mx-auto py-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Gestión de Clientes</h1>
          <Button onClick={handleAddNew} disabled={!!tabs.find(tab => tab.key === 'new')}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Cliente
          </Button>
        </div>
        {/* Tabs */}
        <div className="mb-4 flex border-b border-gray-300 dark:border-gray-700">
          {tabs.map(tab => (
            <div
              key={tab.key}
              className={`px-6 py-2 cursor-pointer border-t border-l border-r rounded-t-lg mr-2 flex items-center gap-2 ${activeTab === tab.key ? 'bg-background font-bold' : 'bg-muted text-muted-foreground'}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.closable && (
                <button
                  className="ml-2 text-muted-foreground hover:text-destructive"
                  onClick={e => { e.stopPropagation(); handleCloseTab(tab.key) }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {/* Contenido de la tab activa */}
        {activeContent}
      </div>
    </div>
  )
} 