"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus } from "lucide-react"

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
  CLI_IDTRA: number | null
  CLI_IDVDO: number | null
  CLI_IDPLA: number | null
  CLI_IDCAC: number | null
  CLI_ACTI: string | null
}

interface ClientsDataTableProps {
  clientes: Cliente[]
  onAddNew: () => void
}

export default function ClientsDataTable({ clientes, onAddNew }: ClientsDataTableProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredClientes = clientes.filter((cliente) =>
    cliente.CLI_RAZON.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cliente.CLI_FANTASIA && cliente.CLI_FANTASIA.toLowerCase().includes(searchTerm.toLowerCase())) ||
    cliente.CLI_DOMI.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cliente.CLI_TEL1 && cliente.CLI_TEL1.includes(searchTerm)) ||
    (cliente.CLI_EMAIL && cliente.CLI_EMAIL.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (cliente.CLI_CUIT && cliente.CLI_CUIT.includes(searchTerm))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">Código</TableHead>
                <TableHead className="min-w-[200px]">Razón Social</TableHead>
                <TableHead className="min-w-[200px]">Nombre Comercial</TableHead>
                <TableHead className="min-w-[200px]">Dirección</TableHead>
                <TableHead className="min-w-[150px]">Teléfono 1</TableHead>
                <TableHead className="min-w-[150px]">Teléfono 2</TableHead>
                <TableHead className="min-w-[150px]">Teléfono 3</TableHead>
                <TableHead className="min-w-[200px]">Email</TableHead>
                <TableHead className="min-w-[150px]">CUIT</TableHead>
                <TableHead className="min-w-[150px]">IB</TableHead>
                <TableHead className="min-w-[100px]">Estado</TableHead>
                <TableHead className="min-w-[100px]">IVA</TableHead>
                <TableHead className="min-w-[200px]">Contacto</TableHead>
                <TableHead className="min-w-[150px]">Línea Crédito</TableHead>
                <TableHead className="min-w-[150px]">Saldo Cta</TableHead>
                <TableHead className="min-w-[150px]">Fecha Saldo</TableHead>
                <TableHead className="min-w-[100px]">Desc 1</TableHead>
                <TableHead className="min-w-[100px]">Desc 2</TableHead>
                <TableHead className="min-w-[100px]">Desc 3</TableHead>
                <TableHead className="min-w-[100px]">CP</TableHead>
                <TableHead className="min-w-[100px]">Zona</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClientes.map((cliente) => (
                <TableRow key={cliente.CLI_ID}>
                  <TableCell>{cliente.CLI_CODIGO}</TableCell>
                  <TableCell>{cliente.CLI_RAZON}</TableCell>
                  <TableCell>{cliente.CLI_FANTASIA}</TableCell>
                  <TableCell>{cliente.CLI_DOMI}</TableCell>
                  <TableCell>{cliente.CLI_TEL1}</TableCell>
                  <TableCell>{cliente.CLI_TEL2}</TableCell>
                  <TableCell>{cliente.CLI_TEL3}</TableCell>
                  <TableCell>{cliente.CLI_EMAIL}</TableCell>
                  <TableCell>{cliente.CLI_CUIT}</TableCell>
                  <TableCell>{cliente.CLI_IB}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        cliente.CLI_STATUS === 1
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {cliente.CLI_STATUS === 1 ? "Activo" : "Inactivo"}
                    </span>
                  </TableCell>
                  <TableCell>{cliente.CLI_IVA}</TableCell>
                  <TableCell>{cliente.CLI_CONTACTO}</TableCell>
                  <TableCell>{cliente.CLI_LINEACRED}</TableCell>
                  <TableCell>{cliente.CLI_IMPSALCTA}</TableCell>
                  <TableCell>{cliente.CLI_FECSALCTA}</TableCell>
                  <TableCell>{cliente.CLI_DESCU1}%</TableCell>
                  <TableCell>{cliente.CLI_DESCU2}%</TableCell>
                  <TableCell>{cliente.CLI_DESCU3}%</TableCell>
                  <TableCell>{cliente.CLI_CPOSTAL}</TableCell>
                  <TableCell>{cliente.CLI_ZONA}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
} 