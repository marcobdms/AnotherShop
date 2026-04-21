"""
admin_router.py — CRUD protegido del catálogo
Endpoints bajo /admin, requieren header X-Admin-Token.
"""
import json
import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

# ── Ruta al catálogo ───────────────────────────────────────────────────────────
CATALOG_PATH = Path(__file__).parent.parent / "data" / "catalog.json"

# ── Auth ───────────────────────────────────────────────────────────────────────
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "change-me-in-env")


def verify_token(x_admin_token: str = Header(...)):
    if x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Token inválido")


# ── Helpers JSON ───────────────────────────────────────────────────────────────
def load_catalog() -> dict:
    with open(CATALOG_PATH, encoding="utf-8") as f:
        return json.load(f)


def save_catalog(data: dict) -> None:
    """Escritura atómica: escribe a .tmp y luego renombra para evitar corrupción."""
    tmp_path = CATALOG_PATH.with_suffix(".tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp_path.replace(CATALOG_PATH)


def next_id(productos: list) -> str:
    """Genera el siguiente ID numérico con cero-padding (ej: '093')."""
    if not productos:
        return "001"
    max_id = max(int(p["id"]) for p in productos if p["id"].isdigit())
    return str(max_id + 1).zfill(3)


# ── Schemas ────────────────────────────────────────────────────────────────────
class ProductoAdmin(BaseModel):
    """Todos los campos editables de un producto."""
    nombre: str
    precio: float
    categoria: str = "sin_categoria"
    genero: str
    tallas: list[str]
    imagen: str
    descripcion: str
    disponible: bool
    marca: str = ""


class ProductoAdminOut(ProductoAdmin):
    """Producto con id para las respuestas."""
    id: str
    meta_id: Optional[str] = ""


class MetaAdmin(BaseModel):
    marca: str
    moneda: str = "EUR"
    whatsapp: str
    whatsapp_mensaje: str
    paypal: str
    recargo_paypal: str


class DisponibleToggle(BaseModel):
    disponible: bool


# ── Router ─────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/admin", tags=["admin"])


@router.get(
    "/products",
    response_model=list[ProductoAdminOut],
    summary="Lista completa de productos (admin)",
    dependencies=[Depends(verify_token)],
)
def admin_list_products():
    return load_catalog()["productos"]


@router.post(
    "/products",
    response_model=ProductoAdminOut,
    status_code=201,
    summary="Crear nuevo producto",
    dependencies=[Depends(verify_token)],
)
def admin_create_product(producto: ProductoAdmin):
    catalog = load_catalog()
    new_id = next_id(catalog["productos"])
    new_product = {"id": new_id, "meta_id": "", **producto.model_dump()}
    catalog["productos"].append(new_product)
    save_catalog(catalog)
    return new_product


@router.put(
    "/products/{product_id}",
    response_model=ProductoAdminOut,
    summary="Editar producto existente",
    dependencies=[Depends(verify_token)],
)
def admin_update_product(product_id: str, producto: ProductoAdmin):
    catalog = load_catalog()
    for i, p in enumerate(catalog["productos"]):
        if p["id"] == product_id:
            updated = {
                "id": product_id,
                "meta_id": p.get("meta_id", ""),
                **producto.model_dump(),
            }
            catalog["productos"][i] = updated
            save_catalog(catalog)
            return updated
    raise HTTPException(status_code=404, detail="Producto no encontrado")


@router.patch(
    "/products/{product_id}/disponible",
    response_model=ProductoAdminOut,
    summary="Toggle rápido de disponibilidad",
    dependencies=[Depends(verify_token)],
)
def admin_toggle_disponible(product_id: str, body: DisponibleToggle):
    catalog = load_catalog()
    for i, p in enumerate(catalog["productos"]):
        if p["id"] == product_id:
            catalog["productos"][i]["disponible"] = body.disponible
            save_catalog(catalog)
            return catalog["productos"][i]
    raise HTTPException(status_code=404, detail="Producto no encontrado")


@router.delete(
    "/products/{product_id}",
    status_code=204,
    summary="Eliminar producto",
    dependencies=[Depends(verify_token)],
)
def admin_delete_product(product_id: str):
    catalog = load_catalog()
    original_len = len(catalog["productos"])
    catalog["productos"] = [p for p in catalog["productos"] if p["id"] != product_id]
    if len(catalog["productos"]) == original_len:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    save_catalog(catalog)
    return None


@router.get(
    "/meta",
    response_model=MetaAdmin,
    summary="Ver meta de la tienda (admin)",
    dependencies=[Depends(verify_token)],
)
def admin_get_meta():
    return load_catalog()["meta"]


@router.put(
    "/meta",
    response_model=MetaAdmin,
    summary="Editar meta de la tienda",
    dependencies=[Depends(verify_token)],
)
def admin_update_meta(meta: MetaAdmin):
    catalog = load_catalog()
    catalog["meta"] = meta.model_dump()
    save_catalog(catalog)
    return meta