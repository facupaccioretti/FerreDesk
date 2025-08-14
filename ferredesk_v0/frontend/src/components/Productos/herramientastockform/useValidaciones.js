import { useMemo } from "react"

const useValidaciones = ({ form, modo, stockProveParaMostrar, codigosPendientes, codigosPendientesEdicion }) => {
  
  // Validaciones del formulario
  const validaciones = useMemo(() => {
    const errores = []
    
    // Validaciones básicas
    if (!form.codvta || form.codvta.trim() === "") {
      errores.push("El código de venta es obligatorio")
    }
    
    if (!form.codcom || form.codcom.trim() === "") {
      errores.push("El código de compra es obligatorio")
    }
    
    if (!form.deno || form.deno.trim() === "") {
      errores.push("La denominación es obligatoria")
    }
    
    if (!form.idaliiva) {
      errores.push("Debe seleccionar una alícuota de IVA")
    }
    
    if (!form.acti) {
      errores.push("Debe seleccionar el estado del producto")
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
    
    // Validaciones de stock
    if (stockProveParaMostrar && stockProveParaMostrar.length === 0) {
      errores.push("Debe agregar al menos un proveedor con stock")
    }
    
    // Validaciones de cantidades
    if (stockProveParaMostrar) {
      stockProveParaMostrar.forEach((sp, index) => {
        if (sp.cantidad < 0) {
          errores.push(`La cantidad del proveedor ${index + 1} no puede ser negativa`)
        }
        if (sp.costo < 0) {
          errores.push(`El costo del proveedor ${index + 1} no puede ser negativo`)
        }
      })
    }
    
    return {
      esValido: errores.length === 0,
      errores,
      cantidadErrores: errores.length
    }
  }, [form, modo, stockProveParaMostrar, codigosPendientes, codigosPendientesEdicion])
  
  // Función para validar un campo específico
  const validarCampo = (nombreCampo, valor) => {
    switch (nombreCampo) {
      case "codvta":
        return !valor || valor.trim() === "" ? "El código de venta es obligatorio" : null
      case "codcom":
        return !valor || valor.trim() === "" ? "El código de compra es obligatorio" : null
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
