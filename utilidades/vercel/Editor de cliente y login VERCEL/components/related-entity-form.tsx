"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Plus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface RelatedEntityFormProps {
  entityType: string
  entityName: string
  onEntityAdded: (newEntity: { id: number; name: string }) => void
  lastId: number
  isGuestMode: boolean
}

// Solo permitir agregar barrios, localidades y provincias
const allowedEntities = ["barrio", "localidad", "provincia"];

export default function RelatedEntityForm({
  entityType,
  entityName,
  onEntityAdded,
  lastId,
  isGuestMode,
}: RelatedEntityFormProps) {
  if (!allowedEntities.includes(entityType)) return null;

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)

    try {
      // Create new entity
      const newEntity = {
        id: lastId + 1,
        name: name,
      }

      // Simulate a server delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Call the callback to add the entity
      onEntityAdded(newEntity)

      // Reset form and close dialog
      setName("")
      setOpen(false)
    } catch (error) {
      console.error(`Error adding ${entityType}:`, error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">
          <Plus className="h-4 w-4 mr-1" />
          Agregar {entityName}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar {entityName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Ingrese el nombre del ${entityName.toLowerCase()}`}
                required
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 