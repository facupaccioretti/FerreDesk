import { invalidarCachesProductos } from "./queryKeys"

test("invalida solo las familias de cache de productos", async () => {
  const queryClient = { invalidateQueries: jest.fn().mockResolvedValue() }

  await invalidarCachesProductos(queryClient)

  expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(4)
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["resource", expect.any(String), "productos"],
  })
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["producto-busqueda-ligera", expect.any(String)],
  })
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["producto-lookup-rapido", expect.any(String)],
  })
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["producto-lookup-compra", expect.any(String)],
  })
})
