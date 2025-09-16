# Base de Datos - FerreDesk

## Resumen General

FerreDesk es un sistema de gestión para ferreterías que incluye módulos para ventas, compras, stock, clientes, proveedores, y más. El sistema utiliza Django como framework backend con una base de datos SQLite.

## Apps y Modelos

### 1. Alertas (`ferreapps.alertas`)

**Modelos:**
- **Alerta**: Sistema de alertas del sistema
  - `titulo` (CharField): Título de la alerta
  - `descripcion` (TextField): Descripción detallada
  - `tipo` (CharField): Tipo de alerta (stock, vencimiento, pago, otro)
  - `prioridad` (CharField): Prioridad (baja, media, alta)
  - `fecha_creacion` (DateTimeField): Fecha de creación
  - `fecha_vencimiento` (DateTimeField): Fecha de vencimiento
  - `activa` (BooleanField): Estado de la alerta
  - `usuario` (ForeignKey): Usuario asociado

- **Notificacion**: Sistema de notificaciones
  - `titulo` (CharField): Título de la notificación
  - `mensaje` (TextField): Mensaje de la notificación
  - `tipo` (CharField): Tipo (sistema, venta, compra, stock, otro)
  - `fecha_creacion` (DateTimeField): Fecha de creación
  - `leida` (BooleanField): Estado de lectura
  - `usuario` (ForeignKey): Usuario asociado

**Vistas:**
- `AlertaViewSet`: CRUD completo para alertas
- `NotificacionViewSet`: CRUD completo para notificaciones
- Acciones personalizadas: marcar como resuelta/leída, obtener activas/no leídas

### 2. Clientes (`ferreapps.clientes`)

**Modelos:**
- **Localidad**: Localidades geográficas
  - `id` (AutoField): ID único
  - `nombre` (CharField): Nombre de la localidad
  - `activo` (CharField): Estado activo/inactivo

- **Provincia**: Provincias
  - `id` (AutoField): ID único
  - `nombre` (CharField): Nombre de la provincia
  - `activo` (CharField): Estado activo/inactivo

- **Barrio**: Barrios
  - `id` (AutoField): ID único
  - `nombre` (CharField): Nombre del barrio
  - `cpostal` (CharField): Código postal
  - `activo` (CharField): Estado activo/inactivo

- **TipoIVA**: Tipos de IVA
  - `id` (AutoField): ID único
  - `nombre` (CharField): Nombre del tipo de IVA

- **Transporte**: Empresas de transporte
  - `id` (AutoField): ID único
  - `nombre` (CharField): Nombre de la empresa
  - `domicilio` (CharField): Domicilio
  - `tel1`, `tel2`, `fax` (CharField): Teléfonos
  - `cuit` (CharField): CUIT
  - `localidad` (ForeignKey): Localidad asociada
  - `activo` (CharField): Estado activo/inactivo

- **Vendedor**: Vendedores
  - `id` (AutoField): ID único
  - `nombre` (CharField): Nombre del vendedor
  - `domicilio` (CharField): Domicilio
  - `dni` (CharField): DNI
  - `tel` (CharField): Teléfono
  - `comivta`, `liquivta`, `comicob`, `liquicob` (DecimalField/CharField): Comisiones
  - `localidad` (ForeignKey): Localidad asociada
  - `activo` (CharField): Estado activo/inactivo

- **Plazo**: Plazos de pago
  - `id` (AutoField): ID único
  - `nombre` (CharField): Nombre del plazo
  - `pla_pla1` a `pla_pla12` (SmallIntegerField): Plazos
  - `pla_por1` a `pla_por12` (DecimalField): Porcentajes
  - `activo` (CharField): Estado activo/inactivo

- **CategoriaCliente**: Categorías de clientes
  - `id` (AutoField): ID único
  - `nombre` (CharField): Nombre de la categoría
  - `activo` (CharField): Estado activo/inactivo

- **Cliente**: Clientes principales
  - `id` (AutoField): ID único
  - `razon` (CharField): Razón social (único) **[ÍNDICE]**
  - `fantasia` (CharField): Nombre de fantasía
  - `domicilio` (CharField): Domicilio
  - `tel1`, `tel2`, `tel3` (CharField): Teléfonos
  - `email` (CharField): Email
  - `cuit` (CharField): CUIT (único) **[ÍNDICE]**
  - `ib` (CharField): Ingresos Brutos
  - `status` (SmallIntegerField): Status
  - `iva` (ForeignKey): Tipo de IVA
  - `contacto` (CharField): Persona de contacto
  - `comentario` (CharField): Comentarios
  - `lineacred` (IntegerField): Línea de crédito
  - `impsalcta` (DecimalField): Importe saldo cuenta
  - `fecsalcta` (DateField): Fecha saldo cuenta
  - `descu1`, `descu2`, `descu3` (DecimalField): Descuentos
  - `cpostal` (CharField): Código postal
  - `zona` (CharField): Zona
  - `cancela` (CharField): Cancelación
  - `barrio` (ForeignKey): Barrio
  - `localidad` (ForeignKey): Localidad
  - `provincia` (ForeignKey): Provincia
  - `transporte` (ForeignKey): Transporte
  - `vendedor` (ForeignKey): Vendedor
  - `plazo` (ForeignKey): Plazo de pago
  - `categoria` (ForeignKey): Categoría
  - `activo` (CharField): Estado activo/inactivo **[ÍNDICE]**

**Vistas:**
- ViewSets para todos los modelos maestros
- `ClienteViewSet`: CRUD completo con filtros avanzados
- `ValidarCUITAPIView`: Validación de CUITs
- `ProcesarCuitArcaAPIView`: Consulta de datos fiscales en ARCA/AFIP

### 3. Compras (`ferreapps.compras`)

**Modelos:**
- **Compra**: Cabecera de compras
  - `comp_id` (AutoField): ID único
  - `comp_sucursal` (SmallIntegerField): Sucursal
  - `comp_fecha` (DateField): Fecha de compra **[ÍNDICE]**
  - `comp_hora_creacion` (TimeField): Hora de creación
  - `comp_numero_factura` (CharField): Número de factura completo **[ÍNDICE]**
  - `comp_tipo` (CharField): Tipo (COMPRA, COMPRA_INTERNA) **[ÍNDICE]**
  - `comp_idpro` (ForeignKey): Proveedor **[ÍNDICE]**
  - `comp_cuit` (CharField): CUIT del proveedor
  - `comp_razon_social` (CharField): Razón social del proveedor
  - `comp_domicilio` (CharField): Domicilio del proveedor
  - `comp_observacion` (TextField): Observaciones
  - `comp_numero_factura_proveedor` (CharField): Número interno del proveedor
  - `comp_fecha_factura_proveedor` (DateField): Fecha de factura del proveedor
  - `comp_total_final` (DecimalField): Total final con impuestos
  - `comp_importe_neto` (DecimalField): Importe neto sin impuestos
  - `comp_iva_21`, `comp_iva_10_5`, `comp_iva_27`, `comp_iva_0` (DecimalField): IVAs por alícuota
  - `comp_verificacion_total` (DecimalField): Campo calculado de verificación
  - `comp_estado` (CharField): Estado (BORRADOR, CERRADA, ANULADA) **[ÍNDICE]**
  - `comp_fecha_anulacion` (DateField): Fecha de anulación

- **CompraDetalleItem**: Detalle de items de compra
  - `cdi_idca` (ForeignKey): Compra asociada **[ÍNDICE]**
  - `cdi_orden` (SmallIntegerField): Orden del item
  - `cdi_idsto` (ForeignKey): Producto en stock **[ÍNDICE]**
  - `cdi_idpro` (ForeignKey): Proveedor **[ÍNDICE]**
  - `cdi_cantidad` (DecimalField): Cantidad comprada
  - `cdi_costo` (DecimalField): Costo unitario
  - `cdi_detalle1` (CharField): Denominación del producto
  - `cdi_detalle2` (CharField): Unidad de medida
  - `cdi_idaliiva` (ForeignKey): Alícuota de IVA

- **OrdenCompra**: Órdenes de compra
  - `ord_id` (AutoField): ID único
  - `ord_sucursal` (SmallIntegerField): Sucursal
  - `ord_fecha` (DateField): Fecha de la orden **[ÍNDICE]**
  - `ord_hora_creacion` (TimeField): Hora de creación
  - `ord_numero` (CharField): Número de orden interno **[ÍNDICE]**
  - `ord_idpro` (ForeignKey): Proveedor **[ÍNDICE]**
  - `ord_cuit` (CharField): CUIT del proveedor
  - `ord_razon_social` (CharField): Razón social del proveedor
  - `ord_domicilio` (CharField): Domicilio del proveedor
  - `ord_observacion` (TextField): Observaciones
  - `ord_estado` (CharField): Estado (ABIERTO, CERRADO)

- **OrdenCompraDetalleItem**: Detalle de items de orden de compra
  - `odi_idor` (ForeignKey): Orden de compra asociada **[ÍNDICE]**
  - `odi_orden` (SmallIntegerField): Orden del item
  - `odi_idsto` (ForeignKey): Producto en stock **[ÍNDICE]**
  - `odi_idpro` (ForeignKey): Proveedor **[ÍNDICE]**
  - `odi_stock_proveedor` (ForeignKey): Relación con StockProve
  - `odi_cantidad` (DecimalField): Cantidad solicitada
  - `odi_detalle1` (CharField): Denominación del producto
  - `odi_detalle2` (CharField): Unidad de medida

**Vistas:**
- `CompraViewSet`: CRUD completo para compras
- `CompraDetalleItemViewSet`: CRUD para items de compra
- `OrdenCompraViewSet`: CRUD completo para órdenes de compra
- `OrdenCompraDetalleItemViewSet`: CRUD para items de orden
- Acciones personalizadas: cerrar compra, anular compra, estadísticas
- `convertir_orden_compra_a_compra`: Conversión de órdenes a compras

### 4. Informes (`ferreapps.informes`)

**Modelos:**
- No tiene modelos propios, utiliza vistas existentes

**Vistas:**
- Utiliza la vista `VistaStockProducto` para informes de stock bajo

### 5. Login (`ferreapps.login`)

**Modelos:**
- No tiene modelos propios

**Vistas:**
- Sistema de autenticación básico

### 6. Notas (`ferreapps.notas`)

**Modelos:**
- **Nota**: Sistema de notas
  - `titulo` (CharField): Título de la nota
  - `contenido` (TextField): Contenido de la nota
  - `fecha_creacion` (DateTimeField): Fecha de creación
  - `fecha_modificacion` (DateTimeField): Fecha de modificación
  - `fecha_caducidad` (DateTimeField): Fecha de caducidad
  - `es_importante` (BooleanField): Marca de importancia
  - `ultimo_acceso` (DateTimeField): Último acceso
  - `color` (CharField): Color de la nota
  - `emoji` (CharField): Emoji de la nota
  - `usuario` (ForeignKey): Usuario propietario
  - `estado` (CharField): Estado (AC, AR, EL)
  - `categoria` (CharField): Categoría
  - `etiquetas` (TextField): Etiquetas
  - `metadata` (TextField): Metadatos JSON
  - `numero` (IntegerField): Número secuencial

**Vistas:**
- `NotaViewSet`: CRUD completo con filtros por estado
- Acciones personalizadas: marcar importante, archivar, restaurar, eliminar
- `estadisticas`: Estadísticas de notas por usuario

### 7. Productos (`ferreapps.productos`)

**Modelos:**
- **Ferreteria**: Configuración de la ferretería
  - `nombre` (CharField): Nombre de la ferretería
  - `direccion` (CharField): Dirección
  - `telefono` (CharField): Teléfono
  - `email` (EmailField): Email
  - `activa` (BooleanField): Estado activo
  - `fecha_creacion` (DateTimeField): Fecha de creación
  - `situacion_iva` (CharField): Situación IVA (RI, MO)
  - `punto_venta_arca` (CharField): Punto de venta ARCA
  - `cuit_cuil` (CharField): CUIT/CUIL
  - `razon_social` (CharField): Razón social
  - `ingresos_brutos` (CharField): Ingresos Brutos
  - `inicio_actividad` (DateField): Inicio de actividad
  - `logo_empresa` (ImageField): Logo de la empresa
  - `certificado_arca` (FileField): Certificado ARCA
  - `clave_privada_arca` (FileField): Clave privada ARCA
  - `modo_arca` (CharField): Modo ARCA (HOM, PROD)
  - `arca_habilitado` (BooleanField): ARCA habilitado
  - `permitir_stock_negativo` (BooleanField): Permitir stock negativo
  - `arca_configurado` (BooleanField): ARCA configurado
  - `arca_ultima_validacion` (DateTimeField): Última validación ARCA
  - `arca_error_configuracion` (TextField): Error de configuración ARCA

- **Categoria**: Categorías de productos
  - `nombre` (CharField): Nombre de la categoría
  - `descripcion` (TextField): Descripción

- **Producto**: Productos (modelo legacy)
  - `codigo` (CharField): Código único
  - `nombre` (CharField): Nombre del producto
  - `descripcion` (TextField): Descripción
  - `categoria` (ForeignKey): Categoría
  - `precio_compra` (DecimalField): Precio de compra
  - `precio_venta` (DecimalField): Precio de venta
  - `stock` (IntegerField): Stock
  - `stock_minimo` (IntegerField): Stock mínimo
  - `ferreteria` (ForeignKey): Ferretería
  - `activo` (BooleanField): Estado activo
  - `fecha_creacion` (DateTimeField): Fecha de creación
  - `fecha_actualizacion` (DateTimeField): Fecha de actualización

- **Proveedor**: Proveedores
  - `id` (AutoField): ID único
  - `razon` (CharField): Razón social
  - `fantasia` (CharField): Nombre de fantasía
  - `domicilio` (CharField): Domicilio
  - `tel1`, `tel2`, `tel3` (CharField): Teléfonos
  - `cuit` (CharField): CUIT (único)
  - `ib` (CharField): Ingresos Brutos
  - `cpostal` (CharField): Código postal
  - `iva` (SmallIntegerField): IVA
  - `contacto` (CharField): Persona de contacto
  - `impsalcta` (DecimalField): Importe saldo cuenta
  - `fecsalcta` (DateField): Fecha saldo cuenta
  - `idbar`, `idloc`, `idprv`, `idcap` (IntegerField): IDs de ubicación
  - `acti` (CharField): Estado activo/inactivo
  - `sigla` (CharField): Sigla única

- **Stock**: Productos en stock (modelo principal)
  - `id` (IntegerField): ID único
  - `codvta` (CharField): Código de venta (único)
  - `deno` (CharField): Denominación
  - `orden` (SmallIntegerField): Orden
  - `unidad` (CharField): Unidad de medida
  - `margen` (DecimalField): Margen
  - `cantmin` (IntegerField): Cantidad mínima
  - `idaliiva` (ForeignKey): Alícuota de IVA
  - `idfam1`, `idfam2`, `idfam3` (ForeignKey): Familias
  - `proveedor_habitual` (ForeignKey): Proveedor habitual **[ÍNDICE]**
  - `acti` (CharField): Estado activo/inactivo **[ÍNDICE]**

- **StockProve**: Relación stock-proveedor
  - `stock` (ForeignKey): Producto
  - `proveedor` (ForeignKey): Proveedor **[ÍNDICE]**
  - `cantidad` (DecimalField): Cantidad en stock
  - `costo` (DecimalField): Costo
  - `fecultcan` (DateField): Fecha última cantidad
  - `fecultcos` (DateField): Fecha último costo
  - `fecha_actualizacion` (DateTimeField): Fecha de actualización
  - `codigo_producto_proveedor` (CharField): Código del producto en el proveedor
  - **Índices compuestos**: `stock, proveedor`

- **Familia**: Familias de productos
  - `id` (AutoField): ID único
  - `deno` (CharField): Denominación
  - `comentario` (CharField): Comentario
  - `nivel` (CharField): Nivel
  - `acti` (CharField): Estado activo/inactivo

- **AlicuotaIVA**: Alícuotas de IVA
  - `id` (AutoField): ID único
  - `codigo` (CharField): Código único
  - `deno` (CharField): Denominación
  - `porce` (DecimalField): Porcentaje

- **PrecioProveedorExcel**: Precios desde Excel
  - `proveedor` (ForeignKey): Proveedor
  - `codigo_producto_excel` (CharField): Código del producto en Excel
  - `precio` (DecimalField): Precio
  - `denominacion` (CharField): Denominación desde Excel
  - `fecha_carga` (DateTimeField): Fecha de carga
  - `nombre_archivo` (CharField): Nombre del archivo

- **ProductoTempID**: IDs temporales para productos
  - `id` (IntegerField): ID único
  - `fecha_creacion` (DateTimeField): Fecha de creación

- **VistaStockProducto**: Vista de stock total (no gestionada)
  - `id` (IntegerField): ID único
  - `denominacion` (CharField): Denominación
  - `codigo_venta` (CharField): Código de venta
  - `cantidad_minima` (IntegerField): Cantidad mínima
  - `stock_total` (DecimalField): Stock total
  - `necesita_reposicion` (IntegerField): Necesita reposición
  - `proveedor_razon` (CharField): Razón social del proveedor
  - `proveedor_fantasia` (CharField): Fantasía del proveedor

**Vistas:**
- `ProveedorViewSet`: CRUD completo para proveedores
- `StockViewSet`: CRUD completo para productos
- `StockProveViewSet`: CRUD para relaciones stock-proveedor
- `FamiliaViewSet`: CRUD para familias
- `AlicuotaIVAViewSet`: CRUD para alícuotas IVA
- `VistaStockProductoViewSet`: Vista de solo lectura para stock
- `FerreteriaAPIView`: Configuración de ferretería
- `UploadListaPreciosProveedor`: Carga de listas de precios
- `PrecioProductoProveedorAPIView`: Consulta de precios
- `HistorialListasProveedorAPIView`: Historial de listas
- `BuscarDenominacionesSimilaresAPIView`: Búsqueda de productos similares
- Endpoints para servir logos

### 8. Proveedores (`ferreapps.proveedores`)

**Modelos:**
- **HistorialImportacionProveedor**: Historial de importaciones
  - `proveedor` (ForeignKey): Proveedor
  - `fecha` (DateTimeField): Fecha de importación
  - `nombre_archivo` (CharField): Nombre del archivo
  - `registros_procesados` (IntegerField): Registros procesados
  - `registros_actualizados` (IntegerField): Registros actualizados

**Vistas:**
- `ProveedorViewSet`: CRUD completo para proveedores
- `HistorialImportacionesProveedorAPIView`: Historial de importaciones
- `CargaInicialProveedorPreviaAPIView`: Vista previa de carga inicial
- `CargaInicialProveedorImportAPIView`: Importación de carga inicial

### 9. Reservas (`ferreapps.reservas`)

**Modelos:**
- **ReservaStock**: Reservas de stock
  - `producto` (ForeignKey): Producto
  - `proveedor` (ForeignKey): Proveedor
  - `cantidad` (DecimalField): Cantidad reservada
  - `usuario` (ForeignKey): Usuario
  - `session_key` (CharField): Clave de sesión
  - `timestamp_creacion` (DateTimeField): Timestamp de creación
  - `timestamp_expiracion` (DateTimeField): Timestamp de expiración
  - `estado` (CharField): Estado (activa, confirmada, cancelada, expirada)
  - `tipo_operacion` (CharField): Tipo de operación
  - `operacion_id` (IntegerField): ID de la operación
  - `ferreteria` (ForeignKey): Ferretería
  - `detalles` (TextField): Detalles

- **FormLock**: Bloqueos de formularios
  - `tipo` (CharField): Tipo (venta, presupuesto, conversion)
  - `usuario` (ForeignKey): Usuario
  - `session_key` (CharField): Clave de sesión
  - `timestamp_creacion` (DateTimeField): Timestamp de creación
  - `timestamp_expiracion` (DateTimeField): Timestamp de expiración
  - `presupuesto_id` (IntegerField): ID del presupuesto
  - `ferreteria` (ForeignKey): Ferretería

**Vistas:**
- `ReservaStockViewSet`: CRUD para reservas de stock
- `FormLockViewSet`: CRUD para bloqueos de formularios
- Acciones personalizadas: confirmar, cancelar, renovar, liberar

### 10. Usuarios (`ferreapps.usuarios`)

**Modelos:**
- **Usuario**: Usuarios del sistema (extiende AbstractUser)
  - `tipo_usuario` (CharField): Tipo (admin, cli_admin, cli_user, prueba, auditor)
  - `ferreteria` (ForeignKey): Ferretería asociada

- **CliUsuario**: Perfil de usuario cliente
  - `user` (OneToOneField): Usuario
  - `cuenta_activa` (BooleanField): Cuenta activa
  - `fecha_creacion` (DateTimeField): Fecha de creación
  - `ultima_modificacion` (DateTimeField): Última modificación

- **Auditoria**: Auditoría del sistema
  - `usuario` (ForeignKey): Usuario
  - `accion` (CharField): Acción realizada
  - `timestamp` (DateTimeField): Timestamp
  - `objeto_afectado` (CharField): Objeto afectado
  - `detalles` (TextField): Detalles
  - `session_key` (CharField): Clave de sesión

**Vistas:**
- `register`: Registro de usuarios

### 11. Ventas (`ferreapps.ventas`)

**Modelos:**
- **Comprobante**: Tipos de comprobantes
  - `codigo_afip` (CharField): Código AFIP (único)
  - `nombre` (CharField): Nombre del comprobante
  - `descripcion` (CharField): Descripción
  - `letra` (CharField): Letra del comprobante
  - `tipo` (CharField): Tipo (factura, recibo, nota de crédito, etc.)
  - `activo` (BooleanField): Estado activo

- **Venta**: Cabecera de ventas
  - `ven_id` (AutoField): ID único
  - `ven_sucursal` (SmallIntegerField): Sucursal
  - `ven_fecha` (DateField): Fecha de venta **[ÍNDICE]**
  - `hora_creacion` (TimeField): Hora de creación
  - `comprobante` (ForeignKey): Comprobante
  - `ven_punto` (SmallIntegerField): Punto de venta
  - `ven_numero` (IntegerField): Número de venta
  - `ven_descu1`, `ven_descu2`, `ven_descu3` (DecimalField): Descuentos
  - `ven_vdocomvta`, `ven_vdocomcob` (DecimalField): Comisiones vendedor
  - `ven_estado` (CharField): Estado **[ÍNDICE]**
  - `ven_idcli` (ForeignKey): Cliente **[ÍNDICE]**
  - `ven_cuit` (CharField): CUIT del cliente
  - `ven_dni` (CharField): DNI del cliente
  - `ven_domicilio` (CharField): Domicilio del cliente
  - `ven_razon_social` (CharField): Razón social del cliente
  - `ven_idpla` (IntegerField): Plazo
  - `ven_idvdo` (IntegerField): Vendedor
  - `ven_copia` (SmallIntegerField): Copia
  - `ven_fecanula` (DateField): Fecha de anulación
  - `ven_cae` (CharField): CAE
  - `ven_caevencimiento` (DateField): Vencimiento CAE
  - `ven_qr` (BinaryField): Código QR
  - `ven_observacion` (TextField): Observaciones
  - `ven_bonificacion_general` (FloatField): Bonificación general
  - `ven_vence` (DateField): Fecha de vencimiento
  - `comprobantes_asociados` (ManyToManyField): Comprobantes asociados
  - **Índices compuestos**: `ven_fecha, ven_estado`

- **VentaDetalleItem**: Detalle de items de venta
  - `vdi_idve` (ForeignKey): Venta asociada
  - `vdi_orden` (SmallIntegerField): Orden del item
  - `vdi_idsto` (IntegerField): Producto en stock
  - `vdi_idpro` (IntegerField): Proveedor
  - `vdi_cantidad` (DecimalField): Cantidad
  - `vdi_costo` (DecimalField): Costo
  - `vdi_margen` (DecimalField): Margen
  - `vdi_precio_unitario_final` (DecimalField): Precio unitario final
  - `vdi_bonifica` (DecimalField): Bonificación
  - `vdi_detalle1` (CharField): Denominación
  - `vdi_detalle2` (CharField): Unidad
  - `vdi_idaliiva` (IntegerField): Alícuota de IVA
  - **Índices compuestos**: `vdi_idve, vdi_orden`

- **VentaDetalleMan**: Detalle manual de ventas
  - `vdm_idve` (IntegerField): Venta asociada
  - `vdm_orden` (SmallIntegerField): Orden
  - `vdm_deno` (CharField): Denominación
  - `vdm_importe` (DecimalField): Importe
  - `vdm_exento` (CharField): Exento

- **VentaRemPed**: Remitos y pedidos
  - `vrp_id` (AutoField): ID único
  - `vrp_sucursal` (SmallIntegerField): Sucursal
  - `vrp_orden` (SmallIntegerField): Orden
  - `vrp_fecha` (DateField): Fecha
  - `vrp_tipo` (CharField): Tipo
  - `vrp_letra` (CharField): Letra
  - `vrp_punto` (SmallIntegerField): Punto
  - `vrp_idcli` (IntegerField): Cliente
  - `vrp_numero` (IntegerField): Número
  - `vrp_idsto` (IntegerField): Producto
  - `vrp_deno` (CharField): Denominación
  - `vrp_cantidad` (DecimalField): Cantidad
  - `vrp_importe` (DecimalField): Importe
  - `vrp_cantiusa` (DecimalField): Cantidad usada
  - `vrp_bonifica` (DecimalField): Bonificación
  - `vrp_pretot` (BigIntegerField): Precio total
  - `vrp_ref` (CharField): Referencia
  - `vrp_presenta` (CharField): Presentación
  - `vrp_cortado` (CharField): Cortado
  - `vrp_piezas` (SmallIntegerField): Piezas

- **VentaDetalleItemCalculado**: Vista calculada de items (no gestionada)
  - Campos calculados para precios, IVA, totales, etc.

- **VentaIVAAlicuota**: Vista de IVA por alícuota (no gestionada)
  - `id` (BigIntegerField): ID único
  - `vdi_idve` (IntegerField): Venta
  - `ali_porce` (DecimalField): Porcentaje de alícuota
  - `neto_gravado` (DecimalField): Neto gravado
  - `iva_total` (DecimalField): IVA total

- **VentaCalculada**: Vista calculada de ventas (no gestionada)
  - Campos calculados para totales, datos de cliente, etc.

- **ComprobanteAsociacion**: Asociación de comprobantes
  - `nota_credito` (ForeignKey): Nota de crédito
  - `factura_afectada` (ForeignKey): Factura afectada

**Vistas:**
- `ComprobanteViewSet`: CRUD para comprobantes
- `VentaViewSet`: CRUD completo para ventas con lógica de stock
- `VentaDetalleItemViewSet`: CRUD para items de venta
- `VentaDetalleManViewSet`: CRUD para detalles manuales
- `VentaRemPedViewSet`: CRUD para remitos y pedidos
- `VentaDetalleItemCalculadoViewSet`: Vista de solo lectura para items calculados
- `VentaIVAAlicuotaViewSet`: Vista de solo lectura para IVA
- `VentaCalculadaViewSet`: Vista de solo lectura para ventas calculadas
- `convertir_presupuesto_a_venta`: Conversión de presupuestos a ventas
- `convertir_factura_interna_a_fiscal`: Conversión de facturas internas a fiscales
- Endpoints de dashboard: productos más vendidos, ventas por día, clientes con más ventas

## Vistas SQL (No Gestionadas)

### VISTA_STOCK_PRODUCTO
Vista que calcula el stock total por producto sumando las cantidades de todos los proveedores.

### VENTADETALLEITEM_CALCULADO
Vista que calcula precios, IVA y totales para cada item de venta.

### VENTAIVA_ALICUOTA
Vista que agrupa el IVA por alícuota para cada venta.

### VENTA_CALCULADO
Vista que calcula totales y agrega datos de cliente para cada venta.

## Características del Sistema

### Integración ARCA/AFIP
- Emisión automática de comprobantes fiscales
- Validación de CUITs
- Consulta de datos fiscales
- Generación de códigos QR

### Gestión de Stock
- Stock distribuido entre múltiples proveedores
- Reservas de stock
- Alertas de stock bajo
- Actualización automática en ventas/compras

### Sistema de Comprobantes
- Múltiples tipos de comprobantes
- Asignación automática según tipo de cliente
- Conversión entre tipos de comprobantes
- Asociación de notas de crédito con facturas

### Auditoría y Seguridad
- Registro de auditoría
- Bloqueos de formularios
- Gestión de sesiones
- Tipos de usuario con permisos diferenciados

### Reportes y Dashboard
- Productos más vendidos
- Ventas por período
- Clientes con más ventas
- Estadísticas de stock

## Notas Técnicas

- El sistema utiliza transacciones atómicas para operaciones críticas
- Las vistas SQL optimizan el rendimiento de consultas complejas
- El sistema soporta múltiples proveedores por producto
- La integración con ARCA permite emisión fiscal automática
- Los modelos utilizan nombres de campos en español para mayor claridad
