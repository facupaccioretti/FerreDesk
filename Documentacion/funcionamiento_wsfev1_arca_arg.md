# Funcionamiento de wsfev1 con arca_arg

## 🏗️ Arquitectura General

**arca_arg** funciona como un **puente inteligente** entre tu aplicación y los servicios web de AFIP. Es como tener un **intérprete especializado** que sabe hablar el lenguaje de AFIP y traduce tus solicitudes al formato correcto.

### Concepto Clave
La librería actúa como un **asistente experto** que conoce todos los detalles técnicos de la comunicación con AFIP y te permite enfocarte solo en tus datos de negocio.

## 🔧 Componentes Principales

### 1. ArcaWebService - El Coordinador Principal
Es el **cerebro** de la operación. Cuando creas una instancia de esta clase, ella:

- **Se conecta** al servicio web de AFIP usando la URL del WSDL
- **Inicializa** el sistema de autenticación
- **Prepara** todo lo necesario para comunicarse con AFIP
- **Mantiene** la conexión activa durante toda la sesión

### 2. ArcaAuth - El Guardián de la Seguridad
Es el **sistema de seguridad** que maneja toda la autenticación. Su trabajo es:

- **Generar credenciales temporales** (tokens) que AFIP reconoce
- **Firmar digitalmente** las solicitudes usando tu certificado
- **Renovar automáticamente** las credenciales cuando expiran
- **Almacenar** las credenciales de forma segura

### 3. LoginTicket - El Pasaporte Temporal
Son las **credenciales de acceso** que AFIP te da. Contienen:

- **Token único** que identifica tu sesión
- **Firma digital** que verifica la autenticidad
- **Fecha de expiración** (generalmente 12 horas)
- **Información** sobre qué servicios puedes usar

### 4. Settings - El Archivo de Configuración
Es el **manual de instrucciones** que le dice a arca_arg:

- **Dónde encontrar** tu certificado y clave privada
- **Cuál es tu CUIT**
- **Si usar** el entorno de pruebas o producción
- **Las URLs** de todos los servicios disponibles

## 🔄 Flujo Completo para wsfev1

### Fase 1: Preparación y Configuración
Cuando inicias arca_arg para wsfev1, el sistema:

1. **Lee la configuración** desde el archivo settings
2. **Valida que existan** tu certificado y clave privada
3. **Se conecta al servicio** wsfev1 usando la URL del WSDL
4. **Inicializa el sistema de autenticación** para el servicio específico

### Fase 2: Autenticación Automática
Antes de poder enviar facturas, arca_arg debe autenticarse:

1. **Verifica si ya tiene credenciales válidas** almacenadas localmente
2. **Si no las tiene o están expiradas**, inicia el proceso de autenticación:
   - Crea una solicitud de acceso (TRA) con tu información
   - Firma digitalmente esta solicitud usando tu certificado
   - Envía la solicitud firmada al servicio de autenticación de AFIP
   - Recibe las credenciales temporales (token y firma)
   - Almacena estas credenciales para uso futuro

### Fase 3: Preparación de la Factura
Cuando quieres enviar una factura electrónica:

1. **Estructura los datos** de la factura según el formato que requiere AFIP
2. **Agrega la información de autenticación** (token, firma, CUIT)
3. **Valida que todos los campos requeridos** estén presentes
4. **Prepara el mensaje SOAP** que se enviará a AFIP

### Fase 4: Envío y Procesamiento
El momento de la verdad:

1. **Envía la solicitud** al servicio wsfev1 de AFIP
2. **AFIP procesa la factura** y realiza todas las validaciones
3. **AFIP responde** con el resultado del procesamiento
4. **arca_arg recibe la respuesta** y la estructura en un formato fácil de usar

### Fase 5: Manejo de la Respuesta
Dependiendo de la respuesta de AFIP:

**Si la factura fue aprobada:**
- Recibes un **CAE** (Código de Autorización Electrónico)
- Recibes la **fecha de vencimiento** del CAE
- Recibes todos los **datos de la factura** procesada

**Si la factura fue rechazada:**
- Recibes **códigos de error** específicos
- Recibes **descripciones** de qué está mal
- Puedes **corregir los errores** y reintentar

## 🔄 Renovación Automática de Credenciales

### 1. Verificación de Expiración
El sistema **constantemente verifica** si las credenciales están por expirar:

**¿Cómo funciona?**
- Cada vez que necesitas usar las credenciales, el sistema compara la hora actual con la hora de expiración
- Si la hora actual es mayor o igual a la hora de expiración, considera que expiró
- Incluso **antes de que expire completamente**, el sistema renueva (hay un margen de seguridad de 10 minutos)

### 2. Proceso de Renovación Automática
Cuando el sistema detecta que las credenciales están expiradas:

1. **Automáticamente** inicia el proceso de renovación
2. **Crea una nueva solicitud** de autenticación (TRA)
3. **Firma digitalmente** la solicitud con tu certificado
4. **Envía la solicitud** al servicio de autenticación de AFIP
5. **Recibe nuevas credenciales** (nuevo token y firma)
6. **Reemplaza las credenciales viejas** con las nuevas
7. **Continúa la operación** sin interrupciones

### 3. Margen de Seguridad
El sistema es **preventivo**:
- Renueva las credenciales **10 minutos antes** de que expiren
- Esto evita interrupciones en medio de operaciones
- Garantiza que siempre tengas credenciales válidas

## 💾 Almacenamiento Local de Credenciales

### 1. Ubicación de Almacenamiento
Las credenciales se guardan en:
```
TA_FILES_PATH + nombre_servicio + ".pkl"
```

**Ejemplo:**
- Si `TA_FILES_PATH = "data/"`
- Y el servicio es `"wsfe"`
- El archivo será: `"data/wsfe.pkl"`

### 2. Formato de Almacenamiento
El sistema usa **pickle** para serializar los objetos:

**¿Qué se almacena?**
- **Token completo** de autenticación
- **Firma digital** de verificación
- **Fecha de expiración** exacta
- **Datos XML** originales de la respuesta

### 3. Estructura de Datos Almacenada
Cada archivo .pkl contiene un objeto `LoginTicket` con:
- `token`: El token de acceso actual
- `sign`: La firma digital actual
- `expires`: Timestamp de expiración
- `xml`: Respuesta XML completa de AFIP
- `tree`: Árbol XML parseado

## 🔄 Flujo Completo de Renovación y Almacenamiento

### Paso 1: Verificación Inicial
El sistema intenta cargar credenciales existentes desde el archivo local.

### Paso 2: Verificación de Validez
Verifica si las credenciales están expiradas comparando la hora actual con la hora de expiración.

### Paso 3: Renovación Automática
Si están expiradas:
1. Crea nueva solicitud de autenticación
2. Firma la solicitud con tu certificado
3. Envía a AFIP
4. Recibe nuevas credenciales
5. Almacena las nuevas credenciales
6. Guarda localmente en el archivo .pkl

## 🎯 Características Especiales

### Gestión Automática de Credenciales
arca_arg es **inteligente** con las credenciales:
- **Reutiliza credenciales** válidas sin pedir nuevas
- **Renueva automáticamente** cuando están por expirar
- **Maneja errores** de autenticación de forma transparente
- **Almacena localmente** para no repetir el proceso

### Manejo de Errores Robusto
El sistema está preparado para:
- **Errores de red** y reconexión automática
- **Credenciales expiradas** y renovación automática
- **Errores de AFIP** con mensajes claros
- **Problemas de certificados** con validaciones

### Flexibilidad de Configuración
Puedes cambiar fácilmente entre:
- **Entorno de pruebas** para desarrollo
- **Entorno de producción** para uso real
- **Diferentes certificados** según el contexto
- **Diferentes servicios** sin cambiar el código

## 🎯 Ciclo de Vida de una Sesión

1. **Inicio**: Configuración y conexión inicial
2. **Autenticación**: Obtención de credenciales (si es necesario)
3. **Operación**: Envío de facturas y recepción de respuestas
4. **Mantenimiento**: Renovación automática de credenciales
5. **Finalización**: Cierre de sesión (automático)

## ✅ Ventajas del Sistema

### Renovación Automática:
- ✅ **Transparente**: No necesitas hacer nada manual
- ✅ **Preventiva**: Renueva antes de que expire
- ✅ **Continua**: No interrumpe operaciones
- ✅ **Inteligente**: Solo renueva cuando es necesario

### Almacenamiento Local:
- ✅ **Persistente**: Las credenciales sobreviven reinicios
- ✅ **Eficiente**: No repite autenticación innecesariamente
- ✅ **Seguro**: Usa tu certificado para firmar
- ✅ **Organizado**: Un archivo por servicio

### Simplicidad para el Usuario:
- ✅ **No necesitas entender** PKCS#7
- ✅ **No necesitas manejar** tokens manualmente
- ✅ **No necesitas conocer** los detalles de SOAP

### Confiabilidad:
- ✅ **Manejo automático** de errores
- ✅ **Renovación automática** de credenciales
- ✅ **Validaciones automáticas** de datos

### Flexibilidad:
- ✅ **Misma interfaz** para todos los servicios
- ✅ **Fácil cambio** entre entornos
- ✅ **Configuración centralizada**

## 📋 Ejemplo Práctico

**Escenario:** Usas arca_arg por primera vez para wsfev1

1. **Primera vez**: No existe `data/wsfe.pkl`
2. **Autenticación**: El sistema crea credenciales nuevas
3. **Almacenamiento**: Guarda en `data/wsfe.pkl`
4. **Uso**: Usa las credenciales para enviar facturas
5. **Renovación**: 11 horas y 50 minutos después, renueva automáticamente
6. **Actualización**: Reemplaza `data/wsfe.pkl` con nuevas credenciales
7. **Continuidad**: Todo funciona sin interrupciones

## 🎯 Resumen

**arca_arg maneja toda la complejidad de la autenticación de forma transparente, garantizando que siempre tengas credenciales válidas sin que tengas que preocuparte por renovarlas manualmente.**

La librería actúa como un **asistente experto** que:
- Conoce todos los detalles técnicos de la comunicación con AFIP
- Te permite enfocarte solo en tus datos de negocio
- Maneja automáticamente la autenticación y renovación
- Almacena de forma segura las credenciales
- Proporciona una interfaz simple y confiable

**En resumen, arca_arg es la solución completa para integrar tu aplicación con los servicios web de AFIP de manera eficiente, segura y sin complicaciones.** 