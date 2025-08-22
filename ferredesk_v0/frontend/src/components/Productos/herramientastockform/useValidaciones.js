import { useMemo } from "react"

const useValidaciones = ({ form, modo, stockProveParaMostrar, codigosPendientes, codigosPendientesEdicion, ferreteria }) => {
  
  // Validaciones del formulario
  const validaciones = useMemo(() => {
    const errores = []
    const erroresCampo = []
    
    // Validaciones básicas (errores de campo específico)
    if (!form.codvta || form.codvta.trim() === "") {
      erroresCampo.push({ campo: "codvta", mensaje: "El código de venta es obligatorio" })
    }
    
    if (!form.deno || form.deno.trim() === "") {
      erroresCampo.push({ campo: "deno", mensaje: "La denominación es obligatoria" })
    }
    
    if (!form.idaliiva) {
      erroresCampo.push({ campo: "idaliiva", mensaje: "Debe seleccionar una alícuota de IVA" })
    }
    
    if (!form.acti) {
      erroresCampo.push({ campo: "acti", mensaje: "Debe seleccionar el estado del producto" })
    }
    
    // Validaciones de códigos duplicados
    const codigosUsados = new Set()
    
    // Verificar códigos en stock existente
    if (stockProveParaMostrar) {
      stockProveParaMostrar.forEach(sp => {
        if (sp.codigo_producto_proveedor) {
          if (codigosUsados.has(sp.codigo_producto_proveedor)) {
            errores.push(`El código ${sp.codigo_producto_proveedor} está duplicado`)
          } else {
            codigosUsados.add(sp.codigo_producto_proveedor)
          }
        }
      })
    }
    
    // Verificar códigos pendientes
    if (modo === "nuevo" && codigosPendientes) {
      codigosPendientes.forEach(codigo => {
        if (codigo.codigo_producto_proveedor) {
          if (codigosUsados.has(codigo.codigo_producto_proveedor)) {
            errores.push(`El código ${codigo.codigo_producto_proveedor} está duplicado`)
          } else {
            codigosUsados.add(codigo.codigo_producto_proveedor)
          }
        }
      })
    }
    
    // Verificar códigos pendientes de edición
    if (modo === "edicion" && codigosPendientesEdicion) {
      codigosPendientesEdicion.forEach(codigo => {
        if (codigo.codigo_producto_proveedor) {
          if (codigosUsados.has(codigo.codigo_producto_proveedor)) {
            errores.push(`El código ${codigo.codigo_producto_proveedor} está duplicado`)
          } else {
            codigosUsados.add(codigo.codigo_producto_proveedor)
          }
        }
      })
    }
    
    // Validaciones de stock (errores generales)
    if (stockProveParaMostrar && stockProveParaMostrar.length === 0) {
      errores.push("Debe agregar al menos un proveedor con stock")
    }
    
    // Validaciones de cantidades y costos (errores generales)
    if (stockProveParaMostrar) {
      stockProveParaMostrar.forEach((sp, index) => {
        // Validar cantidad negativa solo si no está permitido el stock negativo
        if (sp.cantidad < 0 && !ferreteria?.permitir_stock_negativo) {
          errores.push(`La cantidad del proveedor ${index + 1} no puede ser negativa`)
        }
        
        // Validar que el costo no sea nulo o vacío si hay código asociado (PRIMERO)
        if (sp.codigo_producto_proveedor && (sp.costo === null || sp.costo === undefined || sp.costo === "" || sp.costo === 0)) {
          errores.push(`Hay un proveedor con código asociado pero sin costo. Debe ingresar un costo válido para poder guardar el producto.`)
        }
        
        // Validar que el costo no sea negativo (SOLO si no es nulo)
        if (sp.costo !== null && sp.costo !== undefined && sp.costo !== "" && sp.costo < 0) {
          errores.push(`El costo del proveedor ${index + 1} no puede ser negativo`)
        }
      })
    }
    
    return {
      esValido: errores.length === 0 && erroresCampo.length === 0,
      errores, // Errores generales (para alertas)
      erroresCampo, // Errores de campo específico (para tooltips nativos)
      cantidadErrores: errores.length + erroresCampo.length
    }
  }, [form, modo, stockProveParaMostrar, codigosPendientes, codigosPendientesEdicion, ferreteria])
  
  // Función para validar un campo específico
  const validarCampo = (nombreCampo, valor) => {
    switch (nombreCampo) {
      case "codvta":
        return !valor || valor.trim() === "" ? "El código de venta es obligatorio" : null
      
      case "deno":
        return !valor || valor.trim() === "" ? "La denominación es obligatoria" : null
      case "idaliiva":
        return !valor ? "Debe seleccionar una alícuota de IVA" : null
      case "acti":
        return !valor ? "Debe seleccionar el estado del producto" : null
      default:
        return null
    }
  }
  
  return {
    ...validaciones,
    validarCampo
  }
}

export default useValidaciones
