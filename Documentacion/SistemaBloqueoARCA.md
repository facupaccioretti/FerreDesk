# Sistema de Bloqueo de Formularios durante Espera de ARCA

## Descripción General

El sistema implementa un mecanismo modular para bloquear formularios de facturación mientras se espera la respuesta de AFIP para obtener el CAE (Código de Autorización Electrónico). Esto es crítico en Argentina, donde las facturas no son válidas fiscalmente hasta que AFIP devuelve el CAE.

## Componentes del Sistema

### 1. Hook `useArcaEstado.js`

**Ubicación**: `ferredesk_v0/frontend/src/utils/useArcaEstado.js`

**Propósito**: Manejar el estado de espera de respuesta de ARCA de manera centralizada y reutilizable.

**Funcionalidades**:
- `esperandoArca`: Estado booleano que indica si se está esperando respuesta
- `respuestaArca`: Datos de la respuesta exitosa de ARCA
- `errorArca`: Información de error si falla la emisión
- `iniciarEsperaArca()`: Inicia el estado de espera
- `finalizarEsperaArcaExito(datos)`: Finaliza con éxito
- `finalizarEsperaArcaError(error)`: Finaliza con error
- `limpiarEstadoArca()`: Limpia todo el estado
- `requiereEmisionArca(tipoComprobante)`: Determina si un tipo requiere ARCA

**Tipos que requieren emisión ARCA**:
- `'factura'`: Facturas fiscales (A, B, C)
- `'nota_credito'`: Notas de crédito fiscales

### 2. Componente `ArcaEsperaOverlay.js`

**Ubicación**: `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/herramientasforms/ArcaEsperaOverlay.js`

**Propósito**: Overlay visual que bloquea la interacción con el formulario y muestra información del estado de procesamiento.

**Características**:
- Overlay modal con backdrop blur
- Spinner animado con icono de AFIP
- Mensaje personalizable
- Detalles técnicos opcionales
- Indicador de progreso animado
- Advertencia de no cerrar/modificar

**Props**:
- `estaEsperando`: Boolean para mostrar/ocultar
- `mensajePersonalizado`: Mensaje específico (opcional)
- `mostrarDetalles`: Boolean para mostrar información técnica

## Integración en Formularios

### VentaForm.js

**Cambios implementados**:
1. Importación del hook y componente
2. Inicialización del estado ARCA
3. Verificación de tipo de comprobante en `handleSubmit`
4. Inicio de espera si requiere ARCA
5. Procesamiento de respuesta de ARCA
6. Manejo de errores
7. Limpieza de estado en cancelación
8. Renderizado del overlay

**Flujo**:
```
Usuario envía formulario
↓
Verificar si tipo_comprobante === "factura"
↓
Si requiere ARCA: iniciarEsperaArca()
↓
Enviar payload al backend
↓
Backend procesa y emite ARCA automáticamente
↓
Procesar respuesta:
  - Si éxito: finalizarEsperaArcaExito(datos)
  - Si error: finalizarEsperaArcaError(error)
↓
Cerrar formulario
```

### ConVentaForm.js

**Cambios similares a VentaForm**:
- Misma lógica de integración
- Mensaje personalizado para conversiones
- Manejo específico para conversiones de presupuestos y facturas internas

### NotaCreditoForm.js

**Cambios específicos**:
- Verificación de tipo `'nota_credito'`
- Mensaje personalizado para notas de crédito
- Validación de consistencia de letras antes de iniciar ARCA

## Flujo de Comunicación Backend

### Respuesta del Backend

El backend debe retornar en la respuesta:

```javascript
{
  // ... otros datos de la venta
  arca_emitido: true/false,
  cae: "12345678901234", // Si éxito
  cae_vencimiento: "20241231", // Si éxito
  qr_generado: true/false, // Si éxito
  error: "Mensaje de error" // Si falla
}
```

### Procesamiento en Frontend

```javascript
// En handleSubmit de cada formulario
const resultado = await onSave(payload);

if (requiereEmisionArca(tipoComprobanteSeleccionado)) {
  if (resultado?.arca_emitido && resultado?.cae) {
    finalizarEsperaArcaExito({
      cae: resultado.cae,
      cae_vencimiento: resultado.cae_vencimiento,
      qr_generado: resultado.qr_generado
    });
  } else if (resultado?.error) {
    finalizarEsperaArcaError(resultado.error);
  } else {
    finalizarEsperaArcaError("Error desconocido en la emisión ARCA");
  }
}
```

## Beneficios del Sistema

### 1. Experiencia de Usuario
- **Feedback claro**: El usuario sabe exactamente qué está pasando
- **Prevención de errores**: No puede modificar el formulario durante el proceso
- **Información técnica**: Entiende el proceso de autorización fiscal
- **Advertencias claras**: Sabe que no debe cerrar la ventana

### 2. Cumplimiento Fiscal
- **Trazabilidad completa**: Se registra todo el proceso
- **Prevención de duplicados**: Evita envíos múltiples
- **Validación automática**: Solo se procesan comprobantes válidos

### 3. Modularidad
- **Reutilizable**: Mismo sistema en todos los formularios
- **Configurable**: Mensajes personalizables por contexto
- **Mantenible**: Lógica centralizada en hooks

## Configuración y Personalización

### Mensajes Personalizados

Cada formulario puede personalizar el mensaje del overlay:

```javascript
<ArcaEsperaOverlay 
  estaEsperando={esperandoArca}
  mensajePersonalizado={
    tipoComprobante === "factura" 
      ? "Esperando autorización de AFIP para la factura fiscal..." 
      : null
  }
  mostrarDetalles={true}
/>
```

### Tipos de Comprobantes

Para agregar nuevos tipos que requieran ARCA, modificar en `useArcaEstado.js`:

```javascript
const tiposQueRequierenArca = ['factura', 'nota_credito', 'nuevo_tipo'];
```

## Consideraciones Técnicas

### 1. Manejo de Errores
- Errores de red se capturan en try/catch
- Errores de ARCA se procesan específicamente
- Estado se limpia automáticamente en cancelación

### 2. Performance
- Overlay se renderiza condicionalmente
- Estados se limpian apropiadamente
- No hay memory leaks

### 3. Accesibilidad
- Overlay tiene z-index alto (50)
- Backdrop blur para enfoque visual
- Mensajes claros y descriptivos

## Testing

### Casos de Prueba Recomendados

1. **Factura fiscal exitosa**:
   - Enviar formulario con tipo "factura"
   - Verificar que aparece overlay
   - Simular respuesta exitosa del backend
   - Verificar que overlay desaparece

2. **Factura fiscal con error**:
   - Simular error de ARCA
   - Verificar que se muestra error
   - Verificar que overlay desaparece

3. **Factura interna**:
   - Enviar formulario con tipo "factura_interna"
   - Verificar que NO aparece overlay

4. **Cancelación durante espera**:
   - Iniciar proceso ARCA
   - Cancelar formulario
   - Verificar que estado se limpia

## Mantenimiento

### Agregar Nuevo Formulario

1. Importar hook y componente:
```javascript
import { useArcaEstado } from '../../utils/useArcaEstado';
import ArcaEsperaOverlay from './herramientasforms/ArcaEsperaOverlay';
```

2. Inicializar estado:
```javascript
const { esperandoArca, iniciarEsperaArca, ... } = useArcaEstado();
```

3. Integrar en handleSubmit:
```javascript
if (requiereEmisionArca(tipoComprobante)) {
  iniciarEsperaArca();
}
// ... resto de lógica
```

4. Agregar overlay al final del componente:
```javascript
<ArcaEsperaOverlay estaEsperando={esperandoArca} />
```

### Debugging

Para debugging, agregar logs en el hook:

```javascript
const iniciarEsperaArca = useCallback(() => {
  console.log('[ARCA] Iniciando espera');
  setEsperandoArca(true);
  // ...
}, []);
```

## Conclusión

El sistema proporciona una solución robusta y modular para manejar la espera de respuesta de ARCA, mejorando significativamente la experiencia del usuario y garantizando el cumplimiento fiscal en el proceso de facturación. 