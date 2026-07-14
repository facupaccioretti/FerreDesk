export const esElegibleParaPostventa = (comprobante) => {
  const tipo = comprobante?.comprobante?.tipo || comprobante?.comprobante_tipo || ""

  return tipo === "factura_interna" && comprobante?.estado === "Cerrado" && !comprobante?.convertida_a_fiscal
}
