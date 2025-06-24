# 🧰 FerreDesk App — Sistema de Gestión Multiplataforma

## 📋 Descripción general

**Ferretería App** es una aplicación de escritorio multiplataforma desarrollada con tecnologías modernas. Su objetivo es gestionar el stock, ventas, usuarios y sucursales de una o varias ferreterías. La aplicación está dividida en dos grandes módulos:

- **Frontend**: React + Tailwind (accedido desde navegador, incluso local).
- **Backend**: Django + Django REST Framework.
- **Base de datos**: Firebird SQL (instalada localmente).

## 🛠️ Tecnologías utilizadas

| Capa          | Herramienta                        |
|---------------|------------------------------------|
| Interfaz      | React + Tailwind                   |
| Backend       | Django                             |
| Base de datos | Sqlite/PostgreSQL                  |


## 📊 Funcionalidades esperadas

- ✅ Login y autenticación con roles (`admin`, `cli_admin`, `cli_user`, `prueba`, `auditor`)
- ✅ CRUD de productos
- ✅ Gestión de ventas por usuario y por ferretería
- ✅ Reportes y métricas (top productos, ingresos, etc.)
- ✅ Multi-tenant: datos aislados por ferretería
- ✅ Interfaz moderna y responsiva con React + Tailwind

## 🗂️ Estructura del repositorio

```text
FERREDESK/
├── ferredesk_v1/                   # Versión principal del sistema
│   ├── backend/                    # Backend con Django
│   │   ├── manage.py              # Script principal de Django para gestionar el proyecto
│   │   ├── ferredesk_backend/     # Configuración global Django (settings, urls, wsgi)
│   │   ├── apps/                  # Módulos de la aplicación
│   │   │   ├── productos/        # Gestión de catálogo de productos
│   │   │   ├── ventas/          # Sistema de ventas y facturación
│   │   │   ├── usuarios/        # Gestión de usuarios y autenticación
│   │   │   └── reportes/        # Generación de reportes y estadísticas
│   │   ├── .env                  # Variables de entorno (configuración sensible)
│   │   ├── requirements.txt      # Dependencias de Python
│   │   └── .gitignore           # Archivos ignorados por Git
│   │
│   ├── frontend/                  # Frontend con React
│   │   ├── public/               # Archivos estáticos y assets públicos
│   │   ├── src/                  # Código fuente de React
│   │   │   ├── components/      # Componentes reutilizables
│   │   │   ├── pages/          # Páginas principales
│   │   │   ├── hooks/          # Custom hooks de React
│   │   │   ├── context/        # Contextos de React
│   │   │   └── utils/          # Utilidades y helpers
│   │   ├── package.json         # Dependencias de Node.js
│   │   └── .env                # Variables de entorno del frontend
│   │
│   ├── database/                 # Configuración y scripts de base de datos
│   │   ├── schema.sql           # Esquema de la base de datos
│   │   ├── ferredesk.fdb        # Archivo de base de datos (opcional)
│   │   └── diagrama_db.pdf      # Diagrama ER de la base de datos
│   │
│   └── utilidades/               # Herramientas y recursos adicionales
│       ├── vercel/              # Configuración de despliegue en Vercel
│       │   ├── Pagina Login     # Prototipo de la página de login
│       │   └── assets/          # Recursos para el prototipo
│       └── scripts/             # Scripts de utilidad
│           ├── setup_dev.ps1    # Script para configurar entorno de desarrollo
│           └── backup_db.ps1    # Script para respaldar la base de datos
│
├── .gitignore                    # Archivos y carpetas ignorados por Git
├── README.md                     # Documentación principal del proyecto
└── CONTRIBUIDORES.md             # Guía para contribuidores
```

### Descripción de los directorios principales

#### 📦 Backend (`backend/`)
El backend está construido con Django y contiene toda la lógica de negocio. Incluye:
- Configuración del proyecto Django
- Aplicaciones modulares para cada funcionalidad
- Sistema de autenticación y autorización
- APIs REST para comunicación con el frontend
- Configuración de la base de datos

#### 🎨 Frontend (`frontend/`)
La interfaz de usuario desarrollada con React y Tailwind CSS:
- Componentes reutilizables y modulares
- Sistema de rutas y navegación
- Integración con APIs del backend
- Estilos y temas personalizados
- Gestión de estado global

#### 💾 Base de datos (`database/`)
Contiene todo lo relacionado con la base de datos:
- Scripts de migración
- Esquema de la base de datos
- Diagramas y documentación
- Scripts de respaldo

#### 🛠️ Utilidades (`utilidades/`)
Herramientas y recursos para desarrollo y mantenimiento:
- Scripts de automatización
- Prototipos y diseños
- Documentación adicional
- Herramientas de despliegue

---

Este README sirve como base completa para el repositorio de GitHub de "FerreDesk App". .
