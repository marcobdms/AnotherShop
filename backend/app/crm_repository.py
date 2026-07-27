"""Repositorio del CRM interno.

Mantiene las compras, abonos y clientes separados del catalogo publico, pero
usa el inventario real para descontar y reponer stock de forma atomica.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from typing import Any, Iterable, Optional
import uuid

from sqlalchemy import (
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
    func,
    insert,
    literal,
    or_,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.engine import Connection

from app.catalog_repository import inventario, productos, variantes
from app.database import get_engine


metadata = MetaData(schema="crm")

clientes = Table(
    "clientes",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column("nombre", Text, nullable=False),
    Column("telefono", Text, nullable=False),
    Column("notas", Text, nullable=False),
    Column("creado_en", DateTime(timezone=True), nullable=False),
    Column("actualizado_en", DateTime(timezone=True), nullable=False),
)

ventas = Table(
    "ventas",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column("cliente_id", UUID(as_uuid=False), ForeignKey("crm.clientes.id"), nullable=False),
    Column("estado", Text, nullable=False),
    Column("total", Numeric(12, 2), nullable=False),
    Column("usuario", Text, nullable=False),
    Column("nota", Text, nullable=False),
    Column("creada_en", DateTime(timezone=True), nullable=False),
    Column("anulada_en", DateTime(timezone=True)),
    Column("motivo_anulacion", Text, nullable=False),
)

venta_items = Table(
    "venta_items",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column("venta_id", UUID(as_uuid=False), ForeignKey("crm.ventas.id"), nullable=False),
    Column("producto_id", Text, nullable=False),
    Column("variante_id", UUID(as_uuid=False), nullable=False),
    Column("talla", Text, nullable=False),
    Column("cantidad", Integer, nullable=False),
    Column("precio_unitario", Numeric(12, 2), nullable=False),
    Column("subtotal", Numeric(12, 2), nullable=False),
    Column("producto_nombre", Text, nullable=False),
    Column("producto_ref", Text, nullable=False),
    Column("color", Text, nullable=False),
    Column("color_hex", Text, nullable=False),
    Column("imagen", Text, nullable=False),
)

abonos = Table(
    "abonos",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column("cliente_id", UUID(as_uuid=False), ForeignKey("crm.clientes.id"), nullable=False),
    Column("monto", Numeric(12, 2), nullable=False),
    Column("metodo", Text, nullable=False),
    Column("usuario", Text, nullable=False),
    Column("nota", Text, nullable=False),
    Column("creado_en", DateTime(timezone=True), nullable=False),
)

abono_asignaciones = Table(
    "abono_asignaciones",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column("abono_id", UUID(as_uuid=False), ForeignKey("crm.abonos.id"), nullable=False),
    Column("venta_id", UUID(as_uuid=False), ForeignKey("crm.ventas.id"), nullable=False),
    Column("monto", Numeric(12, 2), nullable=False),
    Column("creado_en", DateTime(timezone=True), nullable=False),
)

comprobantes_cliente = Table(
    "comprobantes_cliente",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column("cliente_id", UUID(as_uuid=False), ForeignKey("crm.clientes.id"), nullable=False),
    Column("abono_id", UUID(as_uuid=False), ForeignKey("crm.abonos.id")),
    Column("storage_path", Text, nullable=False),
    Column("url_publica", Text, nullable=False),
    Column("nombre_archivo", Text, nullable=False),
    Column("content_type", Text, nullable=False),
    Column("usuario", Text, nullable=False),
    Column("creado_en", DateTime(timezone=True), nullable=False),
)


def _money(value: Any) -> float:
    if isinstance(value, Decimal):
        return float(value)
    return float(value or 0)


def _now() -> datetime:
    return datetime.now().astimezone()


def _new_id() -> str:
    return str(uuid.uuid4())


def _row_dict(row: Any) -> dict[str, Any]:
    data = row._mapping if hasattr(row, "_mapping") else row
    return dict(data)


def _client_balance_rows(connection: Connection) -> dict[str, dict[str, float]]:
    sales = dict(
        connection.execute(
            select(ventas.c.cliente_id, func.coalesce(func.sum(ventas.c.total), 0))
            .where(ventas.c.estado == "activa")
            .group_by(ventas.c.cliente_id)
        ).all()
    )
    payments = dict(
        connection.execute(
            select(abonos.c.cliente_id, func.coalesce(func.sum(abonos.c.monto), 0))
            .group_by(abonos.c.cliente_id)
        ).all()
    )
    ids = set(sales) | set(payments)
    return {
        str(client_id): {
            "total_comprado": _money(sales.get(client_id)),
            "total_abonado": _money(payments.get(client_id)),
            "deuda": _money(sales.get(client_id)) - _money(payments.get(client_id)),
        }
        for client_id in ids
    }


def _client_out(row: Any, balance: Optional[dict[str, float]] = None) -> dict[str, Any]:
    data = _row_dict(row)
    total = balance or {"total_comprado": 0, "total_abonado": 0, "deuda": 0}
    return {
        "id": str(data["id"]),
        "nombre": data["nombre"],
        "telefono": data["telefono"] or "",
        "notas": data["notas"] or "",
        "total_comprado": _money(total["total_comprado"]),
        "total_abonado": _money(total["total_abonado"]),
        "deuda": _money(total["deuda"]),
        "creado_en": data["creado_en"].isoformat() if data.get("creado_en") else "",
        "actualizado_en": data["actualizado_en"].isoformat() if data.get("actualizado_en") else "",
    }


def list_clients(search: str = "") -> list[dict[str, Any]]:
    with get_engine().connect() as connection:
        query = select(clientes).order_by(clientes.c.actualizado_en.desc())
        if search:
            term = f"%{search.lower()}%"
            query = query.where(
                or_(
                    func.lower(clientes.c.nombre).like(term),
                    func.lower(clientes.c.telefono).like(term),
                    func.lower(clientes.c.notas).like(term),
                )
            )
        balances = _client_balance_rows(connection)
        return [
            _client_out(row, balances.get(str(row.id)))
            for row in connection.execute(query)
        ]


def create_client(fields: dict[str, Any]) -> dict[str, Any]:
    now = _now()
    values = {
        "id": _new_id(),
        "nombre": str(fields.get("nombre") or "").strip(),
        "telefono": str(fields.get("telefono") or "").strip(),
        "notas": str(fields.get("notas") or "").strip(),
        "creado_en": now,
        "actualizado_en": now,
    }
    with get_engine().begin() as connection:
        row = connection.execute(insert(clientes).values(**values).returning(clientes)).first()
        return _client_out(row)


def update_client(client_id: str, fields: dict[str, Any]) -> Optional[dict[str, Any]]:
    with get_engine().begin() as connection:
        row = connection.execute(
            update(clientes)
            .where(clientes.c.id == client_id)
            .values(
                nombre=str(fields.get("nombre") or "").strip(),
                telefono=str(fields.get("telefono") or "").strip(),
                notas=str(fields.get("notas") or "").strip(),
                actualizado_en=_now(),
            )
            .returning(clientes)
        ).first()
        return _client_out(row) if row else None


def get_client(client_id: str) -> Optional[dict[str, Any]]:
    with get_engine().connect() as connection:
        row = connection.execute(select(clientes).where(clientes.c.id == client_id)).first()
        if not row:
            return None
        return _client_out(row, _client_balance_rows(connection).get(client_id))


def list_catalog_options(search: str = "") -> list[dict[str, Any]]:
    term = f"%{search.lower()}%"
    query = (
        select(
            productos.c.id.label("producto_id"),
            productos.c.ref,
            productos.c.nombre,
            productos.c.precio,
            productos.c.imagen_principal,
            variantes.c.id.label("variante_id"),
            variantes.c.color,
            variantes.c.color_hex,
            variantes.c.imagen.label("variante_imagen"),
            inventario.c.talla,
            inventario.c.stock,
        )
        .select_from(
            productos.join(variantes, variantes.c.producto_id == productos.c.id).join(
                inventario, inventario.c.variante_id == variantes.c.id
            )
        )
        .where(
            and_(
                productos.c.disponible.is_(True),
                inventario.c.stock > 0,
            )
        )
        .order_by(productos.c.orden, variantes.c.orden, inventario.c.talla)
        .limit(300)
    )
    if search:
        query = query.where(
            or_(
                func.lower(productos.c.id).like(term),
                func.lower(productos.c.ref).like(term),
                func.lower(productos.c.nombre).like(term),
                func.lower(variantes.c.color).like(term),
                func.lower(inventario.c.talla).like(term),
            )
        )

    with get_engine().connect() as connection:
        products: dict[str, dict[str, Any]] = {}
        variant_positions: dict[str, int] = {}
        for row in connection.execute(query):
            product = products.setdefault(
                row.producto_id,
                {
                    "id": row.producto_id,
                    "ref": row.ref or row.producto_id,
                    "nombre": row.nombre,
                    "precio": _money(row.precio),
                    "imagen": row.imagen_principal or "",
                    "variantes": [],
                },
            )
            variant_id = str(row.variante_id)
            if variant_id not in variant_positions:
                variant_positions[variant_id] = len(product["variantes"])
                product["variantes"].append(
                    {
                        "id": variant_id,
                        "color": row.color,
                        "hex": row.color_hex or "#000000",
                        "imagen": row.variante_imagen or row.imagen_principal or "",
                        "tallas": {},
                    }
                )
            product["variantes"][variant_positions[variant_id]]["tallas"][row.talla] = int(row.stock or 0)
        return list(products.values())


def _ensure_client(connection: Connection, client_id: str) -> None:
    exists = connection.scalar(select(clientes.c.id).where(clientes.c.id == client_id))
    if not exists:
        raise ValueError("Cliente no encontrado")


def _sale_payment_map(connection: Connection, sale_ids: Iterable[str]) -> dict[str, float]:
    ids = list(sale_ids)
    if not ids:
        return {}
    return {
        str(row.venta_id): _money(row.total)
        for row in connection.execute(
            select(
                abono_asignaciones.c.venta_id,
                func.coalesce(func.sum(abono_asignaciones.c.monto), 0).label("total"),
            )
            .where(abono_asignaciones.c.venta_id.in_(ids))
            .group_by(abono_asignaciones.c.venta_id)
        )
    }


def _sale_out(row: Any, items: list[dict[str, Any]], paid: float = 0) -> dict[str, Any]:
    data = _row_dict(row)
    total = _money(data["total"])
    return {
        "id": str(data["id"]),
        "cliente_id": str(data["cliente_id"]),
        "estado": data["estado"],
        "total": total,
        "abonado": paid,
        "pendiente": max(0, total - paid) if data["estado"] == "activa" else 0,
        "usuario": data["usuario"] or "admin",
        "nota": data["nota"] or "",
        "creada_en": data["creada_en"].isoformat() if data.get("creada_en") else "",
        "anulada_en": data["anulada_en"].isoformat() if data.get("anulada_en") else None,
        "motivo_anulacion": data["motivo_anulacion"] or "",
        "items": items,
    }


def _item_out(row: Any) -> dict[str, Any]:
    data = _row_dict(row)
    return {
        "id": str(data["id"]),
        "venta_id": str(data["venta_id"]),
        "producto_id": data["producto_id"],
        "variante_id": str(data["variante_id"]),
        "talla": data["talla"],
        "cantidad": int(data["cantidad"]),
        "precio_unitario": _money(data["precio_unitario"]),
        "subtotal": _money(data["subtotal"]),
        "producto_nombre": data["producto_nombre"],
        "producto_ref": data["producto_ref"],
        "color": data["color"],
        "color_hex": data["color_hex"],
        "imagen": data["imagen"],
    }


def list_client_sales(client_id: str) -> list[dict[str, Any]]:
    with get_engine().connect() as connection:
        sale_rows = connection.execute(
            select(ventas)
            .where(ventas.c.cliente_id == client_id)
            .order_by(ventas.c.creada_en.desc())
        ).all()
        sale_ids = [str(row.id) for row in sale_rows]
        paid = _sale_payment_map(connection, sale_ids)
        item_rows = connection.execute(
            select(venta_items).where(venta_items.c.venta_id.in_(sale_ids))
        ).all() if sale_ids else []
        items_by_sale: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in item_rows:
            items_by_sale[str(row.venta_id)].append(_item_out(row))
        return [
            _sale_out(row, items_by_sale.get(str(row.id), []), paid.get(str(row.id), 0))
            for row in sale_rows
        ]


def create_sale(client_id: str, items: list[dict[str, Any]], usuario: str, nota: str = "") -> dict[str, Any]:
    if not items:
        raise ValueError("La venta necesita al menos una prenda")

    with get_engine().begin() as connection:
        _ensure_client(connection, client_id)
        sale_id = _new_id()
        now = _now()
        prepared_items = []
        total = Decimal("0")

        for item in items:
            quantity = int(item.get("cantidad") or 0)
            price = Decimal(str(item.get("precio_unitario") or 0))
            if quantity <= 0:
                raise ValueError("La cantidad debe ser mayor a cero")
            if price < 0:
                raise ValueError("El precio no puede ser negativo")

            row = connection.execute(
                select(
                    productos.c.id.label("producto_id"),
                    productos.c.ref,
                    productos.c.nombre,
                    productos.c.precio,
                    productos.c.imagen_principal,
                    productos.c.disponible.label("producto_disponible"),
                    variantes.c.id.label("variante_id"),
                    variantes.c.color,
                    variantes.c.color_hex,
                    variantes.c.imagen.label("variante_imagen"),
                    inventario.c.talla,
                    inventario.c.stock,
                )
                .select_from(
                    productos.join(variantes, variantes.c.producto_id == productos.c.id).join(
                        inventario, inventario.c.variante_id == variantes.c.id
                    )
                )
                .where(
                    and_(
                        productos.c.id == str(item.get("producto_id") or ""),
                        variantes.c.id == str(item.get("variante_id") or ""),
                        inventario.c.talla == str(item.get("talla") or ""),
                    )
                )
                .with_for_update()
            ).first()

            if not row:
                raise ValueError("Producto, color o talla no encontrado")
            if not row.producto_disponible:
                raise ValueError(f"{row.nombre} no esta disponible")
            if int(row.stock or 0) < quantity:
                raise ValueError(
                    f"Stock insuficiente para {row.nombre} / {row.color} / {row.talla}"
                )

            remaining = int(row.stock or 0) - quantity
            connection.execute(
                update(inventario)
                .where(
                    and_(
                        inventario.c.variante_id == row.variante_id,
                        inventario.c.talla == row.talla,
                    )
                )
                .values(stock=remaining, disponible=remaining > 0, actualizado_en=now)
            )

            subtotal = price * quantity
            total += subtotal
            prepared_items.append(
                {
                    "id": _new_id(),
                    "venta_id": sale_id,
                    "producto_id": row.producto_id,
                    "variante_id": str(row.variante_id),
                    "talla": row.talla,
                    "cantidad": quantity,
                    "precio_unitario": price,
                    "subtotal": subtotal,
                    "producto_nombre": row.nombre,
                    "producto_ref": row.ref or row.producto_id,
                    "color": row.color,
                    "color_hex": row.color_hex or "#000000",
                    "imagen": row.variante_imagen or row.imagen_principal or "",
                }
            )

        sale_row = connection.execute(
            insert(ventas)
            .values(
                id=sale_id,
                cliente_id=client_id,
                estado="activa",
                total=total,
                usuario=usuario or "admin",
                nota=nota or "",
                creada_en=now,
                motivo_anulacion="",
            )
            .returning(ventas)
        ).first()
        connection.execute(insert(venta_items), prepared_items)
        connection.execute(
            update(clientes)
            .where(clientes.c.id == client_id)
            .values(actualizado_en=now)
        )
        return _sale_out(sale_row, [_item_out(item) for item in prepared_items], 0)


def cancel_sale(sale_id: str, motivo: str = "") -> Optional[dict[str, Any]]:
    with get_engine().begin() as connection:
        sale_row = connection.execute(
            select(ventas).where(ventas.c.id == sale_id).with_for_update()
        ).first()
        if not sale_row:
            return None
        item_rows = connection.execute(
            select(venta_items).where(venta_items.c.venta_id == sale_id)
        ).all()

        if sale_row.estado == "activa":
            now = _now()
            for item in item_rows:
                stock_row = connection.execute(
                    select(inventario)
                    .where(
                        and_(
                            inventario.c.variante_id == item.variante_id,
                            inventario.c.talla == item.talla,
                        )
                    )
                    .with_for_update()
                ).first()
                if stock_row:
                    new_stock = int(stock_row.stock or 0) + int(item.cantidad)
                    connection.execute(
                        update(inventario)
                        .where(
                            and_(
                                inventario.c.variante_id == item.variante_id,
                                inventario.c.talla == item.talla,
                            )
                        )
                        .values(stock=new_stock, disponible=new_stock > 0, actualizado_en=now)
                    )
            sale_row = connection.execute(
                update(ventas)
                .where(ventas.c.id == sale_id)
                .values(
                    estado="anulada",
                    anulada_en=now,
                    motivo_anulacion=motivo or "Correccion manual",
                )
                .returning(ventas)
            ).first()
            connection.execute(
                update(clientes)
                .where(clientes.c.id == sale_row.cliente_id)
                .values(actualizado_en=now)
            )

        paid = _sale_payment_map(connection, [sale_id]).get(sale_id, 0)
        return _sale_out(sale_row, [_item_out(row) for row in item_rows], paid)


def _allocate_payment(connection: Connection, client_id: str, payment_id: str, amount: Decimal, now: datetime) -> None:
    rows = connection.execute(
        select(
            ventas.c.id,
            ventas.c.total,
            func.coalesce(func.sum(abono_asignaciones.c.monto), 0).label("abonado"),
        )
        .select_from(
            ventas.outerjoin(abono_asignaciones, abono_asignaciones.c.venta_id == ventas.c.id)
        )
        .where(and_(ventas.c.cliente_id == client_id, ventas.c.estado == "activa"))
        .group_by(ventas.c.id, ventas.c.total, ventas.c.creada_en)
        .order_by(ventas.c.creada_en.asc())
    ).all()
    remaining = amount
    for row in rows:
        pending = Decimal(row.total) - Decimal(row.abonado or 0)
        if pending <= 0:
            continue
        applied = min(remaining, pending)
        if applied <= 0:
            break
        connection.execute(
            insert(abono_asignaciones).values(
                id=_new_id(),
                abono_id=payment_id,
                venta_id=row.id,
                monto=applied,
                creado_en=now,
            )
        )
        remaining -= applied


def create_payment(client_id: str, fields: dict[str, Any]) -> dict[str, Any]:
    amount = Decimal(str(fields.get("monto") or 0))
    method = str(fields.get("metodo") or "")
    if amount <= 0:
        raise ValueError("El abono debe ser mayor a cero")
    if method not in {"efectivo", "transferencia"}:
        raise ValueError("Metodo de pago invalido")

    with get_engine().begin() as connection:
        _ensure_client(connection, client_id)
        now = _now()
        payment_id = _new_id()
        row = connection.execute(
            insert(abonos)
            .values(
                id=payment_id,
                cliente_id=client_id,
                monto=amount,
                metodo=method,
                usuario=str(fields.get("usuario") or "admin"),
                nota=str(fields.get("nota") or ""),
                creado_en=now,
            )
            .returning(abonos)
        ).first()
        _allocate_payment(connection, client_id, payment_id, amount, now)
        connection.execute(
            update(clientes)
            .where(clientes.c.id == client_id)
            .values(actualizado_en=now)
        )
        return _payment_out(row)


def _payment_out(row: Any) -> dict[str, Any]:
    data = _row_dict(row)
    return {
        "id": str(data["id"]),
        "cliente_id": str(data["cliente_id"]),
        "monto": _money(data["monto"]),
        "metodo": data["metodo"],
        "usuario": data["usuario"] or "admin",
        "nota": data["nota"] or "",
        "creado_en": data["creado_en"].isoformat() if data.get("creado_en") else "",
    }


def list_client_payments(client_id: str) -> list[dict[str, Any]]:
    with get_engine().connect() as connection:
        rows = connection.execute(
            select(abonos)
            .where(abonos.c.cliente_id == client_id)
            .order_by(abonos.c.creado_en.desc())
        ).all()
        return [_payment_out(row) for row in rows]


def add_receipt(
    *,
    client_id: str,
    storage_path: str,
    original_name: str,
    content_type: str,
    usuario: str,
    abono_id: Optional[str] = None,
    public_url: str = "",
) -> dict[str, Any]:
    with get_engine().begin() as connection:
        _ensure_client(connection, client_id)
        now = _now()
        row = connection.execute(
            insert(comprobantes_cliente)
            .values(
                id=_new_id(),
                cliente_id=client_id,
                abono_id=abono_id,
                storage_path=storage_path,
                url_publica=public_url,
                nombre_archivo=original_name,
                content_type=content_type,
                usuario=usuario or "admin",
                creado_en=now,
            )
            .returning(comprobantes_cliente)
        ).first()
        connection.execute(
            update(clientes)
            .where(clientes.c.id == client_id)
            .values(actualizado_en=now)
        )
        return _receipt_out(row)


def _receipt_out(row: Any) -> dict[str, Any]:
    data = _row_dict(row)
    return {
        "id": str(data["id"]),
        "cliente_id": str(data["cliente_id"]),
        "abono_id": str(data["abono_id"]) if data.get("abono_id") else None,
        "storage_path": data["storage_path"],
        "url": data["url_publica"] or "",
        "nombre_archivo": data["nombre_archivo"] or "",
        "content_type": data["content_type"] or "",
        "usuario": data["usuario"] or "admin",
        "creado_en": data["creado_en"].isoformat() if data.get("creado_en") else "",
    }


def list_client_receipts(client_id: str) -> list[dict[str, Any]]:
    with get_engine().connect() as connection:
        rows = connection.execute(
            select(comprobantes_cliente)
            .where(comprobantes_cliente.c.cliente_id == client_id)
            .order_by(comprobantes_cliente.c.creado_en.desc())
        ).all()
        return [_receipt_out(row) for row in rows]
