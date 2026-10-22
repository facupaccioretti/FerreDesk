> [!WARNING]
> **Documento histórico / de análisis. Prevalece Usuarios - Contrato y reglas.md (reglas finales consolidadas).**
> El inventario describe el código de la fecha del relevamiento; sus propuestas de diseño son históricas. Para identidad, activación, PIN, permisos, actor, Caja X/Z y módulos deprecados prevalecen `Usuarios - Contrato y reglas.md` y `Usuarios - Decisiones de diseño paso 0.md`.
> Ante cualquier contradicción, seguir esos documentos.
# Usuarios - Relevamiento de endpoints y accesos actuales

## Resumen Ejecutivo (10 líneas)

FerreDesk es un ERP/POS multi-tenant para ferreterías (Django 5.x + DRF + React) desplegado en Render. El multi-tenancy se resuelve con `django-tenants` (un schema PostgreSQL por empresa). Hoy existe un único modelo de usuario (`usuarios.Usuario`, que extiende `AbstractUser`) con un campo `tipo_usuario` de 5 opciones estáticas, pero **no hay sistema de permisos granulares**: la única clase de permiso custom es `EsAdminTenant` (usada en 1 solo lugar). Todos los endpoints del tenant exigen solo `IsAuthenticated` — cualquier usuario autenticado puede hacer cualquier operación (crear/modificar stock, ventas, caja, ARCA fiscal, cuentas corrientes, etc.). No hay chequeos de roles en el frontend (no se ocultan ni deshabilitan secciones según tipo de usuario). Existe un modelo `Auditoria` pero no se usa activamente en el código de negocio. La autenticación es por sesión Django (cookies HttpOnly) con un flujo de "bridge token" para login desde el dominio público al subdominio del tenant. El sistema tiene ~100+ endpoints de API y ~15 apps de backend, todos expuestos sin restricción a cualquier usuario autenticado del tenant. La base para implementar roles y permisos es sólida pero inexistente hoy: se parte de cero.

---

## Cobertura de la Revisión

### Directorios y apps revisados ✅
| Área | Ruta | Estado |
|------|------|--------|
| Settings (base/dev/prod/prod_local) | `ferredesk_backend/settings/` | ✅ Completo |
| URLs principales y públicos | `ferredesk_backend/urls.py`, `urls_public.py` | ✅ Completo |
| Middleware custom | `ferredesk_backend/utils/middlewares.py` | ✅ Completo |
| Permisos DRF custom | `ferredesk_backend/permissions.py` | ✅ Completo |
| Views proyecto | `ferredesk_backend/views.py` | ✅ Completo |
| App `tenants` | `tenants/` (models, views, services, tests, urls) | ✅ Completo |
| App `acceso_publico` | `acceso_publico/` (models, views, services, urls, tests) | ✅ Completo |
| App `usuarios` | `ferreapps/usuarios/` (models, views, urls, admin) | ✅ Completo |
| App `login` | `ferreapps/login/` (views, urls, serializers, services, tests) | ✅ Completo |
| App `productos` | `ferreapps/productos/` (models, views, urls, services, setup) | ✅ Completo |
| App `clientes` | `ferreapps/clientes/` | ✅ Completo |
| App `proveedores` | `ferreapps/proveedores/` | ✅ Completo |
| App `ventas` (incluye ARCA) | `ferreapps/ventas/` + `ventas/ARCA/` | ✅ Completo |
| App `caja` | `ferreapps/caja/` | ✅ Completo |
| App `cuenta_corriente` | `ferreapps/cuenta_corriente/` | ✅ Completo |
| App `compras` | `ferreapps/compras/` | ✅ Completo |
| App `promos` | `ferreapps/promos/` | ✅ Completo |
| App `informes` | `ferreapps/informes/` | ✅ Completo |
| App `alertas` | `ferreapps/alertas/` | ✅ Completo |
| App `notas` | `ferreapps/notas/` | ✅ Completo |
| App `reservas` | `ferreapps/reservas/` | ✅ Completo |
| App `sistema` | `ferreapps/sistema/` | ✅ Completo |
| Frontend React (src/) | `frontend/src/` (App.js, context, domains, services, components, hooks, layouts, modules) | ✅ Completo |
| Scripts deploy/management | `scripts/`, `ferredesk_v0/scripts/` | ✅ Completo |
| Tests | Todos los archivos test_*.py encontrados | ✅ Completo |
| Legacy | `backend/legacy/` | ✅ Completo |
| Templates | `backend/templates/registration/` | ✅ Completo |
| Deploy config | `render.yaml` | ✅ Completo |

### No revisado (y justificación)
| Área | Razón |
|------|-------|
| `ponytail/` | Herramienta de AI coding, no es parte de FerreDesk |
| `arca_arg/` | Biblioteca externa para ARCA/AFIP, repo independiente con su propio `.git` |
| `codebase_to_course/` | Material educativo, no código de producción |
| `ObsidianNotas/` | Documentación interna en Obsidian (no código ejecutable) |
| `.documentos/` | Documentación, instaladores, launchers |
| `node_modules/`, `venv/`, `migrations/`, `__pycache__/` | Dependencias y artefactos generados |

---

## A. Mapa del Sistema

### A.1 Estructura de Apps Backend

```
ferredesk_v0/backend/
├── ferredesk_backend/          # Proyecto Django principal
│   ├── settings/               # base.py, dev.py, prod.py, prod_local.py
│   ├── urls.py                 # URLConf para tenant schemas
│   ├── urls_public.py          # URLConf para schema public
│   ├── permissions.py          # EsAdminTenant (único permiso custom)
│   ├── views.py                # health_check, serve_react_root_file
│   └── utils/
│       ├── middlewares.py      # HealthCheckBypass, SuscripcionMiddleware
│       ├── exceptions.py       # custom DRF exception handler
│       └── resend_api.py       # email via Resend
├── tenants/                    # Multi-tenancy (schema public)
│   ├── models.py               # EmpresaTenant, Dominio, TokenVerificacionEmail, SolicitudOnboarding
│   ├── views/                  # Onboarding SaaS (registro, activación email)
│   └── services/               # Provisioning, verificación email, constructor tenant
├── acceso_publico/             # Login global desde dominio público (schema public)
│   ├── models.py               # CuentaAccesoPublico, TokenPuenteAcceso
│   ├── views.py                # LoginPublicoAPIView, PasswordResetPublicoAPIView
│   └── services.py             # Bridge tokens, autenticación global
└── ferreapps/                  # Apps de negocio (tenant-only)
    ├── usuarios/               # Modelo de usuario (AbstractUser custom)
    ├── login/                  # Login/logout/CSRF/bridge/password-reset del tenant
    ├── productos/              # Stock, Familias, Proveedores producto, AlicuotaIVA, Ferretería, Códigos barras, Listas de precios
    ├── clientes/               # Clientes, Localidades, Provincias, TipoIVA, etc.
    ├── proveedores/            # Proveedores con carga inicial y CUIT/ARCA
    ├── ventas/                 # Ventas, Comprobantes, Presupuestos, Postventa, ARCA fiscal, Libro IVA, Dashboard
    ├── compras/                # Compras, Órdenes de compra, PDF export
    ├── caja/                   # Sesiones de caja, Movimientos, Métodos de pago, Cheques, Cuentas banco, Control fondos
    ├── cuenta_corriente/       # CC Clientes (Recibos, Imputaciones), CC Proveedores (Órdenes pago)
    ├── promos/                 # Promociones
    ├── informes/               # Stock bajo (vista + PDF)
    ├── alertas/                # Alertas y Notificaciones
    ├── notas/                  # Notas internas
    ├── reservas/               # Reservas de stock + Form locks
    └── sistema/                # Vacío (urls vacías, sin endpoints definidos)
```

### A.2 Multi-tenancy

**Tecnología**: `django-tenants` con schema isolation por PostgreSQL.

| Aspecto | Detalle | Referencia |
|---------|---------|------------|
| Tenant Model | `tenants.EmpresaTenant` (hereda `TenantMixin`) | [tenants/models.py#L5](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/tenants/models.py#L5) |
| Domain Model | `tenants.Dominio` (hereda `DomainMixin`) | [tenants/models.py#L98](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/tenants/models.py#L98) |
| Schema routing | `TenantMainMiddleware` resuelve schema por subdominio | [base.py#L60](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/base.py#L60) |
| DB Router | `TenantSyncRouter` | [base.py#L77](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/base.py#L77) |
| URL dispatch | Tenant: `ferredesk_backend.urls`, Public: `ferredesk_backend.urls_public` | [base.py#L73-L74](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/base.py#L73-L74) |
| Fallback | `SHOW_PUBLIC_IF_NO_TENANT_FOUND = True` | [base.py#L78](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/base.py#L78) |

**Qué vive en public**:
- `EmpresaTenant`, `Dominio`, `TokenVerificacionEmail`, `SolicitudOnboardingTenant` → gestión de la plataforma SaaS
- `CuentaAccesoPublico`, `TokenPuenteAcceso` → login global pre-tenant
- `axes` → brute-force protection (shared)

**Qué vive en cada tenant**:
- `auth`, `sessions`, `admin` → Django auth por tenant
- Todo en `ferreapps/*` → datos de negocio aislados por schema

### A.3 Autenticación

#### Flujo 1: Login desde dominio público (SaaS Landing)
1. Usuario ingresa email/password en el dominio principal (ej: `ferredesk.com`)
2. Frontend POST a `/api/public/acceso/login/` ([acceso_publico/views.py#L26](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/acceso_publico/views.py#L26))
3. Backend autentica contra `CuentaAccesoPublico` en schema public ([acceso_publico/services.py#L67](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/acceso_publico/services.py#L67))
4. Se genera un `TokenPuenteAcceso` efímero de 5 minutos ([acceso_publico/services.py#L114](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/acceso_publico/services.py#L114))
5. Frontend recibe la URL del tenant y el token, crea un `<form>` hidden y POST al `/api/login-bridge/` del subdominio del tenant
6. Bridge valida el token, busca el `Usuario` tenant y hace `login(request, usuario)` ([login/views.py#L110-L166](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L110-L166))
7. Se establece una sesión Django estándar en el subdominio del tenant

#### Flujo 2: Login directo al tenant (subdominio)
1. Usuario ingresa username/password en `empresa.ferredesk.com/login`
2. Frontend POST a `/api/login/` ([login/views.py#L28](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L28))
3. `authenticate()` valida credenciales contra `Usuario` en el schema del tenant
4. Se verifica `CliUsuario.cuenta_activa` si existe ([login/views.py#L39-L47](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L39-L47))
5. `login(request, user)` establece sesión

#### Flujo 3: Logout
- POST a `/api/logout/` llama `django.contrib.auth.logout()` ([login/views.py#L76-L80](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L76-L80))

#### Flujo 4: Password Reset (Tenant)
- POST a `/api/auth/password-reset/` → envía email con link de reset ([login/views.py#L169-L221](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L169-L221))
- POST a `/api/auth/password-reset/confirm/` con uid/token → `AllowAny`, cambia contraseña ([login/views.py#L224-L244](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L224-L244))

#### Flujo 5: Password Reset (Público)
- POST a `/api/public/acceso/password-reset/` → enruta al tenant para enviar email ([acceso_publico/views.py#L94-L118](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/acceso_publico/views.py#L94-L118))

#### Sesión check
- GET `/api/user/` → devuelve datos del usuario autenticado o 401 ([login/views.py#L93-L106](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L93-L106))

#### Modelo de Usuario
```python
# ferreapps/usuarios/models.py:L7-L27
class Usuario(AbstractUser):
    TIPO_CHOICES = [
        ('admin', 'Administrador'),
        ('cli_admin', 'Administrador de Cliente'),
        ('cli_user', 'Usuario de Cliente'),
        ('prueba', 'Usuario de Prueba'),
        ('auditor', 'Auditor'),
    ]
    tipo_usuario = CharField(max_length=20, choices=TIPO_CHOICES, default='cli_user')
    ferreteria = ForeignKey('productos.Ferreteria', on_delete=SET_NULL, null=True, blank=True)
```

> [!WARNING]
> Los tipos `cli_admin`, `cli_user`, `prueba` y `auditor` existen como opciones pero **no se usan en ningún chequeo de permisos** en el código de backend (excepto `admin` que se chequea en un solo lugar). Son puramente informativos hoy.

#### Seguridad de sesiones y cookies

| Setting | Dev | Prod | Referencia |
|---------|-----|------|------------|
| `SESSION_COOKIE_SECURE` | No definido | `True` | [prod.py#L131](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/prod.py#L131) |
| `SESSION_COOKIE_HTTPONLY` | No definido | `True` | [prod.py#L132](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/prod.py#L132) |
| `CSRF_COOKIE_SECURE` | No definido | `True` | [prod.py#L130](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/prod.py#L130) |
| `CSRF_COOKIE_HTTPONLY` | No definido | `True` | [prod.py#L133](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/prod.py#L133) |
| Rate limiting (Axes) | 5 intentos, cooldown 1 hora | Idem | [base.py#L147-L149](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/base.py#L147-L149) |
| Auth backends | AxesStandaloneBackend + ModelBackend | Idem | [base.py#L143-L146](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/base.py#L143-L146) |

---

## B. Inventario Exhaustivo de la Superficie de Acceso

> [!NOTE]
> `DEFAULT_PERMISSION_CLASSES = [IsAuthenticated]` ([base.py#L123-L124](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/base.py#L123-L124)).
> A menos que se indique otro permiso, todo endpoint hereda `IsAuthenticated`.
> Autenticación: `SessionAuthentication` + `BasicAuthentication` ([base.py#L126-L129](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/base.py#L126-L129)).

### B.1 Endpoints Públicos (schema public)

| URL | Método | Vista | Archivo:Línea | Permiso | Lee/Escribe | Riesgo |
|-----|--------|-------|---------------|---------|-------------|--------|
| `/api/health/` | GET | `health_check` | [views.py#L7](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/views.py#L7) | Ninguno (bypass middleware) | Lee | Bajo |
| `/api/registro-saas/` | POST | `RegistroSaaSAPIView` | tenants/views | `AllowAny` | Escribe: tenant, dominio, usuario | **Configuración** — Crea tenants |
| `/api/csrf/` | GET | `get_csrf` | [login/views.py#L82-L91](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L82-L91) | Ninguno | Lee | Bajo |
| `/api/public/acceso/login/` | POST | `LoginPublicoAPIView` | [acceso_publico/views.py#L26](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/acceso_publico/views.py#L26) | `AllowAny`, `auth=[]` | Lee/Escribe: token | Bajo |
| `/api/public/acceso/password-reset/` | POST | `PasswordResetPublicoAPIView` | [acceso_publico/views.py#L94](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/acceso_publico/views.py#L94) | `AllowAny`, `auth=[]` | Escribe: envía email | Bajo |
| `/api/public/onboarding/activar-email/` | POST | `ActivarEmailOnboardingAPIView` | tenants/views | `AllowAny` | Escribe: activa tenant | **Configuración** |
| `/api/public/onboarding/validar-slug/` | POST | `ValidarSlugOnboardingAPIView` | tenants/views | `AllowAny` | Lee | Bajo |
| `/api/public/onboarding/tenants/` | POST | `CrearTenantOnboardingAPIView` | tenants/views | `AllowAny` | Escribe: crea tenant completo | **Configuración** |
| `/api/public/onboarding/solicitudes/<id>/` | GET | `EstadoSolicitudOnboardingAPIView` | tenants/views | `AllowAny` | Lee | Bajo |
| `/api/public/onboarding/reenviar-email/` | POST | `ReenviarEmailOnboardingAPIView` | tenants/views | `AllowAny` | Escribe: envía email | Bajo |
| `/api/productos/servir-logo-arca/` | GET | `servir_logo_arca` | productos/views | `AllowAny` | Lee: archivo | Bajo |

### B.2 Endpoints del Tenant (schema de empresa) — Login/Sesión

| URL | Método | Vista | Archivo:Línea | Permiso | Lee/Escribe | Riesgo |
|-----|--------|-------|---------------|---------|-------------|--------|
| `/api/login/` | POST | `login_view` | [login/views.py#L28](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L28) | Ninguno explícito (FBV sin decorador) | Escribe: sesión | Bajo |
| `/api/login-bridge/` | POST | `login_bridge_view` | [login/views.py#L109](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L109) | `@csrf_exempt` | Escribe: sesión | Medio (csrf_exempt) |
| `/api/logout/` | POST | `logout_view` | [login/views.py#L76](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L76) | Ninguno explícito | Escribe: destruye sesión | Bajo |
| `/api/user/` | GET | `user_view` | [login/views.py#L93](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L93) | Inline check `is_authenticated` | Lee | Bajo |
| `/api/csrf/` | GET | `get_csrf` | [login/views.py#L82](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L82) | Ninguno | Lee | Bajo |
| `/api/auth/password-reset/` | POST | `password_reset_request_view` | [login/views.py#L169](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L169) | Ninguno explícito | Escribe: envía email | Bajo |
| `/api/auth/password-reset/confirm/` | POST | `PasswordResetConfirmAPIView` | [login/views.py#L224](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L224) | `AllowAny` | Escribe: cambia password | **Configuración** |
| `/api/usuarios/register/` | POST | `register` | [usuarios/views.py#L13](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/usuarios/views.py#L13) | Ninguno explícito (FBV sin decorador DRF) | Escribe: crea usuario | **Configuración** — ⚠️ sin auth |

### B.3 Endpoints del Tenant — Productos

| URL | Método | Vista | Permiso | Lee/Escribe | Riesgo |
|-----|--------|-------|---------|-------------|--------|
| `/api/productos/stock/` | CRUD | `StockViewSet` | `IsAuthenticated` | Lee/Escribe: productos y stock | **Escritura** — modifica stock |
| `/api/productos/proveedores/` | CRUD | `ProveedorViewSet` | `IsAuthenticated` | Lee/Escribe: proveedores de producto | Escritura |
| `/api/productos/stockprove/` | CRUD | `StockProveViewSet` | `IsAuthenticated` | Lee/Escribe: relación stock-proveedor | Escritura |
| `/api/productos/familias/` | CRUD | `FamiliaViewSet` | `IsAuthenticated` | Lee/Escribe: familias/categorías | Escritura |
| `/api/productos/alicuotasiva/` | CRUD | `AlicuotaIVAViewSet` | `IsAuthenticated` | Lee/Escribe: alícuotas IVA | **Fiscal** |
| `/api/productos/vista-stock-producto/` | CRUD | `VistaStockProductoViewSet` | `IsAuthenticated` | Lee/Escribe | Escritura |
| `/api/productos/listas-precio/` | CRUD | `ListaPrecioViewSet` | `IsAuthenticated` | Lee/Escribe: listas de precios | **Financiero** — modifica precios |
| `/api/productos/precios-lista/` | CRUD | `PrecioProductoListaViewSet` | `IsAuthenticated` | Lee/Escribe: precios por lista | **Financiero** |
| `/api/productos/actualizaciones-listas/` | CRUD | `ActualizacionListaDePreciosViewSet` | `EsAdminTenant` en `destroy` | Auditoria de listas | **Financiero** |
| `/api/productos/proveedores/<id>/upload-price-list/` | POST | `UploadListaPreciosProveedor` | `IsAuthenticated` | Escribe: importa lista precios | **Financiero** |
| `/api/productos/crear-producto-con-relaciones/` | POST | FBV | `IsAuthenticated` | Escribe: producto+precios+stock | **Escritura** |
| `/api/productos/editar-producto-con-relaciones/` | POST | FBV | `IsAuthenticated` | Escribe: edita producto completo | **Escritura** |
| `/api/productos/codigo-barras/*/` | GET/POST | Views códigos barras | `IsAuthenticated` | Lee/Escribe: códigos barras | Escritura |
| `/api/ferreteria/` | GET/PUT | `FerreteriaAPIView` | `IsAuthenticated` | Lee/Escribe: datos de la ferretería | **Configuración** |
| `/api/ferreteria/estado-setup/` | GET | `EstadoSetupAPIView` | `IsAuthenticated` | Lee | Bajo |
| `/api/pos/productos/lookup/` | GET | `PosProductoLookupAPIView` | `IsAuthenticated` | Lee | Bajo |
| `/api/pos/productos/search/` | GET | `PosProductoSearchAPIView` | `IsAuthenticated` | Lee | Bajo |
| `/api/productos/servir-logo-arca/` | GET | `servir_logo_arca` | `AllowAny` | Lee: archivo | Bajo |
| `/api/productos/servir-logo-empresa/` | GET | `servir_logo_empresa` | `AllowAny` | Lee: archivo | Bajo |

### B.4 Endpoints del Tenant — Clientes

| URL | Método | Vista | Permiso | Riesgo |
|-----|--------|-------|---------|--------|
| `/api/clientes/clientes/` | CRUD | `ClienteViewSet` | `IsAuthenticated` | **Escritura** — datos cliente |
| `/api/clientes/localidades/` | CRUD | `LocalidadViewSet` | `IsAuthenticated` | Escritura |
| `/api/clientes/provincias/` | CRUD | `ProvinciaViewSet` | `IsAuthenticated` | Escritura |
| `/api/clientes/barrios/` | CRUD | `BarrioViewSet` | `IsAuthenticated` | Escritura |
| `/api/clientes/tiposiva/` | CRUD | `TipoIVAViewSet` | `IsAuthenticated` | **Fiscal** |
| `/api/clientes/transportes/` | CRUD | `TransporteViewSet` | `IsAuthenticated` | Escritura |
| `/api/clientes/vendedores/` | CRUD | `VendedorViewSet` | `IsAuthenticated` | Escritura |
| `/api/clientes/plazos/` | CRUD | `PlazoViewSet` | `IsAuthenticated` | Escritura |
| `/api/clientes/categorias/` | CRUD | `CategoriaClienteViewSet` | `IsAuthenticated` | Escritura |
| `/api/clientes/validar-cuit/` | POST | `ValidarCUITAPIView` | `IsAuthenticated` | Lectura (ARCA) |
| `/api/clientes/procesar-cuit-arca/` | POST | `ProcesarCuitArcaAPIView` | `IsAuthenticated` | Lectura (ARCA) |

### B.5 Endpoints del Tenant — Proveedores

| URL | Método | Vista | Permiso | Riesgo |
|-----|--------|-------|---------|--------|
| `/api/proveedores/` | CRUD | `ProveedorViewSet` | `IsAuthenticated` | Escritura |
| `/api/proveedores/<id>/historial-importaciones/` | GET | APIView | `IsAuthenticated` | Lectura |
| `/api/proveedores/<id>/carga-inicial/previsualizar/` | POST | APIView | `IsAuthenticated` | Lectura |
| `/api/proveedores/<id>/carga-inicial/importar/` | POST | APIView | `IsAuthenticated` | **Escritura** — carga masiva |
| `/api/proveedores/validar-cuit/` | POST | APIView | `IsAuthenticated` | Lectura (ARCA) |
| `/api/proveedores/procesar-cuit-arca/` | POST | APIView | `IsAuthenticated` | Lectura (ARCA) |

### B.6 Endpoints del Tenant — Ventas/Comprobantes/ARCA

| URL | Método | Vista | Permiso | Riesgo |
|-----|--------|-------|---------|--------|
| `/api/comprobantes/` | CRUD | `ComprobanteViewSet` | `IsAuthenticated` | **Fiscal** — comprobantes fiscales |
| `/api/ventas/` | CRUD | `VentaViewSet` | `IsAuthenticated` | **Financiero** — ventas |
| `/api/venta-detalle-item/` | CRUD | `VentaDetalleItemViewSet` | `IsAuthenticated` | Escritura |
| `/api/venta-detalle-man/` | CRUD | `VentaDetalleManViewSet` | `IsAuthenticated` | Escritura |
| `/api/venta-remped/` | CRUD | `VentaRemPedViewSet` | `IsAuthenticated` | Escritura |
| `/api/venta-detalle-item-calculado/` | CRUD | `VentaDetalleItemCalculadoViewSet` | `IsAuthenticated` | Escritura |
| `/api/venta-iva-alicuota/` | CRUD | `VentaIVAAlicuotaViewSet` | `IsAuthenticated` | **Fiscal** |
| `/api/venta-calculada/` | CRUD | `VentaCalculadaViewSet` | `IsAuthenticated` | Financiero |
| `/api/convertir-presupuesto/` | POST | FBV | `IsAuthenticated` | **Financiero/Fiscal** — genera venta/factura |
| `/api/convertir-factura-interna/` | POST | FBV | `IsAuthenticated` | **Fiscal** — ARCA |
| `/api/verificar-imputaciones/<id>/` | GET | FBV | `IsAuthenticated` | Lectura |
| `/api/eliminar-auto-imputaciones-cliente-generico/<id>/` | DELETE | FBV | `IsAuthenticated` | **Destructivo/Financiero** |
| `/api/postventa/devoluciones/previsualizar/` | POST | FBV | `IsAuthenticated` | Lectura |
| `/api/postventa/devoluciones/confirmar/` | POST | FBV | `IsAuthenticated` | **Financiero** — nota de crédito |
| `/api/postventa/cambios/previsualizar/` | POST | FBV | `IsAuthenticated` | Lectura |
| `/api/postventa/cambios/confirmar/` | POST | FBV | `IsAuthenticated` | **Financiero** — cambio/NC+ND |
| `/api/postventa/origen/<venta_id>/` | GET | FBV | `IsAuthenticated` | Lectura |
| `/api/libro-iva-ventas/generar/` | POST | FBV | `IsAuthenticated` | **Fiscal** — libro IVA |
| `/api/libro-iva-ventas/estadisticas/` | GET | FBV | `IsAuthenticated` | Fiscal — lectura |
| `/api/libro-iva-ventas/export/pdf\|excel\|json\|txt/` | GET | FBV | `IsAuthenticated` | Fiscal — exportación |
| `/api/home/productos-mas-vendidos/` | GET | FBV | `IsAuthenticated` | Lectura |
| `/api/home/ventas-por-dia/` | GET | FBV | `IsAuthenticated` | Lectura |
| `/api/home/clientes-mas-ventas/` | GET | FBV | `IsAuthenticated` | Lectura |
| `/api/presupuestos/eliminar-antiguos/` | DELETE | FBV | `IsAuthenticated` | **Destructivo** |
| `/api/presupuestos/vista-previa-antiguos/` | GET | FBV | `IsAuthenticated` | Lectura |

### B.7 Endpoints del Tenant — Caja

| URL | Método | Vista | Permiso | Riesgo |
|-----|--------|-------|---------|--------|
| `/api/caja/sesiones/` | CRUD | `SesionCajaViewSet` | `IsAuthenticated` | **Financiero** — abrir/cerrar caja |
| `/api/caja/movimientos/` | CRUD | `MovimientoCajaViewSet` | `IsAuthenticated` | **Financiero** — ingresos/egresos |
| `/api/caja/metodos-pago/` | CRUD | `MetodoPagoViewSet` | `IsAuthenticated` | **Configuración** |
| `/api/caja/pagos/` | CRUD | `PagoVentaViewSet` | `IsAuthenticated` | **Financiero** |
| `/api/caja/cuentas-banco/` | CRUD | `CuentaBancoViewSet` | `IsAuthenticated` | **Configuración** |
| `/api/caja/cheques/` | CRUD | `ChequeViewSet` | `IsAuthenticated` | **Financiero** |
| `/api/caja/control-fondos/` | GET | `ControlFondosAPIView` | `IsAuthenticated` | Lectura financiera |

### B.8 Endpoints del Tenant — Cuenta Corriente

| URL | Método | Vista | Permiso | Riesgo |
|-----|--------|-------|---------|--------|
| `/api/cuenta-corriente/cliente/<id>/` | GET | FBV | `IsAuthenticated` | Lectura financiera |
| `/api/cuenta-corriente/cliente/<id>/facturas-pendientes/` | GET | FBV | `IsAuthenticated` | Lectura financiera |
| `/api/cuenta-corriente/clientes-con-movimientos/` | GET | FBV | `IsAuthenticated` | Lectura |
| `/api/cuenta-corriente/crear-recibo/` | POST | FBV | `IsAuthenticated` | **Financiero** — recibos |
| `/api/cuenta-corriente/imputar-existente/` | POST | FBV | `IsAuthenticated` | **Financiero** |
| `/api/cuenta-corriente/anular-recibo/` | POST | FBV | `IsAuthenticated` | **Destructivo/Financiero** |
| `/api/cuenta-corriente/anular-autoimputacion/` | POST | FBV | `IsAuthenticated` | **Destructivo/Financiero** |
| `/api/cuenta-corriente/modificar-imputaciones/` | POST | FBV | `IsAuthenticated` | **Financiero** |
| `/api/cuenta-corriente/comprobante/<id>/detalle/` | GET | FBV | `IsAuthenticated` | Lectura |
| `/api/cuenta-corriente/imputacion-real/<id>/<id>/` | GET | FBV | `IsAuthenticated` | Lectura |
| `/api/cuenta-corriente/proveedor/<id>/` | GET | FBV | `IsAuthenticated` | Lectura financiera |
| `/api/cuenta-corriente/proveedor/<id>/compras-pendientes/` | GET | FBV | `IsAuthenticated` | Lectura |
| `/api/cuenta-corriente/proveedores-con-movimientos/` | GET | FBV | `IsAuthenticated` | Lectura |
| `/api/cuenta-corriente/crear-orden-pago/` | POST | FBV | `IsAuthenticated` | **Financiero** |
| `/api/cuenta-corriente/anular-orden-pago/<id>/` | POST | FBV | `IsAuthenticated` | **Destructivo/Financiero** |
| `/api/cuenta-corriente/proveedor/imputar/` | POST | FBV | `IsAuthenticated` | **Financiero** |
| `/api/cuenta-corriente/crear-ajuste-proveedor/` | POST | FBV | `IsAuthenticated` | **Financiero** |
| `/api/cuenta-corriente/imputacion/<id>/eliminar/` | DELETE | FBV | `IsAuthenticated` | **Destructivo/Financiero** |
| `/api/cuenta-corriente/status/` | GET | `CuentaCorrienteAPIView` | `IsAuthenticated` | Lectura |

### B.9 Endpoints del Tenant — Compras

| URL | Método | Vista | Permiso | Riesgo |
|-----|--------|-------|---------|--------|
| `/api/compras/` | CRUD | `CompraViewSet` | `IsAuthenticated` | **Financiero** |
| `/api/items/` | CRUD | `CompraDetalleItemViewSet` | `IsAuthenticated` | Escritura |
| `/api/ordenes-compra/` | CRUD | `OrdenCompraViewSet` | `IsAuthenticated` | Escritura |
| `/api/ordenes-compra-items/` | CRUD | `OrdenCompraDetalleItemViewSet` | `IsAuthenticated` | Escritura |
| `/api/compras/proveedores/activos/` | GET | FBV | `IsAuthenticated` | Lectura |
| `/api/compras/proveedores/<id>/productos/` | GET | FBV | `IsAuthenticated` | Lectura |
| `/api/compras/productos/lookup/` | GET | APIView | `IsAuthenticated` | Lectura |
| `/api/compras/productos/buscar-codigo/` | GET | FBV | `IsAuthenticated` | Lectura |
| `/api/compras/alicuotas-iva/` | GET | FBV | `IsAuthenticated` | Lectura |
| `/api/convertir-orden-compra/` | POST | FBV | `IsAuthenticated` | **Financiero** |
| `/api/ordenes-compra/<id>/export/pdf/` | GET | FBV | `@login_required` | Lectura |

### B.10 Endpoints del Tenant — Otros

| URL | Método | Vista | Permiso | Riesgo |
|-----|--------|-------|---------|--------|
| `/api/alertas/` | CRUD | `AlertaViewSet` | `IsAuthenticated` | Escritura |
| `/api/notificaciones/` | CRUD | `NotificacionViewSet` | `IsAuthenticated` | Escritura |
| `/api/notas/` | CRUD | `NotaViewSet` | `IsAuthenticated` | Escritura |
| `/api/promos/promociones/` | CRUD | `PromocionViewSet` | `IsAuthenticated` | **Financiero** — descuentos |
| `/api/informes/stock-bajo/` | GET | `StockBajoView` | `IsAuthenticated` | Lectura |
| `/api/informes/stock-bajo/pdf/` | GET | `StockBajoPDFView` | `IsAuthenticated` | Lectura/Export |
| `/api/reservas/` | CRUD | `ReservaStockViewSet` | `IsAuthenticated` | Escritura stock |
| `/api/locks/` | CRUD | `FormLockViewSet` | `IsAuthenticated` | Control concurrencia |
| `/admin/` | ALL | Django Admin | `is_staff` | **Total** — admin Django |

---

## C. Inventario de la Capa de Autorización Actual

### C.1 Mecanismos de autorización existentes en backend

| Mecanismo | Detalle | Ubicación | Alcance |
|-----------|---------|-----------|---------|
| `DEFAULT_PERMISSION_CLASSES = [IsAuthenticated]` | Todo endpoint DRF requiere sesión activa | [base.py#L123](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/base.py#L123) | **Global** |
| `EsAdminTenant` | Chequea `tipo_usuario == "admin"` | [permissions.py#L4-L13](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/permissions.py#L4-L13) | **1 solo lugar** (`ActualizacionListaDePreciosViewSet.destroy`) |
| `SuscripcionMiddleware` | Bloquea requests si tenant suspendido/cancelado | [middlewares.py#L18-L51](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/utils/middlewares.py#L18-L51) | **Global** (middleware) |
| `CliUsuario.cuenta_activa` | Check inline en login_view | [login/views.py#L39-L47](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L39-L47) | Solo en login |
| `AllowAny` | Endpoints sin autenticación | 6 endpoints explícitos | Puntual |
| `@login_required` | Django decorator (no DRF) | 1 uso: `orden_compra_export_views.py:19` | Puntual |
| `@csrf_exempt` | Exención CSRF para bridge | [login/views.py#L109](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L109) | Puntual |

### C.2 Endpoints/FBVs sin protección DRF explícita

Los siguientes function-based views del tenant **no tienen decorador `@api_view` ni `@permission_classes`**, por lo que **no pasan por el framework de permisos de DRF**:

| Vista | Archivo:Línea | Riesgo |
|-------|---------------|--------|
| `register` | [usuarios/views.py#L13](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/usuarios/views.py#L13) | ⚠️ **CRÍTICO**: Cualquiera puede crear usuarios sin autenticación |
| `login_view` | [login/views.py#L28](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L28) | Esperado (es login) |
| `logout_view` | [login/views.py#L76](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L76) | Esperado (es logout) |
| `login_bridge_view` | [login/views.py#L109](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L109) | Medio (csrf_exempt, pero valida token) |
| `user_view` | [login/views.py#L93](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L93) | Check inline is_authenticated |
| `password_reset_request_view` | [login/views.py#L169](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L169) | Esperado |

> [!CAUTION]
> **`/api/usuarios/register/`** es una FBV Django pura (no DRF) montada en la URLConf del tenant, sin `@login_required`, sin `@api_view`, sin ningún decorador de permiso. Un usuario anónimo que conozca la URL del subdominio de un tenant puede crear usuarios dentro de ese tenant.

### C.3 Permisos en el frontend

**No hay chequeos de permisos en el frontend.** Hallazgos:

1. **Routing**: `RutaPrivada` solo verifica `isAuthenticated` y `setupCompleto`. No hay rutas condicionadas por `tipo_usuario` o permisos.
2. **Navbar**: Todos los ítems de navegación se muestran a todos los usuarios autenticados. No hay condicionales de tipo `if user.tipo_usuario === 'admin'`.
3. **Componentes**: Ningún componente revisado condiciona su renderizado según rol o permiso.
4. **API service**: El response de `/api/user/` incluye `tipo_usuario` y `es_admin_tenant`, pero estos valores no se usan en ninguna lógica de UI.

### C.4 Inconsistencias frontend-backend

| Área | Frontend | Backend | Inconsistencia |
|------|----------|---------|----------------|
| Creación de usuarios | No hay UI para crear sub-usuarios | Endpoint `/api/usuarios/register/` existe y acepta POST anónimo | Backend expone funcionalidad sin UI y sin protección |
| Tipo usuario | Se recibe `tipo_usuario` y `es_admin_tenant` en respuesta de login | Nunca se usan para condicionar UI | Dato sin propósito en frontend |
| Eliminar presupuestos | Botón visible para todos | Backend acepta de cualquier autenticado | Sin restricción |
| Anular recibos/CC | Botón visible para todos | Backend acepta de cualquier autenticado | Sin restricción (debería ser solo admin/tesorero) |

---

## D. Acciones y Datos Sensibles

### D.1 Operaciones que modifican dinero, stock, comprobantes, fiscalidad

| Operación | Endpoints | Modelos afectados | Nivel de riesgo |
|-----------|-----------|-------------------|-----------------|
| **Crear/modificar producto con precios** | `crear-producto-con-relaciones`, `editar-producto-con-relaciones` | `Producto`, `StockProve`, `PrecioProveedorExcel` | Alto |
| **Modificar stock manualmente** | `stock/` CRUD, acciones custom | `Producto` (stock fields) | Alto |
| **Actualizar listas de precios** | `upload-price-list`, `listas-precio/`, `precios-lista/` | `ListaPrecios`, `PrecioProductoLista`, `ActualizacionListaDePrecios` | Alto |
| **Crear venta/factura** | `convertir-presupuesto/`, `ventas/` CRUD | `Venta`, `VentaDetalleItem`, `Comprobante` | **Crítico** — impacta stock + dinero |
| **Convertir a factura fiscal (ARCA)** | `convertir-factura-interna/` | `Comprobante`, `VentaIVAAlicuota` + envío a AFIP/ARCA | **Crítico** — irreversible, genera CAE |
| **Postventa: devoluciones y cambios** | `postventa/devoluciones/confirmar/`, `postventa/cambios/confirmar/` | `Venta`, NC, ND, stock reversal | **Crítico** — altera contabilidad y stock |
| **Abrir/cerrar sesión de caja** | `caja/sesiones/` + acciones | `SesionCaja` | Alto |
| **Movimientos de caja** | `caja/movimientos/` | `MovimientoCaja` | Alto |
| **Registrar pagos** | `caja/pagos/` | `PagoVenta` | Alto |
| **Cheques** | `caja/cheques/` | `Cheque` | Alto |
| **Crear recibo de CC** | `cuenta-corriente/crear-recibo/` | `Recibo`, `Imputacion` | Alto |
| **Anular recibo** | `cuenta-corriente/anular-recibo/` | `Recibo`, `Imputacion` | **Destructivo** |
| **Crear orden de pago (proveedor)** | `cuenta-corriente/crear-orden-pago/` | `OrdenPago` | Alto |
| **Anular orden de pago** | `cuenta-corriente/anular-orden-pago/<id>/` | `OrdenPago` | **Destructivo** |
| **Eliminar imputación** | `cuenta-corriente/imputacion/<id>/eliminar/` | `Imputacion` | **Destructivo** |
| **Eliminar presupuestos antiguos** | `presupuestos/eliminar-antiguos/` | `Venta` | **Destructivo** |
| **Registrar compra** | `compras/compras/` | `Compra`, `CompraDetalleItem` | Alto — afecta stock y CC proveedor |
| **Crear/modificar cliente** | `clientes/clientes/` | `Cliente` | Medio |
| **Crear/modificar proveedor** | `proveedores/` | `Proveedor` | Medio |
| **Promociones** | `promos/promociones/` | `Promocion` | **Financiero** — altera precios de venta |
| **Configuración de ferretería** | `ferreteria/` PUT | `Ferreteria` | **Configuración** — datos fiscales del negocio |

### D.2 Datos y registros especiales del sistema

| Registro | Cómo se crea | Protección actual | Riesgo si se modifica |
|----------|--------------|--------------------|-----------------------|
| **Ferreteria (singleton por tenant)** | `inicializar_datos_tenant()` en [servicio_inicializacion_tenant.py#L14-L21](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/tenants/services/servicio_inicializacion_tenant.py#L14) | Ninguna. Editable vía API por cualquier usuario autenticado. | **Crítico** — contiene datos fiscales (CUIT, razón social, etc.) |
| **Sucursal Principal** | `inicializar_datos_tenant()` L23-L30 | Ninguna explícita | Alto — `es_principal=True` |
| **Usuario admin del tenant** | `inicializar_datos_tenant()` L32-L39 | Ninguna | **Crítico** — puede modificarse o eliminarse |
| **AlicuotaIVA** | Posiblemente por migración/setup | CRUD abierto | **Fiscal** — altera cálculos de IVA |
| **Comprobantes con CAE** | Generados vía ARCA | No hay protección contra DELETE en ViewSet | **Fiscal/Legal** — documentos electrónicos de AFIP |
| **Cliente "Consumidor Final"** | Probablemente creado en setup | No hay protección contra edición/borrado | **Fiscal** — requerido para ventas CF |
| **Métodos de pago** | Setup o manual | CRUD abierto | **Configuración** |

### D.3 Auditoría — Estado actual

| Modelo de auditoría | Ubicación | ¿Se usa activamente? |
|----|----------|---------------------|
| `Auditoria` (modelo genérico) | [usuarios/models.py#L45-L58](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/usuarios/models.py#L45-L58) | **NO** — Existe el modelo pero no se encontró ningún código que lo instancie |
| `ActualizacionListaDePrecios` | `productos/` (model + ViewSet) | **SÍ** — Se registra cuando se actualizan listas de precios |
| `Cheque.usuario_registro` | [caja/models.py#L844](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/caja/models.py) | **SÍ** — FK al usuario que registra cheques |
| `SesionCaja` | caja/ | **SÍ** — Registra quien abre/cierra caja |
| `HistorialImportacionProveedor` | productos/ | **SÍ** — Rastrea importaciones de listas |

> [!WARNING]
> **La gran mayoría de las operaciones financieras, fiscales y destructivas NO registran qué usuario las realizó.** Los modelos de `Venta`, `Compra`, `Recibo`, `OrdenPago`, `MovimientoCaja`, `Imputacion`, `Producto`, `Cliente`, `Proveedor` no tienen campo `usuario` ni FK al usuario que creó/modificó el registro. Esto es un gap crítico tanto para auditoría como para el futuro sistema de permisos.

---

## E. Restricciones Técnicas para el Diseño

### E.1 Dependencias del modelo de usuario

| Componente | Dependencia | Referencia |
|-----------|-------------|------------|
| `AUTH_USER_MODEL` | `"usuarios.Usuario"` | [base.py#L114](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/base.py#L114) |
| `Ferreteria` FK | `Usuario.ferreteria` → `productos.Ferreteria` | [usuarios/models.py#L21-L27](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/usuarios/models.py#L21-L27) |
| `CliUsuario` OneToOne | `CliUsuario.user` → `AUTH_USER_MODEL` | [usuarios/models.py#L33](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/usuarios/models.py#L33) |
| `Auditoria` FK | `Auditoria.usuario` → `AUTH_USER_MODEL` | [usuarios/models.py#L46](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/usuarios/models.py#L46) |
| `Cheque.usuario_registro` FK | → `AUTH_USER_MODEL` | caja/models.py |
| `CuentaAccesoPublico` | Referencias a `username_tenant` (string, no FK) | [acceso_publico/models.py#L15](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/acceso_publico/models.py#L15) |
| Login views | `from ferreapps.usuarios.models import Usuario` directo | [login/views.py#L22](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py#L22) |
| Admin | `UserAdmin` para `Usuario` | usuarios/admin.py |
| Tests | `inicializar_datos_tenant()` crea Usuario con `tipo_usuario="admin"` | servicio_inicializacion_tenant.py |

### E.2 Sesiones, cookies, CSRF, rate limiting

| Aspecto | Mecanismo | Implicación para 2do nivel auth |
|---------|-----------|----------------------------------|
| **Sesión** | Django session framework, cookie-based, por-tenant (schema aislados) | Un segundo nivel (PIN/contraseña de empleado) puede montarse **encima** de la sesión existente sin cambiar la infra |
| **CSRF** | Middleware estándar + `/api/csrf/` endpoint + fetch polyfill en frontend | Transparent para sub-auth si se mantiene la sesión |
| **Rate limiting** | django-axes: 5 intentos, cooloff 1 hora | Se aplica al login principal. Se necesitaría configuración separada para login de sub-empleado |
| **Cookies** | `HttpOnly`, `Secure` en prod, `SameSite` default | Un sub-login no debería necesitar cookies adicionales si se almacena en la sesión Django |

### E.3 Estado de los tests

| Área | Tests encontrados | Qué asumen sobre auth |
|------|-------------------|------------------------|
| `tenants/tests/` | test_inicializacion_tenant, test_public_onboarding_api, test_servicio_constructor_tenant | Crean usuario con `tipo_usuario="admin"`, no testean otros roles |
| `acceso_publico/tests/` | test_login_publico_api, test_password_reset_publico_api, test_token_puente_service | Testean bridge flow completo, asumen un solo tipo de usuario |
| `ferredesk_backend/` | test_middlewares, test_prod_settings | Login como admin, chequean 403 por suscripción, no por permisos |
| `ventas/` | test_postventa_*, test_devoluciones_auditoria | Crean usuario único, asumen full access. Un test cambia `tipo_usuario` a `cli_user` para testear restricción de eliminar listas ([test_devoluciones_auditoria.py#L243-L246](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas)) |
| `productos/` | test_api_listas_precio, test_auditoria_listas | Crean usuario single, testean CRUD completo |
| `caja/` | test_cheques, test_control_fondos_service, test_historial_banco | Crean usuario admin |

**Adaptaciones necesarias**: Todos los tests crean un solo usuario "admin" y asumen acceso total. Agregar permisos requerirá actualizar los `setUp()` de cada test para crear usuarios con los permisos correctos, o usar un helper/factory.

### E.4 Código muerto, duplicado o legado

| Item | Ubicación | Estado |
|------|-----------|--------|
| `CliUsuario` modelo | [usuarios/models.py#L32-L43](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/usuarios/models.py#L32-L43) | **Semi-muerto**: solo se chequea en login_view, no se crea en ningún flujo activo excepto `register` |
| `register` view | [usuarios/views.py#L13](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/usuarios/views.py#L13) | **Legacy/peligroso**: FBV sin protección, crea CliUsuario, no se usa desde frontend |
| `Auditoria` modelo | [usuarios/models.py#L45-L58](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/usuarios/models.py#L45-L58) | **Muerto**: existe pero nunca se instancia |
| `tipo_usuario` opciones no usadas | `cli_admin`, `cli_user`, `prueba`, `auditor` | Solo existen como opciones pero no determinan acceso |
| `settings.py` duplicado | [settings/settings.py](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferredesk_backend/settings/settings.py) | Duplicado de `__init__.py`, sin el caso `prod_local` |
| `legacy/` | `backend/legacy/` | Scripts de backup de pg_dump, no código activo |
| `ferreapps/sistema/` | urls.py vacío, views vacías | App placeholder sin funcionalidad |

---

## F. Propuesta

### F.1 Tres Alternativas de Diseño

#### Alternativa A: Permisos por "perfil de acceso" con bitfield/JSON

**Concepto**: Crear un modelo `PerfilAcceso` (o `Rol`) con un campo JSON/bitfield que enumere las acciones permitidas. Cada `Usuario` tenant se vincula a un perfil. Un middleware/mixin DRF centralizado chequea permisos.

```python
class PerfilAcceso(Model):
    nombre = CharField(max_length=100)  # "Cajero", "Vendedor", "Dueño"
    permisos = JSONField(default=dict)  # {"ventas.crear": true, "stock.modificar": false, ...}
    es_predefinido = BooleanField(default=False)

class Usuario(AbstractUser):
    perfil_acceso = ForeignKey(PerfilAcceso, null=True, on_delete=SET_NULL)
```

| Pro | Contra |
|-----|--------|
| Simple de entender y de mantener | JSON sin validación de schema a nivel DB |
| Flexible: se agregan permisos sin migraciones | No hay enforcement a nivel DB |
| Los perfiles se crean por UI del dueño | Requiere catálogo hardcodeado de permisos válidos |
| Costo de migración bajo | Sin soporte nativo de Django `has_perm()` |

**Costo de migración**: Bajo. 1 modelo nuevo, 1 FK nueva en Usuario, 1 mixin DRF, migrar datos existentes (todos los admin actuales → perfil "Dueño").

#### Alternativa B: Django `auth.Permission` + Groups nativos

**Concepto**: Usar el sistema de permisos nativo de Django (`auth_permission`, `auth_group`, `user_groups`, `user_permissions`). Definir permisos custom en cada modelo `Meta.permissions`. Crear Groups como roles ("Cajero", "Vendedor"). Usar `DjangoModelPermissions` o un mixin custom.

```python
class Venta(Model):
    class Meta:
        permissions = [
            ("crear_venta", "Puede crear ventas"),
            ("facturar_arca", "Puede generar facturas electrónicas ARCA"),
            ("anular_venta", "Puede anular ventas"),
        ]
```

| Pro | Contra |
|-----|--------|
| Estándar Django, bien documentado | Permisos acoplados a modelos → verboso |
| `user.has_perm()` nativo | Necesita `content_type` → complica permisos de acciones (no CRUD) |
| DRF `DjangoModelPermissions` listo para usar | ~100 permisos → difícil de gestionar por UI |
| Admin Django tiene UI de asignación | Requiere más migraciones (permissions en Meta) |
| Compatible con Fase 2 (object-level) via `has_object_permission` | Los Groups de Django no soportan herencia de roles |

**Costo de migración**: Medio. Agregar `Meta.permissions` en cada modelo, crear Groups programáticamente, asignar permisos a cada group, crear views de gestión de grupos.

#### Alternativa C: Modelo híbrido — Permisos de sección (JSON) + objeto-level custom

**Concepto** (recomendado): Crear un `PerfilAcceso` con permisos por sección/acción (similar a A), pero usar un catálogo de permisos definido como constantes Python (no free-form JSON). Para Fase 2, agregar `has_object_permission()` evaluando reglas puntuales del perfil.

```python
# permisos/catalogo.py
PERMISOS = {
    "ventas": {
        "ver": "Puede ver presupuestos y ventas",
        "crear": "Puede crear presupuestos",
        "facturar": "Puede generar facturas (ARCA)",
        "anular": "Puede anular ventas",
        "postventa": "Puede realizar devoluciones y cambios",
    },
    "stock": {
        "ver": "Puede ver productos y stock",
        "modificar": "Puede modificar productos y stock",
        "precios": "Puede modificar precios y listas",
    },
    "caja": {
        "ver": "Puede ver caja",
        "operar": "Puede abrir/cerrar caja y registrar movimientos",
        "cheques": "Puede gestionar cheques",
    },
    # ... etc
}

class PerfilAcceso(Model):
    nombre = CharField(max_length=100)
    permisos = JSONField(default=dict, validators=[ValidarPermisosCatalogo])
    es_propietario = BooleanField(default=False)  # bypass: acceso total
    puede_gestionar_usuarios = BooleanField(default=False)

class Usuario(AbstractUser):
    perfil_acceso = ForeignKey(PerfilAcceso, null=True, on_delete=PROTECT)
    pin = CharField(max_length=128, blank=True)  # hash para sub-login

# Mixin DRF centralizado
class RequierePermiso(BasePermission):
    permiso_requerido = None  # "ventas.crear"
    def has_permission(self, request, view):
        perfil = request.user.perfil_acceso
        if perfil and perfil.es_propietario:
            return True
        return perfil and perfil.permisos.get(self.permiso_requerido, False)
```

| Pro | Contra |
|-----|--------|
| Catálogo centralizado validado | Requiere mantener catálogo + validador |
| Perfiles manejables por UI (~20-30 toggles) | No es estándar Django (pero es más ergonómico) |
| `es_propietario` como bypass simple | |
| Extensible a Fase 2 con reglas object-level | |
| Migración sencilla (1 modelo, 1 FK) | |
| Sub-login por PIN factible (campo en Usuario) | |

**Costo de migración**: Bajo-medio. Similiar a A pero con validación y catálogo.

### F.2 Recomendación Justificada

**Recomiendo la Alternativa C (híbrida)** por las siguientes razones derivadas de los hallazgos:

1. **El sistema hoy no tiene ningún permiso granular** (Sección C.1) → necesitamos algo que se pueda introducir gradualmente sin romper lo existente.
2. **Hay ~100+ endpoints pero solo ~15-20 categorías lógicas de acceso** (ventas, stock, caja, CC, etc.) → un modelo por sección es más manejable que uno por endpoint.
3. **El modelo `tipo_usuario` ya existe con opciones no funcionales** → la migración puede reutilizar la columna o deprecarla gradualmente.
4. **No hay auditoría activa** (Sección D.3) → el nuevo sistema debe incluir logging de quién hizo qué, y el mixin centralizado es el lugar natural para agregar `request.user` a los registros.
5. **Los tests asumen acceso total** (Sección E.3) → un diseño con `es_propietario = True` como bypass permite que los tests existentes sigan pasando con cambios mínimos (crear perfil propietario en setUp).
6. **Django `auth.Permission` es demasiado granular** para que el dueño de una ferretería lo configure desde una UI → no es ergonómico.
7. **El sub-login por PIN** se resuelve agregando un campo `pin` hasheado al Usuario y un endpoint de "switch user" que no destruye la sesión del tenant.

### F.3 Plan de Implementación por Fases

#### Fase 0: Correcciones urgentes de seguridad (1-2 días)
**Riesgo: CRÍTICO — hacer primero**

| Acción | Archivo | Cambio |
|--------|---------|--------|
| Proteger endpoint `register` | [usuarios/views.py](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/usuarios/views.py) | Agregar `@login_required` o eliminar la ruta (no se usa desde frontend) |
| Proteger `password_reset_request_view` | [login/views.py](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/login/views.py) | Ya chequea tenant, pero debería tener `AllowAny` explícito o rate limiting |
| Limpiar código muerto | [usuarios/views.py](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/usuarios/views.py), [usuarios/urls.py](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/usuarios/urls.py) | Eliminar `register` y `CliUsuario` si no se usan |

#### Fase 1: Modelo de permisos y enforcement centralizado (1-2 semanas)

| Paso | Archivos a tocar |
|------|-----------------|
| 1. Crear catálogo de permisos (`permisos/catalogo.py`) | Nuevo archivo |
| 2. Crear modelo `PerfilAcceso` con validador | `ferreapps/usuarios/models.py` |
| 3. Agregar FK `perfil_acceso` a `Usuario` | `ferreapps/usuarios/models.py` + migración |
| 4. Crear `RequierePermiso` permission class | `ferredesk_backend/permissions.py` |
| 5. Migración de datos: crear perfil "Propietario" y asignarlo a usuarios admin existentes | Management command |
| 6. Aplicar `RequierePermiso` a ViewSets y FBVs de alto riesgo | Todos los `views.py` de apps (gradual) |
| 7. API de gestión de perfiles y sub-usuarios | Nuevos endpoints en `ferreapps/usuarios/` |
| 8. Frontend: pantalla de gestión de empleados | Nuevo componente |
| 9. Frontend: condicionar navbar y rutas según permisos | `Navbar.js`, `RutaPrivada.js`, `App.js` |
| 10. Actualizar tests | Todos los archivos `test_*.py` |

#### Fase 2: Sub-login por PIN y permisos object-level (1-2 semanas)

| Paso | Archivos a tocar |
|------|-----------------|
| 1. Agregar campo `pin` (hashed) a `Usuario` | `ferreapps/usuarios/models.py` + migración |
| 2. Endpoint de "switch user" por PIN (no destruye sesión tenant) | `ferreapps/login/views.py` |
| 3. Frontend: modal de PIN para cambio de operador | Nuevo componente |
| 4. Reglas object-level (ej: no modificar cliente-negocio) | `ferredesk_backend/permissions.py` → `has_object_permission()` |
| 5. Markers en registros protegidos (ej: `es_registro_sistema = True` en Cliente del negocio) | Modelos que lo necesiten |

#### Fase 3: Auditoría universal (1 semana)

| Paso | Archivos a tocar |
|------|-----------------|
| 1. Mixin `AuditMixin` que grabe `usuario_creacion`, `usuario_modificacion` | Nuevo mixin |
| 2. Aplicar a modelos clave: Venta, Compra, Recibo, OrdenPago, MovimientoCaja, Producto | Modelos + migraciones |
| 3. Activar el modelo `Auditoria` existente para acciones destructivas | `ferreapps/usuarios/models.py` ya existe |

### F.4 Mecanismo de verificación automática de cobertura

Para garantizar que ningún endpoint quede sin política:

```python
# management/commands/verificar_permisos.py
from django.core.management.base import BaseCommand
from django.urls import URLResolver, URLPattern
from rest_framework.permissions import IsAuthenticated, AllowAny

class Command(BaseCommand):
    def handle(self, **options):
        from ferredesk_backend.urls import urlpatterns
        for pattern in urlpatterns:
            view = pattern.callback
            if hasattr(view, 'cls'):  # CBV
                perms = getattr(view.cls, 'permission_classes', [])
            elif hasattr(view, 'initkwargs'):
                perms = view.initkwargs.get('permission_classes', [])
            else:
                self.stderr.write(f"⚠️  SIN PERMISOS DRF: {pattern.pattern}")
                continue
            if perms == [IsAuthenticated]:
                self.stderr.write(f"⚠️  Solo IsAuthenticated: {pattern.pattern}")
```

Además:
- **Test automatizado** que recorra `urlpatterns` y verifique que toda vista DRF tenga una permission class de `RequierePermiso` (no solo `IsAuthenticated`).
- **CI check**: agregar el management command al pipeline de CI para que falle si se agrega un endpoint sin permiso específico.

### F.5 Riesgos, Casos Borde y Preguntas Abiertas

#### Riesgos

1. **Migración de usuarios existentes**: Los usuarios `admin` actuales deben recibir el perfil "Propietario" automáticamente. Los tipos `cli_user`, `cli_admin`, etc. no se usan en producción, pero hay que verificar si hay datos reales con esos tipos.
2. **Endpoints FBV sin DRF**: Hay FBVs Django puras (como `register`, `login_view`) que no pasan por el pipeline de permisos DRF. Hay que convertirlas a APIViews o agregar decoradores.
3. **Operaciones ARCA irreversibles**: Las facturas electrónicas con CAE no se pueden anular en ARCA. El permiso de "facturar" debe ser el más restrictivo.
4. **Concurrencia de sub-login**: Si dos empleados usan la misma sesión de browser (mismo dispositivo de POS), el switch por PIN debe manejar correctamente la sesión compartida.
5. **`CliUsuario` y `register` endpoint**: Hay un modelo y endpoint legado que permiten crear usuarios sin autenticación. Debe eliminarse o protegerse antes de cualquier otra cosa.

#### Casos borde

- ¿Qué pasa si se elimina el último usuario con perfil "Propietario"? → Debe impedirse programáticamente.
- ¿Puede un empleado modificar su propio perfil de permisos? → No, solo el propietario.
- ¿Qué pasa con la `CuentaAccesoPublico` cuando se agregan sub-empleados? → Solo el admin del tenant tiene cuenta pública; los sub-empleados no la necesitan porque acceden solo por subdominio.
- ¿El PIN del empleado es por tenant o global? → Por tenant (vive en el schema del tenant).

#### Preguntas que requieren decisión del negocio

1. **¿Cuántos perfiles predefinidos quieren?** Sugerencia: "Propietario" (todo), "Cajero" (caja + ventas), "Vendedor" (ventas + presupuestos), "Consulta" (solo lectura). ¿Quieren que el dueño pueda crear perfiles custom?
2. **¿El sub-login por PIN es obligatorio o configurable?** ¿El dueño puede decidir no usarlo?
3. **¿Qué pasa con los datos de `tipo_usuario` existentes?** ¿Hay tenants en producción con usuarios `cli_user`/`cli_admin`? Si sí, ¿qué perfil les asignamos?
4. **¿La auditoría debe registrar solo acciones destructivas o todas las escrituras?**
5. **¿Quieren un log de accesos (quién se logueó cuándo) además de auditoría de acciones?**
6. **¿El "cliente que representa al negocio" (Fase 2, permiso fino) es un concepto existente en los datos o hay que crearlo?**
7. **¿Los permisos finos de Fase 2 son por registro específico o por tipo/categoría?** (Ej: "no puede modificar clientes con CUIT del negocio" vs "no puede modificar el cliente ID 1")
