import React, { useEffect, useState } from "react"
import * as XLSX from "xlsx"
import { toast } from "react-toastify"
import { useProcessContext } from "../../context/ProcessContext"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import Paginador from "../Paginador"
import ModernFileInput from "../ModernFileInput"

const LIMITE_FILAS_VISTA_PREVIA = 10
const DECIMALES_COSTO = 2

const CLASES_ETIQUETA = "block text-[10px] font-semibold text-slate-500 mb-0.5 uppercase tracking-wider"
const CLASES_INPUT = "w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-orange-500 focus:ring-1 focus:ring-orange-500 bg-white"

function ResumenProceso({ solicitudImportacion }) {
  if (!solicitudImportacion) return null

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{solicitudImportacion.titulo || "Carga inicial"}</p>
          <p className="text-xs text-slate-600">{solicitudImportacion.proveedorNombre || "Proveedor"}</p>
        </div>
        <span className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium capitalize text-slate-700">
          {solicitudImportacion.estado}
        </span>
      </div>

      <div className="mt-3 flex gap-4 text-sm text-slate-600">
        <span>Procesados: <strong className="text-slate-900">{solicitudImportacion.registros_procesados || 0}</strong></span>
        <span>Creados: <strong className="text-slate-900">{solicitudImportacion.registros_creados || 0}</strong></span>
        <span>Saltados: <strong className="text-slate-900">{solicitudImportacion.registros_saltados || 0}</strong></span>
      </div>

      {solicitudImportacion.mensaje_error && (
        <p className="mt-2 text-sm text-red-700">{solicitudImportacion.mensaje_error}</p>
      )}
    </div>
  )
}

export default function CargaInicialProveedor() {
  const theme = useFerreDeskTheme()
  const [proveedores, setProveedores] = useState([])
  const [alicuotas, setAlicuotas] = useState([])
  const [proveedorId, setProveedorId] = useState("")
  const [archivo, setArchivo] = useState(null)
  const [colCodigo, setColCodigo] = useState("A")
  const [colCosto, setColCosto] = useState("B")
  const [colDenominacion, setColDenominacion] = useState("C")
  const [filaInicio, setFilaInicio] = useState(2)
  const [idAlicuota, setIdAlicuota] = useState("")
  const [margen, setMargen] = useState(0)
  const [unidad, setUnidad] = useState("")
  const [cantMin, setCantMin] = useState("")
  const [estrategia, setEstrategia] = useState("sigla+codigo")

  const [preview, setPreview] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [vistaPreviaLocal, setVistaPreviaLocal] = useState([])
  const [errorVistaLocal, setErrorVistaLocal] = useState("")
  const [pagina, setPagina] = useState(1)
  const [itemsPorPagina, setItemsPorPagina] = useState(20)
  const [solicitudImportacion, setSolicitudImportacion] = useState(null)

  const { registrarProceso, obtenerProceso } = useProcessContext()

  const procesoGlobal = solicitudImportacion ? obtenerProceso("carga_inicial_proveedor", solicitudImportacion.id) : null
  const importacionEnCurso = ["pendiente", "procesando"].includes(solicitudImportacion?.estado)
  const proveedorSeleccionado = proveedores.find((item) => String(item.id) === String(proveedorId))

  useEffect(() => {
    document.title = "Carga inicial por proveedor"
    fetch("/api/productos/proveedores/?acti=S", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => setProveedores(Array.isArray(d) ? d : d.results || []))
      .catch(() => setProveedores([]))

    fetch("/api/productos/alicuotasiva/", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => setAlicuotas(Array.isArray(d) ? d : d.results || []))
      .catch(() => setAlicuotas([]))
  }, [])

  useEffect(() => {
    if (!procesoGlobal) return
    setSolicitudImportacion(procesoGlobal)
    if (procesoGlobal.estado === "error") {
      setError(procesoGlobal.mensaje_error || "La importacion finalizo con error")
    }
  }, [procesoGlobal])

  useEffect(() => {
    if (importacionEnCurso) return
    setPreview(null)
    setSolicitudImportacion(null)
    setPagina(1)
  }, [proveedorId, archivo, colCodigo, colCosto, colDenominacion, filaInicio, idAlicuota, margen, unidad, cantMin, estrategia, importacionEnCurso])

  const letterToColumnIndex = (letter) => {
    if (!letter) return 0
    let column = 0
    const up = String(letter).toUpperCase()
    for (let i = 0; i < up.length; i += 1) {
      column += (up.charCodeAt(i) - 64) * Math.pow(26, up.length - i - 1)
    }
    return column - 1
  }

  const recalcularVistaLocal = async (file) => {
    if (!file) {
      setVistaPreviaLocal([])
      setErrorVistaLocal("")
      return
    }
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const ws = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })

      if (rows.length < filaInicio) {
        setErrorVistaLocal(`La fila de inicio (${filaInicio}) es mayor al total de filas (${rows.length}).`)
        setVistaPreviaLocal([])
        return
      }

      const idxCodigo = letterToColumnIndex(colCodigo)
      const idxCosto = letterToColumnIndex(colCosto)
      const idxDeno = letterToColumnIndex(colDenominacion)
      const prev = []

      for (let i = filaInicio - 1; i < rows.length && prev.length < LIMITE_FILAS_VISTA_PREVIA; i += 1) {
        const row = rows[i] || []
        const codigo = row[idxCodigo]
        const costo = row[idxCosto]
        const denominacion = row[idxDeno]

        if (codigo !== undefined) {
          prev.push({
            codigo: String(codigo).trim(),
            costo: costo !== undefined && !Number.isNaN(parseFloat(costo)) ? parseFloat(costo) : costo !== undefined ? String(costo).trim() : "",
            denominacion: denominacion !== undefined ? String(denominacion).trim() : "",
          })
        }
      }
      setVistaPreviaLocal(prev)
      setErrorVistaLocal(prev.length === 0 ? "No se detectaron datos en las columnas indicadas." : "")
    } catch {
      setVistaPreviaLocal([])
      setErrorVistaLocal("Error al leer el archivo. Verifique el formato y columnas.")
    }
  }

  useEffect(() => {
    if (archivo) {
      recalcularVistaLocal(archivo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivo, colCodigo, colCosto, colDenominacion, filaInicio])

  const handlePrevisualizar = async () => {
    setError("")
    if (!proveedorId || !archivo || !idAlicuota) {
      setError("Proveedor, archivo y alicuota son obligatorios")
      return
    }

    try {
      setCargando(true)
      const form = new FormData()
      form.append("archivo", archivo)
      form.append("col_codigo", colCodigo)
      form.append("col_costo", colCosto)
      form.append("col_denominacion", colDenominacion)
      form.append("fila_inicio", String(filaInicio))
      form.append("codvta_estrategia", estrategia)
      form.append("idaliiva_id", String(idAlicuota))
      form.append("margen", String(margen))
      if (unidad) form.append("unidad", unidad)
      if (String(cantMin).trim() !== "") form.append("cantmin", String(cantMin))

      const res = await fetch(`/api/proveedores/${proveedorId}/carga-inicial/previsualizar/`, { method: "POST", body: form, credentials: "include" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || "Error en previsualizacion")

      setPreview(data)
      setSolicitudImportacion(null)
      setPagina(1)
    } catch (e) {
      setPreview(null)
      setSolicitudImportacion(null)
      setError(e.message || "Error en previsualizacion")
    } finally {
      setCargando(false)
    }
  }

  const handleImportar = async () => {
    if (!preview || importacionEnCurso) return

    const filasValidas = (preview.preview || []).filter((fila) => fila.valido)
    if (filasValidas.length === 0) {
      setError("No hay filas validas para importar")
      return
    }

    try {
      setCargando(true)
      const payload = {
        nombre_archivo: archivo?.name || "carga_inicial",
        parametros_lote: preview.parametros_lote,
        filas: filasValidas,
      }

      const res = await fetch(`/api/proveedores/${proveedorId}/carga-inicial/importar/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || "Error en importacion")

      const procesoRegistrado = registrarProceso({
        id: data.solicitud_id,
        tipo: "carga_inicial_proveedor",
        estado: data.estado,
        proveedorId: proveedorId ? Number(proveedorId) : null,
        proveedorNombre: proveedorSeleccionado?.razon || "Proveedor",
        mensaje: data?.message || "Carga inicial iniciada. Puede continuar trabajando.",
        registros_procesados: data?.resumen?.procesados || 0,
        registros_creados: data?.resumen?.creados || 0,
        registros_saltados: data?.resumen?.saltados || 0,
        mensaje_error: data?.mensaje_error || "",
      })

      setSolicitudImportacion(procesoRegistrado)
      setError("")
      toast.warning(data?.message || "Carga inicial iniciada. Puede continuar trabajando.")
    } catch (e) {
      setError(e.message || "Error en importacion")
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className={theme.fondo}>
      <div className={theme.patron}></div>
      <div className={theme.overlay}></div>

      <div className="relative z-10 flex flex-1 flex-col px-4 py-6">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-slate-800">Carga masiva inicial por proveedor</h2>
          </div>

          <div className="space-y-4">
            {error && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <span className="font-medium">Error:</span> {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <div>
                  <label className={CLASES_ETIQUETA}>Proveedor *</label>
                  <select className={CLASES_INPUT} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} disabled={importacionEnCurso}>
                    <option value="">Seleccione proveedor...</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>{p.razon} {p.sigla ? `(${p.sigla})` : ""}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={CLASES_ETIQUETA}>Alicuota IVA *</label>
                    <select className={CLASES_INPUT} value={idAlicuota} onChange={(e) => setIdAlicuota(e.target.value)} disabled={importacionEnCurso}>
                      <option value="">Seleccione...</option>
                      {alicuotas.map((a) => (
                        <option key={a.id} value={a.id}>{a.deno} ({a.porce}%)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={CLASES_ETIQUETA}>Margen (%)</label>
                    <input className={CLASES_INPUT} type="number" step="0.01" value={margen} onChange={(e) => setMargen(e.target.value)} disabled={importacionEnCurso} />
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={CLASES_ETIQUETA}>Unidad (opcional)</label>
                    <input className={CLASES_INPUT} value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="Ej: UN, KG" disabled={importacionEnCurso} />
                  </div>
                  <div>
                    <label className={CLASES_ETIQUETA}>Cantidad minima</label>
                    <input className={CLASES_INPUT} type="number" value={cantMin} onChange={(e) => setCantMin(e.target.value)} placeholder="0" disabled={importacionEnCurso} />
                  </div>
                </div>
                <div>
                  <label className={CLASES_ETIQUETA}>Estrategia de codvta</label>
                  <select className={CLASES_INPUT} value={estrategia} onChange={(e) => setEstrategia(e.target.value)} disabled={importacionEnCurso}>
                    <option value="sigla+codigo">Sigla + cod. prov</option>
                    <option value="codigo">Cod. proveedor</option>
                    <option value="sigla+aleatorio">Sigla + aleatorio</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <div>
                  <label className={CLASES_ETIQUETA}>Archivo Excel/CSV *</label>
                  <ModernFileInput 
                    label="Seleccionar archivo"
                    helperText="Formatos: .xls, .xlsx"
                    accept=".xls,.xlsx,.ods,.csv"
                    currentFile={archivo}
                    onChange={(file) => setArchivo(file)}
                    disabled={importacionEnCurso}
                  />
                </div>
                <div>
                  <label className={CLASES_ETIQUETA}>Fila inicio</label>
                  <input className={CLASES_INPUT} type="number" value={filaInicio} onChange={(e) => setFilaInicio(parseInt(e.target.value || 2, 10))} disabled={importacionEnCurso} />
                </div>
              </div>
            </div>

            {archivo && (
              <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">Vista previa local y asignacion de columnas (primeras {LIMITE_FILAS_VISTA_PREVIA})</span>
                </div>
                
                <div className="border border-slate-200 rounded">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left align-bottom">
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Col. Codigo</label>
                          <input className="w-16 rounded border border-slate-300 px-2 py-1 text-center text-xs font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500" value={colCodigo} onChange={(e) => setColCodigo(e.target.value.toUpperCase())} maxLength={1} disabled={importacionEnCurso} />
                        </th>
                        <th className="px-3 py-2 text-left align-bottom">
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Col. Denominacion</label>
                          <input className="w-16 rounded border border-slate-300 px-2 py-1 text-center text-xs font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500" value={colDenominacion} onChange={(e) => setColDenominacion(e.target.value.toUpperCase())} maxLength={1} disabled={importacionEnCurso} />
                        </th>
                        <th className="px-3 py-2 text-right align-bottom">
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Col. Costo</label>
                          <input className="w-16 rounded border border-slate-300 px-2 py-1 text-center text-xs font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500 ml-auto" value={colCosto} onChange={(e) => setColCosto(e.target.value.toUpperCase())} maxLength={1} disabled={importacionEnCurso} />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {errorVistaLocal ? (
                        <tr><td colSpan="3" className="px-3 py-4 text-center text-red-600 text-sm">{errorVistaLocal}</td></tr>
                      ) : vistaPreviaLocal.length > 0 ? (
                        vistaPreviaLocal.map((row, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 font-mono text-slate-900">{row.codigo}</td>
                            <td className="px-3 py-2 text-slate-700">{row.denominacion}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-900">{typeof row.costo === "number" ? row.costo.toFixed(DECIMALES_COSTO) : row.costo}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="3" className="px-3 py-4 text-center text-slate-400 text-sm">Cargando vista previa...</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={cargando || errorVistaLocal || importacionEnCurso}
                    className={`${theme.botonPrimario} rounded px-4 py-2 text-sm shadow-none hover:shadow-none disabled:opacity-50`}
                    onClick={handlePrevisualizar}
                  >
                    {cargando ? "Validando..." : "Validar en servidor"}
                  </button>
                </div>
              </div>
            )}

            {preview && !solicitudImportacion && (
              <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex gap-4 text-sm">
                  <span>Validas: <strong className="text-emerald-700">{preview?.totales?.validas || 0}</strong></span>
                  <span>Invalidas: <strong className="text-red-700">{preview?.totales?.invalidas || 0}</strong></span>
                  <span>Conflictos CodVta: <strong className="text-red-700">{(preview.preview || []).filter(r => r.colision_codvta).length}</strong></span>
                </div>

                <div className="overflow-hidden border border-slate-200 rounded">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium text-slate-600">Codigo</th>
                        <th className="px-2 py-1.5 text-left font-medium text-slate-600">Denominacion</th>
                        <th className="px-2 py-1.5 text-right font-medium text-slate-600">Costo</th>
                        <th className="px-2 py-1.5 text-left font-medium text-slate-600">Codvta</th>
                        <th className="px-2 py-1.5 text-center font-medium text-slate-600">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const datos = preview.preview || []
                        const inicio = (pagina - 1) * itemsPorPagina
                        const fin = inicio + itemsPorPagina
                        return datos.slice(inicio, fin).map((fila, index) => (
                          <tr key={`${inicio + index}`} className={fila.valido ? "bg-white" : "bg-red-50"}>
                            <td className="px-2 py-1 font-mono">{fila.codigo_proveedor}</td>
                            <td className="px-2 py-1 text-slate-600">{fila.denominacion}</td>
                            <td className="px-2 py-1 text-right font-mono">{fila.costo ?? ""}</td>
                            <td className="px-2 py-1 font-mono text-blue-600">{fila.codvta_propuesto}</td>
                            <td className="px-2 py-1 text-center">
                              <span className={fila.valido ? "text-emerald-600" : "text-red-600"}>
                                {fila.valido ? "OK" : fila.motivos?.join(", ") || "Error"}
                              </span>
                            </td>
                          </tr>
                        ))
                      })()}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-2">
                  <Paginador
                    totalItems={(preview.preview || []).length}
                    itemsPerPage={itemsPorPagina}
                    currentPage={pagina}
                    onPageChange={(nextPage) => setPagina(nextPage)}
                    onItemsPerPageChange={(nextSize) => { setItemsPorPagina(nextSize); setPagina(1) }}
                    opcionesItemsPorPagina={[20, 50, 100]}
                  />
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={cargando}
                    className={`${theme.botonPrimario} rounded px-4 py-1.5 text-sm shadow-none hover:shadow-none disabled:opacity-50`}
                    onClick={handleImportar}
                  >
                    Iniciar carga masiva
                  </button>
                </div>
              </div>
            )}

            {solicitudImportacion && (
              <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Estado del proceso</h3>
                <ResumenProceso solicitudImportacion={solicitudImportacion} />
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
