
## README DESACTUALIZADO

## Documentacion Normativa

Las decisiones de arquitectura y convenciones del backend se documentan en:

- [ADR-backend-organization.md](C:/Users/admin/Desktop/FerreDesk/ADR-backend-organization.md)
- [CODING_STANDARDS.md](C:/Users/admin/Desktop/FerreDesk/CODING_STANDARDS.md)
- [ADR-backend-coding-conventions.md](C:/Users/admin/Desktop/FerreDesk/ADR-backend-coding-conventions.md)

## Windows y UTF-8

En Windows con PowerShell 5.1 puede aparecer mojibake al leer archivos UTF-8 si la sesion arranca con `CP437`, `IBM437` o `$OutputEncoding` en ASCII. Eso rompe contexto, matching de parches y verificaciones aunque el archivo en disco este bien.

Antes de trabajar sobre Markdown o archivos con texto no ASCII, ejecutar:

```powershell
. C:\Users\admin\Desktop\FerreDesk\scripts\enable-utf8-powershell.ps1
```

Ese script:

- fuerza `InputEncoding`, `OutputEncoding` y `$OutputEncoding` a UTF-8
- cambia la code page activa a `65001`
- fija `Out-File`, `Set-Content` y `Add-Content` en UTF-8 para la sesion
- exporta `PYTHONIOENCODING=utf-8` para procesos hijos

Si despues de eso `Get-Content -Encoding utf8 <archivo>` se ve bien pero otro flujo sigue mostrando mojibake, tratarlo como problema de lectura/contexto de la herramienta, no como corrupcion del archivo.

FerreDesk es una aplicación web para gestionar productos, ventas, clientes, proveedores, cuentas corrientes, compras, reservas e informes. El sistema corre sobre Docker y expone (actualizar para cuando usemos droplets) una única aplicación web en `http://localhost:8000` que sirve el frontend con React y el backend con Django integrados.

- Frontend: React + Tailwind CSS (build servido por Django).
- Backend: Django 5 + Django REST Framework.
- Base de datos: PostgreSQL (en Docker). En desarrollo local también se soporta PostgreSQL.
- Integración fiscal: módulo ARCA, WSFEv1 y Constancia Padron.

## Tecnologías

| Capa | Herramientas |
|------|--------------|
| Interfaz | React, Tailwind CSS |
| Backend | Django, Django REST Framework |
| Base de datos | PostgreSQL (Docker), `dj-database-url` |
| Infraestructura | Docker, Docker Compose |

## Estructura del repositorio (desactualizadal)

```text
FerreDesk/
├── ferredesk_v0/
│   ├── backend/
│   │   ├── manage.py
│   │   ├── ferredesk_backend/       # Settings, urls, wsgi/asgi
│   │   └── ferreapps/               # Apps: productos, ventas, clientes, etc.
│   │       └── ventas/ARCA/         # Integración ARCA/WSFEv1
│   ├── frontend/                    # App React (código fuente)
│   ├── docker-compose.yml           # Orquestación (Postgres + app)
│   ├── Dockerfile                   # Imagen de la app (Django + build React)
│   ├── start.bat                    # Inicia servicios con Docker Desktop
│   ├── super-install.bat            # Instalación completa en Windows
│   ├── recover-update.bat           # Reconstrucción forzada sin caché
│   ├── update.bat / update2.bat     # Actualizaciones
│   ├── clean.bat                    # Limpieza de artefactos
│   ├── env.example                  # Variables de entorno de ejemplo
│   └── requirements.txt             # Dependencias de Python
├── arca_arg/                        # Librería ARCA (WSFEv1)
└── Documentacion/                   # Documentos técnicos y de negocio
```


## Configuración de base de datos

En Docker, la base utiliza PostgreSQL 15 con variables definidas en `docker-compose.yml`. La aplicación consume `DATABASE_URL` dentro del contenedor.

- Servicio `postgres` (puerto host `5433`, contenedor `5432`).
- Servicio `ferredesk` (aplicación) con `DEBUG=True` por defecto en Docker.

En desarrollo local (sin Docker), la configuración por defecto (`ferredesk_v0/backend/ferredesk_backend/settings.py`) usa PostgreSQL local en `localhost:5432`. Se puede ajustar mediante variables de entorno o editando los parámetros locales.

## Rutas de backend y frontend

- Django sirve el build de React directamente desde el directorio `frontend/build` (detecta si corre en Docker o local para ubicar la ruta).
- Archivos estáticos y el `index.html` del frontend se incluyen en `STATICFILES_DIRS`.

## Integración ARCA / Facturación electrónica

- El módulo `ferreapps/ventas/ARCA` contienen la integración con WSFEv1 y Constancia Padron.
- Existen utilidades específicas para Libro IVA e informes en `ferreapps/ventas`.




