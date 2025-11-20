# Plan de Instalador Gráfico para FerreDesk

## 📋 Resumen Ejecutivo

Este documento detalla el análisis y planificación para crear un instalador gráfico tipo wizard para FerreDesk, que permita a los usuarios instalar el sistema de forma completamente automática sin intervención manual, eliminando la necesidad de interactuar con consolas o scripts de línea de comandos.

**Objetivo Principal**: Crear un instalador `.exe` con interfaz gráfica tipo wizard (similar a Inno Setup) que automatice completamente la instalación de FerreDesk en Windows, incluyendo la verificación y activación de características de Windows, instalación de dependencias, descarga del código, configuración e inicio de servicios.

---

## 🎯 Contexto y Situación Actual

### Arquitectura de FerreDesk

FerreDesk es una **aplicación de escritorio local** que funciona como una aplicación web que corre en el navegador. La arquitectura actual es:

```
Windows PC del Usuario
├── Docker Desktop (con WSL2)
│   ├── Contenedor PostgreSQL
│   │   └── Base de datos LOCAL (puerto 5433)
│   └── Contenedor FerreDesk
│       ├── Django Backend (puerto 8000)
│       └── React Frontend (servido por Django)
└── Navegador Web
    └── Accede a http://localhost:8000
```

**Características importantes**:
- Todo corre en la misma máquina (localhost)
- No hay servidores externos ni bases de datos en la nube
- No requiere conexión a internet después de la instalación (excepto para actualizaciones)
- La aplicación se accede desde el navegador en `http://localhost:8000`

### Instalador Actual: `super-install.bat`

El instalador actual (`super-install.bat`) realiza las siguientes tareas:

1. ✅ Verifica permisos de administrador
2. ✅ Instala Chocolatey (gestor de paquetes)
3. ✅ Instala Git
4. ✅ Instala Docker Desktop
5. ✅ Descarga código desde GitHub
6. ✅ Crea archivo `.env` desde `env.example`
7. ✅ Ejecuta `docker-compose up --build -d`
8. ✅ Espera 30 segundos
9. ✅ Verifica que la aplicación responda

**Problemas identificados**:

1. **Intervención manual requerida**: En la línea 139, el script hace una pausa y pide al usuario que verifique manualmente que Docker Desktop esté ejecutándose. No inicia Docker automáticamente ni espera a que esté listo.

2. **Reinicios manuales**: Si Docker Desktop se instala, el script pide al usuario que reinicie y vuelva a ejecutar el script manualmente.

3. **No abre el navegador**: Al finalizar, no abre el navegador automáticamente. El usuario debe hacerlo manualmente.

4. **No verifica características de Windows**: No verifica ni activa automáticamente WSL2, Virtual Machine Platform u otras características necesarias.

5. **Interfaz de consola**: El usuario ve una ventana de consola con texto, lo cual no es la experiencia más amigable.

---

## 🔍 Análisis de Requisitos

### Requisitos del Sistema

Para que FerreDesk funcione correctamente, el sistema debe tener:

1. **Windows 10/11 (64-bit)**
2. **WSL2 habilitado**: Docker Desktop requiere WSL2 para funcionar en Windows
3. **Virtual Machine Platform habilitada**: Necesaria para WSL2
4. **Docker Desktop instalado y ejecutándose**
5. **Git instalado**: Para descargar el código desde GitHub
6. **Chocolatey (opcional)**: Para instalar dependencias automáticamente
7. **Puertos libres**: 8000 (aplicación) y 5433 (PostgreSQL)

### Proceso de Instalación Necesario

El instalador debe realizar las siguientes tareas en orden:

1. **Verificación de sistema**: Comprobar versión de Windows, permisos de administrador
2. **Verificación y activación de características de Windows**: WSL2, Virtual Machine Platform
3. **Actualización de WSL**: Ejecutar `wsl --update` si es necesario
4. **Instalación de dependencias**: Chocolatey, Git, Docker Desktop
5. **Inicio de Docker Desktop**: Verificar que esté ejecutándose, iniciarlo si es necesario, esperar a que esté listo
6. **Descarga del código**: Clonar repositorio desde GitHub
7. **Configuración**: Crear archivo `.env` desde `env.example`
8. **Construcción e inicio**: Ejecutar `docker-compose up --build -d` y esperar a que los servicios estén listos
9. **Verificación**: Comprobar que la aplicación responda en `http://localhost:8000`
10. **Finalización**: Abrir el navegador automáticamente

---

## 💡 Opciones Consideradas

### Opción 1: PowerShell con Windows Forms

**Qué es**: Usar las librerías gráficas nativas de Windows desde PowerShell para crear una ventana con botones, barras de progreso y mensajes.

**Ventajas**:
- No requiere instalar nada adicional (Windows Forms viene con Windows)
- El script puede seguir siendo un solo archivo `.ps1`
- Se integra bien con Windows
- Permite mostrar progreso en tiempo real

**Desventajas**:
- La interfaz es básica (no tan moderna como una web)
- Requiere conocimientos de Windows Forms
- El diseño debe hacerse en código

**Decisión**: No seleccionada. Aunque es funcional, no proporciona la experiencia visual profesional que se busca.

---

### Opción 2: Aplicación WPF con .NET

**Qué es**: Usar Windows Presentation Foundation (WPF) para crear una aplicación de escritorio con interfaz más moderna.

**Ventajas**:
- Interfaz más moderna y personalizable
- Permite animaciones y transiciones
- Mejor experiencia visual

**Desventajas**:
- Requiere compilar una aplicación (no es solo un script)
- Necesita .NET instalado
- Más complejo de mantener
- El usuario debe ejecutar un `.exe` en lugar de un script

**Decisión**: No seleccionada. Aunque permite interfaces modernas, añade complejidad innecesaria.

---

### Opción 3: Aplicación HTML/JavaScript con Electron

**Qué es**: Crear una aplicación de escritorio usando tecnologías web (HTML, CSS, JavaScript) empaquetada con Electron.

**Ventajas**:
- Interfaz muy moderna
- Fácil de diseñar con HTML/CSS
- Puede reutilizar componentes web

**Desventajas**:
- Electron es pesado (requiere Node.js y Chromium)
- El ejecutable resultante es grande (100+ MB)
- Más complejo de desarrollar
- Consume más recursos

**Decisión**: No seleccionada. El tamaño del ejecutable y la complejidad no justifican los beneficios para un instalador.

---

### Opción 4: Instalador Tradicional (Inno Setup / NSIS) ⭐ **SELECCIONADA**

**Qué es**: Usar herramientas como Inno Setup o NSIS para crear un instalador tipo wizard con páginas de bienvenida, términos, selección de componentes, progreso e instalación.

**Cómo funciona**: Se configura un instalador que muestra páginas secuenciales. El instalador ejecuta el script de instalación y muestra el progreso en las páginas del wizard.

**Ventajas**:
- Experiencia familiar para usuarios de Windows
- Aspecto profesional
- Puede incluir desinstalador
- Permite crear un único `.exe`
- Interfaz estándar de Windows que los usuarios reconocen

**Desventajas**:
- Requiere aprender Inno Setup o NSIS
- Más complejo de configurar
- El script de instalación real sigue siendo necesario (el instalador lo ejecuta)

**Decisión**: ✅ **SELECCIONADA**. Proporciona la mejor experiencia de usuario y es el estándar de la industria para instaladores en Windows.

---

### Opción 5: PowerShell con Interfaz HTML Embebida

**Qué es**: Crear una interfaz HTML que se muestra en un navegador embebido dentro de una ventana de PowerShell.

**Ventajas**:
- Interfaz moderna con HTML/CSS
- Fácil de diseñar
- No requiere compilar nada

**Desventajas**:
- Requiere crear archivos HTML/CSS adicionales
- La comunicación entre PowerShell y HTML puede ser compleja

**Decisión**: No seleccionada. Aunque es interesante, añade complejidad sin los beneficios de un instalador tradicional.

---

## 🎨 Solución Final: Instalador con Inno Setup

### ¿Qué es Inno Setup?

Inno Setup es una herramienta gratuita y de código abierto para crear instaladores tipo wizard para Windows. Es el mismo tipo de instalador que se ve en la mayoría de programas de Windows: una ventana con páginas secuenciales, fondo azul con imagen a la izquierda, texto explicativo a la derecha, y botones "Siguiente" y "Cancelar".

### Estructura del Instalador

El instalador tendría las siguientes páginas:

#### 1. Página de Bienvenida
- Mensaje de bienvenida
- Descripción breve de FerreDesk
- Logo/imagen del lado izquierdo

#### 2. Página de Requisitos
- Verifica Windows 10/11
- Verifica permisos de administrador
- Verifica espacio en disco disponible
- Muestra advertencias si algo falta

#### 3. Página de Componentes (Opcional)
- Lista de componentes a instalar:
  - Docker Desktop
  - Git
  - Chocolatey
  - Código de FerreDesk
- Permite seleccionar qué instalar (o todo automático)

#### 4. Página de Ubicación
- Dónde instalar FerreDesk
- Por defecto: `C:\FerreDesk`
- Permite cambiar la ubicación

#### 5. Página de Instalación
- Muestra el progreso de la instalación
- Muestra mensajes de estado en tiempo real:
  - "Verificando características de Windows..."
  - "Instalando Docker Desktop..."
  - "Descargando código desde GitHub..."
  - "Construyendo aplicación..."
- Barra de progreso que se actualiza

#### 6. Página de Finalización
- Mensaje de éxito
- Información de acceso:
  - URL: http://localhost:8000
  - Usuario: admin
  - Contraseña: admin123
- Opción para abrir el navegador automáticamente
- Opción para crear acceso directo en el escritorio

### Funcionalidad del Instalador

El instalador ejecutará un script PowerShell que realizará todas las tareas necesarias:

#### Fase 1: Verificación Inicial del Sistema
- Verifica permisos de administrador
- Verifica versión de Windows (10/11, 64-bit)
- Registra todo en un archivo de log para diagnóstico

#### Fase 2: Verificación y Activación de Características de Windows
- Verifica si WSL2 está instalado (`wsl --status`)
- Si no está, lo instala (`wsl --install`)
- Verifica si "Virtual Machine Platform" está habilitada
- Si no está, la habilita (`Enable-WindowsOptionalFeature`)
- Ejecuta `wsl --update` para actualizar WSL2
- Si alguna característica requiere reinicio, programa reinicio automático o informa al usuario

#### Fase 3: Instalación de Dependencias del Sistema
- Verifica si Chocolatey está instalado
- Si no está, lo instala desde el script oficial
- Verifica si Git está instalado
- Si no está, lo instala con `choco install git -y`
- Verifica si Docker Desktop está instalado
- Si no está, lo instala con `choco install docker-desktop -y`
- Si Docker Desktop requiere reinicio, programa reinicio automático o informa al usuario

#### Fase 4: Inicio y Verificación de Docker Desktop
- Verifica si Docker Desktop está ejecutándose (`docker info`)
- Si no está, busca el ejecutable y lo inicia
- Espera activamente a que Docker esté listo (bucle que verifica cada 5 segundos)
- Muestra mensaje de progreso mientras espera
- Verifica que los puertos 8000 y 5433 estén libres

#### Fase 5: Descarga del Código
- Crea directorio para FerreDesk si no existe
- Verifica si ya existe un repositorio Git
- Si existe, actualiza el código (`git fetch` y `git reset --hard`)
- Si no existe, clona el repositorio desde GitHub
- Verifica que exista la carpeta `ferredesk_v0` y `docker-compose.yml`

#### Fase 6: Configuración del Proyecto
- Navega al directorio `ferredesk_v0`
- Verifica si existe archivo `.env`
- Si no existe pero existe `env.example`, copia `env.example` a `.env`
- Si ya existe `.env`, lo mantiene sin modificarlo

#### Fase 7: Construcción e Inicio de Servicios
- Navega al directorio `ferredesk_v0`
- Ejecuta `docker-compose up --build -d`
- Espera a que los servicios estén listos (bucle que verifica cada 10 segundos)
- Verifica que la aplicación web responda (`Invoke-WebRequest` a `http://localhost:8000`)
- Si no responde después de varios intentos, muestra advertencia pero continúa

#### Fase 8: Finalización y Apertura del Navegador
- Muestra mensaje de éxito con URL y credenciales
- Abre el navegador automáticamente (`Start-Process "http://localhost:8000"`)
- Opcionalmente, crea acceso directo en el escritorio

### Manejo de Errores y Reinicios

El instalador manejará los casos donde se requiere reinicio del sistema:

- Si WSL2 o Docker Desktop requieren reinicio, el script puede:
  - Programar un reinicio automático usando `shutdown /r /t 60` (con un minuto de espera)
  - Guardar el estado de la instalación en un archivo temporal
  - Al reiniciar, detectar este archivo y continuar desde donde se quedó
  - O informar al usuario que debe reiniciar y proporcionar instrucciones claras

### Estructura de Archivos del Proyecto

```
FerreDesk-Installer/
├── installer.iss                    # Script de configuración de Inno Setup
├── install-script.ps1              # Script PowerShell que hace la instalación real
├── logo.bmp                         # Logo para el lado izquierdo del wizard
├── banner.bmp                       # Banner para la página de bienvenida
├── FerreDesk-Installer.exe          # El instalador compilado (resultado final)
└── README.md                        # Instrucciones para compilar
```

### Flujo de Uso del Instalador

1. El usuario descarga `FerreDesk-Installer.exe` desde una página web o repositorio
2. Ejecuta el `.exe` (Windows puede pedir permisos de administrador)
3. Ve el wizard con páginas secuenciales:
   - Bienvenida
   - Requisitos
   - Componentes (opcional)
   - Ubicación
   - Instalación (con progreso en tiempo real)
   - Finalización
4. Durante la instalación, el instalador ejecuta el script PowerShell que:
   - Verifica características de Windows
   - Instala dependencias
   - Descarga el código
   - Configura todo
   - Inicia los servicios
5. Al finalizar, muestra mensaje de éxito y opción para abrir el navegador
6. El usuario puede acceder a FerreDesk en `http://localhost:8000`

---

## 🔧 Implementación Técnica

### Script de Inno Setup (`installer.iss`)

El script de Inno Setup define:
- Las páginas del wizard
- Los archivos a incluir (el script PowerShell)
- Los comandos a ejecutar durante la instalación
- El diseño visual (colores, imágenes, fuentes)
- Las opciones de desinstalación

### Script de Instalación (`install-script.ps1`)

El script PowerShell contiene toda la lógica de instalación:
- Funciones para verificar características de Windows
- Funciones para instalar dependencias
- Funciones para verificar e iniciar Docker
- Funciones para descargar y configurar el código
- Funciones para construir e iniciar servicios
- Manejo de errores y logging
- Comunicación con el instalador para mostrar progreso

### Comunicación entre Inno Setup y PowerShell

Inno Setup puede ejecutar el script PowerShell y capturar su salida para mostrar el progreso en la interfaz del wizard. El script PowerShell puede escribir mensajes de estado que el instalador lee y muestra en la interfaz.

---

## 📦 Distribución del Instalador

### Opción 1: Página Web Simple

Crear una página web simple (HTML estático o GitHub Pages) con:
- Botón de descarga del instalador
- Requisitos del sistema
- Instrucciones básicas
- Información sobre FerreDesk

**Ventajas**:
- Fácil de mantener
- Puede alojarse en GitHub Pages (gratis)
- Accesible desde cualquier lugar

### Opción 2: Repositorio GitHub

Subir el instalador compilado a las releases de GitHub:
- Los usuarios pueden descargarlo desde la página de releases
- GitHub proporciona estadísticas de descargas
- Fácil de versionar

### Opción 3: Distribución Física

El instalador puede copiarse en un pendrive o disco:
- Útil para instalaciones en máquinas sin internet
- Permite distribución offline

---

## ✅ Ventajas de la Solución Final

1. **Experiencia de usuario familiar**: Los usuarios reconocen inmediatamente el tipo de instalador
2. **Instalación completamente automática**: Sin intervención manual del usuario
3. **Interfaz profesional**: Aspecto estándar de Windows
4. **Un solo archivo**: El usuario solo necesita descargar un `.exe`
5. **Manejo de errores robusto**: El instalador puede manejar errores y reinicios
6. **Progreso visible**: El usuario ve qué está pasando en cada momento
7. **Desinstalador incluido**: Puede incluir un desinstalador estándar de Windows

---

## 🚀 Próximos Pasos

1. **Crear el script PowerShell de instalación** (`install-script.ps1`):
   - Implementar todas las fases de instalación
   - Manejo de errores y logging
   - Comunicación con el instalador para mostrar progreso

2. **Crear el script de Inno Setup** (`installer.iss`):
   - Definir las páginas del wizard
   - Configurar el diseño visual
   - Integrar el script PowerShell
   - Configurar opciones de desinstalación

3. **Crear recursos visuales**:
   - Logo para el lado izquierdo del wizard
   - Banner para la página de bienvenida
   - Icono para el instalador

4. **Compilar y probar el instalador**:
   - Compilar el script de Inno Setup
   - Probar en máquinas limpias (sin dependencias instaladas)
   - Probar en máquinas con dependencias ya instaladas
   - Verificar manejo de errores y reinicios

5. **Crear página web de descarga** (opcional):
   - Página simple con botón de descarga
   - Instrucciones básicas
   - Requisitos del sistema

6. **Documentación**:
   - Instrucciones para compilar el instalador
   - Instrucciones para distribuir el instalador
   - Guía de solución de problemas

---

## 📝 Notas Importantes

### Sobre Docker en Windows

Docker Desktop en Windows requiere WSL2 y características de virtualización. El instalador debe verificar y activar estas características automáticamente. Si el sistema requiere reinicio después de activar estas características, el instalador debe manejar esto de forma elegante.

### Sobre la Base de Datos

La base de datos PostgreSQL corre en un contenedor Docker local. No hay bases de datos en la nube. Todo es local en la máquina del usuario.

### Sobre la Aplicación

FerreDesk es una aplicación de escritorio local que se accede desde el navegador en `http://localhost:8000`. No está en internet. El servidor se abre desde Docker, y al hacer clic en el instalador, debe abrirse la página de localhost automáticamente.

### Sobre Actualizaciones

El instalador maneja la descarga del código desde GitHub. Para actualizaciones futuras, se puede crear un script de actualización separado o incluir funcionalidad de actualización en el instalador.

---

## 🎯 Objetivo Final

Crear un instalador `.exe` que el usuario puede descargar, ejecutar, y que automáticamente:
1. Verifica y activa todas las características de Windows necesarias
2. Instala todas las dependencias (Docker, Git, etc.)
3. Descarga el código de FerreDesk
4. Configura y construye la aplicación
5. Inicia los servicios
6. Abre el navegador automáticamente

Todo esto sin que el usuario tenga que:
- Ver una consola
- Ejecutar comandos manualmente
- Verificar nada manualmente
- Intervenir en el proceso

El usuario solo debe:
1. Descargar el instalador
2. Ejecutarlo
3. Hacer clic en "Siguiente" en cada página
4. Esperar a que termine
5. Usar FerreDesk

---

## 📅 Fecha de Creación

Este documento fue creado el día de hoy como resultado de la planificación y análisis realizado para crear un instalador gráfico profesional para FerreDesk.

---

## 🔗 Referencias

- [Inno Setup Documentation](https://jrsoftware.org/ishelp/)
- [PowerShell Documentation](https://docs.microsoft.com/en-us/powershell/)
- [Docker Desktop for Windows](https://docs.docker.com/desktop/windows/)
- [WSL2 Documentation](https://docs.microsoft.com/en-us/windows/wsl/)

---

**Estado del Proyecto**: Planificado  
**Próximo Paso**: Implementación del script PowerShell de instalación y script de Inno Setup

