# Plan: FerreDesk GUI Launcher

## Objetivo
Crear un launcher gráfico que reemplace la experiencia de consola negra por una interfaz amigable con feedback visual.

## Estructura de Archivos

```
FerreDesk/
└── launcher/
    ├── ferredesk_launcher.py   # Código fuente
    ├── build.bat               # Script para generar .exe
    └── requirements.txt        # Dependencias (solo pyinstaller)
```

El `.exe` compilado se copiará a `{app}\launcher\` durante la instalación.

---

## Diseño de Interfaz

```
┌─────────────────────────────────────┐
│         FerreDesk Launcher          │
├─────────────────────────────────────┤
│                                     │
│   [████████████████████░░░░░]       │  ← Marquee/Progress
│                                     │
│   Iniciando Docker Desktop...       │  ← Status label
│                                     │
└─────────────────────────────────────┘
```

- Ventana: 400x150px, sin redimensionar, centrada
- Sin ícono de consola (flag `--noconsole` en PyInstaller)
- Logo de FerreDesk opcional en header

---

## Flujo de Ejecución

1. Verificar si Docker está corriendo (`docker info`)
2. Si no → Iniciar Docker Desktop y esperar (max 120s)
3. Verificar servicios (`docker-compose ps`)
4. Si no activos → Ejecutar `docker-compose up -d`
5. Abrir navegador en `http://localhost:8000`
6. Cerrar launcher

---

## Implementación

### 1. `ferredesk_launcher.py`

**Funciones principales:**

| Función | Descripción |
|---------|-------------|
| `check_docker()` | Ejecuta `docker info`, retorna bool |
| `start_docker()` | Lanza Docker Desktop.exe |
| `wait_for_docker()` | Polling cada 5s hasta 120s |
| `check_services()` | `docker-compose ps \| findstr Up` |
| `start_services()` | `docker-compose up -d` |
| `open_browser()` | `webbrowser.open("http://localhost:8000")` |
| `update_status(msg)` | Actualiza label de estado |

**Ejecución en thread separado** para no bloquear la UI.

### 2. `build.bat`

```batch
@echo off
pyinstaller --onefile --noconsole --icon=../instalador/FerreDesk.ico ferredesk_launcher.py
copy dist\ferredesk_launcher.exe ..\instalador\
```

### 3. Cambios en `ferredesk-1.0.0-installer.iss`

```pascal
[Files]
Source: "ferredesk_launcher.exe"; DestDir: "{app}\launcher"; Flags: ignoreversion

[Icons]
Name: "{commondesktop}\FerreDesk"; Filename: "{app}\launcher\ferredesk_launcher.exe"; IconFilename: "{app}\FerreDesk.ico"
```

---

## Dependencias de Desarrollo

Solo necesario en la máquina donde se compila:
- Python 3.8+
- PyInstaller (`pip install pyinstaller`)

**El usuario final NO necesita Python** - recibe el `.exe` ya compilado.

---

## Pasos de Implementación

1. [ ] Crear `launcher/ferredesk_launcher.py`
2. [ ] Crear `launcher/build.bat`
3. [ ] Compilar `.exe` localmente
4. [ ] Modificar `.iss` para incluir launcher
5. [ ] Probar flujo completo

---

## Consideraciones

- **Antivirus:** PyInstaller genera ejecutables que algunos AV marcan. Solución: firmar digitalmente.
- **Tamaño:** ~10-15MB (incluye runtime de Python)
- **Compatibilidad:** Windows 10/11 x64
