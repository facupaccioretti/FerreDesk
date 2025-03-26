# 🧰 FerreDesk App — Sistema de Gestión Multiplataforma

## 📋 Descripción general

**Ferretería App** es una aplicación de escritorio multiplataforma desarrollada con tecnologías modernas. Su objetivo es gestionar el stock, ventas, usuarios y sucursales de una o varias ferreterías. La aplicación está dividida en dos grandes módulos:

- **Frontend**: Interfaz de usuario desarrollada con **React + Tailwind**, empaquetada como app de escritorio usando **Tauri**.
- **Backend**: API REST construida en **Python (FastAPI)** conectada a una base de datos centralizada en **AWS RDS (PostgreSQL)**.

---

## 🛠️ Tecnologías utilizadas

| Capa          | Herramienta                        |
|---------------|------------------------------------|
| Interfaz      | React + Tailwind + Tauri           |
| Backend       | FastAPI                            |
| Base de datos | PostgreSQL (AWS RDS)               |
| ORM           | SQLAlchemy ?                       |
| Autenticación | JWT (tokens firmados) ?            |
| Validación    | Pydanti?                           |
| API Client    | Axios o Fetch ?                    |
| Dev tools     | Docker (opcional), Vite?, Alembic? |


## 📊 Funcionalidades esperadas

- ✅ Login y autenticación con roles (`admin`, `vendedor`)
- ✅ CRUD de productos
- ✅ Gestión de ventas por usuario y por ferretería
- ✅ Reportes y métricas (top productos, ingresos, etc.)
- ✅ Multi-tenant: datos aislados por ferretería
- ✅ Interfaz moderna y responsiva con React + Tailwind
- ✅ App ejecutable como escritorio con Tauri




---

Este README sirve como base completa para el repositorio de GitHub de "FerreDesk App". 
