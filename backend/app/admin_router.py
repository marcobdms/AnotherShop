"""CRUD protegido del catálogo, respaldado por Supabase/PostgreSQL."""

from datetime import datetime
import hmac
import os
from pathlib import Path
import re
from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from pydantic import BaseModel

from app import catalog_repository as repository


ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "").strip()


def verify_token(x_admin_token: str = Header(...)):
    if not ADMIN_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="ADMIN_TOKEN no está configurado en el backend",
        )
    if not hmac.compare_digest(x_admin_token, ADMIN_TOKEN):
        raise HTTPException(status_code=401, detail="Token inválido")


class ProductoAdmin(BaseModel):
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
    tipo: Optional[str] = None
    estadoAnterior: bool
    nuevoEstado: bool
    usuario: str
    fecha_hora: str
    mensaje: str


class PublishDraft(BaseModel):
    productos: list[ProductoAdminOut]
    nuevos_eventos_historial: list[EventoHistorial]


class VarianteColor(BaseModel):
    color: str
    hex: str = "#000000"
    tallas: dict[str, int] = {}


class InventarioProducto(BaseModel):
    variantes: list[VarianteColor]
    usuario: Optional[str] = "admin"


class VarianteSyncItem(BaseModel):
    color: str
    hex: str = "#000000"
    tallas: dict[str, int] = {}


class ProductoSyncItem(BaseModel):
    # Campo interno opcional. /import lo conserva para distinguir refs repetidas.
    id: Optional[str] = None
    ref: str
    nombre: str
    precio: float
    precio_coste: float
    genero: str = "unisex"
    imagen: str = ""
    imagenes: list[str] = []
    disponible: bool = True
    drop: str = "Drop 1"
    variantes: list[VarianteSyncItem] = []


class SyncBody(BaseModel):
    productos: list[ProductoSyncItem]
    usuario: Optional[str] = "admin"


router = APIRouter(prefix="/admin", tags=["admin"])
protected = [Depends(verify_token)]


@router.get(
    "/products",
    response_model=list[ProductoAdminOut],
    summary="Lista completa de productos (admin)",
    dependencies=protected,
)
def admin_list_products():
    return repository.load_catalog()["productos"]


@router.post(
    "/products",
    response_model=ProductoAdminOut,
    status_code=201,
    summary="Crear nuevo producto",
    dependencies=protected,
)
def admin_create_product(producto: ProductoAdmin):
    return repository.create_product(producto.model_dump())


@router.put(
    "/products/{product_id}",
    response_model=ProductoAdminOut,
    summary="Editar producto existente",
    dependencies=protected,
)
def admin_update_product(product_id: str, producto: ProductoAdmin):
    updated = repository.update_product(product_id, producto.model_dump())
    if not updated:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return updated


@router.patch(
    "/products/{product_id}/disponible",
    response_model=ProductoAdminOut,
    summary="Toggle rápido de disponibilidad",
    dependencies=protected,
)
def admin_toggle_disponible(product_id: str, body: DisponibleToggle):
    updated = repository.toggle_availability(
        product_id,
        available=body.disponible,
        user=body.usuario,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return updated


@router.post(
    "/publish",
    summary="Publicar los borradores a producción",
    dependencies=protected,
)
def admin_publish_draft(body: PublishDraft):
    repository.publish_products(
        [product.model_dump() for product in body.productos],
        [event.model_dump(exclude_none=True) for event in body.nuevos_eventos_historial],
    )
    return {"status": "ok"}


@router.get(
    "/history",
    summary="Obtener el historial de cambios",
    dependencies=protected,
)
def admin_get_history():
    return repository.get_history()


@router.delete(
    "/products/{product_id}",
    status_code=204,
    summary="Eliminar producto",
    dependencies=protected,
)
def admin_delete_product(product_id: str):
    if not repository.delete_product(product_id):
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return None


@router.get(
    "/meta",
    response_model=MetaAdmin,
    summary="Ver meta de la tienda (admin)",
    dependencies=protected,
)
def admin_get_meta():
    return repository.get_meta()


@router.put(
    "/meta",
    response_model=MetaAdmin,
    summary="Editar meta de la tienda",
    dependencies=protected,
)
def admin_update_meta(meta: MetaAdmin):
    return repository.update_meta(meta.model_dump())


@router.get(
    "/inventory/{product_id}",
    summary="Obtener inventario de un producto",
    dependencies=protected,
)
def admin_get_inventory(product_id: str):
    return repository.get_inventory(product_id)


@router.put(
    "/inventory/{product_id}",
    summary="Guardar inventario completo de un producto",
    dependencies=protected,
)
def admin_save_inventory(product_id: str, body: InventarioProducto):
    total_stock = repository.save_inventory(
        product_id,
        [variant.model_dump() for variant in body.variantes],
        user=body.usuario or "admin",
    )
    if total_stock is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"status": "ok", "total_stock": total_stock}


@router.get(
    "/export-full",
    summary="Exportar el catálogo y el inventario completo",
    dependencies=protected,
)
def admin_export_full():
    return repository.export_full()


@router.put(
    "/sync-all",
    summary="Sincronización completa y atómica del catálogo e inventario",
    dependencies=protected,
)
def admin_sync_all(body: SyncBody):
    result = repository.sync_all(
        [product.model_dump() for product in body.productos],
        user=body.usuario or "admin",
    )
    return {"status": "ok", **result}


def _available_image_path(directory: Path, original_name: str) -> Path:
    """Conserva el nombre si está libre y añade -2, -3… si ya existe."""
    safe_name = Path(original_name).name
    stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", Path(safe_name).stem).strip("-")
    suffix = Path(safe_name).suffix.lower()
    if not stem or not suffix:
        raise HTTPException(status_code=400, detail="Nombre de imagen inválido")

    candidate = directory / f"{stem}{suffix}"
    counter = 2
    while candidate.exists():
        candidate = directory / f"{stem}-{counter}{suffix}"
        counter += 1
    return candidate


@router.post(
    "/upload-image",
    summary="Subir imagen a frontend/public/images",
    dependencies=protected,
)
async def admin_upload_image(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")

    public_images_dir = (
        Path(__file__).parent.parent.parent / "frontend" / "public" / "images"
    )
    public_images_dir.mkdir(parents=True, exist_ok=True)
    destination = _available_image_path(
        public_images_dir,
        file.filename or f"imagen-{datetime.now().timestamp()}.jpg",
    )

    try:
        with destination.open("xb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)
    except FileExistsError:
        # Una subida paralela ocupó el nombre después de resolverlo.
        destination = _available_image_path(public_images_dir, destination.name)
        with destination.open("xb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)
    finally:
        await file.close()

    return {
        "status": "ok",
        "filename": destination.name,
        "url": f"/images/{destination.name}",
    }
