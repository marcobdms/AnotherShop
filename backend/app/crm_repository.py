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
    case,
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
    delete,
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
    Column("moneda", Text, nullable=False),
    Column("usuario", Text, nullable=False),
    Column("nota", Text, nullable=False),
    Column("creado_en", DateTime(timezone=True), nullable=False),
    schema="crm",
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
            .where(abonos.c.moneda == "usd")
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


def delete_clients(client_ids: list[str]) -> list[dict[str, Any]]:
    unique_ids = list(dict.fromkeys(str(client_id) for client_id in client_ids if client_id))
    if not unique_ids:
        return []

    with get_engine().begin() as connection:
        rows = connection.execute(
            select(clientes).where(clientes.c.id.in_(unique_ids))
        ).all()
        if len(rows) != len(unique_ids):
            raise ValueError("Uno o varios clientes seleccionados ya no existen")

        active_client_ids = set(
            connection.execute(
                select(ventas.c.cliente_id)
                .where(
                    and_(
                        ventas.c.cliente_id.in_(unique_ids),
                        ventas.c.estado != "anulada",
                    )
                )
                .distinct()
            ).scalars()
        )
        if active_client_ids:
            names = sorted(
                row.nombre for row in rows if row.id in active_client_ids
            )
            raise ValueError(
                "Anula las compras activas antes de borrar: " + ", ".join(names)
            )

        sale_ids = select(ventas.c.id).where(ventas.c.cliente_id.in_(unique_ids))
        payment_ids = select(abonos.c.id).where(abonos.c.cliente_id.in_(unique_ids))

        connection.execute(
            delete(abono_asignaciones).where(
                or_(
                    abono_asignaciones.c.venta_id.in_(sale_ids),
                    abono_asignaciones.c.abono_id.in_(payment_ids),
                )
            )
        )
        connection.execute(
            delete(comprobantes_cliente).where(
                comprobantes_cliente.c.cliente_id.in_(unique_ids)
            )
        )
        connection.execute(delete(abonos).where(abonos.c.cliente_id.in_(unique_ids)))
        connection.execute(
            delete(venta_items).where(venta_items.c.venta_id.in_(sale_ids))
        )
        connection.execute(delete(ventas).where(ventas.c.cliente_id.in_(unique_ids)))
        connection.execute(delete(clientes).where(clientes.c.id.in_(unique_ids)))
        return [_client_out(row) for row in rows]


def delete_client(client_id: str) -> Optional[dict[str, Any]]:
    try:
        deleted = delete_clients([client_id])
    except ValueError as error:
        if "ya no existen" in str(error):
            return None
        raise
    return deleted[0] if deleted else None


def get_client(client_id: str) -> Optional[dict[str, Any]]:
    with get_engine().connect() as connection:
        row = connection.execute(select(clientes).where(clientes.c.id == client_id)).first()
        if not row:
            return None
        return _client_out(row, _client_balance_rows(connection).get(client_id))


PAYMENT_METHODS = {"desconocido", "efectivo", "transferencia", "zelle", "binance", "paypal"}
PAYMENT_CURRENCIES = {"usd", "bs", "eur", "usdt"}


def _field(data: dict[str, Any], *keys: str, default: Any = "") -> Any:
    for key in keys:
        value = data.get(key)
        if value is not None and value != "":
            return value
    return default


def _items(data: Any) -> list[Any]:
    if not data:
        return []
    return data if isinstance(data, list) else [data]


def _decimal(value: Any, default: str = "0") -> Decimal:
    try:
        return Decimal(str(value if value not in (None, "") else default))
    except Exception as error:
        raise ValueError(f"Numero invalido: {value}") from error


def _date(value: Any, fallback: datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    if not value:
        return fallback
    text = str(value).strip()
    if not text:
        return fallback
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return fallback


def _payment_method(value: Any) -> str:
    method = str(value or "efectivo").strip().lower()
    aliases = {
        "cash": "efectivo",
        "transfer": "transferencia",
        "transferencia bancaria": "transferencia",
        "bank": "transferencia",
        "paypal": "paypal",
        "pay pal": "paypal",
    }
    method = aliases.get(method, method)
    if method not in PAYMENT_METHODS:
        raise ValueError(f"Metodo de pago invalido: {method}")
    return method


def _payment_currency(value: Any) -> str:
    currency = str(value or "usd").strip().lower()
    aliases = {
        "$": "usd",
        "dolar": "usd",
        "dolares": "usd",
        "dólar": "usd",
        "dólares": "usd",
        "bolivar": "bs",
        "bolivares": "bs",
        "bolívar": "bs",
        "bolívares": "bs",
        "ves": "bs",
        "eur": "eur",
        "euro": "eur",
        "euros": "eur",
        "usdt": "usdt",
        "binance usdt": "usdt",
    }
    currency = aliases.get(currency, currency)
    if currency not in PAYMENT_CURRENCIES:
        raise ValueError(f"Moneda invalida: {currency}")
    return currency


def _payment_method_and_currency(method_value: Any, currency_value: Any = None) -> tuple[str, str]:
    raw_method = str(method_value or "").strip().lower()
    if raw_method:
        try:
            method_as_currency = _payment_currency(raw_method)
            if raw_method in PAYMENT_CURRENCIES or raw_method not in PAYMENT_METHODS:
                return "desconocido", method_as_currency
        except ValueError:
            pass
    return _payment_method(method_value or "desconocido"), _payment_currency(currency_value)


def _uuid_text(value: Any) -> str:
    try:
        return str(uuid.UUID(str(value)))
    except Exception:
        return _new_id()


def _payload_clients(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        rows = (
            payload.get("clientes")
            or payload.get("clients")
            or payload.get("registros")
            or payload.get("data")
        )
        if rows is None and _field(payload, "nombre", "name"):
            rows = [payload]
    else:
        rows = None

    if not isinstance(rows, list):
        raise ValueError("El JSON debe ser una lista o tener una propiedad clientes")
    if not all(isinstance(row, dict) for row in rows):
        raise ValueError("Cada cliente del JSON debe ser un objeto")
    return rows


def _find_import_client(connection: Connection, name: str, phone: str) -> Optional[Any]:
    if phone:
        row = connection.execute(select(clientes).where(clientes.c.telefono == phone)).first()
        if row:
            return row
    if name:
        return connection.execute(
            select(clientes).where(func.lower(clientes.c.nombre) == name.lower())
        ).first()
    return None


def _upsert_import_client(connection: Connection, record: dict[str, Any], now: datetime) -> tuple[str, bool]:
    name = str(_field(record, "nombre", "name", "cliente", default="")).strip()
    phone = str(_field(record, "telefono", "phone", "celular", "movil", default="")).strip()
    notes = str(_field(record, "notas", "nota", "notes", default="")).strip()
    if not name:
        raise ValueError("Hay un cliente sin nombre")

    row = _find_import_client(connection, name, phone)
    if row:
        connection.execute(
            update(clientes)
            .where(clientes.c.id == row.id)
            .values(
                nombre=name or row.nombre,
                telefono=phone or row.telefono,
                notas=notes or row.notas,
                actualizado_en=now,
            )
        )
        return str(row.id), False

    client_id = _new_id()
    connection.execute(
        insert(clientes).values(
            id=client_id,
            nombre=name,
            telefono=phone,
            notas=notes,
            creado_en=now,
            actualizado_en=now,
        )
    )
    return client_id, True


def _import_sale_items(record: dict[str, Any], sale_id: str) -> tuple[list[dict[str, Any]], Decimal]:
    raw_items = _items(
        _field(record, "items", "prendas", "productos", "lineas", default=[])
    )
    explicit_total = _decimal(_field(record, "total", "monto", "importe", default=0))

    if not raw_items and explicit_total > 0:
        raw_items = [{"nombre": _field(record, "concepto", "descripcion", default="Compra historica"), "precio": explicit_total}]

    items = []
    total = Decimal("0")
    for raw in raw_items:
        if not isinstance(raw, dict):
            raise ValueError("Cada prenda historica debe ser un objeto")
        quantity = int(_decimal(_field(raw, "cantidad", "qty", "unidades", default=1)))
        if quantity <= 0:
            raise ValueError("La cantidad debe ser mayor a cero")
        unit_price = _decimal(_field(raw, "precio_unitario", "precio", "unitario", default=0))
        line_total = _decimal(_field(raw, "subtotal", "total", default=0))
        if unit_price <= 0 and line_total > 0:
            unit_price = line_total / quantity
        subtotal = unit_price * quantity
        total += subtotal
        items.append(
            {
                "id": _new_id(),
                "venta_id": sale_id,
                "producto_id": str(_field(raw, "producto_id", "product_id", "ref", default="historico")),
                "variante_id": _uuid_text(_field(raw, "variante_id", "variant_id", default="")),
                "talla": str(_field(raw, "talla", "size", default="")),
                "cantidad": quantity,
                "precio_unitario": unit_price,
                "subtotal": subtotal,
                "producto_nombre": str(_field(raw, "producto_nombre", "nombre", "name", default="Compra historica")),
                "producto_ref": str(_field(raw, "producto_ref", "ref", "referencia", default="historico")),
                "color": str(_field(raw, "color", default="")),
                "color_hex": str(_field(raw, "color_hex", "hex", default="#000000")),
                "imagen": str(_field(raw, "imagen", "image", "foto", default="")),
            }
        )

    if items and total <= 0 and explicit_total > 0:
        items[0]["precio_unitario"] = explicit_total
        items[0]["subtotal"] = explicit_total

    return items, explicit_total if explicit_total > 0 else total


def import_history_from_json(payload: Any, usuario: str = "admin") -> dict[str, Any]:
    rows = _payload_clients(payload)
    summary = {
        "clientes_creados": 0,
        "clientes_actualizados": 0,
        "ventas_creadas": 0,
        "abonos_creados": 0,
        "items_creados": 0,
    }

    with get_engine().begin() as connection:
        for record in rows:
            now = _now()
            client_id, created = _upsert_import_client(connection, record, now)
            if created:
                summary["clientes_creados"] += 1
            else:
                summary["clientes_actualizados"] += 1

            sales = _items(_field(record, "compras", "ventas", "purchases", default=[]))
            if not sales and any(key in record for key in ("items", "prendas", "productos", "total")):
                sales = [record]
            for sale in sales:
                if not isinstance(sale, dict):
                    raise ValueError("Cada compra historica debe ser un objeto")
                sale_id = _new_id()
                sale_date = _date(_field(sale, "fecha", "creada_en", "created_at", "date", default=None), now)
                estado = str(_field(sale, "estado", "status", default="activa")).strip().lower()
                if estado not in {"activa", "anulada"}:
                    estado = "activa"
                sale_items, total = _import_sale_items(sale, sale_id)
                if total <= 0:
                    continue
                connection.execute(
                    insert(ventas).values(
                        id=sale_id,
                        cliente_id=client_id,
                        estado=estado,
                        total=total,
                        usuario=usuario or "admin",
                        nota=str(_field(sale, "nota", "notas", "notes", default="")),
                        creada_en=sale_date,
                        anulada_en=sale_date if estado == "anulada" else None,
                        motivo_anulacion=str(_field(sale, "motivo_anulacion", "motivo", default="Importacion historica")) if estado == "anulada" else "",
                    )
                )
                if sale_items:
                    connection.execute(insert(venta_items), sale_items)
                    summary["items_creados"] += len(sale_items)
                summary["ventas_creadas"] += 1

            payments = _items(_field(record, "abonos", "pagos", "payments", default=[]))
            for payment in payments:
                if not isinstance(payment, dict):
                    raise ValueError("Cada abono historico debe ser un objeto")
                amount = _decimal(_field(payment, "monto", "amount", "total", "importe", default=0))
                if amount <= 0:
                    continue
                payment_id = _new_id()
                payment_date = _date(_field(payment, "fecha", "creado_en", "created_at", "date", default=None), now)
                method, currency = _payment_method_and_currency(
                    _field(payment, "metodo", "method", default="desconocido"),
                    _field(payment, "moneda", "currency", "divisa", default=None),
                )
                row = connection.execute(
                    insert(abonos)
                    .values(
                        id=payment_id,
                        cliente_id=client_id,
                        monto=amount,
                        metodo=method,
                        moneda=currency,
                        usuario=str(_field(payment, "usuario", "user", default=usuario or "admin")),
                        nota=str(_field(payment, "nota", "notas", "notes", default="")),
                        creado_en=payment_date,
                    )
                    .returning(abonos)
                ).first()
                _allocate_payment(connection, client_id, str(row.id), amount, payment_date)
                summary["abonos_creados"] += 1

            connection.execute(
                update(clientes)
                .where(clientes.c.id == client_id)
                .values(actualizado_en=now)
            )

    return summary


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
            .select_from(
                abono_asignaciones.join(
                    abonos,
                    abonos.c.id == abono_asignaciones.c.abono_id,
                )
            )
            .where(
                abono_asignaciones.c.venta_id.in_(ids),
                abonos.c.moneda == "usd",
            )
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
    if amount <= 0:
        raise ValueError("El abono debe ser mayor a cero")
    method, currency = _payment_method_and_currency(fields.get("metodo"), fields.get("moneda"))

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
                moneda=currency,
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
        "moneda": data["moneda"] or "usd",
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


def _dashboard_metric_block(
    connection: Connection,
    start: datetime,
    end: datetime,
) -> dict[str, float | int]:
    sale_filter = (
        ventas.c.estado == "activa",
        ventas.c.creada_en >= start,
        ventas.c.creada_en < end,
    )
    sale_row = connection.execute(
        select(
            func.count(ventas.c.id).label("orders"),
            func.coalesce(func.sum(ventas.c.total), 0).label("net_sales"),
            func.count(func.distinct(ventas.c.cliente_id)).label("customers"),
        ).where(*sale_filter)
    ).one()
    units = connection.scalar(
        select(func.coalesce(func.sum(venta_items.c.cantidad), 0))
        .select_from(
            venta_items.join(ventas, ventas.c.id == venta_items.c.venta_id)
        )
        .where(*sale_filter)
    )
    cancellation_row = connection.execute(
        select(
            func.count(ventas.c.id).label("cancelled_orders"),
            func.coalesce(func.sum(ventas.c.total), 0).label("cancelled_value"),
        ).where(
            ventas.c.estado == "anulada",
            ventas.c.creada_en >= start,
            ventas.c.creada_en < end,
        )
    ).one()
    orders = int(sale_row.orders or 0)
    cancelled_orders = int(cancellation_row.cancelled_orders or 0)
    total_attempts = orders + cancelled_orders
    net_sales = _money(sale_row.net_sales)
    return {
        "net_sales": net_sales,
        "orders": orders,
        "units": int(units or 0),
        "average_ticket": net_sales / orders if orders else 0,
        "customers": int(sale_row.customers or 0),
        "cancelled_orders": cancelled_orders,
        "cancelled_value": _money(cancellation_row.cancelled_value),
        "cancellation_rate": cancelled_orders / total_attempts if total_attempts else 0,
    }


def dashboard_summary(
    start: datetime,
    end: datetime,
    timezone_name: str = "Europe/Madrid",
) -> dict[str, Any]:
    """Resumen operativo del CRM.

    Las ventas se consideran expresadas en USD. Los cobros y asignaciones de
    otras monedas quedan fuera de los totales y se reportan como calidad de
    datos para no mezclar importes incompatibles.
    """

    if end <= start:
        raise ValueError("El final del periodo debe ser posterior al inicio")

    period_length = end - start
    previous_start = start - period_length
    previous_end = start

    with get_engine().connect() as connection:
        current = _dashboard_metric_block(connection, start, end)
        previous = _dashboard_metric_block(connection, previous_start, previous_end)

        sale_units = (
            select(
                venta_items.c.venta_id,
                func.sum(venta_items.c.cantidad).label("units"),
            )
            .group_by(venta_items.c.venta_id)
            .subquery()
        )
        bucket = func.date_trunc(
            "day",
            func.timezone(timezone_name, ventas.c.creada_en),
        ).label("bucket")
        series_rows = connection.execute(
            select(
                bucket,
                func.coalesce(func.sum(ventas.c.total), 0).label("sales"),
                func.count(ventas.c.id).label("orders"),
                func.coalesce(func.sum(sale_units.c.units), 0).label("units"),
            )
            .select_from(
                ventas.outerjoin(sale_units, sale_units.c.venta_id == ventas.c.id)
            )
            .where(
                ventas.c.estado == "activa",
                ventas.c.creada_en >= start,
                ventas.c.creada_en < end,
            )
            .group_by(bucket)
            .order_by(bucket)
        ).all()

        stock_by_product = (
            select(
                variantes.c.producto_id.label("producto_id"),
                func.coalesce(func.sum(inventario.c.stock), 0).label("stock"),
            )
            .select_from(
                variantes.outerjoin(
                    inventario,
                    inventario.c.variante_id == variantes.c.id,
                )
            )
            .group_by(variantes.c.producto_id)
            .subquery()
        )
        top_product_rows = connection.execute(
            select(
                venta_items.c.producto_id,
                venta_items.c.producto_nombre,
                venta_items.c.producto_ref,
                func.sum(venta_items.c.cantidad).label("units"),
                func.sum(venta_items.c.subtotal).label("sales"),
                func.coalesce(stock_by_product.c.stock, 0).label("stock"),
            )
            .select_from(
                venta_items.join(
                    ventas,
                    ventas.c.id == venta_items.c.venta_id,
                ).outerjoin(
                    stock_by_product,
                    stock_by_product.c.producto_id == venta_items.c.producto_id,
                )
            )
            .where(
                ventas.c.estado == "activa",
                ventas.c.creada_en >= start,
                ventas.c.creada_en < end,
            )
            .group_by(
                venta_items.c.producto_id,
                venta_items.c.producto_nombre,
                venta_items.c.producto_ref,
                stock_by_product.c.stock,
            )
            .order_by(
                func.sum(venta_items.c.cantidad).desc(),
                func.sum(venta_items.c.subtotal).desc(),
            )
            .limit(10)
        ).all()

        size_rows = connection.execute(
            select(
                venta_items.c.talla,
                func.sum(venta_items.c.cantidad).label("units"),
                func.sum(venta_items.c.subtotal).label("sales"),
            )
            .select_from(
                venta_items.join(ventas, ventas.c.id == venta_items.c.venta_id)
            )
            .where(
                ventas.c.estado == "activa",
                ventas.c.creada_en >= start,
                ventas.c.creada_en < end,
            )
            .group_by(venta_items.c.talla)
            .order_by(func.sum(venta_items.c.cantidad).desc())
        ).all()
        color_rows = connection.execute(
            select(
                venta_items.c.color,
                venta_items.c.color_hex,
                func.sum(venta_items.c.cantidad).label("units"),
                func.sum(venta_items.c.subtotal).label("sales"),
            )
            .select_from(
                venta_items.join(ventas, ventas.c.id == venta_items.c.venta_id)
            )
            .where(
                ventas.c.estado == "activa",
                ventas.c.creada_en >= start,
                ventas.c.creada_en < end,
            )
            .group_by(venta_items.c.color, venta_items.c.color_hex)
            .order_by(func.sum(venta_items.c.cantidad).desc())
            .limit(8)
        ).all()

        paid_by_sale = (
            select(
                abono_asignaciones.c.venta_id,
                func.coalesce(func.sum(abono_asignaciones.c.monto), 0).label("paid"),
            )
            .select_from(
                abono_asignaciones.join(
                    abonos,
                    abonos.c.id == abono_asignaciones.c.abono_id,
                )
            )
            .where(abonos.c.moneda == "usd")
            .group_by(abono_asignaciones.c.venta_id)
            .subquery()
        )
        outstanding_rows = connection.execute(
            select(
                ventas.c.id,
                ventas.c.cliente_id,
                clientes.c.nombre,
                ventas.c.creada_en,
                ventas.c.total,
                func.coalesce(paid_by_sale.c.paid, 0).label("paid"),
            )
            .select_from(
                ventas.join(
                    clientes,
                    clientes.c.id == ventas.c.cliente_id,
                ).outerjoin(
                    paid_by_sale,
                    paid_by_sale.c.venta_id == ventas.c.id,
                )
            )
            .where(ventas.c.estado == "activa")
            .order_by(ventas.c.creada_en)
        ).all()

        aging = {
            "0_7": 0.0,
            "8_30": 0.0,
            "31_60": 0.0,
            "61_plus": 0.0,
        }
        debtors: dict[str, dict[str, Any]] = {}
        now = _now()
        outstanding_total = 0.0
        for row in outstanding_rows:
            pending = max(0.0, _money(row.total) - _money(row.paid))
            if pending <= 0:
                continue
            age_days = max(0, (now - row.creada_en).days)
            if age_days <= 7:
                aging["0_7"] += pending
            elif age_days <= 30:
                aging["8_30"] += pending
            elif age_days <= 60:
                aging["31_60"] += pending
            else:
                aging["61_plus"] += pending
            outstanding_total += pending
            debtor = debtors.setdefault(
                str(row.cliente_id),
                {
                    "cliente_id": str(row.cliente_id),
                    "nombre": row.nombre,
                    "pending": 0.0,
                    "oldest_days": age_days,
                    "sales": 0,
                },
            )
            debtor["pending"] += pending
            debtor["oldest_days"] = max(debtor["oldest_days"], age_days)
            debtor["sales"] += 1

        customer_rows = connection.execute(
            select(
                clientes.c.id,
                clientes.c.nombre,
                func.sum(ventas.c.total).label("sales"),
                func.count(ventas.c.id).label("orders"),
                func.max(ventas.c.creada_en).label("last_purchase"),
            )
            .select_from(
                clientes.join(ventas, ventas.c.cliente_id == clientes.c.id)
            )
            .where(
                ventas.c.estado == "activa",
                ventas.c.creada_en >= start,
                ventas.c.creada_en < end,
            )
            .group_by(clientes.c.id, clientes.c.nombre)
            .order_by(func.sum(ventas.c.total).desc())
            .limit(10)
        ).all()

        payment_rows = connection.execute(
            select(
                abonos.c.metodo,
                func.sum(abonos.c.monto).label("amount"),
                func.count(abonos.c.id).label("payments"),
            )
            .where(
                abonos.c.moneda == "usd",
                abonos.c.creado_en >= start,
                abonos.c.creado_en < end,
            )
            .group_by(abonos.c.metodo)
            .order_by(func.sum(abonos.c.monto).desc())
        ).all()
        collections_total = sum(_money(row.amount) for row in payment_rows)

        inventory_row = connection.execute(
            select(
                func.coalesce(func.sum(inventario.c.stock), 0).label("units"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                (inventario.c.stock > 0)
                                & (inventario.c.stock <= 2),
                                1,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("low_skus"),
                func.coalesce(
                    func.sum(case((inventario.c.stock == 0, 1), else_=0)),
                    0,
                ).label("empty_skus"),
            )
        ).one()

        product_sales = (
            select(
                venta_items.c.producto_id,
                func.max(venta_items.c.producto_nombre).label("nombre"),
                func.max(venta_items.c.producto_ref).label("ref"),
                func.sum(venta_items.c.cantidad).label("sold_units"),
            )
            .select_from(
                venta_items.join(ventas, ventas.c.id == venta_items.c.venta_id)
            )
            .where(
                ventas.c.estado == "activa",
                ventas.c.creada_en >= start,
                ventas.c.creada_en < end,
            )
            .group_by(venta_items.c.producto_id)
            .subquery()
        )
        stock_risk_rows = connection.execute(
            select(
                product_sales.c.producto_id,
                product_sales.c.nombre,
                product_sales.c.ref,
                product_sales.c.sold_units,
                func.coalesce(stock_by_product.c.stock, 0).label("stock"),
            )
            .select_from(
                product_sales.outerjoin(
                    stock_by_product,
                    stock_by_product.c.producto_id == product_sales.c.producto_id,
                )
            )
            .where(func.coalesce(stock_by_product.c.stock, 0) <= 5)
            .order_by(
                product_sales.c.sold_units.desc(),
                func.coalesce(stock_by_product.c.stock, 0),
            )
            .limit(8)
        ).all()

        non_usd_rows = connection.execute(
            select(
                abonos.c.moneda,
                func.count(abonos.c.id).label("payments"),
                func.sum(abonos.c.monto).label("amount"),
            )
            .where(
                abonos.c.moneda != "usd",
                abonos.c.creado_en >= start,
                abonos.c.creado_en < end,
            )
            .group_by(abonos.c.moneda)
        ).all()
        unknown_payments = connection.scalar(
            select(func.count(abonos.c.id)).where(
                abonos.c.moneda == "usd",
                abonos.c.metodo == "desconocido",
                abonos.c.creado_en >= start,
                abonos.c.creado_en < end,
            )
        )
        sales_without_items = connection.scalar(
            select(func.count(ventas.c.id))
            .select_from(
                ventas.outerjoin(
                    venta_items,
                    venta_items.c.venta_id == ventas.c.id,
                )
            )
            .where(
                ventas.c.estado == "activa",
                ventas.c.creada_en >= start,
                ventas.c.creada_en < end,
                venta_items.c.id.is_(None),
            )
        )
        unmatched_products = connection.scalar(
            select(func.count(venta_items.c.id))
            .select_from(
                venta_items.join(
                    ventas,
                    ventas.c.id == venta_items.c.venta_id,
                ).outerjoin(
                    productos,
                    productos.c.id == venta_items.c.producto_id,
                )
            )
            .where(
                ventas.c.estado == "activa",
                ventas.c.creada_en >= start,
                ventas.c.creada_en < end,
                productos.c.id.is_(None),
            )
        )
        sold_products_without_cost = connection.scalar(
            select(func.count(func.distinct(venta_items.c.producto_id)))
            .select_from(
                venta_items.join(
                    ventas,
                    ventas.c.id == venta_items.c.venta_id,
                ).outerjoin(
                    productos,
                    productos.c.id == venta_items.c.producto_id,
                )
            )
            .where(
                ventas.c.estado == "activa",
                ventas.c.creada_en >= start,
                ventas.c.creada_en < end,
                (productos.c.id.is_(None)) | (productos.c.precio_coste <= 0),
            )
        )

    sorted_debtors = sorted(
        debtors.values(),
        key=lambda row: (row["pending"], row["oldest_days"]),
        reverse=True,
    )
    return {
        "currency": "USD",
        "period": {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "previous_start": previous_start.isoformat(),
            "previous_end": previous_end.isoformat(),
            "timezone": timezone_name,
        },
        "kpis": current,
        "previous_kpis": previous,
        "sales_series": [
            {
                "date": row.bucket.date().isoformat(),
                "sales": _money(row.sales),
                "orders": int(row.orders or 0),
                "units": int(row.units or 0),
            }
            for row in series_rows
        ],
        "collections": {
            "total": collections_total,
            "by_method": [
                {
                    "method": row.metodo,
                    "amount": _money(row.amount),
                    "payments": int(row.payments or 0),
                }
                for row in payment_rows
            ],
        },
        "receivables": {
            "total": outstanding_total,
            "clients": len(debtors),
            "aging": aging,
            "top_debtors": sorted_debtors[:10],
        },
        "top_products": [
            {
                "producto_id": row.producto_id,
                "name": row.producto_nombre,
                "ref": row.producto_ref,
                "units": int(row.units or 0),
                "sales": _money(row.sales),
                "stock": int(row.stock or 0),
            }
            for row in top_product_rows
        ],
        "sizes": [
            {
                "size": row.talla or "Sin talla",
                "units": int(row.units or 0),
                "sales": _money(row.sales),
            }
            for row in size_rows
        ],
        "colors": [
            {
                "color": row.color or "Sin color",
                "hex": row.color_hex or "#000000",
                "units": int(row.units or 0),
                "sales": _money(row.sales),
            }
            for row in color_rows
        ],
        "top_customers": [
            {
                "cliente_id": str(row.id),
                "name": row.nombre,
                "sales": _money(row.sales),
                "orders": int(row.orders or 0),
                "pending": debtors.get(str(row.id), {}).get("pending", 0),
                "last_purchase": row.last_purchase.isoformat() if row.last_purchase else "",
            }
            for row in customer_rows
        ],
        "inventory": {
            "units": int(inventory_row.units or 0),
            "low_skus": int(inventory_row.low_skus or 0),
            "empty_skus": int(inventory_row.empty_skus or 0),
            "stock_risk": [
                {
                    "producto_id": row.producto_id,
                    "name": row.nombre,
                    "ref": row.ref,
                    "sold_units": int(row.sold_units or 0),
                    "stock": int(row.stock or 0),
                }
                for row in stock_risk_rows
            ],
        },
        "data_quality": {
            "non_usd_payments": [
                {
                    "currency": row.moneda.upper(),
                    "payments": int(row.payments or 0),
                    "amount": _money(row.amount),
                }
                for row in non_usd_rows
            ],
            "unknown_payment_methods": int(unknown_payments or 0),
            "sales_without_items": int(sales_without_items or 0),
            "unmatched_product_items": int(unmatched_products or 0),
            "sold_products_without_cost": int(sold_products_without_cost or 0),
        },
    }
