/**
 * Utilidades para formateo de datos en la interfaz.
 */

/**
 * Formatea una fecha o string de fecha al formato dd/mm/aa (2 dígitos para año).
 * @param {string|Date} fechaStr - La fecha a formatear.
 * @param {boolean} incluirHora - Si true, agrega " hh:mm".
 * @returns {string} - Fecha formateada o "-" si es nulo.
 */
export const formatearFecha = (fechaStr, incluirHora = false) => {
    if (!fechaStr) return "-"

    // Intentar parsear si es string YYYY-MM-DD
    let d
    if (typeof fechaStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
        const [y, m, day] = fechaStr.split("-")
        d = new Date(parseInt(y), parseInt(m) - 1, parseInt(day))
    } else {
        d = new Date(fechaStr)
    }

    if (isNaN(d.getTime())) return "-"

    const dia = String(d.getDate()).padStart(2, "0")
    const mes = String(d.getMonth() + 1).padStart(2, "0")
    const anio = String(d.getFullYear()).slice(-2)

    let resultado = `${dia}/${mes}/${anio}`

    if (incluirHora) {
        const horas = String(d.getHours()).padStart(2, "0")
        const minutos = String(d.getMinutes()).padStart(2, "0")
        resultado += ` ${horas}:${minutos}`
    }

    return resultado
}

/**
 * Formatea un monto numérico a moneda es-AR ($ 1.234,56).
 * @param {number|string} valor - El monto a formatear.
 * @returns {string} - Monto formateado.
 */
export const formatearMoneda = (valor) => {
    const num = parseFloat(valor) || 0
    return num.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
}
