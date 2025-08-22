import React, { useEffect, useState } from "react"
import * as XLSX from "xlsx"
import Navbar from "../Navbar"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import Paginador from "../Paginador"

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
      for (let i = filaInicio - 1; i < rows.length && prev.length < 10; i++) {
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Proveedor</label>
                <select className="w-full border border-slate-300 rounded px-2 py-1 text-sm" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                  <option value="">Seleccione…</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>{p.razon} {p.sigla ? `(${p.sigla})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Alícuota IVA</label>
                <select className="w-full border border-slate-300 rounded px-2 py-1 text-sm" value={idAlicuota} onChange={(e) => setIdAlicuota(e.target.value)}>
                  <option value="">Seleccione…</option>
                  {alicuotas.map((a) => (
                    <option key={a.id} value={a.id}>{a.deno} ({a.porce}%)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Margen (%)</label>
                <input className="w-full border border-slate-300 rounded px-2 py-1 text-sm" type="number" step="0.01" value={margen} onChange={(e) => setMargen(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Unidad (opcional)</label>
                <input className="w-full border border-slate-300 rounded px-2 py-1 text-sm" value={unidad} onChange={(e) => setUnidad(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Cantidad mínima (opcional)</label>
                <input className="w-full border border-slate-300 rounded px-2 py-1 text-sm" type="number" value={cantMin} onChange={(e) => setCantMin(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Estrategia de codvta</label>
                <select className="w-full border border-slate-300 rounded px-2 py-1 text-sm" value={estrategia} onChange={(e) => setEstrategia(e.target.value)}>
                  <option value="sigla+codigo">Sigla + código proveedor</option>
                  <option value="codigo">Código proveedor</option>
                  <option value="sigla+aleatorio">Sigla + aleatorio</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Archivo Excel/CSV</label>
                <input className="w-full text-sm" type="file" accept=".xls,.xlsx,.ods,.csv" onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Columna Código</label>
                <input className="w-full border border-slate-300 rounded px-2 py-1 text-sm" value={colCodigo} onChange={(e) => setColCodigo(e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Columna Costo</label>
                <input className="w-full border border-slate-300 rounded px-2 py-1 text-sm" value={colCosto} onChange={(e) => setColCosto(e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Columna Denominación</label>
                <input className="w-full border border-slate-300 rounded px-2 py-1 text-sm" value={colDenominacion} onChange={(e) => setColDenominacion(e.target.value.toUpperCase())} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Fila inicio</label>
                <input className="w-full border border-slate-300 rounded px-2 py-1 text-sm" type="number" value={filaInicio} onChange={(e) => setFilaInicio(parseInt(e.target.value || 2))} />
              </div>
              <div className="md:col-span-3">
                <button
                  className={theme.botonPrimario}
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
                  Previsualizar
                </button>
              </div>
            </div>

            {/* Vista previa rápida local para ajustar columnas */}
            {archivo && (
              <div className="mt-2">
                <h3 className="text-sm font-semibold text-slate-800 mb-1">Vista previa (primeras 10 filas)</h3>
                {errorVistaLocal && <div className="text-red-600 text-xs mb-2">{errorVistaLocal}</div>}
                {vistaPreviaLocal.length > 0 && (
                  <div className="overflow-auto border border-slate-200 rounded">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-2 py-1 text-left">Código ({colCodigo})</th>
                          <th className="px-2 py-1 text-left">Denominación ({colDenominacion})</th>
                          <th className="px-2 py-1 text-right">Costo ({colCosto})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vistaPreviaLocal.map((r, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1 whitespace-nowrap">{r.codigo}</td>
                            <td className="px-2 py-1">{r.denominacion}</td>
                            <td className="px-2 py-1 text-right">{typeof r.costo === 'number' ? r.costo.toFixed(2) : r.costo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {error && <div className="text-red-600 text-sm">{error}</div>}

            {preview && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-slate-700">
                    Válidas: <b>{preview?.totales?.validas || 0}</b> • Inválidas: <b>{preview?.totales?.invalidas || 0}</b> • Unicas: <b>{preview?.totales?.filas_unicas || 0}</b>
                  </div>
                  <div className="hidden md:flex gap-3">
                    <span className="text-xs text-slate-600">Posibles colisiones codvta: <b>{(() => { const map=new Map(); (preview.preview||[]).forEach(r=>{const k=r.codvta_propuesto||''; map.set(k,(map.get(k)||0)+1)}); let t=0; map.forEach(v=>{if(v>1) t+=v}); return t })()}</b></span>
                    <span className="text-xs text-slate-600">Conflictos codvta (server): <b>{(() => (preview.preview||[]).filter(r=>r.colision_codvta).length)()}</b></span>
                    <span className="text-xs text-slate-600">Conflictos código prov.: <b>{(() => (preview.preview||[]).filter(r=>r.conflicto_codigo_proveedor).length)()}</b></span>
                  </div>
                  <button
                    className={theme.botonPrimario}
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
                    Importar válidas
                  </button>
                </div>
                <div className="overflow-auto border border-slate-200 rounded">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-2 py-1 text-left">Código prov.</th>
                        <th className="px-2 py-1 text-left">Denominación</th>
                        <th className="px-2 py-1 text-right">Costo</th>
                        <th className="px-2 py-1 text-left">codvta</th>
                        <th className="px-2 py-1 text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const datos = preview.preview || []
                        const inicio = (pagina - 1) * itemsPorPagina
                        const fin = inicio + itemsPorPagina
                        return datos.slice(inicio, fin).map((f, i) => (
                          <tr key={`${inicio + i}`} className={f.valido ? "bg-white" : "bg-red-50"}>
                            <td className="px-2 py-1 whitespace-nowrap">{f.codigo_proveedor}</td>
                            <td className="px-2 py-1">{f.denominacion}</td>
                            <td className="px-2 py-1 text-right">{f.costo ?? ""}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{f.codvta_propuesto}</td>
                            <td className="px-2 py-1">
                              {f.valido ? (
                                <span className="text-green-700">Válido</span>
                              ) : (
                                <span className="text-red-700">Inválido{f.motivos?.length ? `: ${f.motivos.join(", ")}` : ""}</span>
                              )}
                            </td>
                          </tr>
                        ))
                      })()}
                    </tbody>
                  </table>
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


