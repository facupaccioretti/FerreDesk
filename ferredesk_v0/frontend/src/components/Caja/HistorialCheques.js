"use client"

import { useEffect, useCallback, useState } from "react"
import { useCajaAPI } from "../../utils/useCajaAPI"
import Tabla from "../Tabla"
import ModalMarcarChequeRechazado from "./ModalMarcarChequeRechazado"
import ModalDetalleCheque from "./ModalDetalleCheque"
import ModalEditarCheque from "./ModalEditarCheque"
import AccionesMenu from "../Presupuestos y Ventas/herramientasforms/AccionesMenu"
import { BotonVerDetalle, BotonEditar, BotonMarcarRechazado, BotonReactivar } from "../Botones"

const ESTADOS = [
    { value: "", label: "Todos" },
    { value: "EN_CARTERA", label: "En Cartera" },
    { value: "DEPOSITADO", label: "Depositado" },
    { value: "ENTREGADO", label: "Entregado (Endosado)" },
    { value: "RECHAZADO", label: "Rechazado" },
]

/**
 * Historial completo de cheques con trazabilidad.
 * Permite filtrar por estado y buscar por datos clave.
 */
const ESTADOS_PUEDEN_MARCAR_RECHAZADO = ["EN_CARTERA", "DEPOSITADO", "ENTREGADO"]

const HistorialCheques = () => {
    const { obtenerCheques, marcarChequeRechazado, reactivarCheque } = useCajaAPI()
    const [cheques, setCheques] = useState([])
    const [cargando, setCargando] = useState(true)
    const [filtroEstado, setFiltroEstado] = useState("")
    const [busqueda, setBusqueda] = useState("")
    const [procesandoId, setProcesandoId] = useState(null)
    const [modalMarcarRechazadoCheque, setModalMarcarRechazadoCheque] = useState(null)
    const [modalDetalle, setModalDetalle] = useState(null)
    const [modalEditar, setModalEditar] = useState(null)

    const cargar = useCallback(async () => {
        setCargando(true)
        try {
            // Si filtroEstado es "", trae todos
            const res = await obtenerCheques(filtroEstado || null)
            const lista = res?.results ?? (Array.isArray(res) ? res : [])
            setCheques(lista)
        } catch (err) {
            console.error("Error cargando historial de cheques:", err)
            setCheques([])
        } finally {
            setCargando(false)
        }
    }, [obtenerCheques, filtroEstado])

    useEffect(() => {
        cargar()
    }, [cargar])

    const formatearMoneda = (v) => {
        const num = parseFloat(v) || 0
        return num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const renderEstado = (estado) => {
        let color = "bg-slate-100 text-slate-700"
        let texto = estado

        switch (estado) {
            case "EN_CARTERA":
                color = "bg-blue-100 text-blue-700"
                texto = "En Cartera"
                break
            case "DEPOSITADO":
                color = "bg-green-100 text-green-700"
                texto = "Depositado"
                break
            case "ENTREGADO":
                color = "bg-purple-100 text-purple-700"
                texto = "Endosado"
                break
            case "RECHAZADO":
                color = "bg-red-100 text-red-700"
                texto = "Rechazado"
                break
            default:
                break
        }
        return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{texto}</span>
    }

    const renderDestino = (c) => {
        if (c.estado === "DEPOSITADO" && c.cuenta_banco_deposito_nombre) {
            return (
                <div className="flex flex-col">
                    <span className="text-xs text-slate-500">Cuenta Propia</span>
                    <span className="text-sm text-slate-700 font-medium">
                        {c.cuenta_banco_deposito_nombre}
                    </span>
                </div>
            )
        }
        if (c.estado === "ENTREGADO" && c.proveedor_nombre) {
            return (
                <div className="flex flex-col">
                    <span className="text-xs text-slate-500">Proveedor</span>
                    <span className="text-sm text-slate-700 font-medium">
                        {c.proveedor_nombre}
                    </span>
                </div>
            )
        }
        return <span className="text-slate-400">-</span>
    }

    const abrirModalMarcarRechazado = (cheque) => {
        setModalMarcarRechazadoCheque(cheque)
    }

    const confirmarMarcarRechazado = (cargosAdministrativosBanco) => {
        if (!modalMarcarRechazadoCheque) return
        setProcesandoId(modalMarcarRechazadoCheque.id)
        marcarChequeRechazado(modalMarcarRechazadoCheque.id, { cargosAdministrativosBanco })
            .then(() => {
                setModalMarcarRechazadoCheque(null)
                return cargar()
            })
            .catch((err) => {
                console.error("Error marcando cheque rechazado:", err)
                alert(err.message || "Error al marcar cheque rechazado")
            })
            .finally(() => setProcesandoId(null))
    }

    const solicitarReactivar = (cheque) => {
        if (!window.confirm(`¿Reactivar el cheque Nº ${cheque.numero}? Pasará de Rechazado a En Cartera.`)) return
        setProcesandoId(cheque.id)
        reactivarCheque(cheque.id)
            .then(() => cargar())
            .catch((err) => {
                console.error("Error reactivando cheque:", err)
                alert(err.message || "Error al reactivar cheque")
            })
            .finally(() => setProcesandoId(null))
    }

    const abrirDetalle = (cheque) => {
        setModalDetalle(cheque)
    }

    const cerrarDetalle = () => {
        setModalDetalle(null)
    }

    const abrirEditar = (cheque) => {
        setModalEditar(cheque)
    }

    const cerrarEditar = () => {
        setModalEditar(null)
    }

    const confirmarEditar = async (chequeActualizado) => {
        setModalEditar(null)
        await cargar() // Recargar lista después de editar
    }

    // Función para generar botones del menú de acciones para cada cheque
    const generarBotonesCheque = (cheque) => {
        const botones = []
        const estaProcesando = procesandoId === cheque.id

        // Ver detalle - siempre disponible
        botones.push({
            componente: BotonVerDetalle,
            onClick: () => abrirDetalle(cheque),
            titulo: "Ver detalle",
            disabled: false,
        })

        // Editar - solo si está EN_CARTERA
        if (cheque.estado === "EN_CARTERA") {
            botones.push({
                componente: BotonEditar,
                onClick: () => abrirEditar(cheque),
                titulo: "Editar",
                disabled: false,
            })
        }

        // Marcar rechazado - solo si puede marcarse como rechazado
        if (ESTADOS_PUEDEN_MARCAR_RECHAZADO.includes(cheque.estado)) {
            botones.push({
                componente: BotonMarcarRechazado,
                onClick: () => abrirModalMarcarRechazado(cheque),
                titulo: "Marcar rechazado",
                disabled: estaProcesando,
            })
        }

        return botones
    }

    const columnas = [
        { id: "numero", titulo: "N°", render: (c) => <span className="text-sm font-medium text-slate-800">{c.numero}</span> },
        { id: "banco_emisor", titulo: "BANCO", render: (c) => <span className="text-sm text-slate-700">{c.banco_emisor}</span> },
        { id: "monto", titulo: "MONTO", align: "right", render: (c) => <span className="text-sm font-semibold text-slate-800">${formatearMoneda(c.monto)}</span> },
        { id: "librador", titulo: "LIBRADOR", render: (c) => <span className="text-xs font-mono text-slate-600">{c.cuit_librador}</span> },
        { id: "cliente_origen", titulo: "CLIENTE ORIGEN", render: (c) => <span className="text-xs text-slate-700">{c.cliente_origen || "—"}</span> },
        { id: "estado", titulo: "ESTADO", render: (c) => renderEstado(c.estado) },
        { id: "destino", titulo: "DESTINO / UBICACIÓN", render: (c) => renderDestino(c) },
        { id: "nota_debito", titulo: "N.D.", render: (c) => <span className="text-xs text-slate-600">{c.nota_debito_numero_formateado || "—"}</span> },
        { id: "fecha_presentacion", titulo: "PRESENT.", render: (c) => <span className="text-xs text-slate-500">{c.fecha_presentacion}</span> },
        {
            id: "acciones",
            titulo: "ACCIONES",
            render: (c) => {
                const estaProcesando = procesandoId === c.id
                const botones = generarBotonesCheque(c)
                
                // Agregar botón de reactivar si está rechazado
                if (c.estado === "RECHAZADO") {
                    botones.push({
                        componente: BotonReactivar,
                        onClick: () => solicitarReactivar(c),
                        titulo: "Reactivar",
                        disabled: estaProcesando,
                    })
                }
                
                return <AccionesMenu botones={botones} />
            },
        },
    ]

    return (
        <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                    <label htmlFor="filtro-estado" className="text-sm font-medium text-slate-700">Estado:</label>
                    <select
                        id="filtro-estado"
                        className="text-sm border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        value={filtroEstado}
                        onChange={(e) => setFiltroEstado(e.target.value)}
                    >
                        {ESTADOS.map((e) => (
                            <option key={e.value} value={e.value}>{e.label}</option>
                        ))}
                    </select>
                </div>

                {/* El buscador de Tabla.js se encarga del filtro por texto en cliente, pero aquí podríamos agregar filtros de fecha si backend lo soportara */}
            </div>

            <Tabla
                columnas={columnas}
                datos={cheques}
                valorBusqueda={busqueda}
                onCambioBusqueda={setBusqueda}
                mostrarBuscador={true}
                mostrarOrdenamiento={true}
                filasPorPaginaInicial={20}
                paginadorVisible={true}
                cargando={cargando}
                sinEstilos={false}
                filasCompactas={true}
                tamañoEncabezado="pequeño"
            />

            {modalMarcarRechazadoCheque && (
                <ModalMarcarChequeRechazado
                    cheque={modalMarcarRechazadoCheque}
                    formatearMoneda={formatearMoneda}
                    onConfirmar={confirmarMarcarRechazado}
                    onCancelar={() => setModalMarcarRechazadoCheque(null)}
                    loading={procesandoId === modalMarcarRechazadoCheque?.id}
                />
            )}

            {/* Modal Detalle */}
            {modalDetalle && (
                <ModalDetalleCheque cheque={modalDetalle} onCerrar={cerrarDetalle} />
            )}

            {/* Modal Editar */}
            {modalEditar && (
                <ModalEditarCheque
                    cheque={modalEditar}
                    onGuardar={confirmarEditar}
                    onCancelar={cerrarEditar}
                />
            )}
        </div>
    )
}

export default HistorialCheques
