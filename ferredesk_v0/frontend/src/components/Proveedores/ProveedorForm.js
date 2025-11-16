"use client"

import React, { useState, useEffect, memo, useRef, useCallback } from "react";
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme";
import useNavegacionForm from "../../hooks/useNavegacionForm";
import CUITValidacionTooltip from "../Clientes/CUITValidacionTooltip";
import useValidacionCUITProveedores from "../../utils/useValidacionCUITProveedores";
import { useFerreteriaAPI } from "../../utils/useFerreteriaAPI";

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
  // Hook para obtener configuración de ferretería
  const { ferreteria } = useFerreteriaAPI();
  
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
  const errorMostradoRef = useRef(false);
  const formErrorAnteriorRef = useRef(null);

  // Hook para navegación entre campos con Enter
  const { getFormProps } = useNavegacionForm();

  // Hook para validación de CUIT con padrón ARCA
  const { 
    resultado, 
    isLoading: isLoadingCUIT, 
    error: errorCUIT, 
    mostrarTooltip, 
    handleCUITBlur, 
    limpiarResultado, 
    toggleTooltip,
    // Estados y funciones de ARCA
    datosARCA,
    errorARCA,
    limpiarEstadosARCA
  } = useValidacionCUITProveedores()

  // Estado para trackear campos autocompletados por ARCA
  const [camposAutocompletados, setCamposAutocompletados] = useState({
    razon: false,
    fantasia: false,
    domicilio: false,
    cpostal: false,
    localidad: false
  })

  const LONGITUD_CUIT_COMPLETO = 11;

  // Constante para determinar si estamos en modo PRODUCCION
  const MODO_PRODUCCION = 'PROD';
  const esModoProduccion = ferreteria?.modo_arca === MODO_PRODUCCION;

  // Ref para conocer el CUIT actual dentro de efectos sin agregar dependencias
  const cuitActualRef = useRef(form.cuit)
  useEffect(() => { cuitActualRef.current = form.cuit }, [form.cuit])

  // Hook para el tema de FerreDesk
  const theme = useFerreDeskTheme()

  useEffect(() => {
    if (initialData) setForm({ ...initialData, acti: initialData.acti ?? 'S' });
  }, [initialData]);

  // Mostrar alert nativo solo cuando cambia el error o formError (evita spam en renders)
  useEffect(() => {
    const mensajeError = error || formError;
    
    // Solo mostrar alert si hay un error y es diferente al que ya se mostró
    if (mensajeError) {
      // Si es formError, verificar si ya se mostró este mismo mensaje
      if (formError && formError === formErrorAnteriorRef.current) {
        return; // Ya se mostró este formError, no volver a mostrar
      }
      
      // Si hay un error nuevo (error local) o formError nuevo, mostrar alert
      if (error || (formError && formError !== formErrorAnteriorRef.current)) {
        window.alert(`Error: ${mensajeError}`);
        // Guardar referencia del formError mostrado para evitar duplicados
        if (formError) {
          formErrorAnteriorRef.current = formError;
        }
        // Marcar que se mostró un error
        errorMostradoRef.current = true;
      }
    } else {
      // Limpiar flags cuando no hay errores
      errorMostradoRef.current = false;
      formErrorAnteriorRef.current = null;
    }
  }, [error, formError]);


  const limpiarSoloNumeros = useCallback((valor) => String(valor || '').replace(/\D/g, ''), []);

  // Función para autocompletar campos con datos de ARCA
  const autocompletarCampos = useCallback((datos) => {
    if (!datos) return
    
    setForm(prev => {
      const nuevosDatos = { ...prev }
      const nuevosCamposAutocompletados = { ...camposAutocompletados }
      
      // Campos de texto simple (autocompletado directo - SIEMPRE sobreescribir)
      if (datos.razon) {
        nuevosDatos.razon = datos.razon
        nuevosCamposAutocompletados.razon = true
      }
      if (datos.fantasia) {
        nuevosDatos.fantasia = datos.fantasia
        nuevosCamposAutocompletados.fantasia = true
      }
      if (datos.domicilio) {
        nuevosDatos.domicilio = datos.domicilio
        nuevosCamposAutocompletados.domicilio = true
      }
      if (datos.cpostal) {
        nuevosDatos.cpostal = datos.cpostal
        nuevosCamposAutocompletados.cpostal = true
      }
      if (datos.localidad) {
        nuevosDatos.localidad = datos.localidad
        nuevosCamposAutocompletados.localidad = true
      }
      
      // Actualizar el estado de campos autocompletados
      setCamposAutocompletados(nuevosCamposAutocompletados)
      
      return nuevosDatos
    })
  }, [camposAutocompletados, setForm, setCamposAutocompletados])

  // Mantener una referencia estable a la función de autocompletado para evitar dependencias en efectos
  const autocompletarCamposRef = useRef(autocompletarCampos)
  useEffect(() => { autocompletarCamposRef.current = autocompletarCampos }, [autocompletarCampos])

  // Efecto para autocompletar cuando llegan datos de ARCA
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (datosARCA && !errorARCA) {
      const lenCuit = String(cuitActualRef.current || '').length
      if (lenCuit !== LONGITUD_CUIT_COMPLETO) {
        return
      }
      autocompletarCamposRef.current(datosARCA)
      
      // Limpiar el mensaje de éxito después de 3 segundos
      const timer = setTimeout(() => {
        limpiarEstadosARCA()
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [datosARCA, errorARCA, limpiarEstadosARCA])

  const handleChange = e => {
    // Limpiar errores cuando el usuario modifica campos
    if (error) {
      setError("");
    }
    
    const { name, value } = e.target;
    if (name === 'cuit') {
      // Solo números y hasta 11 dígitos
      const soloNumeros = limpiarSoloNumeros(value).slice(0, LONGITUD_CUIT_COMPLETO);
      
      // Si el CUIT tenía longitud completa y el usuario modifica/borra un dígito,
      // limpiar Razón Social, Fantasía y Domicilio SIEMPRE (hayan sido autocompletados o no).
      setForm(prev => {
        const cuitPrevio = prev.cuit || ""
        const teniaCuitCompleto = cuitPrevio.length === LONGITUD_CUIT_COMPLETO
        const seModificoElCuit = soloNumeros !== cuitPrevio
        const nuevoEstado = { ...prev, cuit: soloNumeros }
        if (teniaCuitCompleto && seModificoElCuit) {
          nuevoEstado.razon = ""
          nuevoEstado.fantasia = ""
          nuevoEstado.domicilio = ""
          nuevoEstado.cpostal = ""
          nuevoEstado.localidad = ""
        }
        return nuevoEstado
      })
      
      // Reiniciar flags de autocompletado tras el cambio de CUIT
      setCamposAutocompletados({
        razon: false,
        fantasia: false,
        domicilio: false,
        cpostal: false,
        localidad: false
      })
      
      // Limpiar estados/datos de ARCA para que no vuelvan a autocompletar inmediatamente
      limpiarEstadosARCA()
      // Limpiar resultado de validación del CUIT para evitar usar un estado viejo
      limpiarResultado()
      // Quitar mensaje nativo si lo había
      if (cuitInputRef.current) {
        try { cuitInputRef.current.setCustomValidity("") } catch (_) {}
      }
      return;
    }
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    // Confirmación de guardado
    const confirmar = window.confirm("¿Desea guardar los cambios del proveedor?");
    if (!confirmar) {
      return;
    }
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
    
    // Si ingresaron 11 dígitos de CUIT y el verificador es inválido, no permitir guardar
    const cuitTieneOnce = String(form.cuit || '').length === LONGITUD_CUIT_COMPLETO
    if (cuitTieneOnce && resultado && resultado.es_valido === false) {
      // Mostrar mensaje nativo en el input de CUIT
      if (cuitInputRef.current) {
        try {
          cuitInputRef.current.setCustomValidity("El CUIT ingresado es inválido.")
          cuitInputRef.current.reportValidity()
        } catch (_) {}
      }
      return
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
          {...getFormProps()}
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
                        onBlur={(e) => { if (!initialData) { handleCUITBlur(e.target.value) } }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !initialData) { handleCUITBlur(e.target.value) } }}
                        maxLength={LONGITUD_CUIT_COMPLETO}
                        className={`${getInputClasses(theme)} h-full pr-8 text-right`}
                        ref={cuitInputRef}
                        disabled={!!initialData}
                        required
                      />
                      <div className="absolute top-0 right-2 h-full flex items-center">
                        {((resultado && !isLoadingCUIT && !errorCUIT) || (errorARCA && errorARCA.trim() !== '')) ? (
                          <button
                            type="button"
                            onClick={toggleTooltip}
                            className={`transition-colors ${((errorARCA && errorARCA.trim() !== '') || (resultado && !resultado.es_valido)) ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                            title={((errorARCA && errorARCA.trim() !== '') || (resultado && !resultado.es_valido)) ? 'Error en CUIT/ARCA' : 'CUIT válido'}
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              {((errorARCA && errorARCA.trim() !== '') || (resultado && !resultado.es_valido)) ? (
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              ) : (
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              )}
                            </svg>
                          </button>
                        ) : (<div className="w-4 h-4"></div>)}
                      </div>
                      {(resultado || (errorARCA && errorARCA.trim() !== '')) && (
                        <CUITValidacionTooltip
                          resultado={resultado}
                          onIgnorar={limpiarResultado}
                          isLoading={isLoadingCUIT}
                          error={errorCUIT}
                          mostrarTooltip={mostrarTooltip}
                          onToggle={toggleTooltip}
                          errorARCA={errorARCA}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <FilaEditable etiqueta="Sigla (3 letras) *" inputProps={{ name: "sigla", maxLength: 3, required: true }} value={form.sigla} onChange={handleChange} />
                <FilaEditable etiqueta="Razón Social *" inputProps={{ name: "razon", required: true, disabled: !!initialData || (esModoProduccion && (camposAutocompletados.razon || String(form.cuit || '').length === LONGITUD_CUIT_COMPLETO)), title: !!initialData ? 'La Razón Social no es editable' : (esModoProduccion && camposAutocompletados.razon ? 'Campo autocompletado por ARCA' : undefined) }} value={form.razon} onChange={handleChange} />
                <FilaEditable etiqueta="Nombre Fantasía *" inputProps={{ name: "fantasia", required: true, disabled: esModoProduccion && (camposAutocompletados.fantasia || String(form.cuit || '').length === LONGITUD_CUIT_COMPLETO), title: esModoProduccion && camposAutocompletados.fantasia ? 'Campo autocompletado por ARCA' : undefined }} value={form.fantasia} onChange={handleChange} />
              </SeccionLista>

              {/* Tarjeta Información de Contacto */}
              <SeccionLista
                titulo="Información de Contacto y Estado"
                icono={<svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
              >
                <FilaEditable etiqueta="Domicilio *" inputProps={{ name: "domicilio", required: true, disabled: esModoProduccion && (camposAutocompletados.domicilio || String(form.cuit || '').length === LONGITUD_CUIT_COMPLETO), title: esModoProduccion && camposAutocompletados.domicilio ? 'Campo autocompletado por ARCA' : undefined }} value={form.domicilio} onChange={handleChange} />
                <FilaEditable etiqueta="Teléfono" inputProps={{ name: "tel1" }} value={form.tel1} onChange={handleChange} />
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
                onClick={() => {
                  const confirmar = window.confirm("¿Desea cancelar y descartar los cambios?");
                  if (!confirmar) return;
                  onCancel();
                }}
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
