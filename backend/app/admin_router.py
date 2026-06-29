"""
admin_router.py — CRUD protegido del catálogo
Endpoints bajo /admin, requieren header X-Admin-Token.
"""
import json
import os
import tempfile
from pathlib import Path
from typing import Optional
from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

# ── Ruta al catálogo ───────────────────────────────────────────────────────────
CATALOG_PATH = Path(__file__).parent.parent / "data" / "catalog.json"
INVENTORY_PATH = Path(__file__).parent.parent / "data" / "inventory.json"

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


# ── Helpers Inventario ─────────────────────────────────────────────────────────
def load_inventory() -> dict:
    if not INVENTORY_PATH.exists():
        return {}
    with open(INVENTORY_PATH, encoding="utf-8") as f:
        return json.load(f)


def save_inventory(data: dict) -> None:
    """Escritura atómica del inventario."""
    tmp_path = INVENTORY_PATH.with_suffix(".tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp_path.replace(INVENTORY_PATH)


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
    moneda: str = "USD"
    whatsapp: str
    whatsapp_mensaje: str
    paypal: str
    recargo_paypal: str


class DisponibleToggle(BaseModel):
    disponible: bool
    usuario: str


class EventoHistorial(BaseModel):
    id: str
    productoId: str
    nombre: str
    estadoAnterior: bool
    nuevoEstado: bool
    usuario: str
    fecha_hora: str
    mensaje: str


class PublishDraft(BaseModel):
    productos: list[ProductoAdminOut]
    nuevos_eventos_historial: list[EventoHistorial]


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
            estado_anterior = p.get("disponible", False)
            catalog["productos"][i]["disponible"] = body.disponible
            
            # Registrar en el historial
            if "historial" not in catalog:
                catalog["historial"] = []
            
            accion = "disponible" if body.disponible else "agotada"
            nuevo_evento = {
                "id": str(uuid.uuid4()),
                "productoId": product_id,
                "nombre": p["nombre"],
                "estadoAnterior": estado_anterior,
                "nuevoEstado": body.disponible,
                "usuario": body.usuario,
                "fecha_hora": datetime.now().isoformat(),
                "mensaje": f"{p['nombre']} marcada como {accion}"
            }
            
            # Insertar al principio y mantener máximo 200 elementos
            catalog["historial"].insert(0, nuevo_evento)
            if len(catalog["historial"]) > 200:
                catalog["historial"] = catalog["historial"][:200]
                
            save_catalog(catalog)
            return catalog["productos"][i]
    raise HTTPException(status_code=404, detail="Producto no encontrado")


@router.post(
    "/publish",
    summary="Publicar los borradores a producción",
    dependencies=[Depends(verify_token)],
)
def admin_publish_draft(body: PublishDraft):
    catalog = load_catalog()
    catalog["productos"] = [p.model_dump() for p in body.productos]
    
    if "historial" not in catalog:
        catalog["historial"] = []
        
    nuevos = [e.model_dump() for e in body.nuevos_eventos_historial]
    catalog["historial"] = nuevos + catalog["historial"]
    
    if len(catalog["historial"]) > 200:
        catalog["historial"] = catalog["historial"][:200]
        
    save_catalog(catalog)
    return {"status": "ok"}


@router.get(
    "/history",
    summary="Obtener el historial de cambios",
    dependencies=[Depends(verify_token)],
)
def admin_get_history():
    catalog = load_catalog()
    return catalog.get("historial", [])


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


# ── Schemas Inventario ─────────────────────────────────────────────────────────
class VarianteColor(BaseModel):
    color: str
    hex: str = "#000000"
    tallas: dict[str, int] = {}


class InventarioProducto(BaseModel):
    variantes: list[VarianteColor]


# ── Endpoints Inventario ───────────────────────────────────────────────────────

@router.get(
    "/inventory/{product_id}",
    summary="Obtener inventario de un producto",
    dependencies=[Depends(verify_token)],
)
def admin_get_inventory(product_id: str):
    inventory = load_inventory()
    entry = inventory.get(product_id, {})
    return {"variantes": entry.get("variantes", [])}


@router.put(
    "/inventory/{product_id}",
    summary="Guardar inventario completo de un producto",
    dependencies=[Depends(verify_token)],
)
def admin_save_inventory(product_id: str, body: InventarioProducto):
    # Verificar que el producto existe
    catalog = load_catalog()
    found = any(p["id"] == product_id for p in catalog["productos"])
    if not found:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    inventory = load_inventory()
    inventory[product_id] = {
        "variantes": [v.model_dump() for v in body.variantes]
    }
    save_inventory(inventory)

    total_stock = sum(
        sum(v.tallas.values()) for v in body.variantes
    )
    return {"status": "ok", "total_stock": total_stock}