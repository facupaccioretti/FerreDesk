
# Documentación Técnica y Funcional: Módulos de Productos y Clientes

Este documento detalla el funcionamiento de los módulos de `Productos` y `Clientes` en el sistema FerreDesk v0. Está dirigido a desarrolladores y personal técnico para facilitar el entendimiento, mantenimiento y extensión de estas funcionalidades.

Ambos módulos están construidos sobre un esquema de base de datos preexistente, lo que se refleja en los nombres de tablas y campos que no siguen las convenciones estándar de Django.

---

## 1. Módulo de Productos

Este módulo gestiona el catálogo de productos, su stock, costos, proveedores y precios. La lógica de precios es indirecta: no se almacena un precio de venta final, sino que se calcula a partir del costo y un margen de ganancia.

### 1.1. Backend (Django)

#### 1.1.1. Modelos de Datos (`productos/models.py`)

-   **`Stock`**: Es el modelo central que representa un **producto**.
    -   `codvta`: Código de venta (identificador principal para el usuario).
    -   `deno`: Denominación o nombre del producto.
    -   `margen`: Porcentaje de margen de ganancia que se aplica sobre el costo para calcular el precio de venta (sin IVA).
    -   `proveedor_habitual`: `ForeignKey` a `Proveedor`, indica el proveedor por defecto.
    -   `idfam1`, `idfam2`, `idfam3`: `ForeignKey` a `Familia`, para categorización.
    -   `acti`: Estado del producto ('S' para activo, 'N' para inactivo).

-   **`StockProve`**: Vincula un producto (`Stock`) con un proveedor (`Proveedor`).
    -   `costo`: El precio de compra del producto a ese proveedor específico. **Este es el campo clave para el cálculo de precios**.
    -   `cantidad`: La cantidad de stock disponible de ese producto para ese proveedor.
    -   `codigo_producto_proveedor`: Código que usa el proveedor para identificar el producto. Esencial para la actualización de precios desde Excel.

-   **`Proveedor`**: Almacena la información de los proveedores.

-   **`AlicuotaIVA`**: Define los diferentes tipos de IVA (ej. 21%, 10.5%). El `Stock` se asocia a una de estas alícuotas.

-   **`PrecioProveedorExcel`**: Tabla temporal para la carga masiva de listas de precios desde archivos Excel.

-   **`VistaStockProducto`**: Modelo no gestionado (`managed = False`) que mapea a una **vista de base de datos**. Esta vista calcula el stock total de un producto sumando las cantidades de todos sus registros `StockProve` asociados. Se usa para consultas rápidas de stock total.

-   **`Ferreteria`**: Modelo de configuración global que almacena parámetros como la situación de IVA del negocio, el punto de venta, CUIT, etc.

#### 1.1.2. API Endpoints (`productos/views.py`)

Se exponen a través de `rest_framework.viewsets.ModelViewSet`, proveyendo endpoints RESTful para operaciones CRUD.

-   `/api/stock/`: ABM del modelo `Stock` (productos).
-   `/api/proveedores/`: ABM de `Proveedor`.
-   `/api/stockprove/`: ABM de la relación `StockProve`.
-   `/api/familias/` y `/api/alicuotas-iva/`: ABM para los modelos de soporte.

**Endpoints Personalizados:**

-   **`POST /api/productos/upload-lista-precios/{proveedor_id}/`**:
    -   **Función:** Permite subir un archivo Excel con la lista de precios de un proveedor.
    -   **Lógica:** Lee el archivo, extrae código de producto y precio, y los guarda en `PrecioProveedorExcel`. Luego, actualiza el campo `costo` en los registros `StockProve` correspondientes que coincidan por `codigo_producto_proveedor`.

-   **`GET /api/productos/precio-proveedor/`**:
    -   **Función:** Obtiene el costo más actualizado de un producto para un proveedor.
    -   **Lógica:** Compara la fecha del costo en `StockProve` (actualización manual) con la fecha del precio en `PrecioProveedorExcel` (última subida de lista) y devuelve el más reciente.

-   **`POST /api/productos/asociar-codigo-proveedor/`**:
    -   **Función:** Asocia el código interno de un producto (`Stock`) con el código que usa un proveedor (`codigo_producto_proveedor` en `StockProve`).

-   **`POST /api/productos/crear/` y `PUT /api/productos/editar/`**:
    -   **Función:** Endpoints atómicos que permiten crear o editar un producto (`Stock`) y sus relaciones con proveedores (`StockProve`) en una sola transacción.

### 1.2. Frontend (React)

#### 1.2.1. Componente Principal (`components/Productos/ProductosManager.js`)

-   **Orquestación:** Es el componente padre que gestiona todo el estado y la lógica de la sección de productos.
-   **Hooks API:** Utiliza hooks personalizados para interactuar con el backend:
    -   `useProductosAPI`: Para el CRUD de productos.
    -   `useProveedoresAPI`, `useFamiliasAPI`, `useStockProveAPI`: Para gestionar las entidades relacionadas.
-   **Interfaz de Pestañas:** La UI se organiza en pestañas que se guardan en `localStorage` para persistencia:
    -   Pestañas fijas: "Lista de Productos" y "Productos Inactivos".
    -   Pestañas dinámicas: "Nuevo Producto" y "Editar Producto: [nombre]".
-   **Componentes Hijos:**
    -   `ProductosTable.js`: Muestra la tabla de productos con filtros y buscador.
    -   `StockForm.js`: Formulario para la creación y edición de productos.

---

## 2. Módulo de Clientes

Este módulo se encarga de la gestión de la base de datos de clientes, incluyendo su información personal, fiscal y comercial.

### 2.1. Backend (Django)

#### 2.1.1. Modelos de Datos (`clientes/models.py`)

-   **`Cliente`**: El modelo principal que representa a un cliente.
    -   `codigo`: Código numérico interno.
    -   `razon`: Razón social.
    -   `fantasia`: Nombre de fantasía.
    -   `cuit`: CUIT del cliente.
    -   `iva`: `ForeignKey` a `TipoIVA`, define la condición fiscal del cliente (Responsable Inscripto, Consumidor Final, etc.). Esto es **crítico** para la emisión de comprobantes.
    -   `lineacred`: Límite de crédito.
    -   Relaciones: `ForeignKey` a `Localidad`, `Provincia`, `Barrio`, `Transporte`, `Vendedor`, `Plazo`, `CategoriaCliente`.
    -   `acti`: Estado del cliente ('A' para activo).

-   **Modelos de Soporte**:
    -   `Localidad`, `Provincia`, `Barrio`: Datos geográficos.
    -   `TipoIVA`: Tipos de condición frente al IVA.
    -   `Transporte`, `Vendedor`, `Plazo`, `CategoriaCliente`: Entidades relacionadas para la gestión comercial.

#### 2.1.2. API Endpoints (`clientes/views.py`)

-   `/api/clientes/`: Endpoint principal para el ABM de `Cliente`.
    -   **Búsqueda y Filtro:** Soporta búsqueda de texto libre por múltiples campos (razón, fantasía, cuit, etc.) y filtrado por campos específicos.
    -   **Serializador Optimizado:** Utiliza un `ClienteBusquedaSerializer` más ligero para las respuestas de búsqueda, mejorando el rendimiento.
    -   **Protección de Borrado:** Impide eliminar un cliente que tenga ventas (`Venta`) asociadas, devolviendo un `ProtectedError`.
-   **`/api/clientes/cliente_por_defecto/`**:
    -   **Función:** Endpoint específico que devuelve el cliente con `id=1`, que usualmente es el "Consumidor Final" para ventas sin identificar.
-   **Endpoints de Listas**:
    -   Se proveen endpoints de solo lectura (ej. `/api/localidades/`, `/api/tipos-iva/`) para poblar los menús desplegables en el frontend.

### 2.2. Frontend (React)

#### 2.2.1. Componente Principal (`components/Clientes/ClientesManager.js`)

-   **Estructura:** Sigue el mismo patrón que `ProductosManager.js`, actuando como el componente orquestador.
-   **Hooks API:**
    -   `useClientesAPI`: Para el CRUD de clientes.
    -   Una serie de hooks (`useLocalidadesAPI`, `useProvinciasAPI`, etc.) para obtener los datos de las entidades relacionadas y pasarlos a los componentes hijos.
-   **Interfaz de Pestañas:** Implementa el mismo sistema de pestañas persistentes en `localStorage`.
-   **Componentes Hijos:**
    -   `ClientesTable.js`: Renderiza la lista de clientes con búsqueda y paginación.
    -   `ClienteForm.js`: El formulario para dar de alta o modificar un cliente.
-   **Lógica de Búsqueda:** Incluye un `debounce` de 300ms en la barra de búsqueda para no sobrecargar al backend con peticiones mientras el usuario escribe. 