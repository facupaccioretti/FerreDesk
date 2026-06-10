# Plan Técnico Detallado: Migración de FerreDesk a Arquitectura SaaS Multi-Tenancy

**Propósito de este documento:** Este archivo sirve como el "Blueprint" (Plano técnico exhaustivo) adaptado específicamente a la arquitectura real de FerreDesk. Tras un análisis profundo de `ferreapps.clientes` y `ferreapps.productos.models.Ferreteria`, se define el camino exacto para lograr la migración sin romper el código existente.

---

## 1. Análisis de la Arquitectura Existente
1. **La app `clientes` ya existe:** Contiene los clientes/compradores de la ferretería (`Cliente`, `Barrio`, `Provincia`). Es estrictamente una `TENANT_APP`.
2. **El modelo `Ferreteria` ya existe:** Vive en `productos.models` y contiene configuraciones críticas de AFIP, Logo, CUIT, etc.
3. **El modelo `Usuario` ya existe:** Vive en `usuarios.models` y tiene una `ForeignKey` a `productos.Ferreteria`.
4. **El Desafío:** En `django-tenants`, el modelo de Inquilino (Tenant) *debe* vivir en el esquema `public`. Sin embargo, `Ferreteria` y `Usuario` deben vivir en el esquema aislado de cada cliente para mantener la lógica existente de `request.user.ferreteria`.

**Justificación Técnica: ¿Por qué NO refactorizamos `Ferreteria` y `Usuario`?**
Tras un análisis exhaustivo del código fuente, se detectó que el modelo `Ferreteria` opera como un **"Perfil de Configuración del Local"**. Almacena datos comerciales y configuraciones críticas de AFIP/ARCA (certificados `.pem`, claves privadas, puntos de venta).
1. **Aislamiento Fiscal:** Estos datos altamente sensibles DEBEN vivir dentro del esquema aislado del inquilino. No pueden migrar al esquema `public` por riesgos de seguridad.
2. **Deuda Técnica Estratégica:** Actualmente existen más de 40 archivos (`views`, `serializers`, `ARCA services`) que dependen de la relación `request.user.ferreteria`. Si bien en un modelo *schema-per-tenant* esta ForeignKey es técnicamente redundante (el esquema ya define la ferretería), removerla implicaría reescribir y re-testear todo el módulo de facturación electrónica.

**Solución Híbrida (La más segura y eficiente):**
Crearemos una nueva app mínima llamada `tenants` que vivirá en `public`. Esta app solo tendrá los modelos `EmpresaTenant` y `Dominio` para hacer el enrutamiento. 
`Ferreteria` y `Usuario` se quedarán tal cual como están, dentro del esquema de cada inquilino. Al crear un `EmpresaTenant`, el sistema se sumergirá en el nuevo esquema, insertará 1 sola fila en la tabla local `productos_ferreteria` y creará el `Usuario` vinculado a ella. ¡El código actual de ventas/productos y AFIP funcionará perfectamente sin modificar ni una coma!

---

## 2. Librerías y Tecnologías Involucradas
- **PostgreSQL 15+**: Requisito fundamental.
- **django-tenants**: Librería principal para el cambio de esquemas (`search_path`).

---

## 3. Plan de Ejecución Técnico Paso a Paso

### PASO 1: Instalación
**Archivos afectados:** `backend/requirements.txt`
```text
django-tenants==3.6.1
```

### PASO 2: Configuración del Núcleo (Settings)
**Archivos afectados:** `backend/ferredesk_backend/settings/base.py`

Se dividirá la lógica respetando las apps existentes:
```python
DATABASES = {
    'default': {
        'ENGINE': 'django_tenants.postgresql_backend',
        # ... credenciales
    }
}
DATABASE_ROUTERS = ('django_tenants.routers.TenantSyncRouter', )

# App nueva exclusiva para el esquema public
SHARED_APPS = (
    'django_tenants',
    'tenants', # <-- App NUEVA para el ruteo SaaS
    'django.contrib.contenttypes',
    'django.contrib.staticfiles',
)

# Todas tus apps actuales son de inquilinos
TENANT_APPS = (
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.sessions',
    'django.contrib.messages',
    'ferreapps.usuarios',     # <-- Usuarios aislados
    'ferreapps.productos',    # <-- Incluye la config de la Ferreteria local
    'ferreapps.clientes',     # <-- Los compradores de la ferreteria
    'ferreapps.ventas',
    'ferreapps.reservas',
    'ferreapps.notas',
    'ferreapps.alertas',
    'ferreapps.informes',
    'ferreapps.compras',
    'ferreapps.cuenta_corriente',
    'ferreapps.caja',
    'ferreapps.sistema',
    'rest_framework',
    'corsheaders',
)

INSTALLED_APPS = list(SHARED_APPS) + [app for app in TENANT_APPS if app not in SHARED_APPS]

TENANT_MODEL = "tenants.EmpresaTenant"
TENANT_DOMAIN_MODEL = "tenants.Dominio"

MIDDLEWARE = [
    'django_tenants.middleware.main.TenantMainMiddleware', # <-- CRÍTICO: El primero
    # ... resto
]
```

### PASO 3: Modelado de Datos del SaaS
**Archivos afectados:** `backend/tenants/models.py` (App nueva)

```python
from django.db import models
from django_tenants.models import TenantMixin, DomainMixin

class EmpresaTenant(TenantMixin):
    nombre_fantasia = models.CharField(max_length=100)
    email_admin = models.EmailField()
    auto_create_schema = True

class Dominio(DomainMixin):
    pass
```

### PASO 4: Limpieza y Migraciones
No usaremos datos legacy.
1. Se limpiará la DB de PostgreSQL.
2. Se crearán migraciones limpias (`python manage.py makemigrations`).
3. Se ejecutará `python manage.py migrate_schemas --shared` para armar el `public`.

### PASO 5: Ruteo y URLs
**Archivos afectados:** `backend/ferredesk_backend/urls.py` y `urls_public.py`
Se definirán dos puntos de entrada:
```python
ROOT_URLCONF = 'ferredesk_backend.urls' # Para TENANTS (Tus rutas actuales)
PUBLIC_SCHEMA_URLCONF = 'ferredesk_backend.urls_public' # Para PUBLIC (Registro SaaS)
```

### PASO 6: Flujo de Auto-Registro SaaS (Conexión Arquitectónica)
**Archivos afectados:** `backend/tenants/views.py`

Aquí conectamos tu estructura vieja con el nuevo mundo SaaS:
```python
from django.db import transaction
from django_tenants.utils import tenant_context
from .models import EmpresaTenant, Dominio
from ferreapps.productos.models import Ferreteria
from ferreapps.usuarios.models import Usuario

@transaction.atomic
def registrar_empresa(request):
    subdominio = request.POST['subdominio']
    email = request.POST['email']
    
    # 1. Crear el Esquema en PostgreSQL
    nuevo_tenant = EmpresaTenant(schema_name=subdominio, nombre_fantasia=subdominio, email_admin=email)
    nuevo_tenant.save()
    Dominio.objects.create(domain=f"{subdominio}.ferredesk.com", tenant=nuevo_tenant, is_primary=True)
    
    # 2. Sumergirse en el esquema recién creado para inicializar tus tablas actuales
    with tenant_context(nuevo_tenant):
        # Crear la fila de config local de AFIP/Ferreteria
        ferreteria_local = Ferreteria.objects.create(
            nombre=subdominio,
            modo_arca='HOM'
        )
        
        # Crear el Usuario Dueño asignado a esa ferretería local
        Usuario.objects.create_superuser(
            username=email,
            email=email,
            password=request.POST['password'],
            ferreteria=ferreteria_local,
            tipo_usuario='admin'
        )
        
    return JsonResponse({"url": f"https://{subdominio}.ferredesk.com/login"})
```

### PASO 7: Copias de Seguridad (El "Cierre Z")
Se modificará el script actual (`backend/scripts/backup.py`) para iterar o ejecutar un dump aislado:
```bash
pg_dump -U postgres -h localhost -d ferredesk_db -n esquema_cliente > backup_cliente.sql
```
