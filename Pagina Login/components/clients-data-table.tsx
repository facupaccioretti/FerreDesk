"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  getFilteredRowModel,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Search } from "lucide-react"

// Updated interface to match Firebird database schema
interface Client {
  CLI_ID: number
  CLI_RAZON: string
  CLI_FANTASIA: string | null
  CLI_DOMI: string
  CLI_TEL1: string | null
  CLI_TEL2: string | null
  CLI_TEL3: string | null
  CLI_FAX: string | null
  CLI_EMAIL: string | null
  CLI_CUIT: string | null
  CLI_IB: string | null
  CLI_STATUS: number | null
  CLI_IVA: string | null
  CLI_CONTACTO: string | null
  CLI_CPOSTAL: string | null
  CLI_ZONA: string
  CLI_IDBAR: number | null
  CLI_IDLOC: number | null
  CLI_IDPRV: number | null
  CLI_IDTRA: number | null
  CLI_IDVDO: number | null
  CLI_IDPLA: number | null
  CLI_IDCAC: number | null
  // Related entities (for display purposes)
  barrio?: string
  localidad?: string
  provincia?: string
  transporte?: string
  vendedor?: string
  plazo?: string
  categoria?: string
}

interface ClientsDataTableProps {
  clients: Client[]
  relatedData?: {
    barrios: { BAR_ID: number; BAR_NOMBRE: string }[]
    localidades: { LOC_ID: number; LOC_NOMBRE: string }[]
    provincias: { PRV_ID: number; PRV_NOMBRE: string }[]
    transportes: { TRA_ID: number; TRA_NOMBRE: string }[]
    vendedores: { VDO_ID: number; VDO_NOMBRE: string }[]
    plazos: { PLA_ID: number; PLA_NOMBRE: string }[]
    categorias: { CAC_ID: number; CAC_NOMBRE: string }[]
  }
}

export default function ClientsDataTable({
  clients,
  relatedData = {
    barrios: [],
    localidades: [],
    provincias: [],
    transportes: [],
    vendedores: [],
    plazos: [],
    categorias: [],
  },
}: ClientsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")

  // Helper function to get related entity name
  const getRelatedName = (
    id: number | null,
    entities: { [key: string]: any }[],
    idField: string,
    nameField: string,
  ) => {
    if (id === null) return ""
    const entity = entities.find((e) => e[idField] === id)
    return entity ? entity[nameField] : ""
  }

  // Process clients to include related entity names
  const processedClients = clients.map((client) => ({
    ...client,
    barrio: getRelatedName(client.CLI_IDBAR, relatedData.barrios, "BAR_ID", "BAR_NOMBRE"),
    localidad: getRelatedName(client.CLI_IDLOC, relatedData.localidades, "LOC_ID", "LOC_NOMBRE"),
    provincia: getRelatedName(client.CLI_IDPRV, relatedData.provincias, "PRV_ID", "PRV_NOMBRE"),
    transporte: getRelatedName(client.CLI_IDTRA, relatedData.transportes, "TRA_ID", "TRA_NOMBRE"),
    vendedor: getRelatedName(client.CLI_IDVDO, relatedData.vendedores, "VDO_ID", "VDO_NOMBRE"),
    plazo: getRelatedName(client.CLI_IDPLA, relatedData.plazos, "PLA_ID", "PLA_NOMBRE"),
    categoria: getRelatedName(client.CLI_IDCAC, relatedData.categorias, "CAC_ID", "CAC_NOMBRE"),
  }))

  const columns: ColumnDef<Client>[] = [
    {
      accessorKey: "CLI_ID",
      header: "ID",
    },
    {
      accessorKey: "CLI_RAZON",
      header: "Razón Social",
    },
    {
      accessorKey: "CLI_FANTASIA",
      header: "Nombre Comercial",
    },
    {
      accessorKey: "CLI_DOMI",
      header: "Dirección",
    },
    {
      accessorKey: "CLI_TEL1",
      header: "Tel1",
    },
    {
      accessorKey: "CLI_TEL2",
      header: "Tel2",
    },
    {
      accessorKey: "CLI_TEL3",
      header: "Tel3",
    },
    {
      accessorKey: "CLI_FAX",
      header: "FAX",
    },
    {
      accessorKey: "CLI_EMAIL",
      header: "Email",
    },
    {
      accessorKey: "CLI_CUIT",
      header: "CUIT",
    },
    {
      accessorKey: "CLI_IB",
      header: "IB",
    },
    {
      accessorKey: "CLI_STATUS",
      header: "Estado",
      cell: ({ row }) => {
        const status = row.getValue("CLI_STATUS")
        return status === 1 ? "Activo" : "Inactivo"
      },
    },
    {
      accessorKey: "CLI_IVA",
      header: "IVA",
    },
    {
      accessorKey: "CLI_CONTACTO",
      header: "Contacto",
    },
    {
      accessorKey: "CLI_CPOSTAL",
      header: "Cod.Postal",
    },
    {
      accessorKey: "CLI_ZONA",
      header: "Zona",
    },
    {
      accessorKey: "barrio",
      header: "Barrio",
    },
    {
      accessorKey: "localidad",
      header: "Localidad",
    },
    {
      accessorKey: "provincia",
      header: "Provincia",
    },
    {
      accessorKey: "transporte",
      header: "Transporte",
    },
    {
      accessorKey: "vendedor",
      header: "Vendedor",
    },
    {
      accessorKey: "plazo",
      header: "Plazo",
    },
    {
      accessorKey: "categoria",
      header: "Categoría",
    },
  ]

  const table = useReactTable({
    data: processedClients,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-9 w-[250px]"
          />
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No hay resultados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Mostrando {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} a{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length,
          )}{" "}
          de {table.getFilteredRowModel().rows.length} registros
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

