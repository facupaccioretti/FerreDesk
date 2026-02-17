"use client"

import { useEffect, useCallback, useState } from "react"
import { useCajaAPI } from "../../utils/useCajaAPI"
import { formatearFecha, formatearMoneda } from "../../utils/formatters"
import Tabla from "../Tabla"
import ModalMarcarChequeRechazado from "./ModalMarcarChequeRechazado"
import ModalDetalleCheque from "./ModalDetalleCheque"
import ModalEditarCheque from "./ModalEditarCheque"
import ModalDepositarCheque from "./ModalDepositarCheque"
import AccionesMenu from "../Presupuestos y Ventas/herramientasforms/AccionesMenu"
import { BotonVerDetalle, BotonEditar, BotonMarcarRechazado, BotonReactivar, BotonAcreditar } from "../Botones"

const ESTADOS = [
    { value: "", label: "Todos" },
    { value: "EN_CARTERA", label: "En Cartera" },
    { value: "DEPOSITADO", label: "Depositado" },
    { value: "ACREDITADO", label: "Acreditado" },
    { value: "ENTREGADO", label: "Entregado (Endosado)" },
    { value: "RECHAZADO", label: "Rechazado" },
]

/**
 * Historial completo de cheques con trazabilidad.
 * Permite filtrar por estado y buscar por datos clave.
 */
const ESTADOS_PUEDEN_MARCAR_RECHAZADO = ["EN_CARTERA", "DEPOSITADO", "ENTREGADO"]

const HistorialCheques = () => {
    const { obtenerCheques, marcarChequeRechazado, reactivarCheque, acreditarCheque, obtenerCuentasBanco } = useCajaAPI()
    const [cheques, setCheques] = useState([])
    const [cargando, setCargando] = useState(true)
    const [filtroEstado, setFiltroEstado] = useState("")
    const [busqueda, setBusqueda] = useState("")
    const [procesandoId, setProcesandoId] = useState(null)
    const [modalAccion, setModalAccion] = useState({ cheque: null, modo: "rechazar" })
    const [modalDetalle, setModalDetalle] = useState(null)
    const [modalEditar, setModalEditar] = useState(null)
    const [modalAcreditar, setModalAcreditar] = useState(null)
    const [cuentasBanco, setCuentasBanco] = useState([])

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

    // Se usan formateadores centralizados de ../../utils/formatters

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
            case "ACREDITADO":
                color = "bg-teal-100 text-teal-700"
                texto = "Acreditado"
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
        if (c.estado === "ACREDITADO" && c.cuenta_banco_deposito_nombre) {
            return (
                <div className="flex flex-col">
                    <span className="text-xs text-teal-600">Acreditado en</span>
                    <span className="text-sm text-slate-700 font-medium">
                        {c.cuenta_banco_deposito_nombre}
                    </span>
                </div>
            )
        }
        return <span className="text-slate-400">-</span>
    }

    const abrirModalMarcarRechazado = (cheque) => {
        setModalAccion({ cheque, modo: "rechazar" })
    }

    const abrirModalReactivar = (cheque) => {
        setModalAccion({ cheque, modo: "reactivar" })
    }

    const confirmarAccion = () => {
        const { cheque, modo } = modalAccion
        if (!cheque) return

        setProcesandoId(cheque.id)

        const apiCall = modo === "rechazar"
            ? marcarChequeRechazado(cheque.id)
            : reactivarCheque(cheque.id)

        apiCall
            .then(() => {
                setModalAccion({ cheque: null, modo: "rechazar" })
                return cargar()
            })
            .catch((err) => {
                console.error(`Error en acción ${modo}:`, err)
                alert(err.message || `Error al ${modo} cheque`)
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

    // Acreditar: abrir modal de selección de banco
    const abrirModalAcreditar = async (cheque) => {
        try {
            const res = await obtenerCuentasBanco(true)
            const lista = res?.results ?? (Array.isArray(res) ? res : [])
            setCuentasBanco(lista)
        } catch (err) {
            console.error("Error cargando cuentas banco:", err)
            setCuentasBanco([])
        }
        setModalAcreditar(cheque)
    }

    const confirmarAcreditar = async (cuentaBancoId) => {
        if (!modalAcreditar) return
        setProcesandoId(modalAcreditar.id)
        try {
            await acreditarCheque(modalAcreditar.id, cuentaBancoId)
            setModalAcreditar(null)
            await cargar()
        } catch (err) {
            console.error("Error al acreditar cheque:", err)
            alert(err.message || "Error al acreditar cheque")
        } finally {
            setProcesandoId(null)
        }
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

        // Acreditar - solo si está DEPOSITADO
        if (cheque.estado === "DEPOSITADO") {
            botones.push({
                componente: BotonAcreditar,
                onClick: () => abrirModalAcreditar(cheque),
                titulo: "Acreditar (fondos ingresados)",
                disabled: estaProcesando,
            })
        }

        return botones
    }

    const columnas = [
        { id: "numero", titulo: "N°", render: (c) => <span className="text-sm font-medium text-slate-800">{c.numero}</span> },
        {
            id: "tipo",
            titulo: "TIPO",
            render: (c) => (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${c.tipo_cheque === "DIFERIDO" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                    }`}>
                    {c.tipo_cheque === "DIFERIDO" ? "Dif" : "Día"}
                </span>
            ),
        },
        { id: "librador_nombre", titulo: "LIBRADOR", render: (c) => <div className="flex flex-col"><span className="text-xs text-slate-700 font-medium truncate max-w-[120px]" title={c.librador_nombre}>{c.librador_nombre}</span><span className="text-[10px] font-mono text-slate-500">{c.cuit_librador}</span></div> },
        { id: "banco_emisor", titulo: "BANCO", render: (c) => <span className="text-sm text-slate-700">{c.banco_emisor}</span> },
        { id: "monto", titulo: "MONTO", align: "right", render: (c) => <span className="text-sm font-semibold text-slate-800">${formatearMoneda(c.monto)}</span> },
        { id: "cliente_origen", titulo: "ORIGEN", render: (c) => <span className="text-xs text-slate-700">{c.cliente_origen || "—"}</span> },
        { id: "estado", titulo: "ESTADO", render: (c) => renderEstado(c.estado) },
        { id: "destino", titulo: "DESTINO", render: (c) => renderDestino(c) },
        { id: "fecha_pago", titulo: "F. PAGO", render: (c) => <span className="text-xs font-medium text-slate-700">{formatearFecha(c.fecha_pago)}</span> },
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
                        onClick: () => abrirModalReactivar(c),
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

            {modalAccion.cheque && (
                <ModalMarcarChequeRechazado
                    cheque={modalAccion.cheque}
                    modo={modalAccion.modo}
                    formatearMoneda={formatearMoneda}
                    onConfirmar={confirmarAccion}
                    onCancelar={() => setModalAccion({ cheque: null, modo: "rechazar" })}
                    loading={procesandoId === modalAccion.cheque?.id}
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

            {/* Modal Acreditar (reutiliza ModalDepositarCheque para selección de banco) */}
            {modalAcreditar && (
                <ModalDepositarCheque
                    cuentasBanco={cuentasBanco}
                    onConfirmar={confirmarAcreditar}
                    onCancelar={() => setModalAcreditar(null)}
                    loading={procesandoId === modalAcreditar?.id}
                    titulo="Acreditar cheque"
                    textoBoton="Acreditar"
                    textoLabel="Cuenta bancaria donde se acreditaron los fondos"
                />
            )}
        </div>
    )
}

export default HistorialCheques
