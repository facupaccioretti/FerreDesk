# Optimización de Rendimiento: Módulo de Presupuestos y Ventas

Este documento detalla los problemas de rendimiento identificados en el módulo de "Presupuestos y Ventas" y propone soluciones para cada uno, asegurando la integridad funcional del sistema.

---

## 1. Problema Crítico: Múltiples Peticiones HTTP en la Tabla de Ventas (N+1 Queries)

### Descripción del Problema
La tabla principal de "Presupuestos y Ventas" renderiza un componente `CeldaTotalVenta` por cada fila. Este componente, a su vez, utiliza el hook `useVentaDetalleAPI` que realiza dos (2) peticiones HTTP al backend para obtener el total calculado de esa venta específica. Si la tabla muestra 15 ventas por página, esto resulta en **30 peticiones HTTP adicionales** (`15 filas * 2 peticiones/fila`) cada vez que se carga o cambia de página, causando una carga excesiva en la red y el servidor, y ralentizando drásticamente la interfaz.

### Causa Raíz
El problema se origina en `PresupuestosManager.js`, donde se mapean los datos paginados y se renderiza `CeldaTotalVenta` para cada venta.

- **`PresupuestosManager.js`:**
  ```javascript
  datosPagina.map(p => (
    <tr key={p.id}>
      {/* ... otras celdas ... */}
      <td><CeldaTotalVenta idVenta={p.id} /></td> {/* ¡Aquí se genera el problema! */}
    </tr>
  ))
  ```

- **`useVentaDetalleAPI.js`:**
  ```javascript
  Promise.all([
    fetch(`/api/venta-calculada/${idVenta}/`),      // Petición 1
    fetch(`/api/venta-detalle-item-calculado/?vdi_idve=${idVenta}`) // Petición 2
  ])
  ```

### Solución Propuesta
La solución es eliminar la necesidad de que cada celda busque su propio total, incorporando el total calculado directamente en la consulta principal de ventas.

**Paso 1: Modificar la Vista del Backend (`ventas/views.py`)**

La estrategia más eficiente es asegurar que la consulta principal a `/api/ventas/` ya incluya el total. Dado que ya existen las vistas `VentaCalculada` en la base de datos, podemos aprovecharlas para el listado.

- **Plan:** Modificar el `VentaViewSet` para que use `VentaCalculada` en la acción de `list`. Esto requiere que el `filterset` sea compatible con los campos de la vista.

  ```python
  # ferreapps/ventas/views.py

  class VentaViewSet(viewsets.ModelViewSet):
      # ... (filterset y otros atributos) ...

      def get_queryset(self):
          """
          Devuelve un queryset diferente dependiendo de la acción.
          Usa la vista calculada para 'list' y el modelo base para las demás acciones.
          """
          if self.action == 'list':
              # Para listar, usamos la vista calculada que es más rica en datos.
              # Se asume que VentaCalculada tiene los campos necesarios para el filtrado.
              return VentaCalculada.objects.all().order_by('-ven_fecha', '-id')
          
          # Para otras acciones (retrieve, update, delete), usamos el modelo original.
          return Venta.objects.all()

      def get_serializer_class(self):
          """
          Devuelve un serializer diferente para 'list'.
          """
          if self.action == 'list':
              return VentaCalculadaSerializer # Serializer para la vista.
          return VentaSerializer # Serializer estándar para CRUD.
  ```

**Paso 2: Modificar el Frontend (`PresupuestosManager.js`)**

Actualizar el componente para que consuma el campo de total que ahora viene en la respuesta, eliminando por completo `CeldaTotalVenta`.

- **Antes:**
  ```javascript
  <td><CeldaTotalVenta idVenta={p.id} /></td>
  ```

- **Después:**
  ```javascript
  <td>
    <span className="font-semibold text-slate-800">
      ${formatearMoneda(p.ven_total)} {/* Asumiendo que 'ven_total' viene en la respuesta */}
    </span>
  </td>
  ```

**Impacto de la Solución:**
Se reduce el número de peticiones de `2 * N + 1` a solo **1** por página. El rendimiento de la tabla mejorará drásticamente.

---

## 2. Problema de Rendimiento: Carga Inicial Masiva de Datos No Esenciales

### Descripción del Problema
Al montar `PresupuestosManager`, se inician simultáneamente más de 9 hooks de API (`useProductosAPI`, `useFamiliasAPI`, etc.). Esto descarga una gran cantidad de datos que solo son necesarios al crear o editar un presupuesto/venta, no para la vista inicial de la tabla.

### Causa Raíz
La estructura de `PresupuestosManager.js` inicializa todos los hooks en el nivel superior, disparando sus `useEffect` de carga inicial.

```javascript
// PresupuestosManager.js
const PresupuestosManager = () => {
    // ...
    const { productos, ... } = useProductosAPI()       // ¡Se ejecuta al montar!
    const { familias, ... } = useFamiliasAPI()         // ¡Se ejecuta al montar!
    const { proveedores, ... } = useProveedoresAPI()   // ¡Se ejecuta al montar!
    // ... y así sucesivamente
```

### Solución Propuesta
Aplicar **Carga Diferida (Lazy Loading)**, de modo que estos datos solo se carguen cuando se abran los formularios correspondientes (`PresupuestoForm`, `VentaForm`, etc.).

**Paso 1: Modificar los Hooks de API**

Modificar cada hook (`useProductosAPI`, `useFamiliasAPI`, etc.) para que no realice el `fetch` inicial automáticamente, eliminando su `useEffect` interno.

- **Antes (`useProductosAPI.js`):**
  ```javascript
  useEffect(() => {
      fetchProductos(); // Carga automática
  }, []);
  ```

- **Después (`useProductosAPI.js`):**
  ```javascript
  // Se elimina el useEffect de carga automática.
  // La función fetchProductos ya existe y puede ser llamada a demanda.
  ```

**Paso 2: Centralizar la Carga de Datos en los Formularios**

Los datos necesarios para los formularios (productos, familias, etc.) se deben pasar como props desde `PresupuestosManager` a los formularios (`VentaForm`, `PresupuestoForm`). La carga de estos datos se puede gestionar en `PresupuestosManager` y activarse solo cuando se abre una pestaña de formulario.

- **Plan:**
  1. En `PresupuestosManager`, mantener los hooks de API como están, pero modificar los hooks para que no se autoejecuten.
  2. Crear un estado `[form_data_loaded, set_form_data_loaded]` en `PresupuestosManager`.
  3. Cuando se abre una pestaña de formulario (`handleNuevo`, `handleEdit`), verificar si `form_data_loaded` es `false`. Si lo es, llamar a todas las funciones `fetch...` necesarias (`fetchProductos`, `fetchFamilias`, etc.) y luego cambiar el estado a `true`.
  4. Pasar los datos (productos, familias, etc.) como props a los componentes de formulario, junto con sus estados de carga. El formulario mostrará un spinner mientras los datos se cargan.

**Impacto de la Solución:**
La carga inicial de `PresupuestosManager` será casi instantánea. El resto de los datos pesados solo se cargarán una vez, la primera vez que el usuario inicie una acción que los requiera.

---

## 3. Problema de Eficiencia: Re-fetch Completo en Operaciones CRUD

### Descripción del Problema
Después de agregar, actualizar o eliminar una venta, `useVentasAPI` vuelve a solicitar la lista completa de ventas de la página actual. Aunque la paginación limita el impacto, es una operación de red innecesaria.

### Causa Raíz
Las funciones `addVenta`, `updateVenta` y `deleteVenta` en `useVentasAPI.js` están diseñadas para llamar a `fetchVentas()` para refrescar el estado.

### Solución Propuesta
Implementar **actualización de estado local**. En lugar de recargar, se manipula el estado `ventas` en el frontend para reflejar el cambio instantáneamente.

**Paso 1: Modificar `addVenta`**

La API de creación (`POST`) debe devolver el objeto recién creado. Se añade este objeto a la lista local.

- **Después:**
  ```javascript
  const res = await fetch('/api/ventas/', ...);
  const nuevaVenta = await res.json(); // La API debe devolver el objeto creado
  setVentas(ventasActuales => [nuevaVenta, ...ventasActuales]);
  ```

**Paso 2: Modificar `updateVenta`**

La API (`PUT`) debe devolver el objeto actualizado. Se busca y reemplaza en la lista local.

- **Después:**
  ```javascript
  const res = await fetch(`/api/ventas/${id}/`, ...);
  const ventaActualizada = await res.json();
  setVentas(ventasActuales =>
      ventasActuales.map(v => (v.id === id ? ventaActualizada : v))
  );
  ```

**Paso 3: Modificar `deleteVenta`**

Tras una eliminación exitosa, se filtra el elemento de la lista local.

- **Después:**
  ```javascript
  await fetch(`/api/ventas/${id}/`, { method: 'DELETE', ... });
  setVentas(ventasActuales => ventasActuales.filter(v => v.id !== id));
  ```

**Consideración sobre Paginación:**
Esta estrategia es compatible con la paginación. Un nuevo elemento se puede añadir al principio de la página actual. Al cambiar de página, se obtendrán los datos frescos, manteniendo la consistencia general sin sacrificar la agilidad de la interfaz.

**Impacto de la Solución:**
La interfaz se sentirá instantánea después de las operaciones CRUD, eliminando la carga innecesaria en el servidor y la red. 