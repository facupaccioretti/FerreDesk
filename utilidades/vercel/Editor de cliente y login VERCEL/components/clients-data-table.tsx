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
interface Barrio {
  BAR_ID: number
  BAR_DENO: string
}

interface Localidad {
  LOC_ID: number
  LOC_DENO: string
}

interface Provincia {
  PRV_ID: number
  PRV_DENO: string
}

interface TipoIVA {
  TIV_ID: number
  TIV_DENO: string
}

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

interface RelatedData {
  barrios: Barrio[]
  localidades: Localidad[]
  provincias: Provincia[]
  tiposIVA: TipoIVA[]
}

interface ClientsDataTableProps {
  clientes: Cliente[]
  relatedData: RelatedData
  onAddNew: () => void
}

export default function ClientsDataTable({ clientes, relatedData, onAddNew }: ClientsDataTableProps) {
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
  const processedClients = clientes.map((client) => ({
    ...client,
    barrio: getRelatedName(client.CLI_IDBAR, relatedData.barrios, "BAR_ID", "BAR_DENO"),
    localidad: getRelatedName(client.CLI_IDLOC, relatedData.localidades, "LOC_ID", "LOC_DENO"),
    provincia: getRelatedName(client.CLI_IDPRV, relatedData.provincias, "PRV_ID", "PRV_DENO"),
    tipoIVA: getRelatedName(client.CLI_IVA, relatedData.tiposIVA, "TIV_ID", "TIV_DENO"),
  }))

  const columns: ColumnDef<Cliente>[] = [
    { accessorKey: "CLI_CODIGO", header: "Código" },
    { accessorKey: "CLI_RAZON", header: "Razón Social" },
    { accessorKey: "CLI_FANTASIA", header: "Nombre Comercial" },
    { accessorKey: "CLI_DOMI", header: "Dirección" },
    { accessorKey: "CLI_TEL1", header: "Teléfono 1" },
    { accessorKey: "CLI_TEL2", header: "Teléfono 2" },
    { accessorKey: "CLI_TEL3", header: "Teléfono 3" },
    { accessorKey: "CLI_EMAIL", header: "Email" },
    { accessorKey: "CLI_CUIT", header: "CUIT" },
    { accessorKey: "CLI_IB", header: "IB" },
    { accessorKey: "CLI_CONTACTO", header: "Contacto" },
    { accessorKey: "CLI_COMENTARIO", header: "Comentario" },
    { accessorKey: "CLI_LINEACRED", header: "Línea de Crédito" },
    { accessorKey: "CLI_IMPSALCTA", header: "Saldo Cuenta" },
    { accessorKey: "CLI_FECSALCTA", header: "Fecha Saldo" },
    { accessorKey: "CLI_DESCU1", header: "Desc. 1" },
    { accessorKey: "CLI_DESCU2", header: "Desc. 2" },
    { accessorKey: "CLI_DESCU3", header: "Desc. 3" },
    { accessorKey: "CLI_CPOSTAL", header: "Cod. Postal" },
    { accessorKey: "CLI_ZONA", header: "Zona" },
    { accessorKey: "barrio", header: "Barrio" },
    { accessorKey: "localidad", header: "Localidad" },
    { accessorKey: "provincia", header: "Provincia" },
    { accessorKey: "tipoIVA", header: "Condición IVA" },
    { accessorKey: "CLI_STATUS", header: "Estado", cell: ({ row }) => row.getValue("CLI_STATUS") === 1 ? "Activo" : "Inactivo" },
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
        <Button onClick={onAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>
      <div className="rounded-md border">
        <div className="overflow-x-auto w-full" style={{ overflowX: 'scroll' }}>
          <Table className="min-w-[1800px]">
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
          Mostrando {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} a {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} de {table.getFilteredRowModel().rows.length} registros
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            tabIndex={0}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            tabIndex={0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            tabIndex={0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            tabIndex={0}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
