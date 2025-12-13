# FerreDesk Installer v1.0.0 - Changelog

## Resumen de Cambios

El instalador ha sido refactorizado para usar **imágenes pre-compiladas de Docker Hub** en lugar de construir localmente desde el código fuente.

## Arquitectura Nueva

| Antes (v0.x) | Ahora (v1.0.0) |
|--------------|----------------|
| Clonar repo de GitHub | ❌ Eliminado |
| Instalar Git | ❌ Eliminado |
| `docker-compose build` local | ❌ Eliminado |
| Imagen: construida localmente | ✅ `lautajuare/ferredesk:latest` |
| 2 contenedores (monolito) | ✅ 2 contenedores (postgres + app) |

## Lo que se MANTIENE

- ✅ Instalación de Chocolatey
- ✅ Instalación de Docker Desktop
- ✅ Activación de Windows Features (WSL2, VirtualMachinePlatform)
- ✅ WSL install y update
- ✅ Lógica de reinicio con RunOnce (auto-resume)
- ✅ Manejo de fases (1, 2, 3)
- ✅ Logging completo
- ✅ Integración Inno Setup ↔ PowerShell
- ✅ Desinstalador con limpieza Docker

## Lo que se ELIMINA

- ❌ Instalación de Git (ya no se clona código)
- ❌ Clonación de GitHub (`git clone`)
- ❌ Construcción de imágenes Docker (`docker-compose build`)
- ❌ Directorio `ferredesk_v0` (ahora es `ferredesk`)

## Lo que se AGREGA

- 🆕 `docker pull lautajuare/ferredesk:latest`
- 🆕 Generación de `.env` con SECRET_KEY criptográficamente segura
- 🆕 Generación de contraseña PostgreSQL única por instalación
- 🆕 Mensaje de ayuda para SmartScreen/antivirus

## Fases de Instalación

### Fase 1: Preparación del Sistema
1. Verificar Windows 10/11 64-bit
2. Activar Windows Features (WSL2, VirtualMachinePlatform)
3. Instalar WSL2 y ejecutar `wsl --update`
4. Instalar Chocolatey
5. Instalar Docker Desktop
6. **Si requiere reinicio**: registrar RunOnce y reiniciar

### Fase 2: Verificar Docker
1. Verificar Docker Desktop instalado
2. Iniciar Docker Desktop si no está corriendo
3. Esperar hasta que Docker responda

### Fase 3: Desplegar FerreDesk
1. `docker pull lautajuare/ferredesk:latest`
2. Generar `.env` con credenciales seguras
3. Crear `docker-compose.yml`
4. Crear carpeta `media/`
5. `docker-compose up -d`
6. Esperar servicios listos
7. Abrir navegador en http://localhost:8000

## Estructura de Archivos del Cliente

```
C:\Users\{user}\AppData\Local\Programs\FerreDesk\
└── ferredesk\
    ├── .env                 # Configuración (generada)
    ├── docker-compose.yml   # Compose (generado)
    └── media\               # Archivos subidos

C:\ProgramData\FerreDesk\
├── logs\
│   └── FerreDesk-Installer.log
├── config\
└── installer-state.json
```

## Variables de Entorno Generadas

El archivo `.env` se genera automáticamente con:

| Variable | Valor |
|----------|-------|
| `ENVIRONMENT` | `production` |
| `DEBUG` | `False` |
| `POSTGRES_DB` | `ferredesk` |
| `POSTGRES_USER` | `ferredesk_user` |
| `POSTGRES_PASSWORD` | (generada aleatoriamente) |
| `DATABASE_URL` | (construida con la contraseña) |
| `SECRET_KEY` | (generada criptográficamente) |
| `ALLOWED_HOSTS` | `*` |

## Manejo de Errores SmartScreen

Si Windows SmartScreen bloquea el instalador:

1. Hacer clic en "Más información"
2. Hacer clic en "Ejecutar de todos modos"
3. Si falla silenciosamente, ejecutar el .exe nuevamente

El instalador ahora muestra un mensaje explicativo si detecta este tipo de error.
