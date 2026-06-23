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

const NAVY = "#1e2d3d"
const ORANGE = "#e8641a"

const ESTADOS = [
    { value: "", label: "Todos" },
    { value: "EN_CARTERA", label: "En Cartera" },
    { value: "DEPOSITADO", label: "Depositado" },
    { value: "ACREDITADO", label: "Acreditado" },
    { value: "ENTREGADO", label: "Entregado (Endosado)" },
    { value: "RECHAZADO", label: "Rechazado" },
]

const ESTADOS_PUEDEN_MARCAR_RECHAZADO = ["EN_CARTERA", "DEPOSITADO", "ENTREGADO"]

// Mapa de estilos por estado — solo navy, naranja y slate. Los charts/indicadores
// de estado de cheque son la excepción admitida para color extra.
const ESTADO_META = {
    EN_CARTERA:  { label: "En Cartera",  cls: "bg-[#1e2d3d] text-white" },
    DEPOSITADO:  { label: "Depositado",  cls: "border border-[#e8641a] text-[#e8641a]" },
    ENTREGADO:   { label: "Endosado",    cls: "border border-slate-400 text-slate-600" },
    RECHAZADO:   { label: "Rechazado",   cls: "bg-slate-700 text-white" },
    ACREDITADO:  { label: "Acreditado",  cls: "bg-[#e8641a] text-white" },
}

const HistorialCheques = ({ filtroEstadoInicial = "" }) => {
    const { obtenerCheques, marcarChequeRechazado, reactivarCheque, acreditarCheque, obtenerCuentasBanco } = useCajaAPI()
    const [cheques, setCheques] = useState([])
    const [cargando, setCargando] = useState(true)
    const [filtroEstado, setFiltroEstado] = useState(filtroEstadoInicial || "")
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

    useEffect(() => { cargar() }, [cargar])
    useEffect(() => { setFiltroEstado(filtroEstadoInicial || "") }, [filtroEstadoInicial])

    const renderEstado = (estado) => {
        const meta = ESTADO_META[estado] ?? { label: estado, cls: "border border-slate-300 text-slate-500" }
        return (
            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-sm ${meta.cls}`}>
                {meta.label}
            </span>
        )
    }

    const renderDestino = (c) => {
        if ((c.estado === "DEPOSITADO" || c.estado === "ACREDITADO") && c.cuenta_banco_deposito_nombre) {
            return (
                <div className="flex flex-col leading-tight">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                        {c.estado === "ACREDITADO" ? "Acreditado en" : "Cuenta propia"}
                    </span>
                    <span className="text-xs text-[#1e2d3d] font-medium truncate max-w-[110px]">
                        {c.cuenta_banco_deposito_nombre}
                    </span>
                </div>
            )
        }
        if (c.estado === "ENTREGADO" && c.proveedor_nombre) {
            return (
                <div className="flex flex-col leading-tight">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Proveedor</span>
                    <span className="text-xs text-[#1e2d3d] font-medium truncate max-w-[110px]">
                        {c.proveedor_nombre}
                    </span>
                </div>
            )
        }
        return <span className="text-slate-300">—</span>
    }

    const abrirModalMarcarRechazado = (cheque) => setModalAccion({ cheque, modo: "rechazar" })
    const abrirModalReactivar = (cheque) => setModalAccion({ cheque, modo: "reactivar" })

    const confirmarAccion = () => {
        const { cheque, modo } = modalAccion
        if (!cheque) return
        setProcesandoId(cheque.id)
        const apiCall = modo === "rechazar" ? marcarChequeRechazado(cheque.id) : reactivarCheque(cheque.id)
        apiCall
            .then(() => { setModalAccion({ cheque: null, modo: "rechazar" }); return cargar() })
            .catch((err) => { console.error(`Error en acción ${modo}:`, err); alert(err.message || `Error al ${modo} cheque`) })
            .finally(() => setProcesandoId(null))
    }

    const abrirDetalle = (cheque) => setModalDetalle(cheque)
    const cerrarDetalle = () => setModalDetalle(null)
    const abrirEditar = (cheque) => setModalEditar(cheque)
    const cerrarEditar = () => setModalEditar(null)
    const confirmarEditar = async () => { setModalEditar(null); await cargar() }

    const abrirModalAcreditar = async (cheque) => {
        try {
            const res = await obtenerCuentasBanco(true)
            setCuentasBanco(res?.results ?? (Array.isArray(res) ? res : []))
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

    const generarBotonesCheque = (cheque) => {
        const botones = []
        const estaProcesando = procesandoId === cheque.id

        botones.push({ componente: BotonVerDetalle, onClick: () => abrirDetalle(cheque), titulo: "Ver detalle", disabled: false })
        if (cheque.estado === "EN_CARTERA") {
            botones.push({ componente: BotonEditar, onClick: () => abrirEditar(cheque), titulo: "Editar", disabled: false })
        }
        if (ESTADOS_PUEDEN_MARCAR_RECHAZADO.includes(cheque.estado)) {
            botones.push({ componente: BotonMarcarRechazado, onClick: () => abrirModalMarcarRechazado(cheque), titulo: "Marcar rechazado", disabled: estaProcesando })
        }
        if (cheque.estado === "DEPOSITADO") {
            botones.push({ componente: BotonAcreditar, onClick: () => abrirModalAcreditar(cheque), titulo: "Acreditar (fondos ingresados)", disabled: estaProcesando })
        }
        return botones
    }

    const columnas = [
        {
            id: "numero",
            titulo: "N°",
            render: (c) => <span className="text-xs font-semibold text-[#1e2d3d]">{c.numero}</span>,
        },
        {
            id: "tipo",
            titulo: "TIPO",
            render: (c) => (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-bold uppercase ${
                    c.tipo_cheque === "DIFERIDO"
                        ? "border border-[#e8641a] text-[#e8641a]"
                        : "bg-[#1e2d3d] text-white"
                }`}>
                    {c.tipo_cheque === "DIFERIDO" ? "Dif" : "Día"}
                </span>
            ),
        },
        {
            id: "librador_nombre",
            titulo: "LIBRADOR",
            render: (c) => (
                <div className="flex flex-col leading-tight">
                    <span className="text-xs text-[#1e2d3d] font-medium truncate max-w-[120px]" title={c.librador_nombre}>
                        {c.librador_nombre}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{c.cuit_librador}</span>
                </div>
            ),
        },
        {
            id: "banco_emisor",
            titulo: "BANCO",
            render: (c) => <span className="text-xs text-slate-600 truncate max-w-[90px]" title={c.banco_emisor}>{c.banco_emisor}</span>,
        },
        {
            id: "monto",
            titulo: "MONTO",
            align: "right",
            render: (c) => <span className="text-xs font-semibold tabular-nums text-[#1e2d3d]">${formatearMoneda(c.monto)}</span>,
        },
        {
            id: "cliente_origen",
            titulo: "ORIGEN",
            render: (c) => <span className="text-xs text-slate-600">{c.cliente_origen || "—"}</span>,
        },
        {
            id: "estado",
            titulo: "ESTADO",
            render: (c) => renderEstado(c.estado),
        },
        {
            id: "destino",
            titulo: "DESTINO",
            render: (c) => renderDestino(c),
        },
        {
            id: "fecha_pago",
            titulo: "F. PAGO",
            render: (c) => <span className="text-xs tabular-nums text-slate-600">{formatearFecha(c.fecha_pago)}</span>,
        },
        {
            id: "acciones",
            titulo: "ACCIONES",
            render: (c) => {
                const estaProcesando = procesandoId === c.id
                const botones = generarBotonesCheque(c)
                if (c.estado === "RECHAZADO") {
                    botones.push({ componente: BotonReactivar, onClick: () => abrirModalReactivar(c), titulo: "Reactivar", disabled: estaProcesando })
                }
                return <AccionesMenu botones={botones} />
            },
        },
    ]

    return (
        <div className="space-y-3">
            {/* Filtros */}
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <label htmlFor="filtro-estado" className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        Estado
                    </label>
                    <select
                        id="filtro-estado"
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-[#1e2d3d] outline-none focus:border-[#e8641a] focus:ring-1 focus:ring-[#e8641a]"
                        value={filtroEstado}
                        onChange={(e) => setFiltroEstado(e.target.value)}
                    >
                        {ESTADOS.map((e) => (
                            <option key={e.value} value={e.value}>{e.label}</option>
                        ))}
                    </select>
                </div>
                <button
                    type="button"
                    onClick={cargar}
                    disabled={cargando}
                    className="ml-auto inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: NAVY }}
                >
                    {cargando ? "Cargando..." : "Actualizar"}
                </button>
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

            {modalDetalle && (
                <ModalDetalleCheque cheque={modalDetalle} onCerrar={cerrarDetalle} />
            )}

            {modalEditar && (
                <ModalEditarCheque
                    cheque={modalEditar}
                    onGuardar={confirmarEditar}
                    onCancelar={cerrarEditar}
                />
            )}

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
