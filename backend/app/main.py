"""
ANOTHER NPC SHOP — FastAPI Backend
Modelos Pydantic con solo los campos necesarios por endpoint.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
from pathlib import Path

app = FastAPI(
    title="Another NPC Shop API",
    description="Catálogo de ropa de Another NPC Shop",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

CATALOG_PATH = Path(__file__).parent.parent / "data" / "catalog.json"


def load_catalog() -> dict:
    with open(CATALOG_PATH, encoding="utf-8") as f:
        return json.load(f)


# ── Modelos de respuesta ───────────────────────────────────────────────────────
# Solo los campos que el frontend realmente necesita.
# FastAPI filtra automáticamente cualquier campo extra del JSON.

class ProductoTarjeta(BaseModel):
    """Campos mínimos para mostrar una tarjeta en el catálogo."""
    id: str
    nombre: str
    precio: float
    imagen: str       # URL completa (Meta CDN) o ruta relativa (/images/001.jpg)
    disponible: bool
    genero: str
    tallas: list[str]
    descripcion: str


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


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get(
    "/api/products",
    response_model=list[ProductoTarjeta],
    summary="Lista de productos — solo campos necesarios para las tarjetas",
)
def get_products():
    productos = load_catalog()["productos"]
    # Ordenar: disponibles primero (True va antes que False si ordenamos por 'not disponible')
    productos.sort(key=lambda p: not p.get("disponible", False))
    return [ProductoTarjeta(**p) for p in productos]


@app.get(
    "/api/products/{product_id}",
    response_model=ProductoDetalle,
    summary="Detalle de un producto por ID",
)
def get_product(product_id: str):
    productos = load_catalog()["productos"]
    for p in productos:
        if p["id"] == product_id:
            return ProductoDetalle(**p)
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
    return load_catalog()


@app.get("/", include_in_schema=False)
def health():
    return {"status": "ok", "service": "Another NPC Shop API"}
