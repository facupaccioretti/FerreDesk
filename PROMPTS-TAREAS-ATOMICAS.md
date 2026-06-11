# FerreDesk V1 SaaS Multi-Tenant — Plan de Inicialización Completo

## Estado de la inicialización

Se han generado los siguientes archivos en el repositorio:

| Archivo | Propósito |
|---------|-----------|
| AGENTS.md | Memoria de largo plazo para todos los agentes. Contexto, reglas, estructura, restricciones. |
| ferredesk-progress.json | Tracker JSON con 48 tareas atómicas en 10 fases. Cada sesión actualiza `done` + `evidencia`. |
| PROMPTS-TAREAS-ATOMICAS.md | Este archivo. Prompts pre-armados para copiar y pegar en cada sesión de agente. |

---

## Resumen de tareas por fase

| Fase | Nombre | Tareas | Modelo recomendado |
|------|--------|--------|--------------------|
| 1 | Preparación y compatibilidad base | 3 | Grande |
| 2 | Núcleo multi-tenant | 7 | Grande |
| 3 | App tenants + modelos public | 9 | Grande |
| 4 | Inicialización de tenant | 4 | Grande |
| 5 | Setup obligatorio y gating | 6 | Grande |
| 6 | Media y archivos aislados | 5 | Grande |
| 7 | Backup por tenant | 3 | Grande |
| 8 | Frontend SaaS | 7 | Mixto (backend grande, componentes UI chico) |
| 9 | Staging y local | 4 | Grande |
| 10 | Verificación integral | 9 | Grande |
| **Total** | | **48** | |

---

## Workflow de ejecución por sesión

Cada sesión de agente (Codex/Antigravity) recibe:

1. **AGENTS.md** — siempre en contexto vía archivo en repo
2. **Estado actual de ferredesk-progress.json** — adjuntar como referencia
3. **El prompt de tarea** — copiar del bloque correspondiente abajo
4. **Instrucción de cierre:** "Al terminar, commitea con mensaje descriptivo `Fase X: descripción` y actualiza el campo `done` y `evidencia` de esta tarea en `ferredesk-progress.json`"

> **IMPORTANTE**: Vos en el medio: antes de pasar a la siguiente tarea, revisás el commit y el output de evidencia. Esto es especialmente crítico en fases 2, 3, 4 y 5.

---

## Prompts atómicos por tarea

### Fase 1 — Preparación y compatibilidad base

---

#### F1-T1: Campos opcionales en Ferreteria

```
## Contexto
Estás en Fase 1 del plan de migración SaaS de FerreDesk.
Archivo: ferredesk_v0/backend/ferreapps/productos/models.py
El modelo Ferreteria tiene campos `direccion` y `telefono` que son 
obligatorios (no tienen blank=True). Esto impide la creación programática 
de Ferreteria con placeholders mínimos durante el onboarding SaaS.

## Tarea
Modificar el modelo Ferreteria:
- `direccion`: agregar `blank=True` (mantener max_length=200)
- `telefono`: agregar `blank=True` (mantener max_length=20)
- NO agregar null=True (son CharField, el default vacío de Django es "")
- NO modificar ningún otro campo del modelo

## Restricciones
- Solo modificar ferreapps/productos/models.py
- No tocar otros modelos del archivo
- No renombrar campos existentes
- No cambiar la lógica de save() ni de _normalizar_logo_empresa()

## Criterio de aceptación
- `python manage.py check` pasa sin errores
- Mostrar el output de check
```

---

#### F1-T2: Crear modelo Sucursal

```
## Contexto
Estás en Fase 1 del plan de migración SaaS de FerreDesk.
Archivo: ferredesk_v0/backend/ferreapps/productos/models.py
Se necesita crear el modelo Sucursal como preparación para futura 
multi-sucursal. En V1, cada tenant tendrá exactamente una sucursal default.
El modelo Ferreteria ya existe en este archivo.

## Tarea
Agregar el modelo Sucursal al final del archivo (antes de los comentarios 
de listas de precios o al final):
- FK a Ferreteria (on_delete=CASCADE, related_name='sucursales')
- nombre: CharField(max_length=100)
- direccion: CharField(max_length=200, blank=True)
- telefono: CharField(max_length=20, blank=True)
- es_principal: BooleanField(default=True)
- activa: BooleanField(default=True)
- fecha_creacion: DateTimeField(auto_now_add=True)
- __str__: retornar self.nombre
- Meta: verbose_name='Sucursal', verbose_name_plural='Sucursales'

## Restricciones
- Solo agregar el modelo Sucursal, no modificar modelos existentes
- No crear relaciones de Sucursal con Stock, Ventas, Caja, etc. (eso es post-V1)
- No crear migraciones aún (eso es F1-T3)

## Criterio de aceptación
- El archivo importa sin errores de sintaxis
- `python manage.py check` pasa sin errores
```

---

#### F1-T3: Migración de Fase 1

```
## Contexto
Estás en Fase 1 del plan de migración SaaS de FerreDesk.
Las tareas F1-T1 (campos opcionales) y F1-T2 (modelo Sucursal) ya están 
completadas en ferreapps/productos/models.py.

## Tarea
- Ejecutar: python manage.py makemigrations productos
- Ejecutar: python manage.py migrate
- Capturar y mostrar output completo de ambos comandos

## Restricciones
- No modificar código fuente
- Solo ejecutar comandos de migración
- Usar settings de dev

## Criterio de aceptación
- makemigrations genera migración correcta con los cambios de Fase 1
- migrate aplica sin errores
- Mostrar output de ambos comandos
```

---

### Fase 2 — Núcleo multi-tenant

---

#### F2-T1: Agregar django-tenants a requirements

```
## Contexto
Estás en Fase 2 del plan de migración SaaS de FerreDesk.
Archivo: ferredesk_v0/backend/requirements.txt
Django actual: 5.0.1. psycopg2-binary: 2.9.9.

## Tarea
- Agregar `django-tenants` al requirements.txt
- Verificar que la versión sea compatible con Django 5.0.1

## Restricciones
- Solo modificar requirements.txt
- No instalar aún (el usuario lo hará)
- No cambiar versiones de paquetes existentes

## Criterio de aceptación
- requirements.txt incluye django-tenants con versión compatible
```

---

#### F2-T2: Configurar settings/base.py para multi-tenant

```
## Contexto
Estás en Fase 2 del plan de migración SaaS de FerreDesk.
Archivo: ferredesk_v0/backend/ferredesk_backend/settings/base.py
La Fase 1 (preparación) ya está completa.
La app tenants aún no existe como archivos pero debe declararse en SHARED_APPS.

## Tarea
Configurar django-tenants en settings/base.py:
- Definir SHARED_APPS (solo apps de plataforma):
  django_tenants, admin, auth, contenttypes, sessions, messages, 
  staticfiles, tenants, rest_framework, django_filters, django_extensions, 
  corsheaders
- Definir TENANT_APPS (apps del ERP):
  django.contrib.contenttypes (requerido por django-tenants en ambas listas),
  ferreapps.usuarios, ferreapps.productos, ferreapps.proveedores,
  ferreapps.login, ferreapps.clientes, ferreapps.ventas, ferreapps.reservas,
  ferreapps.notas, ferreapps.alertas, ferreapps.informes, ferreapps.compras,
  ferreapps.cuenta_corriente, ferreapps.caja, ferreapps.sistema
- Reconstruir INSTALLED_APPS = list(SHARED_APPS) + [app for app in TENANT_APPS if app not in SHARED_APPS]
- Agregar TENANT_MODEL = "tenants.EmpresaTenant"
- Agregar TENANT_DOMAIN_MODEL = "tenants.Dominio"
- Agregar PUBLIC_SCHEMA_URLCONF = "ferredesk_backend.urls_public"
- TenantMainMiddleware debe ser el PRIMER middleware
- Mantener AUTH_USER_MODEL = "usuarios.Usuario"

## Restricciones
- NO modificar nada fuera de settings/base.py en esta tarea
- NO agregar JWT ni tocar autenticación
- contenttypes DEBE ir en SHARED_APPS Y en TENANT_APPS (requisito django-tenants)
- No cambiar REST_FRAMEWORK config ni constantes existentes

## Criterio de aceptación
El servidor arranca sin errores. Muestra el output de
`python manage.py check` al terminar.
```

---

#### F2-T3: Configurar dev.py para django-tenants

```
## Contexto
Estás en Fase 2. Archivo: ferredesk_v0/backend/ferredesk_backend/settings/dev.py
base.py ya está configurada con django-tenants.

## Tarea
- Cambiar ENGINE de DATABASES a 'django_tenants.postgresql_backend'
- Agregar DATABASE_ROUTERS = ['django_tenants.routers.TenantSyncRouter']
- Ampliar ALLOWED_HOSTS para subdominios locales: 
  ["localhost", "127.0.0.1", ".localhost", ".lvh.me"]
- Agregar SESSION_COOKIE_DOMAIN = ".localhost"
- Ajustar CSRF_TRUSTED_ORIGINS para incluir subdominios:
  agregar "http://*.localhost:3000", "http://*.localhost:8000"
- Ajustar CORS_ALLOWED_ORIGINS para subdominios locales

## Restricciones
- Solo modificar dev.py
- No tocar paths de TEMPLATES, STATIC, FRONTEND_BUILD_DIR
- No cambiar DB name/user/password

## Criterio de aceptación
python manage.py check pasa. Mostrar output.
```

---

#### F2-T4: Configurar prod.py para django-tenants

```
## Contexto
Estás en Fase 2. Archivo: ferredesk_v0/backend/ferredesk_backend/settings/prod.py
PROBLEMA ACTUAL: ALLOWED_HOSTS = ["*"] — esto viola las decisiones V1.

## Tarea
- Forzar ENGINE 'django_tenants.postgresql_backend' en DATABASES
- Agregar DATABASE_ROUTERS = ['django_tenants.routers.TenantSyncRouter']
- Cambiar ALLOWED_HOSTS a variable de entorno:
  ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "").split(",")
- Agregar SESSION_COOKIE_DOMAIN = os.environ.get("SESSION_COOKIE_DOMAIN", None)
- CSRF_TRUSTED_ORIGINS desde variable de entorno
- CORS configurado para subdominios del dominio principal

## Restricciones
- Solo modificar prod.py
- No dejar ALLOWED_HOSTS = ["*"]
- No agregar JWT
- Mantener dj_database_url para DATABASE_URL

## Criterio de aceptación
El archivo no contiene ALLOWED_HOSTS = ["*"]. 
Configuración es parametrizable por variables de entorno.
```

---

#### F2-T5: Crear urls_public.py

```
## Contexto
Estás en Fase 2. Se necesita crear:
ferredesk_v0/backend/ferredesk_backend/urls_public.py
Este archivo contiene rutas del esquema public (plataforma SaaS).
PUBLIC_SCHEMA_URLCONF ya apunta aquí desde base.py.

## Tarea
Crear urls_public.py con:
- urlpatterns mínimo con:
  - admin/ (admin de Django para gestión de plataforma)
  - api/public/ (incluir tenants.urls cuando exista)
  - Landing pública mínima (puede ser placeholder TemplateView por ahora)
- No incluir rutas del ERP tenant
- Importar lo necesario

## Restricciones
- Solo crear este archivo nuevo
- No modificar urls.py del tenant
- No crear views complejas, solo la estructura

## Criterio de aceptación
Archivo existe y tiene estructura válida de urlpatterns de Django.
```

---

#### F2-T6: Ajustar urls.py para tenant

```
## Contexto
Estás en Fase 2. Archivo: ferredesk_v0/backend/ferredesk_backend/urls.py
Este archivo ahora es el ROOT_URLCONF del tenant (no del public).
Las rutas del ERP deben mantenerse exactamente como están.

## Tarea
- Verificar que todas las rutas API existentes se mantienen intactas
- Asegurar que el catch-all de React sigue al final
- NO poner rutas de public aquí (esas van en urls_public.py)
- Si es necesario, agregar un comentario indicando que este es el 
  URL conf del tenant

## Restricciones
- Minimizar cambios. Solo agregar comentarios si es necesario
- No eliminar ninguna ruta existente
- No mover rutas a urls_public.py

## Criterio de aceptación
Archivo funciona exactamente como antes para rutas del ERP.
python manage.py check pasa.
```

---

#### F2-T7: Verificación de arranque

```
## Contexto
Estás en Fase 2. Todos los cambios de configuración (F2-T1 a F2-T6) 
ya están aplicados.

## Tarea
- Instalar django-tenants: pip install django-tenants
- Ejecutar: python manage.py check
- Si hay errores, corregir y mostrar los errores + correcciones
- Verificar que el servidor arranca: python manage.py runserver (verificar 
  que arranca, luego detener)

## Restricciones
- No crear la app tenants aún (eso es Fase 3)
- No ejecutar migraciones aún (la app tenants no existe)

## Criterio de aceptación
- pip install exitoso
- python manage.py check sin errores
- Servidor arranca sin crash
- Mostrar output completo
```

---

### Fase 3 — App tenants y modelos public

---

#### F3-T1: Crear estructura de app tenants

```
## Contexto
Estás en Fase 3. Ruta: ferredesk_v0/backend/tenants/
La app tenants ya está declarada en SHARED_APPS en base.py.

## Tarea
Crear los siguientes archivos con contenido mínimo:
- __init__.py (vacío)
- apps.py (class TenantsConfig con name='tenants')
- models.py (solo imports por ahora, modelos en F3-T2/T3)
- admin.py (solo import)
- views.py (solo import)
- urls.py (urlpatterns vacío)
- services.py (docstring)
- validators.py (docstring)
- constants.py (docstring)

## Restricciones
- Solo crear archivos con estructura mínima
- No implementar lógica compleja aún
- La app debe ser importable sin errores

## Criterio de aceptación
python manage.py check pasa con la app tenants reconocida.
```

---

#### F3-T2 + F3-T3: Modelos EmpresaTenant y Dominio

```
## Contexto
Estás en Fase 3. Archivo: ferredesk_v0/backend/tenants/models.py
Se necesitan los modelos core de la plataforma SaaS.

## Tarea
Crear en models.py:

1. EmpresaTenant (hereda de TenantMixin):
   - schema_name (viene de TenantMixin)
   - nombre: CharField(max_length=200)
   - slug_subdominio: SlugField(max_length=63, unique=True)
   - email_admin: EmailField()
   - estado_suscripcion: CharField con choices:
     ('trial', 'Período de prueba'), ('activo', 'Activo'),
     ('suspendido', 'Suspendido'), ('cancelado', 'Cancelado')
     default='trial'
   - fecha_fin_prueba: DateTimeField(null=True, blank=True)
   - activo: BooleanField(default=True)
   - fecha_creacion: DateTimeField(auto_now_add=True)
   - auto_create_schema = True
   - Meta: verbose_name = 'Empresa', verbose_name_plural = 'Empresas'

2. Dominio (hereda de DomainMixin):
   - La relación a tenant viene de DomainMixin
   - Meta: verbose_name = 'Dominio', verbose_name_plural = 'Dominios'

Imports necesarios:
  from django_tenants.models import TenantMixin, DomainMixin

## Restricciones
- Campos de negocio en español
- No agregar billing ni pagos
- No agregar lógica de custom domains

## Criterio de aceptación
python manage.py check pasa. Modelos son válidos.
```

---

#### F3-T4: Blacklist de subdominios

```
## Contexto
Estás en Fase 3. Archivo: ferredesk_v0/backend/tenants/constants.py

## Tarea
Crear constante SUBDOMINIOS_RESERVADOS como frozenset con al menos 
estas categorías:
- Infraestructura: www, api, cdn, static, media, assets, mail, smtp, 
  imap, pop, ftp, ssh, vpn, dns, ns1, ns2, mx, proxy
- Autenticación: login, logout, auth, oauth, sso, register, signup, 
  signin, password, reset
- Entornos: staging, dev, test, demo, sandbox, beta, alpha, prod, 
  production, qa, uat, preview
- Correo: email, webmail, postmaster, abuse, noreply, mailer
- Soporte/corporativo: support, help, admin, dashboard, panel, billing, 
  pay, payment, blog, docs, documentation, status, about, terms, 
  privacy, legal, security, contact, careers, press, investor, 
  enterprise, partner
- Producto: app, desktop, mobile, download, update, store, marketplace, 
  connect, platform

Agregar también constantes:
- SLUG_MIN_LENGTH = 3
- SLUG_MAX_LENGTH = 63
- TRIAL_DIAS_DEFAULT = 14

## Restricciones
- Solo constantes, no lógica
- Un set grande es mejor que uno corto (más seguro)

## Criterio de aceptación
El archivo importa sin errores. frozenset contiene > 60 entradas.
```

---

#### F3-T5: Validadores de subdominio

```
## Contexto
Estás en Fase 3. Archivo: ferredesk_v0/backend/tenants/validators.py
constants.py ya tiene SUBDOMINIOS_RESERVADOS y constantes de longitud.

## Tarea
Crear funciones:
1. validar_slug_formato(slug) → raise ValidationError si:
   - < SLUG_MIN_LENGTH o > SLUG_MAX_LENGTH
   - Contiene caracteres no alfanuméricos (excepto guión)
   - Empieza o termina con guión
   - Contiene guiones consecutivos

2. validar_slug_no_reservado(slug) → raise ValidationError si:
   - slug está en SUBDOMINIOS_RESERVADOS

3. validar_slug_unico(slug) → raise ValidationError si:
   - Ya existe EmpresaTenant con ese slug_subdominio

4. validar_slug_completo(slug) → ejecuta las 3 validaciones anteriores

5. generar_slug_desde_nombre(nombre) → str:
   - Convertir a minúsculas, reemplazar espacios con guiones
   - Remover caracteres especiales
   - Truncar a SLUG_MAX_LENGTH
   - Si slug_sugerido está tomado, agregar número secuencial

## Restricciones
- Usar django.core.exceptions.ValidationError
- Mensajes de error en español

## Criterio de aceptación
Archivo importa sin errores. Funciones tienen docstrings.
```

---

#### F3-T6: Servicio de creación de tenant

```
## Contexto
Estás en Fase 3. Archivo: ferredesk_v0/backend/tenants/services.py
Modelos EmpresaTenant y Dominio ya existen. Validadores listos.

## Tarea
Crear clase o funciones de servicio:

1. crear_tenant(nombre, slug, email_admin) → EmpresaTenant:
   - Validar slug completo
   - Crear EmpresaTenant con auto_create_schema=True
   - Establecer fecha_fin_prueba = now + TRIAL_DIAS_DEFAULT
   - Crear Dominio con folder=slug + dominio base
   - Retornar tenant creado

2. inicializar_datos_tenant(tenant, email, password) → None:
   - Con connection.set_tenant(tenant):
     - Crear usuario admin (tipo_usuario='admin', sin is_staff/is_superuser)
     - Crear Ferreteria mínima (nombre=tenant.nombre, demás en blanco)
     - Crear Sucursal default (es_principal=True, nombre='Principal')
     - Asociar usuario.ferreteria = ferreteria

3. crear_tenant_completo(nombre, slug, email, password) → dict:
   - Orquesta crear_tenant + inicializar_datos_tenant
   - Retorna {tenant, dominio, usuario}

## Restricciones
- Usar transaction.atomic() donde sea necesario
- No crear views ni endpoints aquí (eso es Fase 8)
- Importar correctamente los modelos de ferreapps
- Manejar errores: si falla inicialización, limpiar tenant

## Criterio de aceptación
Archivo importa sin errores. Funciones tienen docstrings.
```

---

#### F3-T7: Admin de tenants

```
## Contexto
Fase 3. Archivo: ferredesk_v0/backend/tenants/admin.py

## Tarea
Registrar EmpresaTenant y Dominio en admin:
- EmpresaTenantAdmin: list_display con nombre, slug, estado, activo, fecha
- DominioAdmin: list_display con dominio, tenant, is_primary

## Criterio de aceptación
Admin de Django muestra los modelos correctamente.
```

---

#### F3-T8: Migraciones de Fase 3

```
## Contexto
Fase 3. App tenants lista con modelos. django-tenants configurado.
IMPORTANTE: La primera migración con django-tenants requiere pasos 
especiales. Se debe crear el tenant public primero.

## Tarea
1. python manage.py makemigrations tenants
2. python manage.py migrate_schemas --shared
3. Crear tenant public vía shell o script:
   from tenants.models import EmpresaTenant, Dominio
   tenant = EmpresaTenant(schema_name='public', nombre='FerreDesk Platform', 
     slug_subdominio='public', email_admin='admin@ferredesk.com')
   tenant.save()
   Dominio(domain='localhost', tenant=tenant, is_primary=True).save()
4. python manage.py migrate_schemas
5. Mostrar output completo de cada paso

## Restricciones
- Seguir el orden exacto
- El tenant public DEBE existir antes de migrate_schemas completo

## Criterio de aceptación
- Schemas public y tenant migrados correctamente
- Tenant public existe
- Mostrar output de cada comando
```

---

#### F3-T9: Verificar creación de tenant

```
## Contexto
Fase 3. Migraciones aplicadas. Tenant public existe.

## Tarea
Crear un tenant de prueba usando el servicio:
1. Desde django shell:
   from tenants.services import crear_tenant_completo
   resultado = crear_tenant_completo(
     nombre='Ferretería Test', slug='test', 
     email='admin@test.com', password='testpass123')
2. Verificar que:
   - El schema 'test' existe en PostgreSQL
   - EmpresaTenant tiene la fila
   - Dominio existe y resuelve
3. Mostrar output

## Criterio de aceptación
Tenant de prueba creado correctamente. Schema existe.
```

---

### Fases 4-10 — Tareas críticas

> Las fases 4 a 10 siguen el mismo patrón de prompts. Los detalles de cada tarea están en `ferredesk-progress.json`. Abajo los prompts de las tareas más críticas.

---

#### F4-T4: Verificar login en tenant nuevo (CRÍTICO)

```
## Contexto
Fase 4. Tenant de prueba creado. Admin existe. Ferreteria y Sucursal 
creadas automáticamente.

## Tarea
1. Acceder al subdominio del tenant de prueba
2. Intentar login con las credenciales del admin
3. Verificar que:
   - Login funciona correctamente
   - RutaPrivada no falla (no 500)
   - /api/ferreteria/ responde con datos de la Ferreteria
   - /api/user/ responde con datos del usuario
   - Existe exactamente 1 Ferreteria en el schema
   - Existe exactamente 1 Sucursal en el schema
4. Mostrar output/evidencia de cada verificación

## Criterio de aceptación
Login funciona. RutaPrivada no falla. APIs responden.
Exactamente 1 Ferreteria y 1 Sucursal.
```

---

#### F6-T1: upload_to dinámico (CRÍTICO — riesgo de fuga)

```
## Contexto
Fase 6. Archivo: ferreapps/productos/models.py
PROBLEMA: upload_to='arca/ferreteria_1/certificados/' está HARDCODEADO.
Esto causa fuga de archivos entre tenants.

## Tarea
1. Crear función upload_to dinámica para certificado_arca:
   def certificado_arca_path(instance, filename):
       from django.db import connection
       schema = connection.schema_name
       return f'arca/{schema}/certificados/{filename}'

2. Crear función similar para clave_privada_arca

3. Actualizar campos:
   certificado_arca = models.FileField(upload_to=certificado_arca_path, ...)
   clave_privada_arca = models.FileField(upload_to=clave_privada_arca_path, ...)

## Restricciones
- NO usar ferreteria_{instance.id} (puede repetirse entre schemas)
- USAR connection.schema_name (único por tenant)
- No modificar otros campos
- Generar migración

## Criterio de aceptación
- upload_to usa connection.schema_name
- No hay referencia a 'ferreteria_1' en el código
- Migración generada y aplicada
```

---

#### F7-T1: Backup por schema (CRÍTICO — riesgo de fuga)

```
## Contexto
Fase 7. Archivo: ferreapps/sistema/services/backup_service.py
PROBLEMA: pg_dump actual hace dump de TODA la base de datos.
Esto incluye datos de todos los tenants — violación de aislamiento.

## Tarea
Modificar _proceso_backup_interno:
1. Obtener el schema actual:
   from django.db import connection
   schema = connection.schema_name
2. Agregar flag --schema={schema} al comando pg_dump
3. Incluir schema en nombre de archivo: backup_{schema}_{timestamp}.dump
4. Si schema es 'public', decidir: solo public o rechazar
5. Asegurar que limpieza de backups antiguos respeta prefijo de schema

## Restricciones
- Solo modificar backup_service.py
- No modificar la lógica de threading
- Mantener compatibilidad con Docker y Windows

## Criterio de aceptación
pg_dump incluye --schema flag. Nombre de archivo identifica tenant.
Backup de tenant A no contiene datos de tenant B.
```

---

## Recomendación de ejecución

> **ORDEN ESTRICTO**: No empezar una fase sin completar la anterior. Especialmente fases 2→3→4 son secuenciales e interdependientes.

### Batch 1 (Fundamentos — modelo grande, supervisión alta)
1. **F1-T1** → **F1-T2** → **F1-T3** (pueden ser 1 sesión)
2. **F2-T1** → **F2-T2** → **F2-T3** → **F2-T4** → **F2-T5** → **F2-T6** → **F2-T7** (2-3 sesiones)
3. **F3-T1** → **F3-T2+T3** → **F3-T4** → **F3-T5** → **F3-T6** → **F3-T7** → **F3-T8** → **F3-T9** (3-4 sesiones)

### Batch 2 (Core funcional — modelo grande, supervisión alta)
4. **F4-T1** → **F4-T2** → **F4-T3** → **F4-T4** (1-2 sesiones)
5. **F5-T1** → **F5-T2** → **F5-T3** → **F5-T4** → **F5-T5** → **F5-T6** (2-3 sesiones)

### Batch 3 (Seguridad — modelo grande, supervisión media)
6. **F6-T1** → **F6-T2** → **F6-T3** → **F6-T4** → **F6-T5** (2 sesiones)
7. **F7-T1** → **F7-T2** → **F7-T3** (1 sesión)

### Batch 4 (Frontend — modelo mixto, supervisión media)
8. **F8-T1** → **F8-T2** (backend, modelo grande)
9. **F8-T3** → **F8-T4** → **F8-T5** → **F8-T6** → **F8-T7** (frontend, modelo chico si API definida)

### Batch 5 (Deploy y verificación — modelo grande, supervisión alta)
10. **F9-T1** → **F9-T2** → **F9-T3** → **F9-T4** (2 sesiones)
11. **F10-T1** a **F10-T9** (3-4 sesiones, una por grupo de checklist)
