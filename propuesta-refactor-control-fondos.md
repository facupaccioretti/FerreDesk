# Auditoría y plan de implementación: Control de Fondos

## 1. Auditoría acotada del sistema relevante

### 1.1 Alcance auditado

Se auditó únicamente lo necesario para reemplazar la subtab actual `Consolidado de Ingresos` por una vista de `Control de Fondos` dentro del módulo existente:

- frontend de Tesorería:
  - `ferredesk_v0/frontend/src/components/Caja/CajaManager.js`
  - `ferredesk_v0/frontend/src/components/Caja/ConsolidadoIngresosTab.js`
  - `ferredesk_v0/frontend/src/components/Caja/CajaActualTab.js`
  - `ferredesk_v0/frontend/src/components/Caja/MaestroBancos.js`
  - `ferredesk_v0/frontend/src/components/Caja/ModalHistorialBanco.js`
  - `ferredesk_v0/frontend/src/components/Caja/ValoresEnCartera.js`
  - `ferredesk_v0/frontend/src/components/Caja/HistorialCheques.js`
  - `ferredesk_v0/frontend/src/utils/useCajaAPI.js`
- backend de Tesorería:
  - `ferredesk_v0/backend/ferreapps/caja/views.py`
  - `ferredesk_v0/backend/ferreapps/caja/models.py`
  - `ferredesk_v0/backend/ferreapps/caja/utils.py`
  - `ferredesk_v0/backend/ferreapps/caja/urls.py`
  - `ferredesk_v0/backend/ferreapps/caja/serializers/serializers_cheque.py`
  - `ferredesk_v0/backend/ferreapps/caja/serializers/serializers_historial_banco.py`
  - tests del módulo `ferreapps/caja/tests`

### 1.2 Qué existe hoy

#### A. Estructura general del módulo

`CajaManager` monta cuatro subtabs principales:

- `Historial de Cajas`
- `Consolidado de Ingresos`
- `Bancos`
- `Cheques`

Además agrega dinámicamente `Caja Actual` cuando el usuario autenticado tiene una sesión abierta.

Conclusión:

- el nuevo trabajo sí encaja naturalmente dentro del módulo existente;
- la subtab correcta a reemplazar es la actual `consolidado-ingresos`;
- no hace falta crear un módulo nuevo ni una ruta de frontend nueva fuera de Tesorería.

#### B. Subtab actual: Consolidado de Ingresos

`ConsolidadoIngresosTab.js` hoy:

- consume `obtenerConsolidadoIngresos(fechaDesde, fechaHasta)`;
- usa selector libre de fechas `desde/hasta`;
- muestra KPIs de período:
  - `Total ingresos`
  - `Por caja`
  - `Fuera de caja`
  - `Registros`
- muestra una tabla cronológica de eventos;
- su unidad básica es el ingreso, no la foto actual de Control de Fondos.

El endpoint actual es `GET /api/caja/pagos/consolidado-ingresos/`.

`PagoVentaViewSet.consolidado_ingresos()` en `views.py`:

- resuelve un rango de fechas, por defecto 30 días;
- toma `PagoVenta` de ventas y recibos no anulados;
- agrega `MovimientoCaja` de entrada como fuente complementaria;
- excluye explícitamente acreditaciones bancarias y estados posteriores del cheque para no duplicar la “lectura económica”;
- arma `items` en Python;
- calcula métricas en Python;
- devuelve:
  - `lectura_simple`
  - `items`
  - `metricas`
  - `rango`

Conclusión:

- lo actual responde “qué ingresos hubo”;
- no responde “cómo está hoy la tesorería”;
- depende del período para sus KPIs principales;
- está conceptualmente desalineado con el objetivo nuevo.

#### C. Caja actual

La vista operativa de caja se arma alrededor de `SesionCaja`.

Fuentes relevantes:

- `SesionCajaViewSet.mi_caja()` devuelve sólo la caja abierta del usuario actual;
- `SesionCajaViewSet.estado_caja()` y `_generar_resumen_cierre()` calculan saldo teórico y totales por método para una sesión específica;
- `_calcular_saldo_teorico()` usa:
  - saldo inicial;
  - pagos que afectan arqueo;
  - vueltos;
  - movimientos manuales.

Observaciones clave:

- la caja actual no es una posición global del tenant;
- es una vista por sesión de caja y además por usuario autenticado;
- por diseño resuelve arqueo operativo, no tesorería consolidada.

Qué sí se puede reutilizar:

- la semántica de “saldo teórico” de caja;
- las reglas de exclusión de ventas y recibos anulados;
- la lógica existente para distinguir pagos que afectan arqueo.

#### D. Bancos

El modelo `CuentaBanco` es catálogo de cuentas/billeteras.

La subtab `MaestroBancos` hoy:

- lista cuentas activas/inactivas;
- permite alta/edición/desactivación;
- abre `ModalHistorialBanco`.

El drill-down bancario real es `GET /api/caja/cuentas-banco/{id}/historial/`.

Ese endpoint:

- usa rango de fechas, por defecto 30 días;
- unifica movimientos desde:
  - `PagoVenta` sobre esa cuenta;
  - `Cheque` acreditado en esa cuenta;
- devuelve:
  - `movimientos`
  - `total_ingresos`
  - `total_egresos`
  - `saldo_periodo`
  - `banco`
  - `rango`

Observaciones clave:

- hoy no existe una “foto actual por banco” materializada;
- el historial bancario es un saldo del período consultado, no un saldo total actual;
- la UI actual abre el historial dentro de un modal con selector libre `desde/hasta`.

Esto es importante para el nuevo diseño:

- el KPI `Bancos` no puede derivarse reutilizando directamente `saldo_periodo`;
- habrá que definir una agregación de foto actual desde las fuentes registradas, no desde el historial modal.

#### E. Cheques

El modelo `Cheque` ya tiene el ciclo de vida necesario para la nueva pantalla:

- `EN_CARTERA`
- `DEPOSITADO`
- `ACREDITADO`
- `ENTREGADO`
- `RECHAZADO`

También tiene campos relevantes para posición:

- `monto`
- `fecha_pago`
- `fecha_presentacion`
- `fecha_deposito_real`
- `fecha_acreditacion`
- `cuenta_banco_deposito`
- vínculos a venta/recibo/pago

La subtab `ValoresEnCartera`:

- muestra sólo `EN_CARTERA` como vista operativa principal;
- consulta alertas por vencer;
- permite depositar y marcar rechazado;
- ofrece acceso a `HistorialCheques`.

La subvista `HistorialCheques`:

- trae todos los cheques o filtra por `estado`;
- permite ver detalle, editar, acreditar, reactivar, rechazar;
- hoy no usa filtros por fecha;
- sí puede servir como drill-down natural de:
  - `En cartera`
  - `Pendiente de acreditación` si se entra con filtro `DEPOSITADO`

Conclusión:

- la parte de cheques es la fuente más madura para la nueva foto;
- ya existen estados compatibles con los bloques pedidos;
- el drill-down adecuado ya existe y no hay que crear otro.

#### F. Helpers y patrón de extracción de lógica

En `ferreapps/caja` hoy la lógica de negocio está repartida entre:

- `views.py` con bastante lógica inline;
- `utils.py` con helpers transaccionales y flujos canónicos de pagos/cheques.

En otros módulos del proyecto sí existen carpetas `services/`.

Conclusión:

- para esta refactorización conviene extraer la consolidación fuera de la view;
- hay base cultural en el repo para usar `services/`;
- pero en `caja` eso hoy no existe, así que la introducción debe ser mínima y específica;
- no conviene montar una arquitectura nueva grande: alcanza con un service puntual y testeable.

#### G. Tests actuales relevantes

Existen tests para el endpoint actual y para el historial bancario:

- `ferredesk_v0/backend/ferreapps/caja/tests/test_api_consolidado_ingresos.py`
- `ferredesk_v0/backend/ferreapps/caja/tests/test_historial_banco.py`

Eso confirma:

- el consolidado actual está testeado como lectura de ingresos por período;
- el historial bancario está testeado como saldo de período;
- todavía no existen tests de foto consolidada actual.

### 1.3 Qué debe eliminarse

Debe quedar obsoleto, una vez migrada la nueva pantalla:

- la identidad funcional `Consolidado de Ingresos`;
- el componente frontend centrado en tabla cronológica de ingresos:
  - `ferredesk_v0/frontend/src/components/Caja/ConsolidadoIngresosTab.js`
- el cliente API centrado en ese contrato:
  - `obtenerConsolidadoIngresos()` en `ferredesk_v0/frontend/src/utils/useCajaAPI.js`
- el action backend actual:
  - `PagoVentaViewSet.consolidado_ingresos()`
- la documentación y tests que validan esa semántica como destino final:
  - `ferredesk_v0/backend/ferreapps/caja/tests/test_api_consolidado_ingresos.py`

Nota:

- no hace falta borrar `PagoVentaViewSet`;
- sí hace falta quitar el action y su contrato si deja de tener consumidores.

### 1.4 Qué puede reutilizarse

Se puede reutilizar directamente:

- `CajaManager.js` como contenedor de tabs;
- `ValoresEnCartera.js` y `HistorialCheques.js` como drill-down de cheques;
- `MaestroBancos.js` y `ModalHistorialBanco.js` como drill-down bancario existente;
- `SesionCajaViewSet._calcular_saldo_teorico()` y `_generar_resumen_cierre()` como referencia semántica para caja;
- `Cheque` y sus estados actuales;
- reglas de exclusión de ventas/recibos anulados;
- serializers existentes de `Cheque` y `CuentaBanco`;
- la estrategia de `useCajaAPI` como façade frontend del módulo.

Se puede reutilizar parcialmente:

- `ModalHistorialBanco.js` como drill-down posterior, pero no como fuente del KPI principal;
- `HistorialCheques.js` con extensión para aceptar filtro inicial/drill-down;
- la infraestructura de tests del módulo `ferreapps/caja/tests`.

### 1.5 Qué debe refactorizarse

#### Backend

Debe refactorizarse:

- el contrato backend: dejar de depender de `pagos/consolidado-ingresos/`;
- la consolidación: salir de la `view` y pasar a una función o service reutilizable;
- la forma de cálculo:
  - menos armado manual de listas;
  - más agregaciones por base;
  - payload único pensado para la pantalla nueva.

#### Frontend

Debe refactorizarse:

- el nombre de la tab;
- el componente principal de la subtab;
- el hook API del módulo;
- la navegación de drill-down para que cada KPI derive al lugar correcto;
- el uso de períodos:
  - los KPIs principales no deben cambiar por período;
  - el período sólo puede afectar un bloque secundario opcional.

### 1.6 Pantalla/tab actual que sirve como drill-down por KPI

#### KPI: Disponible hoy

No existe hoy una única pantalla exacta que explique toda la suma.

Drill-down recomendado:

- abrir la misma subtab de posición con un bloque de composición visible;
- y desde allí derivar a:
  - `Caja Actual` o `Historial de Cajas` para caja;
  - `Bancos` para cuentas bancarias.

Observación:

- como drill-down de primer nivel conviene usar composición interna y luego derivaciones por bloque;
- no existe un detalle único actual que explique “Disponible hoy” completo.

#### KPI: En caja

Drill-down existente:

- `Caja Actual` si el usuario tiene caja abierta;
- si no, `Historial de Cajas` como mejor destino existente.

Riesgo funcional:

- la posición de caja del tenant no necesariamente coincide con “mi caja abierta”.

#### KPI: En bancos

Drill-down existente:

- subtab `Bancos` (`MaestroBancos`);
- detalle por cuenta a través de `ModalHistorialBanco`.

Limitación:

- el historial actual es por período;
- no expresa saldo actual total por cuenta de forma canónica.

#### KPI: En cartera

Drill-down existente:

- subtab `Cheques` (`ValoresEnCartera`);
- ya lista `EN_CARTERA` por defecto.

#### KPI: Pendiente de acreditación

Drill-down existente:

- `Cheques` > `HistorialCheques` filtrado a `DEPOSITADO`.

Limitación actual:

- no hay soporte explícito de deep-link/filtro inicial;
- hoy el usuario debería navegar manualmente o el componente debería aceptar estado inicial.

#### KPI: Total administrado

No existe un detalle único actual.

Drill-down recomendado:

- permanecer en la nueva pantalla mostrando composición por contenedor;
- desde cada contenedor derivar a su vista existente.

### 1.7 Problemas y riesgos concretos para esta implementación

#### Riesgo 1: “Caja” hoy es por usuario/sesión abierta, no por tenant

Si el negocio quiere “cuánto hay en caja” como foto del tenant, hoy la fuente disponible no parece modelar una caja maestra única consolidada. Lo que existe es:

- caja abierta del usuario actual;
- historial de sesiones;
- saldo teórico por sesión.

Esto obliga a explicitar en la implementación qué significa `Caja` dentro de la foto actual del sistema.

#### Riesgo 2: “Bancos” hoy no tiene saldo actual persistido

El sistema registra movimientos bancarios trazables, pero el drill-down actual calcula saldo de período, no saldo actual total.

Para cumplir la definición funcional, el nuevo endpoint tendrá que construir una foto actual desde movimientos registrados:

- pagos/egresos por cuenta;
- cheques acreditados;
- sin apoyarse en el saldo del modal.

#### Riesgo 3: el endpoint actual arma bastante lógica en Python

Eso va en contra de la exigencia nueva de:

- una sola llamada;
- agregaciones en base;
- posibilidad de cachear;
- fácil invalidación.

#### Riesgo 4: drill-down sin filtros iniciales

Hoy las tabs existentes no están preparadas explícitamente para abrirse desde otro KPI con estado/foco inicial.

Eso no obliga a crear pantallas nuevas, pero sí requiere una adaptación liviana del frontend.

### 1.8 Decisión tomada para drill-downs

Se decide implementar drill-downs con una estrategia de nivel intermedio.

Eso significa:

- no se van a crear pantallas nuevas;
- no se va a introducir routing nuevo ni query params globales del módulo;
- no se va a intentar deep-link completo con modales persistidos o navegación compleja;
- sí se va a abrir la tab correcta desde la nueva pantalla;
- sí se va a pasar estado inicial de UI al destino para dejarlo ya enfocado en el detalle correcto.

Cómo se haría en este repo:

- `CajaManager.js` sigue siendo el orquestador de tabs mediante `activeTab`;
- la nueva pantalla de posición invoca callbacks del tipo:
  - abrir `Cheques` en vista operativa normal;
  - abrir `Cheques` en historial con `filtroEstado = DEPOSITADO`;
  - abrir `Bancos` en su tab principal;
  - abrir `Caja Actual` o `Historial de Cajas` según disponibilidad;
- `ValoresEnCartera.js` debe poder recibir una intención inicial de vista:
  - operativo;
  - historial;
- `HistorialCheques.js` debe poder recibir un filtro inicial de estado, especialmente `DEPOSITADO`;
- `MaestroBancos.js` puede abrirse sin preselección compleja en esta fase;
- `Caja` no requiere navegación sofisticada: alcanza con abrir el destino correcto existente.

Qué se evita con esta decisión:

- agregar complejidad de navegación que no aporta al objetivo principal;
- retrasar la entrega por resolver “deep-links perfectos”;
- meter un sistema de estado global nuevo sólo para drill-down.

### 1.9 Conclusión de la auditoría

El sistema actual ya tiene casi todas las fuentes funcionales necesarias para una vista de `Control de Fondos`, pero no tiene todavía una capa de consolidación orientada a foto actual.

Lo que sobra:

- una lectura de ingresos por período como identidad de la subtab.

Lo que falta:

- un endpoint consolidado único;
- una definición operativa de caja/bancos a nivel foto actual;
- drill-down navegable por KPI;
- separación estricta entre KPIs actuales y bloque secundario dependiente de período.

La dirección correcta es:

- reemplazar `Consolidado de Ingresos`;
- crear un endpoint nuevo del módulo Tesorería;
- extraer consolidación fuera de la view;
- reutilizar tabs actuales como detalle;
- eliminar el contrato viejo cuando la migración esté completa.

## 2. Plan de implementación en tareas atómicas

### Tarea 1 — Delimitar el contrato funcional y técnico de Control de Fondos

**Qué hace:** fija el shape del nuevo payload y resuelve definiciones ambiguas de caja, bancos y totales.

**Por qué:** sin ese contrato, backend y frontend quedarían desacoplados y el KPI `Disponible hoy` corre riesgo de interpretarse distinto en cada capa.

**Archivos a tocar:**
- `propuesta-refactor-control-fondos.md` → anexar o actualizar el contrato final aprobado si se quiere dejar trazabilidad en este documento.

**Archivos a eliminar:**
- ninguno

**Dependencias:**
- ninguna

**Prompt para IA de coding:**
Documentá dentro de `propuesta-refactor-control-fondos.md` el contrato exacto del nuevo endpoint `GET /api/caja/control-fondos/` sin escribir código de producto. Definí explícitamente qué significa cada KPI: `disponible_hoy`, `caja`, `bancos`, `cheques_en_cartera`, `pendiente_acreditacion`, `total_administrado`. Aclará qué fuentes actuales del sistema entran en cada número y cuáles quedan afuera. No inventes datos externos ni saldos contables no cargados. No modifiques frontend ni backend todavía.

**Verificación:**
- checks de datos:
  - cada KPI tiene definición de inclusión/exclusión explícita;
  - `disponible_hoy` excluye `EN_CARTERA` y `DEPOSITADO`;
- checks de endpoint:
  - existe un borrador de payload único y consistente;
- checks visuales:
  - no aplica;
- checks de regresión:
  - no aplica;
- consistencia con Caja, Bancos y Cheques:
  - cada KPI apunta a una fuente ya existente en el sistema.

#### Contrato funcional y técnico aprobado para `GET /api/caja/control-fondos/`

Ruta objetivo aprobada:

- `GET /api/caja/control-fondos/`

Justificación de namespace:

- hoy el backend expone el módulo completo mediante `path("api/caja/", include("ferreapps.caja.urls"))` en `ferredesk_v0/backend/ferredesk_backend/urls.py`;
- las entidades fuente del cálculo ya viven en `ferreapps.caja`;
- registrar la lectura consolidada dentro de `ferreapps.caja.urls` evita abrir un namespace nuevo sólo para esta pantalla;
- no pisa rutas existentes porque hoy no existe `control-fondos/` bajo `/api/caja/`.

Alcance de la respuesta:

- devuelve una foto actual de tesorería basada sólo en registros existentes del sistema;
- no infiere saldos contables externos;
- no importa extractos bancarios;
- no recompone caja histórica cerrada;
- no duplica un mismo valor en más de un contenedor de la foto actual.

Regla madre de lectura:

- `disponible_hoy` representa liquidez inmediata registrada;
- `total_administrado` representa fondos administrados por Tesorería aunque no estén disponibles hoy;
- los cheques sólo se cuentan una vez según su estado actual.

Definición exacta de KPIs:

- `caja`:
  suma de `saldo_teorico_efectivo` de todas las `SesionCaja` en estado `ABIERTA` al momento de la consulta.
  Se calcula con la semántica ya existente de `_calcular_saldo_teorico()`:
  `saldo_inicial + pagos que afectan arqueo - vueltos + movimientos manuales de entrada - movimientos manuales de salida`.
  Incluye sólo efectivo y movimientos de caja realmente registrados dentro de sesiones abiertas.
  Excluye sesiones cerradas, arqueos declarados manualmente al cierre, métodos que no afectan arqueo, cheques, transferencias, QR, tarjetas y cualquier saldo físico no cargado.

- `bancos`:
  saldo actual administrado en cuentas `CuentaBanco` a partir de movimientos trazados del módulo.
  Incluye:
  `PagoVenta` con `cuenta_banco` informada y trámite activo cuando representan ingreso bancario registrado;
  `PagoVenta` con `cuenta_banco` informada y `orden_pago` activa cuando representan egreso bancario registrado;
  `Cheque` en estado `ACREDITADO` con `cuenta_banco_deposito` informada.
  Excluye cheques en estado `DEPOSITADO`, cheques `EN_CARTERA`, cuentas sin movimientos registrados, saldos iniciales de banco no modelados, conciliaciones externas, intereses, comisiones o ajustes no cargados en el sistema.

- `cheques_en_cartera`:
  suma de `Cheque.monto` para cheques en estado `EN_CARTERA`.
  Representa valores físicos bajo custodia de la empresa que todavía no son liquidez bancaria acreditada.
  Excluye `DEPOSITADO`, `ACREDITADO`, `ENTREGADO` y `RECHAZADO`.

- `pendiente_acreditacion`:
  suma de `Cheque.monto` para cheques en estado `DEPOSITADO`.
  Representa valores ya presentados al banco pero todavía no acreditados.
  Excluye `EN_CARTERA`, `ACREDITADO`, `ENTREGADO` y `RECHAZADO`.

- `disponible_hoy`:
  `caja + bancos`.
  Representa sólo liquidez inmediata ya disponible según registros actuales.
  Excluye explícitamente cheques `EN_CARTERA` y `DEPOSITADO`.
  También excluye cheques acreditables a futuro no confirmados por banco y cualquier saldo no registrado.

- `total_administrado`:
  `caja + bancos + cheques_en_cartera + pendiente_acreditacion`.
  Representa la masa total de fondos y valores que Tesorería administra en este módulo.
  Sí puede incluir `EN_CARTERA` y `DEPOSITADO`.
  No debe presentarse como disponible inmediato.

Fuentes actuales del sistema que alimentan cada KPI:

- caja:
  `SesionCaja`, `MovimientoCaja`, `PagoVenta` con `metodo_pago.afecta_arqueo=True` y exclusión de ventas `AN` y recibos `N`.
- bancos:
  `CuentaBanco`, `PagoVenta` con `cuenta_banco`, `Cheque` acreditado con `cuenta_banco_deposito`.
- cheques en cartera:
  `Cheque` con `estado=EN_CARTERA`.
- pendiente de acreditación:
  `Cheque` con `estado=DEPOSITADO`.

Fuentes que quedan explícitamente afuera del contrato:

- saldos contables o bancarios externos no cargados en el ERP;
- importes de extractos manuales o conciliaciones fuera del módulo;
- cheques `RECHAZADO` y `ENTREGADO`;
- cheques `DEPOSITADO` dentro de `bancos`;
- cheques `ACREDITADO` dentro de `pendiente_acreditacion`;
- pagos o recibos anulados;
- sesiones de caja cerradas como saldo vigente de hoy.

Invariantes funcionales obligatorias:

- `disponible_hoy = caja + bancos`
- `disponible_hoy` excluye `EN_CARTERA` y `DEPOSITADO`
- `cheques_en_cartera` usa sólo `estado=EN_CARTERA`
- `pendiente_acreditacion` usa sólo `estado=DEPOSITADO`
- `total_administrado = disponible_hoy + cheques_en_cartera + pendiente_acreditacion`

Borrador único de payload:

```json
{
  "resumen_actual": {
    "fecha_corte": "2026-06-23T15:04:05Z",
    "moneda": "ARS",
    "kpis": {
      "disponible_hoy": "0.00",
      "caja": "0.00",
      "bancos": "0.00",
      "cheques_en_cartera": "0.00",
      "pendiente_acreditacion": "0.00",
      "total_administrado": "0.00"
    }
  },
  "composicion": {
    "caja": {
      "fuente": "sesiones_caja_abiertas",
      "criterio": "saldo_teorico_efectivo_vigente"
    },
    "bancos": {
      "fuente": "movimientos_bancarios_registrados",
      "criterio": "ingresos_menos_egresos_mas_cheques_acreditados"
    },
    "cheques": {
      "en_cartera": {
        "fuente": "cheques",
        "estado": "EN_CARTERA"
      },
      "pendiente_acreditacion": {
        "fuente": "cheques",
        "estado": "DEPOSITADO"
      }
    }
  },
  "seniales": {
    "criterio_conservador": true,
    "usa_solo_datos_registrados": true,
    "incluye_saldos_externos": false
  },
  "drilldown": {
    "caja": {
      "tab": "caja_actual",
      "fallback_tab": "historial_cajas",
      "vista_inicial": "resumen"
    },
    "bancos": {
      "tab": "bancos",
      "vista_inicial": "listado"
    },
    "cheques_en_cartera": {
      "tab": "cheques",
      "vista_inicial": "operativo",
      "filtro_inicial": "EN_CARTERA"
    },
    "pendiente_acreditacion": {
      "tab": "cheques",
      "vista_inicial": "historial",
      "filtro_inicial": "DEPOSITADO"
    },
    "disponible_hoy": {
      "tab": "control_fondos",
      "vista_inicial": "composicion"
    },
    "total_administrado": {
      "tab": "control_fondos",
      "vista_inicial": "composicion"
    }
  }
}
```

Notas de interpretación para implementación posterior:

- si no existe ninguna `SesionCaja` abierta, `caja` debe devolver `0.00` y no reconstruir un saldo global histórico;
- si una `CuentaBanco` no tiene movimientos registrados, aporta `0.00`;
- un cheque `ACREDITADO` deja de contar en `pendiente_acreditacion` y pasa a impactar `bancos`;
- un cheque `DEPOSITADO` no impacta `bancos` hasta acreditarse;
- este contrato fija la semántica aunque la implementación backend siga viviendo dentro del módulo `caja`.

### Tarea 2 — Diseñar el endpoint consolidado y declarar el contrato de respuesta

**Qué hace:** define formalmente el endpoint nuevo, sus query params mínimos y la respuesta JSON completa.

**Por qué:** el frontend debe hacer una sola llamada y no reconstruir Tesorería con múltiples requests.

**Archivos a tocar:**
- `ferredesk_v0/backend/ferreapps/caja/urls.py` → decidir dónde registrar la nueva ruta si sigue viviendo en `caja`.
- `ferredesk_v0/backend/ferreapps/caja/views.py` → sólo si se deja una firma placeholder o comentario técnico; no implementar aún si se separa en otra tarea.
- `propuesta-refactor-control-fondos.md` → dejar el contrato final del JSON si no se documentó antes.

**Archivos a eliminar:**
- ninguno

**Dependencias:**
- Tarea 1

**Prompt para IA de coding:**
Definí el contrato del endpoint nuevo `GET /api/caja/control-fondos/` justificando la elección con el código existente del router de `caja`. El response debe incluir: `resumen_actual`, `composicion`, `seniales`, `drilldown`, y opcionalmente `bloque_reciente` con presets 7/15/30/60/90. En `drilldown` devolvé metadata pensada para una estrategia de nivel intermedio: nombre de tab destino, vista inicial y filtro inicial simple, sin routing complejo ni URLs nuevas. No implementes lógica de negocio todavía. No rompas rutas actuales.

**Verificación:**
- checks de datos:
  - cada campo del response tiene semántica definida;
- checks de endpoint:
  - existe una ruta objetivo única;
  - la metadata de drill-down es suficiente para abrir tabs existentes con estado inicial liviano;
- checks visuales:
  - no aplica;
- checks de regresión:
  - no se pisan rutas existentes;
- consistencia con Caja, Bancos y Cheques:
  - el payload contempla información suficiente para derivar a sus tabs actuales.

#### Decisión técnica de ruta para Tarea 2

Ruta final a implementar:

- `GET /api/caja/control-fondos/`

Lugar de registro previsto:

- dentro de `ferredesk_v0/backend/ferreapps/caja/urls.py`;
- expuesto como acción read-only o endpoint liviano del módulo `caja`, sin crear un `include()` nuevo en `ferredesk_backend/urls.py`.

Semántica de request mínima:

- método: `GET`
- auth: igual que el resto del módulo `caja`
- query params mínimos:
  - sin params obligatorios para la foto principal;
  - `preset` opcional sólo para `bloque_reciente`, con valores permitidos `7`, `15`, `30`, `60`, `90`;
  - default de `preset`: `30`;
  - si no se expone `bloque_reciente` en la primera entrega, el backend puede ignorar `preset` sin alterar `resumen_actual`.

Contrato completo de response:

- `resumen_actual`:
  bloque principal de lectura ejecutiva.
  Debe traer `fecha_corte`, `moneda`, `kpis` y opcionalmente `definiciones_cortas` si el frontend necesita subtítulos sin hardcodear semántica.

- `composicion`:
  bloque de trazabilidad funcional.
  Explica cómo se compone cada KPI con criterios y subtotales reutilizables por la UI.
  No reemplaza drill-down; sirve para transparentar la suma.

- `seniales`:
  metadata operativa liviana para mensajes o badges.
  Ejemplos: `criterio_conservador`, `usa_solo_datos_registrados`, `incluye_saldos_externos=false`, `hay_caja_abierta`, `hay_cheques_pendientes`.

- `drilldown`:
  metadata de navegación de nivel intermedio.
  Debe permitir abrir tabs existentes con estado inicial simple:
  `tab`,
  `vista_inicial`,
  `filtro_inicial`,
  `fallback_tab`,
  `requiere_contexto`.
  No debe devolver URLs nuevas, rutas SPA ni instrucciones de modal profundo.

- `bloque_reciente`:
  bloque opcional y secundario dependiente de `preset`.
  Nunca modifica los KPIs de `resumen_actual`.
  Si se incluye, debe devolver `preset_aplicado`, `presets_permitidos`, `rango` y una estructura acotada de métricas recientes.

Payload JSON final propuesto:

```json
{
  "resumen_actual": {
    "fecha_corte": "2026-06-23T15:04:05Z",
    "moneda": "ARS",
    "kpis": {
      "disponible_hoy": {
        "monto": "0.00",
        "descripcion": "Liquidez inmediata registrada"
      },
      "caja": {
        "monto": "0.00",
        "descripcion": "Efectivo vigente en sesiones abiertas"
      },
      "bancos": {
        "monto": "0.00",
        "descripcion": "Fondos registrados en cuentas y billeteras"
      },
      "cheques_en_cartera": {
        "monto": "0.00",
        "descripcion": "Valores físicos aún no depositados"
      },
      "pendiente_acreditacion": {
        "monto": "0.00",
        "descripcion": "Cheques depositados aún no acreditados"
      },
      "total_administrado": {
        "monto": "0.00",
        "descripcion": "Fondos y valores administrados por Tesorería"
      }
    }
  },
  "composicion": {
    "disponible_hoy": {
      "componentes": [
        { "codigo": "caja", "monto": "0.00" },
        { "codigo": "bancos", "monto": "0.00" }
      ],
      "total": "0.00"
    },
    "total_administrado": {
      "componentes": [
        { "codigo": "caja", "monto": "0.00" },
        { "codigo": "bancos", "monto": "0.00" },
        { "codigo": "cheques_en_cartera", "monto": "0.00" },
        { "codigo": "pendiente_acreditacion", "monto": "0.00" }
      ],
      "total": "0.00"
    },
    "fuentes": {
      "caja": "sesiones_caja_abiertas",
      "bancos": "pagos_con_cuenta_banco_y_cheques_acreditados",
      "cheques_en_cartera": "cheques_estado_en_cartera",
      "pendiente_acreditacion": "cheques_estado_depositado"
    }
  },
  "seniales": {
    "criterio_conservador": true,
    "usa_solo_datos_registrados": true,
    "incluye_saldos_externos": false,
    "hay_caja_abierta": true,
    "hay_cheques_pendientes": true
  },
  "drilldown": {
    "caja": {
      "tab": "caja_actual",
      "fallback_tab": "historial_cajas",
      "vista_inicial": "resumen",
      "requiere_contexto": "sesion_abierta"
    },
    "bancos": {
      "tab": "bancos",
      "vista_inicial": "listado",
      "filtro_inicial": null,
      "requiere_contexto": null
    },
    "cheques_en_cartera": {
      "tab": "cheques",
      "vista_inicial": "operativo",
      "filtro_inicial": "EN_CARTERA",
      "requiere_contexto": null
    },
    "pendiente_acreditacion": {
      "tab": "cheques",
      "vista_inicial": "historial",
      "filtro_inicial": "DEPOSITADO",
      "requiere_contexto": null
    },
    "disponible_hoy": {
      "tab": "control_fondos",
      "vista_inicial": "composicion",
      "filtro_inicial": null,
      "requiere_contexto": null
    },
    "total_administrado": {
      "tab": "control_fondos",
      "vista_inicial": "composicion",
      "filtro_inicial": null,
      "requiere_contexto": null
    }
  },
  "bloque_reciente": {
    "preset_aplicado": 30,
    "presets_permitidos": [7, 15, 30, 60, 90],
    "rango": {
      "desde": "2026-05-24",
      "hasta": "2026-06-23"
    },
    "metricas": {}
  }
}
```

Reglas de contrato para no romper frontend:

- `resumen_actual` siempre debe existir;
- `composicion`, `seniales` y `drilldown` siempre deben existir aunque algunos subcampos vengan vacíos;
- `bloque_reciente` puede omitirse por completo en la primera entrega, pero si existe debe respetar el `preset` sin contaminar la foto principal;
- todos los montos deben serializarse como string decimal;
- el frontend no debe necesitar más de esta respuesta para render principal y navegación inicial.

### Tarea 3 — Extraer la consolidación a una unidad de negocio reutilizable

**Qué hace:** crea una función o service específico para calcular Control de Fondos fuera de la view.

**Por qué:** la consolidación es sustancial y debe ser testeable, cacheable y reutilizable.

**Archivos a tocar:**
- `ferredesk_v0/backend/ferreapps/caja/views.py` → quitar lógica pesada de la view y delegar.
- `ferredesk_v0/backend/ferreapps/caja/utils.py` o `ferredesk_v0/backend/ferreapps/caja/services/control_fondos.py` → ubicar ahí la consolidación según la convención final elegida.
- `ferredesk_v0/backend/ferreapps/caja/__init__.py` → sólo si hiciera falta exponer imports, evitando cambios innecesarios.

**Archivos a eliminar:**
- ninguno

**Dependencias:**
- Tarea 2

**Prompt para IA de coding:**
Implementá la extracción de la lógica de consolidación de Control de Fondos fuera de `ferredesk_v0/backend/ferreapps/caja/views.py`. Elegí la ubicación más coherente con el repo: un archivo puntual en `services/` si vas a introducir un service mínimo del módulo, o `utils.py` si mantener todo local es claramente mejor. La nueva unidad debe devolver una estructura lista para serializar y aceptar el preset de período sólo para el bloque secundario opcional. Mantené thin views. No toques todavía el frontend.

**Verificación:**
- checks de datos:
  - el cálculo vive fuera de la view;
- checks de endpoint:
  - la view sólo orquesta request/response;
- checks visuales:
  - no aplica;
- checks de regresión:
  - no cambia comportamiento de otras views del módulo;
- consistencia con Caja, Bancos y Cheques:
  - el service usa sus modelos/estados reales, no lógica duplicada.

### Tarea 4 — Implementar agregaciones correctas para la foto actual

**Qué hace:** calcula los KPIs principales con consultas agregadas sobre base de datos.

**Por qué:** la pantalla debe responder una foto actual, no listar eventos ni sumar listas grandes en Python.

**Archivos a tocar:**
- `ferredesk_v0/backend/ferreapps/caja/models.py` → sólo si hicieran falta índices nuevos en modelos o una migration posterior.
- `ferredesk_v0/backend/ferreapps/caja/views.py` → conectar el endpoint nuevo.
- `ferredesk_v0/backend/ferreapps/caja/utils.py` o `ferredesk_v0/backend/ferreapps/caja/services/control_fondos.py` → agregaciones.

**Archivos a eliminar:**
- ninguno

**Dependencias:**
- Tarea 3

**Prompt para IA de coding:**
Implementá las agregaciones del nuevo endpoint de Control de Fondos usando consultas agregadas en ORM, evitando armar listas completas salvo donde el bloque secundario realmente lo requiera. Calculá por separado: `caja`, `bancos`, `cheques_en_cartera`, `pendiente_acreditacion`, `disponible_hoy`, `total_administrado`. Respetá la regla funcional: la foto refleja sólo datos registrados. Excluí estados anulados y no dupliques el mismo valor entre contenedores.

**Verificación:**
- checks de datos:
  - `disponible_hoy = caja + bancos` si esa es la definición aprobada;
  - `cheques_en_cartera` usa sólo `ESTADO_EN_CARTERA`;
  - `pendiente_acreditacion` usa sólo `ESTADO_DEPOSITADO`;
  - `total_administrado = disponible_hoy + cartera + pendiente` si esa fue la definición acordada;
- checks de endpoint:
  - una sola respuesta trae todos los KPI principales;
- checks visuales:
  - no aplica;
- checks de regresión:
  - no se alteran flujos de depositar, acreditar o rechazar cheques;
- consistencia con Caja, Bancos y Cheques:
  - cada subtotal coincide con los registros fuente del módulo correspondiente.

### Tarea 5 — Implementar el endpoint consolidado final

**Qué hace:** expone el endpoint nuevo consumiendo la unidad de consolidación.

**Por qué:** habilita el consumo frontend con una sola llamada.

**Archivos a tocar:**
- `ferredesk_v0/backend/ferreapps/caja/urls.py` → registrar ruta nueva.
- `ferredesk_v0/backend/ferreapps/caja/views.py` → agregar view/action nuevo y delegar cálculo.
- `ferredesk_v0/backend/ferreapps/caja/serializers/` → sólo si se decide serializar payload no-modelo con serializers explícitos.

**Archivos a eliminar:**
- ninguno

**Dependencias:**
- Tarea 4

**Prompt para IA de coding:**
Exponé el endpoint consolidado final para la nueva pantalla de Control de Fondos. La respuesta debe salir de la unidad de negocio creada en la tarea anterior. Usá una sola ruta y una sola llamada. Si necesitás serializers read-only para el payload, agregalos en `ferredesk_v0/backend/ferreapps/caja/serializers/` manteniendo el patrón modular ya existente. Incluí metadata de drill-down compatible con la estrategia decidida de nivel intermedio: tab destino, vista inicial y filtro inicial simple. No elimines todavía el endpoint viejo.

**Verificación:**
- checks de datos:
  - la respuesta incluye KPIs, composición y drill-down metadata;
- checks de endpoint:
  - `GET` devuelve 200;
  - soporta preset de período sólo para bloque secundario;
  - devuelve metadata de drill-down consumible sin lógica extra compleja en frontend;
- checks visuales:
  - no aplica;
- checks de regresión:
  - el endpoint viejo sigue funcionando mientras no se migre frontend;
- consistencia con Caja, Bancos y Cheques:
  - la respuesta permite navegar a sus detalles sin pedir más datos estructurales.

### Tarea 6 — Definir índices y estrategia de performance del endpoint

**Qué hace:** revisa necesidad real de índices y deja el endpoint listo para uso frecuente.

**Por qué:** la pantalla apunta a ser portada de Tesorería y debe ser barata de consultar.

**Archivos a tocar:**
- `ferredesk_v0/backend/ferreapps/caja/models.py` → agregar índices si faltan.
- `ferredesk_v0/backend/ferreapps/caja/migrations/` → migration nueva si corresponde.
- `ferredesk_v0/backend/ferreapps/caja/tests/` → tests o checks de consulta si el equipo los usa.

**Archivos a eliminar:**
- ninguno

**Dependencias:**
- Tarea 4

**Prompt para IA de coding:**
Auditá las consultas reales del endpoint nuevo y agregá sólo los índices que se justifiquen por filtros frecuentes del cálculo de posición: estado de cheque, cuenta bancaria, fechas de acreditación/deposición si se usan, relaciones clave del módulo. No sobre-indexes. Si no hace falta ningún índice adicional, dejalo explícito en comentarios de la tarea o tests. No cambies comportamiento funcional.

**Verificación:**
- checks de datos:
  - no cambian resultados;
- checks de endpoint:
  - el endpoint sigue respondiendo igual;
- checks visuales:
  - no aplica;
- checks de regresión:
  - migraciones aplican limpias;
- consistencia con Caja, Bancos y Cheques:
  - los filtros usados por el cálculo quedan respaldados por índices razonables.

### Tarea 7 — Diseñar cache backend e invalidación mínima

**Qué hace:** agrega cache de corta vida y documenta invalidaciones por eventos relevantes.

**Por qué:** varios usuarios abriendo la portada no deberían recalcular toda la foto innecesariamente.

**Archivos a tocar:**
- `ferredesk_v0/backend/ferreapps/caja/views.py` → si la cache se aplica cerca del endpoint.
- `ferredesk_v0/backend/ferreapps/caja/utils.py` o `ferredesk_v0/backend/ferreapps/caja/services/control_fondos.py` → si la cache envuelve la unidad de negocio.
- otros archivos del módulo sólo si se agregan hooks de invalidación explícitos.

**Archivos a eliminar:**
- ninguno

**Dependencias:**
- Tarea 5

**Prompt para IA de coding:**
Implementá una estrategia mínima y explícita de cache backend para Control de Fondos. Priorizá algo alineado con el repo actual: expiración corta y, si es razonable, invalidación directa desde eventos del módulo `caja` que alteran la foto. No inventes infraestructura externa. Documentá qué operaciones invalidan la cache: apertura/cierre de caja, movimiento manual, alta/cambio de estado de cheque, acreditación, rechazo, reactivación, cobros/pagos relevantes.

**Verificación:**
- checks de datos:
  - la cache no devuelve una estructura distinta;
- checks de endpoint:
  - la respuesta se invalida al cambiar un evento relevante;
- checks visuales:
  - no aplica;
- checks de regresión:
  - no quedan caches eternas ni valores obsoletos evidentes;
- consistencia con Caja, Bancos y Cheques:
  - operaciones sobre esos módulos refrescan la foto.

### Tarea 8 — Refactorizar la subtab y el cliente API del frontend

**Qué hace:** cambia la identidad de la subtab y su hook de datos para consumir el endpoint nuevo.

**Por qué:** la UI actual está construida alrededor de un historial de ingresos y no sirve como portada de tesorería.

**Archivos a tocar:**
- `ferredesk_v0/frontend/src/components/Caja/CajaManager.js` → renombrar label/tab y montar el componente nuevo.
- `ferredesk_v0/frontend/src/components/Caja/ConsolidadoIngresosTab.js` → reemplazar o migrar a componente de posición.
- `ferredesk_v0/frontend/src/utils/useCajaAPI.js` → quitar `obtenerConsolidadoIngresos` y agregar `obtenerPosicionTesoreria`.

**Archivos a eliminar:**
- `ferredesk_v0/frontend/src/components/Caja/ConsolidadoIngresosTab.js` si se crea un archivo nuevo con nombre final.

**Dependencias:**
- Tarea 5

**Prompt para IA de coding:**
Refactorizá el frontend de Tesorería para reemplazar la subtab `Consolidado de Ingresos` por la nueva identidad `Control de Fondos`. El componente ya no debe pedir `fecha_desde/fecha_hasta` para los KPIs principales. Debe hacer una sola llamada al endpoint consolidado nuevo a través de `useCajaAPI`. Prepará el componente y `CajaManager` para la estrategia de drill-down de nivel intermedio: abrir tab existente y pasar intención inicial simple al destino. No rompas las otras tabs.

**Verificación:**
- checks de datos:
  - el frontend usa sólo un endpoint para la pantalla nueva;
- checks de endpoint:
  - no quedan requests a `pagos/consolidado-ingresos/` desde la nueva subtab;
- checks visuales:
  - la tab nueva se renderiza dentro de `CajaManager`;
- checks de regresión:
  - `CajaManager` sigue controlando tabs sin routing nuevo;
- checks de regresión:
  - `Bancos`, `Cheques`, `Historial de Cajas` y `Caja Actual` siguen funcionando;
- consistencia con Caja, Bancos y Cheques:
  - la pantalla nueva convive con sus tabs sin duplicarlas.

### Tarea 9 — Implementar KPIs principales de Control de Fondos

**Qué hace:** construye la lectura ejecutiva superior de la pantalla.

**Por qué:** es la pieza central del objetivo funcional.

**Archivos a tocar:**
- nuevo componente frontend de la subtab final o el archivo refactorizado de la tarea 8.
- opcionalmente componentes auxiliares en `ferredesk_v0/frontend/src/components/Caja/` si se separan tarjetas o composición.

**Archivos a eliminar:**
- ninguno

**Dependencias:**
- Tarea 8

**Prompt para IA de coding:**
Implementá en la subtab nueva los KPIs principales de Control de Fondos: `Disponible hoy`, `En caja`, `En bancos`, `En cartera`, `Pendiente de acreditación`, `Total administrado`. La UI debe dejar muy clara la diferencia entre liquidez inmediata y valores no disponibles hoy. No conviertas la pantalla en una tabla larga. No dupliques alertas detalladas existentes.

**Verificación:**
- checks de datos:
  - los valores visibles coinciden con el response backend;
- checks de endpoint:
  - no hay llamadas extra;
- checks visuales:
  - la lectura principal aparece primero;
  - `Disponible hoy` se diferencia de `Total administrado`;
- checks de regresión:
  - no se rompe responsive ni paginadores existentes;
- consistencia con Caja, Bancos y Cheques:
  - cada tarjeta coincide con su fuente.

### Tarea 10 — Implementar composición y drill-down navegable por KPI

**Qué hace:** vuelve clickeables los números importantes y dirige al detalle correcto existente.

**Por qué:** la pantalla debe sintetizar y ordenar navegación, no convertirse en un callejón sin salida.

**Archivos a tocar:**
- componente frontend nuevo/refactorizado de posición;
- `ferredesk_v0/frontend/src/components/Caja/CajaManager.js` → si hace falta aceptar estado inicial/tab inicial;
- `ferredesk_v0/frontend/src/components/Caja/ValoresEnCartera.js`
- `ferredesk_v0/frontend/src/components/Caja/HistorialCheques.js`
- `ferredesk_v0/frontend/src/components/Caja/MaestroBancos.js`
- `ferredesk_v0/frontend/src/components/Caja/ModalHistorialBanco.js`

**Archivos a eliminar:**
- ninguno

**Dependencias:**
- Tarea 9

**Prompt para IA de coding:**
Implementá drill-down desde cada KPI sin crear pantallas nuevas. Reutilizá las tabs existentes aplicando explícitamente la estrategia decidida de nivel intermedio: abrir la tab correcta y pasar estado inicial liviano al destino. Si hace falta, agregá soporte mínimo para abrir una tab con foco o filtro inicial, por ejemplo `ValoresEnCartera` arrancando en historial y `HistorialCheques` filtrado en `DEPOSITADO`. No agregues routing complejo, query params globales ni nuevas vistas globales. Mantené el comportamiento actual si el usuario entra manualmente a las tabs.

**Verificación:**
- checks de datos:
  - el destino abierto corresponde al KPI clickeado;
- checks de endpoint:
  - no se piden datos innecesarios para navegar;
- checks visuales:
  - cada KPI importante es navegable;
- checks visuales:
  - el destino abre ya enfocado en el detalle correcto sin pasos manuales extra cuando aplica;
- checks de regresión:
  - las tabs siguen funcionando igual si se abren directamente;
- checks de regresión:
  - no se introdujo routing nuevo ni dependencia en query params globales;
- consistencia con Caja, Bancos y Cheques:
  - `En cartera` abre `ValoresEnCartera`;
  - `Pendiente de acreditación` abre cheques filtrados a `DEPOSITADO`;
  - `Bancos` abre la tab bancaria correcta.

### Tarea 11 — Implementar bloque secundario reciente con presets 7/15/30/60/90

**Qué hace:** agrega, sólo si aporta, una lectura secundaria dependiente de período.

**Por qué:** algunos apoyos operativos recientes pueden ser útiles sin convertir la pantalla en reporte histórico.

**Archivos a tocar:**
- backend del endpoint consolidado para exponer `bloque_reciente`;
- componente frontend nuevo/refactorizado para renderizar presets cerrados.

**Archivos a eliminar:**
- ninguno

**Dependencias:**
- Tarea 5
- Tarea 9

**Prompt para IA de coding:**
Implementá un bloque secundario opcional que sí responda a presets cerrados `7/15/30/60/90`, con `30` por defecto y `90` máximo. Ese bloque no debe alterar los KPIs principales de Control de Fondos. No agregues selector libre de fechas. Si al auditar la implementación real no aporta valor suficiente, dejá el bloque fuera y mantené soporte backend listo para futura incorporación sólo si es realmente útil.

**Verificación:**
- checks de datos:
  - cambiar preset sólo altera el bloque secundario;
- checks de endpoint:
  - el preset viaja en una sola llamada consolidada;
- checks visuales:
  - los KPIs principales no cambian al tocar período;
- checks de regresión:
  - sin selector libre ni aspecto de reporte contable;
- consistencia con Caja, Bancos y Cheques:
  - el bloque secundario sigue derivando a fuentes existentes si ofrece drill-down.

### Tarea 12 — Eliminar código muerto y el contrato obsoleto

**Qué hace:** retira endpoint, hook, textos y tests obsoletos del consolidado viejo.

**Por qué:** la migración debe terminar sin identidades duplicadas ni rutas huérfanas.

**Archivos a tocar:**
- `ferredesk_v0/backend/ferreapps/caja/views.py` → quitar action viejo.
- `ferredesk_v0/backend/ferreapps/caja/urls.py` → eliminar exposición del path viejo si ya no se usa.
- `ferredesk_v0/frontend/src/utils/useCajaAPI.js` → eliminar método viejo.
- `ferredesk_v0/frontend/src/components/Caja/CajaManager.js` → quitar referencias residuales.
- `ferredesk_v0/backend/ferreapps/caja/tests/test_api_consolidado_ingresos.py` → eliminar o reemplazar por tests del endpoint nuevo.

**Archivos a eliminar:**
- `ferredesk_v0/backend/ferreapps/caja/tests/test_api_consolidado_ingresos.py` si se reemplaza totalmente.
- `ferredesk_v0/frontend/src/components/Caja/ConsolidadoIngresosTab.js` si quedó reemplazado por un archivo nuevo.

**Dependencias:**
- Tarea 8
- Tarea 9
- Tarea 10

**Prompt para IA de coding:**
Eliminá todo el código muerto asociado a `Consolidado de Ingresos` una vez confirmada la migración completa al nuevo endpoint y la nueva subtab. Quitá rutas, hooks, componentes y tests obsoletos. No dejes alias temporales ni contratos duplicados. Verificá que no haya imports colgando ni referencias en `CajaManager`.

**Verificación:**
- checks de datos:
  - la nueva pantalla sigue mostrando lo mismo;
- checks de endpoint:
  - no existe el contrato viejo en producción;
- checks visuales:
  - no quedan labels viejos;
- checks de regresión:
  - build frontend y tests backend pasan;
- consistencia con Caja, Bancos y Cheques:
  - sus tabs siguen intactas.

### Tarea 13 — Agregar tests y verificación end-to-end

**Qué hace:** cubre backend, frontend y consistencia funcional de la nueva pantalla.

**Por qué:** el cambio toca la portada de Tesorería y consolida fuentes heterogéneas.

**Archivos a tocar:**
- `ferredesk_v0/backend/ferreapps/caja/tests/` → nuevos tests del endpoint de posición.
- `ferredesk_v0/frontend/src/components/Caja/` → tests frontend si el módulo ya usa ese patrón.
- `ferredesk_v0/frontend/src/utils/` → tests del hook si corresponde.

**Archivos a eliminar:**
- ninguno adicional

**Dependencias:**
- Tarea 12

**Prompt para IA de coding:**
Agregá cobertura de tests para la nueva pantalla de Control de Fondos. En backend verificá cálculo de KPIs, exclusión de anulados, separación entre `EN_CARTERA` y `DEPOSITADO`, y estabilidad del payload consolidado. En frontend verificá render de KPIs principales, navegación por drill-down con estrategia de nivel intermedio y que la pantalla usa un solo fetch. No cambies funcionalidad fuera del alcance.

**Verificación:**
- checks de datos:
  - fixtures cubren caja, banco, cheques en cartera, depositados y acreditados;
- checks de endpoint:
  - snapshot/asserciones del payload consolidado;
- checks visuales:
  - KPIs y estados visibles correctos;
- checks de regresión:
  - tabs existentes siguen pasando;
- consistencia con Caja, Bancos y Cheques:
  - tests cruzados validan coincidencia con las fuentes actuales.

## 3. Checklist global de verificación end-to-end

- La nueva pantalla muestra una foto actual de tesorería basada sólo en datos registrados en el sistema.
- `Disponible hoy` no incluye cheques `EN_CARTERA` ni `DEPOSITADO`.
- `Cheques en cartera` coincide con la suma de cheques en estado `EN_CARTERA`.
- `Pendiente de acreditación` coincide con la suma de cheques en estado `DEPOSITADO`.
- `Total administrado` no se presenta como liquidez inmediata.
- Los KPIs principales no cambian al cambiar el preset 7/15/30/60/90.
- Si existe bloque secundario, ese bloque sí cambia con el preset seleccionado.
- La pantalla hace una sola llamada frontend para renderizar la vista.
- El endpoint consolidado devuelve en una sola respuesta todo lo necesario para la pantalla.
- No quedan requests desde la pantalla nueva a `pagos/consolidado-ingresos/`.
- El drill-down de `En cartera` lleva a `Cheques` mostrando la vista operativa existente.
- El drill-down de `Pendiente de acreditación` lleva a `HistorialCheques` con foco inicial en `DEPOSITADO`.
- El drill-down de `Bancos` lleva a la tab bancaria existente.
- El drill-down de `Caja` lleva al mejor destino actual disponible sin romper la UX existente.
- Los drill-downs se resuelven con estrategia de nivel intermedio:
  - apertura de tab existente;
  - estado inicial simple;
  - sin routing nuevo;
  - sin deep-link complejo a modales.
- Las tabs `Historial de Cajas`, `Caja Actual`, `Bancos` y `Cheques` siguen funcionando igual que antes.
- No se duplican alertas detalladas ya existentes en Cheques.
- No se crean pantallas nuevas de detalle donde ya existe una vista adecuada.
- No quedan componentes muertos ni imports residuales del consolidado viejo.
- No quedan endpoints huérfanos del contrato viejo.
- El cálculo principal usa agregaciones en base de datos y evita sumar listas grandes en Python como estrategia dominante.
- La estrategia de cache backend está contemplada y tiene invalidación por eventos relevantes del módulo.
- Los índices usados por filtros frecuentes del cálculo están revisados y justificados.
- Los tests del endpoint nuevo cubren ventas/recibos anulados, caja, cheques en cartera, cheques depositados, cheques acreditados y pagos bancarios.
- La verificación manual sobre un tenant con datos reales muestra consistencia entre la nueva pantalla y las tabs de Caja, Bancos y Cheques.

## 4. Resumen ejecutivo

La implementación correcta no es “mejorar el consolidado actual”, sino reemplazar su identidad y su contrato.

La foto final debe apoyarse en:

- un endpoint consolidado único;
- cálculo backend fuera de la view;
- KPIs principales de Control de Fondos independientes del período;
- drill-down a tabs existentes;
- eliminación total del contrato `Consolidado de Ingresos` cuando la migración termine.
