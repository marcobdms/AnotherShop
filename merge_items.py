import csv
import json
import os

CSV_PATH = r'c:\Users\Marco\Desktop\proyectos\anothershop\backup\catalog_backup.csv'
INIT_SQL_PATH = r'c:\Users\Marco\Desktop\proyectos\anothershop\init.sql'
JSON_PATHS = [
    r'c:\Users\Marco\Desktop\proyectos\anothershop\data\catalog.json',
    r'c:\Users\Marco\Desktop\proyectos\anothershop\backend\data\catalog.json'
]

# Read original CSV
with open(CSV_PATH, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f, delimiter=';')
    rows = list(reader)

for row in rows:
    # Update tallas if S,M,L is present to be XS,S,M,L
    tallas_str = row['tallas']
    if 'S,M,L' in tallas_str and 'XS' not in tallas_str:
        tallas_str = 'XS,S,M,L'
    row['tallas'] = tallas_str

# 1. WRITE CSV
fieldnames = rows[0].keys()
with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=';')
    writer.writeheader()
    writer.writerows(rows)

# 2. WRITE JSON
json_data = []
for r in rows:
    tallas_arr = [t.strip() for t in r['tallas'].split(',') if t.strip()]
    disponible = str(r['disponible']).lower() == 'true'
    precio = float(r['precio'])
    
    img_path = r['imagen_local_path']
    if not img_path.startswith('/'):
        img_path = '/' + img_path

    json_data.append({
        "id": r['id'],
        "meta_id": r['meta_id'],
        "nombre": r['nombre'],
        "precio": precio,
        "categoria": r['categoria'],
        "genero": r['genero'],
        "marca": "", # keeping empty as in original format or from missing col
        "tallas": tallas_arr,
        "imagen": img_path,
        "descripcion": r['descripcion'],
        "disponible": disponible
    })

for p in JSON_PATHS:
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False)

# 3. WRITE INIT.SQL
schema_sql = """-- ════════════════════════════════════════════════════════════════════════════════
-- ANOTHER NPC SHOP – Esquema Inicial de Base de Datos para PostgreSQL
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS productos (
    id VARCHAR(10) PRIMARY KEY,
    meta_id VARCHAR(50),
    nombre VARCHAR(255) NOT NULL,
    precio DECIMAL(10, 2) NOT NULL,
    categoria VARCHAR(100),
    genero VARCHAR(50),
    marca VARCHAR(100),
    tallas TEXT[], -- Array de texto en PostgreSQL
    imagen VARCHAR(255),
    descripcion TEXT,
    disponible BOOLEAN DEFAULT TRUE
);

TRUNCATE TABLE productos;

"""

inserts = []
for j in json_data:
    id_str = str(j['id']).replace("'", "''")
    meta_id = str(j['meta_id']).replace("'", "''")
    nombre = str(j['nombre']).replace("'", "''")
    precio = j['precio']
    categoria = str(j['categoria']).replace("'", "''")
    genero = str(j['genero']).replace("'", "''")
    marca = str(j['marca']).replace("'", "''")
    tallas_pg = "ARRAY[" + ",".join([f"'{t}'" for t in j['tallas']]) + "]::TEXT[]"
    imagen = str(j['imagen']).replace("'", "''")
    descripcion = str(j['descripcion']).replace("'", "''")
    disp = 'TRUE' if j['disponible'] else 'FALSE'
    
    inserts.append(f"INSERT INTO productos (id, meta_id, nombre, precio, categoria, genero, marca, tallas, imagen, descripcion, disponible) VALUES ('{id_str}', '{meta_id}', '{nombre}', {precio}, '{categoria}', '{genero}', '{marca}', {tallas_pg}, '{imagen}', '{descripcion}', {disp});")

with open(INIT_SQL_PATH, 'w', encoding='utf-8') as f:
    f.write(schema_sql)
    f.write('\n'.join(inserts))
    f.write('\n')

print(f"Processed {len(rows)} products w/o merging.")
