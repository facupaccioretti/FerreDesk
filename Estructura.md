# 📂 Estructura Detallada de Archivos y Carpetas — Ferretería App

Este documento explica de forma técnica pero accesible qué se debe incluir en cada carpeta y archivo del proyecto **FerreDesk App**, que utiliza un stack basado en **React + Tauri** para el frontend y **FastAPI + PostgreSQL (AWS RDS)** para el backend.

---

## 📁 Estructura del proyecto (propuesta inicial, estructura visible en Visual Studio Code o cualquier otro IDE)


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

## 🔍 Explicación de carpetas y archivos

---

### 📁 `frontend/` — Aplicación de escritorio (React + Tailwind + Tauri)
Contiene toda la interfaz visual del sistema. Usa React para crear componentes visuales, Tailwind para estilos rápidos y Tauri para empaquetar como app de escritorio.

- `public/`: Archivos estáticos públicos como favicon, íconos, etc. Carpeta con archivos públicos que no pasan por el sistema de compilación. Aquí podés poner imágenes como logos o íconos que el navegador pueda acceder directamente.
- `src/`: Código fuente principal de la app React, donde vive toda la lógica visual del frontend.
  - `assets/`: Imágenes, logos o recursos multimedia. Imágenes o íconos que se usan dentro del código.
  - `components/`: Componentes reutilizables como botones, inputs, modales, etc. Piezas pequeñas y reutilizables de la interfaz.
  - `pages/`: Cada pantalla completa (Login, Productos, Ventas, etc.) Archivos que representan pantallas enteras de la app.
  - `services/`: Funciones que se comunican con el backend usando `fetch()`. Se encargan de traer o enviar datos al backend.
  - `hooks/`: Hooks personalizados de React como `useAuth`, `useProductos`, etc. Encapsulan lógica que se puede reutilizar.
  - `utils/`: Funciones utilitarias generales (formateos, helpers, etc). Por ejemplo: formatear fechas, calcular totales.
  - `App.tsx`: Componente raíz donde se configura el router y layout principal. Es el corazón visual que junta todo.
  - `main.tsx`: Punto de entrada donde React se monta en el DOM. Es el que inicia todo en el navegador.
- `tailwind.config.js`: Configuración de Tailwind CSS. Define colores, tamaños, fuentes y clases personalizadas.
- `postcss.config.js`: Configuración de PostCSS (usado por Tailwind). Necesario para que Tailwind funcione correctamente.
- `vite.config.ts`: Configuración del bundler Vite. Vite se encarga de construir el proyecto y servirlo rápido.
- `tsconfig.json`: Configuración de TypeScript. Controla cómo se revisa y compila el código TypeScript.
- `index.html`: Archivo base HTML donde se inyecta la app React. Es el punto de partida del navegador.
- `package.json`: Dependencias y scripts del frontend. Indica qué librerías se usan y cómo ejecutar el proyecto.
- `.env`: Variables de entorno como `VITE_API_URL`. Almacena configuraciones privadas como la URL del backend.

---

### 📁 `src-tauri/` — Motor Tauri (crea la app de escritorio desde React)
Permite empaquetar tu app web como una app nativa de escritorio. Usa Rust para manejar lo nativo.

- `icons/`: Íconos de la aplicación (se usan al compilar para escritorio). Íconos que se ven en el instalador o en la ventana.
- `src/main.rs`: Código en Rust que inicializa la app. Es el programa que abre la ventana donde se carga la web.
- `tauri.conf.json`: Configuración general de Tauri. Define permisos, título, tamaño de ventana, etc.
- `Cargo.toml`: Archivo de dependencias del entorno Rust. Es como el `package.json` de Rust.

---

### 📁 `backend/` — API backend con FastAPI
Contiene la lógica del negocio, endpoints, modelos y validaciones. Es quien responde a las solicitudes del frontend.

- `app/`: Carpeta raíz del backend.
  - `api/`: Endpoints (rutas) para acceder a funcionalidades desde el frontend. Ejemplos: `auth.py`, `productos.py`, etc. Cada uno representa un módulo o función del sistema.
  - `core/`: Configuraciones generales y funciones de seguridad como generación y validación de JWT. Acá va todo lo necesario para proteger y configurar el backend.
  - `db/`: Lógica relacionada con la base de datos:
    - `base.py`: Base declarativa para SQLAlchemy. Todas las tablas usan esta clase como base.
    - `session.py`: Sesión y conexión a la base. Crea y gestiona la conexión con PostgreSQL.
    - `models/`: Clases SQLAlchemy que representan las tablas (no están listadas aún, pero deberían ir aquí). Por ejemplo, `Producto`, `Usuario`.
  - `schemas/`: Validaciones con Pydantic para los datos que entran/salen de los endpoints. Se asegura que lo que recibimos y devolvemos tenga el formato correcto.
  - `main.py`: Punto de entrada del backend. Aquí se inicializa FastAPI y se cargan los routers. Es donde empieza todo.
  - `__init__.py`: Marca el directorio como un paquete de Python. Normalmente vacío, pero necesario.
- `.env`: Contiene variables como `DATABASE_URL` o `JWT_SECRET`. No se sube al repositorio. Almacena información sensible.
- `requirements.txt`: Lista de dependencias que debe instalar el backend. Se usa con `pip install -r`.

---

### 🧰 Otros archivos importantes

- `docker-compose.yml`: Configuración de servicios como base de datos en contenedores (opcional). Permite levantar la base de datos sin instalarla localmente.
- `README.md`: Documento de presentación y explicación general del proyecto. Explica de qué trata, cómo instalarlo y usarlo.
- `.gitignore`: Archivos y carpetas que Git debe ignorar (ej: `venv/`, `node_modules/`, etc.). Ayuda a mantener el repo limpio.

---
