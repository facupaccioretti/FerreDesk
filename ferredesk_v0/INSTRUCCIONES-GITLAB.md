# 📋 INSTRUCCIONES PARA SUBIR A GITLAB

## 🚀 Pasos para configurar el repositorio

### 1. Crear repositorio en GitLab
1. Ve a GitLab.com
2. Crea un nuevo proyecto/repositorio
3. Nombre sugerido: `ferredesk`
4. Configura como **público** o **privado** según prefieras

### 2. Actualizar URLs en los archivos
Una vez creado el repositorio, actualiza la URL en:

#### `install-standalone.bat` (línea 84):
```batch
REM Cambiar esta línea:
git clone https://gitlab.com/TU_USUARIO/ferredesk.git ferredesk_v0

REM Por tu URL real, ejemplo:
git clone https://gitlab.com/tu_usuario_real/ferredesk.git ferredesk_v0
```

### 3. Comandos para subir el código

```bash
# Desde el directorio ferredesk_v0:
git init
git add .
git commit -m "Versión inicial de FerreDesk - Sistema de gestión para ferreterías"
git branch -M main
git remote add origin https://gitlab.com/TU_USUARIO/ferredesk.git
git push -u origin main
```

### 4. Verificar que funciona
1. Descarga `install-standalone.bat` 
2. Ejecútalo en una máquina limpia
3. Verifica que descarga e instala correctamente

## 📝 Archivos importantes para el repositorio

### ✅ Incluir en GitLab:
- ✅ Todo el código fuente (`backend/`, `frontend/`)
- ✅ Configuración Docker (`docker-compose.yml`, `Dockerfile`)
- ✅ Scripts de instalación (`install.bat`, `start.bat`, `clean.bat`)
- ✅ Documentación (`README-Docker.md`)
- ✅ Archivos de configuración (`env.example`, `requirements.txt`, `package.json`)
- ✅ `.gitignore` (ya configurado)
- ✅ `.dockerignore` (ya configurado)

### ❌ NO incluir (ya está en .gitignore):
- ❌ `db.sqlite3` (base de datos local)
- ❌ `node_modules/` (dependencias Node.js)
- ❌ `__pycache__/` (cache Python)
- ❌ `venv/` (entorno virtual Python)
- ❌ `.env` (variables de entorno locales)
- ❌ `data/`, `media/`, `staticfiles/` (se crean automáticamente)

## 🎯 Distribución a usuarios finales

### Para usuarios finales:
1. **Solo distribuir**: `install-standalone.bat`
2. **Instrucciones**: "Ejecuta install-standalone.bat y sigue las instrucciones"
3. **Requisitos**: Git y Docker Desktop instalados

### El instalador automáticamente:
1. ✅ Descarga todo el código desde GitLab
2. ✅ Crea la estructura de directorios
3. ✅ Configura variables de entorno
4. ✅ Construye e inicia los servicios Docker
5. ✅ Verifica que todo funcione

## 🔧 Mantenimiento

### Para actualizar el código:
```bash
git add .
git commit -m "Descripción de los cambios"
git push origin main
```

### Los usuarios pueden actualizar con:
- Ejecutar `install-standalone.bat` nuevamente
- Elegir "S" cuando pregunte si quiere actualizar

## 📞 Soporte

### Si hay problemas con la instalación:
1. Verificar que Git esté instalado
2. Verificar que Docker Desktop esté ejecutándose
3. Verificar conexión a internet
4. Revisar que la URL del repositorio sea correcta
5. Consultar logs con: `docker-compose logs -f`
