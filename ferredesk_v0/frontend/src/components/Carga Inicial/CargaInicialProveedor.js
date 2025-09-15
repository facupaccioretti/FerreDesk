import React, { useEffect, useState } from "react"
import * as XLSX from "xlsx"
import Navbar from "../Navbar"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import Paginador from "../Paginador"


const LIMITE_FILAS_VISTA_PREVIA = 10;
const DECIMALES_COSTO = 2;

// Constantes de clases para un estilo consistente con ClienteForm
const CLASES_TARJETA = "bg-white border border-slate-200 rounded-md p-2"
const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
const CLASES_INPUT = "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
const CLASES_SECCION_TITULO = "mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-slate-700"
const CLASES_SECCION_WRAPPER = "p-2 bg-slate-50 rounded-lg border border-slate-200 min-w-[260px]"

export default function CargaInicialProveedor() {
  const theme = useFerreDeskTheme()

  const [user, setUser] = useState(null)
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

  useEffect(() => {
    document.title = "Carga inicial por proveedor"
    fetch("/api/user/", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.status === "success") setUser(data.user)
      })
      .catch(() => {})
    // Cargar proveedores (activos) y alícuotas
    fetch("/api/productos/proveedores/?acti=S", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => setProveedores(Array.isArray(d) ? d : d.results || []))
      .catch(() => setProveedores([]))
    fetch("/api/productos/alicuotasiva/", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => setAlicuotas(Array.isArray(d) ? d : d.results || []))
      .catch(() => setAlicuotas([]))
  }, [])

  // ---------------- Vista previa local (primeras 10 filas) ----------------
  const letterToColumnIndex = (letter) => {
    if (!letter) return 0
    let column = 0
    const up = String(letter).toUpperCase()
    for (let i = 0; i < up.length; i++) {
      column += (up.charCodeAt(i) - 64) * Math.pow(26, up.length - i - 1)
    }
    return column - 1
  }

  const recalcularVistaLocal = async (f) => {
    if (!f) {
      setVistaPreviaLocal([])
      setErrorVistaLocal("")
      return
    }
    try {
      const data = await f.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const ws = workbook.Sheets[sheetName]
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
      for (let i = filaInicio - 1; i < rows.length && prev.length < LIMITE_FILAS_VISTA_PREVIA; i++) {
        const row = rows[i] || []
        const c = row[idxCodigo]
        const p = row[idxCosto]
        const d = row[idxDeno]
        if (c !== undefined) {
          prev.push({
            codigo: String(c).trim(),
            costo: p !== undefined && !isNaN(parseFloat(p)) ? parseFloat(p) : (p !== undefined ? String(p).trim() : ""),
            denominacion: d !== undefined ? String(d).trim() : "",
          })
        }
      }
      setVistaPreviaLocal(prev)
      setErrorVistaLocal(prev.length === 0 ? "No se detectaron datos en las columnas indicadas." : "")
    } catch (e) {
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

  // --------- Derivados para previsualización completa (servidor) ---------
  // Derivados calculados inline en render para evitar variables no usadas

  const handleLogout = () => {
    fetch("/api/logout/", { method: "POST", credentials: "include" }).then(() => {
      window.location.href = "/login"
    })
  }

  return (
    <div className={theme.fondo}>
      <div className={theme.patron}></div>
      <div className={theme.overlay}></div>
      <Navbar user={user} onLogout={handleLogout} />

      <div className="py-8 px-4 flex-1 flex flex-col relative z-10">
        <div className="max-w-[1400px] w-full mx-auto flex flex-col flex-1">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Carga masiva inicial por proveedor</h2>
          </div>

          <div className="flex-1 p-6 bg-white rounded-xl shadow-md space-y-4">
            {/* Tarjetas horizontales al estilo ClienteForm */}
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              {/* Tarjeta Configuración Principal */}
              <div className={CLASES_SECCION_WRAPPER}>
                <h5 className={CLASES_SECCION_TITULO}>
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Configuración Principal
                </h5>
                <div className="divide-y divide-slate-200">
                  <div className={CLASES_TARJETA}>
                    <div className={CLASES_ETIQUETA}>Proveedor *</div>
                    <div className="mt-0.5">
                      <select className={CLASES_INPUT} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                        <option value="">Seleccione proveedor…</option>
                        {proveedores.map((p) => (
                          <option key={p.id} value={p.id}>{p.razon} {p.sigla ? `(${p.sigla})` : ""}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={CLASES_TARJETA}>
                    <div className={CLASES_ETIQUETA}>Alícuota IVA *</div>
                    <div className="mt-0.5">
                      <select className={CLASES_INPUT} value={idAlicuota} onChange={(e) => setIdAlicuota(e.target.value)}>
                        <option value="">Seleccione alícuota…</option>
                        {alicuotas.map((a) => (
                          <option key={a.id} value={a.id}>{a.deno} ({a.porce}%)</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={CLASES_TARJETA}>
                    <div className={CLASES_ETIQUETA}>Margen (%)</div>
                    <div className="mt-0.5">
                      <input className={CLASES_INPUT} type="number" step="0.01" value={margen} onChange={(e) => setMargen(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tarjeta Configuración Adicional */}
              <div className={CLASES_SECCION_WRAPPER}>
                <h5 className={CLASES_SECCION_TITULO}>
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Configuración Adicional
                </h5>
                <div className="divide-y divide-slate-200">
                  <div className={CLASES_TARJETA}>
                    <div className={CLASES_ETIQUETA}>Unidad (opcional)</div>
                    <div className="mt-0.5">
                      <input className={CLASES_INPUT} value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="Ej: UN, KG, M" />
                    </div>
                  </div>
                  <div className={CLASES_TARJETA}>
                    <div className={CLASES_ETIQUETA}>Cantidad mínima</div>
                    <div className="mt-0.5">
                      <input className={CLASES_INPUT} type="number" value={cantMin} onChange={(e) => setCantMin(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  <div className={CLASES_TARJETA}>
                    <div className={CLASES_ETIQUETA}>Estrategia de codvta</div>
                    <div className="mt-0.5">
                      <select className={CLASES_INPUT} value={estrategia} onChange={(e) => setEstrategia(e.target.value)}>
                        <option value="sigla+codigo">Sigla + código proveedor</option>
                        <option value="codigo">Código proveedor</option>
                        <option value="sigla+aleatorio">Sigla + aleatorio</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tarjeta Configuración de Archivo */}
              <div className={CLASES_SECCION_WRAPPER}>
                <h5 className={CLASES_SECCION_TITULO}>
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Configuración de Archivo
                </h5>
                <div className="divide-y divide-slate-200">
                  <div className={CLASES_TARJETA}>
                    <div className={CLASES_ETIQUETA}>Archivo Excel/CSV *</div>
                    <div className="mt-0.5">
                      <input className={CLASES_INPUT} type="file" accept=".xls,.xlsx,.ods,.csv" onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
                    </div>
                  </div>
                  <div className="pt-2">
                    <button
                      className="w-full px-4 py-2 bg-orange-600 text-white rounded-sm hover:bg-orange-700 font-semibold text-xs transition-colors duration-200 flex items-center justify-center gap-2"
                      onClick={async () => {
                        setError("")
                        if (!proveedorId || !archivo || !idAlicuota) {
                          setError("Proveedor, archivo y alícuota son obligatorios")
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
                          if (!res.ok) throw new Error(data?.detail || "Error en previsualización")
                          setPreview(data)
                        } catch (e) {
                          setPreview(null)
                          setError(e.message || "Error en previsualización")
                        } finally {
                          setCargando(false)
                        }
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Previsualizar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Vista previa rápida local para ajustar columnas */}
            {archivo && (
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Vista Previa Rápida (primeras {LIMITE_FILAS_VISTA_PREVIA} filas)
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">Fila inicio:</span>
                    <input 
                      className="w-16 h-6 text-center font-mono text-xs border border-slate-300 rounded-sm px-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                      type="number" 
                      value={filaInicio} 
                      onChange={(e) => setFilaInicio(parseInt(e.target.value || 2))} 
                    />
                  </div>
                </div>
                <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">
                            <div className="flex items-center gap-2 h-6">
                              <span className="leading-6">Código</span>
                              <input 
                                className="w-8 h-6 text-center font-mono text-xs border border-slate-300 rounded-sm px-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                                value={colCodigo} 
                                onChange={(e) => setColCodigo(e.target.value.toUpperCase())}
                                maxLength={1}
                              />
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">
                            <div className="flex items-center gap-2 h-6">
                              <span className="leading-6">Denominación</span>
                              <input 
                                className="w-8 h-6 text-center font-mono text-xs border border-slate-300 rounded-sm px-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                                value={colDenominacion} 
                                onChange={(e) => setColDenominacion(e.target.value.toUpperCase())}
                                maxLength={1}
                              />
                            </div>
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-slate-700">
                            <div className="flex items-center gap-2 justify-end h-6">
                              <span className="leading-6">Costo</span>
                              <input 
                                className="w-8 h-6 text-center font-mono text-xs border border-slate-300 rounded-sm px-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                                value={colCosto} 
                                onChange={(e) => setColCosto(e.target.value.toUpperCase())}
                                maxLength={1}
                              />
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {errorVistaLocal ? (
                          <tr>
                            <td colSpan="3" className="px-3 py-4 text-center">
                              <div className="flex items-center justify-center gap-2 text-red-700 text-sm">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {errorVistaLocal}
                              </div>
                            </td>
                          </tr>
                        ) : vistaPreviaLocal.length > 0 ? (
                          vistaPreviaLocal.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-mono text-slate-900">{r.codigo}</td>
                              <td className="px-3 py-2 text-slate-700">{r.denominacion}</td>
                              <td className="px-3 py-2 text-right font-mono text-slate-900">{typeof r.costo === 'number' ? r.costo.toFixed(DECIMALES_COSTO) : r.costo}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3" className="px-3 py-4 text-center text-slate-500 text-sm">
                              Cargando vista previa...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Error:</span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {preview && (
              <div className="bg-green-50 rounded-lg border border-green-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Vista Previa del Servidor
                  </h3>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-green-700 font-medium">{preview?.totales?.validas || 0} válidas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      <span className="text-red-700 font-medium">{preview?.totales?.invalidas || 0} inválidas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span className="text-blue-700 font-medium">{preview?.totales?.filas_unicas || 0} únicas</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div className="bg-white border border-slate-200 rounded-md p-3">
                    <div className="text-xs text-slate-600 mb-1">Colisiones codvta</div>
                    <div className="text-sm font-semibold text-orange-600">{(() => { const map=new Map(); (preview.preview||[]).forEach(r=>{const k=r.codvta_propuesto||''; map.set(k,(map.get(k)||0)+1)}); let t=0; map.forEach(v=>{if(v>1) t+=v}); return t })()}</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-md p-3">
                    <div className="text-xs text-slate-600 mb-1">Conflictos codvta (server)</div>
                    <div className="text-sm font-semibold text-red-600">{(() => (preview.preview||[]).filter(r=>r.colision_codvta).length)()}</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-md p-3">
                    <div className="text-xs text-slate-600 mb-1">Conflictos código prov.</div>
                    <div className="text-sm font-semibold text-red-600">{(() => (preview.preview||[]).filter(r=>r.conflicto_codigo_proveedor).length)()}</div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                    onClick={async () => {
                      if (!preview) return
                      const filasValidas = (preview.preview || []).filter((f) => f.valido)
                      if (filasValidas.length === 0) {
                        setError("No hay filas válidas para importar")
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
                        if (!res.ok) throw new Error(data?.detail || "Error en importación")
                        // Guardar resultados para mostrar detalle
                        try {
                          window.__ultimaImportacion__ = data
                        } catch(_) {}
                        alert(`Importación finalizada. Creados: ${data?.resumen?.creados || 0}, Saltados: ${data?.resumen?.saltados || 0}`)
                      } catch (e) {
                        setError(e.message || "Error en importación")
                      } finally {
                        setCargando(false)
                      }
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Importar válidas
                  </button>
                </div>
                <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Código prov.</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Denominación</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-700">Costo</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Codvta</th>
                          <th className="px-3 py-2 text-center font-medium text-slate-700">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(() => {
                          const datos = preview.preview || []
                          const inicio = (pagina - 1) * itemsPorPagina
                          const fin = inicio + itemsPorPagina
                          return datos.slice(inicio, fin).map((f, i) => (
                            <tr key={`${inicio + i}`} className={f.valido ? "hover:bg-slate-50" : "bg-red-50 hover:bg-red-100"}>
                              <td className="px-3 py-2 font-mono text-slate-900">{f.codigo_proveedor}</td>
                              <td className="px-3 py-2 text-slate-700">{f.denominacion}</td>
                              <td className="px-3 py-2 text-right font-mono text-slate-900">{f.costo ?? ""}</td>
                              <td className="px-3 py-2 font-mono text-blue-600 font-semibold">{f.codvta_propuesto}</td>
                              <td className="px-3 py-2 text-center">
                                {f.valido ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Válido
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    {f.motivos?.length ? f.motivos.join(", ") : "Inválido"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
                <Paginador
                  totalItems={(preview.preview || []).length}
                  itemsPerPage={itemsPorPagina}
                  currentPage={pagina}
                  onPageChange={(p) => setPagina(p)}
                  onItemsPerPageChange={(n) => {
                    setItemsPorPagina(n)
                    setPagina(1)
                  }}
                  opcionesItemsPorPagina={[10, 20, 50, 100]}
                />
              </div>
            )}

            {cargando && <div className="text-slate-700 text-sm">Procesando…</div>}
          </div>
        </div>
      </div>
    </div>
  )
}


