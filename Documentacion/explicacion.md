# Explicación del Sistema de Imputaciones de Cuenta Corriente

## Resumen del Sistema

Este documento explica la nueva arquitectura del sistema de imputaciones de cuenta corriente implementado en FerreDesk. El sistema se basa en un **modelo transaccional con lógica de negocio en la aplicación**, donde la base de datos almacena hechos inmutables y el código Python calcula los estados derivados.

## Conceptos Fundamentales

### 1. La Tabla `IMPUTACION_VENTA` - El Corazón del Sistema

La tabla `IMPUTACION_VENTA` es el núcleo del sistema. No representa un movimiento en sí mismo, sino el **vínculo explícito** entre un comprobante que paga (recibo/crédito) y un comprobante que se paga (factura).

#### Estructura de la Tabla:

```sql
CREATE TABLE IMPUTACION_VENTA (
    IMP_ID INTEGER PRIMARY KEY,           -- ID único de la imputación
    IMP_ID_VENTA INTEGER,                 -- ID de la factura que se está pagando
    IMP_ID_RECIBO INTEGER,                -- ID del recibo/crédito que está pagando
    IMP_FECHA DATE,                       -- Fecha de la imputación
    IMP_MONTO DECIMAL(15,2),              -- Monto específico imputado
    IMP_OBSERVACION VARCHAR(200)          -- Observaciones opcionales
);
```

#### Campos Eliminados:
- **`IMP_USUARIO`**: Se eliminó porque el usuario ya está registrado en el comprobante de pago (recibo/crédito). Evita redundancia y mantiene la integridad referencial.

### 2. Ejemplo Práctico del Funcionamiento

Imaginemos un cliente "Construcciones S.A." con los siguientes movimientos:

#### Paso 1: Se genera una Factura (Débito)
- Se crea una `Venta` con `ven_id = 101`
- Es una **Factura A** por **$10,000**
- El cliente ahora debe $10,000

#### Paso 2: El cliente hace un pago parcial (Crédito)
- Se crea otra `Venta` con `ven_id = 102`
- Es un **Recibo X** por **$6,000**
- El cliente tiene $6,000 disponibles para aplicar

#### Paso 3: Se imputa el pago a la factura
- Se crea una fila en `IMPUTACION_VENTA`:
  ```sql
  INSERT INTO IMPUTACION_VENTA VALUES (
      1,                              -- IMP_ID
      101,                            -- IMP_ID_VENTA (factura)
      102,                            -- IMP_ID_RECIBO (recibo)
      '2025-01-07',                   -- IMP_FECHA
      4000.00,                        -- IMP_MONTO
      'Pago parcial de factura 101'   -- IMP_OBSERVACION
  );
  ```

#### Paso 4: Análisis de Saldos

**¿Cuánto se ha pagado de la Factura 101?**
```sql
SELECT SUM(imp_monto) 
FROM IMPUTACION_VENTA 
WHERE imp_id_venta = 101;
-- Resultado: $4,000
-- Saldo pendiente: $10,000 - $4,000 = $6,000
```

**¿Cuánto hemos usado del Recibo 102?**
```sql
SELECT SUM(imp_monto) 
FROM IMPUTACION_VENTA 
WHERE imp_id_recibo = 102;
-- Resultado: $4,000
-- Saldo disponible: $6,000 - $4,000 = $2,000
```

## Vistas SQL Sumarizadoras

### Ubicación: Base de Datos (PostgreSQL)

Las siguientes vistas SQL implementan la lógica de negocio para calcular saldos de manera eficiente:

#### 1. `VISTA_IMPUTACIONES_RECIBIDAS`
- **Propósito**: Sumariza por `imp_id_venta` para saber cuánto se le ha imputado a cada factura
- **SQL**: `SELECT imp_id_venta, SUM(imp_monto) FROM IMPUTACION_VENTA GROUP BY imp_id_venta`
- **Uso**: Para calcular el saldo pendiente de facturas

#### 2. `VISTA_IMPUTACIONES_REALIZADAS`
- **Propósito**: Sumariza por `imp_id_recibo` para saber cuánto se ha usado de cada recibo
- **SQL**: `SELECT imp_id_recibo, SUM(imp_monto) FROM IMPUTACION_VENTA GROUP BY imp_id_recibo`
- **Uso**: Para calcular el saldo disponible de recibos/créditos

#### 3. `CUENTA_CORRIENTE_CLIENTE` (Actualizada)
- **Propósito**: Vista principal con todos los movimientos y saldos calculados
- **Lógica**: 
  - `saldo_pendiente` para facturas: `ven_total - COALESCE(vir.monto_total_imputado, 0)`
  - `saldo_pendiente` para recibos/créditos: `ven_total - COALESCE(vis.monto_total_usado, 0)`
- **Uso**: Para mostrar el estado completo de cuenta corriente del cliente

## Ventajas de Este Enfoque

### 1. **Rendimiento Optimizado**
- Las vistas SQL están optimizadas por PostgreSQL
- Agregaciones y sumas se ejecutan a nivel de base de datos
- No hay transferencia de datos innecesaria entre DB y aplicación

### 2. **Fuente Única de Verdad**
- Los `IMPUTACION_VENTA` son los "hechos"
- Las vistas SQL calculan los saldos automáticamente
- Elimina inconsistencias y cálculos duplicados

### 3. **Escalabilidad**
- PostgreSQL maneja eficientemente las consultas complejas
- Las vistas se pueden indexar para mejor rendimiento
- No hay límites de memoria en el servidor de aplicación

### 4. **Simplicidad de Consulta**
- El frontend puede consultar directamente las vistas
- No necesita lógica compleja en el backend
- Consultas estándar de Django ORM

### 5. **Auditoría Perfecta**
- Traza completa de todas las imputaciones
- Reconstrucción del estado en cualquier punto del tiempo
- Historial inmutable de transacciones

## Casos de Uso Típicos

### 1. **Crear una Factura**
```python
# Se crea la Venta normalmente
# No se crea nada en IMPUTACION_VENTA (aún)
# El saldo pendiente = ven_total
```

### 2. **Crear un Recibo**
```python
# Se crea la Venta normalmente
# No se crea nada en IMPUTACION_VENTA (aún)
# El saldo disponible = ven_total
```

### 3. **Imputar un Pago**
```python
# Se crea registro en IMPUTACION_VENTA
# Se actualizan automáticamente los saldos pendientes/disponibles
# Validaciones: mismo cliente, montos coherentes
```

### 4. **Consultar Estado de Cuenta**
```python
# Se consulta directamente la vista CUENTA_CORRIENTE_CLIENTE
# Los saldos ya están calculados automáticamente
# Se muestra historial ordenado por fecha
```

## Validaciones Implementadas

### 1. **Integridad Referencial**
- `imp_id_venta` y `imp_id_recibo` deben existir
- Ambos deben pertenecer al mismo cliente
- No se puede imputar una venta a sí misma

### 2. **Consistencia de Montos**
- `imp_monto` debe ser positivo
- No se puede imputar más del saldo pendiente de la factura
- No se puede usar más del saldo disponible del recibo

### 3. **Restricciones de Base de Datos**
- `unique_together` en `['imp_id_venta', 'imp_id_recibo', 'imp_fecha']`
- Índices optimizados para consultas frecuentes
- Constraints para validar montos positivos

## Migración y Compatibilidad

### Cambios Realizados:
1. **Eliminación de `imp_usuario`** del modelo `ImputacionVenta`
2. **Creación de vistas SQL sumarizadoras** para cálculos eficientes
3. **Actualización del admin** para reflejar los cambios
4. **Recreación de migraciones** para estado limpio

### Estructura Final:
1. **`IMPUTACION_VENTA`**: Tabla principal con hechos inmutables
2. **`VISTA_IMPUTACIONES_RECIBIDAS`**: Sumarización por factura
3. **`VISTA_IMPUTACIONES_REALIZADAS`**: Sumarización por recibo/crédito
4. **`CUENTA_CORRIENTE_CLIENTE`**: Vista principal con saldos calculados

Este sistema proporciona una base sólida, escalable y mantenible para el manejo de cuentas corrientes en FerreDesk.
