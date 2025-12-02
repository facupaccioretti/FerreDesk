## Resumen del trabajo sobre el instalador automático de FerreDesk

### Objetivo general
- Construir un instalador totalmente automatizado para Windows que oculte la consola al usuario final y ofrezca una experiencia estilo wizard (Inno Setup), manteniendo el script `FerreDesk-Installer.ps1` como núcleo de toda la lógica pesada.

### Evolución del script FerreDesk-Installer.ps1
- Se consolidó la instalación en un único script robusto, capaz de ejecutarse con parámetros (`InstallDirectory`, `Silent`, `LogPath`, `ProgressFile`, `NoOpenBrowser`, `Phase`, `StateFile`, `Resume`, `Repair`, `Update`, `Reinstall`).
- Elevación de privilegios al inicio y relanzamiento automático con `RunAs`.
- Sistema de logging centralizado (`Write-Log`, `Write-ErrorLog`, `trap` global) apuntando a `%ProgramData%\FerreDesk\logs\FerreDesk-Installer.log`.
- Gestión de características de Windows (WSL, VirtualMachinePlatform, HypervisorPlatform) con detección de reinicio requerido.
- Flujo completo de WSL2 (instalación, actualización, verificación de versión y readiness).
- Instalación de Chocolatey dentro de un proceso limpio de PowerShell, con reintentos y salida detallada.
- Instalación y verificación de Git + Docker Desktop vía Chocolatey, mostrando la salida en vivo y avisando cuando se necesita reinicio externo.
- Rutinas activas para iniciar Docker Desktop, esperar al Engine (`docker info`, timeouts extendidos) y validar puertos (8000, 5433).
- Gestión del código fuente: clon/actualización del repo, copia de `.env`, uso condicional de builds precompiladas de React para evitar consumos de memoria.
- Secuencia de `docker-compose --progress=auto build` + `docker-compose up -d`, con forzado de BuildKit y flush de buffers para mostrar progreso real.
- Verificación de la aplicación (`Test-ApplicationResponding`) y finalización automática (abrir navegador salvo `-NoOpenBrowser`).
- Implementación de fases (`Invoke-Phase1/2/3` + modos Repair/Update/Reinstall) y estados persistentes con archivo JSON + registro.

### Manejo de estados y reinicios
- Estados persistidos: `FASE_1` (dependencias), `FASE_2` (esperar Docker tras reinicio), `FASE_3` (app FerreDesk) y `COMPLETO`.
- Archivo JSON (`StateFile`) más claves en el registro (`SOFTWARE\FerreDesk\Installer`) con sincronización y resolución de inconsistencias basada en la fase más baja.
- Códigos de salida estandarizados: éxito, error general, reinicio requerido (3010), Docker no disponible, instalación existente.
- Al detectar reinicio necesario se solicita confirmación, se registra `RunOnce` y se detiene la ejecución con mensaje claro.

### Integración con Inno Setup (FerreDesk-Setup.iss)
- Estructura del instalador gráfico preparada para ejecutar el script PowerShell por fases y reaccionar a los códigos de salida.
- Creación condicional de la página `ExistingInstallPage` (opciones: Reparar, Actualizar, Abrir, Reinstalar) usando la firma correcta de `CreateInputOptionPage`.
- Botón “Ver log” en la página final para abrir `%ProgramData%\FerreDesk\logs\FerreDesk-Installer.log`.
- Lectura de estado desde JSON y registro, con lógica para RunOnce, detección de `/RESUME` y consistencia de fases.
- Manejo de `CurStepChanged` para ejecutar el flujo, registrar/desregistrar RunOnce y mostrar mensajes específicos (reinicio, problemas con Docker, errores generales).
- Página de desinstalación con checkbox para eliminar volúmenes Docker, y comandos `UninstallRun` para detener contenedores y borrar volúmenes opcionalmente.

### Errores detectados y correcciones destacadas
- `CreateInputOptionPage`: se corrigió la cantidad de parámetros para Inno 6.6.1 (6 argumentos) eliminando la asignación manual a `SubCaption`.
- Eliminación de funciones no soportadas (`CreateTimer`, `KillTimer`, `CmdLineParamExists`, `StringChangeEx`, `Copy` con tres parámetros), reemplazándolas por utilidades compatibles (p. ej. `GetSubStr`).
- Ajustes en `[UninstallRun]` escapando llaves dobles para evitar `Invalid number of parameters`.
- Sustitución de variables `string` por `AnsiString` en `LoadStringFromFileQuiet`.
- Reescritura de extractores JSON (`ExtractJsonString`, `ExtractJsonBool`) para evitar funciones no disponibles.
- Corrección del flujo `CurStepChanged` para cerrar adecuadamente el bloque `if` antes del `else if ssPostInstall`.
- Mensajes específicos cuando Docker no está listo, y manejo del wizard de Docker Desktop (EULA inicial) mediante instrucciones al usuario desde Inno.

### Estrategia de actualización y coexistencia
- Instalaciones existentes (`COMPLETO`) disparan la página de opciones para elegir: Reparar (fuerza fases internas), Actualizar (git pull + reconstrucción), Reinstalar (sin tocar DB), o abrir FerreDesk.
- Docker previamente instalado por el usuario se respeta; solo se verifica disponibilidad del Engine y se guía al usuario en caso de bloqueo por el asistente inicial de Docker Desktop.
- Modo Reinstalación limpia: ejecuta `docker-compose down`, conserva volúmenes a menos que se elija eliminarlos desde el desinstalador, vuelve a correr todas las fases desde cero.

### Logging y soporte
- Ruta fija del log: `%ProgramData%\FerreDesk\logs\FerreDesk-Installer.log`, accesible desde Inno (botón y mensaje final).
- Se enfatiza que, ante errores (EXIT_ERROR o problemas de Docker), el usuario debe remitir ese log para soporte.
- Todos los comandos críticos (Chocolatey, Docker, Git) muestran output en tiempo real para evitar la sensación de congelamiento.

### Consideraciones especiales documentadas
- Al primer arranque de Docker Desktop puede aparecer un asistente/EULA: se instruye al usuario para aceptarlo y dejar la ventana abierta hasta que el script detecte que `docker info` responde.
- Para instalaciones dentro de VMware Workstation se documenta la necesidad de habilitar virtualización anidada y las características de Windows antes de correr Docker Desktop.
- Se mantiene la prohibición de hardcodear datos o colores fuera de los hooks/constantes definidos por el proyecto.

### Próximos pasos sugeridos
- Finalizar la compilación de `FerreDesk-Setup.exe` con la versión estable del script y probar el flujo completo (FASE 0 → 3) incluyendo reinicio automático.
- Validar la ruta de registro y JSON cuando múltiples usuarios ejecutan el instalador en la misma máquina.
- Documentar en la wiki interna cómo desinstalar componentes externos (Chocolatey, Git, Docker, WSL) para equipos que necesiten limpieza completa.

