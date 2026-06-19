import React, { Fragment, useEffect, useRef, useState } from "react"
import * as XLSX from "xlsx"
import { Dialog, Transition } from "@headlessui/react"
import { toast } from "react-toastify"
import { useProcessContext } from "../../context/ProcessContext"
import { getCookie } from "../../utils/csrf"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import ModernFileInput from "../ModernFileInput"

const CANTIDAD_MAX_VISTA_PREVIA = 10
const LONGITUD_MINIMA_TOKEN = 3
const CANTIDAD_MINIMA_TOKENS_COINCIDEN = 1
const MENSAJE_ADVERTENCIA_NO_COINCIDENCIA =
  "No se encontro coincidencia entre el archivo y el proveedor. Verifique que la lista subida sea la correcta."

function normalizarCadena(texto) {
  if (!texto) return ""

  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function existeCoincidenciaArchivoProveedor(archivoNombre, fantasiaProveedor) {
  const nombreNormalizado = normalizarCadena(archivoNombre)
  const fantasiaNormalizada = normalizarCadena(fantasiaProveedor)

  if (!nombreNormalizado || !fantasiaNormalizada) {
    return false
  }

  const tokens = fantasiaNormalizada
    .split(" ")
    .filter((token) => token.length >= LONGITUD_MINIMA_TOKEN)

  if (tokens.length === 0) {
    return false
  }

  let tokensCoinciden = 0
  for (const token of tokens) {
    if (nombreNormalizado.includes(token)) {
      tokensCoinciden += 1
    }
  }

  return tokensCoinciden >= CANTIDAD_MINIMA_TOKENS_COINCIDEN
}

function construirMensajeConfirmacionImportacion(archivoNombre, proveedorNombre) {
  return `Estas por iniciar la actualizacion de la lista "${archivoNombre}" para el proveedor "${proveedorNombre}".`
}

function letterToColumnIndex(letter) {
  let column = 0
  const length = letter.length

  for (let i = 0; i < length; i += 1) {
    column += (letter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1)
  }

  return column - 1
}

export default function ListaPreciosModal({ open, onClose, proveedor, onImport }) {
  const csrftoken = getCookie("csrftoken")
  const theme = useFerreDeskTheme()
  const { registrarProceso, obtenerProceso } = useProcessContext()

  const [file, setFile] = useState(null)
  const [colCodigo, setColCodigo] = useState("A")
  const [colPrecio, setColPrecio] = useState("B")
  const [colDenominacion, setColDenominacion] = useState("C")
  const [filaInicio, setFilaInicio] = useState(2)
  const [vistaPrevia, setVistaPrevia] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorVistaPrevia, setErrorVistaPrevia] = useState("")
  const [advertenciaNombreArchivo, setAdvertenciaNombreArchivo] = useState("")
  const [nombreArchivoSeleccionado, setNombreArchivoSeleccionado] = useState("")
  const [importando, setImportando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState("")
  const [importacionIniciada, setImportacionIniciada] = useState(null)
  const [mensajeImportacion, setMensajeImportacion] = useState("")

  const procesoGlobal = importacionIniciada
    ? obtenerProceso("actualizacion_lista_precios", importacionIniciada.id)
    : null

  useEffect(() => {
    if (!open) {
      setImportando(false)
      return
    }

    fetch("/api/productos/proveedores/", { credentials: "include" })
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    setFile(null)
    setColCodigo("A")
    setColPrecio("B")
    setColDenominacion("C")
    setFilaInicio(2)
    setVistaPrevia([])
    setLoading(false)
    setErrorVistaPrevia("")
    setAdvertenciaNombreArchivo("")
    setNombreArchivoSeleccionado("")
    setImportando(false)
    setErrorFormulario("")
    setImportacionIniciada(null)
    setMensajeImportacion("")
  }, [open])

  useEffect(() => {
    if (!procesoGlobal) {
      return
    }

    if (procesoGlobal.estado === "completada") {
      const procesados = procesoGlobal.registros_procesados || 0
      const actualizados = procesoGlobal.registros_actualizados || 0
      const message =
        actualizados === 0
          ? "La lista finalizo sin actualizar costos. Verifique que el archivo corresponda al proveedor."
          : `Lista importada correctamente. Registros procesados: ${procesados}. Actualizados: ${actualizados}.`

      setMensajeImportacion(message)
      onImport?.({
        proveedor,
        fileName: file?.name,
        status: "success",
        message,
        registrosProcesados: procesados,
        registrosActualizados: actualizados,
      })
    } else if (procesoGlobal.estado === "error") {
      setMensajeImportacion(
        procesoGlobal.mensaje_error || "La importacion finalizo con error."
      )
    }
  }, [file?.name, onImport, procesoGlobal, proveedor])

  useEffect(() => {
    if (!file) {
      return
    }

    const reprocesar = async () => {
      await handleFilePreview(file)
    }

    reprocesar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colCodigo, colPrecio, colDenominacion, filaInicio])

  const resetEstadoDependiente = () => {
    setVistaPrevia([])
    setErrorVistaPrevia("")
    setErrorFormulario("")
    setImportacionIniciada(null)
    setMensajeImportacion("")
  }

  const handleFilePreview = async (selectedFile) => {
    if (!selectedFile) {
      resetEstadoDependiente()
      return
    }

    setLoading(true)
    setErrorVistaPrevia("")

    try {
      const fantasiaReferencia = proveedor?.fantasia || proveedor?.razon || ""
      const hayCoincidencia = existeCoincidenciaArchivoProveedor(
        selectedFile.name || "",
        fantasiaReferencia
      )
      setAdvertenciaNombreArchivo(
        hayCoincidencia ? "" : MENSAJE_ADVERTENCIA_NO_COINCIDENCIA
      )
    } catch (_) {
      setAdvertenciaNombreArchivo("")
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: "binary" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const dataRows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          blankrows: false,
        })

        if (dataRows.length < filaInicio) {
          setErrorVistaPrevia(
            `La fila de inicio (${filaInicio}) es mayor que el numero de filas en el archivo (${dataRows.length}).`
          )
          setVistaPrevia([])
          setLoading(false)
          return
        }

        const codigoIdx = letterToColumnIndex(colCodigo.toUpperCase())
        const precioIdx = letterToColumnIndex(colPrecio.toUpperCase())
        const denominacionIdx = letterToColumnIndex(colDenominacion.toUpperCase())
        const previewData = []

        for (
          let i = filaInicio - 1;
          i < dataRows.length && previewData.length < CANTIDAD_MAX_VISTA_PREVIA;
          i += 1
        ) {
          const row = dataRows[i]
          const codigo = row[codigoIdx]
          const precio = row[precioIdx]
          const denominacion = row[denominacionIdx]

          if (codigo !== undefined && precio !== undefined) {
            previewData.push({
              codigo: String(codigo).trim(),
              precio: !Number.isNaN(parseFloat(precio))
                ? parseFloat(precio)
                : String(precio).trim(),
              denominacion:
                denominacion !== undefined ? String(denominacion).trim() : "",
            })
          } else if (previewData.length === 0 && i >= filaInicio - 1 + 5) {
            setErrorVistaPrevia(
              "No se encontraron datos validos con las columnas y fila de inicio especificadas. Verifique la configuracion."
            )
            break
          }
        }

        if (previewData.length === 0 && !errorVistaPrevia) {
          setErrorVistaPrevia(
            "No se pudo extraer una vista previa. Verifique las columnas y la fila de inicio."
          )
        }

        setVistaPrevia(previewData)
      } catch (error) {
        console.error("Error parsing Excel file:", error)
        setErrorVistaPrevia(
          "Error al procesar el archivo Excel. Asegurese de que sea un formato valido y que la configuracion de columnas sea correcta."
        )
        setVistaPrevia([])
      } finally {
        setLoading(false)
      }
    }

    reader.onerror = (error) => {
      console.error("FileReader error:", error)
      setErrorVistaPrevia("Error al leer el archivo.")
      setLoading(false)
    }

    reader.readAsBinaryString(selectedFile)
  }

  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) {
      setFile(null)
      setAdvertenciaNombreArchivo("")
      setNombreArchivoSeleccionado("")
      resetEstadoDependiente()
      return
    }

    setFile(selectedFile)
    setNombreArchivoSeleccionado(selectedFile.name || "")
    resetEstadoDependiente()
    await handleFilePreview(selectedFile)
  }

  const validarAntesDeImportar = () => {
    if (!file) {
      setErrorFormulario("Por favor, seleccione un archivo primero.")
      return false
    }

    if (errorVistaPrevia && vistaPrevia.length === 0) {
      setErrorFormulario(
        "Hay errores en la configuracion de la vista previa. Corrijalos antes de iniciar la actualizacion."
      )
      return false
    }

    if (vistaPrevia.length === 0) {
      setErrorFormulario(
        "No hay datos en la vista previa para importar. Verifique el archivo y la configuracion."
      )
      return false
    }

    setErrorFormulario("")
    return true
  }

  const handleImport = () => {
    if (!validarAntesDeImportar()) {
      return
    }

    const mensaje = construirMensajeConfirmacionImportacion(
      file?.name || "archivo seleccionado",
      proveedor?.razon || proveedor?.nombre || "Proveedor"
    )

    if (window.confirm(`${mensaje}\n\nAl confirmar, el proceso seguira visible globalmente aunque cierre este modal.`)) {
      confirmarImportacion()
    }
  }

  const confirmarImportacion = async () => {
    if (!validarAntesDeImportar() || importando || importacionIniciada) {
      return
    }

    setImportando(true)
    setLoading(true)

    const formData = new FormData()
    formData.append("excel_file", file)
    formData.append("col_codigo", colCodigo.toUpperCase())
    formData.append("col_precio", colPrecio.toUpperCase())
    formData.append("col_denominacion", colDenominacion.toUpperCase())
    formData.append("fila_inicio", String(filaInicio))

    try {
      const response = await fetch(
        `/api/productos/proveedores/${proveedor.id}/upload-price-list/`,
        {
          method: "POST",
          headers: { "X-CSRFToken": csrftoken },
          body: formData,
          credentials: "include",
        }
      )

      setLoading(false)

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: "Error desconocido al importar." }))
        setErrorFormulario(
          `Error al importar: ${errorData.detail || response.statusText}`
        )
        return
      }

      const result = await response.json()
      const importacionDiferida = result.modo_procesamiento === "diferido"

      if (importacionDiferida) {
        registrarProceso({
          id: result.importacion_id,
          estado: result.estado,
          proveedorId: proveedor.id,
          proveedorNombre: proveedor?.razon || proveedor?.nombre || "Proveedor",
          tipo: "actualizacion_lista_precios",
          mensaje: result.message || "Importacion de lista iniciada.",
        })

        setImportacionIniciada({
          id: result.importacion_id,
          estado: result.estado,
        })
        setMensajeImportacion(
          "Proceso iniciado. Puede cerrar este modal; el seguimiento continua en el banner global."
        )

        toast.warning(
          `Actualizacion iniciada para ${proveedor?.razon || proveedor?.nombre || "el proveedor"}.`,
          { autoClose: 4000 }
        )
        return
      }

      onImport?.({
        proveedor,
        fileName: file.name,
        status: "success",
        message: result.message || "Lista importada correctamente.",
        registrosProcesados: result.registros_procesados || 0,
        registrosActualizados: result.registros_actualizados || 0,
      })

      if ((result.registros_actualizados || 0) === 0) {
        toast.warning(
          "La lista no produjo actualizaciones de costo para este proveedor. Verifique que el archivo corresponda."
        )
      }

      toast.success(result.message || "Lista importada correctamente.")
      onClose()
    } catch (error) {
      console.error("Error during import request:", error)
      setErrorFormulario(`Error de red o conexion al importar: ${error.message}`)
    } finally {
      setImportando(false)
      setLoading(false)
    }
  }

  return (
    <Transition show={open} as={Fragment} appear>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => {
          if (!importando) onClose()
        }}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className={`relative bg-gradient-to-r ${theme.primario} p-6`}>
                  <button
                    onClick={onClose}
                    disabled={importando}
                    className="absolute right-4 top-4 text-2xl text-slate-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ×
                  </button>
                  <Dialog.Title as="h2" className="text-xl font-bold text-white">
                    Cargar Lista de Precios - {proveedor?.razon}
                  </Dialog.Title>
                  <p className="mt-1 text-sm text-slate-300">
                    Revise el archivo, valide la vista previa e inicie la actualizacion
                  </p>
                </div>

                <div className="overflow-y-auto p-6">
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Esta actualizacion puede impactar productos, costos y listas en masa.
                    Evite operar ventas, presupuestos, compras y productos hasta que finalice.
                  </div>

                  <div className="mb-4">
                    <ModernFileInput 
                      label="Seleccionar lista de precios Excel"
                      helperText="Formatos: .xlsx, .xls"
                      accept=".xlsx,.xls"
                      currentFile={file}
                      onChange={handleFileChange}
                      disabled={importando}
                    />

                    {advertenciaNombreArchivo && (
                      <div className="mb-3 rounded border border-yellow-200 bg-yellow-50 p-2 text-sm text-yellow-800">
                        {advertenciaNombreArchivo}
                        {nombreArchivoSeleccionado ? (
                          <span className="ml-1 italic">
                            (archivo: {nombreArchivoSeleccionado})
                          </span>
                        ) : null}
                      </div>
                    )}

                    <div className="mb-2 grid grid-cols-4 gap-4">
                      <div>
                        <label
                          htmlFor={`colCodigo-${proveedor?.id}`}
                          className="block text-sm font-medium"
                        >
                          Columna Codigo
                        </label>
                        <input
                          id={`colCodigo-${proveedor?.id}`}
                          type="text"
                          value={colCodigo}
                          onChange={(event) => setColCodigo(event.target.value.toUpperCase())}
                          className="w-full rounded border p-2"
                          maxLength={2}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`colDenominacion-${proveedor?.id}`}
                          className="block text-sm font-medium"
                        >
                          Columna Denominacion
                        </label>
                        <input
                          id={`colDenominacion-${proveedor?.id}`}
                          type="text"
                          value={colDenominacion}
                          onChange={(event) =>
                            setColDenominacion(event.target.value.toUpperCase())
                          }
                          className="w-full rounded border p-2"
                          maxLength={2}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`colPrecio-${proveedor?.id}`}
                          className="block text-sm font-medium"
                        >
                          Columna Precio
                        </label>
                        <input
                          id={`colPrecio-${proveedor?.id}`}
                          type="text"
                          value={colPrecio}
                          onChange={(event) => setColPrecio(event.target.value.toUpperCase())}
                          className="w-full rounded border p-2"
                          maxLength={2}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`filaInicio-${proveedor?.id}`}
                          className="block text-sm font-medium"
                        >
                          Fila de Inicio
                        </label>
                        <input
                          id={`filaInicio-${proveedor?.id}`}
                          type="number"
                          value={filaInicio}
                          onChange={(event) => setFilaInicio(Number(event.target.value))}
                          className="w-full rounded border p-2"
                          min={1}
                        />
                      </div>
                    </div>
                  </div>

                  {errorFormulario && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {errorFormulario}
                    </div>
                  )}

                  {loading && file && (
                    <div className="my-3 text-blue-600">Procesando vista previa...</div>
                  )}

                  {vistaPrevia.length > 0 && (
                    <div className="mb-4 max-h-60 overflow-y-auto">
                      <h3 className="mb-2 text-md font-semibold">
                        Vista previa (primeros {vistaPrevia.length} registros):
                      </h3>
                      <table className="min-w-full border text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="border px-2 py-1 text-left">
                              Codigo ({colCodigo})
                            </th>
                            <th className="border px-2 py-1 text-left">
                              Denominacion ({colDenominacion})
                            </th>
                            <th className="border px-2 py-1 text-left">
                              Precio ({colPrecio})
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {vistaPrevia.map((item, index) => (
                            <tr
                              key={`${item.codigo}-${index}`}
                              className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                            >
                              <td className="border px-2 py-1">{item.codigo}</td>
                              <td className="border px-2 py-1">{item.denominacion}</td>
                              <td className="border px-2 py-1">
                                {typeof item.precio === "number"
                                  ? item.precio.toFixed(2)
                                  : item.precio}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {vistaPrevia.length === 0 && file && !loading && !errorVistaPrevia && (
                    <div className="my-3 rounded-md border border-yellow-300 bg-yellow-100 p-3 text-yellow-700">
                      No se encontraron datos para la vista previa con la configuracion actual.
                    </div>
                  )}

                  {errorVistaPrevia && (
                    <div className="my-3 rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                      {errorVistaPrevia}
                    </div>
                  )}

                  {mensajeImportacion && (
                    <div
                      className={`my-3 rounded-md border p-3 ${
                        procesoGlobal?.estado === "error"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : procesoGlobal?.estado === "completada"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-blue-200 bg-blue-50 text-blue-700"
                      }`}
                    >
                      {mensajeImportacion}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={onClose}
                      disabled={importando}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleImport}
                      className={`${theme.botonPrimario} disabled:opacity-50`}
                      disabled={
                        Boolean(importacionIniciada) ||
                        importando ||
                        loading ||
                        !file ||
                        (errorVistaPrevia && vistaPrevia.length === 0)
                      }
                    >
                      {importacionIniciada
                        ? "Proceso iniciado"
                        : importando
                          ? "Iniciando..."
                          : loading && !file
                            ? "Cargando..."
                            : loading && file
                              ? "Preparando..."
                              : "Iniciar actualizacion"}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
