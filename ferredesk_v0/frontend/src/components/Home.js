import { useEffect, useState, useCallback, useMemo, memo } from "react"
import Navbar from "./Navbar"

const cards = [
  {
    label: "Configuración",
    description: "Ajustes del sistema y preferencias",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-7 h-7"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
    iconColor: "text-slate-700",
    gradient: "from-slate-50 to-slate-100/60",
    borderColor: "border-slate-300/50",
    hoverGradient: "hover:from-slate-100 hover:to-slate-200/60",
  },
  {
    label: "Clientes",
    description: "Gestión de clientes y contactos",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-7 h-7"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
        />
      </svg>
    ),
    iconColor: "text-blue-700",
    gradient: "from-blue-50 to-blue-100/60",
    borderColor: "border-blue-300/50",
    hoverGradient: "hover:from-blue-100 hover:to-blue-200/60",
  },
  {
    label: "Presupuestos y Ventas",
    description: "Gestión de ventas y presupuestos",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-7 h-7"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    ),
    iconColor: "text-emerald-700",
    gradient: "from-emerald-50 to-emerald-100/60",
    borderColor: "border-emerald-300/50",
    hoverGradient: "hover:from-emerald-100 hover:to-emerald-200/60",
  },
  {
    label: "Productos",
    description: "Inventario y gestión de productos",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-7 h-7"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
        />
      </svg>
    ),
    iconColor: "text-purple-700",
    gradient: "from-purple-50 to-purple-100/60",
    borderColor: "border-purple-300/50",
    hoverGradient: "hover:from-purple-100 hover:to-purple-200/60",
  },
  {
    label: "Proveedores",
    description: "Gestión de proveedores y compras",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-7 h-7"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
        />
      </svg>
    ),
    iconColor: "text-amber-700",
    gradient: "from-amber-50 to-amber-100/60",
    borderColor: "border-amber-300/50",
    hoverGradient: "hover:from-amber-100 hover:to-amber-200/60",
  },
  {
    label: "Notas",
    description: "Gestión de notas personales",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-7 h-7"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 5.25v13.5c0 .621.504 1.125 1.125 1.125h15.75A1.125 1.125 0 0 0 21 18.75V8.25a.375.375 0 0 0-.111-.264l-5.625-5.625A.375.375 0 0 0 15 2.25H4.125A1.125 1.125 0 0 0 3 3.375Zm12.75-1.5V8.25h5.25"
        />
      </svg>
    ),
    iconColor: "text-yellow-700",
    gradient: "from-yellow-50 to-yellow-100/60",
    borderColor: "border-yellow-300/50",
    hoverGradient: "hover:from-yellow-100 hover:to-yellow-200/60",
  },
]

const SITUACION_IVA_LABELS = {
  RI: "Responsable Inscripto",
  MO: "Monotributista",
}

// Función para obtener el valor de una cookie por nombre
function getCookie(name) {
  let cookieValue = null
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";")
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim()
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1))
        break
      }
    }
  }
  return cookieValue
}

// Tarjeta individual del panel principal, memoizada para evitar renders innecesarios
const TarjetaDashboard = memo(function TarjetaDashboard({ card, onClick }) {
  return (
    <div
      className={`bg-gradient-to-br ${card.gradient} rounded-2xl border ${card.borderColor} overflow-hidden cursor-pointer transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-2 ${card.hoverGradient} ring-1 ring-slate-200/50`}
      onClick={() => onClick(card.label)}
    >
      <div className="p-5">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center ${card.iconColor} bg-white/90 shadow-lg mb-4 transition-transform duration-300 hover:scale-110 ring-1 ring-slate-200/30`}
        >
          {card.icon}
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2 leading-tight">{card.label}</h3>
        <p className="text-slate-600 text-sm leading-relaxed">{card.description}</p>
      </div>
      <div className="px-5 py-3 bg-white/70 border-t border-white/60">
        <span className="text-sm font-semibold text-slate-700 flex items-center group">
          Acceder
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1 text-orange-600"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </span>
      </div>
    </div>
  )
})

const Home = () => {
  const [user, setUser] = useState(null)
  const [ferreteria, setFerreteria] = useState(null)
  const [editIva, setEditIva] = useState(false)
  const [newIva, setNewIva] = useState("RI")
  const [loadingIva, setLoadingIva] = useState(false)
  const [feedback, setFeedback] = useState("")

  useEffect(() => {
    document.title = "Panel Principal FerreDesk"
  }, [])

  useEffect(() => {
    fetch("/api/user/", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") setUser(data.user)
      })
    fetch("/api/ferreteria/", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.situacion_iva) {
          setFerreteria(data)
          setNewIva(data.situacion_iva)
        }
      })
  }, [])

  const handleCardClick = useCallback((label) => {
    if (label === "Clientes") {
      window.open("/dashboard/clientes", "_blank")
    }
    if (label === "Productos") {
      window.open("/dashboard/productos", "_blank")
    }
    if (label === "Proveedores") {
      window.open("/dashboard/proveedores", "_blank")
    }
    if (label === "Presupuestos y Ventas") {
      window.open("/dashboard/presupuestos", "_blank")
    }
    if (label === "Notas") {
      window.open("/dashboard/notas", "_blank")
    }
    // Puedes agregar navegación para otras tarjetas aquí
  }, [])

  const handleLogout = useCallback(() => {
    setUser(null)
    window.location.href = "/login"
  }, [])

  const handleIvaChange = async () => {
    if (
      !window.confirm(
        "¿Estás seguro de cambiar la situación fiscal del negocio? Esto afectará la emisión de comprobantes.",
      )
    )
      return
    setLoadingIva(true)
    setFeedback("")
    try {
      const csrftoken = getCookie("csrftoken")
      const res = await fetch("/api/ferreteria/", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrftoken,
        },
        credentials: "include",
        body: JSON.stringify({ situacion_iva: newIva }),
      })
      if (!res.ok) throw new Error("Error al actualizar situación fiscal")
      const data = await res.json()
      setFerreteria(data)
      setEditIva(false)
      setFeedback("Situación fiscal actualizada correctamente.")
    } catch (e) {
      setFeedback("Error al actualizar situación fiscal.")
    } finally {
      setLoadingIva(false)
    }
  }

  // Memoizo la lista de tarjetas para que no se regenere en cada render
  const tarjetasUI = useMemo(
    () => cards.map((card) => <TarjetaDashboard key={card.label} card={card} onClick={handleCardClick} />),
    [handleCardClick],
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative">
      {/* Patrón de textura sutil */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)`,
          backgroundSize: "20px 20px",
        }}
      ></div>

      {/* Gradiente adicional para profundidad */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-300/20 via-transparent to-slate-100/30"></div>

      <div className="relative z-10">
        <Navbar user={user} onLogout={handleLogout} />

        <div className="container mx-auto px-6 py-8">
          <h2 className="text-3xl font-extrabold text-slate-800 text-center mb-8 drop-shadow-sm">Panel Principal</h2>

          <div className="flex flex-col md:flex-row">
            {/* Main content - Cards */}
            <div className="flex-grow">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">{tarjetasUI}</div>
            </div>
          </div>

          {/* Situación fiscal - positioned at bottom right */}
          {user && user.is_staff && ferreteria && (
            <div className="fixed bottom-6 right-6 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-300/60 p-5 max-w-xs ring-1 ring-slate-200/50">
              <div className="flex flex-col">
                <div>
                  <h3 className="text-base font-semibold text-slate-800">Situación Fiscal</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Actual:{" "}
                    <span className="font-semibold text-orange-700">
                      {SITUACION_IVA_LABELS[ferreteria.situacion_iva] || ferreteria.situacion_iva}
                    </span>
                  </p>
                </div>

                {editIva ? (
                  <div className="mt-3 space-y-3">
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-800 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                      value={newIva}
                      onChange={(e) => setNewIva(e.target.value)}
                      disabled={loadingIva}
                    >
                      <option value="RI">Responsable Inscripto</option>
                      <option value="MO">Monotributista</option>
                    </select>
                    <div className="flex space-x-2">
                      <button
                        className="px-3 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all duration-200 text-sm font-semibold flex-1 shadow-lg hover:shadow-xl"
                        onClick={handleIvaChange}
                        disabled={loadingIva}
                      >
                        {loadingIva ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        className="px-3 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all duration-200 text-sm font-semibold"
                        onClick={() => {
                          setEditIva(false)
                          setNewIva(ferreteria.situacion_iva)
                        }}
                        disabled={loadingIva}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="mt-3 px-3 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl"
                    onClick={() => setEditIva(true)}
                  >
                    Cambiar Situación Fiscal
                  </button>
                )}

                {feedback && (
                  <div
                    className={`mt-3 text-sm font-medium ${feedback.includes("Error") ? "text-red-600" : "text-emerald-600"}`}
                  >
                    {feedback}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Home;
