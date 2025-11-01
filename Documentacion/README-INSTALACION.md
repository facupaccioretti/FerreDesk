# Joder macho
## 📋 Opciones de Instalación

FerreDesk ofrece múltiples opciones de instalación según tus necesidades:

### 🎯 **Opción 1: Super Instalador (Recomendado para máquinas nuevas)**
**Archivo:** `super-install.bat`
**Ideal para:** Máquinas recién formateadas o sin dependencias instaladas

#### ✨ **Características:**
- ✅ **Instalación completamente automática**
- ✅ Instala Git automáticamente
- ✅ Instala Docker Desktop automáticamente
- ✅ Instala Chocolatey (gestor de paquetes)
- ✅ Descarga el código desde GitLab
- ✅ Configura y ejecuta FerreDesk
- ⚠️ **Requiere permisos de administrador**

#### 🚀 **Cómo usar:**
1. Haz clic derecho en `super-install.bat`
2. Selecciona **"Ejecutar como administrador"**
3. Sigue las instrucciones en pantalla
4. ¡Listo! FerreDesk estará funcionando en http://localhost:8000

---

### 🌐 **Opción 2: Instalador Standalone (Para distribución)**
**Archivo:** `install-standalone.bat`
**Ideal para:** Distribución a usuarios finales

#### ✨ **Características:**
- ✅ Descarga automática desde GitLab
- ✅ Instalación automática de dependencias (con permisos admin)
- ✅ Modo manual si no hay permisos de administrador
- ✅ Manejo de actualizaciones
- ✅ Un solo archivo para distribuir

#### 🚀 **Cómo usar:**
1. Descarga solo el archivo `install-standalone.bat`
2. Ejecútalo (preferiblemente como administrador)
3. Sigue las instrucciones
4. ¡Listo!

---

### 🔧 **Opción 3: Instalador Local (Para desarrolladores)**
**Archivo:** `install.bat`
**Ideal para:** Cuando ya tienes el código descargado

#### ✨ **Características:**
- ✅ Asume que ya tienes Git y Docker instalados
- ✅ Trabaja con código local
- ✅ Rápido y directo
- ✅ Ideal para desarrollo

#### 🚀 **Cómo usar:**
1. Asegúrate de tener Git y Docker Desktop instalados
2. Ejecuta `install.bat` desde el directorio del proyecto
3. ¡Listo!

---

## 📋 **Requisitos del Sistema**

### **Requisitos Mínimos:**
- **Sistema Operativo:** Windows 10/11 (64-bit)
- **RAM:** 4GB mínimo (8GB recomendado)
- **Espacio en disco:** 2GB libres
- **Internet:** Conexión estable para descarga

### **Dependencias Automáticas:**
Los instaladores automáticos instalan:
- **Git** (para descargar código)
- **Docker Desktop** (para ejecutar la aplicación)
- **Chocolatey** (gestor de paquetes de Windows)

### **Dependencias Internas (manejadas automáticamente):**
- **Python 3.11** (se instala en el contenedor Docker)
- **Node.js 18** (se instala en el contenedor Docker)
- **PostgreSQL 15** (se ejecuta en contenedor separado)
- **Todas las librerías Python y Node.js** (se instalan automáticamente)

---

## 🎛️ **Scripts Adicionales**

### **update.bat** - Actualizar FerreDesk ⭐
- Actualiza el código desde el repositorio
- Verifica que el build sea exitoso
- **ROLLBACK AUTOMÁTICO** si algo falla
- Preserva tus datos y configuración
- ✅ **Recomendado para actualizaciones**

### **recover-update.bat** - Recuperar Update Fallido 🔧
- Usa cuando `update.bat` haya fallado
- Fuerza reconstrucción completa sin caché
- Limpia y reconstruye todo desde cero
- Soluciona problemas de build corrupto

### **start.bat** - Iniciar FerreDesk
- Inicia los servicios si están detenidos
- Verifica que todo esté funcionando
- Muestra información de acceso

### **clean.bat** - Limpieza Completa
- Detiene todos los servicios
- Elimina contenedores, imágenes y datos
- Deja el proyecto como recién instalado
- ⚠️ **ADVERTENCIA:** Elimina todos los datos

---

## 🔄 **Cómo Actualizar FerreDesk**

### **Actualización Normal (Recomendado):**

1. Ejecuta `update.bat`
2. El script:
   - Verifica actualizaciones disponibles
   - Guarda punto de recuperación automático
   - Actualiza el código
   - Reconstruye el frontend
   - **Verifica que el build sea exitoso**
   - **Si falla, revierte automáticamente**
3. ¡Listo! Disfruta de las nuevas funciones

### **Si Update Falló:**

Si `update.bat` indica que falló:

1. Ejecuta `recover-update.bat`
2. Este script:
   - Limpia caché completamente
   - Reconstruye SIN usar caché
   - Verifica que funcione
3. Si aún falla, consulta `Documentacion/SOLUCION_UPDATE_FALLIDO.md`

### **Mejoras Automáticas v2.1:**

✅ Backup automático del commit anterior  
✅ Verificación del build frontend  
✅ Rollback automático si falla  
✅ Mensajes claros de error  
✅ Script de recuperación dedicado  

---

## 🔑 **Acceso a la Aplicación**

Una vez instalado correctamente:

- **URL:** http://localhost:8000
- **Usuario:** `admin`
- **Contraseña:** `admin123`

---

## 🆘 **Solución de Problemas**

### **Docker no inicia:**
- Verifica que Docker Desktop esté ejecutándose
- Reinicia Docker Desktop
- Verifica que WSL2 esté habilitado (Windows)

### **Puerto 8000 ocupado:**
- Cambia el puerto en `docker-compose.yml`
- O detén el servicio que usa el puerto 8000

### **Error de permisos:**
- Ejecuta como administrador
- Verifica que Docker tenga permisos de red

### **Servicios no inician:**
```bash
# Ver logs detallados
docker-compose logs -f

# Reconstruir completamente
docker-compose down
docker-compose up --build -d
```

### **Verificar estado:**
```bash
# Ver servicios activos
docker-compose ps

# Ver uso de recursos
docker stats
```

---

## 📞 **Soporte Técnico**

### **Comandos de Diagnóstico:**
```bash
# Información del sistema Docker
docker system info

# Uso de disco Docker
docker system df

# Limpiar recursos no utilizados
docker system prune

# Ver redes Docker
docker network ls
```

### **Archivos de Log:**
- **Aplicación:** `docker-compose logs ferredesk`
- **Base de datos:** `docker-compose logs postgres`
- **Sistema:** `docker system info`

---

## 🎉 **¡Listo para Usar!**

Una vez completada la instalación, FerreDesk estará listo para gestionar tu ferretería con todas las funcionalidades:

- ✅ **Gestión de productos y stock**
- ✅ **Sistema de ventas y presupuestos**
- ✅ **Integración con ARCA/AFIP**
- ✅ **Generación de códigos QR**
- ✅ **Exportación de libros IVA**
- ✅ **Dashboard de indicadores**

**¡Disfruta usando FerreDesk!** 🚀

