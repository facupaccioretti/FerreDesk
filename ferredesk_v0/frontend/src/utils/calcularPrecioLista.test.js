import { calcularMargenDesdePrecios, calcularPrecioLista, calcularPrecioLista0 } from './calcularPrecioLista'

describe('redondeo de precios', () => {
  test('redondea medio centavo hacia arriba en lista 0', () => {
    expect(calcularPrecioLista0(10, 0.05, 0)).toBe(10.01)
  })

  test('redondea medio centavo hacia arriba en listas derivadas', () => {
    expect(calcularPrecioLista(10, 0.05)).toBe(10.01)
  })

  test('precio y margen coinciden en varios escenarios', () => {
    const casos = [
      [1000, 40, 21, 1694],
      [200, 15, 10.5, 254.15],
      [50, 0, 21, 60.5],
      [123.45, 10, 0, 135.8],
    ]

    casos.forEach(([costo, margen, iva, precioEsperado]) => {
      const precio = calcularPrecioLista0(costo, margen, iva)
      expect(precio).toBe(precioEsperado)
      expect(calcularMargenDesdePrecios(precio, costo, iva)).toBe(margen)
    })
  })
})
