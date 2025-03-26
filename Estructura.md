# 📂 Estructura Detallada de Archivos y Carpetas — Ferretería App

Este documento explica de forma técnica pero accesible qué se debe incluir en cada carpeta y archivo del proyecto **FerreDesk App**, que utiliza un stack basado en **React + Tauri** para el frontend y **FastAPI + PostgreSQL (AWS RDS)** para el backend.

---

## 📁 Estructura del proyecto (propuesta inicial)


ferredesk/
├── frontend/                     # Interfaz de usuario con React + Tauri
│   ├── public/
│   ├── src/
│   │   ├── assets/               # Logos, íconos, imágenes
│   │   ├── components/           # Componentes reutilizables (Botones, Inputs, etc.)
│   │   ├── pages/                # Pantallas principales: Login, Dashboard, Productos, etc.
│   │   ├── services/             # Llamadas al backend vía fetch
│   │   ├── hooks/                # Custom hooks de React
│   │   ├── utils/                # Funciones auxiliares
│   │   ├── App.tsx               # Componente principal
│   │   └── main.tsx              # Punto de entrada
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── package.json
│   └── .env                      # Variables de entorno frontend
│
├── src-tauri/                   # Configuración nativa de Tauri (para empaquetado)
│   ├── icons/
│   ├── src/
│   │   └── main.rs
│   ├── tauri.conf.json
│   └── Cargo.toml
│
├── backend/                     # Backend en FastAPI
│   ├── app/
│   │   ├── api/                 # Endpoints: auth.py, productos.py, ventas.py, etc.
│   │   ├── core/                # Configuración general y seguridad (JWT, settings)
│   │   ├── db/                  # Modelos y conexión a PostgreSQL (SQLAlchemy)
│   │   ├── schemas/             # Validaciones de entrada/salida (Pydantic)
│   │   ├── main.py              # Punto de entrada FastAPI
│   │   └── __init__.py
│   ├── .env                     # Variables de entorno backend
│   └── requirements.txt         # Dependencias del backend
│
├── docker-compose.yml           # Opcional: contenedores para dev/local
├── README.md                    # Documentación del proyecto
└── .gitignore                   # Archivos ignorados por Git

