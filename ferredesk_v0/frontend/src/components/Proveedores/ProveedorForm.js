"use client"

import React, { useState, useEffect, memo } from "react";
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme";

// --- Constantes y Componentes Auxiliares Extraídos ---

// Constantes de clases para un estilo consistente y fácil de mantener
const CLASES_SECCION_TITULO = "mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-slate-700"
const CLASES_SECCION_WRAPPER = "p-2 bg-slate-50 rounded-lg border border-slate-200 min-w-[260px]"

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

export default function ProveedorForm({ onSave, onCancel, initialData, formError }) {
  const [form, setForm] = useState(initialData || {
    razon: '',
    fantasia: '',
    domicilio: '',
    impsalcta: '',
    fecsalcta: '',
    sigla: '',
    tel1: '',
    cuit: ''
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Hook para el tema de FerreDesk
  const theme = useFerreDeskTheme()

  useEffect(() => {
    if (initialData) setForm(initialData);
  }, [initialData]);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.razon.trim() || !form.fantasia.trim() || !form.domicilio.trim() || !form.impsalcta || !form.fecsalcta || !form.sigla.trim()) {
      setError("Todos los campos obligatorios deben estar completos");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
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
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">
                  {initialData ? "Editar Proveedor" : "Nuevo Proveedor"}
                </h3>
              </div>

              {/* Mensajes de error */}
              {(error || formError) && (
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
                    {error || formError}
                  </div>
                </div>
              )}
            </div>

            {/* Header compacto con nombre y código */}
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800 truncate" title={form.razon}>
                {form.razon || "Nuevo Proveedor"}
              </div>
              
            </div>

            {/* Tarjetas horizontales al estilo del detalle */}
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              {/* Tarjeta Información Básica */}
              <SeccionLista
                titulo="Información Básica"
                icono={<svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
              >
                <FilaEditable etiqueta="Sigla (3 letras) *" inputProps={{ name: "sigla", maxLength: 3, required: true }} value={form.sigla} onChange={handleChange} />
                <FilaEditable etiqueta="Razón Social *" inputProps={{ name: "razon", required: true }} value={form.razon} onChange={handleChange} />
                <FilaEditable etiqueta="Nombre Fantasía *" inputProps={{ name: "fantasia", required: true }} value={form.fantasia} onChange={handleChange} />
              </SeccionLista>

              {/* Tarjeta Información de Contacto */}
              <SeccionLista
                titulo="Información de Contacto"
                icono={<svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
              >
                <FilaEditable etiqueta="Domicilio *" inputProps={{ name: "domicilio", required: true }} value={form.domicilio} onChange={handleChange} />
                <FilaEditable etiqueta="Teléfono" inputProps={{ name: "tel1" }} value={form.tel1} onChange={handleChange} />
                <FilaEditable etiqueta="CUIT" inputProps={{ name: "cuit" }} value={form.cuit} onChange={handleChange} />
              </SeccionLista>

              {/* Tarjeta Información Financiera */}
              <SeccionLista
                titulo="Información Financiera"
                icono={<svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2" /></svg>}
              >
                <FilaEditable etiqueta="Importe Saldo Cuenta *" inputProps={{ name: "impsalcta", type: "number", step: "0.01", required: true }} value={form.impsalcta} onChange={handleChange} />
                <FilaEditable etiqueta="Fecha Saldo Cuenta *" inputProps={{ name: "fecsalcta", type: "date", required: true }} value={form.fecsalcta} onChange={handleChange} />
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
                disabled={saving}
                className={`px-6 py-3 ${theme.botonPrimario} rounded-xl disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saving ? 'Guardando...' : (initialData ? "Guardar Cambios" : "Crear Proveedor")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
