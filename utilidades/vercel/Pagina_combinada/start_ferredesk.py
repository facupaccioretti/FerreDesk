import os
import sys
import time
import webbrowser
import subprocess
import psutil
import tkinter as tk
from tkinter import messagebox
from threading import Thread

def kill_process_on_port(port):
    for proc in psutil.process_iter(['pid', 'name', 'connections']):
        try:
            for conn in proc.connections():
                if conn.laddr.port == port:
                    proc.kill()
                    return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return False

def start_django_server():
    os.chdir('pagina_combinada_backend')
    subprocess.Popen(['python', 'manage.py', 'runserver'], 
                    creationflags=subprocess.CREATE_NEW_CONSOLE)

def start_nextjs_server():
    os.chdir('pagina-combinada_frontend')
    subprocess.Popen(['npm', 'run', 'dev'], 
                    creationflags=subprocess.CREATE_NEW_CONSOLE)

def create_gui():
    root = tk.Tk()
    root.title("FerreDesk Launcher")
    root.geometry("400x300")
    
    # Estilo
    root.configure(bg='#f0f0f0')
    
    # Título
    title = tk.Label(root, 
                    text="FerreDesk", 
                    font=('Arial', 24, 'bold'),
                    bg='#f0f0f0',
                    fg='#2c3e50')
    title.pack(pady=20)
    
    # Botón de inicio
    start_button = tk.Button(root,
                           text="Iniciar FerreDesk",
                           command=lambda: start_application(root),
                           font=('Arial', 12),
                           bg='#3498db',
                           fg='white',
                           padx=20,
                           pady=10,
                           relief=tk.RAISED,
                           borderwidth=0)
    start_button.pack(pady=20)
    
    # Estado
    status_label = tk.Label(root,
                          text="Listo para iniciar",
                          font=('Arial', 10),
                          bg='#f0f0f0',
                          fg='#7f8c8d')
    status_label.pack(pady=10)
    
    return root, status_label

def start_application(root, status_label):
    try:
        # Actualizar estado
        status_label.config(text="Iniciando servidores...", fg='#e67e22')
        root.update()
        
        # Matar procesos existentes
        if kill_process_on_port(8000):
            print("Puerto 8000 liberado")
        if kill_process_on_port(3000):
            print("Puerto 3000 liberado")
        
        # Iniciar servidores
        start_django_server()
        time.sleep(5)
        
        start_nextjs_server()
        time.sleep(5)
        
        # Abrir navegador
        webbrowser.open('http://localhost:3000')
        
        # Actualizar estado
        status_label.config(text="¡FerreDesk está en ejecución!", fg='#27ae60')
        
    except Exception as e:
        messagebox.showerror("Error", f"Error al iniciar FerreDesk: {str(e)}")
        status_label.config(text="Error al iniciar", fg='#c0392b')

def main():
    # Crear GUI
    root, status_label = create_gui()
    
    # Iniciar aplicación automáticamente
    Thread(target=lambda: start_application(root, status_label)).start()
    
    # Mantener ventana abierta
    root.mainloop()

if __name__ == "__main__":
    main() 