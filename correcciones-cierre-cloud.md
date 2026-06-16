# Correcciones a PROMPTS-CIERRE-CLOUD-FERREDESK.md

**Proyecto:** FerreDesk – Cierre Cloud Readiness  
**Documento auditado:** `PROMPTS-CIERRE-CLOUD-FERREDESK.md`  
**Fecha:** Junio 2026

> Veredicto general: este documento es notablemente mejor que el anterior. Las reglas de verificación son más exigentes, los criterios de evidencia son concretos, y el diseño en fases con gates explícitos es correcto. Sin embargo, hay siete puntos que o rompen cosas en producción o crean salidas de escape que el agente puede explotar para marcar tareas como completadas sin verificar el riesgo real.

---

## FC1-T1: Auditar readiness cloud real sin tocar código

**Estado: ✅ Correcto con una advertencia menor.**

El prompt está bien diseñado. Es de solo lectura, pide tabla con evidencia y prohíbe marcar tareas. El único punto débil es que el agente podría no tener acceso de lectura al archivo `ferredesk-progress.json` si no está en el path esperado (el JSON puede vivir en la raíz del repo o dentro de `ferredesk_v0/`). Sin instrucción de búsqueda, el agente puede asumir que no existe y saltear esa parte.

### Corrección mínima

Agregar al principio de las instrucciones:

```text
0. Antes de revisar los archivos listados, localiza ferredesk-progress.json con:
   find . -name "ferredesk-progress.json" -not -path "*/node_modules/*"
   Si no existe en la raíz del repo, buscarlo en ferredesk_v0/. Documenta la ruta real encontrada.
```

---

## FC2-T1: Migrar Render a deploy Docker consistente

**Estado: ⚠️ Problema en la verificación.**

El comando de verificación usa `Get-Content render.yaml` que es sintaxis de PowerShell (Windows). El agente ejecutor corre en Linux. En bash ese comando falla silenciosamente o no existe.

Segundo problema: el prompt dice "Definir una única raíz operativa para Render" pero no instruye explícitamente qué hacer si existen **dos** `render.yaml` (uno en la raíz del repo y otro en `ferredesk_v0/`). El agente puede eliminar el incorrecto, dejar ambos, o elegir el equivocado. Dado que el estado de partida del documento ya menciona que existe `ferredesk_v0/render.yaml`, la instrucción debería ser explícita sobre cuál conservar y cuál eliminar o ignorar.

Tercer punto: el build de Docker en la verificación no prueba que el **entrypoint** del contenedor sea el script productivo nuevo. El build puede pasar con el Dockerfile viejo que todavía referencia `start.sh`.

### Prompt corregido

```text
### Verificacion valida

1. Mostrar el contenido del render.yaml activo:
   cat render.yaml
   (Si existen dos archivos render.yaml, eliminar o renombrar el que queda inactivo y documentarlo.)

2. Confirmar que el render.yaml activo usa Docker:
   grep "env:" render.yaml  # no debe aparecer "env: python"
   grep "dockerfilePath\|image\|docker" render.yaml  # debe aparecer referencia a Docker

3. Buildear el Dockerfile referenciado:
   docker build -t ferredesk_render_test -f ferredesk_v0/Dockerfile ferredesk_v0

4. Confirmar que el entrypoint del contenedor apunta al script productivo:
   docker inspect ferredesk_render_test | grep -A5 "Entrypoint\|Cmd"
   El resultado debe referenciar start.prod.sh o el comando gunicorn directo, NO start.sh.

5. Confirmar healthCheckPath:
   grep "healthCheckPath" render.yaml  # debe decir /api/health/
```

---

## FC2-T2: Endurecer arranque productivo cloud

**Estado: ⚠️ El `rg` de verificación da falso negativo crítico.**

El comando:
```bash
rg -n "postgres|admin123|create_superuser|migrate --noinput|migrate_schemas|gunicorn" "ferredesk_v0/scripts"
```

busca **todas** esas cadenas en el mismo pass. Si el agente ve que `migrate_schemas` y `gunicorn` aparecen en el archivo, puede interpretar que el script está bien aunque `admin123` también aparezca en la misma línea. El criterio de éxito en el resultado esperado dice "el script no contiene `admin123`" pero eso requiere que el agente revise el output manualmente en vez de tener una verificación automatizable.

Segundo problema: el prompt dice "no esperar a `postgres:5432`" pero no verifica que `nc` o `wait-for-it` hayan sido eliminados. Un agente puede comentar la línea en lugar de eliminarla.

### Verificación corregida

```bash
# Verificaciones separadas con resultado explícito de pass/fail:

# 1. Confirmar que NO quedan comportamientos inseguros:
if grep -qE "admin123|create_superuser|nc postgres|wait-for-it" ferredesk_v0/scripts/start.prod.sh; then
  echo "FALLO: el script productivo contiene comportamiento inseguro"
else
  echo "OK: sin comportamientos inseguros"
fi

# 2. Confirmar que SÍ están los comportamientos requeridos:
grep "migrate_schemas" ferredesk_v0/scripts/start.prod.sh || echo "FALLO: migrate_schemas ausente"
grep "gunicorn" ferredesk_v0/scripts/start.prod.sh || echo "FALLO: gunicorn ausente"
grep "\${PORT" ferredesk_v0/scripts/start.prod.sh || echo "ADVERTENCIA: PORT no parametrizado"

# 3. Confirmar que el Dockerfile referencia el script correcto:
grep "start.prod.sh\|CMD\|ENTRYPOINT" ferredesk_v0/Dockerfile
```

---

## FC3-T1: Garantizar artefacto frontend servible por Django

**Estado: ⚠️ Riesgo de deploy vacío no cubierto.**

El prompt instruye a usar `RUN test -f /app/react_frontend/index.html` en el Dockerfile para fallar si falta el frontend. Esto está bien. Pero hay un escenario no cubierto: si el `npm run build` del Dockerfile **falla silenciosamente** (por ejemplo, por falta de memoria en el runner de Render o por un error de TypeScript que no está en modo `strict`), puede que el directorio `react_frontend/` se cree vacío o parcialmente lleno, y `index.html` exista pero los assets JS principales no.

Segundo problema: el prompt dice "Confirmar que `prod.py` apunte a `react_frontend` para templates y estáticos" pero no da el comando para verificarlo. El agente puede asumir que está bien sin chequearlo.

### Verificación adicional recomendada

Agregar al bloque de verificación:

```bash
# Verificar que el build de React generó assets JS (no solo index.html):
docker run --rm ferredesk_front_test sh -c \
  "ls /app/react_frontend/static/js/*.js 2>/dev/null | head -3 || echo 'FALLO: no hay assets JS'"

# Verificar que prod.py apunta al directorio correcto:
grep -n "react_frontend\|STATICFILES_DIRS\|TEMPLATES" \
  ferredesk_v0/backend/ferredesk_backend/settings/prod.py
```

---

## FC4-T1: Configurar SMTP de Resend solo en producción

**Estado: ⚠️ La verificación con variables faltantes es ambigua.**

El prompt dice "una segunda corrida controlada con variables faltantes para validar error explícito, no fallback silencioso". Esto está bien como concepto, pero no especifica cuál variable omitir para la prueba ni cómo ejecutarla de forma reproducible. El agente puede elegir omitir `EMAIL_PORT` (que tiene default `587`) en lugar de omitir `EMAIL_HOST_PASSWORD`, que es la variable crítica que realmente bloquearía el envío.

Segundo problema: la instrucción 5 dice "Hacer fallar de forma clara en prod si faltan variables críticas" pero no indica cómo implementar eso. Django no falla en startup si `EMAIL_HOST` es `None` — simplemente falla en tiempo de envío con un error críptico de socket. El agente necesita implementar validación explícita al inicio.

### Prompt con instrucciones adicionales

```text
5. Para que prod falle claramente al arrancar si faltan variables críticas, agregar
   al final de prod.py (DESPUÉS de definir las variables de email):

   _email_vars_requeridas = {
       "EMAIL_HOST": EMAIL_HOST,
       "EMAIL_HOST_USER": EMAIL_HOST_USER,
       "EMAIL_HOST_PASSWORD": EMAIL_HOST_PASSWORD,
       "DEFAULT_FROM_EMAIL": DEFAULT_FROM_EMAIL,
   }
   _faltantes = [k for k, v in _email_vars_requeridas.items() if not v]
   if _faltantes:
       raise ImproperlyConfigured(
           f"Variables de email requeridas en produccion: {', '.join(_faltantes)}"
       )

### Verificacion valida

1. Con env completo:
   python manage.py shell -c \
     "from django.conf import settings; print(settings.EMAIL_BACKEND)" \
     --settings=ferredesk_backend.settings.prod
   # Debe imprimir smtp.EmailBackend, NO console.EmailBackend

2. Con EMAIL_HOST_PASSWORD faltante (la variable más crítica):
   EMAIL_HOST_PASSWORD="" python manage.py check \
     --settings=ferredesk_backend.settings.prod 2>&1 | head -20
   # Debe mostrar ImproperlyConfigured, no arrancar silenciosamente

3. Confirmar que base.py NO tiene SMTP configurado:
   grep "EMAIL_BACKEND" ferredesk_v0/backend/ferredesk_backend/settings/base.py
   # Debe decir console o dummy, no smtp
```

---

## FC4-T2: Corregir links públicos HTTPS de onboarding y reset

**Estado: ⚠️ El `rg` genera falsos positivos garantizados.**

El comando:
```bash
rg -n "http://|localhost" "ferredesk_v0/backend" "ferredesk_v0/frontend"
```

va a retornar decenas de coincidencias legítimas que no son links productivos: comentarios en el código, configuración de desarrollo, URLs de Django en tests, el `localhost` del `DATABASES` de `base.py`, las URLs de `corsheaders` en tests. Si el agente ve muchos resultados, puede concluir que "hay varios pero no son del flujo de onboarding" sin chequearlo rigurosamente.

Además, el prompt dice "generar el email de activación o reset y mostrar el link sanitizado" pero no da el código exacto para hacerlo en el shell. El agente puede no saber cómo instanciar el servicio de email desde el shell y saltar ese paso.

### Verificación corregida

```bash
# 1. Buscar http:// SOLO en los archivos que construyen links de email:
rg -n "http://" \
  ferredesk_v0/backend/tenants/services/email_service.py \
  ferredesk_v0/backend/ferreapps/login/password_reset_service.py
# Resultado esperado: 0 coincidencias

# 2. Verificar que PUBLIC_BASE_URL o FRONTEND_URL están en uso:
rg -n "PUBLIC_BASE_URL\|FRONTEND_URL" \
  ferredesk_v0/backend/tenants/services/email_service.py
# Debe aparecer al menos una referencia

# 3. Probar la construcción del link desde el shell:
DJANGO_SETTINGS_MODULE=ferredesk_backend.settings.prod \
PUBLIC_BASE_URL=https://ferredesk.com \
python -c "
import django, os; django.setup()
from tenants.services.email_service import construir_link_activacion  # ajustar nombre real
link = construir_link_activacion('mi-tenant', 'token-de-prueba')
assert link.startswith('https://'), f'FALLO: link inseguro: {link}'
assert 'localhost' not in link, f'FALLO: link con localhost: {link}'
print(f'OK: {link}')
"
```

---

## FC5-T1: Asegurar settings productivos sin defaults inseguros

**Estado: ✅ Bien diseñado con una omisión importante.**

El criterio de dos corridas (con env completo y con variable faltante) es correcto y alineado con las reglas de verificación del documento. Sin embargo, falta una instrucción explícita sobre `SESSION_COOKIE_DOMAIN` que el mismo prompt menciona en las instrucciones pero no cierra: dice "La decisión debe quedar documentada" sin decir qué documentar.

Para subdominios dinámicos de tenants (`tenant1.ferredesk.com`, `tenant2.ferredesk.com`), `SESSION_COOKIE_DOMAIN` debe ser `.ferredesk.com` (con punto inicial para cubrir subdominios). Si no se configura esto, las cookies de sesión no se comparten entre subdominios ni se fuerzan al dominio correcto, lo que puede causar sesiones cruzadas entre el schema `public` y los tenants, o loops de login.

### Instrucción adicional recomendada

```text
5b. Para SESSION_COOKIE_DOMAIN, documentar explícitamente en prod.py mediante comentario:
    # Usar dominio padre con punto inicial para que las cookies apliquen
    # a todos los subdominios de tenants (tenant1.ferredesk.com, etc.)
    # Si el subdominio de staging es distinto, sobreescribir vía variable de entorno.
    SESSION_COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", ".ferredesk.com")
```

---

## FC6-T1: Reclasificar F11-T2 con evidencia actual

**Estado: ✅ Correcto.**

El diseño de bifurcación en tres outcomes (A/B/C) con tareas separadas (FC6-T2A, FC6-T2B, FC6-T2C) es el patrón correcto para una decisión con múltiples caminos. El prompt prohíbe usar `manage.py check` como prueba principal, lo cual está bien. No hay correcciones necesarias.

---

## FC6-T2B: Remover exposición pública del endpoint legacy

**Estado: ⚠️ Verificación incompleta.**

El `rg` busca `"vista-stock-producto|VistaStockProducto"` en todo el proyecto pero eso incluye el propio archivo de migraciones donde la vista SQL fue creada originalmente. El agente puede interpretar que "hay una referencia restante en migrations/0012_crear_vista.py" como un problema cuando en realidad está bien dejarla: las migraciones son históricas y no deben modificarse.

El prompt dice "No borrar migraciones en esta tarea" pero no aclara que las referencias en archivos de migración son esperadas en el resultado del `rg`. El agente puede confundirse y marcar la tarea como no completada, o peor, intentar editar la migración.

### Instrucción adicional

```text
NOTA IMPORTANTE: el rg puede retornar referencias a VistaStockProducto dentro de
archivos de migraciones (ferreapps/productos/migrations/). Esas referencias son
históricas y DEBEN permanecer. El criterio de éxito es que no queden referencias
en: views.py, urls.py, serializers.py, y el frontend (src/). Las migraciones
son la única excepción aceptable.
```

---

## FC7-T1: Probar /api/health/ con entrypoint productivo real

**Estado: ✅ Correcto.**

El prompt es uno de los mejor escritos del documento. Exige levantar el contenedor productivo real, no el servidor de dev, y pide evidencia de HTTP 200 real. No hay correcciones necesarias.

---

## FC8-T1: Smoke test de subida y lectura R2 por tenant

**Estado: ⚠️ El aislamiento entre tenants no está definido operativamente.**

El punto 6 dice "Validar que un segundo tenant no pueda acceder al archivo del primero" pero no dice **cómo probarlo**. Si el aislamiento es por path (tenant1/archivos/logo.png vs tenant2/archivos/logo.png), un segundo tenant técnicamente *sí* puede acceder al archivo del primero si conoce la URL, porque R2 con `AWS_QUERYSTRING_AUTH = False` sirve todos los objetos públicamente. El aislamiento real en ese caso no es control de acceso en R2, sino que los paths no se cruzan y la app no construye paths de otros tenants.

El prompt no distingue entre estos dos tipos de aislamiento, lo que puede llevar al agente a no hacer ninguna prueba real o a concluir incorrectamente que hay una vulnerabilidad cuando no la hay.

### Instrucción adicional

```text
6. Para validar aislamiento, la prueba correcta depende de la estrategia de acceso:
   a. Si los archivos son PÚBLICOS (AWS_QUERYSTRING_AUTH = False):
      El aislamiento es por path, no por permiso. Verificar que:
      - la app nunca construye paths de tenants ajenos
      - un usuario del Tenant B no puede obtener la URL de un archivo del Tenant A
        a través de ningún endpoint de la API
      Prueba: autenticarse como usuario de Tenant B e intentar hacer GET al
      endpoint que serviría el archivo de Tenant A. Debe retornar 403 o 404.
   b. Si los archivos son PRIVADOS (AWS_QUERYSTRING_AUTH = True):
      Intentar acceder a la URL firmada de Tenant A desde Tenant B.
      La URL firmada debe expirar o ser inaccesible desde otro contexto.
   Documentar cuál de los dos aplica y cuál fue la prueba ejecutada.
```

---

## FC9-T1: Smoke test de activación y password reset con Resend

**Estado: ✅ Correcto.**

El prompt pide evidencia real de entrega, verifica `https`, verifica ausencia de `localhost` y de host interno de Render, y prohíbe registrar tokens completos. El formato de tabla de evidencia es concreto. No hay correcciones necesarias.

---

## FC10-T1: Smoke test cloud completo con tenant aislado

**Estado: ⚠️ El punto 13 es inverificable como está escrito.**

"Assets estáticos resueltos" es un criterio demasiado amplio. En producción con Django sirviendo el build de React, los assets estáticos pueden fallar por: ruta de `collectstatic` mal configurada, `STATIC_URL` incorrecto, whitenoise no configurado, o el contenedor que no ejecutó `collectstatic` en el build. El agente puede verificar que el frontend carga sin ver la consola del navegador, donde los 404 de assets suelen aparecer silenciosamente.

Segundo punto: la "Validación de aislamiento 1" dice `Ferreteria.objects.first()` devuelve una sola fila por schema, pero ese comando ejecutado en el schema equivocado puede devolver la ferretería de otro tenant sin que el agente lo note. La prueba necesita especificar desde qué contexto de tenant se ejecuta.

### Instrucciones adicionales

```text
13b. Para verificar assets estáticos explícitamente:
   curl -I https://<host>/static/js/main.<hash>.js
   # Debe retornar HTTP 200, no 404
   Si no se conoce el hash, obtenerlo del index.html:
   curl -s https://<host>/ | grep -o 'src="/static/js/[^"]*"' | head -3

Validación de aislamiento 1 (corrección):
   # Ejecutar desde el contexto explícito de cada tenant:
   python manage.py shell --settings=ferredesk_backend.settings.prod
   >>> from django_tenants.utils import schema_context
   >>> with schema_context('tenant_a'):
   ...     from ferreapps.ferreteria.models import Ferreteria
   ...     print(Ferreteria.objects.count(), Ferreteria.objects.first().nombre)
   >>> with schema_context('tenant_b'):
   ...     print(Ferreteria.objects.count(), Ferreteria.objects.first().nombre)
   # Cada schema debe retornar exactamente 1 fila con su propio nombre
```

---

## FC11-T1: Documentar rollback cloud mínimo

**Estado: ⚠️ Falta el escenario más probable.**

La tabla de escenarios pide cubrir rollback en Render, base de datos, R2 y secretos, pero omite el escenario más probable en un primer deploy SaaS: **tenant creado durante el smoke test que queda huérfano si se hace rollback**. Si se hace rollback del código pero el schema `tenant_prueba` quedó creado en la base de datos de producción, ese schema interfiere con el siguiente deploy y puede causar errores en `migrate_schemas`.

### Instrucción adicional

```text
7. Documentar procedimiento para limpiar tenants de prueba creados durante staging:
   - Listar tenants existentes: SELECT schema_name FROM public.django_tenants_client;
   - Eliminar tenant de prueba: python manage.py delete_tenant <schema_name>
     (o el equivalente manual con DROP SCHEMA IF EXISTS <schema> CASCADE)
   - Confirmar que el schema fue eliminado y no aparece en la tabla de clientes
   Este procedimiento aplica entre el smoke test de staging y el deploy a producción real.
```

---

## FC12-T1: Emitir decisión MERGEABLE o NO MERGEABLE

**Estado: ✅ Correcto.**

La lista de 24 puntos de evidencia es completa y el formato de output fuerza a que el agente sea explícito sobre blockers, riesgos aceptados y evidencia faltante. El criterio "solo `MERGEABLE` si no quedan blockers reales ni evidencia faltante en gates críticos" cierra la puerta a compromisos. No hay correcciones necesarias.

---

## Resumen ejecutivo

| Tarea | Estado | Problema principal |
|---|---|---|
| FC1-T1 | ✅ Correcto | Agregar búsqueda de ruta de progress.json |
| FC2-T1 | ⚠️ Incompleto | Get-Content es PowerShell; no verifica entrypoint del contenedor |
| FC2-T2 | ⚠️ Incompleto | El rg de verificación no separa pass/fail; no detecta líneas comentadas |
| FC3-T1 | ⚠️ Incompleto | No verifica assets JS, solo index.html; falta verificar prod.py |
| FC4-T1 | ⚠️ Incompleto | La corrida con variable faltante no especifica cuál omitir; falta implementación de ImproperlyConfigured |
| FC4-T2 | ⚠️ Incompleto | El rg genera falsos positivos masivos; falta código exacto para probar en shell |
| FC5-T1 | ✅ Con omisión | SESSION_COOKIE_DOMAIN no tiene instrucción concreta de implementación |
| FC6-T1 | ✅ Correcto | — |
| FC6-T2A | ✅ Correcto | — |
| FC6-T2B | ⚠️ Incompleto | No aclara que referencias en migraciones son esperadas y no deben eliminarse |
| FC6-T2C | ✅ Correcto | — |
| FC7-T1 | ✅ Correcto | — |
| FC8-T1 | ⚠️ Incompleto | No define qué tipo de aislamiento aplica ni cómo probarlo concretamente |
| FC9-T1 | ✅ Correcto | — |
| FC10-T1 | ⚠️ Incompleto | Assets estáticos sin verificación real; aislamiento sin contexto de schema |
| FC11-T1 | ⚠️ Incompleto | Falta escenario de tenants de prueba huérfanos tras rollback |
| FC12-T1 | ✅ Correcto | — |

**Proporción:** 7 correctos, 8 con problemas, 2 críticos (FC2-T1 por comando inexistente, FC4-T2 por falsos positivos masivos que ocultan el riesgo real).

**Diferencia con el documento anterior:** este documento ya incorporó muchas de las lecciones que faltaban en PROMPTS-FASES-CLOUD-READINESS. Las reglas de verificación al inicio del documento son exactamente las correcciones que se necesitaban. Los problemas restantes son más sutiles: comandos que funcionan en un SO pero no en otro, greps que pasan aunque el riesgo siga presente, y escenarios de borde específicos de django-tenants que el prompt no anticipa.
