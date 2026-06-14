# FerreDesk — Reglas del Agente

## Contexto del proyecto

ERP/POS Django + React migrando a SaaS multi-tenant con `django-tenants`.

- **Stack:** Django 5.0.1, DRF 3.14, PostgreSQL, React (CRA), Whitenoise.
- **Deploy:** Render (staging y prod).
- **Auth actual:** Sesiones Django (se mantiene en V1).
- **Custom user model:** `ferreapps.usuarios.Usuario` (AbstractUser con `tipo_usuario` y FK a `Ferreteria`).
- **Modelo clave:** `Ferreteria` (en `ferreapps.productos.models`) = configuración comercial/fiscal del negocio. No renombrar en V1.
- **Settings:** `settings/base.py` → `settings/dev.py` / `settings/prod.py` (herencia).
- **Frontend:** SPA React con `react-router-dom`, rutas relativas `/api/...`. Usa Tailwind utilities vía clases.

## Principio único más importante

**AISLAMIENTO ANTES QUE CONVENIENCIA.** Si una decisión reduce trabajo pero deja posibilidad de fuga entre tenants, se rechaza.

## Lo que NO se toca en V1

- No migrar a JWT.
- No renombrar `Ferreteria` masivamente.
- No implementar multi-sucursal funcional profunda.
- No dejar `ALLOWED_HOSTS = ["*"]` en prod.
- No billing real.
- No custom domains.
- No emails automáticos.
- No rediseñar permisos completos.

## Orden de fases (no alterar sin justificación técnica)

1. Preparación y compatibilidad base
2. Núcleo multi-tenant (settings, middleware, DATABASE engine)
3. App `tenants` + modelos en `public`
4. Inicialización de tenant (Ferreteria, Sucursal, admin)
5. Setup obligatorio y gating funcional
6. Media/archivos aislados por tenant
7. Backup por schema
8. Frontend SaaS y subdominios
9. Entorno local y staging wildcard
10. Verificación integral (checklist transversal)

## Estructura de archivos clave

### Backend
```
ferredesk_v0/backend/
├── ferredesk_backend/
│   ├── settings/ (base.py, dev.py, prod.py)
│   ├── urls.py           (tenant URLs — ERP)
│   ├── urls_public.py    (NUEVO — public schema URLs)
│   └── utils/
├── ferreapps/
│   ├── usuarios/         (Usuario model, login)
│   ├── productos/        (Ferreteria, Stock, Producto, etc.)
│   ├── ventas/           (signals.py con normalización ARCA)
│   ├── clientes/
│   ├── compras/
│   ├── caja/
│   ├── cuenta_corriente/
│   ├── sistema/          (backup_service.py)
│   ├── informes/
│   ├── alertas/
│   ├── notas/
│   ├── reservas/
│   ├── proveedores/
│   ├── codigo_barras/
│   └── utils/
├── tenants/              (NUEVO — app de plataforma SaaS)
├── requirements.txt
└── manage.py
```

### Frontend
```
ferredesk_v0/frontend/src/
├── App.js
├── components/
│   ├── Landing.js
│   ├── Login.js
│   ├── Register.js
│   ├── RutaPrivada.js
│   ├── AsistenteConfiguracion/
│   ├── Home.js
│   └── ... (módulos ERP)
└── hooks/
```

## Patrones existentes que respetar

- `Ferreteria.objects.first()` se usa extensivamente → garantizar una sola fila por tenant schema.
- `request.user.ferreteria` se usa para acceder a config del negocio.
- Seeds de datos base (comprobantes, alícuotas IVA, listas de precios, métodos de pago) ya existen en migraciones.
- `RutaPrivada` ya verifica autenticación + estado de configuración via `/api/ferreteria/`.
- `AsistenteConfiguracion` ya existe como componente de setup.
- Backup actual hace `pg_dump` de DB completa → debe cambiar a schema.

## Riesgos conocidos que cada agente debe tener en mente

1. `upload_to='arca/ferreteria_1/...'` está hardcodeado → fuga entre tenants.
2. `_normalizar_logo_empresa` escribe a `logos/logo.ext` global → colisión.
3. `backup_service.py` hace dump de toda la DB → no aislado.
4. `Register.js` crea usuario global → debe ser onboarding SaaS.
5. `prod.py` tiene `ALLOWED_HOSTS = ["*"]` → debe restringirse.
6. Modelo `VistaStockProducto` usa vista SQL `managed=False` → verificar compatibilidad con schemas.

## Convenciones

- Campos de negocio/comercial en **español** (ej: `estado_suscripcion`, no `subscription_status`).
- Commits descriptivos en español estilo conventional commit (feat, fix etc..) pasarselo al usuario.
- Cada tarea debe actualizar `ferredesk-progress.json` al terminar.

## Antes de marcar algo como completo

El agente debe mostrar evidencia:
- Output de migración (`migrate_schemas` o `migrate`).
- Resultado del comando ejecutado (`python manage.py check`, `python manage.py test`, etc.).
- Descripción del flujo probado con output real.

**Nunca declarar "debería funcionar" sin validación explícita.**

## Documentos de referencia

- `DECISIONES-V1-SAAS-MULTITENANCY.md` — prevalece sobre todo lo demás.
- `PLAN-TECNICO-V1-SAAS-MULTITENANCY.md` — subordinado a DECISIONES.
- `ferredesk-progress.json` — estado actual de cada tarea.
