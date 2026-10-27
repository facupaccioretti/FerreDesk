import { useEffect, useMemo, useRef, useState } from "react"
import { useFerreDeskTheme } from "../../../hooks/useFerreDeskTheme"

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]

function instanteMs(valor) {
  if (!valor) return 0
  const tiempo = new Date(valor).getTime()
  return Number.isFinite(tiempo) ? tiempo : 0
}

export default function PinPad({ esperaHasta, onSubmit }) {
  const theme = useFerreDeskTheme()
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [esperaLocal, setEsperaLocal] = useState(0)
  const [ahora, setAhora] = useState(Date.now())
  const pinRef = useRef("")
  const enviandoRef = useRef(false)
  const inputRef = useRef(null)
  const esperaObjetivo = Math.max(instanteMs(esperaHasta), esperaLocal)
  const segundosRestantes = Math.max(0, Math.ceil((esperaObjetivo - ahora) / 1000))
  const bloqueado = enviando || segundosRestantes > 0

  useEffect(() => {
    inputRef.current?.focus()
    return () => {
      pinRef.current = ""
      enviandoRef.current = false
    }
  }, [])

  useEffect(() => {
    if (segundosRestantes <= 0) return undefined
    const intervalId = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [segundosRestantes])

  const actualizarPin = (valor) => {
    const limpio = String(valor).replace(/\D/g, "").slice(0, 6)
    pinRef.current = limpio
    setPin(limpio)
    setError("")
  }

  const agregarDigito = (digito) => {
    if (!bloqueado) actualizarPin(`${pinRef.current}${digito}`)
    inputRef.current?.focus()
  }

  const borrarDigito = () => {
    if (!bloqueado) actualizarPin(pinRef.current.slice(0, -1))
    inputRef.current?.focus()
  }

  const limpiarPin = () => actualizarPin("")

  const enviar = async (event) => {
    event?.preventDefault()
    if (bloqueado || enviandoRef.current || pinRef.current.length !== 6) return

    const pinActual = pinRef.current
    enviandoRef.current = true
    setEnviando(true)
    setError("")
    try {
      await onSubmit(pinActual)
      limpiarPin()
    } catch (apiError) {
      if (apiError?.code === "identificacion_fallida") limpiarPin()
      if (apiError?.code === "pin_espera_activa") {
        const retryAfter = Math.max(1, Number(apiError.retryAfter) || 1)
        setEsperaLocal(Date.now() + retryAfter * 1000)
        setAhora(Date.now())
        limpiarPin()
      }
      setError(apiError?.message || "No se pudo identificar el perfil.")
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  const puntos = useMemo(() => Array.from({ length: 6 }, (_, indice) => indice < pin.length), [pin.length])

  return (
    <form onSubmit={enviar} className="space-y-4">
      <label className="block text-sm font-semibold text-slate-700" htmlFor="perfil-pin">
        PIN de 6 digitos
      </label>
      <input
        ref={inputRef}
        id="perfil-pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={pin}
        onChange={(event) => actualizarPin(event.target.value)}
        disabled={bloqueado}
        maxLength={6}
        aria-describedby="perfil-pin-estado"
        className="sr-only"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        className="flex w-full justify-center gap-3 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
        aria-label={`${pin.length} de 6 digitos ingresados`}
      >
        {puntos.map((completo, indice) => (
          <span key={indice} className={`h-3 w-3 rounded-full ${completo ? "bg-orange-600" : "bg-slate-300"}`} />
        ))}
      </button>

      <div className="grid grid-cols-3 gap-2" aria-label="Teclado numerico">
        {TECLAS.map((tecla) => (
          <button
            key={tecla}
            type="button"
            onClick={() => agregarDigito(tecla)}
            disabled={bloqueado}
            aria-label={`Ingresar ${tecla}`}
            className="rounded-lg border border-slate-300 bg-white py-3 text-lg font-bold text-slate-800 shadow-sm transition hover:border-orange-500 hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
          >
            {tecla}
          </button>
        ))}
        <button
          type="button"
          onClick={borrarDigito}
          disabled={bloqueado}
          aria-label="Borrar ultimo digito"
          className="rounded-lg border border-slate-300 bg-slate-100 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
        >
          Borrar
        </button>
        <button
          type="button"
          onClick={() => agregarDigito("0")}
          disabled={bloqueado}
          aria-label="Ingresar 0"
          className="rounded-lg border border-slate-300 bg-white py-3 text-lg font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
        >
          0
        </button>
        <button
          type="submit"
          disabled={bloqueado || pin.length !== 6}
          aria-label="Confirmar PIN"
          className="rounded-lg bg-orange-600 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50"
        >
          OK
        </button>
      </div>

      <div id="perfil-pin-estado" aria-live="polite" className="min-h-6 text-center text-sm">
        {segundosRestantes > 0 ? (
          <p className="font-medium text-amber-700">Espera {segundosRestantes} s para volver a intentar.</p>
        ) : error ? (
          <p className="font-medium text-red-700">{error}</p>
        ) : enviando ? (
          <p className={theme.fuenteMuted}>Validando perfil...</p>
        ) : null}
      </div>
    </form>
  )
}
