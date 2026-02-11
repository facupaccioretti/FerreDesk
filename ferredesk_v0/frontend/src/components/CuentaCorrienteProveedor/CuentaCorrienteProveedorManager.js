"use client"

import { useState, useEffect } from "react"
import Navbar from "../Navbar"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import CuentaCorrienteProveedorList from "./CuentaCorrienteProveedorList"

const CuentaCorrienteProveedorManager = () => {
    const theme = useFerreDeskTheme()

    const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null)

    useEffect(() => {
        document.title = "Cuenta Corriente Proveedores - FerreDesk"
    }, [])

    return (
        <div className={theme.fondo}>
            <div className={theme.patron}></div>
            <div className={theme.overlay}></div>

            <div className="relative z-10">
                <Navbar />

                <div className="py-8 px-4">
                    <div className="max-w-[1400px] w-full mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-800">Cuenta Corriente Proveedores</h2>
                        </div>

                        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200 max-w-full">
                            <div className="flex-1 p-6">
                                <CuentaCorrienteProveedorList
                                    proveedorSeleccionado={proveedorSeleccionado}
                                    onProveedorChange={setProveedorSeleccionado}
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

export default CuentaCorrienteProveedorManager
