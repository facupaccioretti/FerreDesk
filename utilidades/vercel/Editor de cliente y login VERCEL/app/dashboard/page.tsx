"use client"

import { useState, useEffect } from "react"
import DashboardHeader from "@/components/dashboard-header"
import DashboardTabs from "@/components/dashboard-tabs"

// Modelo de datos adaptado a Firebird
interface Cliente {
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
  CLI_ACTI: string | null
}

interface Barrio {
  BAR_ID: number
  BAR_DENO: string
  BAR_CPOSTAL: string | null
  BAR_ACTI: string
}

interface Localidad {
  LOC_ID: number
  LOC_DENO: string
  LOC_ACTI: string
}

interface Provincia {
  PRV_ID: number
  PRV_DENO: string
  PRV_ACTI: string | null
}

interface TipoIVA {
  TIV_ID: number
  TIV_DENO: string
}

interface RelatedData {
  barrios: Barrio[]
  localidades: Localidad[]
  provincias: Provincia[]
  tiposIVA: TipoIVA[]
}

export default function Dashboard() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [relatedData, setRelatedData] = useState<RelatedData>({
    barrios: [],
    localidades: [],
    provincias: [],
    tiposIVA: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Datos de ejemplo adaptados a Firebird
    setClientes([
      {
        CLI_ID: 1,
        CLI_CODIGO: 1001,
        CLI_RAZON: "Empresa Demo S.A.",
        CLI_FANTASIA: "Demo Company",
        CLI_DOMI: "Av. Principal 123",
        CLI_TEL1: "555-1234",
        CLI_TEL2: "555-5678",
        CLI_TEL3: null,
        CLI_EMAIL: "contacto@demo.com",
        CLI_CUIT: "30123456789",
        CLI_IB: "123456",
        CLI_STATUS: 1,
        CLI_IVA: 1,
        CLI_CONTACTO: "Juan Pérez",
        CLI_COMENTARIO: "Cliente importante",
        CLI_LINEACRED: 50000,
        CLI_IMPSALCTA: 25000.5,
        CLI_FECSALCTA: "2023-05-15",
        CLI_DESCU1: 5.0,
        CLI_DESCU2: 2.5,
        CLI_DESCU3: null,
        CLI_CPOSTAL: "1000",
        CLI_ZONA: "Centro",
        CLI_CANCELA: "N",
        CLI_IDBAR: 1,
        CLI_IDLOC: 1,
        CLI_IDPRV: 1,
        CLI_ACTI: "S",
      },
      {
        CLI_ID: 2,
        CLI_CODIGO: 1002,
        CLI_RAZON: "Comercial Test SRL",
        CLI_FANTASIA: "Test Commercial",
        CLI_DOMI: "Calle Secundaria 456",
        CLI_TEL1: "555-2468",
        CLI_TEL2: null,
        CLI_TEL3: null,
        CLI_EMAIL: "info@test.com",
        CLI_CUIT: "30987654321",
        CLI_IB: "654321",
        CLI_STATUS: 1,
        CLI_IVA: 4,
        CLI_CONTACTO: "María González",
        CLI_COMENTARIO: null,
        CLI_LINEACRED: 30000,
        CLI_IMPSALCTA: 15000.0,
        CLI_FECSALCTA: "2023-06-20",
        CLI_DESCU1: 3.0,
        CLI_DESCU2: null,
        CLI_DESCU3: null,
        CLI_CPOSTAL: "1001",
        CLI_ZONA: "Norte",
        CLI_CANCELA: "N",
        CLI_IDBAR: 2,
        CLI_IDLOC: 2,
        CLI_IDPRV: 1,
        CLI_ACTI: "S",
      },
      {
        CLI_ID: 3,
        CLI_CODIGO: 1003,
        CLI_RAZON: "Industrias Ejemplo Ltda.",
        CLI_FANTASIA: "Example Industries",
        CLI_DOMI: "Ruta 7 Km 5",
        CLI_TEL1: "555-3691",
        CLI_TEL2: "555-1472",
        CLI_TEL3: "555-2583",
        CLI_EMAIL: "ventas@ejemplo.com",
        CLI_CUIT: "30456789012",
        CLI_IB: "789012",
        CLI_STATUS: 0,
        CLI_IVA: 5,
        CLI_CONTACTO: "Roberto Sánchez",
        CLI_COMENTARIO: "Suspendido temporalmente",
        CLI_LINEACRED: 100000,
        CLI_IMPSALCTA: 75000.25,
        CLI_FECSALCTA: "2023-04-10",
        CLI_DESCU1: 10.0,
        CLI_DESCU2: 5.0,
        CLI_DESCU3: 2.0,
        CLI_CPOSTAL: "2000",
        CLI_ZONA: "Industrial",
        CLI_CANCELA: "N",
        CLI_IDBAR: 3,
        CLI_IDLOC: 3,
        CLI_IDPRV: 2,
        CLI_ACTI: "S",
      },
    ])

    setRelatedData({
      barrios: [
        { BAR_ID: 1, BAR_DENO: "Centro", BAR_CPOSTAL: "1000", BAR_ACTI: "S" },
        { BAR_ID: 2, BAR_DENO: "Norte", BAR_CPOSTAL: "1001", BAR_ACTI: "S" },
        { BAR_ID: 3, BAR_DENO: "Zona Industrial", BAR_CPOSTAL: "2000", BAR_ACTI: "S" },
        { BAR_ID: 4, BAR_DENO: "Sur", BAR_CPOSTAL: "3000", BAR_ACTI: "S" },
        { BAR_ID: 5, BAR_DENO: "Este", BAR_CPOSTAL: "4000", BAR_ACTI: "S" },
      ],
      localidades: [
        { LOC_ID: 1, LOC_DENO: "Ciudad Capital", LOC_ACTI: "S" },
        { LOC_ID: 2, LOC_DENO: "Villa Norte", LOC_ACTI: "S" },
        { LOC_ID: 3, LOC_DENO: "Parque Industrial", LOC_ACTI: "S" },
        { LOC_ID: 4, LOC_DENO: "San Martín", LOC_ACTI: "S" },
        { LOC_ID: 5, LOC_DENO: "La Plata", LOC_ACTI: "S" },
      ],
      provincias: [
        { PRV_ID: 1, PRV_DENO: "Buenos Aires", PRV_ACTI: "S" },
        { PRV_ID: 2, PRV_DENO: "Córdoba", PRV_ACTI: "S" },
        { PRV_ID: 3, PRV_DENO: "Santa Fe", PRV_ACTI: "S" },
        { PRV_ID: 4, PRV_DENO: "Mendoza", PRV_ACTI: "S" },
        { PRV_ID: 5, PRV_DENO: "Tucumán", PRV_ACTI: "S" },
      ],
      tiposIVA: [
        { TIV_ID: 1, TIV_DENO: "IVA Responsable No Inscripto" },
        { TIV_ID: 4, TIV_DENO: "IVA sujeto Exento" },
        { TIV_ID: 5, TIV_DENO: "Consumidor Final" },
        { TIV_ID: 6, TIV_DENO: "Responsable Monotributo" },
        { TIV_ID: 13, TIV_DENO: "Monotributo Social" },
      ],
    })
    setLoading(false)
  }, [])

  const handleAddClient = (newClient: Cliente) => {
    setClientes((prev) => [...prev, newClient])
  }

  const handleRelatedDataUpdate = (updatedData: RelatedData) => {
    setRelatedData(updatedData)
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Cargando...</div>
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader />
      <main className="flex-1 p-6">
        <div className="mb-6">
          <div>
            <h1 className="text-3xl font-bold">Gestión de Clientes</h1>
            <p className="text-muted-foreground">Administre la información de sus clientes</p>
          </div>
        </div>
        <DashboardTabs
          clientes={clientes}
          relatedData={relatedData}
          onClientAdded={handleAddClient}
          onRelatedDataUpdate={handleRelatedDataUpdate}
        />
      </main>
    </div>
  )
}
