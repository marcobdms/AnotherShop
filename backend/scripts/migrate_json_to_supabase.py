"""Migración única de JSON e imágenes a Supabase.

Por seguridad el comando solo analiza los archivos si no recibe --apply.
Las tablas deben haberse creado antes con backend/sql/001_catalog_schema.sql.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.catalog_repository import export_full, get_history, replace_from_json  # noqa: E402
from app.storage import migrate_catalog_images  # noqa: E402


CATALOG_PATH = BACKEND_DIR / "data" / "catalog.json"
INVENTORY_PATH = BACKEND_DIR / "data" / "inventory.json"
IMAGES_DIRECTORY = BACKEND_DIR.parent / "frontend" / "public" / "images"


def read_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def validate(catalog: dict, inventory: dict) -> dict[str, int]:
    required_sections = {"meta", "filtros", "productos"}
    missing_sections = required_sections - set(catalog)
    if missing_sections:
        raise ValueError(
            f"catalog.json no contiene: {', '.join(sorted(missing_sections))}"
        )

    products = catalog["productos"]
    ids = [str(product.get("id") or "") for product in products]
    if any(not product_id for product_id in ids):
        raise ValueError("Todos los productos deben tener id")
    if len(ids) != len(set(ids)):
        raise ValueError("catalog.json contiene IDs de producto duplicados")

    unknown_inventory_ids = set(inventory) - set(ids)
    if unknown_inventory_ids:
        sample = ", ".join(sorted(unknown_inventory_ids)[:5])
        raise ValueError(
            f"inventory.json contiene productos inexistentes: {sample}"
        )

    variant_count = 0
    stock_row_count = 0
    for entry in inventory.values():
        for variant in entry.get("variantes") or []:
            variant_count += 1
            for size, stock in (variant.get("tallas") or {}).items():
                if int(stock or 0) < 0:
                    raise ValueError(f"Stock negativo detectado en talla {size}")
                stock_row_count += 1

    return {
        "productos": len(products),
        "variantes": variant_count,
        "filas_stock": stock_row_count,
        "historial": min(len(catalog.get("historial") or []), 200),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Migra el catálogo JSON a Supabase/PostgreSQL"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Ejecuta la migración. Sin esta opción solo valida y muestra el resumen.",
    )
    args = parser.parse_args()

    catalog = read_json(CATALOG_PATH)
    inventory = read_json(INVENTORY_PATH)
    counts = validate(catalog, inventory)

    print("Validación correcta")
    for label, value in counts.items():
        print(f"  {label}: {value}")

    if not args.apply:
        print(
            "\nNo se escribió nada. Repite con --apply cuando el SQL esté "
            "creado y SUPABASE_DATABASE_URL esté configurada."
        )
        return 0

    image_count = migrate_catalog_images(
        catalog,
        inventory,
        images_directory=IMAGES_DIRECTORY,
    )
    print(f"Imágenes subidas o verificadas en Storage: {image_count}")

    replace_from_json(catalog, inventory)
    migrated = export_full()
    migrated_variant_count = sum(
        len(entry.get("variantes") or [])
        for entry in migrated["inventario"].values()
    )
    migrated_stock_rows = sum(
        len(variant.get("tallas") or {})
        for entry in migrated["inventario"].values()
        for variant in entry.get("variantes") or []
    )
    migrated_counts = {
        "productos": len(migrated["productos"]),
        "variantes": migrated_variant_count,
        "filas_stock": migrated_stock_rows,
        "historial": len(get_history()),
    }
    if migrated_counts != counts:
        raise RuntimeError(
            "La verificación posterior no coincide. "
            f"Origen={counts}, Supabase={migrated_counts}"
        )

    print(
        "\nMigración completada y conteos verificados. "
        "catalog.json e inventory.json permanecen intactos como backup."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
