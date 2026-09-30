import { calcularPrecioLista, calcularPrecioLista0 } from './calcularPrecioLista'

describe('redondeo de precios', () => {
  test('redondea medio centavo hacia arriba en lista 0', () => {
    expect(calcularPrecioLista0(10, 0.05, 0)).toBe(10.01)
  })

  test('redondea medio centavo hacia arriba en listas derivadas', () => {
    expect(calcularPrecioLista(10, 0.05)).toBe(10.01)
  })
})
