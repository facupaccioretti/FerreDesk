import os
import django
import sys
import subprocess
from datetime import datetime

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ferredesk_backend.settings.dev')
django.setup()

from ferreapps.sistema.services.backup_service import _proceso_backup_interno, ESTADO_BACKUP
from tenants.models import EmpresaTenant

def verificar_backup_aislado(schema_name, other_schema_name):
    print(f"\n--- Iniciando verificación de backup para: {schema_name} ---")
    
    _proceso_backup_interno(schema_name=schema_name)
    estado = ESTADO_BACKUP
    
    if estado['estado'] != 'EXITO':
        print(f"[X] FALLO en backup de {schema_name}: {estado.get('error')}")
        return False
        
    print(f"[OK] Backup completado con EXITO. Última ejecución: {estado['ultima_ejecucion']}")
    
    # Buscar el dump generado
    base_backups = os.path.join(django.conf.settings.BASE_DIR, "backups_locales")
    files = [f for f in os.listdir(base_backups) if f.startswith(f"backup_{schema_name}_") and f.endswith(".dump")]
    if not files:
        print(f"[X] FALLO: No se encontró el archivo .dump para {schema_name}")
        return False
        
    files.sort(key=lambda x: os.path.getmtime(os.path.join(base_backups, x)), reverse=True)
    latest_dump = os.path.join(base_backups, files[0])
    
    print(f"[OK] Naming correcto detectado: {files[0]}")
    
    # Inspeccionar con pg_restore -l
    print(f"Inspeccionando contenido interno con pg_restore...")
    try:
        # Usamos subprocess run para obtener el TOC
        pg_restore_path = "pg_restore" if os.name != 'nt' else "pg_restore.exe" # Podriamos buscar en PATH, intentamos generico
        # Intentamos buscar en las rutas estándar de Windows si falla
        try:
            result = subprocess.run([pg_restore_path, "-l", latest_dump], capture_output=True, text=True, check=True)
        except (FileNotFoundError, subprocess.CalledProcessError):
            program_files = os.environ.get('ProgramW6432', 'C:\\Program Files')
            pg_path = os.path.join(program_files, 'PostgreSQL')
            found = False
            for version in ['16', '15', '14', '13', '12', '11', '10']:
                pg_restore_exe = os.path.join(pg_path, version, 'bin', 'pg_restore.exe')
                if os.path.exists(pg_restore_exe):
                    pg_restore_path = pg_restore_exe
                    found = True
                    break
            if found:
                result = subprocess.run([pg_restore_path, "-l", latest_dump], capture_output=True, text=True, check=True)
            else:
                print(f"[X] FALLO: No se encontró pg_restore.")
                return False

        toc_lines = result.stdout.split('\n')
        
        has_schema_data = False
        has_other_schema_data = False
        has_public_data = False
        
        for line in toc_lines:
            if f"SCHEMA - {schema_name}" in line or f"TABLE {schema_name}" in line or f"TABLE DATA {schema_name}" in line:
                has_schema_data = True
            if f"SCHEMA - {other_schema_name}" in line or f"TABLE {other_schema_name}" in line or f"TABLE DATA {other_schema_name}" in line:
                has_other_schema_data = True
            if f"SCHEMA - public" in line or f"TABLE public" in line or f"TABLE DATA public" in line:
                has_public_data = True
                
        if has_schema_data:
            print(f"[OK] El backup contiene elementos del schema {schema_name}")
        else:
            print(f"[X] FALLO: No se encontraron elementos del schema {schema_name} en el backup")
            return False
            
        if not has_other_schema_data:
            print(f"[OK] AISLAMIENTO: El backup no contiene elementos del schema {other_schema_name}")
        else:
            print(f"[X] FALLO DE AISLAMIENTO: Se filtraron datos de {other_schema_name} en el backup de {schema_name}")
            return False
            
        if not has_public_data:
            print(f"[OK] AISLAMIENTO: El backup no contiene elementos del schema public")
        else:
            print(f"[X] FALLO DE AISLAMIENTO: Se filtraron datos operacionales de public en el backup de {schema_name}")
            return False
            
        return True
    except Exception as e:
        print(f"[X] Error ejecutando pg_restore: {e}")
        return False

def verificar_politica_public():
    print(f"\n--- Iniciando verificación de política de backup para 'public' ---")
    _proceso_backup_interno(schema_name='public')
    estado = ESTADO_BACKUP
    if estado['estado'] == 'ERROR' and "no permite respaldar el schema 'public'" in estado['error']:
        print(f"[OK] Política aplicada correctamente. Intento de backup 'public' rechazado con error: {estado['error']}")
        return True
    else:
        print(f"[X] FALLO: La política no rechazó el backup de public correctamente. Estado: {estado}")
        return False

def main():
    print("=================================================================")
    print("VERIFICACIÓN FASE 10 - TAREA 8: BACKUP Y RESTORE LÓGICO AISLADO")
    print("=================================================================")
    
    tenants = EmpresaTenant.objects.exclude(schema_name='public')[:2]
    if len(tenants) < 2:
        print("[!] No hay suficientes tenants para la prueba. Se requieren al menos dos (ej: ferretest y setuptmp).")
        sys.exit(1)
        
    tenant_a = tenants[0].schema_name
    tenant_b = tenants[1].schema_name
    
    success_a = verificar_backup_aislado(tenant_a, tenant_b)
    success_b = verificar_backup_aislado(tenant_b, tenant_a)
    success_public = verificar_politica_public()
    
    if success_a and success_b and success_public:
        print("\n=================================================================")
        print("RESULTADO GLOBAL: [OK] PASÓ TODAS LAS PRUEBAS DE AISLAMIENTO")
        print("La evidencia comprueba que:")
        print("  - Los backups se generan aislados por schema.")
        print("  - El schema público no puede ser respaldado por esta vía operativa.")
        print("  - Los naming conventions se respetan estrictamente.")
        print("=================================================================")
        sys.exit(0)
    else:
        print("\n=================================================================")
        print("RESULTADO GLOBAL: [X] FALLARON ALGUNAS PRUEBAS")
        print("=================================================================")
        sys.exit(1)

if __name__ == '__main__':
    main()
