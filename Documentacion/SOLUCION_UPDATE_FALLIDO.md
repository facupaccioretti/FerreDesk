# Solución para Update Fallido

## Problema

Cuando `update.bat` falla durante la construcción del frontend, el repositorio git ya ha sido actualizado a `origin/main`. Si intentas correr `update.bat` nuevamente, detectará que estás en la "última versión" y no hará nada.

**Causas comunes del fallo del build:**
- Dependencias de Node.js incompatibles
- Problemas de memoria RAM insuficiente en Docker
- Caché corrupta de Docker
- Cambios incompatibles en el código frontend
- Problemas de espacio en disco

## Soluciones

### Solución 1: Script de Recuperación (Recomendado)

Hemos creado el script `recover-update.bat` que fuerza una reconstrucción completa sin caché:

```batch
recover-update.bat
```

Este script:
1. Detiene todos los servicios
2. Limpia completamente el caché de Docker
3. Elimina las imágenes antiguas
4. Reconstruye todo desde cero SIN caché
5. Verifica que el build sea exitoso

**Uso:** Ejecuta este script cuando `update.bat` haya fallado.

---

### Solución 2: Update Mejorado con Rollback Automático

El `update.bat` ahora incluye mejoras:

1. **Guarda el commit actual antes de actualizar** - Si algo falla, puede hacer rollback
2. **Verifica que el build sea exitoso** - Chequea que el frontend se haya construido correctamente
3. **Rollback automático** - Si el build falla, revierte automáticamente a la versión anterior
4. **Mensajes claros** - Indica exactamente qué hacer si hay problemas

Si el update falla, se restaurará automáticamente la versión anterior.

---

### Solución 3: Limpieza Manual Completa

Si los scripts anteriores no funcionan, puedes hacer una limpieza completa:

```batch
# 1. Limpiar todo (CUIDADO: Elimina datos)
clean.bat

# 2. Reinstalar desde cero
install.bat
```

**⚠️ ADVERTENCIA:** Esto eliminará todos los datos de la aplicación. Solo úsalo como último recurso.

---

### Solución 4: Verificación Manual del Build

Si quieres ver exactamente qué está fallando:

```batch
# 1. Ver logs del contenedor
docker-compose logs -f ferredesk

# 2. Ver logs específicos del frontend
docker-compose logs ferredesk | findstr /C:"frontend"

# 3. Entrar al contenedor y verificar
docker exec -it ferredesk_app bash
ls -la /app/frontend/build/
exit

# 4. Rebuild manual con logs detallados
docker-compose down
docker-compose build --no-cache ferredesk
docker-compose up -d
```

---

## Previniendo Problemas en el Futuro

### Mejores Prácticas

1. **Espacio en disco**: Asegúrate de tener al menos 5GB libres
2. **RAM de Docker**: Configura Docker Desktop con mínimo 4GB RAM
3. **Backup de .env**: El script ya hace backup automático
4. **Verificar logs**: Siempre revisa los logs si hay problemas

### Verificación Pre-Update

Antes de actualizar, verifica:

```batch
# Verificar espacio en disco
dir c:\

# Verificar RAM disponible
systeminfo | findstr "Memoria física"

# Verificar Docker funciona correctamente
docker info
docker ps

# Ver estado actual
git log --oneline -1
```

---

## Diagnóstico de Problemas Comunes

### Error: "npm run build failed"

**Causa:** Problemas con dependencias de Node.js o memoria insuficiente

**Solución:**
```batch
# Aumentar memoria en Docker Desktop
# Settings > Resources > Memory > 4GB minimo

# Limpiar y reconstruir
recover-update.bat
```

### Error: "Error al reconstruir servicios"

**Causa:** Imágenes Docker corruptas o caché vieja

**Solución:**
```batch
# Limpiar caché Docker
docker builder prune -af

# Reconstruir
recover-update.bat
```

### Error: "Already up-to-date" cuando no lo está

**Causa:** Git ya actualizado pero Docker no reconstruido

**Solución:**
```batch
# Forzar rebuild
docker-compose down
docker-compose up --build -d
```

### Error: "Port already in use"

**Causa:** Contenedores de una actualización anterior todavía corriendo

**Solución:**
```batch
# Detener todo
docker-compose down

# Verificar no hay containers huérfanos
docker ps -a

# Eliminar containers huérfanos si existen
docker rm ferredesk_app ferredesk_postgres

# Intentar nuevamente
recover-update.bat
```

---

## Contacto y Soporte

Si después de intentar todas estas soluciones el problema persiste:

1. Recolecta los logs: `docker-compose logs > logs.txt`
2. Verifica el commit actual: `git log --oneline -1`
3. Documenta el error exacto
4. Contacta al equipo de desarrollo con esta información

---

## Changelog

### v2.1 (Actual)
- ✅ Agregado backup de commit antes de actualizar
- ✅ Verificación automática de build frontend
- ✅ Rollback automático si el build falla
- ✅ Script `recover-update.bat` para recuperación forzada
- ✅ Mejor manejo de errores y mensajes informativos

### v2.0 (Anterior)
- ✅ Update básico con Docker
- ✅ Restauración automática de .env
- ⚠️ No verificaba si el build era exitoso
- ⚠️ No tenía rollback automático

