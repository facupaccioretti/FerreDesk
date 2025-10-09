"use client"

import { useState, useEffect } from "react"
import Navbar from "../Navbar"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import CuentaCorrienteList from "./CuentaCorrienteList"

const CuentaCorrienteManager = () => {
  const theme = useFerreDeskTheme()
  
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [fechaDesde, setFechaDesde] = useState(() => {
    // Default: 30 días atrás
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - 30)
    return fecha.toISOString().split('T')[0]
  })
  const [fechaHasta, setFechaHasta] = useState(() => {
    // Default: hoy
    return new Date().toISOString().split('T')[0]
  })
  const [completo, setCompleto] = useState(false)

  useEffect(() => {
    document.title = "Cuentas Corrientes - FerreDesk"
  }, [])

  return (
    <div className={theme.fondo}>
      <div className={theme.patron}></div>
      <div className={theme.overlay}></div>
      
      <div className="relative z-10">
        <Navbar />
        
        {/* Contenedor central con ancho máximo fijo al estilo de PresupuestosManager */}
        <div className="py-8 px-4">
          <div className="max-w-[1400px] w-full mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Cuentas Corrientes</h2>
            </div>

            {/* Área principal: contenido */}
            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200 max-w-full">
              <div className="flex-1 p-6">
                <CuentaCorrienteList
                  clienteSeleccionado={clienteSeleccionado}
                  fechaDesde={fechaDesde}
                  fechaHasta={fechaHasta}
                  completo={completo}
                  onClienteChange={setClienteSeleccionado}
                  onFechaDesdeChange={setFechaDesde}
                  onFechaHastaChange={setFechaHasta}
                  onCompletoChange={setCompleto}
                  theme={theme}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CuentaCorrienteManager
