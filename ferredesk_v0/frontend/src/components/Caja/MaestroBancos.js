"use client"

import { useState, useEffect, useCallback } from "react"
import { useCajaAPI } from "../../utils/useCajaAPI"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { getCookie } from "../../utils/csrf"
import { BotonEditar, BotonDesactivar } from "../Botones"
import AccionesMenu from "../Presupuestos y Ventas/herramientasforms/AccionesMenu"
import Tabla from "../Tabla"

const LONGITUD_CLAVE_BANCARIA = 22
const TIPO_ENTIDAD_BANCO = "BCO"
const TIPO_ENTIDAD_BILLETERA = "VIRT"
const TIPO_CUENTA_VIRTUAL = "CV"

/**
 * Sugiere tipo de entidad según el 7.º dígito de la clave (CBU=0 → Banco, CVU=1 → Billetera).
 * @param {string} clave - Clave de 22 dígitos
 * @returns {string|null} 'BCO' | 'VIRT' | null
 */
function sugerirTipoEntidad(clave) {
  const soloDigitos = (clave || "").replace(/\D/g, "")
  if (soloDigitos.length !== LONGITUD_CLAVE_BANCARIA) return null
  const septimo = soloDigitos.charAt(6)
  return septimo === "0" ? TIPO_ENTIDAD_BANCO : septimo === "1" ? TIPO_ENTIDAD_BILLETERA : null
}

/**
 * Modal para crear o editar una cuenta bancaria.
 */
const ModalCuentaBanco = ({
  cuenta,
  onGuardar,
  onCancelar,
  loading,
}) => {
  const theme = useFerreDeskTheme()
  const [nombre, setNombre] = useState(cuenta?.nombre ?? "")
  const [alias, setAlias] = useState(cuenta?.alias ?? "")
  const [claveBancaria, setClaveBancaria] = useState(cuenta?.clave_bancaria ?? "")
  const [tipoEntidad, setTipoEntidad] = useState(cuenta?.tipo_entidad ?? TIPO_ENTIDAD_BANCO)
  const [tipoCuenta, setTipoCuenta] = useState(
    cuenta?.tipo_entidad === TIPO_ENTIDAD_BILLETERA ? TIPO_CUENTA_VIRTUAL : (cuenta?.tipo_cuenta ?? "CC")
  )
  const [activo, setActivo] = useState(cuenta?.activo ?? true)
  const [error, setError] = useState("")

  const esBilletera = tipoEntidad === TIPO_ENTIDAD_BILLETERA

  useEffect(() => {
    if (cuenta) {
      setNombre(cuenta.nombre ?? "")
      setAlias(cuenta.alias ?? "")
      setClaveBancaria(cuenta.clave_bancaria ?? "")
      setTipoEntidad(cuenta.tipo_entidad ?? TIPO_ENTIDAD_BANCO)
      setTipoCuenta(
        cuenta.tipo_entidad === TIPO_ENTIDAD_BILLETERA
          ? TIPO_CUENTA_VIRTUAL
          : (cuenta.tipo_cuenta === TIPO_CUENTA_VIRTUAL ? "CC" : cuenta.tipo_cuenta ?? "CC")
      )
      setActivo(cuenta.activo ?? true)
    } else {
      setNombre("")
      setAlias("")
      setClaveBancaria("")
      setTipoEntidad(TIPO_ENTIDAD_BANCO)
      setTipoCuenta("CC")
      setActivo(true)
    }
    setError("")
  }, [cuenta])

  const handleClaveChange = (e) => {
    const valor = e.target.value.replace(/\D/g, "").slice(0, LONGITUD_CLAVE_BANCARIA)
    setClaveBancaria(valor)
    setError("")
    if (valor.length === LONGITUD_CLAVE_BANCARIA) {
      const sugerido = sugerirTipoEntidad(valor)
      if (sugerido) {
        setTipoEntidad(sugerido)
        setTipoCuenta(sugerido === TIPO_ENTIDAD_BILLETERA ? TIPO_CUENTA_VIRTUAL : tipoCuenta === TIPO_CUENTA_VIRTUAL ? "CC" : tipoCuenta)
      }
    }
  }

  const handleTipoEntidadChange = (nuevoTipo) => {
    setTipoEntidad(nuevoTipo)
    if (nuevoTipo === TIPO_ENTIDAD_BILLETERA) {
      setTipoCuenta(TIPO_CUENTA_VIRTUAL)
    } else {
      setTipoCuenta(tipoCuenta === TIPO_CUENTA_VIRTUAL ? "CC" : tipoCuenta)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.")
      return
    }
    if (claveBancaria && claveBancaria.length !== LONGITUD_CLAVE_BANCARIA) {
      setError(`La clave bancaria debe tener exactamente ${LONGITUD_CLAVE_BANCARIA} dígitos.`)
      return
    }
    setError("")
    const tipoCuentaEnviar = esBilletera ? TIPO_CUENTA_VIRTUAL : tipoCuenta
    onGuardar({
      nombre: nombre.trim(),
      alias: alias.trim() || null,
      clave_bancaria: claveBancaria || null,
      tipo_entidad: tipoEntidad,
      tipo_cuenta: tipoCuentaEnviar,
      activo,
    })
  }

  const esEdicion = !!cuenta?.id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancelar} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className={`bg-gradient-to-r ${theme.primario} px-6 py-4`}>
          <h3 className="text-xl font-bold text-white">
            {esEdicion ? "Editar cuenta bancaria" : "Nueva cuenta bancaria"}
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Banco Galicia, Mercado Pago"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Alias (opcional)</label>
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Ej: Galicia CA"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Clave bancaria (CBU/CVU, 22 dígitos)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={claveBancaria}
              onChange={handleClaveChange}
              placeholder="22 dígitos"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
              maxLength={LONGITUD_CLAVE_BANCARIA}
            />
            {claveBancaria.length === LONGITUD_CLAVE_BANCARIA && (
              <p className="mt-1 text-xs text-slate-500">
                Tipo sugerido: {tipoEntidad === TIPO_ENTIDAD_BANCO ? "Banco tradicional" : "Billetera virtual"}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de entidad</label>
            <select
              value={tipoEntidad}
              onChange={(e) => handleTipoEntidadChange(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value={TIPO_ENTIDAD_BANCO}>Banco Tradicional</option>
              <option value={TIPO_ENTIDAD_BILLETERA}>Billetera Virtual / CVU</option>
            </select>
          </div>
          {esBilletera ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de cuenta</label>
              <div className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600">
                Cuenta Virtual
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de cuenta</label>
              <select
                value={tipoCuenta}
                onChange={(e) => setTipoCuenta(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="CA">Caja de Ahorro</option>
                <option value="CC">Cuenta Corriente</option>
              </select>
            </div>
          )}
          {esEdicion && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activo"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              <label htmlFor="activo" className="text-sm text-slate-700">
                Cuenta activa
              </label>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancelar}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`${theme.botonPrimario} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? "Guardando…" : esEdicion ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Maestro de cuentas bancarias y billeteras virtuales.
 * Lista, alta, edición y desactivación (sin borrar).
 */
const MaestroBancos = () => {
  const theme = useFerreDeskTheme()
  const { obtenerCuentasBanco } = useCajaAPI()
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [cuentaEditar, setCuentaEditar] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cargarLista = useCallback(async () => {
    setCargando(true)
    try {
      const res = await obtenerCuentasBanco(false)
      const datos = res.results ?? (Array.isArray(res) ? res : [])
      setLista(datos)
    } catch (err) {
      console.error("Error al cargar cuentas banco:", err)
      alert(err.message || "Error al cargar lista")
      setLista([])
    } finally {
      setCargando(false)
    }
  }, [obtenerCuentasBanco])

  useEffect(() => {
    cargarLista()
  }, [cargarLista])

  const handleNuevo = () => {
    setCuentaEditar(null)
    setModalAbierto(true)
  }

  const handleEditar = (c) => {
    setCuentaEditar(c)
    setModalAbierto(true)
  }

  const handleGuardar = async (payload) => {
    setGuardando(true)
    try {
      const baseUrl = "/api/caja/cuentas-banco"
      const opts = {
        method: cuentaEditar ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      }
      const url = cuentaEditar ? `${baseUrl}/${cuentaEditar.id}/` : `${baseUrl}/`
      const res = await fetch(url, opts)
      const data = await res.json()
      if (!res.ok) {
        const msg = data.clave_bancaria?.[0] ?? data.nombre?.[0] ?? data.detail ?? "Error al guardar"
        throw new Error(msg)
      }
      setModalAbierto(false)
      setCuentaEditar(null)
      cargarLista()
    } catch (err) {
      alert(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const handleDesactivar = async (c) => {
    if (!window.confirm(`¿Desactivar la cuenta "${c.nombre}"? No se borrará, solo dejará de estar disponible.`)) return
    try {
      const res = await fetch(`/api/caja/cuentas-banco/${c.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        credentials: "include",
        body: JSON.stringify({ activo: false }),
      })
      if (!res.ok) throw new Error("Error al desactivar")
      cargarLista()
    } catch (err) {
      alert(err.message)
    }
  }

  const tipoEntidadLabel = (codigo) =>
    codigo === TIPO_ENTIDAD_BILLETERA ? "Billetera" : "Banco"
  const tipoCuentaLabel = (codigo) =>
    codigo === "CA" ? "Caja de ahorro" : codigo === TIPO_CUENTA_VIRTUAL ? "Cuenta virtual" : "Cuenta corriente"

  const generarBotonesCuenta = (c) => {
    const items = [
      { componente: BotonEditar, onClick: () => handleEditar(c), titulo: "Editar" },
    ]
    if (c.activo) {
      items.push({
        componente: BotonDesactivar,
        onClick: () => handleDesactivar(c),
        titulo: "Desactivar cuenta",
      })
    }
    return items
  }

  const columnas = [
    {
      id: "nombre",
      titulo: "NOMBRE",
      render: (c) => <span className={`text-sm ${!c.activo ? "text-slate-500" : "text-slate-800"}`}>{c.nombre}</span>,
    },
    {
      id: "alias",
      titulo: "ALIAS",
      render: (c) => <span className={`text-sm ${!c.activo ? "text-slate-500" : "text-slate-600"}`}>{c.alias ?? "—"}</span>,
    },
    {
      id: "clave_bancaria",
      titulo: "CLAVE",
      render: (c) => <span className={`text-sm font-mono ${!c.activo ? "text-slate-500" : "text-slate-600"}`}>{c.clave_bancaria ?? "—"}</span>,
    },
    {
      id: "tipo_entidad",
      titulo: "TIPO ENTIDAD",
      render: (c) => <span className={`text-sm ${!c.activo ? "text-slate-500" : "text-slate-600"}`}>{tipoEntidadLabel(c.tipo_entidad)}</span>,
    },
    {
      id: "tipo_cuenta",
      titulo: "TIPO CUENTA",
      render: (c) => <span className={`text-sm ${!c.activo ? "text-slate-500" : "text-slate-600"}`}>{tipoCuentaLabel(c.tipo_cuenta)}</span>,
    },
    {
      id: "estado",
      titulo: "ESTADO",
      render: (c) => <span className={`text-sm ${!c.activo ? "text-slate-500" : "text-slate-600"}`}>{c.activo ? "Activa" : "Inactiva"}</span>,
    },
    {
      id: "__acciones",
      titulo: "",
      ancho: 50,
      align: "center",
      render: (c) => (
        <div className="flex items-center justify-center">
          <AccionesMenu botones={generarBotonesCuenta(c)} />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-800">Maestro de Bancos</h3>
        <button
          type="button"
          onClick={handleNuevo}
          className={theme.botonPrimario}
        >
          Nuevo
        </button>
      </div>

      {cargando ? (
        <p className="text-slate-500">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="text-slate-500">No hay cuentas bancarias cargadas. Use &quot;Nuevo&quot; para agregar una.</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={lista}
          valorBusqueda=""
          onCambioBusqueda={() => {}}
          mostrarBuscador={true}
          mostrarOrdenamiento={false}
          filasPorPaginaInicial={20}
          paginadorVisible={true}
          cargando={cargando}
        />
      )}

      {modalAbierto && (
        <ModalCuentaBanco
          cuenta={cuentaEditar}
          onGuardar={handleGuardar}
          onCancelar={() => {
            setModalAbierto(false)
            setCuentaEditar(null)
          }}
          loading={guardando}
        />
      )}
    </div>
  )
}

export default MaestroBancos
