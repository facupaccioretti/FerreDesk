"use client"

import React, { useState, useEffect, memo, useRef, useCallback } from "react";
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme";
import CUITValidacionTooltip from "../Clientes/CUITValidacionTooltip";

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
    cuit: '',
    acti: 'S',
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const cuitInputRef = useRef(null);

  // Estados de validación local de CUIT (sin padrón)
  const [resultadoCUIT, setResultadoCUIT] = useState(null); // { es_valido: boolean, mensaje_error?: string }
  const [errorCUIT, setErrorCUIT] = useState(null);
  const [mostrarTooltipCUIT, setMostrarTooltipCUIT] = useState(false);

  const LONGITUD_CUIT_COMPLETO = 11;

  // Hook para el tema de FerreDesk
  const theme = useFerreDeskTheme()

  useEffect(() => {
    if (initialData) setForm({ ...initialData, acti: initialData.acti ?? 'S' });
  }, [initialData]);

  const limpiarSoloNumeros = useCallback((valor) => String(valor || '').replace(/\D/g, ''), []);

  const calcularDigitoVerificadorCUIT = useCallback((cuitNumerico) => {
    // Requiere 11 dígitos
    if (!/^\d{11}$/.test(cuitNumerico)) {
      return { es_valido: false, mensaje_error: "El CUIT debe tener exactamente 11 dígitos." };
    }
    const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const digitos = cuitNumerico.split('').map(d => parseInt(d, 10));
    const verificadorInformado = digitos[10];
    let suma = 0;
    for (let i = 0; i < 10; i += 1) {
      suma += digitos[i] * pesos[i];
    }
    const resto = suma % 11;
    let verificadorCalculado = 11 - resto;
    if (verificadorCalculado === 11) verificadorCalculado = 0;
    if (verificadorCalculado === 10) verificadorCalculado = 9;

    if (verificadorCalculado !== verificadorInformado) {
      return { es_valido: false, mensaje_error: "El dígito verificador del CUIT no coincide." };
    }
    return { es_valido: true };
  }, []);

  const validarCUITLocal = useCallback((valor) => {
    const cuitLimpio = limpiarSoloNumeros(valor);
    if (!cuitLimpio) {
      setResultadoCUIT(null);
      setErrorCUIT(null);
      return;
    }
    const res = calcularDigitoVerificadorCUIT(cuitLimpio);
    setResultadoCUIT(res);
    setErrorCUIT(res.es_valido ? null : (res.mensaje_error || "CUIT inválido"));
    if (cuitInputRef.current) {
      try {
        cuitInputRef.current.setCustomValidity(res.es_valido ? "" : (res.mensaje_error || "CUIT inválido"));
      } catch (_) {}
    }
  }, [calcularDigitoVerificadorCUIT, limpiarSoloNumeros]);

  const handleCUITBlur = useCallback((valor) => {
    validarCUITLocal(valor);
  }, [validarCUITLocal]);

  const handleCUITKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      validarCUITLocal(e.target.value);
    }
  }, [validarCUITLocal]);

  const toggleTooltipCUIT = useCallback(() => {
    setMostrarTooltipCUIT(prev => !prev);
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    if (name === 'cuit') {
      // Solo números y hasta 11 dígitos
      const soloNumeros = limpiarSoloNumeros(value).slice(0, LONGITUD_CUIT_COMPLETO);
      setForm({ ...form, cuit: soloNumeros });
      // Al cambiar, limpiar validación previa hasta blur/enter
      setResultadoCUIT(null);
      setErrorCUIT(null);
      if (cuitInputRef.current) {
        try { cuitInputRef.current.setCustomValidity(""); } catch (_) {}
      }
      return;
    }
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.razon.trim() || !form.fantasia.trim() || !form.domicilio.trim() || !form.impsalcta || !form.fecsalcta || !form.sigla.trim()) {
      setError("Todos los campos obligatorios deben estar completos");
      return;
    }
    // Validar CUIT obligatorio y con dígito verificador correcto
    const cuitLimpio = limpiarSoloNumeros(form.cuit);
    if (!cuitLimpio || cuitLimpio.length !== LONGITUD_CUIT_COMPLETO) {
      setError("El CUIT es obligatorio y debe tener 11 dígitos.");
      if (cuitInputRef.current) {
        try { cuitInputRef.current.setCustomValidity("El CUIT es obligatorio y debe tener 11 dígitos."); cuitInputRef.current.reportValidity(); } catch (_) {}
      }
      return;
    }
    const resCUIT = calcularDigitoVerificadorCUIT(cuitLimpio);
    if (!resCUIT.es_valido) {
      setError(resCUIT.mensaje_error || "El CUIT ingresado es inválido.");
      if (cuitInputRef.current) {
        try { cuitInputRef.current.setCustomValidity(resCUIT.mensaje_error || "El CUIT ingresado es inválido."); cuitInputRef.current.reportValidity(); } catch (_) {}
      }
      setResultadoCUIT(resCUIT);
      setErrorCUIT(resCUIT.mensaje_error || "CUIT inválido");
      setMostrarTooltipCUIT(true);
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
                <FilaEditable etiqueta="Estado">
                  <select
                    name="acti"
                    value={form.acti ?? 'S'}
                    onChange={handleChange}
                    className={`${getInputClasses(theme)} h-8`}
                  >
                    <option value="S">Activo</option>
                    <option value="N">Inactivo</option>
                  </select>
                </FilaEditable>
              </SeccionLista>

              {/* Tarjeta Información de Contacto */}
              <SeccionLista
                titulo="Información de Contacto"
                icono={<svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
              >
                <FilaEditable etiqueta="Domicilio *" inputProps={{ name: "domicilio", required: true }} value={form.domicilio} onChange={handleChange} />
                <FilaEditable etiqueta="Teléfono" inputProps={{ name: "tel1" }} value={form.tel1} onChange={handleChange} />
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-700">CUIT</span>
                  </div>
                  <div className="min-w-[180px] text-right">
                    <div className="relative h-[34px]">
                      <input
                        name="cuit"
                        value={form.cuit}
                        onChange={handleChange}
                        onBlur={(e) => handleCUITBlur(e.target.value)}
                        onKeyDown={handleCUITKeyDown}
                        maxLength={LONGITUD_CUIT_COMPLETO}
                        className={`${getInputClasses(theme)} h-full pr-8 text-right`}
                        ref={cuitInputRef}
                        disabled={!!initialData}
                        required
                      />
                      <div className="absolute top-0 right-2 h-full flex items-center">
                        {resultadoCUIT && (
                          <button
                            type="button"
                            onClick={toggleTooltipCUIT}
                            className={`transition-colors ${resultadoCUIT.es_valido ? 'text-green-600 hover:text-green-800' : 'text-red-600 hover:text-red-800'}`}
                            title={resultadoCUIT.es_valido ? 'CUIT válido' : 'CUIT inválido'}
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              {resultadoCUIT.es_valido ? (
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              ) : (
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              )}
                            </svg>
                          </button>
                        )}
                      </div>
                      {resultadoCUIT && (
                        <CUITValidacionTooltip
                          resultado={resultadoCUIT}
                          onIgnorar={() => { setResultadoCUIT(null); setErrorCUIT(null); setMostrarTooltipCUIT(false); }}
                          isLoading={false}
                          error={errorCUIT}
                          mostrarTooltip={mostrarTooltipCUIT}
                          onToggle={toggleTooltipCUIT}
                          errorARCA={null}
                        />
                      )}
                    </div>
                  </div>
                </div>
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
