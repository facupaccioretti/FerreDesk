# GuardarCAE.md

## Sistema de Guardado de CAE en FerreDesk

### Resumen Ejecutivo

El sistema FerreDesk implementa un proceso automatizado y transaccional para guardar el **CAE (Código de Autorización Electrónico)** obtenido de AFIP. El proceso es completamente automático, ocurre dentro de una transacción de base de datos, y garantiza la integridad de los datos fiscales.

---

## 1. Arquitectura General del Sistema

### 1.1 Componentes Principales

```
Frontend (React) → Backend (Django) → ARCA Service → AFIP
     ↓                    ↓              ↓
VentaForm.js    → views.py → FerreDeskARCA → WSFEv1
```

### 1.2 Flujo de Datos

1. **Frontend**: Usuario envía formulario de venta
2. **Backend**: Crea venta en base de datos
3. **ARCA Service**: Emite comprobante a AFIP
4. **AFIP**: Retorna CAE y datos de autorización
5. **Backend**: Guarda CAE en base de datos
6. **Frontend**: Muestra resultado al usuario

---

## 2. Modelo de Datos

### 2.1 Campos CAE en el Modelo Venta

```python
# ferredesk_v0/backend/ferreapps/ventas/models.py

class Venta(models.Model):
    # ... otros campos ...
    
    # Campos ARCA/CAE
    ven_cae = models.CharField(max_length=20, db_column='VEN_CAE', null=True, blank=True)
    ven_caevencimiento = models.DateField(db_column='VEN_CAEVENCIMIENTO', null=True, blank=True)
    ven_qr = models.BinaryField(db_column='VEN_QR', null=True, blank=True)
    
    # ... resto del modelo ...
```

### 2.2 Descripción de Campos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `ven_cae` | CharField(20) | Código de Autorización Electrónico de AFIP |
| `ven_caevencimiento` | DateField | Fecha de vencimiento del CAE |
| `ven_qr` | BinaryField | Imagen QR del comprobante en formato binario |

---

## 3. Proceso de Guardado Detallado

### 3.1 Punto de Entrada: views.py

```python
# ferredesk_v0/backend/ferreapps/ventas/views.py - Líneas 264-282

@transaction.atomic
def create(self, request, *args, **kwargs):
    # ... creación de venta ...
    
    # === INTEGRACIÓN ARCA AUTOMÁTICA (DENTRO DE LA TRANSACCIÓN) ===
    if debe_emitir_arca(tipo_comprobante):
        try:
            logger.info(f"Emisión automática ARCA para venta {venta_creada.ven_id}")
            resultado_arca = emitir_arca_automatico(venta_creada)
            
            # Agregar información ARCA a la respuesta
            response.data['arca_emitido'] = True
            response.data['cae'] = resultado_arca.get('cae')
            response.data['cae_vencimiento'] = resultado_arca.get('cae_vencimiento')
            response.data['qr_generado'] = resultado_arca.get('qr_generado', False)
            response.data['observaciones'] = resultado_arca.get('observaciones', [])
            
        except Exception as e:
            # Error en emisión ARCA - FALLAR LA TRANSACCIÓN COMPLETA
            raise FerreDeskARCAError(f"Error en emisión ARCA: {e}")
```

### 3.2 Función de Emisión Automática

```python
# ferredesk_v0/backend/ferreapps/ventas/ARCA/emitir_arca_automatico.py

def emitir_arca_automatico(venta: Venta) -> Dict[str, Any]:
    """
    Emite automáticamente un comprobante por ARCA.
    """
    try:
        # Verificar si debe emitirse por ARCA
        if not debe_emitir_arca(venta.comprobante.tipo):
            return {
                'emitido': False,
                'motivo': f'Comprobante {venta.comprobante.tipo} no requiere emisión ARCA'
            }
        
        # Obtener configuración de ferretería
        ferreteria = Ferreteria.objects.first()
        
        # Crear instancia de FerreDeskARCA
        arca = FerreDeskARCA(ferreteria)
        
        # Emitir automáticamente
        resultado = arca.emitir_automatico(venta)
        
        return {
            'emitido': True,
            'resultado': resultado
        }
        
    except Exception as e:
        raise FerreDeskARCAError(f"Error inesperado en emisión automática: {e}")
```

### 3.3 Método Principal de Emisión

```python
# ferredesk_v0/backend/ferreapps/ventas/ARCA/services/FerreDeskARCA.py

def emitir_automatico(self, venta: Venta) -> Dict[str, Any]:
    """
    Emisión automática completa de un comprobante.
    """
    try:
        logger.info(f"Iniciando emisión automática ARCA para venta {venta.ven_id}")
        
        # Verificar si ya tiene CAE
        if venta.ven_cae:
            logger.warning(f"Venta {venta.ven_id} ya tiene CAE: {venta.ven_cae}")
            return {'cae': venta.ven_cae, 'ya_emitido': True}
        
        # 1. Obtener el último número autorizado de AFIP
        numero_afip = self.obtener_ultimo_numero_autorizado(venta.comprobante.codigo_afip)
        
        # 2. Actualizar el número de la venta con el número correcto de AFIP
        venta.ven_numero = numero_afip
        venta.save()
        
        # 3. Preparar datos usando el armador
        datos_arca = armar_payload_arca(venta, cliente, comprobante, venta_calculada, alicuotas_venta)
        
        # 4. Emitir comprobante
        resultado_arca = self.emitir_comprobante(datos_arca, int(comprobante.codigo_afip))
        
        # 5. Generar QR
        qr_bytes = self.generar_qr_comprobante(
            venta, 
            resultado_arca['cae'], 
            resultado_arca['cae_fch_vto']
        )
        
        # 6. Actualizar venta con datos ARCA
        with transaction.atomic():
            venta.ven_cae = resultado_arca['cae']
            venta.ven_caevencimiento = datetime.strptime(
                resultado_arca['cae_fch_vto'], '%Y%m%d'
            ).date()
            venta.ven_qr = qr_bytes
            venta.save()
        
        return {
            'cae': resultado_arca['cae'],
            'cae_vencimiento': resultado_arca['cae_fch_vto'],
            'qr_generado': True,
            'venta_actualizada': True,
            'observaciones': resultado_arca.get('motivos', [])
        }
        
    except Exception as e:
        logger.error(f"Error en emisión automática ARCA: {e}")
        raise FerreDeskARCAError(f"Error en emisión automática: {e}")
```

---

## 4. Generación y Guardado del QR

### 4.1 Proceso de Generación QR

```python
# ferredesk_v0/backend/ferreapps/ventas/ARCA/utils/QRGenerator.py

def generar_qr_afip(self, venta: Venta, cae: str, fecha_vencimiento: str) -> bytes:
    """
    Genera el código QR según especificaciones AFIP.
    """
    try:
        # Construir datos para el QR según especificaciones AFIP
        datos_qr = self._construir_datos_qr(venta, cae, fecha_vencimiento)
        
        # Generar QR
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        
        qr.add_data(datos_qr)
        qr.make(fit=True)
        
        # Crear imagen
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convertir a bytes
        import io
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        qr_bytes = buffer.getvalue()
        
        return qr_bytes
        
    except Exception as e:
        logger.error(f"Error generando QR: {e}")
        raise
```

### 4.2 Construcción de Datos QR

```python
def _construir_datos_qr(self, venta: Venta, cae: str, fecha_vencimiento: str) -> str:
    """
    Construye los datos para el QR según especificaciones AFIP.
    """
    # Obtener datos de la ferretería
    ferreteria = Ferreteria.objects.first()
    
    # Obtener datos completos desde la vista
    venta_calculada = VentaCalculada.objects.get(ven_id=venta.ven_id)
    
    # Formatear CAE: string numérico sin guiones ni espacios
    cod_aut_formateado = str(cae).replace('-', '').replace(' ', '')
    
    # Formatear fecha vencimiento: formato YYYYMMDD
    fch_vto_formateado = str(fecha_vencimiento)
    
    # Determinar tipo de documento del receptor
    cuit_cliente = venta.ven_cuit or ""
    dni_cliente = venta.ven_dni or ""
    
    if cuit_cliente and len(cuit_cliente) == 11:
        tipo_doc_rec = 80  # CUIT
        nro_doc_rec = int(cuit_cliente.replace('-', '').replace(' ', ''))
    elif dni_cliente and len(str(dni_cliente)) >= 7:
        tipo_doc_rec = 96  # DNI
        nro_doc_rec = int(str(dni_cliente).replace('.', '').replace(' ', ''))
    else:
        tipo_doc_rec = 99  # Consumidor Final
        nro_doc_rec = 0
    
    # Crear JSON según especificaciones AFIP
    qr_json = {
        "ver": 1,
        "fecha": str(venta.ven_fecha.strftime('%Y%m%d')),
        "cuit": int(ferreteria.cuit_cuil),
        "ptoVta": int(ferreteria.punto_venta_arca),
        "tipoCmp": int(comprobante.codigo_afip),
        "nroCmp": int(venta.ven_numero),
        "importe": float(venta_calculada.ven_total),
        "moneda": "PES",
        "ctz": 1,
        "tipoDocRec": tipo_doc_rec,
        "nroDocRec": nro_doc_rec,
        "tipoCodAut": "E",
        "codAut": cod_aut_formateado,
        "fchVto": fch_vto_formateado
    }
    
    # Convertir JSON a string compacto
    qr_json_str = json.dumps(qr_json, separators=(',', ':'), ensure_ascii=False)
    
    # Codificar a base64
    qr_base64_json = base64.b64encode(qr_json_str.encode('utf-8')).decode('utf-8')
    
    # URL oficial AFIP
    qr_url = f"https://servicioscf.afip.gob.ar/publico/comprobantes/cae.aspx?p={qr_base64_json}"
    
    return qr_url
```

---

## 5. Transaccionalidad y Atomicidad

### 5.1 Garantías de Transaccionalidad

```python
# El proceso completo está envuelto en @transaction.atomic
@transaction.atomic
def create(self, request, *args, **kwargs):
    # 1. Crear venta en BD
    response = super().create(request, *args, **kwargs)
    venta_creada = Venta.objects.get(ven_id=response.data['ven_id'])
    
    # 2. Emisión ARCA (si aplica)
    if debe_emitir_arca(tipo_comprobante):
        resultado_arca = emitir_arca_automatico(venta_creada)
        # Si falla, toda la transacción se revierte
    
    # 3. Respuesta exitosa
    return response
```

### 5.2 Manejo de Errores

```python
# Si falla la emisión ARCA, se revierte toda la transacción
except Exception as e:
    # Error en emisión ARCA - FALLAR LA TRANSACCIÓN COMPLETA
    logger.error(f"Error en emisión automática ARCA para venta {venta_creada.ven_id}: {e}")
    raise FerreDeskARCAError(f"Error en emisión ARCA: {e}")
```

---

## 6. Tipos de Comprobantes que Requieren CAE

### 6.1 Función de Decisión

```python
# ferredesk_v0/backend/ferreapps/ventas/ARCA/settings_arca.py

def debe_emitir_arca(tipo_comprobante: str) -> bool:
    """
    Determina si un tipo de comprobante requiere emisión ARCA.
    """
    tipos_que_requieren_arca = [
        'factura',           # Facturas A, B, C
        'nota_credito',      # Notas de crédito fiscales
        'nota_debito',       # Notas de débito fiscales
    ]
    
    return tipo_comprobante.lower() in tipos_que_requieren_arca
```

### 6.2 Tipos que NO Requieren CAE

- `factura_interna` - Comprobantes internos
- `presupuesto` - Presupuestos
- `remito` - Remitos
- `pedido` - Pedidos

---

## 7. Respuesta al Frontend

### 7.1 Estructura de Respuesta Exitosa

```json
{
    "ven_id": 123,
    "arca_emitido": true,
    "cae": "12345678901234",
    "cae_vencimiento": "20241231",
    "qr_generado": true,
    "observaciones": ["Comprobante emitido exitosamente"],
    "stock_actualizado": [...],
    "comprobante_letra": "A",
    "comprobante_nombre": "Factura A",
    "comprobante_codigo_afip": "001"
}
```

### 7.2 Estructura de Respuesta para Comprobantes Internos

```json
{
    "ven_id": 124,
    "arca_emitido": false,
    "arca_motivo": "Comprobante interno - no requiere emisión ARCA",
    "stock_actualizado": [...],
    "comprobante_letra": "I",
    "comprobante_nombre": "Factura Interna",
    "comprobante_codigo_afip": "002"
}
```

---

## 8. Logging y Auditoría

### 8.1 Logs de Emisión

```python
# Logs detallados en cada paso del proceso
logger.info(f"Iniciando emisión automática ARCA para venta {venta.ven_id}")
logger.info(f"Número actualizado para venta {venta.ven_id}: {numero_afip}")
logger.info(f"Emisión ARCA exitosa para venta {venta.ven_id}: CAE {resultado_arca['cae']}")
```

### 8.2 Logs de Error

```python
logger.error(f"Error en emisión automática ARCA para venta {venta_creada.ven_id}: {e}")
logger.error(f"Error generando QR para venta {venta.ven_id}: {e}")
```

---

## 9. Configuración Requerida

### 9.1 Campos de Configuración en Ferreteria

```python
class Ferreteria(models.Model):
    # Configuración ARCA
    modo_arca = models.CharField(max_length=20, null=True, blank=True)
    punto_venta_arca = models.IntegerField(null=True, blank=True)
    cuit_cuil = models.CharField(max_length=20, null=True, blank=True)
    
    # Certificados ARCA
    certificado_arca = models.FileField(upload_to='arca/certificados/', null=True, blank=True)
    clave_privada_arca = models.FileField(upload_to='arca/claves/', null=True, blank=True)
```

### 9.2 Validaciones de Configuración

```python
# Validaciones antes de emitir
if not ferreteria.modo_arca:
    raise FerreDeskARCAError(f"Ferretería {ferreteria.id} no tiene modo ARCA configurado")

if not ferreteria.punto_venta_arca:
    raise FerreDeskARCAError(f"Ferretería {ferreteria.id} no tiene punto de venta ARCA configurado")
```

---

## 10. Consideraciones de Seguridad

### 10.1 Almacenamiento Seguro

- Los certificados ARCA se almacenan en `media/arca/certificados/`
- Las claves privadas se almacenan en `media/arca/claves/`
- Los archivos se renombran automáticamente con nombres estándar

### 10.2 Validaciones de Datos

- Validación de formato de CAE
- Validación de fecha de vencimiento
- Validación de tipos de documento
- Validación de importes

---

## 11. Casos de Uso Específicos

### 11.1 Emisión de Factura Fiscal

1. Usuario selecciona "Factura" en el frontend
2. Sistema determina automáticamente letra (A/B/C) según cliente
3. Backend crea venta y emite automáticamente por ARCA
4. CAE, fecha vencimiento y QR se guardan en BD
5. Frontend muestra resultado exitoso

### 11.2 Emisión de Nota de Crédito

1. Usuario selecciona facturas a anular
2. Sistema determina tipo de NC según letras de facturas
3. Backend crea NC y emite automáticamente por ARCA
4. CAE, fecha vencimiento y QR se guardan en BD
5. Frontend muestra resultado exitoso

### 11.3 Comprobante Interno

1. Usuario selecciona "Factura Interna"
2. Backend crea venta sin emisión ARCA
3. No se guarda CAE ni QR
4. Frontend muestra mensaje de comprobante interno

---

## 12. Mantenimiento y Monitoreo

### 12.1 Verificación de CAEs Vencidos

```python
# Consulta para CAEs próximos a vencer
from datetime import date, timedelta
from django.db.models import Q

vencimientos_proximos = Venta.objects.filter(
    ven_cae__isnull=False,
    ven_caevencimiento__lte=date.today() + timedelta(days=30),
    ven_caevencimiento__gt=date.today()
)
```

### 12.2 Limpieza de Datos

```python
# Limpiar CAEs vencidos (opcional)
vencimientos_pasados = Venta.objects.filter(
    ven_cae__isnull=False,
    ven_caevencimiento__lt=date.today()
)
```

---

## Conclusión

El sistema de guardado de CAE en FerreDesk es **completamente automatizado**, **transaccional** y **seguro**. Garantiza que:

1. **Solo los comprobantes que requieren CAE** se emiten por ARCA
2. **Toda la operación es atómica** - si falla ARCA, no se guarda la venta
3. **Los datos se almacenan correctamente** en los campos específicos del modelo
4. **El QR se genera automáticamente** según especificaciones AFIP
5. **El frontend recibe información completa** sobre el resultado de la emisión

El proceso está diseñado para ser **robusto**, **auditable** y **cumplir con las regulaciones fiscales argentinas**. 