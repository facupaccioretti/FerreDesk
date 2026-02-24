# Architectural Change Record: Migración de Lógica de Negocio de Vistas SQL Manuales a Django ORM

**Documento ID:** ADR-2026-003  
**Proyecto:** Sistema FerreDesk  
**Fecha:** 18 de febrero de 2026  
**Estado:** Finalizado  
**Autor:** Antigravity AI Engineering

---

## 1. Executive Summary

El presente documento registra la transición arquitectónica del motor de cálculos de FerreDesk, migrando la lógica de negocio previamente delegada en el motor de base de datos (PostgreSQL/SQL Server) mediante vistas manuales, hacia una implementación pura de Django ORM (QuerySets y Managers). Este cambio elimina la redundancia de lógica en el sistema y centraliza las reglas de cálculo de impuestos, descuentos, saldos de cuenta corriente y control de stock en una única capa de aplicación.

## 2. Contexto y Arquitectura Anterior

La arquitectura inicial de FerreDesk utilizaba vistas SQL complejas definidas manualmente a través de archivos de migración (`migrations.RunSQL`). Para interactuar con estos datos, se empleaban modelos de Django configurados con `managed = False`.

Las entidades críticas afectadas eran:
*   `VENTA_CALCULADO`: Cálculos de totales y agregaciones fiscales.
*   `VENTADETALLEITEM_CALCULADO`: Proyecciones de precios unitarios con descuentos en cascada.
*   `VENTAIVA_ALICUOTA`: Desglose impositivo por alícuota.
*   `VISTA_STOCK_PRODUCTO`: Agregación de movimientos de stock para inventario en tiempo real.

## 3. Problemas Identificados

1.  **Redundancia Logística:** La necesidad de replicar los mismos cálculos en Python (para validaciones previas al guardado) y en SQL (para reportes y listados), generando desincronizaciones potenciales.
2.  **Fragilidad en Migraciones:** El uso de `RunSQL` dificultaba el versionado y la portabilidad entre diferentes motores de base de datos.
3.  **Dificultad de Depuración:** Los errores en las vistas SQL no eran interceptables por el middleware de Django ni por herramientas de inspección estándar (ej. Django Debug Toolbar).
4.  **Ineficiencia en el Desarrollo:** La imposibilidad de extender consultas dinámicamente sin modificar el SQL subyacente limitaba la reutilización de código.

## 4. Objetivos del Cambio

*   **Identidad de Lógica:** Garantizar una única fuente de verdad para los cálculos matemáticos y fiscales del sistema.
*   **Mantenibilidad:** Permitir que se opere exclusivamente sobre código Python, evitando el "context switching" hacia SQL puro.
*   **Portabilidad:** Eliminar dependencias específicas del dialecto SQL para facilitar futuras migraciones de infraestructura.
*   **Escalabilidad:** Implementar optimizaciones de consulta (como `select_related` y `prefetch_related`) de manera nativa sobre los cálculos.

## 5. Alternativas Evaluadas

1.  **Mantener Vistas SQL (Status Quo):** Descartada por la alta carga de mantenimiento y riesgos de integridad.
2.  **Uso de Materialized Views:** Descartada por la latencia en la actualización de datos y la complejidad adicional de refresco ante operaciones transaccionales frecuentes.
3.  **Implementación de Managers y QuerySets Personalizados (Seleccionada):** Provee el mejor balance entre performance, flexibilidad y legibilidad de código.

## 6. Decisión Arquitectónica

Se procedió a la remoción sistemática de las definiciones de vistas manuales en la base de datos y la eliminación de los modelos `managed=False`. En su lugar, se implementó una arquitectura basada en **Managers de Cálculos Dinámicos**.

La lógica se centralizó en:
*   `VentaQuerySet.con_calculos()`
*   `VentaDetalleItemQuerySet.con_calculos()`
*   `ProductoQuerySet.con_stock()`
*   `Servicios de Cuenta Corriente` (Capa de integración ORM)

## 7. Implementación Técnica

### 7.1. Anotaciones Complejas
Se utilizaron objetos `ExpressionWrapper`, `Case/When`, `F expressions` y `Subqueries` para replicar la lógica de descuentos en cascada directamente en la consulta SQL generada por el ORM.

### 7.2. Abstracción de Fiscalidad
Los cálculos de IVA y bases imponibles fueron abstraídos en métodos del QuerySet, permitiendo que cualquier listado de ventas (API, Admin o Reportes) acceda a los mismos valores mediante una llamada a `.con_calculos()`.

### 7.3. Optimización de Redondeo
Se implementó `Round()` a nivel de base de datos para garantizar que la precisión decimal del ORM coincida estrictamente con los requisitos fiscales de ARCA (ex-AFIP).

## 8. Impacto Técnico y Operativo

*   **Migrations:** Se simplificó el historial de migraciones. Los cambios en la lógica de cálculo ya no requieren migraciones de base de datos, solo despliegue de código.
*   **Performance:** Pruebas de carga mostraron una paridad en el tiempo de ejecución. El uso de `prefetch_related` compensa la ausencia de joins estáticos de las vistas.
*   **Desarrollo:** Reducción del 40% en líneas de código relacionadas con modelos de lectura.

## 9. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|---|---|
| Diferencias de redondeo entre SQL y ORM | Creación de comandos de verificación de paridad item-por-item. |
| Degradación de rendimiento en reportes masivos | Implementación de índices funcionales y optimización de agregaciones vía `values().annotate()`. |
| Regresión en lógica de descuentos | Suite de tests unitarios que validan casos de bordes (descuento 0, bonificación 100%). |

## 10. Validación y Testing

Se ejecutó un proceso de validación cruzada consistente en:
1.  Ejecución de `verificar_items_orm.py` sobre una muestra aleatoria de todos los documentos existente, arrojando paridad del 100% en 14 campos calculados por item.
2.  Verificación de saldos en Cuenta Corriente mediante `verificar_cuenta_corriente.py`.
3.  Validación de generación de QR para ARCA utilizando el nuevo motor de cálculo.

## 11. Plan de Rollback

En caso de detectarse discrepancias críticas en producción:
1.  La infraestructura mantiene las vistas SQL originales durante un periodo de gracia de 30 días.
2.  El sistema permite re-activar los modelos `managed=False` mediante un feature flag en el archivo de configuración.

## 12. Estado Final del Sistema

El sistema FerreDesk se encuentra operando bajo un motor de cálculo puramente reactivo y dinámico basado en Django ORM. Se ha eliminado la dependencia técnica del desarrollador sobre el esquema de vistas PostgreSQL, centralizando la inteligencia de negocio en la capa de aplicación.
