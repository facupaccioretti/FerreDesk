# 🤝 Guía para Colaboradores de FerreDesk

Este documento detalla los pasos necesarios para comenzar a trabajar en el proyecto FerreDesk como colaborador.

---

## 👥 Paso a paso para acceder y colaborar en el repositorio

1. **Instalar Git**
   - Descargar desde: https://git-scm.com/
   - Verificar instalación: `git --version`

2. **Crear una cuenta en GitHub**
   - Registrarse en: https://github.com/join

3. **Compartir tu nombre de usuario de GitHub**
   - Una vez creada la cuenta, compartir tu usuario con el owner del proyecto para que te agregue como colaborador.

4. **Crear un token personal de acceso**
   - Ir a: https://github.com/settings/tokens
   - Elegir "Classic" token
   - Seleccionar el permiso `repo`
   - Copiar y guardar el token (solo se muestra una vez)

5. **Clonar el repositorio**
   ```bash
   git clone https://github.com/facupaccioretti/FerreDesk.git
   cd FerreDesk
   ```

6. **Identificarse en el repositorio**
   ```bash
   git config user.name "TuNombreGitHub"
   git config user.email "tuemail@github.com"
   ```

7. **Crear una nueva rama de desarrollo**
   ```bash
   git checkout -b dev
   ```

8. **Hacer un commit de prueba**
   ```bash
   echo "# Probando cambios" > prueba.txt
   git add .
   git commit -m "Primer commit en rama dev"
   git push --set-upstream origin dev
   ```

---

## 🛠 Requisitos de instalación para desarrollar FerreDesk

### General
- Git
- Node.js (v18+)
- npm o yarn
- Python 3.10+
- PostgreSQL (local o acceso a AWS RDS)

---

### Backend (FastAPI)

```bash
pip install fastapi "uvicorn[standard]" sqlalchemy psycopg2-binary python-dotenv pydantic python-jose[cryptography] passlib[bcrypt]
```

---

### Frontend (React + Tailwind + Tauri)

```bash
# Desde la carpeta frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npm install --save-dev @tauri-apps/cli
npm install @tauri-apps/api
```

---

### Rust y Tauri CLI (para compilar la app de escritorio)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install tauri-cli
```

---

