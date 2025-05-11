"use client"

import type React from "react"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { X } from "lucide-react"
import ClientForm from "@/components/client-form"
import ClientsDataTable from "@/components/clients-data-table"

interface Tab {
  id: string
  label: string
  type: "list" | "form"
  active: boolean
}

interface Client {
  CLI_ID: number
  CLI_CODIGO: number
  CLI_RAZON: string
  CLI_FANTASIA: string | null
  CLI_DOMI: string
  CLI_TEL1: string | null
  CLI_TEL2: string | null
  CLI_TEL3: string | null
  CLI_EMAIL: string | null
  CLI_CUIT: string | null
  CLI_IB: string | null
  CLI_STATUS: number | null
  CLI_IVA: number | null
  CLI_CONTACTO: string | null
  CLI_COMENTARIO: string | null
  CLI_LINEACRED: number
  CLI_IMPSALCTA: number
  CLI_FECSALCTA: string
  CLI_DESCU1: number | null
  CLI_DESCU2: number | null
  CLI_DESCU3: number | null
  CLI_CPOSTAL: string | null
  CLI_ZONA: string
  CLI_CANCELA: string | null
  CLI_IDBAR: number | null
  CLI_IDLOC: number | null
  CLI_IDPRV: number | null
  CLI_IDTRA: number | null
  CLI_IDVDO: number | null
  CLI_IDPLA: number | null
  CLI_IDCAC: number | null
  CLI_ACTI: string | null
}

interface RelatedData {
  barrios: { BAR_ID: number; BAR_NOMBRE: string }[]
  localidades: { LOC_ID: number; LOC_NOMBRE: string }[]
  provincias: { PRV_ID: number; PRV_NOMBRE: string }[]
  transportes: { TRA_ID: number; TRA_NOMBRE: string }[]
  vendedores: { VDO_ID: number; VDO_NOMBRE: string }[]
  plazos: { PLA_ID: number; PLA_NOMBRE: string }[]
  categorias: { CAC_ID: number; CAC_NOMBRE: string }[]
  condicionesIVA: { id: number; nombre: string }[]
}

interface DashboardTabsProps {
  clientes: any[]
  relatedData: any
  onClientAdded: (cliente: any) => void
  onRelatedDataUpdate: (data: any) => void
}

export default function DashboardTabs({
  clientes,
  relatedData,
  onClientAdded,
  onRelatedDataUpdate,
}: DashboardTabsProps) {
  const [tabs, setTabs] = useState([
    {
      id: "list",
      label: "Lista de Clientes",
      type: "list",
      active: true,
    },
  ])
  const [activeTab, setActiveTab] = useState("list")
  const [formCounter, setFormCounter] = useState(1)

  const addNewTab = () => {
    const newTabId = `new-client-${formCounter}`
    setFormCounter((prev) => prev + 1)

    const newTab = {
      id: newTabId,
      label: "Nuevo Cliente",
      type: "form",
      active: true,
    }

    setTabs((prevTabs) => [...prevTabs, newTab])
    setActiveTab(newTabId)
  }

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (tabId === "list") return
    setTabs((prevTabs) => prevTabs.filter((tab) => tab.id !== tabId))
    if (activeTab === tabId) {
      setActiveTab("list")
    }
  }

  const handleClientAdded = (cliente: any) => {
    onClientAdded(cliente)
    setActiveTab("list")
  }

  const handleRelatedDataUpdate = (updatedData: any) => {
    onRelatedDataUpdate(updatedData)
  }

  const lastClientId = clientes.length > 0 ? Math.max(...clientes.map((c) => c.CLI_ID)) : 0
  const lastClientCode = clientes.length > 0 ? Math.max(...clientes.map((c) => c.CLI_CODIGO)) : 0

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="flex items-center justify-between mb-4">
        <TabsList className="flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div key={tab.id} className="flex items-center gap-2">
              <TabsTrigger value={tab.id} className="flex items-center gap-2">
                <span>{tab.label}</span>
                {tab.id !== "list" && (
                  <span
                    onClick={(e) => closeTab(tab.id, e)}
                    className="ml-2 rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                    style={{ display: 'inline-flex', alignItems: 'center' }}
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </TabsTrigger>
            </div>
          ))}
        </TabsList>
      </div>

      <TabsContent value="list" className="mt-0">
        <ClientsDataTable clientes={clientes} relatedData={relatedData} onAddNew={addNewTab} />
      </TabsContent>

      {tabs
        .filter((tab) => tab.type === "form")
        .map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-0">
            <ClientForm
              onClientAdded={handleClientAdded}
              relatedData={relatedData}
              onRelatedDataUpdate={handleRelatedDataUpdate}
              lastClientId={lastClientId}
              lastClientCode={lastClientCode}
              isGuestMode={false}
            />
          </TabsContent>
        ))}
    </Tabs>
  )
}
