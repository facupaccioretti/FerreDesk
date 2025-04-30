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
| Base de datos | Firebird SQL                       |


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
│   │   ├── manage.py
│   │   ├── ferredesk_backend/     # Configuración global Django
│   │   ├── apps/                  # Apps internas: productos, ventas, etc.
│   │   ├── .env                   # Configuración sensible (NO commitear)
│   │   ├── requirements.txt       # Dependencias del backend
│   │   └── .gitignore
│   │
│   ├── frontend/                  # Frontend con React
│   │   ├── public/
│   │   ├── src/
│   │   ├── package.json
│   │   └── .env
│   │
│   └── utilidades/                # Scripts, diagramas, documentos extras
│       ├── database/
│       │   ├── schema.sql         # Creación de la base Firebird
│       │   ├── ferredesk.fdb      # Archivo opcional de base real
│       │   └── diagrama_db.pdf
│       ├── vercel/        
│       │   ├── schema.sql         # Creación de la base Firebird
│       │   ├── ferredesk.fdb      # Archivo opcional de base real
│       │   └── diagrama_db.pdf
│       └── scripts/
│           └── setup_dev.ps1      # Script para inicializar entorno dev
│
├── .gitignore
├── README.md                      # Documentación general
├── CONTRIBUIDORES.md              # Ayuda para contribuidores del proyecto
└── 


---

Este README sirve como base completa para el repositorio de GitHub de "FerreDesk App". 
