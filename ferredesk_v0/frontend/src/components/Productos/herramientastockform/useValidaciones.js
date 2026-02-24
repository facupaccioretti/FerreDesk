import { useMemo } from "react"

const useValidaciones = ({ form, ferreteria }) => {

  const validaciones = useMemo(() => {
    const errores = []
    const erroresCampo = []

    // Validaciones básicas
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

    // Validaciones de proveedores (usando la fuente única: form.stock_proveedores)
    const stockProveedores = form.stock_proveedores || []

    if (stockProveedores.length === 0) {
      errores.push("Debe agregar al menos un proveedor con stock")
    }

    const codigosUsados = new Set()
    stockProveedores.forEach((sp, index) => {
      // Duplicados dentro del MISMO producto (no deberían pasar con la nueva arquitectura)
      if (sp.codigo_producto_proveedor) {
        if (codigosUsados.has(sp.codigo_producto_proveedor)) {
          errores.push(`El código ${sp.codigo_producto_proveedor} aparece más de una vez en este producto.`)
        } else {
          codigosUsados.add(sp.codigo_producto_proveedor)
        }
      }

      // Validar costo si hay código
      if (sp.codigo_producto_proveedor && (sp.costo === null || sp.costo === undefined || sp.costo === "" || parseFloat(sp.costo) === 0)) {
        errores.push(`El proveedor ${index + 1} tiene un código asociado pero sin un costo válido.`)
      }

      // Validar stock negativo
      if (sp.cantidad < 0 && !ferreteria?.permitir_stock_negativo) {
        errores.push(`La cantidad del proveedor ${index + 1} no puede ser negativa.`)
      }
    })

    return {
      esValido: errores.length === 0 && erroresCampo.length === 0,
      errores,
      erroresCampo,
      cantidadErrores: errores.length + erroresCampo.length
    }
  }, [form, ferreteria])

  const validarCampo = (nombreCampo, valor) => {
    switch (nombreCampo) {
      case "codvta": return !valor || valor.trim() === "" ? "El código de venta es obligatorio" : null
      case "deno": return !valor || valor.trim() === "" ? "La denominación es obligatoria" : null
      case "idaliiva": return !valor ? "Debe seleccionar una alícuota de IVA" : null
      case "acti": return !valor ? "Debe seleccionar el estado del producto" : null
      default: return null
    }
  }

  return {
    ...validaciones,
    validarCampo
  }
}

export default useValidaciones
