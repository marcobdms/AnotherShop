import json
import shutil
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DATA_PATH = BASE_DIR / "backend" / "data" / "catalog.json"
BACKUP_IMAGES_DIR = BASE_DIR / "backup" / "images"
PUBLIC_IMAGES_DIR = BASE_DIR / "frontend" / "public" / "images"

def migrate_to_local():
    print("Migrando a modo 100% local...")

    # 1. Copiar imágenes de backup a frontend/public/images
    os.makedirs(PUBLIC_IMAGES_DIR, exist_ok=True)
    if os.path.exists(BACKUP_IMAGES_DIR):
        print("Copiando imágenes locales al directorio público del frontend...")
        for file in os.listdir(BACKUP_IMAGES_DIR):
            if file.endswith(".jpg"):
                src = os.path.join(BACKUP_IMAGES_DIR, file)
                dst = os.path.join(PUBLIC_IMAGES_DIR, file)
                shutil.copy2(src, dst)
        print("Imágenes copiadas.")

    # 2. Actualizar el JSON para que use las rutas locales en vez de Meta
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    for p in data.get("productos", []):
        # Si la imagen viene de http (Meta), la pasamos a local
        if str(p.get("imagen", "")).startswith("http"):
             p["imagen"] = f"/images/{p['id']}.jpg"

    # Guardar cambios
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("catalog.json actualizado a rutas locales.")

if __name__ == "__main__":
    migrate_to_local()
