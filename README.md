# 🧰 Ferretería App — Sistema de Gestión Multiplataforma

## 📋 Descripción general

**Ferretería App** es una aplicación de escritorio multiplataforma desarrollada con tecnologías modernas. Su objetivo es gestionar el stock, ventas, usuarios y sucursales de una o varias ferreterías. La aplicación está dividida en dos grandes módulos:

- **Frontend**: Interfaz de usuario desarrollada con **React + Tailwind**, empaquetada como app de escritorio usando **Tauri**.
- **Backend**: API REST construida en **Python (FastAPI)** conectada a una base de datos centralizada en **AWS RDS (PostgreSQL)**.

---

## 🛠️ Tecnologías utilizadas

| Capa          | Herramienta                      |
|---------------|----------------------------------|
| Interfaz      | React + Tailwind + Tauri         |
| Backend       | FastAPI                          |
| Base de datos | PostgreSQL (AWS RDS)             |
| ORM           | SQLAlchemy                       |
| Autenticación | JWT (tokens firmados)            |
| Validación    | Pydantic                         |
| API Client    | Axios o Fetch                    |
| Dev tools     | Docker (opcional), Vite, Alembic |

---

## 📁 Estructura del repositorio

<estructura_omitida_para_brevedad>

---

## 📊 Funcionalidades esperadas

- ✅ Login y autenticación con roles (`admin`, `vendedor`)
- ✅ CRUD de productos
- ✅ Gestión de ventas por usuario y por ferretería
- ✅ Reportes y métricas (top productos, ingresos, etc.)
- ✅ Multi-tenant: datos aislados por ferretería
- ✅ Interfaz moderna y responsiva con React + Tailwind
- ✅ App ejecutable como escritorio con Tauri

---

## 🌐 Variables de entorno (ejemplo)

### Frontend `.env`

```env
VITE_API_URL=http://localhost:8000
```

### Backend `.env`

```env
DATABASE_URL=postgresql://usuario:password@rds.amazonaws.com:5432/ferreteria_db
JWT_SECRET=tu_clave_secreta
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

---

## 🚀 Cómo ejecutar el proyecto

### Requisitos previos
- Node.js
- Python 3.10+
- Tauri CLI (`cargo install tauri-cli`)
- PostgreSQL (local o en AWS RDS)

### Desarrollo
```bash
# Frontend
cd frontend
npm install
npm run tauri dev

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # o venv\Scripts\activate en Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## 📄 Licencia
Este proyecto se entrega bajo la licencia MIT.

---

## ✍️ Créditos
Desarrollado por el equipo de gestión y tecnología de Ferretería App.

---

Este README sirve como base completa para el repositorio de GitHub de "Ferretería App". Puedes adaptarlo libremente según tu flujo de trabajo o herramientas adicionales.
