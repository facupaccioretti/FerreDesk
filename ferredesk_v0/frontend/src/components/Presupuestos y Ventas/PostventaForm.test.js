import {
  buildConfirmPayload,
  buildItemsNuevosPayload,
  crearItemsOrigen,
  esConsumidorFinal,
  filtrarMetodosPostventa,
  obtenerMontoObjetivo,
  tieneEfectivoInsuficiente,
} from "./PostventaForm"

describe("PostventaForm payloads", () => {
  test("mapea los items de origen y conserva sus identificadores reales", () => {
    expect(crearItemsOrigen([{
      id: 17,
      vdi_orden: 3,
      vdi_idsto: 9,
      vdi_cantidad: "2.00",
      vdi_precio_unitario_final: "121.00",
      vdi_detalle1: "Martillo",
      codigo: "MAR001",
    }])).toEqual([expect.objectContaining({
      origenItemId: 17,
      vdi_idsto: 9,
      cantidadOriginal: 2,
      precioUnitario: 121,
      detalle: "Martillo",
      codigo: "MAR001",
    })])
  })

  test("limita la devolucion al remanente real de una postventa anterior", () => {
    const [item] = crearItemsOrigen([{
      id: 17,
      vdi_cantidad: "2.00",
    }], {
      17: {
        cantidad_ya_devuelta: "1.00",
        cantidad_disponible_para_devolver: "1.00",
      },
    })

    expect(item).toEqual(expect.objectContaining({
      cantidadOriginal: 2,
      cantidadYaDevuelta: 1,
      cantidadDisponible: 1,
    }))
  })

  test("incluye el precio editado en los productos nuevos", () => {
    expect(buildItemsNuevosPayload([{
      producto: { id: 7, idaliiva: 5 },
      cantidad: "2",
      precioFinal: "150.50",
    }])).toEqual([{
      stock_id: 7,
      cantidad: "2.00",
      precio_unitario: "150.50",
    }])
  })

  test("envia el cobro de diferencia y su medio de pago", () => {
    const payload = buildConfirmPayload({
      modo: "cambio",
      observacion: "Cambio de producto",
      previewPayload: { venta_id: 10, items_devueltos: [], items_nuevos: [] },
      previewData: {
        resumen_monetario: {
          diferencia: "100.00",
          direccion_diferencia: "CLIENTE_PAGA",
        },
      },
      resolucionDiferencia: "COBRAR_DIFERENCIA",
      mediosPago: [
        { metodo_pago_id: 3, monto: "40.00", cuenta_banco_id: 8 },
        { metodo_pago_id: 1, monto: "60.00" },
      ],
    })

    expect(payload.resolucion_diferencia).toBe("COBRAR_DIFERENCIA")
    expect(payload.medios_diferencia).toEqual([
      { metodo_pago_id: 3, monto: "40.00", cuenta_banco_id: 8 },
      { metodo_pago_id: 1, monto: "60.00" },
    ])
  })

  test("usa saldo a favor cuando el cliente recibe", () => {
    const payload = buildConfirmPayload({
      modo: "cambio",
      observacion: "Cambio de producto",
      previewPayload: { venta_id: 10, items_devueltos: [], items_nuevos: [] },
      previewData: {
        resumen_monetario: {
          diferencia: "100.00",
          direccion_diferencia: "CLIENTE_RECIBE",
        },
      },
      mediosPago: [{ metodo_pago_id: 3, monto: "100.00" }],
    })

    expect(payload.resolucion_diferencia).toBe("SALDO_A_FAVOR")
    expect(payload.medios_diferencia).toBeUndefined()
  })

  test("obliga a consumidor final a devolver dinero", () => {
    const previewData = {
      venta_origen: { cliente_id: 1 },
      resumen_monetario: {
        direccion_diferencia: "CLIENTE_RECIBE",
      },
    }

    expect(esConsumidorFinal(previewData)).toBe(true)
    expect(buildConfirmPayload({
      modo: "devolucion",
      observacion: "Devolucion",
      previewPayload: { venta_id: 10, items: [] },
      previewData,
      resolucionDinero: "SALDO_A_FAVOR",
      mediosPago: [{ metodo_pago_id: 1, monto: "100.00" }],
    })).toEqual(expect.objectContaining({
      resolucion_dinero: "DEVOLVER_DINERO",
      medios: [{ metodo_pago_id: 1, monto: "100.00" }],
    }))
  })

  test("consumidor final no puede dejar deuda en un cambio", () => {
    const payload = buildConfirmPayload({
      modo: "cambio",
      observacion: "Cambio",
      previewPayload: { venta_id: 10, items_devueltos: [], items_nuevos: [] },
      previewData: {
        venta_origen: { cliente_id: "1" },
        resumen_monetario: { direccion_diferencia: "CLIENTE_PAGA" },
      },
      resolucionDiferencia: "DEJAR_DEUDA",
      mediosPago: [{ metodo_pago_id: 1, monto: "10.00" }],
    })

    expect(payload.resolucion_diferencia).toBe("COBRAR_DIFERENCIA")
    expect(payload.medios_diferencia).toEqual([{ metodo_pago_id: 1, monto: "10.00" }])
  })

  test("marca explicitamente un cambio sin diferencia", () => {
    const payload = buildConfirmPayload({
      modo: "cambio",
      observacion: "Cambio de producto",
      previewPayload: { venta_id: 10, items_devueltos: [], items_nuevos: [] },
      previewData: {
        resumen_monetario: {
          diferencia: "0.00",
          direccion_diferencia: "SIN_DIFERENCIA",
        },
      },
      resolucionDiferencia: "COBRAR_DIFERENCIA",
      mediosPago: [{ metodo_pago_id: 3, monto: "10.00" }],
    })

    expect(payload.resolucion_diferencia).toBe("SIN_DIFERENCIA")
    expect(payload.medios_diferencia).toBeUndefined()
  })

  test("filtra medios por entrada, salida y capacidades disponibles", () => {
    const metodos = [
      { id: 1, codigo: "efectivo", afecta_arqueo: true },
      { id: 2, codigo: "transferencia", afecta_arqueo: false },
      { id: 3, codigo: "qr", afecta_arqueo: false },
      { id: 4, codigo: "tarjeta_credito", afecta_arqueo: false },
      { id: 5, codigo: "cuenta_corriente", afecta_arqueo: false },
      { id: 6, codigo: "fondos_propios", afecta_arqueo: false },
      { id: 7, codigo: "cheque", afecta_arqueo: false },
    ]

    expect(filtrarMetodosPostventa(metodos, "entrada", true, true).map((m) => m.codigo))
      .toEqual(["efectivo", "transferencia", "qr", "tarjeta_credito"])
    expect(filtrarMetodosPostventa(metodos, "salida", true, true).map((m) => m.codigo))
      .toEqual(["efectivo", "transferencia"])
    expect(filtrarMetodosPostventa(metodos, "entrada", false, false)).toEqual([])
  })

  test("exige caja para efectivo aunque su configuracion no afecte arqueo", () => {
    expect(filtrarMetodosPostventa([
      { id: 1, codigo: "efectivo", afecta_arqueo: false },
    ], "salida", false, true)).toEqual([])
  })

  test("advierte efectivo insuficiente sin tratar un saldo desconocido como cero", () => {
    expect(tieneEfectivoInsuficiente("50.00", 50.01)).toBe(true)
    expect(tieneEfectivoInsuficiente("50.00", 50)).toBe(false)
    expect(tieneEfectivoInsuficiente(null, 50)).toBe(false)
  })

  test("devuelve solo el remanente despues de imputar la deuda de origen", () => {
    expect(obtenerMontoObjetivo("cambio", {
      diferencia: "60.00",
      saldo_pendiente_venta: "25.00",
    }, "DEVOLVER_DINERO")).toBe(35)

    expect(obtenerMontoObjetivo("cambio", {
      diferencia: "60.00",
      saldo_pendiente_venta: "60.00",
    }, "DEVOLVER_DINERO")).toBe(0)
  })

  test("no envia medios cuando la deuda cubre todo el saldo a favor", () => {
    const payload = buildConfirmPayload({
      modo: "cambio",
      observacion: "Cambio sin reintegro",
      previewPayload: { venta_id: 10, items_devueltos: [], items_nuevos: [] },
      previewData: {
        resumen_monetario: {
          diferencia: "60.00",
          saldo_pendiente_venta: "60.00",
          direccion_diferencia: "CLIENTE_RECIBE",
        },
      },
      resolucionDiferencia: "DEVOLVER_DINERO",
      mediosPago: [{ metodo_pago_id: 1, monto: "60.00" }],
    })

    expect(payload.medios_diferencia).toBeUndefined()
  })
})
