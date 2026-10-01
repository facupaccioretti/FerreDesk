import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const mockGuardarProductoAtomico = jest.fn()

jest.mock('../../utils/useAlicuotasIVAAPI', () => ({
  useAlicuotasIVAAPI: () => ({ alicuotas: [] }),
}))
jest.mock('../../utils/useFerreteriaAPI', () => ({
  useFerreteriaAPI: () => ({ ferreteria: {} }),
}))
jest.mock('../../utils/useDetectorDenominaciones', () => () => ({
  sugerencias: [],
  isLoading: false,
  error: null,
  mostrarTooltip: false,
  handleDenominacionBlur: jest.fn(),
  limpiarSugerencias: jest.fn(),
  toggleTooltip: jest.fn(),
}))
jest.mock('./DenominacionSugerenciasTooltip', () => () => null)
jest.mock('../../hooks/useFerreDeskTheme', () => ({
  useFerreDeskTheme: () => ({ primario: '', botonPrimario: '' }),
}))
jest.mock('../../hooks/useNavegacionForm', () => () => ({
  getFormProps: () => ({}),
}))
jest.mock('../Botones', () => ({
  BotonEditar: () => null,
}))
jest.mock('../../utils/useListasPrecioAPI', () => ({
  useListasPrecioAPI: () => ({
    listas: [1, 2, 3, 4].map((numero) => ({ numero, margen_descuento: 0 })),
  }),
}))
jest.mock('./codigoBarras', () => ({ CodigoBarrasModal: () => null }))
jest.mock('./herramientastockform', () => ({
  useStockForm: ({ stock }) => ({
    form: {
      id: 77,
      codvta: 'ERROR-ATOMICO',
      deno: 'Producto con error',
      unidad: 'UN',
      cantmin: 0,
      margen: stock?.margen ?? '20.00',
      proveedor_habitual_id: stock?.proveedor_habitual?.id ? String(stock.proveedor_habitual.id) : '',
      idfam1: null,
      idfam2: null,
      idfam3: null,
      idaliiva: stock?.idaliiva?.id ?? '',
      acti: 'S',
      stock_proveedores: [],
    },
    setForm: jest.fn(),
    setFormError: jest.fn(),
    handleChange: jest.fn(),
    updateForm: jest.fn(),
    handleCancel: jest.fn(),
    claveBorrador: 'stockFormDraft_test',
  }),
  useGestionProveedores: ({ stock }) => ({
    handleEditStockProve: jest.fn(),
    handleEditCostoStockProve: jest.fn(),
    handleEditCancel: jest.fn(),
    handleEditStockProveSave: jest.fn(),
    handleEditCostoStockProveSave: jest.fn(),
    handleEliminarRelacion: jest.fn(),
    stockTotal: 0,
    proveedoresAsociados: [],
    stockProveParaMostrar: stock?.stock_proveedores ?? [],
    editandoCantidadId: null,
    nuevaCantidad: '',
    setNuevaCantidad: jest.fn(),
    editandoCostoId: null,
    nuevoCosto: '',
    setNuevoCosto: jest.fn(),
  }),
  useAsociacionCodigos: () => ({
    selectedProveedor: '',
    setSelectedProveedor: jest.fn(),
    terminoBusqueda: '',
    setTerminoBusqueda: jest.fn(),
    codigoProveedor: '',
    setCodigoProveedor: jest.fn(),
    productosConDenominacion: [],
    loadingCodigos: false,
    messageAsociar: '',
    setErrorAsociar: jest.fn(),
    errorAsociar: '',
    costoAsociar: '',
    setCostoAsociar: jest.fn(),
    denominacionAsociar: '',
    setDenominacionAsociar: jest.fn(),
    cargandoCostoAsociar: false,
    showSugeridos: false,
    setShowSugeridos: jest.fn(),
    modoBusqueda: 'codigo',
    setModoBusqueda: jest.fn(),
    filteredProductos: [],
    handleAsociarCodigoIntegrado: jest.fn(),
    handleCancelarAsociarCodigo: jest.fn(),
  }),
  useGuardadoAtomico: () => ({
    guardarProductoAtomico: mockGuardarProductoAtomico,
  }),
  useValidaciones: () => ({ esValido: true, errores: [], erroresCampo: [] }),
}))

const StockForm = require('./StockForm').default

describe('StockForm', () => {
  let container
  let root

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    localStorage.clear()
    localStorage.setItem('stockFormDraft_test', '{"deno":"borrador"}')
    localStorage.setItem('stockFormDraft_test_precios', JSON.stringify({
      lista0: { precio: 100, manual: false },
      lista1: { precio: 90, manual: false },
      lista2: { precio: 87.5, manual: true },
      lista3: { precio: 112.5, manual: false },
      lista4: { precio: 120, manual: false },
    }))
    mockGuardarProductoAtomico.mockResolvedValue({
      success: false,
      error: 'Error de validacion',
    })
    jest.spyOn(window, 'confirm').mockReturnValue(true)
    jest.spyOn(Storage.prototype, 'removeItem')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root.render(
        <StockForm
          stock={null}
          onSave={jest.fn()}
          onCancel={jest.fn()}
          proveedores={[]}
          familias={[]}
          modo="nuevo"
          tabKey="test"
        />
      )
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    document.body.removeChild(container)
    jest.restoreAllMocks()
    mockGuardarProductoAtomico.mockReset()
  })

  test('si falla el guardado conserva borradores y no llama onSave', async () => {
    const onSave = jest.fn()

    await act(async () => {
      root.render(
        <StockForm
          stock={null}
          onSave={onSave}
          onCancel={jest.fn()}
          proveedores={[]}
          familias={[]}
          modo="nuevo"
          tabKey="test"
        />
      )
    })
    await act(async () => {
      container.querySelector('form').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      )
    })

    expect(mockGuardarProductoAtomico).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
    expect(localStorage.removeItem).not.toHaveBeenCalled()
    expect(localStorage.getItem('stockFormDraft_test')).toBe('{"deno":"borrador"}')
    expect(localStorage.getItem('stockFormDraft_test_precios')).not.toBeNull()
  })

  test('al editar preserva el precio manual antes de cargar las alicuotas', async () => {
    const stock = {
      precio_lista_0: 1000,
      precio_lista_0_manual: true,
      precios_listas: [],
      margen: '352.49',
      idaliiva: { id: 1, porce: '10.50' },
      proveedor_habitual: { id: 1 },
      stock_proveedores: [{ proveedor: 1, costo: 200 }],
    }

    await act(async () => {
      root.render(
        <StockForm
          key="editar-77"
          stock={stock}
          onSave={jest.fn()}
          onCancel={jest.fn()}
          proveedores={[]}
          familias={[]}
          modo="editar"
          tabKey="editar-77"
        />
      )
    })

    expect(Array.from(container.querySelectorAll('input[type="number"]')).some((input) => Number(input.value) === 1000)).toBe(true)
  })
})
