# Lógica de Proveedores en StockForm - Explicación Completa

## ¿Por qué existe esta complejidad?

El sistema de proveedores en StockForm es complejo porque maneja **dos escenarios completamente diferentes**:

1. **Nuevo Producto**: El producto no existe en la base de datos, por lo que todo es "temporal" hasta guardar
2. **Editar Producto**: El producto ya existe y tiene proveedores guardados, pero queremos hacer cambios "temporales" antes de guardar

Esta dualidad requiere **estados separados** para manejar lo que ya está guardado vs lo que está "en proceso".

## El Problema Fundamental: Estados Temporales vs Permanentes

### ¿Por qué necesitamos estados temporales?

Imagina que estás editando un producto que tiene 3 proveedores guardados. Quieres:
- Cambiar la cantidad del proveedor A
- Agregar un nuevo proveedor B
- Cambiar el código del proveedor C

Si actualizáramos la base de datos inmediatamente con cada cambio:
- ❌ Si algo falla en el medio, quedaría inconsistente
- ❌ No podríamos "cancelar" los cambios
- ❌ Sería muy lento (3 llamadas al backend)

**Solución**: Mantener todo en memoria hasta que el usuario presione "Guardar", entonces enviar todo junto.

## Modo Nuevo Producto: Todo es Temporal

### ¿Qué significa "todo es temporal"?

Cuando creas un nuevo producto, **nada existe en la base de datos**. Todo lo que agregas (proveedores, códigos, cantidades) vive solo en la memoria del navegador hasta que guardes.

### Los Tres Estados Temporales

```javascript
const [stockProvePendientes, setStockProvePendientes] = useState([])
const [codigosPendientes, setCodigosPendientes] = useState([])
const [proveedoresAgregados, setProveedoresAgregados] = useState([])
```

**¿Por qué tres estados separados?**

1. **`stockProvePendientes`**: Proveedores que vienen de un formulario anterior (si el usuario ya había empezado a crear el producto)
2. **`codigosPendientes`**: Códigos de proveedor que se han asociado (independiente de si el proveedor está en stockProvePendientes o proveedoresAgregados)
3. **`proveedoresAgregados`**: Proveedores que el usuario agrega manualmente desde el formulario

**¿Por qué esta separación?**
- Un proveedor puede estar en `stockProvePendientes` pero no tener código asociado
- Un código puede estar en `codigosPendientes` pero el proveedor no estar en ningún lado (se agrega automáticamente)
- Un proveedor puede estar en `proveedoresAgregados` pero no tener código

### El Flujo de Agregar Proveedor

#### Escenario 1: Usuario agrega proveedor sin código

**¿Qué pasa?**
1. El usuario selecciona un proveedor del dropdown
2. Presiona "Agregar Proveedor"
3. Se agrega a `proveedoresAgregados` con cantidad=0, costo=0, código=""

**¿Por qué cantidad=0 y costo=0?**
- Es una práctica común: primero agregas el proveedor, luego configuras los detalles
- Evita que el usuario tenga que pensar en números antes de agregar el proveedor

**¿Por qué se marca como `pendiente: true`?**
- Para mostrar visualmente que es un proveedor "nuevo" (fondo amarillo)
- Distingue de proveedores que ya están "confirmados"

#### Escenario 2: Usuario asocia código a proveedor existente

**¿Qué pasa?**
1. El usuario busca un código de proveedor
2. El sistema encuentra el código y sugiere un costo
3. Se agrega a `codigosPendientes` con el código y costo
4. Si el proveedor está en `stockProvePendientes`, se actualiza su costo

**¿Por qué se valida duplicados?**
```javascript
const codigoYaUsado = codigosPendientes.some(
  (c) => c.codigo_producto_proveedor === codigo_producto_proveedor && 
         String(c.proveedor_id) !== String(proveedor_id)
)
```
- Un código de proveedor debe ser único por producto
- Si ya está usado por otro proveedor, no se puede asociar

#### Escenario 3: Usuario asocia código a proveedor que no existe

**¿Qué pasa?**
1. El usuario busca un código
2. El sistema encuentra el código pero el proveedor no está agregado
3. **Se agrega automáticamente** el proveedor a `proveedoresAgregados`
4. Se agrega el código a `codigosPendientes`

**¿Por qué se agrega automáticamente?**
- Experiencia de usuario: si buscas un código de un proveedor, probablemente quieres ese proveedor
- Evita pasos innecesarios

### Cálculo de Stock Total: ¿Por qué es complejo?

```javascript
const stockTotal = (() => {
  const totalPendientes = stockProvePendientes.reduce((sum, sp) => sum + (Number(sp.cantidad) || 0), 0)
  const totalAgregados = proveedoresAgregados.reduce((sum, pa) => sum + (Number(pa.cantidad) || 0), 0)
  return totalPendientes + totalAgregados
})()
```

**¿Por qué sumar ambos?**
- `stockProvePendientes`: Proveedores de formularios anteriores
- `proveedoresAgregados`: Proveedores agregados en esta sesión
- El stock total debe incluir **todos** los proveedores

**¿Por qué `Number(sp.cantidad) || 0`?**
- Los valores pueden venir como strings del formulario
- Si no hay cantidad, debe ser 0, no undefined

### Guardado: ¿Cómo se combina todo?

```javascript
const stockProveedores = [
  ...stockProvePendientes.map((sp) => {
    const codigoPendiente = codigosPendientes.find((c) => String(c.proveedor_id) === String(sp.proveedor))
    return {
      proveedor_id: sp.proveedor,
      cantidad: sp.cantidad,
      costo: sp.costo,
      codigo_producto_proveedor: codigoPendiente ? codigoPendiente.codigo_producto_proveedor : "",
    }
  }),
  ...proveedoresAgregados.map((pa) => {
    const codigoPendiente = codigosPendientes.find((c) => String(c.proveedor_id) === String(pa.proveedor))
    return {
      proveedor_id: pa.proveedor,
      cantidad: pa.cantidad,
      costo: pa.costo,
      codigo_producto_proveedor: codigoPendiente ? codigoPendiente.codigo_producto_proveedor : "",
    }
  })
]
```

**¿Qué hace este código?**
1. **Toma todos los proveedores** de ambos arrays
2. **Para cada proveedor**, busca si tiene un código asociado en `codigosPendientes`
3. **Construye un objeto final** con toda la información combinada

**¿Por qué buscar el código?**
- Los códigos están en un array separado
- Necesitamos "juntar" la información del proveedor con su código

## Modo Editar Producto: La Dualidad

### El Problema de la Edición

Cuando editas un producto existente, tienes:
- **Proveedores guardados** en la base de datos
- **Cambios temporales** que quieres hacer antes de guardar

### Los Dos Tipos de Proveedores

#### 1. Proveedores Existentes (stockProve)
- **¿Qué son?** Proveedores que ya están guardados en la base de datos
- **¿Cómo se cargan?** Se obtienen del backend cuando abres el formulario
- **¿Se pueden modificar?** Sí, pero los cambios son temporales hasta guardar

#### 2. Proveedores Agregados Durante Edición (codigosPendientesEdicion)
- **¿Qué son?** Proveedores que agregas durante esta sesión de edición
- **¿Dónde se guardan?** Solo en memoria, no en la base de datos
- **¿Cuándo se guardan?** Cuando presionas "Guardar"

### ¿Por qué un solo estado para cambios?

```javascript
const [codigosPendientesEdicion, setCodigosPendientesEdicion] = useState([])
```

**¿Por qué no separar como en modo nuevo?**
- En edición, **todos** los cambios son temporales
- No hay diferencia conceptual entre "cambiar existente" vs "agregar nuevo"
- Es más simple manejar todo en un solo lugar

### El Flujo de Edición de Proveedores Existentes

#### ¿Qué pasa cuando editas cantidad/costo?

**Antes (StockForm viejo):**
1. Cambiabas cantidad
2. Se llamaba inmediatamente a `updateStockProve()`
3. Se actualizaba la base de datos
4. Se recargaban los datos

**Ahora (StockForm modular):**
1. Cambias cantidad
2. Se agrega a `codigosPendientesEdicion`
3. Se actualiza `form.stock_proveedores` para mostrar el cambio en la UI
4. **No se toca la base de datos hasta guardar**

**¿Por qué este cambio?**
- **Consistencia**: Todos los cambios se manejan igual
- **Velocidad**: No hay llamadas al backend por cada cambio
- **Cancelación**: Puedes cancelar todos los cambios de una vez

#### ¿Cómo se identifica qué cambiar?

```javascript
const handleEditStockProveSave = async (id) => {
  // Para proveedores existentes, actualizar codigosPendientesEdicion
  const proveedorId = sp.proveedor?.id || sp.proveedor
  setCodigosPendientesEdicion((prev) => {
    const otros = prev.filter((c) => String(c.proveedor_id) !== String(proveedorId))
    return [...otros, { 
      proveedor_id: proveedorId,
      cantidad: cantidadNum,
      costo: sp.costo, // Mantener el costo actual
      codigo_producto_proveedor: sp.codigo_producto_proveedor || ""
    }]
  })
}
```

**¿Qué hace este código?**
1. **Encuentra el proveedor** por su ID
2. **Elimina cualquier cambio previo** para ese proveedor
3. **Agrega el nuevo cambio** con la cantidad actualizada
4. **Mantiene el costo y código** que ya tenía

**¿Por qué eliminar cambios previos?**
- Si ya habías cambiado la cantidad antes, ese cambio se sobrescribe
- Solo se guarda el estado final

### El Flujo de Agregar Proveedor en Edición

#### ¿Qué pasa cuando agregas un proveedor nuevo?

```javascript
const handleAgregarProveedorEdicion = () => {
  // Verificar si el proveedor ya existe
  const yaExisteEnStock = stockProveForThisStock.some((sp) => 
    String(sp.proveedor?.id || sp.proveedor) === String(proveedorId)
  )
  const yaExisteEnPendientes = codigosPendientesEdicion.some((c) => 
    String(c.proveedor_id) === String(proveedorId)
  )
  
  // Agregar a codigosPendientesEdicion
  setCodigosPendientesEdicion((prev) => [
    ...prev,
    {
      proveedor_id: proveedorId,
      cantidad: Number(newStockProve.cantidad) || 0,
      costo: Number(newStockProve.costo) || 0,
      codigo_producto_proveedor: "", // Sin código asociado
    }
  ])
}
```

**¿Por qué verificar duplicados?**
- No puedes agregar el mismo proveedor dos veces
- Se verifica tanto en proveedores existentes como en cambios pendientes

**¿Por qué agregar a `codigosPendientesEdicion`?**
- Es el estado que maneja **todos** los cambios temporales
- Se incluye automáticamente en el guardado

### Asociar Código en Edición: El Caso Más Complejo

#### ¿Qué pasa cuando asocias un código?

```javascript
const handleAsociarCodigoPendiente = async ({ proveedor_id, codigo_producto_proveedor, costo }) => {
  // Validar contra códigos ya asociados
  const codigosActuales = [
    ...stockProve.map((sp) => sp.codigo_producto_proveedor).filter(Boolean),
    ...codigosPendientesEdicion.map((c) => c.codigo_producto_proveedor),
  ]
  
  // Agregar a codigosPendientesEdicion
  setCodigosPendientesEdicion((prev) => {
    const otros = prev.filter((c) => String(c.proveedor_id) !== String(proveedor_id))
    return [...otros, { proveedor_id, codigo_producto_proveedor, costo, cantidad: 0 }]
  })
}
```

**¿Por qué validar contra códigos existentes?**
- Un código debe ser único por producto
- Se verifica tanto en proveedores guardados como en cambios pendientes

**¿Por qué `cantidad: 0`?**
- Si el proveedor no existía, se agrega con cantidad 0
- Si ya existía, se mantiene su cantidad actual

**¿Por qué se actualiza `form.stock_proveedores`?**
- Para que la UI muestre inmediatamente el cambio
- El usuario ve el código asociado sin esperar a guardar

### Cálculo de Stock Total en Edición: La Lógica Compleja

```javascript
const stockTotal = (() => {
  if (stock?.id) {
    // En modo edición, sumar stockProveForThisStock y proveedores agregados en edición
    const totalStockProve = stockProveForThisStock.reduce((sum, sp) => sum + (Number(sp.cantidad) || 0), 0)
    const totalPendientesEdicion = codigosPendientesEdicion
      .filter((pendiente) => {
        // Solo incluir si no está en stockProve (proveedores agregados durante la edición)
        return !stockProve.some((sp) => 
          sp.stock === stock.id && 
          String(sp.proveedor?.id || sp.proveedor) === String(pendiente.proveedor_id)
        )
      })
      .reduce((sum, pendiente) => sum + (Number(pendiente.cantidad) || 0), 0)
    return totalStockProve + totalPendientesEdicion
  }
})()
```

**¿Por qué es tan complejo?**

1. **`totalStockProve`**: Suma las cantidades de proveedores existentes
2. **`totalPendientesEdicion`**: Suma las cantidades de proveedores agregados durante la edición
3. **El filtro**: Excluye proveedores que ya están en `stockProve` para no duplicar

**¿Por qué el filtro?**
- Un proveedor puede estar tanto en `stockProve` (existente) como en `codigosPendientesEdicion` (con cambios)
- Solo queremos contar una vez

### Guardado en Edición: La Combinación Final

```javascript
const stockProveedores = [
  // Proveedores existentes con sus cambios
  ...stockProve
    .filter((sp) => sp.stock === stock.id)
    .map((sp) => {
      // Si hay un pendiente de edición para este proveedor, usar su código/costo/cantidad
      const pendiente = codigosPendientesEdicion.find(
        (c) => String(c.proveedor_id) === String(sp.proveedor?.id || sp.proveedor),
      )
      return {
        proveedor_id: sp.proveedor?.id || sp.proveedor,
        cantidad: pendiente && pendiente.cantidad !== undefined ? pendiente.cantidad : sp.cantidad,
        costo: pendiente && pendiente.costo !== undefined ? pendiente.costo : sp.costo,
        codigo_producto_proveedor: pendiente
          ? pendiente.codigo_producto_proveedor
          : sp.codigo_producto_proveedor || "",
      }
    }),
  // Proveedores agregados durante la edición
  ...codigosPendientesEdicion
    .filter((pendiente) => {
      // Solo incluir si no está en stockProve
      return !stockProve.some((sp) => 
        sp.stock === stock.id && 
        String(sp.proveedor?.id || sp.proveedor) === String(pendiente.proveedor_id)
      )
    })
    .map((pendiente) => ({
      proveedor_id: pendiente.proveedor_id,
      cantidad: pendiente.cantidad || 0,
      costo: pendiente.costo || 0,
      codigo_producto_proveedor: pendiente.codigo_producto_proveedor || "",
    }))
]
```

**¿Qué hace este código?**

1. **Para cada proveedor existente**:
   - Busca si tiene cambios pendientes
   - Si tiene cambios, usa los valores pendientes
   - Si no tiene cambios, usa los valores guardados

2. **Para proveedores agregados durante la edición**:
   - Solo incluye los que no están en `stockProve`
   - Usa los valores de `codigosPendientesEdicion`

**¿Por qué esta lógica?**
- Los proveedores existentes pueden tener cambios
- Los proveedores nuevos solo están en `codigosPendientesEdicion`
- No queremos duplicar proveedores

## Edge Cases: ¿Por qué son importantes?

### 1. Proveedor con Código Existente - Cambiar Código

**¿Qué pasa?**
- El proveedor ya tiene un código guardado
- El usuario lo cambia por otro código
- El proveedor se marca como "pendiente" (fondo amarillo)

**¿Por qué fondo amarillo?**
- Indica visualmente que hay cambios pendientes
- Distingue de proveedores sin cambios

### 2. Proveedor sin Código - Asociar Código

**¿Qué pasa?**
- El proveedor no tiene código asociado
- El usuario le asigna un código
- Se mantiene la cantidad/costo actual

**¿Por qué mantener cantidad/costo?**
- El usuario ya configuró esos valores
- Solo está agregando información (el código)

### 3. Código Duplicado

**¿Qué pasa?**
- El usuario intenta asociar un código que ya está en uso
- Se muestra un error
- No se permite la asociación

**¿Por qué esta validación?**
- Un código debe ser único por producto
- Evita confusión en el sistema

### 4. Proveedor Habitual Automático

**¿Qué pasa?**
- Si hay un solo proveedor, se autocompleta como "proveedor habitual"
- El campo se deshabilita

**¿Por qué esta lógica?**
- Si solo hay un proveedor, obviamente es el habitual
- Mejora la experiencia del usuario

## Identificación Visual: ¿Por qué es importante?

### Fondo Amarillo (Pendiente)

```javascript
const esProveedorAgregado = modo === "nuevo" && sp.id && String(sp.id).startsWith("agregado-")
const esProveedorAgregadoEdicion = isEdicion && sp.pendiente && (
  (sp.id && String(sp.id).startsWith("pendiente-") && !sp.codigo_producto_proveedor) ||
  (sp.id && !String(sp.id).startsWith("pendiente-") && sp.pendiente)
)
```

**¿Qué indica?**
- Proveedor agregado en modo nuevo
- Proveedor agregado durante edición
- Proveedor existente con cambios pendientes

**¿Por qué es importante?**
- El usuario sabe qué cambios están pendientes
- Puede cancelar si ve muchos cambios no deseados

### Fondo Gris (Normal)

**¿Qué indica?**
- Proveedor existente sin cambios pendientes

**¿Por qué es importante?**
- El usuario sabe qué está "confirmado"
- Distingue de cambios temporales

## Validaciones: ¿Por qué son críticas?

### 1. Validación de Códigos Duplicados

**¿Por qué es crítica?**
- Un código duplicado puede causar confusión
- Puede romper la integridad de datos

### 2. Validación de Proveedores Duplicados

**¿Por qué es crítica?**
- No tiene sentido tener el mismo proveedor dos veces
- Puede causar inconsistencias en el stock

### 3. Validación de Cantidad/Costo

**¿Por qué es crítica?**
- Valores inválidos pueden romper cálculos
- Puede causar errores en el backend

## Resumen: ¿Por qué esta complejidad?

### El Problema Original
- Necesitamos manejar cambios temporales
- Necesitamos distinguir entre "guardado" y "en proceso"
- Necesitamos validar datos antes de enviar al backend

### La Solución
- **Estados separados** para diferentes tipos de datos
- **Validaciones en tiempo real** para evitar errores
- **Identificación visual** para que el usuario entienda el estado
- **Guardado atómico** para consistencia

### El Resultado
- El usuario puede hacer cambios complejos sin perder datos
- El sistema mantiene la integridad de los datos
- La experiencia es fluida y predecible

Esta complejidad existe porque estamos manejando un **sistema de datos complejo** (productos con múltiples proveedores, códigos, cantidades, costos) con **requisitos de UX** (cambios temporales, cancelación, validación) en un **entorno web** (memoria vs persistencia).
