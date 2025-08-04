# Ítems genéricos en FerreDesk

En el sistema distinguimos entre **ítems de stock** (reales) y **ítems genéricos** (cargados manualmente) siguiendo dos criterios complementarios: la estructura de datos en la base y la lógica implementada en el frontend.

---

## 1. Identificación de un ítem genérico

1. **Base de datos (tabla `VENTA_DETAITEM`)**  
   • Si el campo `vdi_idsto` contiene un valor (ID de producto), el ítem está vinculado a un registro de stock.  
   • Si `vdi_idsto` es `NULL`, la fila corresponde a un ítem genérico y su descripción se guarda en `vdi_detalle1`.

```108:116:ferredesk_v0/backend/ferreapps/ventas/models.py
    vdi_idsto = models.IntegerField(db_column='VDI_IDSTO', null=True, blank=True)
```

2. **Frontend (`ItemsGrid.js`)**  
   • Cada fila mantiene la clave `row.producto`.  
   • Cuando el usuario selecciona un producto, se almacena el objeto completo; si la fila se rellena sólo con texto (columna *Detalle*), `row.producto` permanece `null`.

```370:378:ferredesk_v0/frontend/src/components/Presupuestos y Ventas/ItemsGrid.js
const esGenerico = !fila.producto
```

---

## 2. Tratamiento del costo y margen en ítems genéricos

Al editar la columna *Precio Unitario* de un ítem genérico, el sistema realiza estos pasos:

1. El precio ingresado incluye IVA.  
2. Se calcula el **precio base sin IVA** dividiendo por \(1 + \text{IVA}\).  
3. **Costo = Precio base** (se asigna a `vdi_costo`).  
4. **Margen = 0 %** (campo `vdi_margen`).

Fragmento relevante:

```384:395:ferredesk_v0/frontend/src/components/Presupuestos y Ventas/ItemsGrid.js
if (esGenerico) {
    // Ítem genérico: el precio base pasa a ser también el costo.
    fila.vdi_costo = Number.isFinite(precioBase) ? precioBase : 0
    fila.margen    = 0
} else {
    // Ítem de stock: el costo permanece fijo; recalculamos margen.
    const costo = Number.parseFloat(fila.vdi_costo ?? fila.producto?.costo ?? 0)
    ...
}
```

De esta forma, para los genéricos:

- **El costo coincide** con el precio unitario sin IVA ingresado.  
- **No se aplica margen de ganancia.**  
- Estos valores se envían al backend sin modificaciones adicionales y se persisten tal cual en la base de datos.

---

## 3. Resumen operativo

| Tipo de ítem | `vdi_idsto` | `row.producto` | Costo (`vdi_costo`) | Margen (`vdi_margen`) |
|--------------|-------------|----------------|---------------------|-----------------------|
| Stock        | ID > 0      | Objeto producto| Se mantiene el costo del stock | Se recalcula según precio ingresado |
| Genérico     | `NULL`      | `null`         | Precio sin IVA       | 0 % |

Esta convención simplifica el análisis de márgenes y asegura que la base de datos conserve siempre precios **sin IVA**, tal como exigen nuestros requisitos fiscales. 