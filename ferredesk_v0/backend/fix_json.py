import json
import codecs

def fix_json_file(input_file, output_file):
    # Lista de codificaciones a intentar
    encodings = ['utf-8', 'latin1', 'cp1252', 'utf-16']
    
    for encoding in encodings:
        try:
            # Intentar leer con la codificación actual
            with codecs.open(input_file, 'r', encoding=encoding) as f:
                data = json.load(f)
            
            # Si llegamos aquí, la codificación funcionó
            # Guardar en UTF-8
            with codecs.open(output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            print(f"Archivo reparado exitosamente usando codificación {encoding}")
            return True
            
        except UnicodeDecodeError:
            print(f"Error con codificación {encoding}, intentando siguiente...")
            continue
        except json.JSONDecodeError as e:
            print(f"Error de JSON con codificación {encoding}: {e}")
            continue
    
    print("No se pudo reparar el archivo con ninguna codificación")
    return False

# Usar el script
fix_json_file('datadump.json', 'datadump_fixed.json')
