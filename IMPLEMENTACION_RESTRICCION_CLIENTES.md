# Implementación de Restricción de Eliminación de Clientes

## Resumen de Cambios Implementados

Se ha implementado una restricción robusta para evitar la eliminación de clientes que poseen movimientos comerciales en el sistema FerreDesk v0.

## Archivos Modificados

### 1. Backend - Modelo Venta
**Archivo:** `ferredesk_v0/backend/ferreapps/ventas/models.py`

**Cambio:** Convertir el campo `ven_idcli` de `IntegerField` a `ForeignKey` con protección:

```python
# ANTES:
ven_idcli = models.IntegerField(db_column='VEN_IDCLI')

# DESPUÉS:
ven_idcli = models.ForeignKey(
    'clientes.Cliente',
    on_delete=models.PROTECT,
    db_column='VEN_IDCLI',
    related_name='ventas'
)
```

### 2. Backend - ViewSet de Cliente
**Archivo:** `ferredesk_v0/backend/ferreapps/clientes/views.py`

**Cambios:**
- Agregado import de `ProtectedError`
- Implementado método `destroy` personalizado para manejar la excepción

```python
from django.db.models import Q, ProtectedError

def destroy(self, request, *args, **kwargs):
    """
    Sobrescribe el método destroy para manejar ProtectedError cuando un cliente
    tiene movimientos comerciales asociados.
    """
    try:
        return super().destroy(request, *args, **kwargs)
    except ProtectedError:
        return Response(
            {
                "error": "El cliente no puede ser eliminado porque posee movimientos comerciales en el sistema."
            },
            status=400
        )
```

### 3. Frontend - Hook useClientesAPI
**Archivo:** `ferredesk_v0/frontend/src/utils/useClientesAPI.js`

**Cambio:** Mejorado el manejo de errores para mostrar mensajes específicos:

```javascript
// Manejo específico para el error de restricción de movimientos comerciales
if (data.error && data.error.includes('movimientos comerciales')) {
  errorMsg = data.error;
} else {
  errorMsg = data.detail || data.error || JSON.stringify(data);
}
```

## Comandos para Completar la Implementación

### 1. Crear la Migración
```bash
cd ferredesk_v0/backend
python manage.py makemigrations ventas
```

### 2. Aplicar la Migración
```bash
python manage.py migrate
```

### 3. Verificar la Implementación
```bash
# Iniciar el servidor de desarrollo
python manage.py runserver

# En otra terminal, iniciar el frontend
cd ../frontend
npm start
```

## Funcionalidad Implementada

### ✅ Restricción a Nivel de Base de Datos
- El campo `ven_idcli` ahora es un `ForeignKey` con `on_delete=PROTECT`
- Django automáticamente bloqueará cualquier intento de eliminar un cliente con ventas asociadas

### ✅ Manejo de Errores en API REST
- El ViewSet captura `ProtectedError` y devuelve un mensaje claro
- Respuesta HTTP 400 con mensaje descriptivo

### ✅ Manejo de Errores en Frontend
- El hook `useClientesAPI` detecta el error específico
- Muestra el mensaje al usuario de forma clara

### ✅ Compatibilidad con Django Admin
- La restricción funciona automáticamente en Django Admin
- Muestra el error estándar de Django para restricciones

## Casos de Uso Cubiertos

1. **Eliminación desde Django Admin**: Bloqueada con mensaje de error
2. **Eliminación desde API REST**: Bloqueada con respuesta HTTP 400
3. **Eliminación desde código interno**: Lanza `ProtectedError`
4. **Eliminación desde Frontend**: Muestra mensaje claro al usuario

## Mensaje de Error Mostrado

```
"El cliente no puede ser eliminado porque posee movimientos comerciales en el sistema."
```

## Beneficios de la Implementación

1. **Integridad de Datos**: Garantiza que no se pierdan referencias a ventas
2. **Seguridad**: Protección a nivel de base de datos
3. **Experiencia de Usuario**: Mensajes claros y comprensibles
4. **Mantenibilidad**: Código limpio y bien documentado
5. **Escalabilidad**: Fácil de extender para otras restricciones

## Próximos Pasos Recomendados

1. Ejecutar las migraciones en el entorno de desarrollo
2. Probar la funcionalidad con clientes que tengan y no tengan ventas
3. Verificar que el mensaje se muestra correctamente en el frontend
4. Considerar agregar restricciones similares para otros modelos críticos

## Notas Importantes

- La migración puede tardar dependiendo del volumen de datos
- Se recomienda hacer backup antes de aplicar la migración en producción
- El cambio es retrocompatible: no afecta la funcionalidad existente
- La restricción se aplica a todos los tipos de ventas (presupuestos, facturas, notas de crédito, etc.) 