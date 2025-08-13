"use client"

import { useState, useEffect, memo } from "react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

// --- Constantes y Componentes Auxiliares Extraídos ---

// Constantes de clases para un estilo consistente y fácil de mantener
const CLASES_SECCION_TITULO = "mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-slate-700"
const CLASES_SECCION_WRAPPER = "p-2 bg-slate-50 rounded-lg border border-slate-200 min-w-[260px]"

// Chip de estado (memoizado)
const ChipEstado = memo(({ activo }) => (
  <span className={`px-2 py-0.5 rounded-full text-[11px] ${activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
    {activo ? "Activo" : "Inactivo"}
  </span>
))

// Contenedor de sección estilo lista (memoizado)
const SeccionLista = memo(({ titulo, icono, children }) => (
  <div className={CLASES_SECCION_WRAPPER}>
    <h5 className={CLASES_SECCION_TITULO}>
      {icono} {titulo}
    </h5>
    <div className="divide-y divide-slate-200">
      {children}
    </div>
  </div>
))

// Función para generar clases de input con el tema
const getInputClasses = (theme) => `w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500`

// Fila editable con etiqueta e input (memoizada)
const FilaEditable = memo(({ etiqueta, children, inputProps, value, onChange }) => {
  const theme = useFerreDeskTheme()
  const CLASES_INPUT = getInputClasses(theme)
  
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-slate-700">{etiqueta}</span>
      </div>
      <div className="min-w-[180px] text-right">
        {children ? children : (
          <input className={`${CLASES_INPUT} text-right`} {...inputProps} value={value ?? ""} onChange={onChange} />
        )}
      </div>
    </div>
  )
})

const VendedorForm = ({ initialData = {}, onSave, onCancel, loading, error, localidades = [] }) => {
  const [form, setForm] = useState({
    nombre: '',
    domicilio: '',
    dni: '',
    tel: '',
    comivta: '0',
    liquivta: 'S',
    comicob: '0',
    liquicob: 'S',
    localidad: '',
    activo: 'S',
    ...initialData
  });

  // Hook para el tema de FerreDesk
  const theme = useFerreDeskTheme()

  useEffect(() => {
    const sanitizedInitialData = { ...initialData };
    if (typeof sanitizedInitialData.comivta === 'number') {
      sanitizedInitialData.comivta = String(sanitizedInitialData.comivta);
    }
    if (typeof sanitizedInitialData.comicob === 'number') {
      sanitizedInitialData.comicob = String(sanitizedInitialData.comicob);
    }
    setForm(f => ({ ...f, ...sanitizedInitialData }));
  }, [initialData]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    const dataToSave = {
        ...form,
        comivta: parseFloat(form.comivta) || 0,
        comicob: parseFloat(form.comicob) || 0,
    };
    onSave(dataToSave);
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30 p-4">
      <div className="w-full max-w-none">
        <form
          className="w-full bg-white rounded-2xl shadow-md border border-slate-200/50 relative overflow-hidden"
          onSubmit={handleSubmit}
        >
          {/* Gradiente decorativo superior */}
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.primario}`}></div>

          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-lg`}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">
                  {initialData?.id ? 'Editar Vendedor' : 'Nuevo Vendedor'}
                </h3>
              </div>

              {/* Mensajes de error */}
              {error && (
                <div className="mb-3 p-3 bg-red-50 border-l-4 border-red-500 text-red-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {typeof error === 'object' ? JSON.stringify(error) : error}
                  </div>
                </div>
              )}
            </div>

            {/* Header compacto con nombre y chip de estado */}
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800 truncate" title={form.nombre}>
                {form.nombre || "Nuevo Vendedor"}
              </div>
              <ChipEstado activo={form.activo === "S"} />
            </div>

            {/* Tarjetas horizontales al estilo del detalle */}
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              {/* Tarjeta Información Personal */}
              <SeccionLista
                titulo="Información Personal"
                icono={<svg className={`w-4 h-4 ${theme.iconoNaranja}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
              >
                <FilaEditable etiqueta="Nombre *" inputProps={{ name: "nombre", required: true }} value={form.nombre} onChange={handleChange} />
                <FilaEditable etiqueta="DNI *" inputProps={{ name: "dni", required: true }} value={form.dni} onChange={handleChange} />
                <FilaEditable etiqueta="Domicilio" inputProps={{ name: "domicilio" }} value={form.domicilio} onChange={handleChange} />
                <FilaEditable etiqueta="Teléfono" inputProps={{ name: "tel" }} value={form.tel} onChange={handleChange} />
              </SeccionLista>

              {/* Tarjeta Comisiones */}
              <SeccionLista
                titulo="Comisiones"
                icono={<svg className={`w-4 h-4 ${theme.iconoNaranja}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2" /></svg>}
              >
                <FilaEditable etiqueta="Comisión Venta (%) *" inputProps={{ name: "comivta", type: "number", step: "0.01", min: "0", required: true }} value={form.comivta} onChange={handleChange} />
                                 <FilaEditable etiqueta="Liquida Com. Venta *">
                   <select name="liquivta" value={form.liquivta} onChange={handleChange} className={getInputClasses(theme)} required>
                     <option value="S">Sí</option>
                     <option value="N">No</option>
                   </select>
                 </FilaEditable>
                <FilaEditable etiqueta="Comisión Cobranza (%) *" inputProps={{ name: "comicob", type: "number", step: "0.01", min: "0", required: true }} value={form.comicob} onChange={handleChange} />
                                 <FilaEditable etiqueta="Liquida Com. Cobranza *">
                   <select name="liquicob" value={form.liquicob} onChange={handleChange} className={getInputClasses(theme)} required>
                     <option value="S">Sí</option>
                     <option value="N">No</option>
                   </select>
                 </FilaEditable>
              </SeccionLista>

              {/* Tarjeta Ubicación y Estado */}
              <SeccionLista
                titulo="Ubicación y Estado"
                icono={<svg className={`w-4 h-4 ${theme.iconoNaranja}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              >
                                 <FilaEditable etiqueta="Localidad *">
                   <select name="localidad" value={form.localidad} onChange={handleChange} className={getInputClasses(theme)} required>
                     <option value="">Seleccionar...</option>
                     {localidades.map(l => (
                       <option key={l.id} value={l.id}>{l.nombre}</option>
                     ))}
                   </select>
                 </FilaEditable>
                                 <FilaEditable etiqueta="Estado *">
                   <select name="activo" value={form.activo} onChange={handleChange} className={getInputClasses(theme)} required>
                     <option value="S">Activo</option>
                     <option value="N">Inactivo</option>
                   </select>
                 </FilaEditable>
              </SeccionLista>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-300 font-medium shadow-sm hover:shadow-md"
              >
                Cancelar
              </button>
                             <button
                 type="submit"
                 disabled={loading}
                 className={`px-6 py-3 ${theme.botonPrimario} rounded-xl disabled:opacity-50 disabled:cursor-not-allowed`}
               >
                {loading ? 'Guardando...' : (initialData?.id ? 'Actualizar Vendedor' : 'Crear Vendedor')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VendedorForm; 