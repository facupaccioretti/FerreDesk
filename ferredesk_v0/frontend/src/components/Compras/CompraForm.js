"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import ItemsGridCompras from "./ItemsGridCompras"
import BuscadorProductoCompras from "./BuscadorProductoCompras"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

// Letras permitidas para comprobantes de compras
const LETRAS_COMPROBANTE_PERMITIDAS = ["A", "C", "X"]

const CompraForm = ({
  onSave,
  onCancel,
  initialData,
  readOnly = false,
  proveedores = [],
  productos = [],
  alicuotas = [],
  sucursales = [],
  loadingProveedores,
  loadingProductos,
  loadingAlicuotas,
  errorProveedores,
  errorProductos,
  errorAlicuotas,
}) => {
  const [formData, setFormData] = useState({
    comp_sucursal: sucursales[0]?.id || 1,
    comp_fecha: new Date().toISOString().split("T")[0],
    comp_numero_factura: "",
    comp_tipo: "COMPRA",
    comp_idpro: "",
    comp_cuit: "",
    comp_razon_social: "",
    comp_domicilio: "",
    comp_observacion: "",
    comp_total_final: 0,
    comp_importe_neto: 0,
    comp_iva_21: 0,
    comp_iva_10_5: 0,
    comp_iva_27: 0,
    comp_iva_0: 0,
    comp_estado: "BORRADOR",
    items_data: [],
  })

  // Estado para N° de factura inteligente
  const [factura, setFactura] = useState({ letra: LETRAS_COMPROBANTE_PERMITIDAS[0], pv: "", numero: "" })
  const pvRef = useRef(null)
  const numeroRef = useRef(null)

  const [selectedProveedor, setSelectedProveedor] = useState(null)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const itemsGridRef = useRef(null)

  // Hook para el tema de FerreDesk
  const theme = useFerreDeskTheme()

  // Helper para construir el string completo
  const buildNumeroFactura = useCallback((letra, pv, numero) => {
    const pvFmt = (pv || "").toString().slice(0, 4).padStart(4, "0")
    const numFmt = (numero || "").toString().slice(0, 8).padStart(8, "0")
    return `${(letra || "A").toString().toUpperCase()}-${pvFmt}-${numFmt}`
  }, [])

  const updateNumeroFacturaInForm = useCallback((nextFactura) => {
    const composed = buildNumeroFactura(nextFactura.letra, nextFactura.pv, nextFactura.numero)
    setFormData((prev) => ({ ...prev, comp_numero_factura: composed }))
  }, [buildNumeroFactura])

  useEffect(() => {
    if (initialData) {
      setFormData({
        comp_sucursal: initialData.comp_sucursal || sucursales[0]?.id || 1,
        comp_fecha: initialData.comp_fecha || new Date().toISOString().split("T")[0],
        comp_numero_factura: initialData.comp_numero_factura || "",
        comp_tipo: initialData.comp_tipo || "COMPRA",
        comp_idpro: initialData.comp_idpro || "",
        comp_cuit: initialData.comp_cuit || "",
        comp_razon_social: initialData.comp_razon_social || "",
        comp_domicilio: initialData.comp_domicilio || "",
        comp_observacion: initialData.comp_observacion || "",
        comp_total_final: initialData.comp_total_final || 0,
        comp_importe_neto: initialData.comp_importe_neto || 0,
        comp_iva_21: initialData.comp_iva_21 || 0,
        comp_iva_10_5: initialData.comp_iva_10_5 || 0,
        comp_iva_27: initialData.comp_iva_27 || 0,
        comp_iva_0: initialData.comp_iva_0 || 0,
        comp_estado: initialData.comp_estado || "BORRADOR",
        items_data: initialData.items || [],
      })

      if (initialData.comp_idpro) {
        const proveedor = proveedores.find((p) => p.id === initialData.comp_idpro)
        setSelectedProveedor(proveedor)
      }

      // Parsear comp_numero_factura si viene precargado
      if (initialData.comp_numero_factura) {
        const m = initialData.comp_numero_factura.match(/^([A-Z])-([0-9]{1,4})-([0-9]{1,8})$/i)
        if (m) {
          const letraParseada = m[1].toUpperCase()
          const letraValida = LETRAS_COMPROBANTE_PERMITIDAS.includes(letraParseada)
            ? letraParseada
            : LETRAS_COMPROBANTE_PERMITIDAS[0]
          const nextFactura = { letra: letraValida, pv: m[2], numero: m[3] }
          setFactura(nextFactura)
          // Asegurar padded en form
          updateNumeroFacturaInForm(nextFactura)
        }
      }
    }
  }, [initialData, proveedores, sucursales, updateNumeroFacturaInForm])

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: null,
      }))
    }
  }

  const handleProveedorChange = (proveedorId) => {
    const proveedor = proveedores.find((p) => p.id === parseInt(proveedorId))
    setSelectedProveedor(proveedor)
    setFormData((prev) => {
      const newFormData = {
        ...prev,
        comp_idpro: proveedorId,
        comp_cuit: proveedor?.cuit || "",
        comp_razon_social: proveedor?.razon || "",
        comp_domicilio: proveedor?.domicilio || "",
      }
      
      // Actualizar el proveedor en todos los items existentes usando el estado actual
      if (prev.items_data && prev.items_data.length > 0) {
        newFormData.items_data = prev.items_data.map(item => ({
          ...item,
          cdi_idpro: parseInt(proveedorId)
        }))
      }
      
      return newFormData
    })
  }

  // Handlers para los subcampos de factura
  const handleFacturaLetra = (letra) => {
    const upper = String(letra || "").toUpperCase()
    const letraValida = LETRAS_COMPROBANTE_PERMITIDAS.includes(upper)
      ? upper
      : LETRAS_COMPROBANTE_PERMITIDAS[0]
    const next = { ...factura, letra: letraValida }
    setFactura(next)
    updateNumeroFacturaInForm(next)
  }
  const handleFacturaPv = (pv) => {
    // Solo dígitos, permitir hasta 4 dígitos
    const clean = (pv || "").replace(/\D+/g, "").slice(0, 4)
    const next = { ...factura, pv: clean }
    setFactura(next)
    updateNumeroFacturaInForm(next)
    // NO mover foco automáticamente - dejar que el usuario termine de escribir
  }
  const handleFacturaNumero = (numero) => {
    const clean = (numero || "").replace(/\D+/g, "").slice(0, 8)
    const next = { ...factura, numero: clean }
    setFactura(next)
    updateNumeroFacturaInForm(next)
  }
  const padPvOnBlur = () => {
    const next = { ...factura, pv: factura.pv.toString().padStart(4, "0") }
    setFactura(next)
    updateNumeroFacturaInForm(next)
  }
  const padNumeroOnBlur = () => {
    const next = { ...factura, numero: factura.numero.toString().padStart(8, "0") }
    setFactura(next)
    updateNumeroFacturaInForm(next)
  }

  const handleItemsChange = (items) => {
    setFormData((prev) => ({
      ...prev,
      items_data: items,
    }))
    // NO calcular totales aquí para evitar re-renderizado
  }

  const handleAddItemFromBuscador = (producto) => {
    if (!selectedProveedor?.id) {
      console.error("No hay proveedor seleccionado")
      return
    }

    // Crear un nuevo item con el producto seleccionado
    const nuevoItem = {
      id: Date.now() + Math.random(),
      codigo_proveedor: producto.codigo_proveedor || "",
      producto: producto,
      cdi_idsto: producto.id,
      cdi_idpro: selectedProveedor.id,
      cdi_detalle1: producto.deno || producto.nombre || "",
      cdi_detalle2: producto.unidad || producto.unidadmedida || "-",
      cdi_cantidad: 1,
      cdi_costo: 0,
      cdi_idaliiva: typeof producto.idaliiva === 'object' ? producto.idaliiva.id : (producto.idaliiva ?? 3),
      unidad: producto.unidad || producto.unidadmedida || "-",
    }

    // Agregar el item directamente al grid usando el método imperativo
    if (itemsGridRef.current && itemsGridRef.current.addItem) {
      itemsGridRef.current.addItem(nuevoItem)
    }
  }

  // Usar useEffect para calcular totales solo cuando los items cambian
  useEffect(() => {
    if (formData.items_data) {
      calculateTotals(formData.items_data)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.items_data, alicuotas])

  const calculateTotals = (items) => {
    let subtotal = 0
    let iva21 = 0
    let iva105 = 0
    let iva27 = 0
    let iva0 = 0

    const alicuotasMap = alicuotas.reduce((acc, a) => {
      acc[a.id] = parseFloat(a.porce) || 0
      return acc
    }, {})

    items.forEach((item) => {
      const cantidad = parseFloat(item.cdi_cantidad) || 0
      const costo = parseFloat(item.cdi_costo) || 0
      const itemSubtotal = cantidad * costo
      subtotal += itemSubtotal

      const porcentaje = alicuotasMap[item.cdi_idaliiva] || 0
      const itemIVA = itemSubtotal * (porcentaje / 100)

      if (porcentaje === 21) iva21 += itemIVA
      else if (porcentaje === 10.5) iva105 += itemIVA
      else if (porcentaje === 27) iva27 += itemIVA
      else if (porcentaje === 0) iva0 += itemIVA
    })

    const total = subtotal + iva21 + iva105 + iva27 + iva0

    setFormData((prev) => ({
      ...prev,
      comp_importe_neto: subtotal,
      comp_iva_21: iva21,
      comp_iva_10_5: iva105,
      comp_iva_27: iva27,
      comp_iva_0: iva0,
      comp_total_final: total,
    }))
  }

  const validateForm = () => {
    const newErrors = {}

    // comp_numero_factura ya es derivado con padding
    if (!formData.comp_numero_factura) {
      newErrors.comp_numero_factura = "El número de factura es obligatorio"
    } else {
      const pattern = /^[ACX]-\d{4}-\d{8}$/
      if (!pattern.test(formData.comp_numero_factura)) {
        newErrors.comp_numero_factura = "Formato inválido. Use: A-0001-00000009"
      }
    }

    if (!formData.comp_idpro) newErrors.comp_idpro = "El proveedor es obligatorio"
    if (!formData.comp_fecha) newErrors.comp_fecha = "La fecha es obligatoria"
    if (formData.items_data.length === 0) newErrors.items = "Debe agregar al menos un item"

    const totalCalculado =
      formData.comp_importe_neto + formData.comp_iva_21 + formData.comp_iva_10_5 + formData.comp_iva_27 + formData.comp_iva_0
    if (Math.abs(formData.comp_total_final - totalCalculado) > 0.01) newErrors.totales = "Los totales no coinciden"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    setIsSubmitting(true)
    try {
      await onSave(formData)
    } catch (error) {
      console.error("Error al guardar compra:", error)
      setErrors({ submit: error.message || "Error al guardar la compra" })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Bloquear submit por Enter en cualquier input del formulario (igual que en VentaForm)
  const bloquearEnterSubmit = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
    }
  }

  return (
    <div className="px-6 pt-4 pb-6">
      <form className="venta-form w-full max-w-[1000px] mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200/50 relative overflow-hidden" onSubmit={handleSubmit} onKeyDown={bloquearEnterSubmit}>
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.primario}`} />

        {/* width constraint */}
        <div className="px-8 pt-6 pb-6">
          <div className="max-w-[1100px] mx-auto">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                <div className={`w-6 h-6 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-md`}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-3.5 h-3.5 text-white"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                    />
                  </svg>
                </div>
                {initialData ? (readOnly ? "Ver Compra" : "Editar Compra") : "Nueva Compra"}
              </h3>
              {initialData && <p className="text-slate-600 text-sm">Compra #{initialData.comp_id}</p>}
            </div>

                        {/* Una sola tarjeta con campos organizados en grid */}
            <div className="mb-6">
              <div className="p-2 bg-slate-50 rounded-sm border border-slate-200">
                
                {/* Primera fila: 5 campos con tamaños personalizados */}
                <div className="grid gap-4 mb-3" style={{ gridTemplateColumns: '2fr 1fr 1.5fr 0.8fr 1.7fr' }}>
                  {/* Proveedor */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Proveedor *</label>
                    {loadingProveedores ? (
                      <div className="flex items-center gap-2 text-slate-500 bg-slate-100 rounded-none px-2 py-1 text-xs h-8">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-600"></div>
                        Cargando...
                      </div>
                    ) : errorProveedores ? (
                      <div className="text-red-600 bg-red-50 rounded-none px-2 py-1 text-xs border border-red-200 h-8">
                        {errorProveedores}
                      </div>
                    ) : (
                      <select
                        value={formData.comp_idpro}
                        onChange={(e) => handleProveedorChange(e.target.value)}
                        disabled={readOnly}
                        className={`w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                          errors.comp_idpro ? "border-red-500" : ""
                        }`}
                      >
                        <option value="">Seleccionar proveedor...</option>
                        {proveedores.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.razon}
                          </option>
                        ))}
                      </select>
                    )}
                    {errors.comp_idpro && <p className="mt-1 text-xs text-red-600">{errors.comp_idpro}</p>}
                  </div>

                  {/* CUIT */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">CUIT</label>
                    <input
                      name="comp_cuit"
                      type="text"
                      value={formData.comp_cuit}
                      onChange={(e) => handleInputChange("comp_cuit", e.target.value)}
                      className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      readOnly={readOnly}
                      placeholder="CUIT del proveedor"
                    />
                  </div>

                  {/* Domicilio */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Domicilio</label>
                    <input
                      name="comp_domicilio"
                      type="text"
                      value={formData.comp_domicilio}
                      onChange={(e) => handleInputChange("comp_domicilio", e.target.value)}
                      className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      readOnly={readOnly}
                      placeholder="Domicilio del proveedor"
                    />
                  </div>

                  {/* Fecha */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Fecha *</label>
                    <input
                      name="comp_fecha"
                      type="date"
                      value={formData.comp_fecha}
                      onChange={(e) => handleInputChange("comp_fecha", e.target.value)}
                      className={`w-full border rounded-none px-2 py-1 text-xs h-8 bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                        errors.comp_fecha ? "border-red-500" : "border-slate-300"
                      }`}
                      required
                      readOnly={readOnly}
                    />
                    {errors.comp_fecha && <p className="mt-1 text-xs text-red-600">{errors.comp_fecha}</p>}
                  </div>

                                     {/* Numero de Factura inteligente */}
                   <div>
                     <div className="flex items-center gap-1 mb-1">
                       <label className="block text-[12px] font-semibold text-slate-700">N° Factura *</label>
                       <span className="text-[10px] text-slate-500">{buildNumeroFactura(factura.letra, factura.pv, factura.numero)}</span>
                     </div>
                     <div className="flex items-center gap-1">
                        <select
                          value={factura.letra}
                          onChange={(e) => handleFacturaLetra(e.target.value)}
                          disabled={readOnly}
                          className="border border-slate-300 rounded-none text-xs bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-center"
                          style={{ width: 64 }}
                          title="Letra de comprobante"
                        >
                          {LETRAS_COMPROBANTE_PERMITIDAS.map((letra) => (
                            <option key={letra} value={letra}>{letra}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={factura.pv}
                          onChange={(e) => handleFacturaPv(e.target.value)}
                          onBlur={padPvOnBlur}
                          disabled={readOnly}
                          placeholder="PV"
                          className="border border-slate-300 rounded-none text-xs bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-16 text-center"
                          ref={pvRef}
                          title="Punto de venta (4 dígitos)"
                        />
                        <span className="text-slate-500 text-xs">-</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={factura.numero}
                          onChange={(e) => handleFacturaNumero(e.target.value)}
                          onBlur={padNumeroOnBlur}
                          disabled={readOnly}
                          placeholder="Número"
                          className="border border-slate-300 rounded-none text-xs bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-24 text-center"
                          ref={numeroRef}
                          title="Número de comprobante (8 dígitos)"
                        />
                      </div>
                     {errors.comp_numero_factura && (
                       <p className="mt-1 text-xs text-red-600">{errors.comp_numero_factura}</p>
                     )}
                   </div>
                </div>

              </div>
            </div>

            {/* Buscador de productos */}
            {selectedProveedor && (
              <div className="mb-4">
                <div className="p-2 bg-slate-50 rounded-sm border border-slate-200">
                  <div className="grid gap-4 mb-3">
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-700 mb-1">Buscador de Productos del Proveedor</label>
                      <BuscadorProductoCompras
                        selectedProveedor={selectedProveedor}
                        onSelect={handleAddItemFromBuscador}
                        disabled={readOnly}
                        readOnly={readOnly}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Grid de items */}
            <div className="mb-4">
              <ItemsGridCompras
                ref={itemsGridRef}
                items={formData.items_data}
                onItemsChange={handleItemsChange}
                readOnly={readOnly}
                productos={productos}
                alicuotas={alicuotas}
                proveedores={proveedores}
                selectedProveedor={selectedProveedor}
              />
              {errors.items && <p className="mt-2 text-sm text-red-600">{errors.items}</p>}
            </div>

            {/* Totales en una sola fila */}
            <div className="mb-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Importe Neto</label>
                   <input
                     type="number"
                     step="0.01"
                     value={formData.comp_importe_neto}
                     onChange={(e) => handleInputChange("comp_importe_neto", parseFloat(e.target.value) || 0)}
                     onFocus={(e) => e.target.select()}
                     disabled={readOnly}
                     className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-100"
                   />
                 </div>
                                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">IVA 21%</label>
                   <input
                     type="number"
                     step="0.01"
                     value={formData.comp_iva_21}
                     onChange={(e) => handleInputChange("comp_iva_21", parseFloat(e.target.value) || 0)}
                     onFocus={(e) => e.target.select()}
                     disabled={readOnly}
                     className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-100"
                   />
                 </div>
                                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">IVA 10.5%</label>
                   <input
                     type="number"
                     step="0.01"
                     value={formData.comp_iva_10_5}
                     onChange={(e) => handleInputChange("comp_iva_10_5", parseFloat(e.target.value) || 0)}
                     onFocus={(e) => e.target.select()}
                     disabled={readOnly}
                     className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-100"
                   />
                 </div>
                                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">IVA 27%</label>
                   <input
                     type="number"
                     step="0.01"
                     value={formData.comp_iva_27}
                     onChange={(e) => handleInputChange("comp_iva_27", parseFloat(e.target.value) || 0)}
                     onFocus={(e) => e.target.select()}
                     disabled={readOnly}
                     className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-100"
                   />
                 </div>
                                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">IVA 0%</label>
                   <input
                     type="number"
                     step="0.01"
                     value={formData.comp_iva_0}
                     onChange={(e) => handleInputChange("comp_iva_0", parseFloat(e.target.value) || 0)}
                     onFocus={(e) => e.target.select()}
                     disabled={readOnly}
                     className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-100"
                   />
                 </div>
                                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Total Final *</label>
                   <input
                     type="number"
                     step="0.01"
                     value={formData.comp_total_final}
                     onChange={(e) => handleInputChange("comp_total_final", parseFloat(e.target.value) || 0)}
                     onFocus={(e) => e.target.select()}
                     disabled={readOnly}
                     className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-slate-100 font-semibold ${
                       errors.totales ? "border-red-500" : "border-slate-300"
                     }`}
                   />
                 </div>
              </div>
              {errors.totales && <p className="mt-2 text-sm text-red-600">{errors.totales}</p>}
            </div>

            {/* Observaciones */}
            <div className="mt-2">
              <textarea
                value={formData.comp_observacion}
                onChange={(e) => handleInputChange("comp_observacion", e.target.value)}
                disabled={readOnly}
                rows={3}
                placeholder="Observaciones adicionales..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-slate-100"
              />
            </div>

            {/* Acciones */}
            <div className="mt-3 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all duration-200 font-medium shadow-sm"
              >
                Cancelar
              </button>
              {!readOnly && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-6 py-3 ${theme.botonPrimario} rounded-xl`}
                >
                  {isSubmitting ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Compra"}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default CompraForm
