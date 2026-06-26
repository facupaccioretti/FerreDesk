# ADR: Organizacion del Backend de FerreDesk

## Estado

Aprobado como estructura objetivo.

## Contexto

FerreDesk ya tiene una estructura real de backend basada en Django con tres zonas claras:

```text
backend/
  ferredesk_backend/
  tenants/
  acceso_publico/
  ferreapps/
    productos/
    ventas/
    caja/
    compras/
    clientes/
    proveedores/
    cuenta_corriente/
    informes/
    alertas/
    notas/
    reservas/
    usuarios/
    login/
    sistema/
```

La necesidad no es inventar una arquitectura desde cero, sino ordenar el crecimiento del codigo actual sin romper su forma base.

Los principales problemas a evitar son:

- archivos `views.py` y `serializers.py` demasiado grandes
- logica de negocio pesada mezclada en views o serializers
- `utils.py` usado como cajon de sastre
- falta de criterio uniforme entre apps

## Decision

La organizacion del backend debe respetar la estructura real de FerreDesk:

- `ferredesk_backend/` para configuracion transversal del proyecto
- `tenants/` para multi-tenant y onboarding de tenants
- `acceso_publico/` para flujos publicos no tenant
- `ferreapps/<app>/` para cada modulo de negocio

Dentro de cada app de `ferreapps/`, y tambien donde aplique en `tenants/` o `acceso_publico/`, la estructura objetivo sera:

```text
backend/
  ferreapps/
    app_real/
      __init__.py
      apps.py
      admin.py
      models.py
      urls.py

      views/
      serializers/
      services/
      selectors/
      validators/
      utils/
      tests/
      management/
      migrations/
```

## Alcance de cada zona del backend

### `ferredesk_backend/`

Contiene infraestructura transversal del proyecto.

Archivos esperables:

- `settings/`
- `urls.py`
- `urls_public.py`
- `permissions.py`
- `views.py`
- `utils/`

Que va aca:

- configuracion Django
- middlewares globales
- permisos compartidos
- excepciones compartidas
- observabilidad
- helpers tecnicos de infraestructura

Que no va aca:

- logica de negocio especifica de `ventas`, `productos`, `caja`, etc.

### `tenants/`

Contiene la logica de multi-tenancy, alta de tenants, dominios, provisionamiento y onboarding SaaS.

Puede usar la misma separacion interna por carpetas si el modulo lo necesita:

- `views/`
- `serializers/`
- `services/`
- `selectors/`
- `tests/`

### `acceso_publico/`

Contiene flujos publicos que no dependen de un tenant autenticado.

Ejemplos:

- login publico
- password reset publico
- token puente

Puede usar la misma separacion interna por carpetas si el modulo lo necesita.

### `ferreapps/`

Contiene las apps de negocio del ERP.

Ejemplos reales:

- `productos`
- `ventas`
- `caja`
- `compras`
- `clientes`
- `proveedores`
- `cuenta_corriente`

Estas apps son el foco principal de la convencion de organizacion.

## Estructura objetivo dentro de cada app

### Archivos raiz de la app

Se mantienen en la raiz:

- `models.py`
- `urls.py`
- `apps.py`
- `admin.py`

Se dejan en raiz porque son archivos base de Django y hoy FerreDesk ya trabaja asi.

### `views/`

Archivos que reciben requests HTTP y devuelven responses.

Responsabilidades:

- recibir `request`
- verificar autenticacion y permisos
- delegar validacion de payload a serializers
- llamar `services` o `selectors`
- devolver `Response`

Que tipo de archivos van:

- `views_abm.py`
- `views_listado.py`
- `views_detalle.py`
- `views_acciones.py`
- o nombres por flujo, por ejemplo `views_comprobantes.py`

Que no debe pasar:

- logica de negocio grande dentro de la view
- queries complejas mezcladas con escritura de negocio

### `serializers/`

Archivos que validan y transforman datos de entrada y salida de la API.

Responsabilidades:

- validar payloads
- serializar modelos o respuestas
- definir shape de entrada y salida

Que tipo de archivos van:

- `input_serializers.py`
- `output_serializers.py`
- `model_serializers.py`
- `filtros_serializers.py`

Que no debe pasar:

- meter reglas de negocio pesadas que deberian vivir en `services` o `validators`

### `services/`

Archivos con logica de negocio que modifica estado.

Responsabilidades:

- ejecutar casos de uso
- coordinar varios modelos
- manejar transacciones
- aplicar reglas de negocio operativas

Que tipo de archivos van:

- `crear_venta.py`
- `cerrar_caja.py`
- `importar_lista_precios.py`
- `procesar_carga_inicial.py`

Regla simple:

- si cambia estado del negocio, probablemente va en `services/`

### `selectors/`

Archivos con logica de lectura y consulta.

Responsabilidades:

- listados
- dashboards
- detalles enriquecidos
- querysets complejos
- busquedas y resumenes

Que tipo de archivos van:

- `listar_stock.py`
- `dashboard_ventas.py`
- `resumen_caja.py`
- `cuenta_corriente_cliente.py`

Regla simple:

- si consulta y compone datos sin cambiar estado, probablemente va en `selectors/`

### `validators/`

Archivos con reglas de negocio reutilizables.

Responsabilidades:

- validar estados permitidos
- impedir operaciones invalidas
- concentrar reglas que no dependen del transporte HTTP

Que tipo de archivos van:

- `comprobante_fiscal.py`
- `reglas_caja.py`
- `reglas_stock.py`

Regla simple:

- si es una regla del dominio reutilizable, probablemente va en `validators/`

### `utils/`

Helpers tecnicos chicos y puros.

Responsabilidades:

- fechas
- strings
- formateo
- archivos
- conversiones tecnicas

Que tipo de archivos van:

- `fechas.py`
- `money.py`
- `strings.py`
- `archivos.py`

Regla fuerte:

- `utils/` no debe transformarse en deposito de logica central del negocio

### `tests/`

Archivos de prueba de la app.

Responsabilidades:

- probar API
- probar services
- probar selectors
- probar validaciones
- probar integracion

Que tipo de archivos van:

- `test_views.py`
- `test_services.py`
- `test_selectors.py`
- `test_validators.py`
- `test_models.py`
- `test_integration.py`
- `factories.py`

### `management/`

Comandos Django y procesos operativos de la app.

En particular:

- `management/commands/`

Que tipo de archivos van:

- `procesar_importaciones_pendientes.py`
- `bootstrap_prod_local.py`
- `auditar_volumen_tenant.py`

### `migrations/`

Migraciones Django de la app.

## Convencion de idioma

La convencion elegida para FerreDesk es:

- carpetas tecnicas en ingles
- negocio y casos de uso en espanol

Ejemplos correctos:

- `services/cerrar_caja.py`
- `selectors/listar_ventas.py`
- `validators/comprobante_fiscal.py`

Ejemplos a evitar:

- mezclar `views/`, `serializers/`, `servicios/`, `repositorios/`
- traducir todo de forma inconsistente

## Reglas de ubicacion

- Si atiende HTTP: `views/`
- Si valida payload de API: `serializers/`
- Si modifica estado del negocio: `services/`
- Si hace lectura compleja: `selectors/`
- Si expresa reglas reutilizables del dominio: `validators/`
- Si solo ayuda tecnicamente y no carga negocio: `utils/`

## Capas opcionales

No se consideran obligatorias para todas las apps de FerreDesk:

- `repositories/`
- `domain/`

Solo deberian aparecer si una app realmente las necesita.

Ejemplos de cuando podrian aparecer:

- `repositories/` si hay mucho acceso a datos repetido o delicado
- `domain/` si una app necesita centralizar `constants.py`, `enums.py` o `exceptions.py`

No deben imponerse por defecto.

## Instruccion para agentes

```text
Organiza el backend de FerreDesk respetando su estructura real:
- El proyecto se organiza en `ferredesk_backend/`, `tenants/`, `acceso_publico/` y `ferreapps/`.
- Dentro de cada app de negocio, mantener `models.py`, `urls.py`, `apps.py` y `admin.py` en la raiz.
- Usar `views/`, `serializers/`, `services/`, `selectors/`, `validators/`, `utils/` y `tests/` cuando la complejidad lo justifique.
- Las views deben ser thin views.
- Los serializers validan input/output de API y no deben concentrar logica pesada de negocio.
- Los services contienen casos de uso que modifican estado.
- Los selectors contienen consultas de lectura, listados, dashboards y busquedas.
- Los validators contienen reglas de negocio reutilizables.
- Utils solo para helpers tecnicos puros y chicos.
- No usar `utils.py` como cajon de sastre.
- No introducir `repositories/` ni `domain/` salvo necesidad real.
- Cortar archivos por flujo de negocio, no por acumulacion.
```

## Consecuencias

Positivas:

- mejor alineacion con la estructura real del repo
- menor riesgo de seguir inflando `views.py` y `serializers.py`
- separacion de responsabilidades mas clara
- mejor base para refactor progresivo
- mejor capacidad para trabajar con agentes sobre reglas concretas

Costos:

- mas archivos por app
- requiere disciplina para no volver a mezclar responsabilidades
- la migracion debe ser progresiva y no masiva

## Notas

- Esta ADR define estructura objetivo, no exige migrar todas las apps de una vez.
- La prioridad de adopcion deberia estar en las apps mas grandes y sensibles, especialmente `ventas`, `productos` y `caja`.
