# Guía Integral de Arquitectura y Funcionamiento de FerreDesk

## 1. Introducción General
FerreDesk es una plataforma integral de gestión para ferreterías, diseñada para centralizar y optimizar todos los procesos comerciales y administrativos. El sistema está construido bajo una arquitectura modular, donde cada módulo (clientes, productos, ventas, proveedores, stock, vendedores, etc.) cumple un rol específico pero se integra de manera orgánica con el resto, formando un ecosistema robusto y coherente.

Esta guía describe en profundidad cómo funciona cada módulo, cómo se relacionan entre sí y cómo se orquesta el flujo de información y operaciones en la plataforma.

---

## 2. Arquitectura General del Sistema

### 2.1 Backend
- **Framework:** Django + Django REST Framework (DRF).
- **Base de datos:** SQLite (desarrollo) / PostgreSQL (producción).
- **Estructura:** El backend está dividido en aplicaciones Django independientes dentro de `ferreapps/`, cada una representando un dominio de negocio.
- **API REST:** Todos los datos y operaciones se exponen a través de endpoints RESTful, consumidos por el frontend.

### 2.2 Frontend
- **Framework:** React (SPA).
- **Estilos:** Tailwind CSS.
- **Comunicación:** El frontend interactúa exclusivamente con la API del backend, utilizando hooks personalizados para la obtención y manipulación de datos.

---

## 3. Módulos Principales y Relaciones

### 3.1 Clientes
- **Propósito:** Gestionar la información de los clientes (razón social, CUIT, domicilio, condición frente al IVA, etc.).
- **Relación con Ventas:**
  - Cada venta o presupuesto está asociado a un cliente mediante el campo `ven_idcli`.
  - La condición frente al IVA del cliente es fundamental para determinar el tipo de comprobante a emitir y el cálculo de impuestos.
  - Los datos del cliente (nombre, domicilio, CUIT) se utilizan en la impresión y visualización de comprobantes.
- **Operaciones:** Alta, baja, modificación y consulta de clientes. Los formularios y tablas permiten gestionar todos los datos relevantes.

### 3.2 Productos y Stock
- **Propósito:** Administrar el catálogo de productos y el stock disponible.
- **Estructura:**
  - Cada producto tiene atributos como código, descripción, unidad de medida, precio de costo, margen, etc. y una sola alícuota de IVA.
  - El stock se gestiona por producto y proveedor, permitiendo saber cuántas unidades hay disponibles de cada producto para cada proveedor.
- **Relación con Ventas:**
  - Los ítems de una venta o presupuesto (`VentaDetalleItem`) hacen referencia directa a productos y a su stock mediante los campos `vdi_idsto` (ID de stock) y `vdi_idpro` (ID de proveedor).
  - El precio, la unidad, el porcentaje de IVA y otros datos del producto se utilizan para calcular los importes y el IVA de cada ítem (a través de las vistas calculadas en ventas/presupuestos).
- **Relación con Proveedores:**
  - Cada producto puede estar asociado a uno o varios proveedores. El stock se gestiona por proveedor, permitiendo saber de quién se compra cada producto y a qué costo.
- **Operaciones:** Alta, baja, modificación y consulta de productos y stock. Importación de listas de precios, ajuste de stock, historial de movimientos, etc.

### 3.3 Proveedores
- **Propósito:** Gestionar la información de los proveedores (razón social, CUIT, condiciones comerciales, etc.).
- **Relación con Productos:**
  - Cada producto puede tener uno o varios proveedores asociados. Esto permite gestionar múltiples fuentes de abastecimiento y comparar precios/costos.
  - El stock de cada producto se desglosa por proveedor, permitiendo un control granular de inventario y compras.
- **Relación con Ventas:**
  - Al vender un producto, se descuenta el stock del proveedor correspondiente, lo que permite mantener la trazabilidad de la mercadería y optimizar la reposición.
  - Si en una venta se cargan mas productos de los que el proveedor habitual contiene, se restan automaticamente los del resto de proveedores.
- **Operaciones:** Alta, baja, modificación y consulta de proveedores. Asociación de productos a proveedores, gestión de condiciones comerciales, etc.

### 3.4 Vendedores
- **Propósito:** Administrar los datos de los vendedores (nombre, comisión, estado, etc.).
- **Relación con Ventas:**
  - Cada venta o presupuesto puede estar asociado a un vendedor (`ven_idvdo`).
  - Permite calcular comisiones, hacer reportes de desempeño y filtrar ventas por vendedor.
- **Operaciones:** Alta, baja, modificación y consulta de vendedores. Asignación de ventas, reportes, etc.

### 3.5 Ventas y Presupuestos
- **Propósito:** Gestionar el ciclo completo de ventas y presupuestos, desde la carga inicial hasta la facturación y el seguimiento.
- **Estructura:**
  - **Tablas base:** `Venta`, `VentaDetalleItem`.
  - **Vistas calculadas:** `VENTA_CALCULADO`, `VENTADETALLEITEM_CALCULADO`, `VENTA_ALICUOTA` (solo para ventas y presupuestos).
- **Relaciones:**
  - Cada venta/presupuesto está asociado a un cliente, un vendedor, un comprobante y uno o varios ítems (productos + proveedor + cantidad).
  - Los ítems de la venta referencian productos y proveedores, y utilizan los datos de ambos para los cálculos.
- **Flujo de trabajo:**
  1. El usuario crea un presupuesto o venta, seleccionando cliente, vendedor y agregando ítems (producto, proveedor, cantidad, bonificación, etc.).
  2. El sistema guarda solo los datos base en las tablas físicas.
  3. Los importes, totales e IVAs se calculan dinámicamente a través de las vistas SQL cuando se consulta la venta/presupuesto.
  4. El frontend consume los endpoints de solo lectura para mostrar la información calculada.
  5. Al convertir un presupuesto en venta, se actualiza el stock y se asigna el comprobante correspondiente.
- **Operaciones:** Alta, edición, conversión de presupuestos a ventas, impresión de comprobantes, consulta de historial, etc.

### 3.6 Comprobantes
- **Propósito:** Gestionar los diferentes tipos de comprobantes (facturas, presupuestos, remitos, etc.) y su lógica asociada.
- **Relación con Ventas:**
  - Cada venta/presupuesto tiene un comprobante asignado, que determina la numeración, la letra, el tipo y la lógica fiscal.
  - La condición frente al IVA del cliente y de la ferretería determina qué tipo de comprobante se debe emitir.
- **Operaciones:** Alta, baja, modificación y consulta de comprobantes. Asignación automática según reglas fiscales.

### 3.7 Usuarios y Seguridad
- **Propósito:** Gestionar los usuarios del sistema, sus roles y permisos.
- **Relación con el resto del sistema:**
  - El acceso a las operaciones está protegido por autenticación y, eventualmente, por permisos según el rol del usuario.
- **Operaciones:** Registro, login, gestión de sesiones, protección de rutas sensibles, etc.

---

## 4. Relaciones y Ecosistema de Datos

### 4.1 Relación Cliente-Venta
- Un cliente puede tener muchas ventas/presupuestos.
- La condición fiscal del cliente afecta el tipo de comprobante y el cálculo de impuestos.
- Los datos del cliente se usan en la visualización e impresión de comprobantes.
- Un cliente que tenga algun movimiento registrado en el sistema no se puede eliminar, se puede marcar como desactivado.

### 4.2 Relación Producto-Proveedor-Stock
- Un producto puede tener varios proveedores.
- El stock se gestiona por producto y proveedor, permitiendo saber exactamente de quién proviene cada unidad en inventario.
- Al vender, se descuenta el stock del proveedor correspondiente.

### 4.3 Relación Venta-Producto-Proveedor
- Cada ítem de una venta referencia un producto y un proveedor.
- El precio, la unidad, el IVA y el costo se obtienen del producto y del proveedor asociado.
- El stock se descuenta del proveedor correcto, manteniendo la trazabilidad.

### 4.4 Relación Venta-Vendedor
- Cada venta/presupuesto puede estar asignado a un vendedor.
- Permite reportes de desempeño y cálculo de comisiones.

### 4.5 Relación General
- Todos los módulos están interconectados: una venta involucra clientes, productos, stock, proveedores, vendedores y comprobantes.
- El sistema garantiza la integridad referencial y la coherencia de los datos en todas las operaciones.

---

## 5. Flujo de Datos y Operaciones Típicas

### 5.1 Alta de Cliente
- El usuario accede al formulario de alta de cliente, completa los datos y los envía.
- El backend valida y guarda el cliente en la base de datos.
- El cliente queda disponible para ser seleccionado en ventas y presupuestos.

### 5.2 Alta de Producto y Stock
- El usuario crea un producto, define sus atributos y asocia uno o varios proveedores.
- Se carga el stock inicial por proveedor.
- El producto queda disponible para ser vendido y para la gestión de inventario.

### 5.3 Alta de Proveedor
- El usuario registra un proveedor y lo asocia a productos existentes o nuevos.
- Se pueden cargar condiciones comerciales y listas de precios.

### 5.4 Alta de Vendedor
- El usuario da de alta un vendedor, que podrá ser asignado a ventas y presupuestos.

### 5.5 Creación de Presupuesto/Venta
- El usuario selecciona cliente, vendedor, ítems (producto + proveedor + cantidad).
- El sistema guarda los datos base.
- Los importes, IVAs y totales se calculan dinámicamente al consultar la venta/presupuesto.
- El stock se descuenta solo al confirmar la venta (no en el presupuesto).

### 5.6 Consulta y Visualización
- El frontend utiliza hooks personalizados para obtener los datos de cada módulo.
- Para ventas/presupuestos, se consultan las vistas calculadas para mostrar los importes y totales.
- Para el resto de los módulos, se consultan directamente las tablas base.

### 5.7 Conversión de Presupuesto a Venta
- El usuario convierte un presupuesto en venta.
- El sistema asigna el comprobante, actualiza el stock y registra la operación.

### 5.8 Reportes y Listados
- El sistema permite filtrar, buscar y listar datos de todos los módulos (ventas por cliente, stock por proveedor, desempeño de vendedores, etc.).

---

## 6. Buenas Prácticas y Consideraciones
- **Centralización de la lógica de cálculo:** Solo ventas/presupuestos usan vistas SQL para cálculos. El resto de los módulos usan lógica CRUD tradicional.
- **Integridad referencial:** Todas las relaciones están protegidas a nivel de base de datos y de aplicación.
- **Evitar duplicidad de lógica:** Los cálculos de importes, IVAs y totales nunca se replican en el frontend ni en el backend fuera de las vistas.
- **Escalabilidad:** La arquitectura modular permite agregar nuevos módulos o relaciones sin afectar el núcleo del sistema.
- **Seguridad:** El acceso a los datos y operaciones está protegido por autenticación y, eventualmente, por permisos.

---

## 7. Conclusión
FerreDesk es un ecosistema digital donde cada módulo cumple un rol específico pero se integra perfectamente con el resto. La arquitectura garantiza datos consistentes, operaciones seguras y una experiencia de usuario fluida. Esta guía debe servir como referencia para entender cómo y por qué funciona cada parte del sistema, y cómo interactúan entre sí para cubrir todas las necesidades de gestión de una ferretería moderna. 