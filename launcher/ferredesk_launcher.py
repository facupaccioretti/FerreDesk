import tkinter as tk
from tkinter import ttk
import subprocess
import threading
import webbrowser
import os
import sys
import time
from datetime import datetime

CREATE_NO_WINDOW = 0x08000000

class FerreDeskLauncher:
    def __init__(self, root):
        self.root = root
        self.root.title("FerreDesk Launcher")
        self.root.geometry("400x150")
        self.root.resizable(False, False)
        
        # Log en ProgramData
        log_dir = os.path.join(os.environ.get("ProgramData", "C:\\ProgramData"), "FerreDesk", "logs")
        os.makedirs(log_dir, exist_ok=True)
        self.log_file = os.path.join(log_dir, "launcher.log")
        
        self.log(f"Launcher iniciado")
        
        # Icono
        try:
            if getattr(sys, 'frozen', False):
                # Ejecutable compilado - usar recurso empaquetado
                base_path = sys._MEIPASS
                icon_path = os.path.join(base_path, "FerreDesk.ico")
            else:
                # Desarrollo
                icon_path = os.path.join(os.path.dirname(__file__), "..", "instalador", "FerreDesk.ico")
            
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
    
    def launch_process(self):
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


