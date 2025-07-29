# Documentación Sistema ARCA WSFEv1 - FerreDesk

## 📋 Introducción

El sistema ARCA WSFEv1 es la integración de FerreDesk para emitir facturas electrónicas. Este sistema permite que las facturas generadas en FerreDesk sean válidas fiscalmente.

### ¿Qué hace el sistema?
- **Recibe** datos de facturación desde el frontend
- **Valida** que los datos cumplan con las regulaciones fiscales
- **Envía** la información a AFIP para obtener autorización
- **Recibe** el CAE (Código de Autorización Electrónico) de AFIP
- **Genera** el código QR para validación
- **Almacena** toda la información en la base de datos

---

## 🔄 Flujo Completo del Sistema

### 1. Origen de los Datos - Frontend

**¿De dónde vienen los datos?**

Los datos llegan desde los formularios del frontend:

- **VentaForm.js**: Formulario principal de facturación
- **NotaCreditoForm.js**: Formulario de notas de crédito
- **NotaCreditoForm.js**: Formulario de conversion de presupuestos y facturas internas a factura (tambien maneja presupuesto a factura interna pero no nos interesa)
- **PresupuestosManager.js**: Manager del frontend de todos estos formularios

**¿Qué información se recolecta?**
- Datos del cliente (CUIT, razón social, domicilio)
- Productos y cantidades (wsfev1 solo factura totales, no incluye detalle)
- Precios y alícuotas de IVA
- Tipo de comprobante (Factura A, B, C, etc.)
- Punto de venta y número de comprobante

**Ejemplo de datos que llegan:**
```javascript
{
  "cliente_id": 123,
  "productos": [...],
  "tipo_comprobante": "factura",
  "punto_venta": 1,
  "fecha": "2024-01-15"
}
```

### 2. Procesamiento en el Backend - Views

**¿Dónde se reciben los datos?**

En `ferreapps/ventas/views.py`, específicamente en la función `create()` del `VentaViewSet`.

**¿Qué pasa aquí?**
1. Se reciben los datos del frontend
2. Se crea la venta en la base de datos
3. Se calculan los totales e impuestos
4. Se asigna el comprobante fiscal correspondiente
5. **Se activa la emisión ARCA automática**

**Punto clave - Activación ARCA:**
```python
# En views.py línea 265
if debe_emitir_arca(tipo_comprobante):
    resultado_arca = emitir_arca_automatico(venta_creada)
```

**¿Cuándo se activa ARCA?**
- Cuando el tipo de comprobante es "factura" (A, B, C)
- Cuando el tipo de comprobante es "nota_credito"
- **NO** se activa para presupuestos o facturas internas

### 3. Función Principal - emitir_arca_automatico.py

**¿Qué hace este archivo?**

Es el **punto de entrada principal** para la emisión ARCA. Actúa como un coordinador que:

1. **Valida** que el comprobante requiera emisión ARCA
2. **Obtiene** la configuración de la ferretería
3. **Verifica** que esté todo configurado correctamente
4. **Crea** la instancia de FerreDeskARCA
5. **Ejecuta** la emisión automática

**Flujo interno:**
```python
def emitir_arca_automatico(venta):
    # 1. Verificar si debe emitirse
    if not debe_emitir_arca(venta.comprobante.tipo):
        return {"emitido": False, "motivo": "No requiere ARCA"}
    
    # 2. Obtener ferretería
    ferreteria = Ferreteria.objects.first()
    
    # 3. Crear instancia ARCA
    arca = FerreDeskARCA(ferreteria)
    
    # 4. Emitir automáticamente
    resultado = arca.emitir_automatico(venta)
    
    return {"emitido": True, "resultado": resultado}
```

### 4. Orquestador Principal - services/FerreDeskARCA.py

**¿Qué hace este archivo?**

Es el **cerebro del sistema ARCA**. Coordina todos los componentes:

- **WSFEv1Service**: Comunicación con AFIP
- **QRGenerator**: Generación de códigos QR
- **Armador**: Preparación de datos
- **Auth**: Autenticación y tokens

**Funciones principales:**

#### a) `emitir_automatico(venta)`
Esta es la función más importante. Hace todo el proceso:

1. **Obtiene el último número autorizado** de AFIP
2. **Prepara los datos** usando el armador
3. **Envía a AFIP** usando el servicio WSFEv1
4. **Procesa la respuesta** de AFIP
5. **Genera el QR** con los datos
6. **Actualiza la venta** con toda la información

#### b) `obtener_ultimo_numero_autorizado(tipo_cbte)`
Consulta a AFIP cuál es el último número de comprobante autorizado para ese tipo, para poder asignar el siguiente número.

#### c) `generar_qr_comprobante(venta, cae, fecha_vencimiento)`
Genera el código QR que contiene toda la información del comprobante para validación.

### 5. Preparación de Datos - armador_arca.py

**¿Qué hace este archivo?**

Es el **preparador de datos**. Toma la información de la venta y la convierte al formato que AFIP necesita.

**Funciones principales:**

#### a) `armar_payload_arca(venta, cliente, comprobante, venta_calculada, alicuotas_venta)`
Esta función es clave. Convierte los datos de FerreDesk al formato de AFIP:

- **Datos del emisor** (ferretería)
- **Datos del receptor** (cliente)
- **Datos del comprobante** (fecha, tipo, número)
- **Datos de los productos** (descripción, cantidad, precio)
- **Datos de impuestos** (alícuotas de IVA)
- **Datos de comprobantes asociados** (para notas de crédito)

#### b) `_determinar_tipo_documento(tipo_cbte, cuit_cliente, dni_cliente, razon_cliente)`
Determina qué tipo de documento usar según el tipo de comprobante:
- **Factura A**: Requiere CUIT del cliente
- **Factura B/C**: Puede usar CUIT o DNI
- **Notas de crédito**: Misma lógica que las facturas

#### c) `_construir_comprobantes_asociados(datos_comprobante, venta, tipo_cbte)`
Para notas de crédito, construye la lista de facturas que se están anulando. AFIP requiere esta información obligatoriamente.

### 6. Comunicación con AFIP - services/WSFEv1Service.py

**¿Qué hace este archivo?**

Es el **comunicador con AFIP**. Maneja toda la comunicación técnica con los servicios web de AFIP.

**Funciones principales:**

#### a) `fe_comp_ultimo_autorizado(punto_venta, tipo_cbte)`
Consulta a AFIP cuál es el último número autorizado para un tipo de comprobante en un punto de venta específico.

#### b) `fe_cae_solicitar(datos_arca)`
Envía la solicitud de CAE a AFIP con todos los datos del comprobante.

**¿Cómo funciona la comunicación?**
1. Se conecta al servicio web de AFIP usando SOAP
2. Envía los datos en formato XML
3. Recibe la respuesta de AFIP
4. Procesa la respuesta para extraer el CAE o errores

### 7. Autenticación - auth/

**¿Qué hace esta carpeta?**

Maneja toda la autenticación con AFIP. AFIP requiere autenticación especial para cada solicitud.

#### a) **FerreDeskAuth.py**
Maneja la autenticación principal:
- Genera credenciales temporales (tokens)
- Firma digitalmente las solicitudes
- Renueva automáticamente las credenciales

#### b) **TokenManager.py**
Gestiona los tokens de acceso:
- Almacena tokens de forma segura
- Verifica si los tokens están vigentes
- Renueva tokens cuando expiran

**¿Por qué es necesario?**
AFIP requiere que cada solicitud esté firmada digitalmente con certificados específicos. Los tokens son credenciales temporales que permiten hacer solicitudes durante 12 horas.

### 8. Generación de QR - utils/QRGenerator.py

**¿Qué hace este archivo?**

Genera los códigos QR que van en los comprobantes. Estos códigos contienen toda la información del comprobante para validación.

**¿Qué información contiene el QR?**
- Datos del emisor (CUIT, razón social)
- Datos del comprobante (tipo, número, fecha)
- Importes (neto, IVA, total)
- CAE y fecha de vencimiento
- URL de validación

**¿Para qué sirve?**
Cualquier persona puede escanear el QR y verificar que el comprobante es válido en el sitio web de AFIP.

### 9. Configuración - settings_arca.py

**¿Qué hace este archivo?**

Contiene toda la configuración del sistema ARCA:

- **URLs** de los servicios de AFIP (homologación y producción)
- **Mapeo** de tipos de comprobantes
- **Configuración** de timeouts y reintentos
- **Validaciones** requeridas

**Funciones importantes:**

#### a) `debe_emitir_arca(tipo_comprobante)`
Determina si un tipo de comprobante debe emitirse por ARCA:
- **SÍ**: factura, nota_credito
- **NO**: presupuesto, factura_interna, recibo

#### b) `obtener_codigo_arca(tipo_comprobante, letra)`
Convierte el tipo y letra de comprobante al código que AFIP entiende.

### 10. Gestión de Configuración - utils/ConfigManager.py

**¿Qué hace este archivo?**

Maneja la configuración específica para cada ferretería:
- Paths de certificados y claves
- URLs según el modo (homologación/producción)
- Configuración de timeouts
- Configuración de logging

---

## 📊 Flujo de Datos Completo

```
1. USUARIO
   ↓ (Llena formulario)
   
2. FRONTEND (VentaForm.js, NotaCreditoForm.js)
   ↓ (Envía datos)
   
3. BACKEND - views.py
   ↓ (Crea venta y activa ARCA)
   
4. emitir_arca_automatico.py
   ↓ (Coordina el proceso)
   
5. services/FerreDeskARCA.py
   ↓ (Orquesta componentes)
   
6. armador_arca.py
   ↓ (Prepara datos para AFIP)
   
7. services/WSFEv1Service.py
   ↓ (Envía a AFIP)
   
8. AFIP
   ↓ (Responde con CAE)
   
9. utils/QRGenerator.py
   ↓ (Genera QR)
   
10. BASE DE DATOS
    ↓ (Almacena CAE, QR, etc.)
    
11. FRONTEND
    ↓ (Muestra comprobante con CAE)
```

---

## 🔧 Comandos Disponibles

### Configuración y Pruebas

Los comandos están en la carpeta `management/commands/` y se ejecutan con:

```bash
python manage.py [nombre_comando]
```

#### **configurar_arca**
**¿Qué hace?** Configura ARCA para una ferretería por primera vez.

**Comandos disponibles:**
- `python manage.py configurar_arca` - Configuración interactiva completa
- `python manage.py configurar_arca --ferreteria_id=1` - Configuración para ferretería específica
- `python manage.py configurar_arca --modo=HOM` - Configuración en modo homologación

**¿Qué configura?**
- Certificados y claves privadas
- CUIT y razón social
- Punto de venta ARCA
- Modo de operación (homologación/producción)

#### **probar_arca**
**¿Qué hace?** Prueba la conectividad y configuración de ARCA.

**Comandos disponibles:**
- `python manage.py probar_arca` - Prueba completa del sistema
- `python manage.py probar_arca --ferreteria_id=1` - Prueba para ferretería específica
- `python manage.py probar_arca --solo_conectividad` - Solo prueba conexión
- `python manage.py probar_arca --solo_autenticacion` - Solo prueba autenticación

**¿Qué prueba?**
- Conexión con servicios de AFIP
- Autenticación y generación de tokens
- Consulta de parámetros de AFIP
- Validación de certificados

#### **consultar_parametros_afip**
**¿Qué hace?** Consulta los parámetros disponibles en AFIP.

**Comandos disponibles:**
- `python manage.py consultar_parametros_afip` - Consulta todos los parámetros
- `python manage.py consultar_parametros_afip --tipo=comprobantes` - Solo tipos de comprobantes
- `python manage.py consultar_parametros_afip --tipo=documentos` - Solo tipos de documentos
- `python manage.py consultar_parametros_afip --tipo=alicuotas` - Solo alícuotas de IVA

**¿Qué consulta?**
- Tipos de comprobantes disponibles
- Tipos de documentos aceptados
- Alicuotas de IVA vigentes
- Puntos de venta habilitados

#### **emitir_comprobante_prueba**
**¿Qué hace?** Emite un comprobante de prueba para validar el sistema.

**Comandos disponibles:**
- `python manage.py emitir_comprobante_prueba` - Emite factura B de prueba
- `python manage.py emitir_comprobante_prueba --tipo=6` - Emite tipo específico
- `python manage.py emitir_comprobante_prueba --cliente_id=1` - Con cliente específico

**¿Qué emite?**
- Comprobante de prueba con datos mínimos
- Valida todo el flujo completo
- Genera CAE y QR de prueba
- No afecta la numeración real

---

## 🎯 Resumen del Sistema

El sistema ARCA WSFEv1 de FerreDesk es una **integración automática y transparente** que:

1. **Detecta automáticamente** cuando un comprobante requiere emisión fiscal
2. **Prepara los datos** en el formato que AFIP necesita
3. **Se comunica con AFIP** de forma segura y confiable
4. **Obtiene autorización** (CAE) para el comprobante
5. **Genera códigos QR** para validación
6. **Almacena todo** en la base de datos
7. **Mantiene transparencia** para el usuario final


---

## 🔄 Resumen General del Flujo

### Proceso Completo de Emisión de Comprobantes Fiscales

**El sistema procesa los datos de facturación a través de varios archivos específicos**, cada uno con responsabilidades definidas que se ejecutan en secuencia.

**Los formularios del frontend** (VentaForm.js, NotaCreditoForm.js, ConVentaForm.js) recolectan los datos del usuario: información del cliente, productos seleccionados, cantidades, precios, tipo de comprobante y punto de venta. Estos formularios envían toda la información al backend mediante llamadas a la API.

**El archivo views.py** recibe los datos en la función create() del VentaViewSet. Este archivo crea la venta en la base de datos, calcula los totales e impuestos, asigna el comprobante fiscal correspondiente según el tipo de cliente, y determina si el comprobante requiere emisión ARCA. Si es una factura o nota de crédito, activa automáticamente la función emitir_arca_automatico().

**El archivo emitir_arca_automatico.py** verifica que el comprobante requiera emisión fiscal, obtiene la configuración de la ferretería desde la base de datos, valida que los certificados y puntos de venta estén configurados, y crea una instancia de FerreDeskARCA para proceder con la emisión.

**El archivo services/FerreDeskARCA.py** coordina todo el proceso de emisión. Este archivo obtiene el último número autorizado de AFIP, prepara los datos usando el armador, envía la solicitud a AFIP, procesa la respuesta, genera el código QR, y actualiza la venta con toda la información recibida.

**El archivo armador_arca.py** transforma los datos de FerreDesk al formato que AFIP requiere. Convierte la información del cliente, productos, precios e impuestos al formato específico de AFIP. Determina el tipo de documento según las regulaciones fiscales y construye la estructura de comprobantes asociados para notas de crédito.

**El archivo services/WSFEv1Service.py** maneja la comunicación técnica con los servicios web de AFIP. Este archivo se conecta a los servidores de AFIP usando SOAP, envía las solicitudes en formato XML, recibe las respuestas, y extrae el CAE o los errores de la respuesta.

**Los archivos de la carpeta auth/** (FerreDeskAuth.py y TokenManager.py) gestionan la autenticación con AFIP. Generan credenciales temporales, firman digitalmente las solicitudes usando certificados, almacenan los tokens de forma segura, y renuevan automáticamente las credenciales cuando expiran.

**El archivo utils/QRGenerator.py** crea los códigos QR que contienen toda la información del comprobante. Estos códigos incluyen datos del emisor, receptor, importes, CAE, fecha de vencimiento y URL de validación para que cualquier persona pueda verificar la validez del documento.

**El archivo settings_arca.py** contiene toda la configuración del sistema: URLs de los servicios de AFIP para homologación y producción, mapeo de tipos de comprobantes, configuraciones de timeouts, validaciones requeridas y funciones que determinan qué comprobantes requieren emisión fiscal.

**El archivo utils/ConfigManager.py** maneja la configuración específica para cada ferretería. Gestiona los paths de certificados y claves privadas, configura las URLs según el modo de operación, establece timeouts de conexión y configura el sistema de logging para cada empresa.

**La base de datos** almacena toda la información final: la venta con sus datos completos, el CAE recibido de AFIP, el código QR generado, la fecha de vencimiento del CAE, y el estado de emisión. El frontend puede entonces mostrar el comprobante completo con toda la información fiscal.

**El resultado final** es que el usuario completa un formulario normal de facturación y obtiene automáticamente un comprobante válido fiscalmente con CAE y código QR, sin necesidad de intervención manual o conocimiento técnico del proceso de emisión fiscal. 