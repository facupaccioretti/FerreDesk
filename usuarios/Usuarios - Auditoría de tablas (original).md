> [!WARNING]
> **Documento histórico / de análisis. Prevalece Usuarios - Contrato y reglas.md (reglas finales consolidadas).**
> Documento original conservado solo como antecedente. Sus reglas y su plan están superados; prevalecen `Usuarios - Contrato y reglas.md` y `Usuarios - Decisiones de diseño paso 0.md`.
> No usar este archivo como fuente normativa ni como plan de implementación.
# Usuarios - Auditoría de tablas y rediseño propuesto (original)

> **Objetivo de la investigación:** Analizar exhaustivamente todas las tablas y modelos vinculados a Usuarios, Acceso, Tenants, Configuración y Negocio (`EmpresaTenant`, `CuentaAccesoPublico`, `Usuario`, `CliUsuario`, `Ferreteria`, `Sucursal`, etc.). Identificar redundancias, código muerto, acoplamientos innecesarios y proponer una reorganización limpia bajo el nuevo paradigma: **un negocio aislado por tenant con un Usuario Titular y sub-usuarios operadores con roles locales (sin cuentas globales para empleados).**

---

## 1. El Cambio de Paradigma: Qué teníamos vs. Qué necesitamos

### El modelo anterior (Ambición de cuenta global multi-tenant)
En las etapas iniciales del proyecto se ideó un esquema estilo SaaS B2B masivo (tipo Slack o Notion):
- Existía la idea de que un usuario (`juan@gmail.com`) tuviera una cuenta global centralizada en el schema `public`.
- Esa cuenta global podría asociarse a múltiples tenants con distintos roles en cada uno.
- Se implementó un esquema de autenticación puente (`CuentaAccesoPublico` + `TokenPuenteAcceso`) para que el usuario pudiera iniciar sesión en la landing central (`ferredesk.com`) y ser redirigido mediante un token efímero al subdominio del tenant.

### La realidad y decisión actual de FerreDesk
FerreDesk es un sistema de gestión comercial y ERP para comercios y pymes (ferreterías, pinturerías, corralones, etc.).
- **Cada negocio es un mundo aislado y autónomo.**
- **No existen empleados saltando entre diferentes ferreterías/negocios.**
- El negocio pertenece a **un único Titular** (dueño/responsable legal).
- Los empleados son **operadores locales del negocio** (cajeros, vendedores, encargados) que:
  1. Solo existen y tienen sentido dentro del schema de ese negocio.
  2. No tienen por qué tener cuenta en la landing de FerreDesk ni correo de plataforma.
  3. Ingresan directamente en el subdominio del negocio (`minegocio.ferredesk.com/login`) o mediante cambio de operador con PIN de 6 dígitos.
- **Conclusión arquitectónica:** Intentar meter a los empleados en tablas globales de `public` añade complejidad inútil, duplicación de hashes de contraseñas y vectores de falla innecesarios. La identidad del empleado es 100% **local al tenant**.

---

## 2. Inventario Exhaustivo de Modelos Actuales

A continuación se detalla cada tabla involucrada, sus campos, qué piezas de código la utilizan realmente, y su diagnóstico técnico.

### ── CAPA A: Schema `public` (Plataforma SaaS) ──

#### 1. `tenants.EmpresaTenant`
* **Tabla física:** `public.tenants_empresatenant` (hereda de `TenantMixin` de `django-tenants`).
* **Campos clave:**
  - `schema_name` (heredado, nombre del schema PostgreSQL).
  - `nombre` (CharField 200, nombre comercial del cliente).
  - `slug_subdominio` (SlugField 63, ej: `ferreteria-central`).
  - `email_admin` (EmailField, email de contacto/onboarding).
  - `estado_suscripcion` (`pendiente_verificacion`, `trial`, `activo`, `suspendido`, `cancelado`).
  - `fecha_fin_prueba`, `activo`, `fecha_creacion`.
* **Piezas de código que la usan:**
  - `TenantMainMiddleware`: Resuelve el schema de la base de datos para cada request entrante según el Host HTTP.
  - `SuscripcionMiddleware`: Bloquea requests con 403 si el estado es `suspendido` o `cancelado`.
  - Onboarding SaaS (`SolicitudOnboardingTenant`, `servicio_constructor_tenant.py`).
* **Grado de necesidad:** **100% INDISPENSABLE.** Es el corazón del aislamiento multitenant de la plataforma.
* **Redundancia identificada:** Almacena `nombre` y `email_admin`, los cuales se vuelven a duplicar al crear `Ferreteria` en el schema del tenant. (Esto es tolerable porque `EmpresaTenant` administra la suscripción comercial SaaS, mientras que el tenant administra su propia facturación).

#### 2. `tenants.Dominio`
* **Tabla física:** `public.tenants_dominio` (hereda de `DomainMixin`).
* **Campos:** `domain` (CharField unique, ej: `central.ferredesk.com`), `tenant` (FK `EmpresaTenant`), `is_primary` (BooleanField).
* **Piezas de código que la usan:** Enrutador de dominios de `django-tenants`.
* **Grado de necesidad:** **100% INDISPENSABLE.**

#### 3. `tenants.TokenVerificacionEmail` y `tenants.SolicitudOnboardingTenant`
* **Campos:** Tokens de confirmación de correo para auto-registro en la landing SaaS y cola de auditoría de creación de tenants.
* **Piezas de código que la usan:** Flujo público de onboarding (`/api/public/onboarding/*`).
* **Grado de necesidad:** **NECESARIOS** para el autoservicio de clientes desde la web pública.

#### 4. `acceso_publico.CuentaAccesoPublico`
* **Tabla física:** `public.acceso_publico_cuentaaccesopublico`.
* **Campos:**
  - `email` (EmailField, unique).
  - `password` (CharField, hash PBKDF2/bcrypt).
  - `nombre_mostrar` (CharField 150).
  - `username_tenant` (CharField 150).
  - `email_tenant` (EmailField).
  - `tenant_asignado` (FK `EmpresaTenant`).
  - `activo` (BooleanField), `ultimo_acceso`.
* **Piezas de código que la usan:**
  - `LoginPublicoAPIView` (`/api/public/acceso/login/`).
  - `PasswordResetPublicoAPIView`.
  - `crear_cuenta_acceso_publico()` en `servicio_onboarding_saas.py`.
* **Grado de necesidad:** **CONDICIONAL / SOLO PARA TITULAR.**
  - **Por qué existe:** Si un dueño entra a la landing central (`ferredesk.com`) y no recuerda su subdominio, pone su email y password de titular y el sistema lo redirige a su subdominio.
  - **Redundancia crítica:** Duplica la contraseña que ya existe en el modelo `Usuario` dentro del tenant. Si el Titular cambia la contraseña adentro del tenant sin sincronizar `CuentaAccesoPublico`, el login de la landing se desincroniza.
  - **Regla bajo el nuevo paradigma:** **NUNCA crear registros en esta tabla para empleados.** Solo existe a lo sumo 1 registro por tenant: el Titular de la cuenta.

#### 5. `acceso_publico.TokenPuenteAcceso`
* **Tabla física:** `public.acceso_publico_tokenpuenteacceso`.
* **Campos:** `token` (CharField 128), `cuenta` (FK), `tenant_asignado` (FK), `username_tenant`, `expira_en` (5 min), `usado`.
* **Piezas de código que la usan:** Login puente entre `ferredesk.com` y `<tenant>.ferredesk.com/api/login-bridge/`.
* **Grado de necesidad:** Necesario **únicamente** si se mantiene el formulario de login en la landing pública para el Titular. Para el funcionamiento interno del ERP es 100% prescindible.

---

### ── CAPA B: Schema `tenant` (Datos aislados de cada empresa) ──

#### 6. `usuarios.Usuario`
* **Tabla física:** `<schema>.usuarios_usuario` (hereda de `AbstractUser`).
* **Campos clave actuales:**
  - Campos estándar Django: `id`, `username`, `email`, `password`, `is_active`, `is_staff`, `is_superuser`, etc.
  - `tipo_usuario`: CharField (`admin`, `cli_admin`, `cli_user`, `prueba`, `auditor`).
  - `ferreteria`: ForeignKey a `productos.Ferreteria` (null=True).
* **Piezas de código que la usan:** Toda la autenticación del tenant, relaciones de auditoría (`Cheque.usuario_registro`, etc.).
* **Diagnóstico de Redundancias y Fallas de Diseño:**
  1. **`ferreteria = models.ForeignKey(Ferreteria)` ES 100% REDUNDANTE:**
     - En `django-tenants`, toda la base de datos de esa tabla vive en un schema que pertenece a **una sola empresa**.
     - No existen dos ferreterías/negocios compartiendo el mismo schema.
     - Vincular cada usuario a una FK de `Ferreteria` es un rezago de diseño multitenant por columna (shared-database, shared-schema). En PostgreSQL schemas, esto no tiene sentido.
  2. **`tipo_usuario` es un campo cosmético inútil:**
     - Existen 5 opciones pero no hay ningún sistema de permisos conectado. Solo una vista (`ActualizacionListaDePreciosViewSet.destroy`) chequea `tipo_usuario == 'admin'`.
* **Recomendación:** Debe transformarse en la entidad limpia del **Operador/Usuario del Negocio**, eliminando la FK a `Ferreteria` y conectándose a `PerfilAcceso` y `pin_hash`.

#### 7. `usuarios.CliUsuario`
* **Tabla física:** `<schema>.usuarios_cliusuario`.
* **Campos:**
  - `user`: OneToOneField(`Usuario`).
  - `cuenta_activa`: BooleanField(default=False).
  - `fecha_creacion`, `ultima_modificacion`.
* **Piezas de código que la usan:**
  - Creado en `ferreapps/usuarios/views.py:register` (vista desprotegida y sin uso en el frontend).
  - Leído en `login_view`: `if not cli_usuario.cuenta_activa: return 403`, envuelto en un `try...except CliUsuario.DoesNotExist: pass`.
* **Grado de necesidad:** **0% — BASURA TÉCNICA / CÓDIGO MUERTO.**
  - Django ya tiene nativamente `user.is_active` en `AbstractUser`. Crear un modelo OneToOne solo para tener `cuenta_activa` es una redundancia flagrante.
  - Si el usuario no tiene `CliUsuario`, el login lo deja pasar igual (`except: pass`).
* **Acción:** **Eliminar completamente.**

#### 8. `usuarios.Auditoria`
* **Tabla física:** `<schema>.usuarios_auditoria`.
* **Campos:** `usuario` (FK), `accion`, `timestamp`, `objeto_afectado`, `detalles`, `session_key`.
* **Piezas de código que la usan:** **NINGUNA.** Cero llamadas a `Auditoria.objects.create()` en todo el backend.
* **Grado de necesidad:** **0% — CÓDIGO MUERTO.**
* **Acción:** Deprecar y sustituir por el nuevo modelo de auditoría operativa real.

#### 9. `productos.Ferreteria` (El modelo a rediseñar)
* **Tabla física:** `<schema>.productos_ferreteria`.
* **Campos actuales (25+ campos):**
  - Identidad: `nombre`, `direccion`, `telefono`, `email`, `logo_empresa`.
  - Fiscal AFIP: `cuit_cuil`, `razon_social`, `situacion_iva`, `ingresos_brutos`, `inicio_actividad`, `punto_venta_arca`.
  - Seguridad/Certificados: `certificado_arca` (.pem), `clave_privada_arca` (.pem), `modo_arca`.
  - Estado ARCA: `arca_habilitado`, `arca_configurado`, `arca_ultima_validacion`, `arca_error_configuracion`.
  - Switches operativos: `permitir_stock_negativo`, `prefijo_codigo_barras`.
* **Piezas de código que la usan:** Prácticamente todo el módulo de ventas, emisión ARCA, configuración y comprobantes.
* **Diagnóstico de Fallas de Diseño:**
  1. **Acoplamiento de rubro:** El nombre `Ferreteria` excluye a cualquier otro negocio (corralón, distribuidora, bazar, etc.).
  2. **Ubicación incorrecta:** Vive en `ferreapps/productos/`. Los certificados de AFIP y los datos fiscales de la empresa no son productos.
  3. **Mezcla de responsabilidades:** En la misma tabla conviven datos de identidad pública, secretos criptográficos de AFIP y banderas de negocio.
* **Acción:** Renombrar a **`Negocio`** y consolidar allí la nueva bandera `modo_multiusuario_habilitado`.

#### 10. `productos.Sucursal`
* **Tabla física:** `<schema>.productos_sucursal`.
* **Campos:** `ferreteria` (FK), `nombre`, `direccion`, `telefono`, `es_principal`, `activa`.
* **Piezas de código que la usan:**
  - Se crea en `servicio_inicializacion_tenant.py` (`nombre="Principal"`).
  - Se verifica en tests de inicialización.
  - **No se usa en ninguna lógica de negocio:** `Venta`, `Compra`, `SesionCaja` usan un campo plano `SmallIntegerField(default=1)` en vez de vincularse por ForeignKey a `Sucursal`.
* **Grado de necesidad:** **DANGLING (Incompleto/Sin uso real).**
  - Actualmente es un cascarón vacío. No hay endpoints ni UI en el frontend para gestionar sucursales.

#### 11. `productos.Producto` y `productos.Categoria`
* **Tabla física:** `<schema>.productos_producto` y `<schema>.productos_categoria`.
* **Piezas de código que la usan:** **NINGUNA.**
* **Diagnóstico:** **100% CÓDIGO MUERTO.**
  - El ERP real utiliza `ferreapps.productos.Stock` y `Familia`.
  - `Producto` y `Categoria` fueron modelos primitivos del primer día de desarrollo que quedaron olvidados en `models.py`.
* **Acción:** Eliminar en una migración de limpieza para no confundir a futuros desarrolladores.

#### 12. Relaciones redundantes en `reservas.ReservaStock` y `reservas.FormLock`
* Ambas tablas tienen un campo `ferreteria = models.ForeignKey(Ferreteria, on_delete=models.CASCADE)`.
* En `reservas/views.py`: `data['ferreteria'] = request.user.ferreteria.id`.
* **Diagnóstico:** Al igual que en `Usuario`, esta FK es 100% redundante con el schema de PostgreSQL. Si `request.user.ferreteria` llega a ser `None`, el endpoint de reservas explota con `AttributeError`.

---

## 3. Matriz Comparativa: Qué se Queda, Qué se Va y Qué se Corrige

| Tabla / Modelo | Schema | Estado Actual | Diagnóstico | Decisión Arquitectónica |
|---|---|---|---|---|
| `EmpresaTenant` | `public` | Activo | Core de `django-tenants` | **SE QUEDA.** Administra suscripción SaaS. |
| `Dominio` | `public` | Activo | Core de routing HTTP | **SE QUEDA.** |
| `SolicitudOnboardingTenant` | `public` | Activo | Auditoría de creación de tenants | **SE QUEDA.** |
| `CuentaAccesoPublico` | `public` | Activo | Login centralizado en landing | **SE QUEDA SOLO PARA EL TITULAR.** Nunca crear registros para empleados. |
| `TokenPuenteAcceso` | `public` | Activo | Puente de login landing -> tenant | **SE QUEDA SOLO PARA EL TITULAR.** |
| `CliUsuario` | `tenant` | Semi-activo | Modelo OneToOne duplicado de `is_active` | **ELIMINAR.** Basura técnica. |
| `Auditoria` (usuarios) | `tenant` | Inactivo | Cero usos en todo el backend | **ELIMINAR.** Reemplazar por auditoría real. |
| `Producto` / `Categoria` | `tenant` | Inactivo | Modelos primitivos sin uso (se usa `Stock`) | **ELIMINAR.** Código muerto. |
| `Ferreteria` | `tenant` | Activo | Nombre acoplado, mal ubicado | **RENOMBRAR A `Negocio`.** |
| `Sucursal` | `tenant` | Pasivo | Cascarón sin FKs reales en ventas/caja | **MANTENER AISLADO.** No darle más peso por ahora. |
| `Usuario` | `tenant` | Activo | FK a Ferreteria redundante, sin roles | **REFACTORIZAR.** Quitar FK redundante, agregar `perfil_acceso`, `pin_hash`, `es_titular`. |
| `ReservaStock.ferreteria` | `tenant` | Activo | FK redundante que genera fragilidad | **ELIMINAR CAMPO** en fase de limpieza. |

---

## 4. La Nueva Arquitectura Limpia de Identidad y Negocio

```
SCHEMA "public" (Infraestructura SaaS)
┌─────────────────────────────────────────────────────────────┐
│ EmpresaTenant (Suscripción, Subdominio, Estado SaaS)        │
│    │                                                        │
│    ├── Dominio (empresa.ferredesk.com)                      │
│    │                                                        │
│    └── CuentaAccesoPublico (Solo 1 por empresa: El Titular) │
│           │                                                 │
│           └── TokenPuenteAcceso (Solo para landing login)   │
└─────────────────────────────────────────────────────────────┘
                               │
            Resuelve Schema PostgreSQL por Host HTTP
                               │
                               ▼
SCHEMA "tenant_<slug>" (Universo Aislado del Negocio)
┌─────────────────────────────────────────────────────────────┐
│ Negocio (Antes "Ferreteria") [Singleton: ID=1]              │
│    ├── Identidad comercial (Nombre, Logo, Dirección)        │
│    ├── Datos fiscales (CUIT, Razón Social, Condición IVA)   │
│    ├── Credenciales ARCA/AFIP (Certificados .pem, Modo)     │
│    ├── Políticas operativas (Stock negativo, Códigos)       │
│    └── modo_multiusuario_habilitado: Boolean (Persistente)  │
│                                                             │
│ PerfilAcceso (Conjunto dinámico de permisos)                │
│    ├── nombre: "Vendedor", "Cajero", "Encargado", etc.      │
│    ├── permisos: JSON { "ventas.facturar": true, ... }      │
│    └── es_titular: Boolean (Solo perfil interno raíz)       │
│                                                             │
│ Usuario (Operadores locales del negocio)                    │
│    ├── username / email / password                          │
│    ├── es_titular: Boolean (Solo el dueño de la cuenta)     │
│    ├── perfil_acceso: FK -> PerfilAcceso                    │
│    ├── pin_hash: CharField (Hash bcrypt de 6 dígitos)       │
│    ├── pin_temporal_hash: CharField                         │
│    └── activo_operador: Boolean                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Plan de Saneamiento y Migración sin Riesgo (Paso a Paso)

Para ejecutar esta reorganización respetando la base de datos del **cliente actualmente en producción**, el proceso se divide en etapas incrementales donde **ninguna etapa rompe la compatibilidad hacia atrás**:

### Etapa 1: Renombrar `Ferreteria` a `Negocio` y agregar `modo_multiusuario_habilitado`
1. **Migración Django con `RenameModel`:**
   - Renombra `Ferreteria` a `Negocio`.
   - En PostgreSQL ejecuta: `ALTER TABLE productos_ferreteria RENAME TO productos_negocio`.
   - **Cero pérdida de datos:** Todos los datos fiscales y certificados del cliente actual se preservan intactos.
2. **Agregar campo:**
   - `modo_multiusuario_habilitado = BooleanField(default=False)`.
3. **Compatibilidad de Endpoints:**
   - Crear `/api/negocio/` como ruta canónica.
   - Dejar `/api/ferreteria/` como alias retrocompatible para que la app no falle durante el deploy.

### Etapa 2: Limpieza de Modelos Muertos y Redundancias Inútiles
1. **Eliminar `CliUsuario`:**
   - Hacer un script de migración que asegure que todo `user.is_active` refleje si estaba activo.
   - Eliminar el modelo `CliUsuario` y la vista huérfana `usuarios/views.py:register`.
2. **Eliminar `Auditoria` (legacy de usuarios):**
   - Eliminar el modelo sin uso de `usuarios/models.py`.
3. **Eliminar `Producto` y `Categoria` (legacy de productos):**
   - Eliminar de `productos/models.py` para erradicar código muerto.

### Etapa 3: Desacoplar la FK redundante `Usuario.ferreteria`
1. Actualmente `Usuario.ferreteria` apunta a la ferretería del schema.
2. Como cada schema tiene exactamente un único `Negocio` (singleton), cualquier llamada a `request.user.ferreteria` o `request.user.negocio` puede reemplazarse por `Negocio.objects.first()`.
3. Marcar el campo como `null=True, blank=True` y deprecado, para luego removerlo sin impacto.

### Etapa 4: Montar el modelo de `PerfilAcceso` y campos de PIN
1. Crear el modelo `PerfilAcceso` con su catálogo JSON de 28 permisos.
2. Agregar a `Usuario`:
   - `es_titular = BooleanField(default=False)`.
   - `perfil_acceso = ForeignKey(PerfilAcceso, null=True, on_delete=PROTECT)`.
   - `pin_hash = CharField(max_length=128, blank=True)`.
   - `pin_temporal_hash = CharField(max_length=128, blank=True)`.
   - `pin_intentos_fallidos = PositiveSmallIntegerField(default=0)`.
   - `pin_bloqueado_hasta = DateTimeField(null=True, blank=True)`.
3. **Migración de datos para el cliente existente:**
   - Al usuario `admin` existente del cliente en producción se le asigna `es_titular = True`.
   - Como `modo_multiusuario_habilitado` arranca en `False`, el cliente **sigue operando exactamente igual que hoy**, sin que se le exija PIN ni selección de usuario hasta que él decida habilitarlo.

---

## 6. Conclusión y Beneficios del Rediseño

1. **Alineación con el negocio real:** FerreDesk deja de hablar de "ferreterías" en su código central y pasa a hablar de `Negocio`, permitiendo vender el ERP a pinturerías, corralones o cualquier comercio.
2. **Eliminación de deuda técnica temprana:** Se eliminan 4 tablas muertas/redundantes (`CliUsuario`, `Auditoria`, `Producto`, `Categoria`) antes de que el código crezca.
3. **Cero riesgo para el cliente actual:** Todas las migraciones usan `RenameModel` y valores por defecto (`False`), asegurando que la base de datos de producción pase de versión sin alterar un solo dato fiscal ni interrumpir la operación.
4. **Arquitectura limpia para permisos:** El nuevo sistema de permisos y operadores se monta sobre una base sólida y desacoplada, sin arrastrar ataduras innecesarias con el schema `public`.
