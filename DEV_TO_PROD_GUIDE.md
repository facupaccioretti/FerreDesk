# Guía: Desarrollo (ferredesk_dev) → Producción (ferredesk)

## 🔧 Cambios para Ambiente de DESARROLLO

### 1. Instalador PowerShell
**Archivo**: `instalador/ferredesk-1.0.0.ps1`

**Línea 47** - Cambiar imagen Docker:
```powershell
# ANTES (Producción):
$Script:DockerImage = "lautajuare/ferredesk:1.0.0"

# DESPUÉS (Desarrollo):
$Script:DockerImage = "lautajuare/ferredesk_dev:1.0.0"
```

**Línea 576** - Cambiar imagen en docker-compose:
```yaml
# ANTES (Producción):
image: lautajuare/ferredesk:${FERREDESK_VERSION}

# DESPUÉS (Desarrollo):
image: lautajuare/ferredesk_dev:${FERREDESK_VERSION}
```

---

### 2. Launcher (si implementas el sistema de actualización)
**Archivo**: `launcher/ferredesk_launcher.py`

**Constante DOCKERHUB_REPO**:
```python
# ANTES (Producción):
DOCKERHUB_REPO = "lautajuare/ferredesk"

# DESPUÉS (Desarrollo):
DOCKERHUB_REPO = "lautajuare/ferredesk_dev"
```

---

### 3. Docker Compose existente (si ya tienes instalación previa)
**Archivo**: `C:\ProgramData\FerreDesk\ferredesk\docker-compose.yml`

Si ya tienes FerreDesk instalado y quieres probar con la imagen dev:

```yaml
# ANTES (Producción):
app:
  image: lautajuare/ferredesk:${FERREDESK_VERSION}

# DESPUÉS (Desarrollo):
app:
  image: lautajuare/ferredesk_dev:${FERREDESK_VERSION}
```

---

## 🚀 Proceso Completo para Testing

### Opción A: Instalación Limpia con ferredesk_dev

1. **Modificar archivos**:
   - `instalador/ferredesk-1.0.0.ps1` (líneas 47 y 576)
   - `launcher/ferredesk_launcher.py` (si implementas updates)

2. **Recompilar launcher** (si modificaste el launcher):
   ```cmd
   cd launcher
   build.bat
   ```

3. **Recompilar instalador** con Inno Setup:
   - Abrir `instalador/ferredesk-1.0.0-installer.iss`
   - Build → Compile
   - Esto generará el `.exe` en `instalador/Output/`

4. **Ejecutar instalador** y verificar que descarga de `ferredesk_dev`

### Opción B: Actualizar Instalación Existente

Si ya tienes FerreDesk instalado y solo quieres cambiar la imagen:

1. **Editar docker-compose.yml**:
   ```cmd
   notepad C:\ProgramData\FerreDesk\ferredesk\docker-compose.yml
   ```
   Cambiar `lautajuare/ferredesk` → `lautajuare/ferredesk_dev`

2. **Descargar nueva imagen**:
   ```cmd
   cd C:\ProgramData\FerreDesk\ferredesk
   docker pull lautajuare/ferredesk_dev:1.0.0
   ```

3. **Recrear contenedores**:
   ```cmd
   docker-compose down
   docker-compose up -d
   ```

---

## ✅ Verificación

Después de cualquier cambio, verifica que esté usando la imagen correcta:

```cmd
docker ps --format "table {{.Names}}\t{{.Image}}"
```

Deberías ver:
```
NAMES              IMAGE
ferredesk_app      lautajuare/ferredesk_dev:1.0.0
ferredesk_postgres postgres:15
```

---

## 🔄 Revertir a PRODUCCIÓN

Cuando termines las pruebas y quieras volver a producción:

### 1. Revertir cambios en código:
```powershell
# instalador/ferredesk-1.0.0.ps1 línea 47:
$Script:DockerImage = "lautajuare/ferredesk:1.0.0"

# instalador/ferredesk-1.0.0.ps1 línea 576:
image: lautajuare/ferredesk:${FERREDESK_VERSION}

# launcher/ferredesk_launcher.py (si aplica):
DOCKERHUB_REPO = "lautajuare/ferredesk"
```

### 2. Recompilar:
- Launcher: `cd launcher && build.bat`
- Instalador: Compilar con Inno Setup

### 3. En instalación existente:
```cmd
cd C:\ProgramData\FerreDesk\ferredesk
# Editar docker-compose.yml (revertir a lautajuare/ferredesk)
docker pull lautajuare/ferredesk:1.0.0
docker-compose up -d --force-recreate
```

---

## 📝 Resumen de Archivos a Modificar

| Archivo | Línea(s) | Cambio |
|---------|----------|--------|
| `instalador/ferredesk-1.0.0.ps1` | 47 | `ferredesk` → `ferredesk_dev` |
| `instalador/ferredesk-1.0.0.ps1` | 576 | `ferredesk` → `ferredesk_dev` |
| `launcher/ferredesk_launcher.py` | Variable DOCKERHUB_REPO | `ferredesk` → `ferredesk_dev` |
| `C:\ProgramData\FerreDesk\ferredesk\docker-compose.yml` | Servicio app | `ferredesk` → `ferredesk_dev` |

---

## 💡 Tip: Usar Variables de Entorno

Para facilitar el cambio entre dev/prod, podrías:

1. **Agregar variable en `.env`**:
   ```env
   FERREDESK_REPO=lautajuare/ferredesk_dev
   ```

2. **Usar en docker-compose.yml**:
   ```yaml
   app:
     image: ${FERREDESK_REPO}:${FERREDESK_VERSION}
   ```

Así solo cambias el `.env` sin tocar el `docker-compose.yml`.
