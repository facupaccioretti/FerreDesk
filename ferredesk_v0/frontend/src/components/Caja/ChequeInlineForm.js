"use client"

import React, { useState, useEffect, useCallback } from "react"

const TIPO_CHEQUE_AL_DIA = "AL_DIA"
const TIPO_CHEQUE_DIFERIDO = "DIFERIDO"

/**
 * Formatea un CUIT para mostrarlo como XX-XXXXXXXX-X.
 */
const formatearCUIT = (cuit) => {
    if (!cuit) return ""
    const limpio = cuit.replace(/\D/g, "")
    if (limpio.length <= 2) return limpio
    if (limpio.length <= 10) return `${limpio.slice(0, 2)}-${limpio.slice(2)}`
    return `${limpio.slice(0, 2)}-${limpio.slice(2, 10)}-${limpio.slice(10, 11)}`
}

const limpiarCUIT = (cuit) => (cuit || "").replace(/\D/g, "")

/**
 * ChequeInlineForm — Formulario de cheque reutilizable para insertar inline.
 *
 * @param {'NUEVO'|'CARTERA'} modo - NUEVO = crear cheque (Recibo/Venta), CARTERA = seleccionar existente (Orden de Pago)
 * @param {object} chequeData - Objeto con los campos del cheque
 * @param {function} onChange - (campo, valor) => void
 * @param {Array} chequesCartera - Lista de cheques en cartera (solo modo CARTERA)
 * @param {string} entidadNombre - Nombre de la entidad para pre-cargar librador
 * @param {string} cuitEntidad - CUIT de la entidad para pre-cargar
 * @param {string} proveedorNombre - Nombre del proveedor (para el aviso de endoso en OP)
 * @param {function} validarCUITFn - Función async para validar CUIT contra backend
 */
const ChequeInlineForm = ({
    modo = "NUEVO",
    chequeData = {},
    onChange,
    chequesCartera = [],
    entidadNombre = "",
    cuitEntidad = "",
    proveedorNombre = "",
    validarCUITFn = null,
}) => {
    const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500 mb-1"
    const CLASES_INPUT = "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
    const CLASES_INPUT_ERROR = CLASES_INPUT + " border-red-300 focus:border-red-500 focus:ring-red-500"

    const [erroresLocales, setErroresLocales] = useState({})
    const [validandoCUIT, setValidandoCUIT] = useState(false)
    const [cuitValido, setCuitValido] = useState(null)

    // Resetear validación de CUIT cuando cambia
    useEffect(() => {
        setCuitValido(null)
    }, [chequeData.cuit_librador])

    // Sincronizar fecha_pago con fecha_emision cuando es AL_DIA
    useEffect(() => {
        if (modo === "NUEVO" && chequeData.tipo_cheque === TIPO_CHEQUE_AL_DIA && chequeData.fecha_emision) {
            if (chequeData.fecha_pago !== chequeData.fecha_emision) {
                onChange("fecha_pago", chequeData.fecha_emision)
            }
        }
    }, [chequeData.tipo_cheque, chequeData.fecha_emision, chequeData.fecha_pago, modo, onChange])

    const handleChange = useCallback((campo, valor) => {
        // Limpiar error del campo al editar
        setErroresLocales(prev => {
            if (!prev[campo]) return prev
            const nuevo = { ...prev }
            delete nuevo[campo]
            return nuevo
        })
        onChange(campo, valor)
    }, [onChange])

    const handleCUITBlur = useCallback(async () => {
        const cuitLimpio = limpiarCUIT(chequeData.cuit_librador)
        if (!cuitLimpio || cuitLimpio.length !== 11) {
            if (cuitLimpio && cuitLimpio.length > 0) {
                setErroresLocales(prev => ({ ...prev, cuit_librador: "El CUIT debe tener 11 dígitos" }))
                setCuitValido(false)
            }
            return
        }
        if (!validarCUITFn) {
            // Sin función de validación, aceptar con formato
            onChange("cuit_librador", formatearCUIT(cuitLimpio))
            setCuitValido(true)
            return
        }
        setValidandoCUIT(true)
        try {
            const resultado = await validarCUITFn(cuitLimpio)
            if (resultado.es_valido) {
                setCuitValido(true)
                onChange("cuit_librador", formatearCUIT(cuitLimpio))
                setErroresLocales(prev => {
                    const nuevo = { ...prev }
                    delete nuevo.cuit_librador
                    return nuevo
                })
            } else {
                setCuitValido(false)
                setErroresLocales(prev => ({
                    ...prev,
                    cuit_librador: resultado.mensaje_error || "CUIT inválido",
                }))
            }
        } catch (err) {
            setCuitValido(false)
            setErroresLocales(prev => ({
                ...prev,
                cuit_librador: err.message || "Error al validar CUIT",
            }))
        } finally {
            setValidandoCUIT(false)
        }
    }, [chequeData.cuit_librador, validarCUITFn, onChange])

    // ─── MODO CARTERA (Orden de Pago) ────────────────────────────────
    if (modo === "CARTERA") {
        return (
            <div className="space-y-3">
                <div>
                    <label className={CLASES_ETIQUETA}>Seleccionar cheque de cartera</label>
                    <select
                        className={CLASES_INPUT}
                        value={chequeData.cheque_id || ""}
                        onChange={(e) => onChange("cheque_id", e.target.value)}
                    >
                        <option value="">Seleccione un cheque...</option>
                        {chequesCartera.map(c => (
                            <option key={c.id} value={c.id}>
                                #{c.numero} - ${parseFloat(c.monto).toLocaleString("es-AR")} - {c.banco_emisor} ({c.librador_nombre || "S/D"})
                            </option>
                        ))}
                    </select>
                </div>

                {chequeData.cheque_id && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-start gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <p className="text-xs font-semibold text-blue-800">
                                Endoso automático
                            </p>
                            <p className="text-xs text-blue-700 mt-0.5">
                                Al confirmar la orden de pago, este cheque será <strong>endosado automáticamente</strong>
                                {proveedorNombre ? ` a ${proveedorNombre}` : ""} y saldrá de cartera.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ─── MODO NUEVO (Recibo / Venta) ─────────────────────────────────
    const esDiferido = chequeData.tipo_cheque === TIPO_CHEQUE_DIFERIDO
    const esAlDia = chequeData.tipo_cheque === TIPO_CHEQUE_AL_DIA || !chequeData.tipo_cheque

    return (
        <div className="space-y-3">
            {/* Fila 1: Número + Banco Emisor */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                    <label className={CLASES_ETIQUETA}>N° Cheque *</label>
                    <input
                        type="text"
                        className={erroresLocales.numero ? CLASES_INPUT_ERROR : CLASES_INPUT}
                        value={chequeData.numero_cheque || ""}
                        onChange={(e) => handleChange("numero_cheque", e.target.value)}
                        placeholder="Ej: 00012345"
                    />
                    {erroresLocales.numero && <p className="text-xs text-red-600 mt-0.5">{erroresLocales.numero}</p>}
                </div>
                <div className="md:col-span-2">
                    <label className={CLASES_ETIQUETA}>Banco Emisor *</label>
                    <input
                        type="text"
                        className={erroresLocales.banco_emisor ? CLASES_INPUT_ERROR : CLASES_INPUT}
                        value={chequeData.banco_emisor || ""}
                        onChange={(e) => handleChange("banco_emisor", e.target.value)}
                        placeholder="Ej: Banco Nación"
                    />
                    {erroresLocales.banco_emisor && <p className="text-xs text-red-600 mt-0.5">{erroresLocales.banco_emisor}</p>}
                </div>
            </div>

            {/* Fila 2: Librador + CUIT */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className={CLASES_ETIQUETA}>Librador / Razón Social *</label>
                    <input
                        type="text"
                        className={CLASES_INPUT}
                        value={chequeData.librador_nombre || ""}
                        onChange={(e) => handleChange("librador_nombre", e.target.value)}
                        placeholder="Ej: Juan Pérez o Empresa S.A."
                    />
                </div>
                <div>
                    <label className={CLASES_ETIQUETA}>
                        CUIT Librador * {validandoCUIT && "(validando…)"}
                        {cuitValido === true && <span className="text-green-600"> ✓</span>}
                    </label>
                    <input
                        type="text"
                        className={erroresLocales.cuit_librador ? CLASES_INPUT_ERROR : CLASES_INPUT}
                        value={chequeData.cuit_librador || ""}
                        onChange={(e) => {
                            const soloDigitos = e.target.value.replace(/\D/g, "").slice(0, 11)
                            handleChange("cuit_librador", soloDigitos)
                        }}
                        onBlur={handleCUITBlur}
                        placeholder="20-12345678-9"
                    />
                    {erroresLocales.cuit_librador && (
                        <p className="text-xs text-red-600 mt-0.5">{erroresLocales.cuit_librador}</p>
                    )}
                </div>
            </div>

            {/* Fila 3: Tipo cheque toggle */}
            <div>
                <label className={CLASES_ETIQUETA}>Tipo *</label>
                <div className="flex bg-slate-100 rounded p-1 gap-1 h-9">
                    <button
                        type="button"
                        onClick={() => handleChange("tipo_cheque", TIPO_CHEQUE_AL_DIA)}
                        className={`flex-1 text-[10px] font-bold rounded transition-all uppercase ${esAlDia
                            ? "bg-white text-orange-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        Al día
                    </button>
                    <button
                        type="button"
                        onClick={() => handleChange("tipo_cheque", TIPO_CHEQUE_DIFERIDO)}
                        className={`flex-1 text-[10px] font-bold rounded transition-all uppercase ${esDiferido
                            ? "bg-white text-orange-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        Diferido
                    </button>
                </div>
            </div>

            {/* Fila 4: Fechas */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={CLASES_ETIQUETA}>Fecha Emisión *</label>
                    <input
                        type="date"
                        className={erroresLocales.fecha_emision ? CLASES_INPUT_ERROR : CLASES_INPUT}
                        value={chequeData.fecha_emision || ""}
                        onChange={(e) => handleChange("fecha_emision", e.target.value)}
                    />
                    {erroresLocales.fecha_emision && (
                        <p className="text-xs text-red-600 mt-0.5">{erroresLocales.fecha_emision}</p>
                    )}
                </div>
                <div>
                    <label className={CLASES_ETIQUETA}>Fecha de Pago *</label>
                    <input
                        type="date"
                        className={`${erroresLocales.fecha_pago ? CLASES_INPUT_ERROR : CLASES_INPUT} ${esAlDia ? "bg-slate-50 cursor-not-allowed text-slate-500 font-medium" : ""
                            }`}
                        value={chequeData.fecha_pago || chequeData.fecha_presentacion || ""}
                        readOnly={esAlDia}
                        onChange={(e) => {
                            handleChange("fecha_pago", e.target.value)
                            // Mantener compatibilidad con campo fecha_presentacion
                            handleChange("fecha_presentacion", e.target.value)
                        }}
                    />
                    {esAlDia && (
                        <p className="text-[9px] text-slate-400 mt-0.5">
                            Igual a fecha de emisión (cheque al día)
                        </p>
                    )}
                    {esDiferido && (
                        <p className="text-[9px] text-slate-400 mt-0.5">
                            Fecha desde la cual se puede cobrar/depositar
                        </p>
                    )}
                    {erroresLocales.fecha_pago && (
                        <p className="text-xs text-red-600 mt-0.5">{erroresLocales.fecha_pago}</p>
                    )}
                </div>
            </div>

            {/* Info cheque diferido */}
            {esDiferido && chequeData.fecha_emision && chequeData.fecha_pago && (
                (() => {
                    const fe = new Date(chequeData.fecha_emision)
                    const fp = new Date(chequeData.fecha_pago)
                    const diffDays = Math.ceil(Math.abs(fp - fe) / (1000 * 60 * 60 * 24))
                    if (diffDays > 360) {
                        return (
                            <div className="bg-red-50 border border-red-200 rounded p-2">
                                <p className="text-xs text-red-700">
                                    ⚠ La fecha de pago excede los 360 días desde la emisión ({diffDays} días).
                                </p>
                            </div>
                        )
                    }
                    if (diffDays > 0) {
                        return (
                            <div className="bg-blue-50 border border-blue-200 rounded p-2">
                                <p className="text-xs text-blue-700">
                                    Cheque diferido — cobrable en {diffDays} día{diffDays !== 1 ? "s" : ""}
                                </p>
                            </div>
                        )
                    }
                    return null
                })()
            )}

            {/* Info: se registra en cartera */}
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0Zm-6-3.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7.5 7a.5.5 0 0 0 0 1h.5v2.5a.5.5 0 0 0 1 0V8a1 1 0 0 0-1-1h-.5Z" clipRule="evenodd" />
                </svg>
                Se registrará automáticamente en Valores en Cartera.
            </div>
        </div>
    )
}

export default ChequeInlineForm
