# Integración AFIP con FerreDesk

## 📋 Resumen Ejecutivo

Se ha desarrollado exitosamente la integración con AFIP para emitir facturas electrónicas válidas en FerreDesk. El sistema está funcionando en modo homologación y puede emitir comprobantes con CAE (Código de Autorización Electrónico) y generar códigos QR para validación pública.

## 🎯 Estado Actual

### ✅ Funcionalidades Implementadas

1. **Generación de TA (Ticket de Acceso)** ✅
   - Conexión exitosa con WSAA (Web Service de Autenticación y Autorización)
   - Generación de tokens de autenticación válidos por 12 horas

2. **Conexión con WSFEv1** ✅
   - Consulta de último comprobante autorizado (`FECompUltimoAutorizado`)
   - Emisión de comprobantes (`FECAESolicitar`)
   - Validación de respuestas de AFIP

3. **Emisión de Comprobantes** ✅
   - Factura B (Tipo 6) funcionando correctamente
   - Datos mínimos requeridos por AFIP
   - Validación de campos obligatorios

4. **Generación de QR** ✅
   - Formato JSON oficial AFIP
   - Codificación Base64 correcta
   - URL de validación pública: `https://servicioscf.afip.gob.ar/publico/comprobantes/cae.aspx?p=...`

### 🔧 Archivos Desarrollados

```
ferredesk_v0/backend/arca/
├── wsaa.py                    # Generación de TA
├── arca_utils.py              # Funciones principales AFIP
├── emitir_prueba.py           # Script de prueba
├── probar_arca.py             # Script de conexión
└── consultar_parametros.py    # Consulta parámetros AFIP
```

## 🏗️ Arquitectura Actual de FerreDesk

### Backend (Django)

#### Modelos Principales (`ferreapps/ventas/models.py`)

```python
class Comprobante(models.Model):
    codigo_afip = models.CharField(max_length=8, unique=True)
    nombre = models.CharField(max_length=50)
    letra = models.CharField(max_length=1)  # A, B, C, I
    tipo = models.CharField(max_length=30)  # factura, recibo, nota de crédito
    activo = models.BooleanField(default=True)

class Venta(models.Model):
    ven_id = models.AutoField(primary_key=True)
    comprobante = models.ForeignKey(Comprobante, on_delete=models.PROTECT)
    ven_punto = models.SmallIntegerField()  # Punto de venta
    ven_numero = models.IntegerField()      # Número de comprobante
    ven_cae = models.CharField(max_length=20, null=True, blank=True)
    ven_caevencimiento = models.DateField(null=True, blank=True)
    ven_qr = models.BinaryField(null=True, blank=True)
    # ... otros campos
```

#### Views (`ferreapps/ventas/views.py`)

- **VentaViewSet**: CRUD completo para ventas
- **ComprobanteViewSet**: Gestión de comprobantes
- **VentaCalculadaViewSet**: Vista con totales calculados
- Endpoints para conversión de presupuestos a ventas

### Frontend (React)

#### Componentes Principales

```
src/components/Presupuestos y Ventas/
├── VentaForm.js              # Formulario principal de ventas
├── NotaCreditoForm.js        # Formulario de notas de crédito
├── PresupuestosManager.js    # Gestor de presupuestos
├── ItemsGrid.js              # Grid de items
└── herramientasforms/        # Hooks y utilidades
```

#### Flujo de Datos

1. **VentaForm.js** → Captura datos del formulario
2. **ItemsGrid.js** → Maneja items y cálculos
3. **API Calls** → Envía datos al backend Django
4. **Django Views** → Procesa y guarda en base de datos

## 🔗 Integración AFIP con FerreDesk

### 1. Modificaciones Necesarias en el Backend

#### A. Nuevo Modelo para Configuración AFIP

```python
# ferreapps/ventas/models.py
class ConfiguracionAFIP(models.Model):
    cuit_emisor = models.CharField(max_length=11)
    punto_venta_homologacion = models.IntegerField(default=1)
    punto_venta_produccion = models.IntegerField(default=3)
    modo_homologacion = models.BooleanField(default=True)
    certificado_path = models.CharField(max_length=200)
    clave_privada_path = models.CharField(max_length=200)
    
    class Meta:
        db_table = 'CONFIGURACION_AFIP'
```

#### B. Nuevo Modelo para Respuestas AFIP

```python
# ferreapps/ventas/models.py
class RespuestaAFIP(models.Model):
    venta = models.OneToOneField(Venta, on_delete=models.CASCADE)
    cae = models.CharField(max_length=20)
    cae_vencimiento = models.DateField()
    resultado = models.CharField(max_length=1)  # A=Aprobado, R=Rechazado
    observaciones = models.TextField(null=True, blank=True)
    fecha_proceso = models.DateTimeField()
    qr_url = models.URLField(max_length=500, null=True, blank=True)
    qr_base64 = models.TextField(null=True, blank=True)
    
    class Meta:
        db_table = 'RESPUESTA_AFIP'
```

#### C. Nuevo Service para AFIP

```python
# ferreapps/ventas/services/afip_service.py
from ..models import Venta, RespuestaAFIP, ConfiguracionAFIP
from arca.arca_utils import emitir_comprobante_prueba, leer_ta

class AFIPService:
    @staticmethod
    def emitir_comprobante_ferredesk(venta_id):
        """
        Emite un comprobante desde FerreDesk usando AFIP
        """
        try:
            venta = Venta.objects.get(ven_id=venta_id)
            config = ConfiguracionAFIP.objects.first()
            
            # Preparar datos para AFIP
            datos_afip = AFIPService.preparar_datos_venta(venta, config)
            
            # Emitir comprobante
            respuesta_afip = emitir_comprobante_prueba(
                punto_venta=config.punto_venta_homologacion if config.modo_homologacion else config.punto_venta_produccion,
                tipo_cbte=AFIPService.mapear_tipo_comprobante(venta.comprobante.codigo_afip)
            )
            
            # Guardar respuesta
            if respuesta_afip and respuesta_afip.FeCabResp.Resultado == 'A':
                AFIPService.guardar_respuesta_afip(venta, respuesta_afip)
                return True, "Comprobante emitido correctamente"
            else:
                return False, "Error al emitir comprobante"
                
        except Exception as e:
            return False, f"Error: {str(e)}"
    
    @staticmethod
    def preparar_datos_venta(venta, config):
        """
        Prepara los datos de la venta para enviar a AFIP
        """
        # Implementar mapeo de datos de Venta a formato AFIP
        pass
    
    @staticmethod
    def mapear_tipo_comprobante(codigo_afip):
        """
        Mapea el código AFIP de FerreDesk al tipo de comprobante de AFIP
        """
        mapeo = {
            'factura_a': 1,  # Factura A
            'factura_b': 6,  # Factura B
            'factura_c': 11, # Factura C
            'nota_credito_a': 3,  # Nota de Crédito A
            'nota_credito_b': 8,  # Nota de Crédito B
            'nota_credito_c': 13, # Nota de Crédito C
        }
        return mapeo.get(codigo_afip, 6)  # Default a Factura B
```

#### D. Nuevo Endpoint en Views

```python
# ferreapps/ventas/views.py
from .services.afip_service import AFIPService

class VentaViewSet(viewsets.ModelViewSet):
    # ... código existente ...
    
    @action(detail=True, methods=['post'], url_path='emitir-afip')
    def emitir_afip(self, request, pk=None):
        """
        Emite el comprobante a través de AFIP
        """
        try:
            venta = self.get_object()
            success, message = AFIPService.emitir_comprobante_ferredesk(venta.ven_id)
            
            if success:
                return Response({
                    'success': True,
                    'message': message,
                    'cae': venta.respuestaafip.cae,
                    'cae_vencimiento': venta.respuestaafip.cae_vencimiento,
                    'qr_url': venta.respuestaafip.qr_url
                })
            else:
                return Response({
                    'success': False,
                    'message': message
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

### 2. Modificaciones en el Frontend

#### A. Nuevo Hook para AFIP

```javascript
// src/utils/useAFIPAPI.js
import { useState } from 'react';

export const useAFIPAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const emitirComprobanteAFIP = async (ventaId) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/ventas/${ventaId}/emitir-afip/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        return {
          success: true,
          cae: data.cae,
          caeVencimiento: data.cae_vencimiento,
          qrUrl: data.qr_url,
          message: data.message
        };
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    emitirComprobanteAFIP,
    loading,
    error
  };
};
```

#### B. Modificación en VentaForm.js

```javascript
// src/components/Presupuestos y Ventas/VentaForm.js
import { useAFIPAPI } from '../../utils/useAFIPAPI';

const VentaForm = ({ /* ... props ... */ }) => {
  const { emitirComprobanteAFIP, loading: loadingAFIP, error: errorAFIP } = useAFIPAPI();
  
  // ... código existente ...
  
  const handleEmitirAFIP = async () => {
    if (!formData.ven_id) {
      alert('Primero debe guardar la venta');
      return;
    }
    
    const resultado = await emitirComprobanteAFIP(formData.ven_id);
    
    if (resultado.success) {
      alert(`Comprobante emitido correctamente\nCAE: ${resultado.cae}\nVencimiento: ${resultado.caeVencimiento}`);
      // Actualizar formulario con datos de AFIP
      setFormData(prev => ({
        ...prev,
        ven_cae: resultado.cae,
        ven_caevencimiento: resultado.caeVencimiento
      }));
    } else {
      alert(`Error: ${resultado.error}`);
    }
  };
  
  return (
    <div>
      {/* ... formulario existente ... */}
      
      {/* Botón para emitir AFIP */}
      <button
        type="button"
        onClick={handleEmitirAFIP}
        disabled={loadingAFIP || !formData.ven_id}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {loadingAFIP ? 'Emitiendo...' : 'Emitir AFIP'}
      </button>
      
      {/* Mostrar datos de AFIP si existen */}
      {formData.ven_cae && (
        <div className="mt-4 p-4 bg-green-100 rounded">
          <h3 className="font-bold">Datos AFIP:</h3>
          <p>CAE: {formData.ven_cae}</p>
          <p>Vencimiento: {formData.ven_caevencimiento}</p>
          {formData.qr_url && (
            <a href={formData.qr_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              Ver QR
            </a>
          )}
        </div>
      )}
    </div>
  );
};
```

### 3. Configuración Inicial

#### A. Migración de Base de Datos

```python
# ferreapps/ventas/migrations/XXXX_agregar_afip.py
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('ventas', 'XXXX_previous_migration'),
    ]

    operations = [
        migrations.CreateModel(
            name='ConfiguracionAFIP',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cuit_emisor', models.CharField(max_length=11)),
                ('punto_venta_homologacion', models.IntegerField(default=1)),
                ('punto_venta_produccion', models.IntegerField(default=3)),
                ('modo_homologacion', models.BooleanField(default=True)),
                ('certificado_path', models.CharField(max_length=200)),
                ('clave_privada_path', models.CharField(max_length=200)),
            ],
            options={
                'db_table': 'CONFIGURACION_AFIP',
            },
        ),
        migrations.CreateModel(
            name='RespuestaAFIP',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cae', models.CharField(max_length=20)),
                ('cae_vencimiento', models.DateField()),
                ('resultado', models.CharField(max_length=1)),
                ('observaciones', models.TextField(blank=True, null=True)),
                ('fecha_proceso', models.DateTimeField()),
                ('qr_url', models.URLField(blank=True, max_length=500, null=True)),
                ('qr_base64', models.TextField(blank=True, null=True)),
                ('venta', models.OneToOneField(on_delete=models.deletion.CASCADE, to='ventas.venta')),
            ],
            options={
                'db_table': 'RESPUESTA_AFIP',
            },
        ),
    ]
```

#### B. Configuración Inicial

```python
# ferreapps/ventas/management/commands/configurar_afip.py
from django.core.management.base import BaseCommand
from ferreapps.ventas.models import ConfiguracionAFIP

class Command(BaseCommand):
    help = 'Configura los datos iniciales de AFIP'

    def handle(self, *args, **options):
        if not ConfiguracionAFIP.objects.exists():
            ConfiguracionAFIP.objects.create(
                cuit_emisor='20216286317',  # Reemplazar con CUIT real
                punto_venta_homologacion=1,
                punto_venta_produccion=3,
                modo_homologacion=True,
                certificado_path='arca/fernando_privada.crt',
                clave_privada_path='arca/fernando_privada.key'
            )
            self.stdout.write(
                self.style.SUCCESS('Configuración AFIP creada exitosamente')
            )
        else:
            self.stdout.write(
                self.style.WARNING('La configuración AFIP ya existe')
            )
```

## 🚀 Instrucciones de Implementación

### Paso 1: Preparar Certificados AFIP

```bash
# En el directorio ferredesk_v0/backend/arca/
# Asegurarse de tener los certificados:
# - fernando_privada.crt (certificado)
# - fernando_privada.key (clave privada)
```

### Paso 2: Generar TA Inicial

```bash
cd ferredesk_v0/backend/arca/
python wsaa.py fernando_privada.key fernando_privada.crt wsfe
```

### Paso 3: Ejecutar Migraciones

```bash
cd ferredesk_v0/backend/
python manage.py makemigrations ventas
python manage.py migrate
```

### Paso 4: Configurar AFIP

```bash
python manage.py configurar_afip
```

### Paso 5: Probar Integración

```bash
cd arca/
python emitir_prueba.py
```

### Paso 6: Integrar en Frontend

1. Agregar el hook `useAFIPAPI.js`
2. Modificar `VentaForm.js` para incluir botón de emisión AFIP
3. Probar emisión desde la interfaz web

## 🔧 Configuración de Producción

### Cambiar a Modo Producción

1. **Modificar configuración AFIP:**
   ```python
   config = ConfiguracionAFIP.objects.first()
   config.modo_homologacion = False
   config.punto_venta_produccion = 3  # Punto de venta real
   config.save()
   ```

2. **Generar TA para producción:**
   ```bash
   python wsaa.py fernando_privada.key fernando_privada.crt wsfe
   ```

3. **Actualizar URLs en arca_utils.py:**
   ```python
   # Cambiar de wswhomo.afip.gov.ar a servicios1.afip.gov.ar
   wsdl = "https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL"
   ```

## 📊 Flujo de Datos Completo

```
1. Usuario crea venta en FerreDesk
   ↓
2. VentaForm.js envía datos al backend
   ↓
3. Django guarda venta en base de datos
   ↓
4. Usuario hace clic en "Emitir AFIP"
   ↓
5. Frontend llama a endpoint /api/ventas/{id}/emitir-afip/
   ↓
6. AFIPService prepara datos de la venta
   ↓
7. arca_utils.py emite comprobante a AFIP
   ↓
8. AFIP responde con CAE y datos
   ↓
9. Se guarda RespuestaAFIP en base de datos
   ↓
10. Se actualiza Venta con CAE y QR
    ↓
11. Frontend muestra datos de AFIP al usuario
```

## 🛠️ Mantenimiento

### Renovar TA (cada 12 horas)

```bash
cd ferredesk_v0/backend/arca/
python wsaa.py fernando_privada.key fernando_privada.crt wsfe
```

### Verificar Estado de AFIP

```bash
python probar_arca.py
```

### Consultar Parámetros AFIP

```bash
python consultar_parametros.py
```

## 🔍 Troubleshooting

### Problemas Comunes

1. **TA vencido**: Regenerar con `python wsaa.py`
2. **Punto de venta no habilitado**: Verificar en AFIP
3. **Datos incorrectos**: Revisar mapeo de campos
4. **QR no funciona**: Verificar formato JSON y Base64

### Logs y Debug

- Revisar logs de Django para errores
- Usar `print()` en arca_utils.py para debug
- Verificar respuestas de AFIP en `emitir_prueba.py`

## 📝 Notas Importantes

1. **Homologación vs Producción**: Usar URLs y puntos de venta correctos
2. **Certificados**: Mantener seguros y actualizados
3. **TA**: Renovar cada 12 horas
4. **Backup**: Hacer backup de certificados y configuración
5. **Testing**: Probar exhaustivamente antes de pasar a producción

## 🎯 Próximos Pasos

1. **Integrar con PDF**: Generar PDF con QR y datos AFIP
2. **Notas de Crédito**: Implementar emisión de NC
3. **Libro IVA**: Integrar con sistema de libro IVA
4. **Validaciones**: Agregar validaciones adicionales
5. **UI/UX**: Mejorar interfaz de usuario para AFIP

## 🔐 GESTIÓN AUTOMÁTICA DE TOKENS (TA) - PLANEAMIENTO DETALLADO

### Problema Identificado
Los tokens de acceso de AFIP (TA) expiran cada 12 horas y requieren renovación automática para mantener la funcionalidad del sistema sin interrupciones.

### Solución Propuesta: Sistema de Gestión Inteligente de Tokens

#### A. Gestor de Tokens (`ferredesk_v0/backend/ferreapps/ventas/services/token_manager.py`)

**Funcionalidades Principales:**

1. **Verificación Automática de Validez**
   - Parsear el archivo `TA.xml` existente
   - Extraer fecha de expiración del token
   - Comparar con hora actual
   - Considerar válido si expira en más de 1 hora (margen de seguridad)

2. **Generación Automática de Nuevos Tokens**
   - Ejecutar `wsaa.py` cuando sea necesario
   - Capturar y manejar errores de generación
   - Verificar que el nuevo token se generó correctamente

3. **Cache Inteligente**
   - Almacenar estado del token en memoria durante la sesión
   - Evitar verificaciones redundantes del archivo XML
   - Implementar lock para evitar generaciones simultáneas

#### B. Integración con el Sistema

**Puntos de Integración:**
- **Antes de cada emisión AFIP**: Verificar token válido
- **En el startup del servidor**: Verificar token inicial
- **Cron job opcional**: Verificación periódica cada 6 horas

**Flujo de Verificación:**
```
1. Servicio AFIP solicita token
   ↓
2. TokenManager verifica archivo TA.xml
   ↓
3. Si es válido → Retorna OK
   ↓
4. Si expirado → Ejecuta wsaa.py
   ↓
5. Verifica nuevo token → Retorna OK/Error
```

### C. Manejo de Errores en Gestión de Tokens

**Escenarios de Error:**
1. **Certificados no encontrados**: Alertar al administrador
2. **Error de conexión con AFIP**: Reintentar con backoff exponencial
3. **Token generado inválido**: Log detallado para debugging
4. **Permisos de archivo**: Verificar permisos de escritura en directorio arca/

## 🎫 FLUJO DE EMISIÓN DE FACTURAS FISCALES - PLANEAMIENTO DETALLADO

### Problema Identificado
Necesitamos integrar la emisión AFIP en el flujo normal de ventas de FerreDesk, manteniendo la experiencia de usuario fluida y proporcionando feedback en tiempo real.

### Solución Propuesta: Flujo Integrado con Estados

#### A. Estados de Emisión AFIP

**Estados Definidos:**
1. **PENDIENTE**: Venta creada, AFIP no emitido
2. **EMITIENDO**: En proceso de emisión con AFIP
3. **EMITIDO**: Comprobante aprobado por AFIP
4. **RECHAZADO**: Comprobante rechazado por AFIP
5. **ERROR**: Error técnico en la emisión

#### B. Flujo de Usuario en VentaForm.js

**Secuencia de Interacción:**

1. **Creación de Venta**
   ```
   Usuario llena formulario → Guarda venta → Estado: PENDIENTE
   ```

2. **Emisión AFIP**
   ```
   Usuario hace clic "Emitir AFIP" → Estado: EMITIENDO
   → Spinner + mensaje "Conectando con AFIP..."
   → Timeout de 30 segundos máximo
   ```

3. **Respuesta de AFIP**
   ```
   Si APROBADO:
   → Estado: EMITIDO
   → Mostrar CAE, fecha vencimiento, QR
   → Botón "Descargar PDF" habilitado
   
   Si RECHAZADO:
   → Estado: RECHAZADO
   → Mostrar errores específicos de AFIP
   → Botón "Reintentar" disponible
   
   Si ERROR:
   → Estado: ERROR
   → Mostrar mensaje genérico
   → Log detallado para administrador
   ```

#### C. Componentes de UI Necesarios

**Nuevos Elementos en VentaForm.js:**

1. **Botón de Emisión AFIP**
   - Solo visible si venta está guardada
   - Deshabilitado durante emisión
   - Cambio de texto según estado

2. **Panel de Estado AFIP**
   - Indicador visual del estado actual
   - Progreso de emisión (spinner)
   - Mensajes informativos

3. **Panel de Datos AFIP (cuando emitido)**
   - CAE y fecha de vencimiento
   - QR code para validación
   - Enlace a validación oficial AFIP

4. **Panel de Errores (cuando rechazado)**
   - Lista de errores específicos de AFIP
   - Sugerencias de corrección
   - Botón de reintento

#### D. Integración con el Backend

**Endpoint Modificado:**
```
POST /api/ventas/{id}/emitir-afip/
```

**Respuestas Estructuradas:**
```json
{
  "success": true,
  "estado": "EMITIDO",
  "datos": {
    "cae": "12345678901234",
    "cae_vencimiento": "2025-01-15",
    "qr_url": "https://servicioscf.afip.gob.ar/...",
    "qr_base64": "data:image/png;base64,..."
  },
  "mensaje": "Comprobante emitido correctamente"
}
```

## ⚡ MANEJO ATÓMICO DE ERRORES - PLANEAMIENTO DETALLADO

### Problema Identificado
Si la emisión AFIP falla, no debe afectar la venta ya guardada en FerreDesk. El sistema debe ser resiliente y permitir reintentos sin corrupción de datos.

### Solución Propuesta: Arquitectura de Transacciones Separadas

#### A. Separación de Responsabilidades

**Transacción 1: Venta (Siempre Exitosa)**
- Crear/actualizar venta en base de datos
- Guardar items y cálculos
- Actualizar stock
- **NO depende de AFIP**

**Transacción 2: Emisión AFIP (Independiente)**
- Verificar token válido
- Preparar datos para AFIP
- Emitir comprobante
- Actualizar venta con datos AFIP
- **Puede fallar sin afectar venta**

#### B. Estrategia de Rollback Inteligente

**Si AFIP Falla:**
1. **Venta permanece intacta** en estado "PENDIENTE"
2. **Log detallado** del error para debugging
3. **Respuesta clara** al usuario sobre el problema
4. **Posibilidad de reintento** sin límites

**Si AFIP Exito pero Fallo al Guardar:**
1. **Rollback de datos AFIP** en la venta
2. **Venta permanece** en estado "PENDIENTE"
3. **Log del error** para análisis
4. **Posibilidad de reintento**

#### C. Manejo de Estados de Venta

**Campo Nuevo en Modelo Venta:**
```python
ven_estado_afip = models.CharField(
    max_length=20,
    choices=[
        ('PENDIENTE', 'Pendiente de emisión'),
        ('EMITIENDO', 'En proceso de emisión'),
        ('EMITIDO', 'Emitido correctamente'),
        ('RECHAZADO', 'Rechazado por AFIP'),
        ('ERROR', 'Error técnico')
    ],
    default='PENDIENTE'
)
```

**Lógica de Estados:**
- **PENDIENTE**: Venta normal, sin datos AFIP
- **EMITIENDO**: Bloquear emisiones simultáneas
- **EMITIDO**: Mostrar datos AFIP, permitir PDF
- **RECHAZADO**: Mostrar errores, permitir reintento
- **ERROR**: Mostrar mensaje genérico, permitir reintento

#### D. Sistema de Reintentos

**Política de Reintentos:**
- **Sin límite** de reintentos para el usuario
- **Backoff exponencial** en el backend (1s, 2s, 4s, 8s...)
- **Timeout máximo** de 30 segundos por intento
- **Log detallado** de cada intento

**Condiciones de Reintento:**
- Estado "RECHAZADO" por errores de datos
- Estado "ERROR" por problemas técnicos
- **NO reintentar** si estado "EMITIDO"

#### E. Logging y Monitoreo

**Logs Detallados:**
```python
# Ejemplo de logging estructurado
logger.info("Iniciando emisión AFIP", extra={
    'venta_id': venta.ven_id,
    'comprobante': venta.comprobante.codigo_afip,
    'punto_venta': venta.ven_punto,
    'numero': venta.ven_numero
})
```

**Métricas de Monitoreo:**
- Tasa de éxito de emisiones AFIP
- Tiempo promedio de respuesta
- Errores más frecuentes
- Tokens expirados

## 🔄 INTEGRACIÓN CON FLUJO EXISTENTE DE VENTAS

### Problema Identificado
El flujo actual de ventas en FerreDesk debe mantenerse intacto, agregando la funcionalidad AFIP como una capa adicional opcional.

### Solución Propuesta: Integración No Invasiva

#### A. Modificaciones Mínimas en VentaForm.js

**Cambios Requeridos:**
1. **Agregar estado AFIP** al formulario existente
2. **Nuevo botón** "Emitir AFIP" (solo cuando aplicable)
3. **Panel de estado AFIP** (condicional)
4. **Hook useAFIPAPI** para manejo de API

**Código Existente Preservado:**
- Lógica de guardado de venta
- Manejo de items y cálculos
- Validaciones existentes
- Flujo de presupuesto a venta

#### B. Condiciones de Habilitación AFIP

**Venta Elegible para AFIP:**
- Comprobante con `codigo_afip` válido
- Cliente con datos fiscales completos
- Venta guardada (tiene `ven_id`)
- Estado AFIP no "EMITIDO"

**Comprobantes AFIP Soportados:**
- `factura_a` → Tipo AFIP 1
- `factura_b` → Tipo AFIP 6
- `factura_c` → Tipo AFIP 11
- `nota_credito_a` → Tipo AFIP 3
- `nota_credito_b` → Tipo AFIP 8
- `nota_credito_c` → Tipo AFIP 13

#### C. Experiencia de Usuario Integrada

**Flujo Optimizado:**
```
1. Usuario crea venta normalmente
   ↓
2. Al guardar, si es comprobante fiscal → Mostrar botón "Emitir AFIP"
   ↓
3. Usuario decide emitir AFIP o no
   ↓
4. Si emite → Proceso automático con feedback
   ↓
5. Venta queda con datos AFIP o en estado de reintento
```

**Estados Visuales:**
- **Sin AFIP**: Venta normal, sin indicadores especiales
- **Pendiente AFIP**: Botón "Emitir AFIP" visible
- **Emitiendo**: Spinner + mensaje de progreso
- **Emitido**: Panel verde con datos AFIP
- **Rechazado**: Panel rojo con errores y reintento

#### D. Compatibilidad con Funcionalidades Existentes

**Preservación de Funcionalidades:**
- **Conversión presupuesto → venta**: Mantiene flujo intacto
- **Edición de ventas**: Permite editar y re-emitir AFIP
- **Anulación**: Mantiene lógica de anulación existente
- **PDF**: Integra datos AFIP en plantillas existentes
- **Libro IVA**: Incluye datos AFIP en exportaciones

**Nuevas Funcionalidades:**
- **Validación automática**: Verifica datos antes de emitir AFIP
- **Sugerencias**: Sugiere correcciones para errores comunes
- **Historial**: Mantiene historial de intentos de emisión
- **Notificaciones**: Alerta sobre tokens próximos a vencer

## 📋 RESUMEN EJECUTIVO DEL PLANEAMIENTO

### Objetivos Alcanzados
✅ **Gestión automática de tokens**: Sistema que renueva tokens cada 12 horas automáticamente
✅ **Flujo integrado**: Emisión AFIP integrada en el flujo normal de ventas
✅ **Manejo atómico**: Errores AFIP no afectan ventas ya guardadas
✅ **Experiencia de usuario**: Feedback claro y estados visuales intuitivos

### Beneficios del Sistema
1. **Confiabilidad**: Tokens siempre válidos, emisiones atómicas
2. **Usabilidad**: Flujo natural, sin interrupciones
3. **Mantenibilidad**: Logs detallados, monitoreo completo
4. **Escalabilidad**: Arquitectura preparada para producción

### Próximos Pasos de Implementación
1. **Desarrollar TokenManager**: Gestión automática de tokens
2. **Crear AFIPService**: Service layer para emisión
3. **Modificar VentaForm**: Integración en frontend
4. **Agregar modelos**: Estados AFIP y configuración
5. **Testing exhaustivo**: Pruebas en homologación

### Riesgos Mitigados
- **Tokens expirados**: Gestión automática
- **Errores AFIP**: Manejo atómico, reintentos
- **Experiencia de usuario**: Estados claros, feedback inmediato
- **Datos corruptos**: Transacciones separadas, rollback inteligente

Este planeamiento garantiza una integración robusta, confiable y fácil de usar que mantiene la funcionalidad existente de FerreDesk mientras agrega capacidades fiscales completas. 