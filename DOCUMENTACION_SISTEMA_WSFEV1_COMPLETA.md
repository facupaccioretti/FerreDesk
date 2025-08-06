# Documentación Completa del Sistema WSFEv1 - FerreDesk

## 📋 Introducción

El sistema WSFEv1 (Web Service de Facturación Electrónica v1) es la integración completa de FerreDesk con AFIP que permite emitir comprobantes fiscales electrónicos válidos. Este sistema orquesta múltiples componentes para crear un flujo transparente desde el frontend hasta la autorización fiscal.

### ¿Qué logra el sistema?
- **Emisión automática** de facturas fiscales válidas
- **Integración transparente** con el flujo de trabajo del usuario
- **Manejo robusto de errores** y estados de carga
- **Almacenamiento completo** de datos fiscales (CAE, QR, etc.)
- **Compatibilidad total** con regulaciones argentinas

---

## 🔄 Arquitectura del Sistema

### Componentes Principales

#### 1. **Frontend (React)**
- **VentaForm.js**: Formulario principal de facturación
- **ConVentaForm.js**: Formulario de conversión (presupuesto → factura)
- **NotaCreditoForm.js**: Formulario de notas de crédito
- **ArcaEsperaOverlay.js**: Modal de estado durante emisión ARCA
- **useArcaEstado.js**: Hook para manejo del estado ARCA

#### 2. **Backend (Django)**
- **views.py**: Endpoints de la API que reciben los datos
- **emitir_arca_automatico.py**: Función principal de emisión
- **services/FerreDeskARCA.py**: Orquestador principal
- **services/WSFEv1Service.py**: Comunicación con AFIP
- **armador_arca.py**: Preparación de datos para AFIP
- **auth/**: Sistema de autenticación con AFIP
- **utils/**: Utilidades (QR, configuración, etc.)

---

## 🎯 Flujo Completo del Sistema

### Fase 1: Entrada de Datos (Frontend)

```mermaid
graph TB
    A[Usuario llena formulario] --> B[VentaForm/ConVentaForm/NotaCreditoForm]
    B --> C{¿Requiere emisión ARCA?}
    C -->|SÍ| D[useArcaEstado.requiereEmisionArca()]
    C -->|NO| E[Envío normal al backend]
    D --> F[iniciarEsperaArca()]
    F --> G[Mostrar ArcaEsperaOverlay]
    G --> H[Enviar datos al backend]
```

**¿Qué tipos requieren ARCA?**
- `'factura'` → SÍ (Facturas A, B, C)
- `'nota_credito'` → SÍ (Notas de crédito fiscales)
- `'factura_interna'` → NO
- `'presupuesto'` → NO

**Datos que se recopilan:**
```javascript
{
  "tipo_comprobante": "factura",
  "cliente_id": 123,
  "items": [...],
  "totales": {...},
  "ven_cuit": "20123456789",
  "ven_dni": "",
  // ... otros campos
}
```

### Fase 2: Procesamiento Backend (API)

```mermaid
graph TB
    A[views.py recibe datos] --> B[Crear venta en BD]
    B --> C[Calcular totales e impuestos]
    C --> D{¿debe_emitir_arca(tipo)?}
    D -->|SÍ| E[emitir_arca_automatico(venta)]
    D -->|NO| F[Respuesta normal]
    E --> G[FerreDeskARCA.emitir_automatico()]
    G --> H[Respuesta con datos ARCA]
```

**Código clave en views.py:**
```python
# Líneas 264-282
if debe_emitir_arca(tipo_comprobante):
    try:
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

### Fase 3: Emisión ARCA (Componentes Internos)

```mermaid
graph TB
    A[emitir_arca_automatico.py] --> B[Validar configuración ferretería]
    B --> C[FerreDeskARCA.__init__()]
    C --> D[FerreDeskARCA.emitir_automatico()]
    D --> E[obtener_ultimo_numero_autorizado()]
    E --> F[armador_arca.armar_payload_arca()]
    F --> G[WSFEv1Service.fe_cae_solicitar()]
    G --> H[Procesar respuesta AFIP]
    H --> I[QRGenerator.generar_qr()]
    I --> J[Actualizar venta con datos ARCA]
```

### Fase 4: Comunicación con AFIP

```mermaid
graph TB
    A[WSFEv1Service] --> B[FerreDeskAuth - obtener token]
    B --> C[Cliente SOAP - conectar AFIP]
    C --> D[fe_comp_ultimo_autorizado()]
    D --> E[fe_cae_solicitar()]
    E --> F[Procesar respuesta XML]
    F --> G[Extraer CAE y datos]
```

### Fase 5: Respuesta al Frontend

```mermaid
graph TB
    A[Backend responde con datos ARCA] --> B{¿Éxito o Error?}
    B -->|Éxito| C[finalizarEsperaArcaExito()]
    B -->|Error| D[finalizarEsperaArcaError()]
    C --> E[ArcaEsperaOverlay - Estado éxito]
    D --> F[ArcaEsperaOverlay - Estado error]
    E --> G[Mostrar CAE y QR]
    F --> H[Mostrar mensaje de error]
    G --> I[Usuario acepta y cierra]
    H --> I
```

---

## 🛠️ Componentes Detallados

### Frontend Components

#### **VentaForm.js**
```javascript
// Hook principal para ARCA
const {
  esperandoArca,
  respuestaArca,
  errorArca,
  iniciarEsperaArca,
  requiereEmisionArca,
  obtenerMensajePersonalizado
} = useArcaEstado()

// Verificación antes del envío
if (requiereEmisionArca(tipoComprobanteSeleccionado)) {
  iniciarEsperaArca()
}

// Modal de espera
<ArcaEsperaOverlay 
  estaEsperando={esperandoArca}
  mensajePersonalizado={obtenerMensajePersonalizado(tipoComprobante)}
  respuestaArca={respuestaArca}
  errorArca={errorArca}
  onAceptar={handleAceptarResultadoArca}
/>
```

#### **useArcaEstado.js**
Estados manejados:
- `esperandoArca`: Boolean - indica si está esperando respuesta
- `respuestaArca`: Object - datos de éxito de ARCA
- `errorArca`: String - mensaje de error si falló
- `progresoArca`: Number - progreso de 0 a 100

Funciones principales:
- `iniciarEsperaArca()`: Activa el estado de espera
- `finalizarEsperaArcaExito(datos)`: Completa con éxito
- `finalizarEsperaArcaError(error)`: Completa con error
- `requiereEmisionArca(tipo)`: Valida si el tipo requiere ARCA

#### **ArcaEsperaOverlay.js**
Tres estados visuales:
1. **Espera**: Spinner + mensaje "Esperando respuesta de AFIP..."
2. **Éxito**: Checkmark verde + CAE + observaciones
3. **Error**: X roja + mensaje de error detallado

### Backend Components

#### **emitir_arca_automatico.py**
```python
def emitir_arca_automatico(venta: Venta) -> Dict[str, Any]:
    """Punto de entrada principal para emisión automática"""
    
    # 1. Verificar si debe emitirse
    if not debe_emitir_arca(venta.comprobante.tipo):
        return {"emitido": False}
    
    # 2. Obtener y validar ferretería
    ferreteria = Ferreteria.objects.first()
    
    # 3. Crear orquestador ARCA
    arca = FerreDeskARCA(ferreteria)
    
    # 4. Emitir automáticamente
    resultado = arca.emitir_automatico(venta)
    
    return {"emitido": True, "resultado": resultado}
```

#### **services/FerreDeskARCA.py**
```python
def emitir_automatico(self, venta: Venta) -> Dict[str, Any]:
    """Orquesta todo el proceso de emisión"""
    
    # 1. Obtener último número autorizado de AFIP
    numero_afip = self.obtener_ultimo_numero_autorizado(venta.comprobante.codigo_afip)
    
    # 2. Actualizar número de venta
    venta.ven_numero = numero_afip
    venta.save()
    
    # 3. Preparar datos con armador
    datos_arca = armar_payload_arca(venta, cliente, comprobante, venta_calculada, alicuotas_venta)
    
    # 4. Emitir comprobante
    resultado_arca = self.emitir_comprobante(datos_arca, venta.comprobante.codigo_afip)
    
    # 5. Generar QR
    qr_bytes = self.generar_qr_comprobante(venta, resultado_arca['cae'], resultado_arca['fecha_vencimiento'])
    
    # 6. Actualizar venta con datos ARCA
    venta.ven_cae = resultado_arca['cae']
    venta.ven_qr = base64.b64encode(qr_bytes).decode('utf-8')
    venta.save()
    
    return resultado_arca
```

#### **armador_arca.py**
```python
def armar_payload_arca(venta, cliente, comprobante, venta_calculada, alicuotas_venta):
    """Transforma datos de FerreDesk al formato AFIP"""
    
    # Determinar tipo de documento (CUIT/DNI)
    doc_tipo, doc_numero = _determinar_tipo_documento(tipo_cbte, cuit_cliente, dni_cliente)
    
    # Construir estructura base
    datos_comprobante = {
        'CbteTipo': int(comprobante.codigo_afip),
        'PtoVta': punto_venta,
        'Concepto': 1,  # Productos
        'DocTipo': doc_tipo,
        'DocNro': doc_numero,
        'CbteDesde': numero_comprobante,
        'CbteHasta': numero_comprobante,
        'CbteFch': fecha_formato_afip,
        'FchServDesde': None,
        'FchServHasta': None,
        'FchVtoPago': None,
        'MonId': 'PES',
        'MonCotiz': 1.0,
        # ... campos específicos por tipo
    }
    
    return datos_comprobante
```

#### **services/WSFEv1Service.py**
```python
def fe_cae_solicitar(self, datos_arca, tipo_cbte=None, punto_venta=None):
    """Solicita CAE a AFIP usando SOAP"""
    
    # Obtener autenticación
    auth_data = self.auth.get_auth_data()
    
    # Preparar solicitud
    request_data = {
        'Auth': auth_data,
        'FeCAEReq': {
            'FeCabReq': {
                'CantReg': 1,
                'PtoVta': punto_venta,
                'CbteTipo': tipo_cbte
            },
            'FeDetReq': {
                'FECAEDetRequest': [datos_arca]
            }
        }
    }
    
    # Enviar a AFIP
    response = self.send_request('FECAESolicitar', request_data)
    
    return response
```

---

## 🔧 Configuración del Sistema

### Variables de Entorno Requeridas

```bash
# Modo de operación
ARCA_MODO=HOM  # o PROD

# Configuración de ferretería
FERRETERIA_CUIT=20123456789
FERRETERIA_PUNTO_VENTA=1

# Paths de certificados
CERTIFICADO_PATH=/path/to/cert.crt
CLAVE_PRIVADA_PATH=/path/to/private.key
```

### URLs de Servicios AFIP

```python
# settings_arca.py
URLS_AFIP = {
    'HOM': {
        'wsfev1': 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL',
        'wsaa': 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?wsdl'
    },
    'PROD': {
        'wsfev1': 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL',
        'wsaa': 'https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl'
    }
}
```

### Comandos de Gestión

#### Configurar ARCA
```bash
python manage.py configurar_arca
python manage.py configurar_arca --ferreteria_id=1
python manage.py configurar_arca --modo=HOM
```

#### Probar Sistema
```bash
python manage.py probar_arca
python manage.py probar_arca --solo_conectividad
python manage.py probar_arca --solo_autenticacion
```

#### Consultar Parámetros AFIP
```bash
python manage.py consultar_parametros_afip
python manage.py consultar_parametros_afip --tipo=comprobantes
```

#### Emitir Comprobante de Prueba
```bash
python manage.py emitir_comprobante_prueba
python manage.py emitir_comprobante_prueba --tipo=6
```

---

## 📊 Mapeos y Configuraciones

### Tipos de Comprobantes AFIP

```python
TIPOS_COMPROBANTE_AFIP = {
    # Facturas
    1: 'Factura A',
    6: 'Factura B',
    11: 'Factura C',
    
    # Notas de Crédito
    3: 'Nota de Crédito A',
    8: 'Nota de Crédito B',
    13: 'Nota de Crédito C',
    
    # Notas de Débito
    2: 'Nota de Débito A',
    7: 'Nota de Débito B',
    12: 'Nota de Débito C'
}
```

### Condiciones IVA

```python
CONDICIONES_IVA_AFIP = {
    1: 'IVA Responsable Inscripto',
    4: 'IVA Sujeto Exento',
    5: 'Consumidor Final',
    6: 'Responsable Monotributo',
    13: 'Monotributo Social',
    16: 'Monotributo Trabajador Independiente'
}
```

### Alícuotas IVA

```python
ALICUOTAS_IVA_AFIP = {
    3: 0,      # 0%
    4: 10.5,   # 10.5%
    5: 21,     # 21%
    6: 27,     # 27%
    8: 5,      # 5%
    9: 2.5     # 2.5%
}
```

---

## 🚦 Estados y Manejo de Errores

### Estados del Sistema

1. **Inicial**: Sistema listo para recibir datos
2. **Validando**: Verificando datos y configuración
3. **Conectando**: Estableciendo conexión con AFIP
4. **Autenticando**: Obteniendo token de acceso
5. **Consultando**: Obteniendo último número autorizado
6. **Emitiendo**: Enviando comprobante a AFIP
7. **Procesando**: Procesando respuesta de AFIP
8. **Generando QR**: Creando código QR
9. **Completado**: Proceso exitoso
10. **Error**: Proceso fallido

### Tipos de Errores

#### **Errores de Configuración**
- Ferretería no configurada
- Certificados inválidos o vencidos
- Punto de venta no habilitado

#### **Errores de Conectividad**
- Sin conexión a internet
- Servicios AFIP no disponibles
- Timeout de conexión

#### **Errores de Autenticación**
- Token vencido
- Certificado rechazado
- CUIT no habilitado

#### **Errores de Validación**
- Datos de comprobante inválidos
- Cliente sin documentos válidos
- Importes incorrectos

#### **Errores de AFIP**
- Comprobante rechazado
- Numeración incorrecta
- Observaciones críticas

### Manejo de Errores en Frontend

```javascript
// useArcaEstado.js maneja los errores automáticamente
if (errorArca) {
  // ArcaEsperaOverlay mostrará el error
  // Usuario puede cerrar y reintentar
}

// Tipos de errores mostrados al usuario:
const tiposError = {
  'configuracion': 'Error de configuración del sistema',
  'conectividad': 'Error de conexión con AFIP',
  'autenticacion': 'Error de autenticación',
  'validacion': 'Error en los datos del comprobante',
  'afip': 'Comprobante rechazado por AFIP'
}
```

---

## 🔄 Flujo de Datos Completo

### 1. Usuario Interactúa con Frontend

```javascript
// Usuario llena VentaForm
const payload = {
  tipo_comprobante: "factura",
  cliente_id: 123,
  items: [...],
  ven_cuit: "20123456789"
}

// Sistema detecta que requiere ARCA
if (requiereEmisionArca("factura")) {
  iniciarEsperaArca() // Muestra overlay
}

// Envía al backend
await onSave(payload)
```

### 2. Backend Procesa Solicitud

```python
# views.py - VentaViewSet.create()
def create(self, request, *args, **kwargs):
    # Crear venta normal
    response = super().create(request, *args, **kwargs)
    venta_creada = Venta.objects.get(ven_id=response.data['ven_id'])
    
    # Si requiere ARCA, emitir automáticamente
    if debe_emitir_arca(tipo_comprobante):
        resultado_arca = emitir_arca_automatico(venta_creada)
        
        # Agregar datos ARCA a respuesta
        response.data.update({
            'arca_emitido': True,
            'cae': resultado_arca.get('cae'),
            'cae_vencimiento': resultado_arca.get('cae_vencimiento'),
            'qr_generado': resultado_arca.get('qr_generado', False),
            'observaciones': resultado_arca.get('observaciones', [])
        })
    
    return response
```

### 3. Sistema ARCA Ejecuta Proceso

```python
# emitir_arca_automatico.py
def emitir_arca_automatico(venta):
    # 1. Validar configuración
    ferreteria = Ferreteria.objects.first()
    if not ferreteria.modo_arca:
        raise FerreDeskARCAError("No hay configuración ARCA")
    
    # 2. Crear orquestador
    arca = FerreDeskARCA(ferreteria)
    
    # 3. Ejecutar emisión completa
    resultado = arca.emitir_automatico(venta)
    
    return resultado

# services/FerreDeskARCA.py
def emitir_automatico(self, venta):
    # 1. Obtener número de AFIP
    numero_afip = self.obtener_ultimo_numero_autorizado(venta.comprobante.codigo_afip)
    
    # 2. Actualizar venta
    venta.ven_numero = numero_afip
    venta.save()
    
    # 3. Preparar datos
    datos_arca = armar_payload_arca(venta, cliente, comprobante, venta_calculada, alicuotas_venta)
    
    # 4. Emitir en AFIP
    resultado_arca = self.emitir_comprobante(datos_arca, venta.comprobante.codigo_afip)
    
    # 5. Generar QR
    qr_bytes = self.generar_qr_comprobante(venta, resultado_arca['cae'], resultado_arca['fecha_vencimiento'])
    
    # 6. Actualizar BD
    venta.ven_cae = resultado_arca['cae']
    venta.ven_qr = base64.b64encode(qr_bytes).decode('utf-8')
    venta.save()
    
    return resultado_arca
```

### 4. Comunicación con AFIP

```python
# services/WSFEv1Service.py
def fe_cae_solicitar(self, datos_arca, tipo_cbte, punto_venta):
    # 1. Autenticación
    auth_data = self.auth.get_auth_data()
    
    # 2. Preparar solicitud SOAP
    request_data = {
        'Auth': auth_data,
        'FeCAEReq': {
            'FeCabReq': {
                'CantReg': 1,
                'PtoVta': punto_venta,
                'CbteTipo': tipo_cbte
            },
            'FeDetReq': {
                'FECAEDetRequest': [datos_arca]
            }
        }
    }
    
    # 3. Enviar a AFIP
    response = self.send_request('FECAESolicitar', request_data)
    
    # 4. Procesar respuesta
    return self._procesar_respuesta_afip(response)
```

### 5. Frontend Recibe Respuesta

```javascript
// Si todo salió bien
if (response.arca_emitido) {
  finalizarEsperaArcaExito({
    cae: response.cae,
    cae_vencimiento: response.cae_vencimiento,
    observaciones: response.observaciones
  })
}

// Si hubo error
if (error) {
  finalizarEsperaArcaError(error.message)
}

// ArcaEsperaOverlay muestra el resultado final
// Usuario acepta y se cierra la pestaña
```

---

## 🏗️ Estructura de Datos

### Payload Frontend → Backend

```javascript
{
  // Datos básicos
  "tipo_comprobante": "factura",
  "cliente_id": 123,
  "ven_fecha": "2024-01-15",
  "ven_punto": 1,
  
  // Datos del cliente (para ARCA)
  "ven_cuit": "20123456789",
  "ven_dni": "",
  "ven_razon": "Cliente S.A.",
  
  // Items de la venta
  "items": [
    {
      "vdi_idpro": 456,
      "vdi_cantidad": 2,
      "vdi_precio": 100.0,
      "vdi_idali": 5  // Alícuota IVA
    }
  ],
  
  // Totales (calculados por frontend)
  "ven_neto": 200.0,
  "ven_iva": 42.0,
  "ven_total": 242.0
}
```

### Payload Backend → AFIP

```python
{
    'CbteTipo': 6,  # Factura B
    'PtoVta': 1,
    'Concepto': 1,  # Productos
    'DocTipo': 80,  # CUIT
    'DocNro': 20123456789,
    'CbteDesde': 123,
    'CbteHasta': 123,
    'CbteFch': '20240115',
    'MonId': 'PES',
    'MonCotiz': 1.0,
    'ImpTotal': 242.0,
    'ImpTotConc': 0.0,
    'ImpNeto': 200.0,
    'ImpOpEx': 0.0,
    'ImpIVA': 42.0,
    'ImpTrib': 0.0,
    'Iva': [
        {
            'Id': 5,  # 21%
            'BaseImp': 200.0,
            'Importe': 42.0
        }
    ]
}
```

### Respuesta AFIP → Backend

```python
{
    'CAE': '74857401234567',
    'CAEFchVto': '20240125',
    'CbteDesde': 123,
    'CbteHasta': 123,
    'FchProceso': '20240115124500',
    'Observaciones': [
        {
            'Code': 10016,
            'Msg': 'La fecha de vencimiento del CAE es 20240125'
        }
    ],
    'Resultado': 'A'  # A=Aprobado, R=Rechazado
}
```

### Respuesta Backend → Frontend

```javascript
{
  // Datos normales de la venta
  "ven_id": 789,
  "ven_numero": 123,
  "ven_total": 242.0,
  
  // Datos específicos de ARCA
  "arca_emitido": true,
  "cae": "74857401234567",
  "cae_vencimiento": "2024-01-25",
  "qr_generado": true,
  "observaciones": [
    "La fecha de vencimiento del CAE es 2024-01-25"
  ]
}
```

---

## 🎯 Puntos Clave del Sistema

### Características Principales

1. **Transparencia Total**: El usuario no necesita conocimiento técnico del proceso fiscal
2. **Automatización Completa**: Detección automática de qué comprobantes requieren emisión
3. **Manejo Robusto**: Transacciones atómicas - si ARCA falla, toda la venta se revierte
4. **Estados Visuales**: Feedback claro durante todo el proceso
5. **Recuperación**: Capacidad de reintentar emisiones fallidas

### Flujo de Seguridad

- **Transacciones atómicas**: Si ARCA falla, se revierte toda la venta
- **Validación previa**: Verificación de configuración antes de enviar
- **Autenticación robusta**: Tokens firmados digitalmente
- **Logging completo**: Trazabilidad total del proceso

### Optimizaciones

- **Reutilización de tokens**: Los tokens de AFIP duran 12 horas
- **Conexiones persistentes**: Cliente SOAP reutilizable
- **Caching de configuración**: Configuración cargada una vez por instancia
- **Async donde sea posible**: Operaciones no bloqueantes

---

## 🚀 Casos de Uso

### Caso 1: Factura B Normal
1. Usuario llena VentaForm con cliente consumidor final
2. Selecciona productos y cantidades
3. Sistema detecta que es "factura" → requiere ARCA
4. Muestra overlay "Esperando autorización de AFIP..."
5. Backend emite automáticamente en AFIP
6. Responde con CAE y QR
7. Overlay muestra éxito con CAE
8. Usuario acepta y venta queda registrada

### Caso 2: Nota de Crédito
1. Usuario abre NotaCreditoForm
2. Selecciona facturas a anular
3. Sistema valida que todas sean de la misma letra
4. Detecta "nota_credito" → requiere ARCA
5. Envía con comprobantes asociados
6. AFIP valida y emite CAE
7. Nota queda vinculada a facturas originales

### Caso 3: Conversión Presupuesto → Factura
1. Usuario convierte presupuesto usando ConVentaForm
2. Selecciona tipo "factura" en lugar de "factura_interna"
3. Sistema detecta cambio → requiere ARCA
4. Emite automáticamente durante la conversión
5. Presupuesto queda convertido con CAE válido

### Caso 4: Manejo de Errores
1. Usuario envía factura con datos incorrectos
2. AFIP rechaza el comprobante
3. Sistema revierte toda la transacción
4. Overlay muestra error específico
5. Usuario corrige datos y reintenta
6. Segunda emisión exitosa

---

## 📈 Métricas y Monitoreo

### Logs Generados

```python
# Ejemplos de logs del sistema
logger.info(f"Iniciando emisión automática ARCA para venta {venta.ven_id}")
logger.info(f"Número actualizado para venta {venta.ven_id}: {numero_afip}")
logger.info(f"Comprobante emitido exitosamente: CAE {cae}")
logger.error(f"Error en emisión automática ARCA: {error}")
```

### Puntos de Monitoreo

1. **Tiempo de respuesta AFIP**: Medir latencia de servicios
2. **Tasa de éxito**: Porcentaje de emisiones exitosas
3. **Errores por tipo**: Clasificar errores para identificar patrones
4. **Uso de tipos de comprobante**: Estadísticas de facturas A/B/C
5. **Volumen por punto de venta**: Distribución de emisiones

### Alertas Recomendadas

- CAE próximos a vencer
- Errores de conectividad recurrentes
- Certificados próximos a vencer
- Volumen inusual de rechazos

---

## 🔧 Mantenimiento

### Tareas Periódicas

1. **Renovación de certificados** (anual)
2. **Actualización de parámetros AFIP** (según cambios normativos)
3. **Limpieza de logs** (mensual)
4. **Backup de configuración** (semanal)
5. **Pruebas de conectividad** (diaria)

### Comandos de Diagnóstico

```bash
# Verificar estado general
python manage.py probar_arca

# Consultar últimos números autorizados
python manage.py consultar_parametros_afip --tipo=numeracion

# Validar certificados
python manage.py validar_certificados

# Limpiar logs antiguos
python manage.py limpiar_logs_arca --dias=30
```

---

## 📋 Checklist de Implementación

### Pre-requisitos
- [ ] Certificado AFIP válido y vigente
- [ ] CUIT habilitado para facturación electrónica
- [ ] Punto de venta configurado en AFIP
- [ ] Conexión estable a internet

### Configuración Inicial
- [ ] Ejecutar `python manage.py configurar_arca`
- [ ] Verificar URLs de servicios (HOM/PROD)
- [ ] Probar conectividad: `python manage.py probar_arca`
- [ ] Emitir comprobante de prueba

### Validación Frontend
- [ ] VentaForm detecta correctamente tipos que requieren ARCA
- [ ] ArcaEsperaOverlay se muestra durante emisión
- [ ] Estados de éxito y error funcionan correctamente
- [ ] useArcaEstado maneja transiciones de estado

### Validación Backend
- [ ] emitir_arca_automatico se ejecuta automáticamente
- [ ] Transacciones atómicas funcionan (rollback en errores)
- [ ] Datos ARCA se agregan correctamente a respuestas
- [ ] Logging completo está activo

### Validación Integración
- [ ] Comunicación SOAP con AFIP funciona
- [ ] Autenticación automática exitosa
- [ ] CAE se obtiene y almacena correctamente
- [ ] QR se genera y guarda en base de datos

---

Este sistema WSFEv1 representa una integración fiscal completa y robusta que automatiza totalmente el proceso de emisión de comprobantes electrónicos, manteniendo la transparencia para el usuario final mientras cumple con todas las regulaciones argentinas.