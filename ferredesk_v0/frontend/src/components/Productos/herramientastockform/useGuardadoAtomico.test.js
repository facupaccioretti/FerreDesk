import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

import useGuardadoAtomico from './useGuardadoAtomico'

function HookHarness({ stock, onReady }) {
  const api = useGuardadoAtomico({ stock })

  React.useEffect(() => {
    onReady(api)
  }, [api, onReady])

  return null
}

describe('useGuardadoAtomico', () => {
  let container
  let root
  let api

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ producto_id: 77 }),
    })

    await act(async () => {
      root.render(<HookHarness stock={null} onReady={(value) => { api = value }} />)
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    document.body.removeChild(container)
    jest.restoreAllMocks()
  })

  test('envia producto proveedores y cuatro listas en una sola request', async () => {
    const form = {
      id: 77,
      codvta: 'ATOM-1',
      deno: 'Producto atomico',
      idaliiva: 5,
      idfam1: null,
      idfam2: null,
      idfam3: null,
      stock_proveedores: [{
        proveedor_id: 9,
        cantidad: '3.00',
        costo: '33.33',
        codigo_producto_proveedor: 'PX-9',
      }],
    }
    const precios = [
      { lista_numero: 1, precio: 90, precio_manual: false },
      { lista_numero: 2, precio: 87.5, precio_manual: true },
      { lista_numero: 3, precio: 112.5, precio_manual: false },
      { lista_numero: 4, precio: 120, precio_manual: false },
    ]

    let resultado
    await act(async () => {
      resultado = await api.guardarProductoAtomico(form, precios)
    })

    expect(resultado.success).toBe(true)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/productos/crear-producto-con-relaciones/',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    )
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body).toEqual({
      producto: expect.objectContaining({
        id: 77,
        codvta: 'ATOM-1',
        deno: 'Producto atomico',
        idaliiva_id: 5,
      }),
      stock_proveedores: [{
        proveedor_id: 9,
        cantidad: 3,
        costo: 33.33,
        codigo_producto_proveedor: 'PX-9',
      }],
      precios_listas: precios,
    })
  })
  test('muestra el detalle de validacion devuelto por el backend', async () => {
    const aviso = jest.spyOn(window, 'alert').mockImplementation(() => {})
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        detail: 'Error de validacion',
        errors: { detail: ['No se pudo calcular Lista 0: falta un costo habitual mayor que cero.'] },
      }),
    })

    let resultado
    await act(async () => {
      resultado = await api.guardarProductoAtomico({ id: 77 })
    })

    expect(resultado.error).toBe('No se pudo calcular Lista 0: falta un costo habitual mayor que cero.')
    expect(aviso).toHaveBeenCalledWith(resultado.error)
  })

  test('indica la lista que tiene un precio manual invalido', async () => {
    const aviso = jest.spyOn(window, 'alert').mockImplementation(() => {})
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        detail: 'Error de validacion',
        errors: [{}, { precio: ['El precio manual debe ser mayor que cero.'] }],
      }),
    })

    let resultado
    await act(async () => {
      resultado = await api.guardarProductoAtomico(
        { id: 77 },
        [{ lista_numero: 1 }, { lista_numero: 2 }]
      )
    })

    expect(resultado.error).toBe('Lista 2: El precio manual debe ser mayor que cero.')
    expect(aviso).toHaveBeenCalledWith(resultado.error)
  })
})
