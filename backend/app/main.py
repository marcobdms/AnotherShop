"""
ANOTHER NPC SHOP — FastAPI Backend
Modelos Pydantic con solo los campos necesarios por endpoint.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json
import unicodedata
import re
from pathlib import Path

from app.admin_router import router as admin_router

app = FastAPI(
    title="Another NPC Shop API",
    description="Catálogo de ropa de Another NPC Shop",
    version="1.0.0",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# allow_methods abre GET para el público y todos los métodos para el admin.
# En producción podrías restringir allow_origins a tu dominio Vercel.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(admin_router)

CATALOG_PATH = Path(__file__).parent.parent / "data" / "catalog.json"
INVENTORY_PATH = Path(__file__).parent.parent / "data" / "inventory.json"


def load_catalog() -> dict:
    with open(CATALOG_PATH, encoding="utf-8") as f:
        return json.load(f)


def load_inventory() -> dict:
    if not INVENTORY_PATH.exists():
        return {}
    with open(INVENTORY_PATH, encoding="utf-8") as f:
        return json.load(f)


def _normalize_sku(text: str) -> str:
    """Normaliza texto para SKU: quita acentos, mayúsculas, reemplaza espacios."""
    nfkd = unicodedata.normalize('NFKD', text)
    ascii_text = nfkd.encode('ASCII', 'ignore').decode('ASCII')
    return re.sub(r'[^A-Z0-9]', '', ascii_text.upper())


def _generate_skus(product_id: str, variantes: list) -> list[str]:
    """Genera SKUs para combinaciones con stock > 0."""
    skus = []
    for v in variantes:
        color_norm = _normalize_sku(v.get("color", ""))
        for talla, stock in v.get("tallas", {}).items():
            if stock > 0:
                skus.append(f"{product_id}-{color_norm}-{talla}")
    return skus


def _expand_products(productos: list, inventory: dict) -> list:
    """Expande productos con variantes de color en entradas separadas."""
    result = []
    for p in productos:
        pid = p["id"]
        inv = inventory.get(pid, {})
        variantes = inv.get("variantes", [])
        if variantes:
            for v in variantes:
                total_color_stock = sum(v.get("tallas", {}).values())
                expanded = {**p}
                expanded["variante_color"] = v["color"]
                expanded["variante_hex"] = v.get("hex", "#000000")
                expanded["variante_tallas"] = v.get("tallas", {})
                # Disponible solo si toggle=true Y este color tiene stock
                expanded["disponible"] = p.get("disponible", False) and total_color_stock > 0
                result.append(expanded)
        else:
            result.append(p)
    return result


# ── Modelos de respuesta ───────────────────────────────────────────────────────
# Solo los campos que el frontend realmente necesita.
# FastAPI filtra automáticamente cualquier campo extra del JSON.

class VarianteColorPublic(BaseModel):
    color: str
    hex: str = "#000000"
    tallas: dict[str, int] = {}


class ProductoTarjeta(BaseModel):
    """Campos mínimos para mostrar una tarjeta en el catálogo."""
    id: str
    nombre: str
    precio: float
    imagen: str
    disponible: bool
    genero: str
    tallas: list[str]
    descripcion: str
    variante_color: Optional[str] = None
    variante_hex: Optional[str] = None
    variante_tallas: Optional[dict[str, int]] = None


class ProductoDetalle(BaseModel):
    """Campos completos para la página de detalle del producto."""
    id: str
    nombre: str
    precio: float
    imagen: str
    descripcion: str
    tallas: list[str]
    genero: str
    disponible: bool
    variantes: list[VarianteColorPublic] = []
    skus: list[str] = []


class MetaTienda(BaseModel):
    """Solo los datos de contacto que el frontend necesita."""
    marca: str
    whatsapp: str
    whatsapp_mensaje: str
    paypal: str
    recargo_paypal: str


class Filtros(BaseModel):
    tallas: list[str]
    generos: list[str]


# ── Endpoints públicos ─────────────────────────────────────────────────────────

@app.get(
    "/api/products",
    response_model=list[ProductoTarjeta],
    summary="Lista de productos — solo campos necesarios para las tarjetas",
)
def get_products():
    productos = load_catalog()["productos"]
    inventory = load_inventory()
    expanded = _expand_products(productos, inventory)
    expanded.sort(key=lambda p: not p.get("disponible", False))
    return [ProductoTarjeta(**p) for p in expanded]


@app.get(
    "/api/products/{product_id}",
    response_model=ProductoDetalle,
    summary="Detalle de un producto por ID",
)
def get_product(product_id: str):
    productos = load_catalog()["productos"]
    inventory = load_inventory()
    for p in productos:
        if p["id"] == product_id:
            inv = inventory.get(product_id, {})
            variantes_raw = inv.get("variantes", [])
            variantes = [VarianteColorPublic(**v) for v in variantes_raw]
            skus = _generate_skus(product_id, variantes_raw)
            return ProductoDetalle(**p, variantes=variantes, skus=skus)
    raise HTTPException(status_code=404, detail="Producto no encontrado")


@app.get(
    "/api/meta",
    response_model=MetaTienda,
    summary="Metadatos de contacto de la tienda",
)
def get_meta():
    return MetaTienda(**load_catalog()["meta"])


@app.get(
    "/api/filters",
    response_model=Filtros,
    summary="Opciones de filtros disponibles",
)
def get_filters():
    return Filtros(**load_catalog()["filtros"])


@app.get(
    "/api/catalog",
    summary="Catálogo completo (meta + filtros + productos) — uso interno",
)
def get_catalog():
    catalog = load_catalog()
    inventory = load_inventory()
    catalog["productos"] = _expand_products(catalog["productos"], inventory)
    return catalog


@app.get("/", include_in_schema=False)
def health():
    return {"status": "ok", "service": "Another NPC Shop API"}