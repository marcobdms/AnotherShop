import json
import csv
import requests
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DATA_PATH = BASE_DIR / "backend" / "data" / "catalog.json"
BACKUP_DIR = BASE_DIR / "backup"
IMAGES_DIR = BACKUP_DIR / "images"
CSV_PATH = BACKUP_DIR / "catalog_backup.csv"

def run_backup():
    os.makedirs(IMAGES_DIR, exist_ok=True)
    
    # Leer tu JSON local actual
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    productos = data.get("productos", [])
    
    # Columnas que tendrá tu CSV o Base de Datos
    csv_cols = [
        "id", "meta_id", "nombre", "precio", "categoria", "genero", 
        "tallas", "descripcion", "disponible", "imagen_meta_url", "imagen_local_path"
    ]
    
    csv_rows = []
    
    print(f"Iniciando backup de {len(productos)} productos...")
    
    for i, p in enumerate(productos):
        # Feedback de progreso en consola
        print(f"[{i+1}/{len(productos)}] Descargando: {p['nombre']}")
        
        image_url = p.get("imagen", "")
        local_path = ""
        
        # Si la imagen es un enlace de Meta, la descargamos
        if image_url.startswith("http"):
            filename = f"{p['id']}.jpg"
            file_path = IMAGES_DIR / filename
            
            try:
                response = requests.get(image_url, stream=True)
                response.raise_for_status()
                with open(file_path, 'wb') as out_file:
                    for chunk in response.iter_content(chunk_size=8192):
                        out_file.write(chunk)
                local_path = f"images/{filename}"
            except Exception as e:
                print(f"  -> Error al descargar: {e}")
                local_path = "ERROR"
        else:
            local_path = image_url
            
        csv_rows.append({
            "id": p.get("id", ""),
            "meta_id": p.get("meta_id", ""),
            "nombre": p.get("nombre", ""),
            "precio": p.get("precio", 0),
            "categoria": p.get("categoria", ""),
            "genero": p.get("genero", ""),
            "tallas": ",".join(p.get("tallas", [])),
            "descripcion": p.get("descripcion", ""),
            "disponible": p.get("disponible", False),
            "imagen_meta_url": image_url,
            "imagen_local_path": local_path
        })
        
    # Guardamos en CSV (usamos utf-8-sig para que Excel no rompa acentos ni eñes, usando punto y coma como delimitador ideal para Excel España)
    with open(CSV_PATH, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=csv_cols, delimiter=';')
        writer.writeheader()
        writer.writerows(csv_rows)
        
    print(f"\nBackup finalizado exitosamente.")
    print(f"CSV guardado en: {CSV_PATH}")
    print(f"Imágenes descargadas en: {IMAGES_DIR}")

if __name__ == "__main__":
    run_backup()
