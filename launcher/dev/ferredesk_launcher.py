import tkinter as tk
from tkinter import ttk, messagebox
import subprocess
import threading
import webbrowser
import os
import sys
import time
import re
import json
import urllib.request
from datetime import datetime

CREATE_NO_WINDOW = 0x08000000

# ========================================
# CONFIGURACIÓN DE ACTUALIZACIÓN (DEV)
# ========================================
DOCKERHUB_REPO = "lautajuare/ferredesk_dev"
DOCKERHUB_API_URL = f"https://registry.hub.docker.com/v2/repositories/{DOCKERHUB_REPO}/tags"
UPDATE_CHECK_TIMEOUT = 10  # segundos

# Rutas de búsqueda para configuración
POSSIBLE_CONFIG_DIRS = [
    os.path.join(os.environ.get("LocalAppData", ""), "Programs", "FerreDesk", "ferredesk"),
    os.path.join(os.environ.get("ProgramData", "C:\\ProgramData"), "FerreDesk", "ferredesk")
]

# Determinar directorio de configuración
FERREDESK_CONFIG_DIR = POSSIBLE_CONFIG_DIRS[0] # Default
for _dir in POSSIBLE_CONFIG_DIRS:
    if os.path.exists(os.path.join(_dir, ".env")):
        FERREDESK_CONFIG_DIR = _dir
        break
# ========================================

class FerreDeskLauncher:
    def __init__(self, root):
        self.root = root
        self.root.title("FerreDesk Launcher (DEV)")
        self.root.geometry("400x150")
        self.root.resizable(False, False)
        
        # Log en ProgramData
        log_dir = os.path.join(os.environ.get("ProgramData", "C:\\ProgramData"), "FerreDesk", "logs")
        os.makedirs(log_dir, exist_ok=True)
        self.log_file = os.path.join(log_dir, "launcher.log")
        
        self.log(f"Launcher iniciado (DEV)")
        self.log(f"Usando repositorio: {DOCKERHUB_REPO}")
        
        # Icono
        try:
            if getattr(sys, 'frozen', False):
                # Ejecutable compilado - usar recurso empaquetado
                base_path = sys._MEIPASS
                icon_path = os.path.join(base_path, "FerreDesk.ico")
            else:
                # Desarrollo
                icon_path = os.path.join(os.path.dirname(__file__), "..", "..", "instalador", "dev", "FerreDesk.ico")
            
            if os.path.exists(icon_path):
                self.root.iconbitmap(icon_path)
                self.log(f"Icon loaded from: {icon_path}")
            else:
                self.log(f"Icon not found at: {icon_path}")
        except Exception as e:
            self.log(f"Error loading icon: {e}")
        
        # Centrar ventana
        self.root.update_idletasks()
        x = (self.root.winfo_screenwidth() // 2) - (400 // 2)
        y = (self.root.winfo_screenheight() // 2) - (150 // 2)
        self.root.geometry(f"400x150+{x}+{y}")
        
        header = tk.Label(root, text="FerreDesk Launcher", font=("Arial", 14, "bold"))
        header.pack(pady=10)
        
        self.progress = ttk.Progressbar(root, mode='indeterminate', length=350)
        self.progress.pack(pady=10)
        
        self.status_label = tk.Label(root, text="Iniciando...", font=("Arial", 10))
        self.status_label.pack(pady=10)
        
        self.progress.start(10)
        threading.Thread(target=self.launch_process, daemon=True).start()
    
    def log(self, message):
        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(f"[{timestamp}] {message}\n")
        except:
            pass
    
    def update_status(self, message):
        self.status_label.config(text=message)
        self.root.update()
        self.log(message)
    
    # ========================================
    # SISTEMA DE ACTUALIZACIÓN
    # ========================================
    
    def get_installed_version(self):
        """
        Lee la versión instalada desde el archivo .env
        Retorna: string con la versión (ej: "1.0.0") o None si no existe
        """
        try:
            env_path = os.path.join(FERREDESK_CONFIG_DIR, ".env")
            if not os.path.exists(env_path):
                self.log(f"Archivo .env no encontrado en: {env_path}")
                return None
            
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith('FERREDESK_VERSION='):
                        version = line.split('=', 1)[1].strip()
                        self.log(f"Versión instalada: {version}")
                        return version
            
            self.log("FERREDESK_VERSION no encontrado en .env")
            return None
        except Exception as e:
            self.log(f"Error leyendo versión instalada: {e}")
            return None
    
    def get_latest_dockerhub_version(self):
        """
        Consulta DockerHub para obtener la última versión disponible
        Retorna: string con la versión o None si hay error
        """
        try:
            self.log("Consultando DockerHub para versión más reciente...")
            
            # Consultar API de DockerHub
            req = urllib.request.Request(
                f"{DOCKERHUB_API_URL}?page_size=100",
                headers={'Accept': 'application/json', 'User-Agent': 'FerreDesk-Launcher/1.0'}
            )
            
            with urllib.request.urlopen(req, timeout=UPDATE_CHECK_TIMEOUT) as response:
                data = json.loads(response.read().decode())
            
            # Filtrar tags que sean versiones semánticas (X.Y.Z)
            version_pattern = re.compile(r'^\d+\.\d+\.\d+$')
            
            versions = []
            for tag in data.get('results', []):
                tag_name = tag.get('name', '')
                if version_pattern.match(tag_name):
                    versions.append(tag_name)
            
            if not versions:
                self.log("No se encontraron versiones válidas en DockerHub")
                return None
            
            # Ordenar versiones y obtener la más reciente
            versions.sort(key=lambda v: [int(x) for x in v.split('.')], reverse=True)
            latest = versions[0]
            
            self.log(f"Última versión en DockerHub: {latest}")
            self.log(f"Todas las versiones encontradas: {versions}")
            return latest
            
        except urllib.error.URLError as e:
            self.log(f"Error de red consultando DockerHub: {e}")
            return None
        except Exception as e:
            self.log(f"Error consultando DockerHub: {e}")
            return None
    
    def compare_versions(self, v1, v2):
        """
        Compara dos versiones en formato X.Y.Z
        Retorna: -1 si v1 < v2, 0 si v1 == v2, 1 si v1 > v2
        """
        try:
            parts1 = [int(x) for x in v1.split('.')]
            parts2 = [int(x) for x in v2.split('.')]
            
            for i in range(max(len(parts1), len(parts2))):
                p1 = parts1[i] if i < len(parts1) else 0
                p2 = parts2[i] if i < len(parts2) else 0
                
                if p1 < p2:
                    return -1
                elif p1 > p2:
                    return 1
            
            return 0
        except:
            return 0
    
    def check_for_updates(self):
        """
        Verifica si hay actualizaciones disponibles
        Retorna: (hay_actualizacion, version_actual, version_nueva) o (False, None, None)
        """
        try:
            self.update_status("Verificando actualizaciones...")
            
            current_version = self.get_installed_version()
            if not current_version:
                self.log("No se pudo determinar versión instalada")
                return False, None, None
            
            latest_version = self.get_latest_dockerhub_version()
            if not latest_version:
                self.log("No se pudo consultar versión más reciente")
                return False, None, None
            
            # Comparar versiones
            comparison = self.compare_versions(current_version, latest_version)
            
            if comparison < 0:
                self.log(f"¡Actualización disponible! {current_version} -> {latest_version}")
                return True, current_version, latest_version
            else:
                self.log(f"FerreDesk está actualizado (v{current_version})")
                return False, current_version, latest_version
                
        except Exception as e:
            self.log(f"Error verificando actualizaciones: {e}")
            return False, None, None
    
    def show_update_dialog(self, current_version, new_version):
        """
        Muestra diálogo preguntando si desea actualizar
        Retorna: True si el usuario acepta, False si rechaza
        """
        message = f"Hay una nueva versión disponible de FerreDesk\n\n"
        message += f"Versión actual: {current_version}\n"
        message += f"Nueva versión: {new_version}\n\n"
        message += "¿Deseas actualizar ahora?"
        
        result = messagebox.askyesno(
            "Actualización Disponible",
            message,
            icon='info'
        )
        
        self.log(f"Usuario {'aceptó' if result else 'rechazó'} actualización")
        return result
    
    def perform_update(self, new_version):
        """
        Ejecuta el proceso de actualización
        """
        try:
            # Guardar versión actual para limpiar después
            old_version = self.get_installed_version()
            
            self.update_status(f"Descargando versión {new_version}...")
            
            # Descargar nueva imagen
            new_image = f"{DOCKERHUB_REPO}:{new_version}"
            self.log(f"Ejecutando: docker pull {new_image}")
            
            result = subprocess.run(
                ["docker", "pull", new_image],
                capture_output=True,
                text=True,
                timeout=600,  # 10 minutos
                creationflags=CREATE_NO_WINDOW
            )
            
            if result.returncode != 0:
                self.log(f"Error en docker pull: {result.stderr}")
                self.show_error("Error descargando actualización")
                return False
            
            self.log("Imagen descargada exitosamente")
            self.update_status("Actualizando configuración...")
            
            # Actualizar .env
            env_path = os.path.join(FERREDESK_CONFIG_DIR, ".env")
            if os.path.exists(env_path):
                with open(env_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                with open(env_path, 'w', encoding='utf-8') as f:
                    for line in lines:
                        if line.startswith('FERREDESK_VERSION='):
                            f.write(f'FERREDESK_VERSION={new_version}\n')
                            self.log(f"Actualizado FERREDESK_VERSION a {new_version}")
                        else:
                            f.write(line)
            
            self.update_status("Reiniciando servicios...")
            
            # Recrear contenedores con nueva versión
            self.log(f"Ejecutando docker-compose up -d --force-recreate en {FERREDESK_CONFIG_DIR}")
            
            result = subprocess.run(
                ["docker-compose", "up", "-d", "--force-recreate"],
                capture_output=True,
                text=True,
                timeout=180,  # 3 minutos
                cwd=FERREDESK_CONFIG_DIR,
                creationflags=CREATE_NO_WINDOW
            )
            
            if result.returncode != 0:
                self.log(f"Error en docker-compose: {result.stderr}")
                # Intentar continuar de todos modos
            
            self.update_status("Esperando servicios...")
            time.sleep(10)  # Esperar a que los servicios inicien
            
            # LIMPIEZA: Borrar imagen vieja
            if old_version and old_version != new_version:
                try:
                    self.log(f"Limpiando imagen anterior: {old_version}...")
                    old_image = f"{DOCKERHUB_REPO}:{old_version}"
                    subprocess.run(
                        ["docker", "rmi", old_image],
                        capture_output=True,
                        creationflags=CREATE_NO_WINDOW
                    )
                    self.log("Limpieza completada")
                except Exception as cleanup_error:
                    self.log(f"No se pudo borrar imagen vieja (no crítico): {cleanup_error}")
            
            self.log(f"Actualización a v{new_version} completada exitosamente")
            return True
            
        except subprocess.TimeoutExpired:
            self.log("Timeout durante actualización")
            self.show_error("La actualización tardó demasiado")
            return False
        except Exception as e:
            self.log(f"Error durante actualización: {e}")
            self.show_error(f"Error durante actualización: {str(e)}")
            return False
    
    # ========================================
    # FUNCIONES DE DOCKER
    # ========================================
    
    def check_docker(self):
        try:
            result = subprocess.run(["docker", "info"], 
                                  capture_output=True, 
                                  timeout=5,
                                  creationflags=CREATE_NO_WINDOW)
            return result.returncode == 0
        except Exception as e:
            self.log(f"Error checking docker: {e}")
            return False
    
    def start_docker(self):
        # Intentar primero con com.docker.cli.exe (backend sin GUI)
        docker_cli_paths = [
            os.path.join(os.environ.get("ProgramFiles", ""), "Docker", "Docker", "resources", "bin", "com.docker.cli.exe"),
            os.path.join(os.environ.get("ProgramFiles(x86)", ""), "Docker", "Docker", "resources", "bin", "com.docker.cli.exe"),
        ]
        
        for path in docker_cli_paths:
            if os.path.exists(path):
                self.log(f"Starting Docker CLI from: {path}")
                subprocess.Popen([path, "-command", "start"], creationflags=CREATE_NO_WINDOW)
                return True
        
        # Fallback: Docker Desktop.exe normal
        docker_paths = [
            os.path.join(os.environ.get("ProgramFiles", ""), "Docker", "Docker", "Docker Desktop.exe"),
            os.path.join(os.environ.get("ProgramFiles(x86)", ""), "Docker", "Docker", "Docker Desktop.exe"),
            os.path.join(os.environ.get("LocalAppData", ""), "Docker", "Docker Desktop.exe")
        ]
        
        for path in docker_paths:
            if os.path.exists(path):
                self.log(f"Starting Docker Desktop from: {path}")
                subprocess.Popen([path], creationflags=CREATE_NO_WINDOW)
                return True
        
        self.log("Docker not found")
        return False
    
    def wait_for_docker(self, timeout=120):
        self.update_status("Esperando Docker Desktop...")
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            if self.check_docker():
                self.log("Docker is ready")
                return True
            time.sleep(5)
        
        self.log("Docker timeout")
        return False
    
    def check_ferredesk_containers(self):
        try:
            result = subprocess.run(["docker", "ps", "--filter", "name=ferredesk", "--format", "{{.Names}}"], 
                                  capture_output=True, 
                                  text=True,
                                  timeout=10,
                                  creationflags=CREATE_NO_WINDOW)
            
            containers = result.stdout.strip().split('\n')
            running = [c for c in containers if c]
            
            self.log(f"FerreDesk containers running: {running}")
            return len(running) >= 2  # Esperamos al menos 2 (app + postgres)
        except Exception as e:
            self.log(f"Error checking containers: {e}")
            return False
    
    def start_ferredesk_containers(self):
        try:
            self.log("Starting FerreDesk containers")
            
            # Obtener todos los contenedores de FerreDesk (incluso detenidos)
            result = subprocess.run(["docker", "ps", "-a", "--filter", "name=ferredesk", "--format", "{{.Names}}"], 
                         capture_output=True,
                         text=True,
                         timeout=10,
                         creationflags=CREATE_NO_WINDOW)
            
            containers = result.stdout.strip().split('\n')
            containers = [c for c in containers if c]
            
            if not containers:
                self.log("No FerreDesk containers found")
                return False
            
            # Iniciar cada contenedor
            for container in containers:
                self.log(f"Starting container: {container}")
                subprocess.run(["docker", "start", container], 
                             capture_output=True,
                             timeout=30,
                             creationflags=CREATE_NO_WINDOW)
            
            time.sleep(10)
            return True
        except Exception as e:
            self.log(f"Error starting containers: {e}")
            return False
    
    # ========================================
    # PROCESO PRINCIPAL
    # ========================================
    
    def launch_process(self):
        try:
            # PASO 1: Verificar actualizaciones
            has_update, current_ver, new_ver = self.check_for_updates()
            
            if has_update:
                # Mostrar diálogo de actualización (debe ejecutarse en thread principal)
                self.root.after(0, lambda: self._handle_update(current_ver, new_ver))
                return
            
            # Continuar con flujo normal
            self._continue_launch()
            
        except Exception as e:
            self.log(f"Fatal error: {e}")
            self.show_error(f"Error: {str(e)}")
    
    def _handle_update(self, current_ver, new_ver):
        """Maneja el diálogo de actualización en el thread principal"""
        if self.show_update_dialog(current_ver, new_ver):
            # Usuario aceptó actualizar - ejecutar en thread separado
            threading.Thread(target=lambda: self._do_update_and_continue(new_ver), daemon=True).start()
        else:
            # Usuario rechazó - continuar normalmente
            threading.Thread(target=self._continue_launch, daemon=True).start()
    
    def _do_update_and_continue(self, new_ver):
        """Ejecuta la actualización y luego continúa con el lanzamiento"""
        if self.perform_update(new_ver):
            self.log("Actualización exitosa, continuando con lanzamiento")
        else:
            self.log("Actualización falló, continuando con versión actual")
        
        self._continue_launch()
    
    def _continue_launch(self):
        """Continúa con el proceso normal de lanzamiento"""
        try:
            if not self.check_docker():
                self.update_status("Iniciando Docker Desktop...")
                if not self.start_docker():
                    self.show_error("No se encontró Docker Desktop")
                    return
                
                if not self.wait_for_docker():
                    self.show_error("Docker no inició a tiempo")
                    return
            
            self.update_status("Verificando contenedores...")
            if not self.check_ferredesk_containers():
                self.update_status("Iniciando FerreDesk...")
                if not self.start_ferredesk_containers():
                    self.show_error("Error al iniciar contenedores")
                    return
            
            self.update_status("Abriendo FerreDesk...")
            time.sleep(2)
            webbrowser.open("http://localhost:8000")
            
            time.sleep(1)
            self.log("Launcher completed successfully")
            self.root.quit()
            
        except Exception as e:
            self.log(f"Fatal error: {e}")
            self.show_error(f"Error: {str(e)}")
    
    def show_error(self, message):
        self.progress.stop()
        self.status_label.config(text=message, fg="red")
        self.log(f"ERROR: {message}")
        self.root.after(5000, self.root.quit)

if __name__ == "__main__":
    root = tk.Tk()
    app = FerreDeskLauncher(root)
    root.mainloop()
