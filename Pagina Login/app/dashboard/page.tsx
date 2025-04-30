import { redirect } from "next/navigation"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import ClientsDataTable from "@/components/clients-data-table"
import DashboardHeader from "@/components/dashboard-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

interface DashboardPageProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function Dashboard({ searchParams }: DashboardPageProps) {
  // Check if user is in guest mode
  const isGuestMode = searchParams.guest === "true"

  // Check if Supabase is configured
  if (!isSupabaseConfigured() && !isGuestMode) {
    return (
      <div className="flex min-h-screen flex-col p-6">
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuración incompleta</AlertTitle>
          <AlertDescription>
            Las variables de entorno de Supabase no están configuradas. Por favor, configure NEXT_PUBLIC_SUPABASE_URL y
            NEXT_PUBLIC_SUPABASE_ANON_KEY.
          </AlertDescription>
        </Alert>
        <div className="text-center mt-8">
          <h1 className="text-3xl font-bold">Gestión de Clientes</h1>
          <p className="text-muted-foreground mt-2">No se puede acceder al dashboard sin configurar Supabase.</p>
        </div>
      </div>
    )
  }

  // For guest mode, use mock data
  if (isGuestMode) {
    // Sample mock data for demonstration
    const mockClients = [
      {
        CLI_ID: 1,
        CLI_RAZON: "Empresa Demo S.A.",
        CLI_FANTASIA: "Demo Company",
        CLI_DOMI: "Av. Principal 123",
        CLI_TEL1: "555-1234",
        CLI_TEL2: "555-5678",
        CLI_TEL3: null,
        CLI_FAX: "555-9876",
        CLI_EMAIL: "contacto@demo.com",
        CLI_CUIT: "30123456789",
        CLI_IB: "123456",
        CLI_STATUS: 1,
        CLI_IVA: "RI",
        CLI_CONTACTO: "Juan Pérez",
        CLI_CPOSTAL: "1000",
        CLI_ZONA: "Centro",
        CLI_IDBAR: 1,
        CLI_IDLOC: 1,
        CLI_IDPRV: 1,
        CLI_IDTRA: 1,
        CLI_IDVDO: 1,
        CLI_IDPLA: 1,
        CLI_IDCAC: 1,
      },
      {
        CLI_ID: 2,
        CLI_RAZON: "Comercial Test SRL",
        CLI_FANTASIA: "Test Commercial",
        CLI_DOMI: "Calle Secundaria 456",
        CLI_TEL1: "555-2468",
        CLI_TEL2: null,
        CLI_TEL3: null,
        CLI_FAX: null,
        CLI_EMAIL: "info@test.com",
        CLI_CUIT: "30987654321",
        CLI_IB: "654321",
        CLI_STATUS: 1,
        CLI_IVA: "MT",
        CLI_CONTACTO: "María González",
        CLI_CPOSTAL: "1001",
        CLI_ZONA: "Norte",
        CLI_IDBAR: 2,
        CLI_IDLOC: 2,
        CLI_IDPRV: 1,
        CLI_IDTRA: 2,
        CLI_IDVDO: 2,
        CLI_IDPLA: 1,
        CLI_IDCAC: 2,
      },
      {
        CLI_ID: 3,
        CLI_RAZON: "Industrias Ejemplo Ltda.",
        CLI_FANTASIA: "Example Industries",
        CLI_DOMI: "Ruta 7 Km 5",
        CLI_TEL1: "555-3691",
        CLI_TEL2: "555-1472",
        CLI_TEL3: "555-2583",
        CLI_FAX: "555-3692",
        CLI_EMAIL: "ventas@ejemplo.com",
        CLI_CUIT: "30456789012",
        CLI_IB: "789012",
        CLI_STATUS: 0,
        CLI_IVA: "RI",
        CLI_CONTACTO: "Roberto Sánchez",
        CLI_CPOSTAL: "2000",
        CLI_ZONA: "Industrial",
        CLI_IDBAR: 3,
        CLI_IDLOC: 3,
        CLI_IDPRV: 2,
        CLI_IDTRA: 1,
        CLI_IDVDO: 3,
        CLI_IDPLA: 2,
        CLI_IDCAC: 1,
      },
    ]

    const mockRelatedData = {
      barrios: [
        { BAR_ID: 1, BAR_NOMBRE: "Centro" },
        { BAR_ID: 2, BAR_NOMBRE: "Norte" },
        { BAR_ID: 3, BAR_NOMBRE: "Zona Industrial" },
      ],
      localidades: [
        { LOC_ID: 1, LOC_NOMBRE: "Ciudad Capital" },
        { LOC_ID: 2, LOC_NOMBRE: "Villa Norte" },
        { LOC_ID: 3, LOC_NOMBRE: "Parque Industrial" },
      ],
      provincias: [
        { PRV_ID: 1, PRV_NOMBRE: "Buenos Aires" },
        { PRV_ID: 2, PRV_NOMBRE: "Córdoba" },
      ],
      transportes: [
        { TRA_ID: 1, TRA_NOMBRE: "Transporte Rápido" },
        { TRA_ID: 2, TRA_NOMBRE: "Envíos Express" },
      ],
      vendedores: [
        { VDO_ID: 1, VDO_NOMBRE: "Carlos Gómez" },
        { VDO_ID: 2, VDO_NOMBRE: "Laura Martínez" },
        { VDO_ID: 3, VDO_NOMBRE: "Diego Rodríguez" },
      ],
      plazos: [
        { PLA_ID: 1, PLA_NOMBRE: "30 días" },
        { PLA_ID: 2, PLA_NOMBRE: "60 días" },
      ],
      categorias: [
        { CAC_ID: 1, CAC_NOMBRE: "Mayorista" },
        { CAC_ID: 2, CAC_NOMBRE: "Minorista" },
      ],
    }

    return (
      <div className="flex min-h-screen flex-col">
        <DashboardHeader isGuestMode={true} />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Gestión de Clientes</h1>
            <p className="text-muted-foreground">Administre la información de sus clientes</p>
            {isGuestMode && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Modo Invitado</AlertTitle>
                <AlertDescription>
                  Está utilizando el sistema en modo invitado. Los datos mostrados son de ejemplo y no se guardarán.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <ClientsDataTable clients={mockClients} relatedData={mockRelatedData} />
        </main>
      </div>
    )
  }

  // Regular authenticated mode
  try {
    const { data } = await supabase!.auth.getSession()

    if (!data.session) {
      redirect("/")
    }

    // Fetch clients data
    const { data: clients, error } = await supabase!.from("clientes").select("*")

    if (error) {
      console.error("Error fetching clients:", error)
    }

    // Fetch related data for foreign keys
    const { data: barrios } = await supabase!.from("barrios").select("*")
    const { data: localidades } = await supabase!.from("localidades").select("*")
    const { data: provincias } = await supabase!.from("provincias").select("*")
    const { data: transportes } = await supabase!.from("transportes").select("*")
    const { data: vendedores } = await supabase!.from("vendedores").select("*")
    const { data: plazos } = await supabase!.from("plazos").select("*")
    const { data: categorias } = await supabase!.from("categoria_cliente").select("*")

    const relatedData = {
      barrios: barrios || [],
      localidades: localidades || [],
      provincias: provincias || [],
      transportes: transportes || [],
      vendedores: vendedores || [],
      plazos: plazos || [],
      categorias: categorias || [],
    }

    return (
      <div className="flex min-h-screen flex-col">
        <DashboardHeader user={data.session.user} />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Gestión de Clientes</h1>
            <p className="text-muted-foreground">Administre la información de sus clientes</p>
          </div>
          <ClientsDataTable clients={clients || []} relatedData={relatedData} />
        </main>
      </div>
    )
  } catch (error) {
    console.error("Error in dashboard:", error)
    redirect("/")
  }
}

