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
import shutil

from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File
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
    usuario: Optional[str] = "admin"


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
    catalog = load_catalog()
    producto = next((p for p in catalog["productos"] if p["id"] == product_id), None)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    inventory = load_inventory()
    inventory[product_id] = {
        "variantes": [v.model_dump() for v in body.variantes]
    }
    save_inventory(inventory)

    total_stock = sum(sum(v.tallas.values()) for v in body.variantes)
    n_colores = len(body.variantes)

    # Registrar en historial
    if "historial" not in catalog:
        catalog["historial"] = []
    evento = {
        "id": str(uuid.uuid4()),
        "productoId": product_id,
        "nombre": producto["nombre"],
        "tipo": "inventario",
        "estadoAnterior": False,
        "nuevoEstado": True,
        "usuario": body.usuario or "admin",
        "fecha_hora": datetime.now().isoformat(),
        "mensaje": f"Inventario actualizado — {n_colores} color{'es' if n_colores != 1 else ''}, stock total: {total_stock} uds."
    }
    catalog["historial"].insert(0, evento)
    if len(catalog["historial"]) > 200:
        catalog["historial"] = catalog["historial"][:200]
    save_catalog(catalog)

    return {"status": "ok", "total_stock": total_stock}


# ── Schemas Importación Masiva ─────────────────────────────────────────────────
class VarianteImport(BaseModel):
    color: str
    hex: str = "#000000"
    tallas: dict[str, int] = {}


class ProductoImport(BaseModel):
    ref: str
    nombre: str
    precio: float
    precio_coste: float
    genero: str = "unisex"
    imagen: str = ""
    imagenes: list[str] = []
    disponible: bool = True
    drop: str = "Drop 1"
    variantes: list[VarianteImport] = []


class BulkImportBody(BaseModel):
    productos: list[ProductoImport]
    usuario: Optional[str] = "admin"


@router.post(
    "/import",
    summary="Importación masiva de productos con variantes",
    dependencies=[Depends(verify_token)],
)
def admin_bulk_import(body: BulkImportBody):
    catalog = load_catalog()
    inventory = load_inventory()

    ids_existentes = {p["id"] for p in catalog["productos"]}
    refs_existentes = {p.get("ref", p["id"]): p["id"] for p in catalog["productos"]}

    creados = []
    actualizados = []

    for prod in body.productos:
        ref = prod.ref.strip()

        if ref in refs_existentes:
            # Actualizar producto existente
            pid = refs_existentes[ref]
            for i, p in enumerate(catalog["productos"]):
                if p["id"] == pid:
                    catalog["productos"][i].update({
                        "nombre": prod.nombre,
                        "precio": prod.precio,
                        "precio_coste": prod.precio_coste,
                        "genero": prod.genero,
                        "disponible": prod.disponible,
                        "ref": ref,
                    })
                    if prod.imagen:
                        catalog["productos"][i]["imagen"] = prod.imagen
                    break
            actualizados.append(pid)
            product_id = pid
        else:
            # Crear nuevo producto
            new_id = next_id(catalog["productos"])
            new_product = {
                "id": new_id,
                "meta_id": "",
                "ref": ref,
                "nombre": prod.nombre,
                "precio": prod.precio,
                "precio_coste": prod.precio_coste,
                "categoria": "sin_categoria",
                "genero": prod.genero,
                "tallas": ["XS", "S", "M", "L", "XL"],
                "imagen": prod.imagen or f"/images/{new_id}.jpg",
                "descripcion": "",
                "disponible": prod.disponible,
                "marca": "",
            }
            catalog["productos"].append(new_product)
            creados.append(new_id)
            product_id = new_id

        # Guardar inventario si tiene variantes
        if prod.variantes:
            inventory[product_id] = {
                "variantes": [v.model_dump() for v in prod.variantes]
            }

    save_catalog(catalog)
    save_inventory(inventory)

    # Registrar en historial
    if "historial" not in catalog:
        catalog["historial"] = []
    evento = {
        "id": str(uuid.uuid4()),
        "productoId": "import",
        "nombre": f"Importación masiva",
        "tipo": "importacion",
        "estadoAnterior": False,
        "nuevoEstado": True,
        "usuario": body.usuario or "admin",
        "fecha_hora": datetime.now().isoformat(),
        "mensaje": f"Importación masiva — {len(creados)} creados, {len(actualizados)} actualizados"
    }
    catalog["historial"].insert(0, evento)
    if len(catalog["historial"]) > 200:
        catalog["historial"] = catalog["historial"][:200]
    save_catalog(catalog)

    return {
        "status": "ok",
        "creados": len(creados),
        "actualizados": len(actualizados),
        "ids_creados": creados,
    }


@router.get(
    "/export-full",
    summary="Exportar el catálogo y el inventario completo",
    dependencies=[Depends(verify_token)],
)
def admin_export_full():
    catalog = load_catalog()
    inventory = load_inventory()
    return {
        "productos": catalog["productos"],
        "inventario": inventory
    }


@router.put(
    "/sync-all",
    summary="Sincronización completa (sobrescribe catálogo e inventario, elimina faltantes)",
    dependencies=[Depends(verify_token)],
)
def admin_sync_all(body: BulkImportBody):
    catalog = load_catalog()
    inventory = load_inventory()

    # Mapear productos antiguos por REF (o ID si no tienen REF)
    old_products_by_ref = {p.get("ref", p["id"]): p for p in catalog["productos"]}
    
    new_productos = []
    new_inventory = {}
    
    creados = 0
    actualizados = 0

    for prod in body.productos:
        # Usa el ref del payload como clave de búsqueda
        ref_key = prod.ref
        if not ref_key:
            continue

        if ref_key in old_products_by_ref:
            old_p = old_products_by_ref[ref_key]
            pid = old_p["id"]
            # imagenes: priorizar el array, y mantener imagen como la primera
            imagenes_nuevas = prod.imagenes if prod.imagenes else ([prod.imagen] if prod.imagen else old_p.get("imagenes", []))
            imagen_principal = imagenes_nuevas[0] if imagenes_nuevas else old_p.get("imagen", "")
            new_p = {
                "id": pid,
                "meta_id": old_p.get("meta_id", ""),
                "ref": prod.ref,
                "nombre": prod.nombre,
                "precio": prod.precio,
                "precio_coste": prod.precio_coste,
                "categoria": old_p.get("categoria", "sin_categoria"),
                "genero": prod.genero,
                "tallas": ["XS", "S", "M", "L", "XL"],
                "imagen": imagen_principal,
                "imagenes": imagenes_nuevas,
                "descripcion": old_p.get("descripcion", ""),
                "disponible": prod.disponible,
                "marca": old_p.get("marca", ""),
                "drop": prod.drop,
            }
            new_productos.append(new_p)
            actualizados += 1
            # Eliminar del map para saber qué queda huerfano
            del old_products_by_ref[ref_key]
        else:
            # Crear producto nuevo
            new_id = next_id(new_productos + list(old_products_by_ref.values()))
            pid = new_id
            # imagenes: priorizar el array, y mantener imagen como la primera
            imagenes_nuevas = prod.imagenes if prod.imagenes else ([prod.imagen] if prod.imagen else [])
            imagen_principal = imagenes_nuevas[0] if imagenes_nuevas else f"/images/{pid}.jpg"
            new_p = {
                "id": pid,
                "meta_id": "",
                "ref": prod.ref,
                "nombre": prod.nombre,
                "precio": prod.precio,
                "precio_coste": prod.precio_coste,
                "categoria": "sin_categoria",
                "genero": prod.genero,
                "tallas": ["XS", "S", "M", "L", "XL"],
                "imagen": imagen_principal,
                "imagenes": imagenes_nuevas,
                "descripcion": "",
                "disponible": prod.disponible,
                "marca": "",
                "drop": prod.drop,
            }
            new_productos.append(new_p)
            creados += 1

        if prod.variantes:
            new_inventory[pid] = {
                "variantes": [v.model_dump() for v in prod.variantes]
            }

    eliminados = len(old_products_by_ref)

    # Guardar estado final
    catalog["productos"] = new_productos
    save_catalog(catalog)
    save_inventory(new_inventory)

    # Registrar en historial
    if "historial" not in catalog:
        catalog["historial"] = []
    
    mensaje = f"Sincronización total — {creados} creados, {actualizados} actualizados"
    if eliminados > 0:
        mensaje += f", {eliminados} eliminados"

    evento = {
        "id": str(uuid.uuid4()),
        "productoId": "sync-all",
        "nombre": "Sincronización masiva",
        "tipo": "importacion",
        "estadoAnterior": False,
        "nuevoEstado": True,
        "usuario": body.usuario or "admin",
        "fecha_hora": datetime.now().isoformat(),
        "mensaje": mensaje
    }
    catalog["historial"].insert(0, evento)
    if len(catalog["historial"]) > 200:
        catalog["historial"] = catalog["historial"][:200]
    save_catalog(catalog)

    return {
        "status": "ok",
        "creados": creados,
        "actualizados": actualizados,
        "eliminados": eliminados
    }


@router.post(
    "/upload-image",
    summary="Subir imagen a frontend/public/images",
    dependencies=[Depends(verify_token)],
)
async def admin_upload_image(file: UploadFile = File(...)):
    # Calculate the path relative to the backend app
    # backend/app/admin_router.py -> ../../../frontend/public/images/
    public_images_dir = Path(__file__).parent.parent.parent / "frontend" / "public" / "images"
    
    # Ensure directory exists
    public_images_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = public_images_dir / file.filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"status": "ok", "filename": file.filename, "url": f"/images/{file.filename}"}