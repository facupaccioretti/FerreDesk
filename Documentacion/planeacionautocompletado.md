# Planificación: Autocompletado de Datos de ARCA en Formulario de Clientes

## 📋 **CONTEXTO DEL PROBLEMA**

### **Objetivo**
Implementar un sistema de autocompletado en el formulario de clientes que:
1. Consulte datos de contribuyentes en ARCA usando su CUIT
2. Mapee automáticamente los datos recibidos a los campos del formulario
3. Autocomplete campos de texto que luego permiten selección (FilterableSelect)

### **Estado Actual del Backend**
- ✅ **Servicio de Constancia de Inscripción**: `WSConstanciaInscripcionService` implementado
- ✅ **Método de consulta**: `FerreDeskARCA.consultar_padron(cuit)` funcional
- ✅ **Autenticación**: Configurada correctamente
- ✅ **Endpoint creado**: `ProcesarCuitArcaAPIView` en `/api/clientes/procesar-cuit-arca/`

## 🔄 **FLUJO COMPLETO DEL AUTOCOMPLETADO**

```
Cliente → Formulario → Completa CUIT → [Enter/Foco] → Dígito Verificador
                                                           ↓
                                                    ¿Es válido?
                                                           ↓
                                                    [SÍ] → Consulta ARCA
                                                           ↓
                                                    ¿Respuesta exitosa?
                                                           ↓
                                                    [SÍ] → Autocompletar campos
                                                    [NO] → Mostrar error ARCA
                                                    [NO] → No hacer nada
```

### **Detalle del Flujo**
1. **Cliente entra al formulario de clientes**
2. **Completa el campo CUIT**
3. **Al presionar Enter o sacar el foco** → se ejecuta el dígito verificador
4. **Si el dígito verificador es válido** → se hace consulta automática a ARCA
5. **ARCA responde con datos** → se autocompletar los campos del formulario
6. **ARCA responde con error** → se informa el error específico (ej: "Id de persona no existe")
7. **Si el dígito verificador es inválido** → no se hace ninguna consulta

## 🔍 **ANÁLISIS REALIZADO**

### **1. Estructura de Respuesta de ARCA**
```json
{
    'datosGenerales': {
        'apellido': 'GRSÜPEEK',
        'nombre': 'POPPUUPE RUKGROK',
        'razonSocial': 'EEE  S.G.S.',
        'domicilioFiscal': {
            'codPostal': '5885',
            'descripcionProvincia': 'CORDOBA',
            'direccion': 'MIGUELETES 401 Piso:2 Dpto:8',
            'localidad': 'QUEBRADA DE LOS POZOS'
        }
    },
    'datosRegimenGeneral': {
        'impuesto': [
            {
                'idImpuesto': '30',
                'descripcionImpuesto': 'IVA',
                'estadoImpuesto': 'AC'
            }
        ]
    },
    'datosMonotributo': {
        'impuesto': [
            {
                'idImpuesto': '20',
                'descripcionImpuesto': 'MONOTRIBUTO',
                'estadoImpuesto': 'AC'
            }
        ]
    }
}
```

### **2. Campos del Modelo Cliente vs Datos de ARCA**

#### ✅ **CORRESPONDENCIA DIRECTA (TEXTOS)**
- `cuit` → `datosGenerales.idPersona`
- `razon` → `datosGenerales.razonSocial` o `datosGenerales.apellido + nombre`
- `fantasia` → Mismo que razón
- `domicilio` → `datosGenerales.domicilioFiscal.direccion`
- `cpostal` → `datosGenerales.domicilioFiscal.codPostal`
- `provincia` → `datosGenerales.domicilioFiscal.descripcionProvincia` (texto directo)
- `localidad` → `datosGenerales.domicilioFiscal.localidad` (texto directo)

#### 🎯 **MAPEO ESPECIAL PARA TIPO IVA**
- `iva` → Mapear `descripcionImpuesto` de ARCA a nombre de TipoIVA en BD

### **3. Tipos de IVA en la Base de Datos**
```json
{
  "TIPOSIVA": [
    {"TIV_ID": 1, "TIV_DENO": "Responsable Inscripto"},
    {"TIV_ID": 4, "TIV_DENO": "Sujeto Exento"},
    {"TIV_ID": 5, "TIV_DENO": "Consumidor Final"},
    {"TIV_ID": 6, "TIV_DENO": "Responsable Monotributo"},
    {"TIV_ID": 13, "TIV_DENO": "Monotributo Social"},
    {"TIV_ID": 16, "TIV_DENO": "Monotributo Trabajador"}
  ]
}
```

## ❓ **DUDAS IDENTIFICADAS Y RESUELTAS**

### **1. ¿Cómo extraer datos de objetos anidados?**
**RESUELTO**: Usar `getattr()` con valores por defecto, siguiendo el patrón de wsfev1:
```python
cuit = getattr(datos_gen, 'idPersona', '')
direccion = getattr(domicilio, 'direccion', '')
```

### **2. ¿Cómo manejar autocompletado de campos?**
**RESUELTO**: Devolver textos en lugar de IDs, el FilterableSelect se encarga de la selección:
```python
# En lugar de buscar IDs, devolver textos
datos_procesados['iva'] = 'Sujeto Exento'  # Texto que coincide con BD
datos_procesados['provincia'] = 'CORDOBA'  # Texto directo de ARCA
```

### **3. ¿Cómo mapear tipos de IVA de ARCA a la BD?**
**RESUELTO**: Crear mapeo por descripción, devolver texto que coincida con BD:
```python
MAPEO_IVA_ARCA = {
    "IVA EXENTO": "Sujeto Exento",
    "MONOTRIBUTO": "Responsable Monotributo", 
    "IVA": "Responsable Inscripto"
}
```

## 🔄 **PLANEAMIENTO PROCEDURAL**

### **Fase 1: Backend (COMPLETADA)**
- ✅ Crear endpoint `ProcesarCuitArcaAPIView`
- ✅ Implementar función `_procesar_datos_arca()`
- ✅ Manejar extracción de datos anidados
- ✅ Configurar URL `/api/clientes/procesar-cuit-arca/`

### **Fase 2: Refactorización Backend (EN PROGRESO)**
- ⏳ **PENDIENTE**: Modificar para devolver textos en lugar de IDs
- ⏳ **PENDIENTE**: Implementar mapeo de tipos de IVA por texto
- ⏳ **PENDIENTE**: Eliminar lógica de búsqueda de ForeignKeys

### **Fase 3: Frontend (PENDIENTE)**
- ⏳ Modificar `ClienteForm.js` para implementar flujo completo
- ⏳ Integrar validación de dígito verificador
- ⏳ Implementar consulta automática a ARCA
- ⏳ Autocompletar campos con datos recibidos
- ⏳ Manejar errores de ARCA

### **Fase 4: Testing (PENDIENTE)**
- ⏳ Probar flujo completo con diferentes tipos de contribuyentes
- ⏳ Verificar autocompletado correcto de campos
- ⏳ Validar manejo de errores y estados

## 🎯 **PRÓXIMOS PASOS**

### **Inmediatos**
1. **Refactorizar backend**: Modificar para devolver textos en lugar de IDs
2. **Implementar mapeo de IVA**: Crear diccionario de mapeo por texto
3. **Eliminar lógica ForeignKeys**: Simplificar el código

### **Siguientes**
1. **Frontend**: Implementar flujo de validación → consulta → autocompletado
2. **Integración**: Conectar validación de CUIT con consulta ARCA
3. **Manejo de errores**: Mostrar mensajes específicos de ARCA

## 📝 **NOTAS IMPORTANTES**

- **Devolver textos, no IDs**: El FilterableSelect maneja la selección automática
- **Mapeo por descripción**: Usar descripciones de ARCA para mapear a nombres de BD
- **Flujo de validación**: Solo consultar ARCA si el dígito verificador es válido
- **Manejo de errores**: Mostrar errores específicos de ARCA al usuario
- **Provincia/Localidad**: Devolver texto directo, sin autocompletado automático

## 🔧 **ARCHIVOS MODIFICADOS/CREADOS**

- ✅ `ferreapps/clientes/views.py` - Endpoint ProcesarCuitArcaAPIView
- ✅ `ferreapps/clientes/urls.py` - URL del endpoint
- ⏳ `planeacionautocompletado.md` - Este archivo de planificación (actualizado)

## 🔌 **CONEXIÓN FRONTEND - DETALLES TÉCNICOS**

### **1. Funcionamiento Actual del Sistema**

#### **Campo CUIT Actual**
```javascript
<input
  name="cuit"
  value={form.cuit}
  onChange={handleChange}
  onBlur={(e) => handleCUITBlur(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
      handleCUITBlur(e.target.value)
    }
  }}
  maxLength={11}
/>
```

#### **Hook useValidacionCUIT Actual**
- **Debounce**: 500ms para evitar múltiples llamadas
- **Endpoint**: `/api/clientes/validar-cuit/`
- **Estados**: `isLoading`, `error`, `resultado`
- **Flujo**: Usuario escribe → [Enter/Blur] → Debounce → Validar → Mostrar resultado

#### **Flujo Actual**
```
Usuario escribe CUIT → [Enter/Blur] → Debounce 500ms → Validar CUIT → Mostrar resultado
```

### **2. Cambios Necesarios para Autocompletado**

#### **Modificar useValidacionCUIT.js**
```javascript
// Agregar nueva función para consultar ARCA
const consultarARCA = useCallback(async (cuit) => {
  if (!cuit || !resultado?.es_valido) return
  
  setIsLoadingARCA(true)
  setErrorARCA(null)
  
  try {
    const response = await fetch(
      `/api/clientes/procesar-cuit-arca/?cuit=${encodeURIComponent(cuit)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        credentials: 'include',
      }
    )
    
    if (!response.ok) {
      throw new Error('Error al consultar ARCA')
    }
    
    const data = await response.json()
    
    if (data.error) {
      setErrorARCA(data.error)
    } else {
      setDatosARCA(data)
    }
    
  } catch (err) {
    setErrorARCA(err.message)
  } finally {
    setIsLoadingARCA(false)
  }
}, [resultado])

// Modificar handleCUITBlur para incluir consulta ARCA
const handleCUITBlur = useCallback(async (cuit) => {
  await validarCUIT(cuit)
  // Si la validación es exitosa, consultar ARCA
  if (resultado?.es_valido) {
    await consultarARCA(cuit)
  }
}, [validarCUIT, resultado, consultarARCA])
```

#### **Modificar ClienteForm.js**
```javascript
// Agregar estados para ARCA
const [datosARCA, setDatosARCA] = useState(null)
const [isLoadingARCA, setIsLoadingARCA] = useState(false)
const [errorARCA, setErrorARCA] = useState(null)

// Función para autocompletar campos
const autocompletarCampos = useCallback((datos) => {
  setForm(prev => ({
    ...prev,
    razon: datos.razon || prev.razon,
    fantasia: datos.fantasia || prev.fantasia,
    domicilio: datos.domicilio || prev.domicilio,
    cpostal: datos.cpostal || prev.cpostal,
    provincia: datos.provincia || prev.provincia,
    localidad: datos.localidad || prev.localidad,
    iva: datos.iva || prev.iva
  }))
}, [])

// Efecto para autocompletar cuando llegan datos de ARCA
useEffect(() => {
  if (datosARCA && !errorARCA) {
    autocompletarCampos(datosARCA)
  }
}, [datosARCA, errorARCA, autocompletarCampos])
```

### **3. Nuevo Flujo Completo**
```
Usuario escribe CUIT → [Enter/Blur] → Debounce 500ms → Validar CUIT → 
¿Válido? → [SÍ] → Consultar ARCA → ¿Éxito? → [SÍ] → Autocompletar campos
                                                    [NO] → Mostrar error ARCA
                              [NO] → Mostrar error CUIT
```

### **4. Estados de UI Necesarios**
- **Validando CUIT**: `isLoadingCUIT` (ya existe)
- **Consultando ARCA**: `isLoadingARCA` (nuevo)
- **Error CUIT**: `errorCUIT` (ya existe)
- **Error ARCA**: `errorARCA` (nuevo)
- **Datos ARCA**: `datosARCA` (nuevo)

### **5. Feedback Visual**
- **CUIT válido + consultando ARCA**: Spinner adicional
- **Error ARCA**: Mensaje específico (ej: "Id de persona no existe")
- **Autocompletado exitoso**: Indicador visual sutil

### **6. Manejo de Errores**
- **CUIT inválido**: Usar sistema actual de tooltip
- **Error de red**: Mensaje genérico de conexión
- **Error ARCA**: Mostrar mensaje específico de ARCA
- **Datos no encontrados**: Mensaje informativo

## 🔧 **ARCHIVOS A MODIFICAR**

- ⏳ `useValidacionCUIT.js` - Agregar consulta ARCA
- ⏳ `ClienteForm.js` - Agregar autocompletado y estados ARCA
- ⏳ `CUITValidacionTooltip.js` - Mostrar estados de ARCA (opcional)

## 📝 **NOTAS IMPORTANTES**

- **Mantener debounce**: Evitar múltiples consultas a ARCA
- **Estados independientes**: CUIT y ARCA tienen sus propios estados
- **Autocompletado no invasivo**: Solo llenar campos vacíos
- **Feedback claro**: Usuario debe saber qué está pasando en cada momento

## 🔄 **PLAN INTENSO: MANEJO DE AUTOCOMPLETADO Y COMUNICACIÓN BACKEND-FRONTEND**

### **1. ANÁLISIS DE LA RESPUESTA DEL BACKEND**

#### **Estructura de Respuesta Actual**
```json
{
  "cuit": "20442740241",
  "razon": "EMPRESA EJEMPLO S.A.",
  "fantasia": "EMPRESA EJEMPLO S.A.",
  "domicilio": "AV. RIVADAVIA 1234",
  "cpostal": "1001",
  "provincia": "CAPITAL FEDERAL",
  "localidad": "CIUDAD AUTONOMA BUENOS AIRES",
  "condicion_iva": "IVA EXENTO",
  "estado_contribuyente": "ACTIVO",
  "mensaje": "Datos obtenidos exitosamente de ARCA"
}
```

#### **Mapeo de Campos del Frontend**
```javascript
// Campos de texto simple (autocompletado directo)
const camposTexto = {
  'razon': 'razon',
  'fantasia': 'fantasia', 
  'domicilio': 'domicilio',
  'cpostal': 'cpostal'
}

// Campos FilterableSelect (requieren coincidencia con opciones)
const camposSelect = {
  'provincia': 'provincia', // Buscar en array provincias
  'localidad': 'localidad', // Buscar en array localidades
  'iva': 'condicion_iva'    // Buscar en array tiposIVA
}
```

### **2. ESTRATEGIA DE AUTOCOMPLETADO POR TIPO DE CAMPO**

#### **A. Campos de Texto Simple**
```javascript
// Autocompletado directo sin validación
const autocompletarCampoTexto = (campo, valor) => {
  setForm(prev => ({
    ...prev,
    [campo]: valor
  }))
}
```

#### **B. Campos FilterableSelect**
```javascript
// Buscar coincidencia en opciones y establecer ID
const autocompletarCampoSelect = (campo, valor, opciones) => {
  const opcionEncontrada = opciones.find(opt => 
    opt.nombre.toLowerCase() === valor.toLowerCase()
  )
  
  if (opcionEncontrada) {
    setForm(prev => ({
      ...prev,
      [campo]: opcionEncontrada.id // FilterableSelect espera ID
    }))
    return true // Coincidencia encontrada
  }
  
  return false // No se encontró coincidencia
}
```

### **3. FLUJO DETALLADO DE COMUNICACIÓN**

#### **Paso 1: Frontend envía consulta**
```javascript
// En useValidacionCUIT.js
const consultarARCA = async (cuit) => {
  setIsLoadingARCA(true)
  setErrorARCA(null)
  
  try {
    const response = await fetch(
      `/api/clientes/procesar-cuit-arca/?cuit=${encodeURIComponent(cuit)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        credentials: 'include',
      }
    )
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.error) {
      setErrorARCA(data.error)
      setDatosARCA(null)
    } else {
      setDatosARCA(data)
      setErrorARCA(null)
    }
    
  } catch (err) {
    setErrorARCA(err.message)
    setDatosARCA(null)
  } finally {
    setIsLoadingARCA(false)
  }
}
```

#### **Paso 2: Frontend recibe y procesa datos**
```javascript
// En ClienteForm.js
const procesarDatosARCA = useCallback((datos) => {
  if (!datos) return
  
  // 1. Autocompletar campos de texto simple
  const camposTexto = ['razon', 'fantasia', 'domicilio', 'cpostal']
  camposTexto.forEach(campo => {
    if (datos[campo] && !form[campo]) { // Solo si está vacío
      autocompletarCampoTexto(campo, datos[campo])
    }
  })
  
  // 2. Autocompletar campos FilterableSelect
  const camposSelect = [
    { campo: 'provincia', valor: datos.provincia, opciones: provincias },
    { campo: 'localidad', valor: datos.localidad, opciones: localidades },
    { campo: 'iva', valor: datos.condicion_iva, opciones: tiposIVA }
  ]
  
  camposSelect.forEach(({ campo, valor, opciones }) => {
    if (valor && !form[campo]) { // Solo si está vacío
      const encontrado = autocompletarCampoSelect(campo, valor, opciones)
      if (!encontrado) {
        // Guardar para mostrar al usuario que no se encontró coincidencia
        setCamposNoEncontrados(prev => ({
          ...prev,
          [campo]: valor
        }))
      }
    }
  })
  
  // 3. Mostrar feedback de autocompletado
  setAutocompletadoExitoso(true)
  setTimeout(() => setAutocompletadoExitoso(false), 3000)
}, [form, provincias, localidades, tiposIVA])
```

#### **Paso 3: Efecto para procesar datos cuando llegan**
```javascript
// En ClienteForm.js
useEffect(() => {
  if (datosARCA && !errorARCA) {
    procesarDatosARCA(datosARCA)
  }
}, [datosARCA, errorARCA, procesarDatosARCA])
```

### **4. MANEJO DE ESTADOS Y FEEDBACK**

#### **Estados Necesarios**
```javascript
const [datosARCA, setDatosARCA] = useState(null)
const [isLoadingARCA, setIsLoadingARCA] = useState(false)
const [errorARCA, setErrorARCA] = useState(null)
const [autocompletadoExitoso, setAutocompletadoExitoso] = useState(false)
const [camposNoEncontrados, setCamposNoEncontrados] = useState({})
```

#### **Feedback Visual por Estado**
```javascript
// 1. Consultando ARCA
{isLoadingARCA && (
  <div className="text-blue-600 text-sm">
    <Spinner /> Consultando datos en ARCA...
  </div>
)}

// 2. Error de ARCA
{errorARCA && (
  <div className="text-red-600 text-sm">
    <AlertIcon /> Error: {errorARCA}
  </div>
)}

// 3. Autocompletado exitoso
{autocompletadoExitoso && (
  <div className="text-green-600 text-sm">
    <CheckIcon /> Datos autocompletados exitosamente
  </div>
)}

// 4. Campos no encontrados
{Object.keys(camposNoEncontrados).length > 0 && (
  <div className="text-orange-600 text-sm">
    <WarningIcon /> Algunos datos no se pudieron mapear:
    {Object.entries(camposNoEncontrados).map(([campo, valor]) => (
      <div key={campo}>• {campo}: {valor}</div>
    ))}
  </div>
)}
```

### **5. MAPEO ESPECÍFICO DE TIPOS DE IVA**

#### **Diccionario de Mapeo**
```javascript
const MAPEO_IVA_ARCA = {
  "IVA EXENTO": "Sujeto Exento",
  "MONOTRIBUTO": "Responsable Monotributo",
  "IVA": "Responsable Inscripto",
  "CONSUMIDOR FINAL": "Consumidor Final",
  "MONOTRIBUTO SOCIAL": "Monotributo Social",
  "MONOTRIBUTO TRABAJADOR": "Monotributo Trabajador"
}

// Función de mapeo
const mapearTipoIVA = (descripcionARCA) => {
  return MAPEO_IVA_ARCA[descripcionARCA] || descripcionARCA
}
```

#### **Autocompletado Especial para IVA**
```javascript
const autocompletarIVA = (descripcionARCA) => {
  const nombreMapeado = mapearTipoIVA(descripcionARCA)
  const tipoIVAEncontrado = tiposIVA.find(tipo => 
    tipo.nombre.toLowerCase() === nombreMapeado.toLowerCase()
  )
  
  if (tipoIVAEncontrado) {
    setForm(prev => ({
      ...prev,
      iva: tipoIVAEncontrado.id
    }))
    return true
  }
  
  return false
}
```

### **6. MANEJO DE ERRORES ESPECÍFICOS**

#### **Tipos de Error de ARCA**
```javascript
const manejarErrorARCA = (error) => {
  switch (error) {
    case "Id de persona no existe":
      return "El CUIT no está registrado en AFIP"
    case "Error de conexión":
      return "No se pudo conectar con AFIP. Intente más tarde"
    case "Servicio no disponible":
      return "El servicio de AFIP no está disponible"
    default:
      return `Error: ${error}`
  }
}
```

### **7. OPTIMIZACIONES Y CONSIDERACIONES**

#### **Debounce y Prevención de Múltiples Consultas**
```javascript
const [ultimaConsulta, setUltimaConsulta] = useState('')

const consultarARCAConDebounce = async (cuit) => {
  if (ultimaConsulta === cuit) return // Evitar consultas duplicadas
  
  setUltimaConsulta(cuit)
  await consultarARCA(cuit)
}
```

#### **Autocompletado No Invasivo**
```javascript
// Solo autocompletar campos vacíos
const soloSiVacio = (valorActual, nuevoValor) => {
  return !valorActual || valorActual.trim() === '' ? nuevoValor : valorActual
}
```

#### **Limpieza de Estados**
```javascript
const limpiarEstadosARCA = () => {
  setDatosARCA(null)
  setErrorARCA(null)
  setAutocompletadoExitoso(false)
  setCamposNoEncontrados({})
}
```

### **8. INTEGRACIÓN CON SISTEMA ACTUAL**

#### **Modificación del Hook Actual**
```javascript
// En useValidacionCUIT.js - Agregar al return
return {
  // ... estados existentes
  datosARCA,
  isLoadingARCA,
  errorARCA,
  consultarARCA,
  limpiarEstadosARCA
}
```

#### **Modificación del ClienteForm**
```javascript
// Extraer nuevos estados del hook
const { 
  resultado, 
  isLoading: isLoadingCUIT, 
  error: errorCUIT,
  datosARCA,
  isLoadingARCA,
  errorARCA,
  consultarARCA,
  limpiarEstadosARCA
} = useValidacionCUIT()
```

### **9. TESTING Y VALIDACIÓN**

#### **Casos de Prueba**
1. **CUIT válido con datos completos** → Autocompletado total
2. **CUIT válido con datos parciales** → Autocompletado parcial
3. **CUIT válido sin coincidencias** → Mostrar campos no encontrados
4. **CUIT inválido** → No consultar ARCA
5. **Error de red** → Mostrar error de conexión
6. **Error de ARCA** → Mostrar error específico

#### **Validación de Datos**
```javascript
const validarDatosARCA = (datos) => {
  const camposRequeridos = ['cuit', 'razon']
  const faltantes = camposRequeridos.filter(campo => !datos[campo])
  
  if (faltantes.length > 0) {
    throw new Error(`Datos incompletos: ${faltantes.join(', ')}`)
  }
  
  return true
}
```
