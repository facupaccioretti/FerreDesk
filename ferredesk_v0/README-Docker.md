# 🚀 FerreDesk - Instalador con Docker

## 📋 Descripción
FerreDesk es un sistema de gestión integral para ferreterías que incluye:
- Gestión de productos y stock
- Sistema de ventas y presupuestos
- Integración con ARCA/AFIP
- Generación de códigos QR
- Exportación de libros IVA
- Dashboard de indicadores

## 🎯 Requisitos Previos
- **Windows 10/11 (64-bit)**
- **Docker Desktop** instalado y ejecutándose
- **4GB RAM mínimo** (8GB recomendado)
- **2GB espacio libre** en disco

## 🚀 Instalación Rápida

### 1. Instalar Docker Desktop
- Ve a: https://www.docker.com/products/docker-desktop/
- Descarga "Docker Desktop for Windows"
- Ejecuta el instalador
- **Reinicia tu computadora**
- Abre Docker Desktop y espera a que esté listo

### 2. Ejecutar Instalador
- Doble clic en `install.bat`
- Espera a que termine la instalación (5-10 minutos)
- ¡Listo! FerreDesk estará disponible en http://localhost:8000

## 🌐 Uso Diario

### Iniciar FerreDesk:
- Doble clic en `start.bat`
- O ejecutar: `docker-compose up -d`

### Detener FerreDesk:
- Ejecutar: `docker-compose down`

### Ver logs en tiempo real:
- Ejecutar: `docker-compose logs -f`

### Reiniciar servicios:
- Ejecutar: `docker-compose restart`

## 🔑 Acceso Inicial
- **URL**: http://localhost:8000
- **Usuario**: `admin`
- **Contraseña**: `admin123`

## 📁 Estructura del Proyecto
```
FerreDesk/
├── docker-compose.yml      # Configuración de servicios
├── Dockerfile              # Instrucciones de construcción
├── env.example             # Variables de entorno (copia a .env)
├── install.bat             # Instalador automático
├── start.bat               # Iniciar servicios
├── scripts/
│   └── start.sh            # Script de inicio del contenedor
├── backend/                # Código Django
├── frontend/               # Código React
└── README-Docker.md        # Este archivo
```

## 🔧 Comandos Docker Útiles

### Ver estado de servicios:
```bash
docker-compose ps
```

### Ver logs de un servicio específico:
```bash
docker-compose logs -f ferredesk
docker-compose logs -f postgres
```

### Reconstruir aplicación:
```bash
docker-compose down
docker-compose up --build -d
```

### Acceder al contenedor:
```bash
docker-compose exec ferredesk bash
```

### Ver uso de recursos:
```bash
docker stats
```

## 🗄️ Base de Datos

### PostgreSQL incluido:
- **Puerto**: 5432
- **Base de datos**: `ferredesk`
- **Usuario**: `ferredesk_user`
- **Contraseña**: `ferredesk_pass_2024`

### Datos persistentes:
- Los datos se almacenan en volumen Docker
- **No se pierden** al reiniciar o actualizar
- Ubicación: `postgres_data` (volumen Docker)

## 🚨 Solución de Problemas

### Docker no inicia:
- Verifica que Docker Desktop esté ejecutándose
- Reinicia Docker Desktop
- Verifica que WSL2 esté habilitado

### Puerto 8000 ocupado:
- Cambia el puerto en `docker-compose.yml`:
```yaml
ports:
  - "8001:8000"  # Cambia 8000 por 8001
```

### Base de datos corrupta:
```bash
docker-compose down -v
docker-compose up --build -d
```

### Error de permisos:
- Ejecuta como administrador
- Verifica que Docker tenga permisos de red

### Servicios no inician:
```bash
docker-compose logs
docker-compose down
docker-compose up --build -d
```

## 🔄 Actualizaciones

### Actualizar a nueva versión:
```bash
git pull origin main
docker-compose down
docker-compose up --build -d
```

### Actualizar solo código (sin reconstruir):
```bash
docker-compose restart ferredesk
```

## 📊 Monitoreo

### Ver uso de recursos:
```bash
docker stats
```

### Ver logs en tiempo real:
```bash
docker-compose logs -f
```

### Ver estado de servicios:
```bash
docker-compose ps
```

## 🆘 Soporte

### Comandos de diagnóstico:
```bash
# Ver información del sistema
docker system info

# Ver uso de disco
docker system df

# Limpiar recursos no utilizados
docker system prune

# Ver redes Docker
docker network ls
```

### Logs importantes:
- **Aplicación**: `docker-compose logs ferredesk`
- **Base de datos**: `docker-compose logs postgres`
- **Sistema**: `docker system info`

## 📝 Notas Importantes

- **Primera ejecución**: Puede tardar 5-10 minutos en construir
- **Reinicio**: Los datos se mantienen entre reinicios
- **Actualizaciones**: Siempre hacer backup antes de actualizar
- **Puertos**: Verificar que 8000 y 5432 estén libres
- **Firewall**: Permitir Docker en el firewall de Windows

## 🎉 ¡Listo!

Tu FerreDesk está funcionando con Docker. Ahora puedes:
- Acceder a http://localhost:8000
- Usar el sistema con usuario `admin` / `admin123`
- Gestionar productos, ventas y clientes
- Generar códigos QR para AFIP
- Exportar libros IVA

¡Disfruta usando FerreDesk! 🚀 