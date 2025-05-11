"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Save, Check, ChevronsUpDown } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import RelatedEntityForm from "@/components/related-entity-form"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"

// Define the client interface
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

// Adaptar interfaces para usar los nombres y tipos reales
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

interface ClientFormProps {
  onClientAdded: (client: any) => void
  relatedData: RelatedData
  lastClientId: number
  lastClientCode: number
  isGuestMode: boolean
  onRelatedDataUpdate: (data: RelatedData) => void
}

export default function ClientForm({
  onClientAdded,
  relatedData,
  lastClientId,
  lastClientCode,
  isGuestMode,
  onRelatedDataUpdate,
}: ClientFormProps) {
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState<Date>(new Date())
  const [openBarrio, setOpenBarrio] = useState(false)
  const [openLocalidad, setOpenLocalidad] = useState(false)
  const [openProvincia, setOpenProvincia] = useState(false)
  const [formData, setFormData] = useState<Partial<Client>>({
    CLI_STATUS: 1,
    CLI_ZONA: "",
    CLI_LINEACRED: 0,
    CLI_IMPSALCTA: 0,
    CLI_FECSALCTA: format(new Date(), "yyyy-MM-dd"),
    CLI_CANCELA: "N",
    CLI_ACTI: "S",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement

    // Handle numeric inputs
    if (type === "number") {
      setFormData((prev) => ({ ...prev, [name]: value === "" ? 0 : Number(value) }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    // Convert to number if the field is expected to be numeric
    if (
      [
        "CLI_IDBAR",
        "CLI_IDLOC",
        "CLI_IDPRV",
        "CLI_IDTRA",
        "CLI_IDVDO",
        "CLI_IDPLA",
        "CLI_IDCAC",
        "CLI_STATUS",
        "CLI_IVA",
      ].includes(name)
    ) {
      setFormData((prev) => ({ ...prev, [name]: Number(value) }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setDate(date)
      setFormData((prev) => ({ ...prev, CLI_FECSALCTA: format(date, "yyyy-MM-dd") }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Create a new client with the form data
      const newClient: Client = {
        CLI_ID: lastClientId + 1,
        CLI_CODIGO: lastClientCode + 1,
        CLI_RAZON: formData.CLI_RAZON || "",
        CLI_FANTASIA: formData.CLI_FANTASIA || null,
        CLI_DOMI: formData.CLI_DOMI || "",
        CLI_TEL1: formData.CLI_TEL1 || null,
        CLI_TEL2: formData.CLI_TEL2 || null,
        CLI_TEL3: formData.CLI_TEL3 || null,
        CLI_EMAIL: formData.CLI_EMAIL || null,
        CLI_CUIT: formData.CLI_CUIT || null,
        CLI_IB: formData.CLI_IB || null,
        CLI_STATUS: formData.CLI_STATUS || 1,
        CLI_IVA: formData.CLI_IVA || null,
        CLI_CONTACTO: formData.CLI_CONTACTO || null,
        CLI_COMENTARIO: formData.CLI_COMENTARIO || null,
        CLI_LINEACRED: formData.CLI_LINEACRED || 0,
        CLI_IMPSALCTA: formData.CLI_IMPSALCTA || 0,
        CLI_FECSALCTA: formData.CLI_FECSALCTA || format(new Date(), "yyyy-MM-dd"),
        CLI_DESCU1: formData.CLI_DESCU1 || null,
        CLI_DESCU2: formData.CLI_DESCU2 || null,
        CLI_DESCU3: formData.CLI_DESCU3 || null,
        CLI_CPOSTAL: formData.CLI_CPOSTAL || null,
        CLI_ZONA: formData.CLI_ZONA || "",
        CLI_CANCELA: formData.CLI_CANCELA || "N",
        CLI_IDBAR: formData.CLI_IDBAR || null,
        CLI_IDLOC: formData.CLI_IDLOC || null,
        CLI_IDPRV: formData.CLI_IDPRV || null,
        CLI_IDTRA: formData.CLI_IDTRA || null,
        CLI_IDVDO: formData.CLI_IDVDO || null,
        CLI_IDPLA: formData.CLI_IDPLA || null,
        CLI_IDCAC: formData.CLI_IDCAC || null,
        CLI_ACTI: formData.CLI_ACTI || "S",
      }

      // Simulate a server delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Call the callback to add the client to the list
      onClientAdded(newClient)

      // Reset form
      setFormData({
        CLI_STATUS: 1,
        CLI_ZONA: "",
        CLI_LINEACRED: 0,
        CLI_IMPSALCTA: 0,
        CLI_FECSALCTA: format(new Date(), "yyyy-MM-dd"),
        CLI_CANCELA: "N",
        CLI_ACTI: "S",
      })
    } catch (error) {
      console.error("Error adding client:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleEntityAdded = (entityType: string, newEntity: { id: number; name: string }) => {
    switch (entityType) {
      case "barrio":
        onRelatedDataUpdate({
          ...relatedData,
          barrios: [...relatedData.barrios, { BAR_ID: newEntity.id, BAR_DENO: newEntity.name }],
        })
        break
      case "localidad":
        onRelatedDataUpdate({
          ...relatedData,
          localidades: [...relatedData.localidades, { LOC_ID: newEntity.id, LOC_DENO: newEntity.name }],
        })
        break
      case "provincia":
        onRelatedDataUpdate({
          ...relatedData,
          provincias: [...relatedData.provincias, { PRV_ID: newEntity.id, PRV_DENO: newEntity.name }],
        })
        break
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo Cliente</CardTitle>
        <CardDescription>Complete el formulario para agregar un nuevo cliente al sistema.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Información básica */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Información Básica</h3>

              <div className="space-y-2">
                <Label htmlFor="CLI_RAZON">
                  Razón Social <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="CLI_RAZON"
                  name="CLI_RAZON"
                  value={formData.CLI_RAZON || ""}
                  onChange={handleChange}
                  required
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="CLI_FANTASIA">Nombre Comercial</Label>
                <Input
                  id="CLI_FANTASIA"
                  name="CLI_FANTASIA"
                  value={formData.CLI_FANTASIA || ""}
                  onChange={handleChange}
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="CLI_DOMI">
                  Dirección <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="CLI_DOMI"
                  name="CLI_DOMI"
                  value={formData.CLI_DOMI || ""}
                  onChange={handleChange}
                  required
                  maxLength={40}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="CLI_CPOSTAL">Código Postal</Label>
                <Input
                  id="CLI_CPOSTAL"
                  name="CLI_CPOSTAL"
                  value={formData.CLI_CPOSTAL || ""}
                  onChange={handleChange}
                  maxLength={7}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="CLI_ZONA">
                  Zona <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="CLI_ZONA"
                  name="CLI_ZONA"
                  value={formData.CLI_ZONA || ""}
                  onChange={handleChange}
                  required
                  maxLength={10}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="CLI_CONTACTO">Contacto</Label>
                <Input
                  id="CLI_CONTACTO"
                  name="CLI_CONTACTO"
                  value={formData.CLI_CONTACTO || ""}
                  onChange={handleChange}
                  maxLength={40}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="CLI_COMENTARIO">Comentario</Label>
                <Textarea
                  id="CLI_COMENTARIO"
                  name="CLI_COMENTARIO"
                  value={formData.CLI_COMENTARIO || ""}
                  onChange={handleChange}
                  maxLength={50}
                  rows={3}
                />
              </div>
            </div>

            {/* Contacto e Impuestos */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Contacto e Impuestos</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="CLI_TEL1">Teléfono 1</Label>
                  <Input
                    id="CLI_TEL1"
                    name="CLI_TEL1"
                    value={formData.CLI_TEL1 || ""}
                    onChange={handleChange}
                    maxLength={12}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="CLI_TEL2">Teléfono 2</Label>
                  <Input
                    id="CLI_TEL2"
                    name="CLI_TEL2"
                    value={formData.CLI_TEL2 || ""}
                    onChange={handleChange}
                    maxLength={12}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="CLI_TEL3">Teléfono 3</Label>
                  <Input
                    id="CLI_TEL3"
                    name="CLI_TEL3"
                    value={formData.CLI_TEL3 || ""}
                    onChange={handleChange}
                    maxLength={12}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="CLI_EMAIL">Email</Label>
                  <Input
                    id="CLI_EMAIL"
                    name="CLI_EMAIL"
                    type="email"
                    value={formData.CLI_EMAIL || ""}
                    onChange={handleChange}
                    maxLength={50}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="CLI_CUIT">CUIT</Label>
                  <Input
                    id="CLI_CUIT"
                    name="CLI_CUIT"
                    value={formData.CLI_CUIT || ""}
                    onChange={handleChange}
                    maxLength={11}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="CLI_IB">Ingresos Brutos</Label>
                  <Input
                    id="CLI_IB"
                    name="CLI_IB"
                    value={formData.CLI_IB || ""}
                    onChange={handleChange}
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="CLI_STATUS">Estado</Label>
                <Select
                  onValueChange={(value) => handleSelectChange("CLI_STATUS", value)}
                  value={formData.CLI_STATUS?.toString() || "1"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Activo</SelectItem>
                    <SelectItem value="0">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="CLI_CANCELA">Cancelado</Label>
                  <Select
                    onValueChange={(value) => handleSelectChange("CLI_CANCELA", value)}
                    value={formData.CLI_CANCELA || "N"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="S">Sí</SelectItem>
                      <SelectItem value="N">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="CLI_ACTI">Activo</Label>
                  <Select
                    onValueChange={(value) => handleSelectChange("CLI_ACTI", value)}
                    value={formData.CLI_ACTI || "S"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="S">Sí</SelectItem>
                      <SelectItem value="N">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Información Comercial */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Información Comercial</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="CLI_LINEACRED">Línea de Crédito</Label>
                <Input
                  id="CLI_LINEACRED"
                  name="CLI_LINEACRED"
                  type="number"
                  value={formData.CLI_LINEACRED || 0}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="CLI_IMPSALCTA">Saldo en Cuenta</Label>
                <Input
                  id="CLI_IMPSALCTA"
                  name="CLI_IMPSALCTA"
                  type="number"
                  step="0.01"
                  value={formData.CLI_IMPSALCTA || 0}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="CLI_FECSALCTA">Fecha Saldo</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                    >
                      {date ? format(date, "PPP", { locale: es }) : <span>Seleccione una fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={date} onSelect={handleDateChange} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="CLI_DESCU1">Descuento 1 (%)</Label>
                <Input
                  id="CLI_DESCU1"
                  name="CLI_DESCU1"
                  type="number"
                  step="0.01"
                  value={formData.CLI_DESCU1 || ""}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="CLI_DESCU2">Descuento 2 (%)</Label>
                <Input
                  id="CLI_DESCU2"
                  name="CLI_DESCU2"
                  type="number"
                  step="0.01"
                  value={formData.CLI_DESCU2 || ""}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="CLI_DESCU3">Descuento 3 (%)</Label>
                <Input
                  id="CLI_DESCU3"
                  name="CLI_DESCU3"
                  type="number"
                  step="0.01"
                  value={formData.CLI_DESCU3 || ""}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Ubicación y Relaciones */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Ubicación y Relaciones</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="CLI_IDBAR">Barrio</Label>
                <div className="flex gap-2">
                  <Popover open={openBarrio} onOpenChange={setOpenBarrio}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openBarrio}
                        className="w-full justify-between"
                      >
                        {formData.CLI_IDBAR
                          ? relatedData.barrios.find((barrio) => barrio.BAR_ID === formData.CLI_IDBAR)?.BAR_DENO
                          : "Seleccionar barrio..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Buscar barrio..." />
                        <CommandEmpty>No se encontraron barrios.</CommandEmpty>
                        <CommandGroup>
                          {relatedData.barrios.map((barrio) => (
                            <CommandItem
                              key={barrio.BAR_ID}
                              value={barrio.BAR_DENO}
                              onSelect={() => {
                                handleSelectChange("CLI_IDBAR", barrio.BAR_ID.toString())
                                setOpenBarrio(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.CLI_IDBAR === barrio.BAR_ID ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {barrio.BAR_DENO}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <RelatedEntityForm
                    entityType="barrio"
                    entityName="Barrio"
                    onEntityAdded={(newEntity) => handleEntityAdded("barrio", newEntity)}
                    lastId={Math.max(...relatedData.barrios.map((b) => b.BAR_ID), 0)}
                    isGuestMode={isGuestMode}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="CLI_IDLOC">Localidad</Label>
                <div className="flex gap-2">
                  <Popover open={openLocalidad} onOpenChange={setOpenLocalidad}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openLocalidad}
                        className="w-full justify-between"
                      >
                        {formData.CLI_IDLOC
                          ? relatedData.localidades.find((localidad) => localidad.LOC_ID === formData.CLI_IDLOC)?.LOC_DENO
                          : "Seleccionar localidad..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Buscar localidad..." />
                        <CommandEmpty>No se encontraron localidades.</CommandEmpty>
                        <CommandGroup>
                          {relatedData.localidades.map((localidad) => (
                            <CommandItem
                              key={localidad.LOC_ID}
                              value={localidad.LOC_DENO}
                              onSelect={() => {
                                handleSelectChange("CLI_IDLOC", localidad.LOC_ID.toString())
                                setOpenLocalidad(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.CLI_IDLOC === localidad.LOC_ID ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {localidad.LOC_DENO}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <RelatedEntityForm
                    entityType="localidad"
                    entityName="Localidad"
                    onEntityAdded={(newEntity) => handleEntityAdded("localidad", newEntity)}
                    lastId={Math.max(...relatedData.localidades.map((l) => l.LOC_ID), 0)}
                    isGuestMode={isGuestMode}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="CLI_IDPRV">Provincia</Label>
                <div className="flex gap-2">
                  <Popover open={openProvincia} onOpenChange={setOpenProvincia}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openProvincia}
                        className="w-full justify-between"
                      >
                        {formData.CLI_IDPRV
                          ? relatedData.provincias.find((provincia) => provincia.PRV_ID === formData.CLI_IDPRV)?.PRV_DENO
                          : "Seleccionar provincia..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Buscar provincia..." />
                        <CommandEmpty>No se encontraron provincias.</CommandEmpty>
                        <CommandGroup>
                          {relatedData.provincias.map((provincia) => (
                            <CommandItem
                              key={provincia.PRV_ID}
                              value={provincia.PRV_DENO}
                              onSelect={() => {
                                handleSelectChange("CLI_IDPRV", provincia.PRV_ID.toString())
                                setOpenProvincia(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.CLI_IDPRV === provincia.PRV_ID ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {provincia.PRV_DENO}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <RelatedEntityForm
                    entityType="provincia"
                    entityName="Provincia"
                    onEntityAdded={(newEntity) => handleEntityAdded("provincia", newEntity)}
                    lastId={Math.max(...relatedData.provincias.map((p) => p.PRV_ID), 0)}
                    isGuestMode={isGuestMode}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="CLI_IVA">Condición IVA</Label>
                <div className="flex">
                  <Select
                    name="CLI_IVA"
                    value={formData.CLI_IVA?.toString() || ""}
                    onValueChange={(value) => handleSelectChange("CLI_IVA", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione condición IVA" />
                    </SelectTrigger>
                    <SelectContent>
                      {relatedData.tiposIVA.map((tipo) => (
                        <SelectItem key={tipo.TIV_ID} value={tipo.TIV_ID.toString()}>
                          {tipo.TIV_DENO}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="ml-auto" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Cliente
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
