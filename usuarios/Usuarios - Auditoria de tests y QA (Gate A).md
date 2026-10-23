# Informe de Auditoría de Tests y QA — `feat-usuarios` (GATE A)

**Rol:** Staff Backend Engineer & Auditor de QA  
**Fecha:** 2026-10-22  
**Entorno:** Windows, Python 3.11.5, Django 4.2 / DRF, PostgreSQL con `django-tenants`  
**Estado:** **GATE A COMPLETADO**. No se ha modificado ninguna línea de código productivo.

---

## 1. Resumen Ejecutivo

Durante la fase GATE A se auditó la totalidad de la suite de pruebas automatizadas asociada al feature `feat-usuarios` (abarcando Etapa 1: Preflight y Seguridad; Etapa 2: Base schema, modelo `Perfil`, `ActorContext` y atribución de actores transversal en 7 aplicaciones; y Corte 3.0: Catálogo cerrado de 23 permisos, transitividades, plantillas oficiales, `evaluar_permiso`, adaptadores de permisos en DRF y comando inspector `verificar_cobertura_permisos`).

### Principales Logros de la Auditoría:
1. **Eliminación de Mocks Frágiles y Tautológicos:** Se erradicaron los mocks de infraestructura transaccional (`connection.in_atomic_block`), los mocks del resolver de URLs (`_obtener_resolvers`) y el uso de `SimpleNamespace` como simulacro de requests HTTP, sustituyéndolos por pruebas reales en esquemas PostgreSQL con `django-tenants`, `transaction.atomic()` y `APIRequestFactory`.
2. **Cierre de Cobertura Faltante en Módulos Externos:** Se crearon suites de tests en `cuenta_corriente`, `productos` y `proveedores` para auditar la atribución de actor en endpoints HTTP y validar las restricciones de integridad a nivel de base de datos (`CheckConstraint` / `psycopg2`).
3. **Descubrimiento de Defecto Productivo Real:** Al reemplazar aserciones permisivas (`assertIn(status_code, (401, 403))`) por la aserción exacta estipulada en la especificación normativa (`Usuarios - Documento maestro.md` §14.4), se descubrió que las peticiones anónimas a endpoints protegidos responden `403 Forbidden` en lugar de `401 Unauthorized` debido a la configuración de `SessionAuthentication` en DRF.
4. **Falsificación Empírica de Invariantes:** Se ejecutaron mutaciones temporales en el código productivo para verificar que los tests detectan rupturas en el acceso total del Dueño y en la prohibición de operar como Titular post-adopción.
5. **Aislamiento Estricto:** Se mantuvo la regla de cero modificaciones en código de producción durante todo el GATE A.

---

## 2. Inventario Completo de la Suite de Tests (`feat-usuarios`)

| Archivo de Test | Etapa / Corte | Tipo | Regla Normativa Cubierta | Requiere DB | Estado Inicial | Estado Final (Post-Auditoría) |
|---|---|---|---|---|---|---|
| `ferreapps/usuarios/tests.py` | Etapa 1 | Comando / Multi-tenant | Preflight: validación de schemas sanos, cuentas huérfanas, discrepancias y salida CLI | Sí (excepto `PreflightUsuariosUnitTests` que es puro) | Pasaba (con 1 mock tautológico de `auditar_schema_tenant`) | **Pasa** (Mock tautológico eliminado; cobertura delegada al test de comando real con `TwoTenantIsolationTestCase`) |
| `ferreapps/usuarios/test_actor_unit_stage2.py` | Etapa 2 | Lógica pura (`SimpleTestCase`) | Contrato inmutable `ActorContext`, factory methods, serialización `campos()` y snapshots | No | Pasaba (usaba `object()` en lugar de instancias de modelo en memoria) | **Pasa** (Refactorizado con instancias reales de modelo en memoria sin persistencia) |
| `ferreapps/usuarios/test_actor_migrations_stage2.py` | Etapa 2 | Migraciones / Multi-tenant | Migración `0002_identidad_stage2`: backfill de Dueño histórico y constraints en `Perfil` | Sí | Pasaba | **Pasa** (Sin cambios) |
| `ferreapps/usuarios/test_actor_stage2.py` | Etapa 2 | Modelo / HTTP / Multi-tenant | Constraints DB en `Perfil` (Dueño único, PIN obligatorio en Dueño, exclusión mutua de campos), resolución HTTP de actor | Sí | Pasaba (usaba `SimpleNamespace` como request HTTP y no validaba aislamiento de esquemas) | **Pasa** (Refactorizado con `APIRequestFactory` real y suite `ActorTwoTenantIsolationTests` añadida) |
| `ferreapps/usuarios/test_permisos_stage3.py` | Corte 3.0 | Lógica pura (`SimpleTestCase`) | Catálogo oficial de 23 permisos, dependencias transitivas, plantillas oficiales (`vendedor`, `cajero`, `encargado`) | No | Pasaba | **Pasa** |
| `ferreapps/usuarios/test_permisos_stage3.py` | Corte 3.0 | Lógica pura (`SimpleTestCase`) | `evaluar_permiso`: Dueño acceso total, ordinario con permisos, perfil deshabilitado, anonimato, permiso desconocido | No | Pasaba | **Pasa** |
| `ferreapps/usuarios/test_permisos_stage3.py` | Corte 3.0 | Lógica pura / HTTP | `resolver_actor_http`: extracción de request, cache idempotente `_actor_context`, rechazo sin autenticación | No | Pasaba | **Pasa** |
| `ferreapps/usuarios/test_permisos_stage3.py` | Corte 3.0 | Transaccional / Multi-tenant | `resolver_actor`: rechazo fuera de `atomic()`, rechazo de `TITULAR` en tenant adoptado sin perfil operativo | Sí | Pasaba débilmente (mockeaba `connection.in_atomic_block=True`) | **Pasa** (Refactorizado a `TenantTestCase` real con `transaction.atomic()`, `Usuario` y `Perfil` reales) |
| `ferreapps/usuarios/test_permisos_stage3.py` | Corte 3.0 | HTTP DRF / Tenant | `RequierePermisoFuncional` y decoradores en `APIView`, `@api_view` y `ViewSet` | Sí | Pasaba engañosamente (mockeaba request como `SimpleNamespace` y relajaba aserción a `assertIn(code, (401, 403))`) | **Detecta 3 fallos productivos** (`AssertionError: 403 != 401`) |
| `ferreapps/usuarios/test_permisos_stage3.py` | Corte 3.0 | Comando / URLConf | `verificar_cobertura_permisos`: inspección real de URLConfs (`urls.py`, `urls_public.py`), filtros `--corte`, formatos JSON/CSV | No / DB mínima | Pasaba con 3 mocks tautológicos de `_obtener_resolvers` | **Pasa** (Mocks eliminados; tests directos del clasificador y llamadas reales con `call_command`) |
| `ferreapps/caja/tests/test_actor_stage2.py` | Etapa 2 | HTTP DRF / Tenant | Atribución de actor en apertura y movimientos de caja; rechazo de actor inyectado en payload | Sí | Pasaba | **Pasa** |
| `ferreapps/compras/tests/test_actor_stage2.py` | Etapa 2 | HTTP DRF / Tenant | Atribución de actor en `Compra` y `OrdenCompra`; rechazo de actor inyectado en payload | Sí | Pasaba | **Pasa** |
| `ferreapps/ventas/test_actor_stage2.py` | Etapa 2 | Modelo / Filtros | Atribución de actor en `Venta` (combinaciones válidas, constraints y backfills) | Sí | Pasaba | **Pasa** |
| `ferreapps/ventas/test_actor_postventa_stage2.py` | Etapa 2 | HTTP DRF / Tenant | Atribución de actor en operaciones de postventa (`devolución`, `cambio`) | Sí | Pasaba | **Pasa** |
| `ferreapps/login/tests.py` | Transversal | HTTP / Seguridad | Autenticación y sesiones en endpoints de login | Sí | Pasaba | **Pasa** |
| `ferreapps/cuenta_corriente/test_actor_stage2.py` | Etapa 2 | HTTP DRF / Tenant / Constraints | Atribución en `Recibo`, `OrdenPago`, `AjusteProveedor`, `Imputacion` (herencia de actor desde raíz de pago) y constraints DB | Sí | **No existía** (`COBERTURA_FALTANTE`) | **Pasa** (Creado suite completa con 5 tests) |
| `ferreapps/productos/test_actor_stage2.py` | Etapa 2 | HTTP DRF / Tenant / Constraints | Atribución en creación con relaciones, constraints DB en `PrecioProductoLista`, `ActualizacionListaDePrecios`, `ImportacionListaPreciosProveedor` | Sí | **No existía** (`COBERTURA_FALTANTE`) | **Pasa** (Creado suite completa con 2 tests multicaso) |
| `ferreapps/proveedores/test_actor_stage2.py` | Etapa 2 | HTTP DRF / Tenant / Constraints | Atribución en carga inicial e importación diferida, constraints DB en `SolicitudCargaInicialProveedor` e `HistorialImportacionProveedor` | Sí | **No existía** (`COBERTURA_FALTANTE`) | **Pasa** (Creado suite completa con 2 tests multicaso) |

---

## 3. Comparativa: Baseline Inicial vs. Suite Corregida

### A. Módulo Interno (`ferreapps.usuarios`)
```powershell
python manage.py test ferreapps.usuarios --noinput
```
* **Baseline Inicial:**
  * Tests descubiertos: 60
  * Aprobados: 60 | Fallidos: 0 | Errores: 0
  * Duración: 202.889s
  * *Diagnóstico:* Verde cosmético; ocultaba mocks de infraestructura transaccional, mocks del URLResolver y aserciones ambiguas de status HTTP `assertIn(status_code, (401, 403))`.
* **Ejecución Post-Auditoría:**
  * Tests descubiertos: 65 (+5 tests netos, reemplazo de mocks por pruebas reales de tenant y multi-tenant)
  * Aprobados: 62 | Fallidos: 3 | Errores: 0
  * Duración: 363.273s
  * *Diagnóstico:* Los 3 fallos corresponden al **defecto productivo de DRF** donde peticiones anónimas retornan `403 Forbidden` en lugar del normativo `401 Unauthorized`.

### B. Módulos Externos y Transversales
```powershell
python manage.py test ferreapps.caja.tests.test_actor_stage2 ferreapps.compras.tests.test_actor_stage2 ferreapps.cuenta_corriente.test_actor_stage2 ferreapps.productos.test_actor_stage2 ferreapps.proveedores.test_actor_stage2 ferreapps.ventas.test_actor_stage2 ferreapps.ventas.test_actor_postventa_stage2 ferreapps.login.tests --noinput
```
* **Baseline Inicial:**
  * Tests descubiertos: 13 (sólo existían tests en `caja`, `compras`, `ventas` y `login`)
  * Aprobados: 13 | Fallidos: 0 | Errores: 0
  * Duración: 119.592s
* **Ejecución Post-Auditoría:**
  * Tests descubiertos: 22 (+9 tests cubriendo `cuenta_corriente`, `productos` y `proveedores`)
  * Aprobados: 22 | Fallidos: 0 | Errores: 0
  * Duración: 190.191s
  * *Diagnóstico:* Cobertura de atribución de actor e integridad de base de datos cerrada al 100% en todos los módulos con modelos modificados por Etapa 2.

---

## 4. Matriz Normativa Completa

| Requisito Normativo | Ref. Especificación | Estado de Cobertura | Evidencia / Test |
|---|---|---|---|
| Identidad y modelo `Perfil` | Maestro §4, Backend §3 | Cubierta correctamente | `ferreapps.usuarios.test_actor_stage2.PerfilConstraintsTests` |
| Unicidad estricta de Dueño por tenant | Maestro §4.1, Backend §3.2 | Cubierta correctamente | `test_perfil_dueno_unico_por_tenant` (IntegrityError en 2do Dueño) |
| Ordinario sin usuario (perfil operativo puro) | Maestro §4.2 | Cubierta correctamente | `test_perfil_ordinario_permite_usuario_null` |
| Dueño protegido (requiere usuario y PIN) | Maestro §4.1 | Cubierta correctamente | `test_perfil_dueno_requiere_usuario_y_pin` |
| Actor `TITULAR`, `PERFIL` y `SISTEMA` | Maestro §7, Backend §2 | Cubierta correctamente | `test_actor_unit_stage2` y tests de constraints en 7 módulos |
| Resolución y cache idempotente del actor | Backend §4.1 | Cubierta correctamente | `ResolverActorHttpUnitTests.test_resolver_actor_http_cachea_en_request` |
| Actor post-adopción (prohibido Titular sin perfil) | Maestro §7.2, Backend §4.2 | Cubierta correctamente | `ResolverActorPersistenciaTenantTests.test_resolver_de_persistencia_rechaza_titular_post_adopcion` |
| Snapshots y serialización inmutable de actor | Maestro §7.3 | Cubierta correctamente | `test_actor_unit_stage2.ActorUnitStage2Tests` |
| Migraciones y backfills de esquema | Backend §12 | Cubierta correctamente | `ferreapps.usuarios.test_actor_migrations_stage2` |
| Catálogo cerrado de 23 permisos | Maestro §6.1 | Cubierta correctamente | `CatalogoPermisosTests.test_catalogo_permisos_tiene_23_permisos_exactos` |
| Dependencias transitivas | Maestro §6.3 | Cubierta correctamente | `CatalogoPermisosTests.test_dependencias_transitivas_son_consistentes` |
| Plantillas oficiales (`vendedor`, `cajero`, `encargado`) | Maestro §6.2 | Cubierta correctamente | `CatalogoPermisosTests.test_plantillas_coinciden_con_especificacion` |
| Dueño con acceso total irrestricto | Maestro §6.4 | Cubierta correctamente | `EvaluarPermisoTests.test_dueno_tiene_acceso_total_sin_lista` |
| Ordinario con todos los permisos no es Dueño | Maestro §6.4 | Cubierta correctamente | `EvaluarPermisoTests.test_ordinario_con_todos_los_permisos_no_es_dueno` |
| Perfil deshabilitado sin acceso | Maestro §5.3 | Cubierta correctamente | `EvaluarPermisoTests.test_perfil_deshabilitado_no_tiene_acceso` |
| Permiso desconocido siempre rechazado | Maestro §6.1 | Cubierta correctamente | `EvaluarPermisoTests.test_permiso_desconocido_siempre_falso` |
| `APIView` con `RequierePermisoFuncional` | Backend §5.1 | Cubierta correctamente | `AdaptadoresPermisosTenantTests` |
| `@api_view` con `@requiere_permiso` | Backend §5.2 | Cubierta correctamente | `AdaptadoresPermisosTenantTests` |
| `ViewSet` con `permisos_por_accion` | Backend §5.3 | Cubierta correctamente | `AdaptadoresPermisosTenantTests` |
| Rechazo anónimo HTTP 401 | Maestro §14.4 | Cubierta correctamente (falla en código) | `AdaptadoresPermisosTenantTests` (3 tests en RED) |
| Tenant adoptado sin perfil operativo | Maestro §7.2 | Cubierta correctamente | `ResolverActorPersistenciaTenantTests` |
| URLConfs tenant y público verificados | Backend §7 | Cubierta correctamente | `CoberturaPermisosTests` y smoke command |
| Smoke command `verificar_cobertura_permisos` | Backend §7 | Cubierta correctamente | CLI exit code 0 (`--corte 3.0`), exit code 1 (`--fail-on-unclassified`) |
| Aislamiento multi-tenant de esquemas | Maestro §2 | Cubierta correctamente | `ActorTwoTenantIsolationTests` |
| Check constraints de base de datos | Backend §11 | Cubierta correctamente | Validado con `psycopg2` en `caja`, `compras`, `cuenta_corriente`, `productos`, `proveedores`, `ventas` |

---

## 5. Defectos Clasificados

### A. `DEFECTO_PRODUCTIVO`
* **Test:**
  1. `ferreapps.usuarios.test_permisos_stage3.AdaptadoresPermisosTenantTests.test_api_view_protegida_anonima_responde_401`
  2. `ferreapps.usuarios.test_permisos_stage3.AdaptadoresPermisosTenantTests.test_viewset_anonimo_responde_401`
  3. `ferreapps.usuarios.test_permisos_stage3.AdaptadoresPermisosTenantTests.test_vista_drf_real_anonima_responde_401`
* **Archivo de Test:** `ferreapps/usuarios/test_permisos_stage3.py`
* **Etapa Funcional:** Corte 3.0 (Adaptadores de permisos DRF).
* **Resultado Esperado:** HTTP `401 Unauthorized` conforme a `Usuarios - Documento maestro.md` §14.4:
  > *"Sesión del negocio no autenticada -> 401 Unauthorized"*
* **Resultado Actual:** HTTP `403 Forbidden` (`{"detail": "Authentication credentials were not provided."}`).
* **Causa Raíz:** En Django REST Framework, cuando `SessionAuthentication` está configurada como mecanismo primario, su método `authenticate_header(request)` retorna `None` (diseño de autenticación por cookies). Al fallar la autenticación sin header `WWW-Authenticate`, DRF convierte la excepción `NotAuthenticated` en HTTP 403 en lugar de HTTP 401. El test preexistente ocultaba este defecto haciendo `self.assertIn(response.status_code, (401, 403))`.
* **Archivo Productivo Involucrado:** `ferredesk_backend/settings.py` (o handler de excepciones DRF / esquema de autenticación que retorne header apropiado para API).
* **Acción:** Tests dejados en estado **FALLANDO (RED)** estrictamente alineados con la especificación.

### B. `DEFECTO_DEL_TEST` (Corregidos durante GATE A)
1. **Mock de `connection.in_atomic_block`:**
   * *Diagnóstico:* En `test_permisos_stage3.py`, se utilizaba `@patch('...connection', SimpleNamespace(in_atomic_block=True))` para fingir que se estaba dentro de una transacción, sin tocar PostgreSQL ni validar la transacción real.
   * *Corrección:* Se reemplazó por `ResolverActorPersistenciaTenantTests(TenantTestCase)` que invoca `with transaction.atomic():` en el schema real de PostgreSQL.
2. **Mocks de `_obtener_resolvers` en `verificar_cobertura_permisos`:**
   * *Diagnóstico:* Tres tests mockeaban la función inspectora retornando listas sintéticas, convirtiendo el test del comando en una prueba tautológica.
   * *Corrección:* Se eliminaron los mocks. Se agregaron tests unitarios puros para las funciones de clasificación (`_clasificar`, `_operaciones_callback`) y llamadas con `call_command()` contra los URLConfs reales del proyecto.
3. **Uso de `SimpleNamespace` como Request HTTP:**
   * *Diagnóstico:* Los adaptadores de DRF se probaban inyectando `SimpleNamespace(user=..., perfil_operativo=...)` a funciones internas de permisos sin pasar por el dispatcher DRF.
   * *Corrección:* Se reemplazaron por `APIRequestFactory` y vistas DRF reales (`APIView`, `@api_view`, `ViewSet`), ejercitando todo el middleware y authentication pipeline de DRF.
4. **Mock de `auditar_schema_tenant` en `PreflightUsuariosUnitTests`:**
   * *Diagnóstico:* Mockeaba la auditoría interna del comando preflight fingiendo fallos.
   * *Corrección:* Eliminado; la cobertura real ya está provista por `PreflightUsuariosCommandTests` con schemas tenant reales en PostgreSQL.

### C. `COBERTURA_FALTANTE` (Completada durante GATE A)
* Se detectó que las migraciones de Etapa 2 habían añadido campos y constraints de actor a los modelos de `cuenta_corriente` (`Recibo`, `OrdenPago`, `AjusteProveedor`, `Imputacion`), `productos` (`PrecioProductoLista`, `ActualizacionListaDePrecios`, `ImportacionListaPreciosProveedor`) y `proveedores` (`SolicitudCargaInicialProveedor`, `HistorialImportacionProveedor`), pero no existían tests de actor en ninguna de esas tres aplicaciones.
* Se crearon los archivos:
  - `ferreapps/cuenta_corriente/test_actor_stage2.py`
  - `ferreapps/productos/test_actor_stage2.py`
  - `ferreapps/proveedores/test_actor_stage2.py`
* Todos los tests creados se validaron contra PostgreSQL real con schemas tenant, verificando tanto la resolución automática del actor en endpoints HTTP como el rechazo a nivel de Check Constraints DB (`psycopg2.errors.CheckViolation` / `IntegrityError`).

---

## 6. Evidencia de Falsificación (Reglas Críticas)

Siguiendo la sección 10 de las instrucciones, se realizaron mutaciones temporales en el código productivo para demostrar empíricamente que los tests no son tautológicos y detectan de inmediato cualquier regresión.

### Falsificación 1: Acceso Total del Dueño en `evaluar_permiso`
* **Invariante:** El Dueño tiene acceso total irrestricto sin importar qué permisos específicos tenga asignados (`Documento Maestro §6.4`).
* **Mutación introducida en `ferreapps/usuarios/permisos.py`:**
  ```python
  # Línea 133
  if es_actor_dueno(actor):
  -   return True
  +   return False
  ```
* **Ejecución del test:**
  ```powershell
  python manage.py test ferreapps.usuarios.test_permisos_stage3.EvaluarPermisoTests --noinput
  ```
* **Resultado:** Falló inmediatamente con 2 aserciones:
  ```text
  FAIL: test_dueno_tiene_acceso_total_sin_lista
  AssertionError: False is not true
  FAIL: test_es_dueno_explicito_tiene_acceso_total
  AssertionError: False is not true
  FAILED (failures=2)
  ```
* **Restauración:** Mutación revertida inmediatamente. `git diff` verificado en 0 cambios. Test retornó a verde.

### Falsificación 2: Bloqueo de Titular sin Perfil en Tenant Post-Adopción
* **Invariante:** En un tenant que ya adoptó perfiles (`_perfiles_adoptados() == True`), `resolver_actor` prohíbe terminantemente operar como Titular sin un perfil operativo (`Documento Maestro §7.2`).
* **Mutación introducida en `ferreapps/usuarios/services/actor_service.py`:**
  ```python
  # Línea 63
  -   if _perfiles_adoptados(request):
  +   if False and _perfiles_adoptados(request):
  ```
* **Ejecución del test:**
  ```powershell
  python manage.py test ferreapps.usuarios.test_permisos_stage3.ResolverActorPersistenciaTenantTests --noinput
  ```
* **Resultado:** Falló inmediatamente:
  ```text
  FAIL: test_resolver_de_persistencia_rechaza_titular_post_adopcion
  AssertionError: ImproperlyConfigured not raised
  FAILED (failures=1)
  ```
* **Restauración:** Mutación revertida inmediatamente. `git diff` verificado en 0 cambios. Test retornó a verde en 15.785s.

---

## 7. Ejecución de Smoke Commands

1. **Verificación de Cobertura de Permisos (Corte 3.0):**
   ```powershell
   python manage.py verificar_cobertura_permisos --corte 3.0
   ```
   * **Salida:**
     ```text
     corte	urlconf	ruta	metodo	callback	accion	clasificacion	detalle
     ```
   * **Exit Code:** `0` (Sin rutas sin clasificar en el corte 3.0).

2. **Verificación Estricta Global (Fallo en Rutas Sin Clasificar):**
   ```powershell
   python manage.py verificar_cobertura_permisos --fail-on-unclassified
   ```
   * **Salida:** Reporta en formato tabular todas las rutas existentes del backend pertenecientes a cortes futuros (3.1 en adelante) que aún no tienen decorador de permisos asignado.
   * **Exit Code:** `1` (`CommandError: Se encontraron operaciones API sin clasificar.`).
   * **Diagnóstico:** Comportamiento normativo esperado; refleja con exactitud el estado actual del feature sin enmascarar endpoints no clasificados.

---

## 8. Verificación del Worktree y Restricción de GATE A

Inspección de `git status`:
* **Archivos modificados (`M`):** Pertenecen exclusivamente al trabajo previo no commiteado de Etapa 2 y al archivo de tests `usuarios/tests.py`.
* **Archivos creados (`??`):**
  - Tests creados para auditoría y cobertura faltante:
    - `ferreapps/cuenta_corriente/test_actor_stage2.py`
    - `ferreapps/productos/test_actor_stage2.py`
    - `ferreapps/proveedores/test_actor_stage2.py`
* **Modificaciones a código productivo durante esta intervención:** **CERO (0)** líneas de código de producción modificadas.

---

## 9. Conclusión de GATE A y Próximos Pasos (GATE B)

La suite de tests de `feat-usuarios` queda auditada, despojada de mocks frágiles o tautológicos, expandida con cobertura completa de bases de datos multi-tenant en todos los módulos con modelos de actor, y con los defectos productivos claramente evidenciados mediante pruebas en rojo que respetan la especificación oficial.

### Plan para GATE B (al recibir autorización):
1. Corregir el manejo de autenticación anónima en los adaptadores DRF / configuración de autenticación para que las solicitudes no autenticadas retornen con precisión HTTP `401 Unauthorized` en lugar de `403 Forbidden`.
2. Confirmar que los 3 tests fallidos en `ferreapps.usuarios.test_permisos_stage3` pasen a verde.
3. Re-ejecutar toda la suite completa (`usuarios` + suites transversales) para garantizar 100% verde sin regresiones.
