# FerreDesk Installer v1.0.0 - QA Checklist

## Pre-requisitos

- [ ] Windows 10/11 64-bit
- [ ] Conexión a internet
- [ ] Imagen `lautajuare/ferredesk:latest` publicada en Docker Hub
- [ ] Archivos del instalador:
  - [ ] `ferredesk-1.0.0.ps1`
  - [ ] `ferredesk-1.0.0-installer.iss`
  - [ ] `FerreDesk.ico`
  - [ ] `FerredeskIconBig.bmp`

---

## Test 1: Instalación Limpia (sin Docker)

**Escenario**: PC sin Docker Desktop instalado

### Pasos:
1. [ ] Desinstalar Docker Desktop si existe
2. [ ] Eliminar `C:\ProgramData\FerreDesk` si existe
3. [ ] Compilar ISS: `iscc ferredesk-1.0.0-installer.iss`
4. [ ] Ejecutar `FerreDesk-1.0.0-Setup.exe`

### Verificar Fase 1:
- [ ] Chocolatey se instala
- [ ] Docker Desktop se instala
- [ ] Mensaje de reinicio aparece
- [ ] RunOnce se registra

### Después del reinicio:
- [ ] Instalador se ejecuta automáticamente
- [ ] Fase 2 detecta Docker Desktop
- [ ] Fase 3 descarga imagen
- [ ] Servicios inician
- [ ] Navegador abre http://localhost:8000
- [ ] Login con admin/admin123 funciona

---

## Test 2: Instalación con Docker Pre-existente

**Escenario**: Docker Desktop ya instalado y funcionando

### Pasos:
1. [ ] Asegurar Docker Desktop corriendo
2. [ ] Ejecutar instalador
3. [ ] No debe requerir reinicio
4. [ ] Fase 1 → Fase 2 → Fase 3 directo

### Verificar:
- [ ] Imagen se descarga (~500MB)
- [ ] `.env` generado con SECRET_KEY única
- [ ] `docker-compose.yml` creado
- [ ] `docker ps` muestra 2 contenedores
- [ ] Aplicación accesible

---

## Test 3: Configuración Persistente

### Pasos:
1. [ ] Completar instalación
2. [ ] Anotar SECRET_KEY del `.env`
3. [ ] `docker compose down`
4. [ ] Ejecutar instalador nuevamente

### Verificar:
- [ ] `.env` NO se sobrescribe
- [ ] SECRET_KEY es la misma
- [ ] Servicios reinician correctamente

---

## Test 4: Desinstalación

### Pasos:
1. [ ] Ir a "Agregar o quitar programas"
2. [ ] Desinstalar FerreDesk

### Verificar:
- [ ] Contenedores se detienen
- [ ] Volúmenes Docker se eliminan
- [ ] Directorio `ferredesk` se elimina
- [ ] `C:\ProgramData\FerreDesk` se elimina
- [ ] Registro limpio

---

## Test 5: SmartScreen/Antivirus

### Pasos:
1. [ ] Ejecutar instalador en PC nueva
2. [ ] Si SmartScreen bloquea → clic "Más información" → "Ejecutar de todos modos"
3. [ ] Si falla silenciosamente → re-ejecutar .exe

### Verificar:
- [ ] Mensaje de error menciona SmartScreen
- [ ] Sugiere re-ejecutar el .exe

---

## Test 6: Resume después de Reinicio

### Pasos:
1. [ ] Ejecutar instalador (sin Docker)
2. [ ] Esperar mensaje de reinicio
3. [ ] Reiniciar manualmente (no automático)
4. [ ] Verificar que instalador continúa

### Verificar:
- [ ] RunOnce ejecuta el instalador
- [ ] Instalador detecta Fase 2 pendiente
- [ ] Continúa sin repetir Fase 1

---

## Test 7: Verificación de Servicios

### Comandos:
```powershell
cd C:\Users\{user}\AppData\Local\Programs\FerreDesk\ferredesk

# Ver contenedores
docker compose ps

# Ver logs
docker compose logs

# Reiniciar
docker compose restart

# Detener
docker compose down

# Iniciar
docker compose up -d
```

### Verificar:
- [ ] 2 contenedores: `ferredesk_app`, `ferredesk_postgres`
- [ ] Estado: "Up"
- [ ] Puertos: 8000, 5433

---

## Resultado Final

| Test | Resultado | Notas |
|------|-----------|-------|
| Test 1: Instalación Limpia | ⬜ | |
| Test 2: Docker Pre-existente | ⬜ | |
| Test 3: Config Persistente | ⬜ | |
| Test 4: Desinstalación | ⬜ | |
| Test 5: SmartScreen | ⬜ | |
| Test 6: Resume | ⬜ | |
| Test 7: Servicios | ⬜ | |

**Aprobado**: ⬜ Sí / ⬜ No

**Probado por**: _________________

**Fecha**: _________________
