import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DATA_PATH = BASE_DIR / "backend" / "data" / "catalog.json"
SQL_PATH = BASE_DIR / "init.sql"

# Tu listado exacto proporcionado
abercrombie_names = [
    "CAMISETA GRUESA 2.0 DE CALIDAD SUPERIOR",
    "CAMISETA GRUESA PREMIUM HANLEY 2.0 CON ICONO EXCLUSIVO",
    "CAMISETA GRUESA PREMIUM CON MICROLOGO",
    "SUDADERA DE FELPA CON CAPUCHA E ICONO FRENCH TERRY",
    "POLO CON ICONO INSIGNIA DON'T SWEAT IT"
]

def main():
    print("Leyendo catalog.json...")
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    sql_statements = [
        "-- ─────────────────────────────────────────────────────────────",
        "-- ANOTHER NPC SHOP — Esquema Inicial de Base de Datos para PostgreSQL",
        "-- ─────────────────────────────────────────────────────────────",
        "",
        "CREATE TABLE IF NOT EXISTS productos (",
        "    id VARCHAR(10) PRIMARY KEY,",
        "    meta_id VARCHAR(50),",
        "    nombre VARCHAR(255) NOT NULL,",
        "    precio DECIMAL(10, 2) NOT NULL,",
        "    categoria VARCHAR(100),",
        "    genero VARCHAR(50),",
        "    marca VARCHAR(100),",
        "    tallas TEXT[], -- Array de texto en PostgreSQL",
        "    imagen VARCHAR(255),",
        "    descripcion TEXT,",
        "    disponible BOOLEAN DEFAULT TRUE",
        ");",
        "",
        "TRUNCATE TABLE productos;",
        ""
    ]

    modificados = 0
    for p in data.get("productos", []):
        nombre = p.get("nombre", "")
        # Buscamos si el nombre coincide con alguno de la lista
        match = any(ab.upper() in nombre.upper() for ab in abercrombie_names)
        
        if match:
            p["marca"] = "Abercrombie"
            p["genero"] = "hombre"
            modificados += 1
        else:
            p["marca"] = ""
            p["genero"] = "mujer"
            
        # ── Prevenimos errores de comillas SQL ──
        p_id    = str(p.get('id', '')).replace("'", "''")
        meta_id = str(p.get('meta_id', '')).replace("'", "''")
        nomb    = str(p.get('nombre', '')).replace("'", "''")
        precio  = p.get('precio', 0)
        cat     = str(p.get('categoria', '')).replace("'", "''")
        gen     = str(p.get('genero', '')).replace("'", "''")
        marca   = str(p.get('marca', '')).replace("'", "''")
        # Array sintaxis Postgre
        tallas_str = "ARRAY[" + ",".join([f"'{t}'" for t in p.get('tallas', [])]) + "]::TEXT[]" if p.get('tallas') else "ARRAY[]::TEXT[]"
        img     = str(p.get('imagen', '')).replace("'", "''")
        desc    = str(p.get('descripcion', '')).replace("'", "''")
        disp    = "TRUE" if p.get('disponible', False) else "FALSE"

        sql = f"INSERT INTO productos (id, meta_id, nombre, precio, categoria, genero, marca, tallas, imagen, descripcion, disponible) " \
              f"VALUES ('{p_id}', '{meta_id}', '{nomb}', {precio}, '{cat}', '{gen}', '{marca}', {tallas_str}, '{img}', '{desc}', {disp});"
        
        sql_statements.append(sql)

    # Sobreescribimos el JSON con los nuevos géneros para que la web funcione localmente
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print(f"catalog.json local actualizado. Productos catalogados como hombre/Abercrombie: {modificados}")

    # Escribir volcado SQL
    with open(SQL_PATH, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_statements))
        
    print(f"Archivo generador SQL listo en: {SQL_PATH}")

if __name__ == "__main__":
    main()
