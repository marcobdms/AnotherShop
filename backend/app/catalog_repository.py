"""Repositorio PostgreSQL del catálogo.

Esta es la única capa que conoce las tablas de Supabase. Los routers continúan
trabajando con diccionarios con la misma forma que tenían catalog.json e
inventory.json.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal

from typing import Any, Iterable, Optional
import re
import unicodedata
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    Text,
    and_,
    delete,
    func,
    insert,
    select,
    text,
    update,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.engine import Connection

from app.database import get_engine


metadata = MetaData()

configuracion_catalogo = Table(
    "configuracion_catalogo",
    metadata,
    Column("id", Boolean, primary_key=True),
    Column("meta", JSONB, nullable=False),
    Column("filtros", JSONB, nullable=False),
    Column("actualizado_en", DateTime(timezone=True), nullable=False),
)

productos = Table(
    "productos",
    metadata,
    Column("id", String, primary_key=True),
    Column("sync_key", String, nullable=False, unique=True),
    Column("meta_id", String, nullable=False),
    Column("ref", String, nullable=False),
    Column("nombre", String, nullable=False),
    Column("precio", Numeric(12, 2), nullable=False),
    Column("precio_coste", Numeric(12, 2), nullable=False),
    Column("categoria", String, nullable=False),
    Column("genero", String, nullable=False),
    Column("tallas", JSONB, nullable=False),
    Column("imagen_principal", Text, nullable=False),
    Column("imagenes", JSONB, nullable=False),
    Column("descripcion", Text, nullable=False),
    Column("disponible", Boolean, nullable=False),
    Column("marca", String, nullable=False),
    Column("drop_nombre", String, nullable=False),
    Column("orden", Integer, nullable=False),
    Column("creado_en", DateTime(timezone=True), nullable=False),
    Column("actualizado_en", DateTime(timezone=True), nullable=False),
)

variantes = Table(
    "variantes",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column(
        "producto_id",
        String,
        ForeignKey("productos.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("color", String, nullable=False),
    Column("color_hex", String, nullable=False),
    Column("imagen", Text, nullable=False),
    Column("orden", Integer, nullable=False),
    Column("creado_en", DateTime(timezone=True), nullable=False),
    Column("actualizado_en", DateTime(timezone=True), nullable=False),
)

inventario = Table(
    "inventario",
    metadata,
    Column(
        "variante_id",
        UUID(as_uuid=False),
        ForeignKey("variantes.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("talla", String, primary_key=True),
    Column("stock", Integer, nullable=False),
    Column("disponible", Boolean, nullable=False),
    Column("actualizado_en", DateTime(timezone=True), nullable=False),
)

historial_catalogo = Table(
    "historial_catalogo",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column("producto_id", String, nullable=False),
    Column("nombre", String, nullable=False),
    Column("tipo", String),
    Column("estado_anterior", Boolean, nullable=False),
    Column("nuevo_estado", Boolean, nullable=False),
    Column("usuario", String, nullable=False),
    Column("fecha_hora", Text, nullable=False),
    Column("mensaje", Text, nullable=False),
)


def make_sync_key(ref: str, product_id: str) -> str:
    """Clave estable interna. `ref` sigue siendo visible y puede repetirse."""
    return f"{ref or product_id}::{product_id}"


def _as_float(value: Any) -> float:
    if isinstance(value, Decimal):
        return float(value)
    return float(value or 0)


def _row_to_product(row: Any) -> dict[str, Any]:
    data = row._mapping if hasattr(row, "_mapping") else row
    return {
        "id": data["id"],
        "meta_id": data["meta_id"] or "",
        "ref": data["ref"] or "",
        "nombre": data["nombre"],
        "precio": _as_float(data["precio"]),
        "precio_coste": _as_float(data["precio_coste"]),
        "categoria": data["categoria"],
        "genero": data["genero"],
        "tallas": list(data["tallas"] or []),
        "imagen": data["imagen_principal"] or "",
        "imagenes": list(data["imagenes"] or []),
        "descripcion": data["descripcion"] or "",
        "disponible": bool(data["disponible"]),
        "marca": data["marca"] or "",
        "drop": data["drop_nombre"] or "Drop 1",
    }


def _product_values(
    product: dict[str, Any],
    *,
    product_id: str,
    order: int,
    sync_key: Optional[str] = None,
) -> dict[str, Any]:
    image = product.get("imagen") or product.get("imagen_principal") or ""
    images = list(product.get("imagenes") or ([image] if image else []))
    ref = str(product.get("ref") or product_id)
    now = datetime.now().astimezone()
    return {
        "id": product_id,
        "sync_key": sync_key or make_sync_key(ref, product_id),
        "meta_id": str(product.get("meta_id") or ""),
        "ref": ref,
        "nombre": str(product.get("nombre") or ""),
        "precio": product.get("precio") or 0,
        "precio_coste": product.get("precio_coste") or 0,
        "categoria": str(product.get("categoria") or "sin_categoria"),
        "genero": str(product.get("genero") or "unisex"),
        "tallas": list(product.get("tallas") or ["XS", "S", "M", "L", "XL"]),
        "imagen_principal": image,
        "imagenes": images,
        "descripcion": str(product.get("descripcion") or ""),
        "disponible": bool(product.get("disponible", True)),
        "marca": str(product.get("marca") or ""),
        "drop_nombre": str(product.get("drop") or "Drop 1"),
        "orden": order,
        "creado_en": now,
        "actualizado_en": now,
    }


def _event_values(event: dict[str, Any]) -> dict[str, Any]:
    event_id = str(event.get("id") or uuid.uuid4())
    try:
        uuid.UUID(event_id)
    except ValueError:
        event_id = str(uuid.uuid5(uuid.NAMESPACE_URL, event_id))

    return {
        "id": event_id,
        "producto_id": str(event.get("productoId") or ""),
        "nombre": str(event.get("nombre") or ""),
        "tipo": event.get("tipo"),
        "estado_anterior": bool(event.get("estadoAnterior", False)),
        "nuevo_estado": bool(event.get("nuevoEstado", False)),
        "usuario": str(event.get("usuario") or "admin"),
        "fecha_hora": str(event.get("fecha_hora") or datetime.now().isoformat()),
        "mensaje": str(event.get("mensaje") or ""),
    }


def _row_to_event(row: Any) -> dict[str, Any]:
    data = row._mapping if hasattr(row, "_mapping") else row
    event = {
        "id": str(data["id"]),
        "productoId": data["producto_id"],
        "nombre": data["nombre"],
        "estadoAnterior": bool(data["estado_anterior"]),
        "nuevoEstado": bool(data["nuevo_estado"]),
        "usuario": data["usuario"],
        "fecha_hora": data["fecha_hora"],
        "mensaje": data["mensaje"],
    }
    if data["tipo"]:
        event["tipo"] = data["tipo"]
    return event


def _inventory_map(
    connection: Connection,
    product_ids: Optional[Iterable[str]] = None,
) -> dict[str, dict[str, Any]]:
    query = (
        select(
            variantes.c.producto_id,
            variantes.c.id.label("variante_id"),
            variantes.c.color,
            variantes.c.color_hex,
            variantes.c.imagen,
            variantes.c.orden,
            inventario.c.talla,
            inventario.c.stock,
        )
        .select_from(
            variantes.outerjoin(
                inventario, inventario.c.variante_id == variantes.c.id
            )
        )
        .order_by(variantes.c.producto_id, variantes.c.orden, inventario.c.talla)
    )
    ids = list(product_ids or [])
    if ids:
        query = query.where(variantes.c.producto_id.in_(ids))

    by_product: dict[str, list[dict[str, Any]]] = defaultdict(list)
    variant_positions: dict[tuple[str, str], int] = {}

    for row in connection.execute(query):
        key = (row.producto_id, str(row.variante_id))
        if key not in variant_positions:
            variant_positions[key] = len(by_product[row.producto_id])
            by_product[row.producto_id].append(
                {
                    "color": row.color,
                    "hex": row.color_hex or "#000000",
                    "tallas": {},
                }
            )

        variant = by_product[row.producto_id][variant_positions[key]]
        if row.talla is not None:
            variant["tallas"][row.talla] = int(row.stock or 0)

    return {
        product_id: {"variantes": product_variants}
        for product_id, product_variants in by_product.items()
    }


def _read_products(connection: Connection) -> list[dict[str, Any]]:
    rows = connection.execute(
        select(productos).order_by(productos.c.orden, productos.c.id)
    )
    return [_row_to_product(row) for row in rows]


def _read_history(connection: Connection, limit: int = 200) -> list[dict[str, Any]]:
    rows = connection.execute(
        select(historial_catalogo)
        .order_by(historial_catalogo.c.fecha_hora.desc())
        .limit(limit)
    )
    return [_row_to_event(row) for row in rows]


def load_catalog() -> dict[str, Any]:
    """Carga el catálogo completo desde Supabase (PostgreSQL)."""
    with get_engine().connect() as connection:
        config = connection.execute(
            select(configuracion_catalogo).where(configuracion_catalogo.c.id.is_(True))
        ).mappings().first()
        if not config:
            raise RuntimeError(
                "No se encontró configuración del catálogo en Supabase. "
                "Verifica que la base de datos esté correctamente inicializada."
            )
        return {
            "meta": dict(config["meta"] or {}),
            "filtros": dict(config["filtros"] or {}),
            "productos": _read_products(connection),
            "historial": _read_history(connection),
        }


def load_inventory() -> dict[str, dict[str, Any]]:
    with get_engine().connect() as connection:
        return _inventory_map(connection)


def get_product(product_id: str) -> Optional[dict[str, Any]]:
    with get_engine().connect() as connection:
        row = connection.execute(
            select(productos).where(productos.c.id == product_id)
        ).first()
        return _row_to_product(row) if row else None


def get_inventory(product_id: str) -> dict[str, Any]:
    with get_engine().connect() as connection:
        return _inventory_map(connection, [product_id]).get(
            product_id, {"variantes": []}
        )


def export_full() -> dict[str, Any]:
    """Exporta el catálogo en formato versionado compatible con 'Pegar JSON'.

    El array ``productos`` tiene las variantes embebidas (igual al formato que
    acepta sync-all / el modal de pegar JSON), por lo que el backup se puede
    pegar directamente sin conversión extra.
    """
    with get_engine().connect() as connection:
        all_products = _read_products(connection)
        inv = _inventory_map(connection)

        productos_con_variantes = []
        stock_total = 0
        variantes_total = 0
        for p in all_products:
            pid = p["id"]
            variantes = (inv.get(pid) or {}).get("variantes", [])
            for v in variantes:
                variantes_total += 1
                stock_total += sum(v.get("tallas", {}).values())
            # Imagen2 es la segunda URL del array imagenes si existe
            imagenes = p.get("imagenes") or []
            productos_con_variantes.append({
                "id": pid,
                "ref": p["ref"],
                "nombre": p["nombre"],
                "precio": p["precio"],
                "precio_coste": p["precio_coste"],
                "genero": p["genero"],
                "imagen": p["imagen"],
                "imagenes": imagenes,
                "disponible": p["disponible"],
                "marca": p["marca"],
                "drop": p["drop"],
                "variantes": variantes,
            })

        return {
            "schema_version": 2,
            "fecha": datetime.now().astimezone().isoformat(),
            "totales": {
                "productos": len(productos_con_variantes),
                "variantes": variantes_total,
                "stock_total": stock_total,
            },
            "productos": productos_con_variantes,
        }


def _next_product_id(connection: Connection) -> str:
    connection.execute(
        text("select pg_advisory_xact_lock(hashtext('another-npc-shop:product-id'))")
    )
    numeric_ids = [
        int(row.id)
        for row in connection.execute(select(productos.c.id))
        if str(row.id).isdigit()
    ]
    return str(max(numeric_ids, default=0) + 1).zfill(3)


def create_product(product: dict[str, Any]) -> dict[str, Any]:
    with get_engine().begin() as connection:
        product_id = _next_product_id(connection)
        max_order = connection.scalar(select(func.max(productos.c.orden)))
        if max_order is None:
            max_order = -1
        values = _product_values(product, product_id=product_id, order=max_order + 1)
        connection.execute(insert(productos).values(**values))
        return _row_to_product(values)


def update_product(product_id: str, fields: dict[str, Any]) -> Optional[dict[str, Any]]:
    with get_engine().begin() as connection:
        current = connection.execute(
            select(productos).where(productos.c.id == product_id).with_for_update()
        ).first()
        if not current:
            return None

        image = fields.get("imagen") or ""
        existing_images = list(current.imagenes or [])
        images = (
            [image, *existing_images[1:]]
            if image and existing_images
            else ([image] if image else [])
        )
        result = connection.execute(
            update(productos)
            .where(productos.c.id == product_id)
            .values(
                nombre=fields.get("nombre"),
                precio=fields.get("precio"),
                categoria=fields.get("categoria"),
                genero=fields.get("genero"),
                tallas=fields.get("tallas"),
                imagen_principal=image,
                imagenes=images,
                descripcion=fields.get("descripcion"),
                disponible=fields.get("disponible"),
                marca=fields.get("marca"),
                actualizado_en=datetime.now().astimezone(),
            )
            .returning(productos)
        ).first()
        return _row_to_product(result)


def delete_product(product_id: str) -> bool:
    with get_engine().begin() as connection:
        if product_id in _crm_product_ids_with_sales(connection, {product_id}):
            result = connection.execute(
                update(productos)
                .where(productos.c.id == product_id)
                .values(disponible=False, actualizado_en=datetime.now().astimezone())
            )
            return bool(result.rowcount)
        result = connection.execute(
            delete(productos).where(productos.c.id == product_id)
        )
        return bool(result.rowcount)


def _crm_product_ids_with_sales(connection: Connection, product_ids: set[str]) -> set[str]:
    if not product_ids:
        return set()
    exists = connection.scalar(text("select to_regclass('crm.venta_items') is not null"))
    if not exists:
        return set()
    rows = connection.execute(
        text("select distinct producto_id from crm.venta_items where producto_id = any(:ids)"),
        {"ids": list(product_ids)},
    )
    return {str(row.producto_id) for row in rows}


def _insert_history(connection: Connection, events: Iterable[dict[str, Any]]) -> None:
    values = [_event_values(event) for event in events]
    if values:
        connection.execute(insert(historial_catalogo), values)

    stale_ids = select(historial_catalogo.c.id).order_by(
        historial_catalogo.c.fecha_hora.desc()
    ).offset(200)
    connection.execute(
        delete(historial_catalogo).where(historial_catalogo.c.id.in_(stale_ids))
    )


def toggle_availability(
    product_id: str,
    *,
    available: bool,
    user: str,
) -> Optional[dict[str, Any]]:
    with get_engine().begin() as connection:
        previous = connection.execute(
            select(productos).where(productos.c.id == product_id).with_for_update()
        ).first()
        if not previous:
            return None

        updated = connection.execute(
            update(productos)
            .where(productos.c.id == product_id)
            .values(
                disponible=available,
                actualizado_en=datetime.now().astimezone(),
            )
            .returning(productos)
        ).first()
        action = "disponible" if available else "agotada"
        _insert_history(
            connection,
            [
                {
                    "productoId": product_id,
                    "nombre": previous.nombre,
                    "estadoAnterior": previous.disponible,
                    "nuevoEstado": available,
                    "usuario": user,
                    "fecha_hora": datetime.now().isoformat(),
                    "mensaje": f"{previous.nombre} marcada como {action}",
                }
            ],
        )
        return _row_to_product(updated)


def get_history() -> list[dict[str, Any]]:
    with get_engine().connect() as connection:
        return _read_history(connection)


def get_meta() -> dict[str, Any]:
    with get_engine().connect() as connection:
        value = connection.scalar(
            select(configuracion_catalogo.c.meta).where(
                configuracion_catalogo.c.id.is_(True)
            )
        )
        return dict(value or {})


def update_meta(meta: dict[str, Any]) -> dict[str, Any]:
    with get_engine().begin() as connection:
        connection.execute(
            update(configuracion_catalogo)
            .where(configuracion_catalogo.c.id.is_(True))
            .values(meta=meta, actualizado_en=datetime.now().astimezone())
        )
    return meta


def _replace_inventory(
    connection: Connection,
    product_id: str,
    product_variants: Iterable[dict[str, Any]],
) -> None:
    connection.execute(
        delete(variantes).where(variantes.c.producto_id == product_id)
    )
    now = datetime.now().astimezone()
    for order, variant in enumerate(product_variants):
        variant_id = str(uuid.uuid4())
        connection.execute(
            insert(variantes).values(
                id=variant_id,
                producto_id=product_id,
                color=str(variant.get("color") or "Único"),
                color_hex=str(variant.get("hex") or "#000000"),
                imagen=str(variant.get("imagen") or ""),
                orden=order,
                creado_en=now,
                actualizado_en=now,
            )
        )
        stock_rows = [
            {
                "variante_id": variant_id,
                "talla": str(size),
                "stock": max(0, int(stock or 0)),
                "disponible": int(stock or 0) > 0,
                "actualizado_en": now,
            }
            for size, stock in (variant.get("tallas") or {}).items()
        ]
        if stock_rows:
            connection.execute(insert(inventario), stock_rows)


def save_inventory(
    product_id: str,
    product_variants: list[dict[str, Any]],
    *,
    user: str,
) -> Optional[int]:
    with get_engine().begin() as connection:
        product = connection.execute(
            select(productos.c.id, productos.c.nombre).where(
                productos.c.id == product_id
            ).with_for_update()
        ).first()
        if not product:
            return None

        _replace_inventory(connection, product_id, product_variants)
        total_stock = sum(
            max(0, int(stock or 0))
            for variant in product_variants
            for stock in (variant.get("tallas") or {}).values()
        )
        color_count = len(product_variants)
        plural = "es" if color_count != 1 else ""
        _insert_history(
            connection,
            [
                {
                    "productoId": product_id,
                    "nombre": product.nombre,
                    "tipo": "inventario",
                    "estadoAnterior": False,
                    "nuevoEstado": True,
                    "usuario": user,
                    "fecha_hora": datetime.now().isoformat(),
                    "mensaje": (
                        f"Inventario actualizado — {color_count} color{plural}, "
                        f"stock total: {total_stock} uds."
                    ),
                }
            ],
        )
        return total_stock


def publish_products(
    published_products: list[dict[str, Any]],
    new_events: list[dict[str, Any]],
) -> None:
    """Publica el borrador manteniendo campos que la UI admin no edita."""
    with get_engine().begin() as connection:
        connection.execute(
            text(
                "select pg_advisory_xact_lock("
                "hashtext('another-npc-shop:catalog-sync'))"
            )
        )
        current_rows = connection.execute(select(productos)).all()
        current_by_id = {row.id: row for row in current_rows}
        current_ids = set(current_by_id)
        published_ids = {str(product["id"]) for product in published_products}

        for order, product in enumerate(published_products):
            product_id = str(product["id"])
            if product_id not in current_by_id:
                connection.execute(
                    insert(productos).values(
                        **_product_values(
                            product,
                            product_id=product_id,
                            order=order,
                        )
                    )
                )
                continue

            current = current_by_id[product_id]
            image = product.get("imagen") or ""
            existing_images = list(current.imagenes or [])
            images = (
                [image, *existing_images[1:]]
                if image and existing_images
                else ([image] if image else [])
            )
            connection.execute(
                update(productos)
                .where(productos.c.id == product_id)
                .values(
                    nombre=product["nombre"],
                    precio=product["precio"],
                    categoria=product.get("categoria") or "sin_categoria",
                    genero=product["genero"],
                    tallas=list(product.get("tallas") or []),
                    imagen_principal=image,
                    imagenes=images,
                    descripcion=product.get("descripcion") or "",
                    disponible=bool(product.get("disponible", True)),
                    marca=product.get("marca") or "",
                    orden=order,
                    actualizado_en=datetime.now().astimezone(),
                )
            )

        removed_ids = current_ids - published_ids
        if removed_ids:
            sold_ids = _crm_product_ids_with_sales(connection, removed_ids)
            if sold_ids:
                connection.execute(
                    update(productos)
                    .where(productos.c.id.in_(sold_ids))
                    .values(disponible=False, actualizado_en=datetime.now().astimezone())
                )
            delete_ids = removed_ids - sold_ids
            if delete_ids:
                connection.execute(
                    delete(productos).where(productos.c.id.in_(delete_ids))
                )
        _insert_history(connection, new_events)


def _normalize_identity(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = normalized.encode("ASCII", "ignore").decode("ASCII")
    return re.sub(r"[^a-z0-9]", "", ascii_value.lower())


def _pick_existing_product(
    incoming: dict[str, Any],
    available: dict[str, dict[str, Any]],
    inventory_by_product: dict[str, dict[str, Any]],
) -> Optional[str]:
    incoming_id = str(incoming.get("id") or "")
    if incoming_id and incoming_id in available:
        return incoming_id

    ref = str(incoming.get("ref") or "")
    candidates = [
        product_id
        for product_id, product in available.items()
        if str(product.get("ref") or "") == ref
    ]
    if not candidates:
        return None

    name_key = _normalize_identity(str(incoming.get("nombre") or ""))
    name_matches = [
        product_id
        for product_id in candidates
        if _normalize_identity(available[product_id].get("nombre") or "") == name_key
    ]
    if len(name_matches) == 1:
        return name_matches[0]

    incoming_variants = incoming.get("variantes") or []
    incoming_color = _normalize_identity(
        str(incoming_variants[0].get("color") or "") if incoming_variants else ""
    )
    color_matches = []
    for product_id in name_matches or candidates:
        old_variants = inventory_by_product.get(product_id, {}).get("variantes", [])
        old_color = _normalize_identity(
            str(old_variants[0].get("color") or "") if old_variants else ""
        )
        if old_color == incoming_color:
            color_matches.append(product_id)

    if len(color_matches) == 1:
        return color_matches[0]
    if len(candidates) == 1:
        return candidates[0]
    return None


def sync_all(
    incoming_products: list[dict[str, Any]],
    *,
    user: str,
) -> dict[str, int]:
    """Sincronización completa y atómica usada por /admin/import."""
    with get_engine().begin() as connection:
        connection.execute(
            text(
                "select pg_advisory_xact_lock("
                "hashtext('another-npc-shop:catalog-sync'))"
            )
        )
        current_rows = connection.execute(select(productos)).all()
        available = {
            row.id: {
                **_row_to_product(row),
                "sync_key": row.sync_key,
            }
            for row in current_rows
        }
        old_inventory = _inventory_map(connection)
        numeric_ids = [
            int(product_id)
            for product_id in available
            if str(product_id).isdigit()
        ]
        next_numeric_id = max(numeric_ids, default=0) + 1

        created = 0
        updated_count = 0
        kept_ids: set[str] = set()

        for order, incoming in enumerate(incoming_products):
            ref = str(incoming.get("ref") or "").strip()
            if not ref:
                continue

            matched_id = _pick_existing_product(incoming, available, old_inventory)
            if matched_id:
                old = available.pop(matched_id)
                product_id = matched_id
                merged = {
                    **old,
                    **incoming,
                    "meta_id": old.get("meta_id", ""),
                    "categoria": old.get("categoria", "sin_categoria"),
                    "descripcion": old.get("descripcion", ""),
                    # Si el incoming trae marca no vacía, usarla.
                    # Si viene vacía o ausente, conservar la del DB.
                    "marca": incoming.get("marca") or old.get("marca", ""),
                }
                if not incoming.get("imagen") and not incoming.get("imagenes"):
                    merged["imagen"] = old.get("imagen", "")
                    merged["imagenes"] = old.get("imagenes", [])
                values = _product_values(
                    merged,
                    product_id=product_id,
                    order=order,
                    sync_key=old["sync_key"],
                )
                values.pop("creado_en")
                connection.execute(
                    update(productos)
                    .where(productos.c.id == product_id)
                    .values(**{key: value for key, value in values.items() if key != "id"})
                )
                updated_count += 1
            else:
                product_id = str(next_numeric_id).zfill(3)
                next_numeric_id += 1
                values = _product_values(
                    incoming,
                    product_id=product_id,
                    order=order,
                )
                if not values["imagen_principal"]:
                    values["imagen_principal"] = f"/images/{product_id}.jpg"
                    values["imagenes"] = [values["imagen_principal"]]
                connection.execute(insert(productos).values(**values))
                created += 1

            kept_ids.add(product_id)
            _replace_inventory(
                connection,
                product_id,
                list(incoming.get("variantes") or []),
            )

        removed_ids = set(available)
        if removed_ids:
            sold_ids = _crm_product_ids_with_sales(connection, removed_ids)
            if sold_ids:
                connection.execute(
                    update(productos)
                    .where(productos.c.id.in_(sold_ids))
                    .values(disponible=False, actualizado_en=datetime.now().astimezone())
                )
            delete_ids = removed_ids - sold_ids
            if delete_ids:
                connection.execute(
                    delete(productos).where(productos.c.id.in_(delete_ids))
                )

        removed = len(removed_ids)
        message = (
            f"Sincronización total — {created} creados, "
            f"{updated_count} actualizados"
        )
        if removed:
            message += f", {removed} eliminados"
        _insert_history(
            connection,
            [
                {
                    "productoId": "sync-all",
                    "nombre": "Sincronización masiva",
                    "tipo": "importacion",
                    "estadoAnterior": False,
                    "nuevoEstado": True,
                    "usuario": user,
                    "fecha_hora": datetime.now().isoformat(),
                    "mensaje": message,
                }
            ],
        )
        return {
            "creados": created,
            "actualizados": updated_count,
            "eliminados": removed,
        }


def replace_from_json(catalog: dict[str, Any], inventory_data: dict[str, Any]) -> None:
    """Carga inicial, deliberadamente destructiva y usada solo por el script."""
    with get_engine().begin() as connection:
        connection.execute(delete(historial_catalogo))
        connection.execute(delete(inventario))
        connection.execute(delete(variantes))
        connection.execute(delete(productos))
        connection.execute(delete(configuracion_catalogo))

        connection.execute(
            insert(configuracion_catalogo).values(
                id=True,
                meta=dict(catalog.get("meta") or {}),
                filtros=dict(catalog.get("filtros") or {}),
                actualizado_en=datetime.now().astimezone(),
            )
        )
        for order, product in enumerate(catalog.get("productos") or []):
            product_id = str(product["id"])
            connection.execute(
                insert(productos).values(
                    **_product_values(
                        product,
                        product_id=product_id,
                        order=order,
                    )
                )
            )
            _replace_inventory(
                connection,
                product_id,
                (inventory_data.get(product_id) or {}).get("variantes") or [],
            )

        _insert_history(connection, catalog.get("historial") or [])
