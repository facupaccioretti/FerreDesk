import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import useValidaciones from './useValidaciones'

function Harness({ form, proveedores, onReady }) {
  const resultado = useValidaciones({ form, ferreteria: {}, proveedores })
  React.useEffect(() => onReady(resultado), [resultado, onReady])
  return null
}

test('muestra la razon social en los errores de costo y cantidad', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  let resultado
  const form = {
    codvta: 'TEST',
    deno: 'Producto',
    idaliiva: 1,
    acti: 'S',
    stock_proveedores: [{
      proveedor_id: 7,
      codigo_producto_proveedor: 'ABC',
      costo: 0,
      cantidad: -1,
    }],
  }

  await act(async () => {
    root.render(
      <Harness
        form={form}
        proveedores={[{ id: 7, razon: 'Casa Lopez' }]}
        onReady={(value) => { resultado = value }}
      />
    )
  })

  expect(resultado.errores).toEqual([
    'El proveedor Casa Lopez tiene un codigo asociado pero sin un costo valido.',
    'La cantidad del proveedor Casa Lopez no puede ser negativa.',
  ])

  await act(async () => root.unmount())
  document.body.removeChild(container)
})