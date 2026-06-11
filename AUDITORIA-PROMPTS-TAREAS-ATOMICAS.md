# Auditoría de `PROMPTS-TAREAS-ATOMICAS.md`

## Objetivo

Este documento compara `PROMPTS-TAREAS-ATOMICAS.md` contra:

- `DECISIONES-V1-SAAS-MULTITENANCY.md`
- `PLAN-TECNICO-V1-SAAS-MULTITENANCY.md`
- el estado real observado durante la migración

La pregunta a responder es:

1. si los prompts atómicos cubren correctamente el plan de inicio a fin;
2. qué partes están bien;
3. qué partes están subespecificadas o directamente ausentes;
4. cómo debería redactarse la instrucción faltante.

## Resumen ejecutivo

El plan técnico es coherente, pero `PROMPTS-TAREAS-ATOMICAS.md` no lo traduce completo a tareas accionables de extremo a extremo.

El patrón general es:

- **Fases 1 a 3:** bastante bien cubiertas, aunque con algunos huecos de transición.
- **Fase 4:** cobertura parcial. Solo `F4-T4` está detallada.
- **Fases 5 a 10:** cobertura incompleta. El archivo reconoce que esas fases “siguen el mismo patrón”, pero en la práctica no da prompts atómicos suficientes.

Conclusión operativa:

- **Sí**, si se completa el plan técnico real, el sistema debería quedar bien al final.
- **No**, seguir solo `PROMPTS-TAREAS-ATOMICAS.md` tal como está hoy no garantiza por sí solo que no queden huecos funcionales.

## Criterio de lectura

Para cada tarea marco uno de estos estados:

- `Correcto`: el prompt está alineado con el plan y es suficientemente ejecutable.
- `Subespecificado`: la dirección es correcta, pero faltan condiciones, validaciones o aclaraciones críticas.
- `Ausente`: existe el ID de tarea, pero no hay prompt atómico utilizable en el archivo.

---

## Fase 1

### F1-T1

- Estado: `Correcto`
- Comentario:
  El prompt está bien alineado con el plan. Define alcance, restricción y evidencia.

### F1-T2

- Estado: `Correcto`
- Comentario:
  El modelo `Sucursal` queda bien encuadrado como preparación V1 sin expandir la lógica de negocio.

### F1-T3

- Estado: `Correcto`
- Comentario:
  La evidencia pedida es suficiente.

---

## Fase 2

### F2-T1

- Estado: `Correcto`
- Comentario:
  La incorporación de `django-tenants` está bien acotada.

### F2-T2

- Estado: `Correcto`
- Comentario:
  La separación entre `SHARED_APPS` y `TENANT_APPS` está bien pedida.

### F2-T3

- Estado: `Subespecificado`
- Falta:
  El prompt cubre `ALLOWED_HOSTS`, `SESSION_COOKIE_DOMAIN`, `CSRF` y `CORS`, pero no deja explícito que esto **no resuelve** por sí mismo el problema del frontend dev server ni del proxy por subdominio.
- Riesgo observado:
  Puede dar la falsa impresión de que con backend configurado ya debería funcionar `tenant.localhost:3000`.
- Cómo agregaría la instrucción:

```md
Agregar advertencia explícita:
- Esta tarea solo deja listo el backend para subdominios locales.
- NO resuelve todavía el proxy del frontend dev server.
- La prueba de `tenant.localhost:3000` se considera pendiente hasta F9-T1/F9-T2.
```

### F2-T4

- Estado: `Correcto`
- Comentario:
  Está alineado con las decisiones V1.

### F2-T5

- Estado: `Subespecificado`
- Falta:
  El prompt dice que `urls_public.py` es para el esquema public, pero no prohíbe explícitamente exponer login/register legacy ahí.
- Riesgo observado:
  Si `public` muestra SPA con `/login` o `/register` legacy, aparece el problema de “usuario global” que ya no aplica al modelo SaaS.
- Cómo agregaría la instrucción:

```md
Agregar restricción explícita:
- El esquema `public` NO debe exponer flujos legacy de ERP (`/api/login/`, `/api/usuarios/register/`) salvo que se definan expresamente como administración interna de plataforma.
- Si se usa una landing placeholder, debe representar plataforma SaaS, no login de negocio legacy.
```

### F2-T6

- Estado: `Subespecificado`
- Falta:
  Mantener `urls.py` tenant “como está” es correcto para compatibilidad, pero falta aclarar que esto deja intencionalmente vivo un login ERP que solo aplica dentro de tenants.
- Cómo agregaría la instrucción:

```md
Agregar nota:
- Las rutas de login aquí siguen siendo tenant-only.
- No asumir que sirven para `public`.
- Documentar explícitamente esa diferencia en un comentario del archivo.
```

### F2-T7

- Estado: `Correcto`
- Comentario:
  Buena verificación de arranque base.

---

## Fase 3

### F3-T1

- Estado: `Correcto`

### F3-T2

- Estado: `Correcto`

### F3-T3

- Estado: `Correcto`

### F3-T4

- Estado: `Correcto`

### F3-T5

- Estado: `Correcto`

### F3-T6

- Estado: `Subespecificado`
- Falta:
  El servicio crea tenant, dominio y usuario, pero el prompt no fuerza a dejar claro si el usuario admin inicial es un usuario de tenant normal o un `superuser`.
- Riesgo observado:
  Puede mezclarse el concepto de admin funcional del negocio con admin técnico de Django.
- Cómo agregaría la instrucción:

```md
Agregar validación explícita:
- Verificar que el usuario inicial del tenant se crea con `is_staff=False` e `is_superuser=False`.
- Verificar que la cuenta administrativa global de plataforma no se usa para login del tenant.
```

### F3-T7

- Estado: `Correcto`

### F3-T8

- Estado: `Subespecificado`
- Falta:
  El prompt explica cómo crear el tenant `public`, pero no contempla el caso de base legacy preexistente ni define la expectativa final de tablas en `public`.
- Riesgo observado:
  Puede quedar la duda de si `public` se crea “como otro tenant” o como schema shared real.
- Cómo agregaría la instrucción:

```md
Agregar aclaración:
- Si la base es legacy y ya contiene tablas ERP en `public`, no usar esa condición como evidencia de arquitectura final.
- La verificación de esta tarea debe basarse en una DB limpia o en la separación real de `SHARED_APPS` vs `TENANT_APPS`.
- Confirmar expresamente que `public` queda destinado a plataforma SaaS y que las apps `ferreapps.*` no deben recrearse en `public` en una base nueva.
```

### F3-T9

- Estado: `Subespecificado`
- Falta:
  El prompt pide crear un tenant de prueba, pero no fuerza a verificar el hostname exacto ni la separación entre login `public` y login tenant.
- Cómo agregaría la instrucción:

```md
Agregar:
- El dominio de prueba debe quedar documentado, por ejemplo `ferretest.localhost`.
- Verificar por shell que el usuario creado existe en el schema tenant y no en `public`.
- Dejar explícito que `python manage.py createsuperuser` fuera del tenant no sirve como login del tenant.
```

---

## Fase 4

### F4-T1

- Estado: `Ausente`
- Falta según el plan:
  La fase 4 necesita prompts concretos para:
  - creación/verificación del admin del tenant;
  - creación/verificación de `Ferreteria`;
  - creación/verificación de `Sucursal`;
  - seeds mínimos.
- Cómo agregaría la instrucción:

```md
## F4-T1: Verificar usuario admin inicial del tenant
- Confirmar que se crea dentro del schema tenant.
- Confirmar `tipo_usuario='admin'`.
- Confirmar `is_staff=False` e `is_superuser=False`.
- Confirmar que no depende de `createsuperuser` del schema `public`.
```

### F4-T2

- Estado: `Ausente`
- Cómo agregaría la instrucción:

```md
## F4-T2: Verificar Ferreteria inicial única
- Confirmar que existe exactamente una fila.
- Confirmar que sus datos mínimos son compatibles con setup posterior.
- Confirmar que `request.user.ferreteria` puede resolver esa fila.
```

### F4-T3

- Estado: `Ausente`
- Cómo agregaría la instrucción:

```md
## F4-T3: Verificar Sucursal default
- Confirmar que existe exactamente una sucursal.
- Confirmar `es_principal=True` y `activa=True`.
- Confirmar que no se crean duplicados al reintentar la inicialización.
```

### F4-T4

- Estado: `Subespecificado`
- Lo que está bien:
  Verifica login, APIs y conteos.
- Lo que falta:
  No fuerza a distinguir entre:
  - login del admin tenant;
  - `createsuperuser` del schema `public`;
  - login legacy en `public`.
- Cómo agregaría la instrucción:

```md
Agregar:
- La prueba debe hacerse usando el host tenant real, no `127.0.0.1`.
- Aclarar que un `createsuperuser` ejecutado en `public` no es evidencia válida para login tenant.
```

---

## Fase 5

### F5-T1 a F5-T6

- Estado: `Ausente`
- Falta según el plan:
  La fase 5 es crítica y hoy no tiene prompts atómicos completos en el archivo.
- Por qué importa:
  `RutaPrivada`, gating, setup mínimo y redirección post-login son parte central del comportamiento final.
- Cómo agregaría las instrucciones:

```md
## F5-T1: Definir criterio backend de setup completo
## F5-T2: Crear endpoint de estado de setup
## F5-T3: Adaptar FerreteriaAPIView o servicio de validación
## F5-T4: Adaptar RutaPrivada al estado de setup
## F5-T5: Bloquear módulos críticos antes de setup
## F5-T6: Verificar flujo completo login -> setup -> desbloqueo
```

Cada una debería tener:

- archivo objetivo;
- contrato esperado;
- evidencia real con output;
- host tenant concreto;
- diferencia entre `public` y tenant.

---

## Fase 6

### F6-T1

- Estado: `Correcto`
- Comentario:
  Está bien especificado y además ataca un riesgo crítico real.

### F6-T2 a F6-T5

- Estado: `Ausente`
- Falta según el plan:
  No alcanza con corregir `upload_to`. También faltan prompts para:
  - `_normalizar_logo_empresa`;
  - señales en `ventas/signals.py`;
  - serving de `logo_empresa` por tenant;
  - pruebas de colisión entre tenants.
- Cómo agregaría la instrucción:

```md
## F6-T2: Aislar normalización de `logo_empresa`
## F6-T3: Corregir paths y limpieza en `ventas/signals.py`
## F6-T4: Ajustar views de serving de logos y archivos
## F6-T5: Verificar dos tenants con archivos distintos sin colisión
```

---

## Fase 7

### F7-T1

- Estado: `Correcto`

### F7-T2

- Estado: `Ausente`
- Falta:
  Restore o validación estructural del dump por schema.
- Cómo agregaría la instrucción:

```md
## F7-T2: Verificar contenido de backup por schema
- Confirmar que un backup de tenant A no contiene tablas/datos de tenant B.
- Confirmar el nombre del archivo con schema.
```

### F7-T3

- Estado: `Ausente`
- Falta:
  Definición concreta del comportamiento en `public`.
- Cómo agregaría la instrucción:

```md
## F7-T3: Definir política de backup para `public`
- Decidir si se permite backup del schema `public` o si se rechaza.
- Mostrar evidencia del comportamiento elegido.
```

---

## Fase 8

### F8-T1 a F8-T7

- Estado: `Ausente`
- Falta según el plan:
  Esta es una de las fases más subespecificadas del archivo.
- Problemas reales observados que dependen de esta fase:
  - `Register` sigue creando un usuario global legacy;
  - `Login` sigue siendo tenant login pero la UI pública no lo refleja;
  - `localhost:3000` puede quedar mostrando pantallas legacy no compatibles con SaaS.
- Cómo agregaría la instrucción:

```md
## F8-T1: Diseñar API pública de onboarding SaaS
## F8-T2: Implementar alta de tenant desde `public`
## F8-T3: Reemplazar `Register.js` legacy por onboarding SaaS
## F8-T4: Adaptar `Landing.js` a plataforma SaaS
## F8-T5: Revisar `App.js` y rutas públicas vs tenant
## F8-T6: Revisar `Login.js` para que solo represente login tenant
## F8-T7: Verificar flujo público -> creación tenant -> redirección subdominio -> login -> setup
```

En particular, `F8-T3` debería decir explícitamente:

```md
- El register actual NO debe seguir creando un simple usuario global.
- Debe crear un negocio/tenant, su dominio y su admin inicial.
```

---

## Fase 9

### F9-T1

- Estado: `Ausente`
- Falta según el plan:
  El problema del proxy local está reconocido en el plan técnico, pero no traducido a prompt atómico explícito.
- Cómo agregaría la instrucción:

```md
## F9-T1: Reemplazar proxy simple del frontend
- Quitar `proxy` fijo de `package.json`.
- Crear `frontend/src/setupProxy.js` o equivalente.
- Preservar el host del navegador para que `tenant.localhost:3000` proxyee a `tenant.localhost:8000`.
```

### F9-T2

- Estado: `Ausente`
- Cómo agregaría la instrucción:

```md
## F9-T2: Ajustar dev server para subdominios locales
- Permitir `allowedHosts = "all"`.
- Hacer que el dev server escuche en `0.0.0.0`.
- Verificar acceso real a `tenant.localhost:3000`.
```

### F9-T3

- Estado: `Ausente`
- Cómo agregaría la instrucción:

```md
## F9-T3: Verificar cookies, CSRF y sesión entre frontend dev y backend tenant
- Probar login desde `tenant.localhost:3000`.
- Confirmar que `/api/user/` responde 200 con sesión válida.
```

### F9-T4

- Estado: `Ausente`
- Cómo agregaría la instrucción:

```md
## F9-T4: Validar matriz local completa con dos hosts tenant
- tenant A y tenant B aislados
- sin usar `127.0.0.1` como host principal de tenant
```

---

## Fase 10

### F10-T1 a F10-T9

- Estado: `Ausente`
- Falta según el plan:
  La validación integral está muy bien definida en `PLAN-TECNICO`, pero casi no fue bajada a prompts atómicos.
- Consecuencia:
  Sin prompts concretos, la fase de cierre queda débil justo donde más evidencia hace falta.
- Cómo agregaría la instrucción:

```md
## F10-T1: Autenticación multi-tenant
## F10-T2: Setup y gating
## F10-T3: Ventas
## F10-T4: Productos
## F10-T5: Clientes/Compras/Caja
## F10-T6: ARCA
## F10-T7: Archivos
## F10-T8: Backup
## F10-T9: Public SaaS y onboarding
```

Cada una debería exigir:

- host concreto probado;
- schema concreto probado;
- output real;
- casos de tenant A / tenant B cuando aplique;
- rechazo explícito de “debería funcionar”.

---

## Conclusión final

### Lo correcto del archivo actual

- Fases 1 a 3 están razonablemente bien planteadas.
- Los prompts críticos de `F4-T4`, `F6-T1` y `F7-T1` apuntan a riesgos reales.
- El orden general es coherente con el plan.

### Lo que hoy falta

- traducir de verdad las fases 5, 8, 9 y 10 a prompts ejecutables;
- explicitar que `Register` legacy ya no es válido como flujo SaaS;
- explicitar la diferencia entre admin global `public` y admin funcional tenant;
- explicitar el comportamiento esperado del frontend local con subdominios;
- explicitar el tratamiento de `public` como plataforma y no como ERP legacy.

### Recomendación práctica

No hace falta reescribir el plan técnico.  
Lo que hace falta es **completar `PROMPTS-TAREAS-ATOMICAS.md`** para que refleje con precisión lo que el plan ya define y lo que la implementación real mostró como puntos sensibles.

