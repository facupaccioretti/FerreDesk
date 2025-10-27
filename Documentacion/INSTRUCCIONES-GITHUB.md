# 📋 INSTRUCCIONES PARA GITHUB

## 🚀 Repositorio ya configurado

✅ **Repositorio GitHub:** https://github.com/facupaccioretti/FerreDesk

El repositorio ya está creado y configurado correctamente.

### 2. URLs ya actualizadas ✅

Las URLs en los instaladores ya están configuradas correctamente:
- `super-install.bat` ✅
- `install-standalone.bat` ✅

Ambos descargan desde: https://github.com/facupaccioretti/FerreDesk

### 3. Próximos commits

Para futuras actualizaciones:
```bash
# Desde el directorio raíz del repositorio:
git add .
git commit -m "Descripción de los cambios"
git push origin main
```

### 4. Verificar que funciona ✅
Los instaladores están listos para probar:
1. Descarga `super-install.bat` desde GitHub
2. Ejecútalo como administrador en una máquina nueva
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
