"""Pedidos de la tienda publica.

Un pedido online NO toca inventario ni crm.ventas: nace aqui, el admin lo
verifica en el CRM y solo al confirmarlo se convierte en la venta de siempre
(que es donde baja el stock) mas su abono.

Los precios se leen SIEMPRE del catalogo en el servidor. El cliente solo dice
que quiere, nunca cuanto cuesta.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace
from typing import Any, Optional
import os
import secrets
import uuid

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    Numeric,
    Table,
    Text,
    and_,
    func,
    insert,
    or_,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.engine import Connection

from app.catalog_repository import inventario, productos, variantes
from app.crm_repository import clientes, create_payment_tx, create_sale_tx
from app.database import get_engine


metadata = MetaData(schema="crm")

pedidos = Table(
    "pedidos",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column("numero", Text, nullable=False),
    Column("estado", Text, nullable=False),
    Column("nombre", Text, nullable=False),
    Column("telefono", Text, nullable=False),
    Column("email", Text, nullable=False),
    Column("user_id", UUID(as_uuid=False)),
    Column("cliente_id", UUID(as_uuid=False), ForeignKey("crm.clientes.id")),
    Column("venta_id", UUID(as_uuid=False), ForeignKey("crm.ventas.id")),
    Column("metodo_pago", Text, nullable=False),
    Column("total_usd", Numeric(12, 2), nullable=False),
    Column("nota", Text, nullable=False),
    Column("entrega", Text, nullable=False),
    Column("motivo_cancelacion", Text, nullable=False),
    Column("creado_en", DateTime(timezone=True), nullable=False),
    Column("actualizado_en", DateTime(timezone=True), nullable=False),
)

pedido_items = Table(
    "pedido_items",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column("pedido_id", UUID(as_uuid=False), ForeignKey("crm.pedidos.id"), nullable=False),
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

pedido_pagos = Table(
    "pedido_pagos",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column("pedido_id", UUID(as_uuid=False), ForeignKey("crm.pedidos.id"), nullable=False),
    Column("metodo", Text, nullable=False),
    Column("moneda", Text, nullable=False),
    Column("monto", Numeric(12, 2), nullable=False),
    Column("tasa", Numeric(18, 6)),
    Column("monto_usd", Numeric(12, 2), nullable=False),
    Column("referencia", Text, nullable=False),
    Column("id_externo", Text),
    Column("proveedor", Text, nullable=False),
    Column("estado", Text, nullable=False),
    Column("payload_raw", JSONB),
    Column("comprobante_path", Text, nullable=False),
    Column("nota", Text, nullable=False),
    Column("creado_en", DateTime(timezone=True), nullable=False),
    Column("verificado_en", DateTime(timezone=True)),
    Column("verificado_por", Text, nullable=False),
)


# Sin 0/O/1/I para que se pueda dictar por telefono sin confusiones.
NUMERO_ALFABETO = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
NUMERO_LARGO = 6

ESTADOS = {"borrador", "pago_declarado", "verificado", "confirmado", "cancelado"}
METODOS_PAGO = {"efectivo", "pago_movil", "binance", "zelle", "transferencia", "paypal"}
MONEDAS = {"usd", "bs", "eur", "usdt"}
MAX_ITEMS = 40
MAX_CANTIDAD = 10


def stock_estricto() -> bool:
    """CHECKOUT_STOCK_ESTRICTO=0 desactiva las comprobaciones de stock (pruebas).

    Por defecto es estricto: sin la variable, el checkout no permite vender lo
    que no hay. Recuerda quitar el 0 al salir de pruebas.
    """
    return os.getenv("CHECKOUT_STOCK_ESTRICTO", "1").strip().lower() not in ("0", "false", "no")


def _now() -> datetime:
    return datetime.now().astimezone()


def _new_id() -> str:
    return str(uuid.uuid4())


def _money(value: Any) -> float:
    if isinstance(value, Decimal):
        return float(value)
    return float(value or 0)


def _row_dict(row: Any) -> dict[str, Any]:
    data = row._mapping if hasattr(row, "_mapping") else row
    return dict(data)


def _new_numero(connection: Connection) -> str:
    """El numero es publico y sirve de clave de consulta, asi que no puede ser
    correlativo: seria adivinable."""
    for _ in range(12):
        code = "".join(secrets.choice(NUMERO_ALFABETO) for _ in range(NUMERO_LARGO))
        numero = f"ANPC-{code}"
        exists = connection.scalar(select(pedidos.c.id).where(pedidos.c.numero == numero))
        if not exists:
            return numero
    raise RuntimeError("No se pudo generar un numero de pedido unico")


def _rows_without_inventory(
    connection: Connection, producto_id: str, color: str, talla: str
) -> list[SimpleNamespace]:
    """Filas "virtuales" (stock 0) para productos que no tienen inventario cargado.

    Solo en modo no estricto. Muchas prendas del catalogo se publicaron sin
    inventario y, sin esto, no se podrian ni pedir. La fila de inventario real se
    crea al confirmar el pedido (ver create_sale_tx).
    """
    query = (
        select(
            productos.c.id.label("producto_id"),
            productos.c.ref,
            productos.c.nombre,
            productos.c.precio,
            productos.c.imagen_principal,
            productos.c.disponible,
            variantes.c.id.label("variante_id"),
            variantes.c.color,
            variantes.c.color_hex,
            variantes.c.imagen.label("variante_imagen"),
        )
        .select_from(productos.join(variantes, variantes.c.producto_id == productos.c.id))
        .where(productos.c.id == producto_id)
    )
    if color:
        query = query.where(func.lower(variantes.c.color) == color.lower())
    return [SimpleNamespace(**dict(r._mapping), talla=talla, stock=0) for r in connection.execute(query)]


def _resolve_line(connection: Connection, item: dict[str, Any], strict: bool = True) -> dict[str, Any]:
    """Resuelve producto + variante + talla y devuelve la linea con el precio
    del catalogo. El color es opcional: si el producto tiene una sola variante
    con esa talla, se deduce."""
    producto_id = str(item.get("producto_id") or "").strip()
    talla = str(item.get("talla") or "").strip().upper()
    color = str(item.get("color") or "").strip()
    quantity = int(item.get("cantidad") or 0)

    if not producto_id:
        raise ValueError("Falta el producto")
    if not talla:
        raise ValueError("Elige una talla para cada prenda")
    if quantity <= 0 or quantity > MAX_CANTIDAD:
        raise ValueError(f"Cantidad invalida (1-{MAX_CANTIDAD})")

    query = (
        select(
            productos.c.id.label("producto_id"),
            productos.c.ref,
            productos.c.nombre,
            productos.c.precio,
            productos.c.imagen_principal,
            productos.c.disponible,
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
                productos.c.id == producto_id,
                func.upper(inventario.c.talla) == talla,
            )
        )
    )
    if strict:
        query = query.where(inventario.c.stock > 0)
    if color:
        query = query.where(func.lower(variantes.c.color) == color.lower())

    rows = connection.execute(query).all()
    if not rows and not strict:
        rows = _rows_without_inventory(connection, producto_id, color, talla)
    if not rows:
        raise ValueError("Esa prenda ya no esta disponible en la talla elegida")
    if len(rows) > 1:
        raise ValueError("Elige el color de la prenda")

    row = rows[0]
    if not row.disponible:
        raise ValueError(f"{row.nombre} ya no esta disponible")
    if strict and int(row.stock or 0) < quantity:
        raise ValueError(f"Solo quedan {int(row.stock or 0)} de {row.nombre} en talla {row.talla}")

    price = Decimal(str(row.precio or 0))
    if price <= 0:
        raise ValueError(f"{row.nombre} no tiene precio asignado; escribenos para comprarla")

    return {
        "producto_id": row.producto_id,
        "variante_id": str(row.variante_id),
        "talla": row.talla,
        "cantidad": quantity,
        "precio_unitario": price,
        "subtotal": price * quantity,
        "producto_nombre": row.nombre,
        "producto_ref": row.ref or row.producto_id,
        "color": row.color or "",
        "color_hex": row.color_hex or "#000000",
        "imagen": row.variante_imagen or row.imagen_principal or "",
    }


def _item_out(row: Any) -> dict[str, Any]:
    data = _row_dict(row)
    return {
        "id": str(data["id"]),
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


def _payment_out(row: Any) -> dict[str, Any]:
    data = _row_dict(row)
    return {
        "id": str(data["id"]),
        "metodo": data["metodo"],
        "moneda": data["moneda"],
        "monto": _money(data["monto"]),
        "tasa": _money(data["tasa"]) if data.get("tasa") is not None else None,
        "monto_usd": _money(data["monto_usd"]),
        "referencia": data["referencia"] or "",
        "id_externo": data.get("id_externo") or "",
        "proveedor": data["proveedor"],
        "estado": data["estado"],
        "comprobante_path": data["comprobante_path"] or "",
        "nota": data["nota"] or "",
        "creado_en": data["creado_en"].isoformat() if data.get("creado_en") else "",
        "verificado_en": data["verificado_en"].isoformat() if data.get("verificado_en") else None,
        "verificado_por": data["verificado_por"] or "",
    }


def _order_out(row: Any, items: list[dict[str, Any]], pagos: list[dict[str, Any]]) -> dict[str, Any]:
    data = _row_dict(row)
    total = _money(data["total_usd"])
    declarado = sum(p["monto_usd"] for p in pagos if p["estado"] != "rechazado")
    return {
        "id": str(data["id"]),
        "numero": data["numero"],
        "estado": data["estado"],
        "nombre": data["nombre"] or "",
        "telefono": data["telefono"] or "",
        "email": data["email"] or "",
        "user_id": str(data["user_id"]) if data.get("user_id") else None,
        "cliente_id": str(data["cliente_id"]) if data.get("cliente_id") else None,
        "venta_id": str(data["venta_id"]) if data.get("venta_id") else None,
        "metodo_pago": data["metodo_pago"] or "",
        "total": total,
        "declarado": declarado,
        "pendiente": max(0.0, round(total - declarado, 2)),
        "nota": data["nota"] or "",
        "entrega": data["entrega"] or "",
        "motivo_cancelacion": data["motivo_cancelacion"] or "",
        "creado_en": data["creado_en"].isoformat() if data.get("creado_en") else "",
        "actualizado_en": data["actualizado_en"].isoformat() if data.get("actualizado_en") else "",
        "items": items,
        "pagos": pagos,
    }


def _load_order(connection: Connection, *, numero: str = "", order_id: str = "", lock: bool = False):
    query = select(pedidos)
    if numero:
        query = query.where(pedidos.c.numero == numero.strip().upper())
    elif order_id:
        query = query.where(pedidos.c.id == order_id)
    else:
        return None
    if lock:
        query = query.with_for_update()
    return connection.execute(query).first()


def _order_detail(connection: Connection, row: Any) -> dict[str, Any]:
    order_id = str(row.id)
    items = [
        _item_out(item)
        for item in connection.execute(
            select(pedido_items).where(pedido_items.c.pedido_id == order_id)
        )
    ]
    pagos = [
        _payment_out(pago)
        for pago in connection.execute(
            select(pedido_pagos)
            .where(pedido_pagos.c.pedido_id == order_id)
            .order_by(pedido_pagos.c.creado_en.asc())
        )
    ]
    return _order_out(row, items, pagos)


# ── Tienda publica ────────────────────────────────────────────────────────────

def create_order(fields: dict[str, Any]) -> dict[str, Any]:
    raw_items = fields.get("items") or []
    if not raw_items:
        raise ValueError("El pedido esta vacio")
    if len(raw_items) > MAX_ITEMS:
        raise ValueError("Demasiadas prendas en un mismo pedido")

    nombre = str(fields.get("nombre") or "").strip()
    if not nombre:
        raise ValueError("Necesitamos un nombre para el pedido")
    telefono = str(fields.get("telefono") or "").strip()
    email = str(fields.get("email") or "").strip().lower()
    if not telefono and not email:
        raise ValueError("Necesitamos un telefono o un email para avisarte")

    with get_engine().begin() as connection:
        strict = stock_estricto()
        prepared = [_resolve_line(connection, item, strict) for item in raw_items]
        total = sum((line["subtotal"] for line in prepared), Decimal("0"))
        if total <= 0:
            raise ValueError("El total del pedido no puede ser cero")

        now = _now()
        order_id = _new_id()
        row = connection.execute(
            insert(pedidos)
            .values(
                id=order_id,
                numero=_new_numero(connection),
                estado="borrador",
                nombre=nombre,
                telefono=telefono,
                email=email,
                user_id=str(fields["user_id"]) if fields.get("user_id") else None,
                metodo_pago="",
                total_usd=total,
                nota=str(fields.get("nota") or "").strip(),
                entrega=str(fields.get("entrega") or "").strip(),
                motivo_cancelacion="",
                creado_en=now,
                actualizado_en=now,
            )
            .returning(pedidos)
        ).first()
        connection.execute(
            insert(pedido_items),
            [{"id": _new_id(), "pedido_id": order_id, **line} for line in prepared],
        )
        return _order_detail(connection, row)


def get_order(numero: str) -> Optional[dict[str, Any]]:
    with get_engine().connect() as connection:
        row = _load_order(connection, numero=numero)
        return _order_detail(connection, row) if row else None


def declare_payment(numero: str, fields: dict[str, Any]) -> Optional[dict[str, Any]]:
    """El cliente dice como y cuanto pago. Todavia no es dinero contable.

    Efectivo es distinto: no hay nada que declarar hasta que se entregue el
    dinero en persona. Solo se anota el metodo elegido y el pedido queda por
    revisar; el cobro lo marca el admin al confirmar (`cobro_efectivo`).
    """
    metodo = str(fields.get("metodo") or "").strip().lower()
    if metodo not in METODOS_PAGO:
        raise ValueError("Metodo de pago no valido")
    moneda = str(fields.get("moneda") or "usd").strip().lower()
    if moneda not in MONEDAS:
        raise ValueError("Moneda no valida")
    if metodo == "efectivo":
        moneda = "usd"

    with get_engine().begin() as connection:
        row = _load_order(connection, numero=numero, lock=True)
        if not row:
            return None
        if row.estado in {"confirmado", "cancelado"}:
            raise ValueError("Este pedido ya esta cerrado")

        now = _now()
        if metodo == "efectivo":
            updated = connection.execute(
                update(pedidos)
                .where(pedidos.c.id == row.id)
                .values(estado="pago_declarado", metodo_pago="efectivo", actualizado_en=now)
                .returning(pedidos)
            ).first()
            return _order_detail(connection, updated)

        total = Decimal(str(row.total_usd))
        rate = Decimal(str(fields["tasa"])) if fields.get("tasa") else None
        if moneda == "bs" and not rate:
            raise ValueError("La tasa del dia no esta disponible; prueba en unos minutos")

        if fields.get("monto"):
            monto = Decimal(str(fields["monto"]))
        elif moneda == "bs":
            monto = (total * rate).quantize(Decimal("0.01"))
        else:
            monto = total
        if monto <= 0:
            raise ValueError("El importe debe ser mayor que cero")

        if moneda in ("usd", "usdt"):
            monto_usd = monto
        elif rate:
            monto_usd = (monto / rate).quantize(Decimal("0.01"))
        else:
            # Moneda sin tasa conocida: se asume que cubre el pedido y el admin
            # lo ajusta al verificar.
            monto_usd = total

        connection.execute(
            insert(pedido_pagos).values(
                id=_new_id(),
                pedido_id=str(row.id),
                metodo=metodo,
                moneda=moneda,
                monto=monto,
                tasa=rate,
                monto_usd=monto_usd,
                referencia=str(fields.get("referencia") or "").strip(),
                id_externo=str(fields.get("id_externo")).strip() if fields.get("id_externo") else None,
                proveedor=str(fields.get("proveedor") or "manual"),
                estado="declarado",
                payload_raw=fields.get("payload_raw"),
                comprobante_path=str(fields.get("comprobante_path") or ""),
                nota=str(fields.get("nota") or "").strip(),
                creado_en=now,
                verificado_por="",
            )
        )
        updated = connection.execute(
            update(pedidos)
            .where(pedidos.c.id == row.id)
            .values(estado="pago_declarado", metodo_pago=metodo, actualizado_en=now)
            .returning(pedidos)
        ).first()
        return _order_detail(connection, updated)


# ── CRM ───────────────────────────────────────────────────────────────────────

def list_orders(estado: str = "", search: str = "", user_id: str = "") -> list[dict[str, Any]]:
    with get_engine().connect() as connection:
        query = select(pedidos).order_by(pedidos.c.creado_en.desc())
        if user_id:
            query = query.where(pedidos.c.user_id == user_id).limit(30)
        if estado:
            query = query.where(pedidos.c.estado == estado)
        if search:
            term = f"%{search.lower()}%"
            query = query.where(
                or_(
                    func.lower(pedidos.c.numero).like(term),
                    func.lower(pedidos.c.nombre).like(term),
                    func.lower(pedidos.c.telefono).like(term),
                    func.lower(pedidos.c.email).like(term),
                )
            )
        rows = connection.execute(query).all()
        ids = [str(row.id) for row in rows]
        if not ids:
            return []

        items_by_order: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for item in connection.execute(
            select(pedido_items).where(pedido_items.c.pedido_id.in_(ids))
        ):
            items_by_order[str(item.pedido_id)].append(_item_out(item))

        pagos_by_order: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for pago in connection.execute(
            select(pedido_pagos)
            .where(pedido_pagos.c.pedido_id.in_(ids))
            .order_by(pedido_pagos.c.creado_en.asc())
        ):
            pagos_by_order[str(pago.pedido_id)].append(_payment_out(pago))

        return [
            _order_out(row, items_by_order.get(str(row.id), []), pagos_by_order.get(str(row.id), []))
            for row in rows
        ]


def _resolve_client(connection: Connection, row: Any, now: datetime) -> str:
    """Busca el cliente del CRM que corresponde al comprador, o lo crea.

    Mismo espiritu que la heuristica del importador (_find_import_client), pero
    empezando por la sesion y el email, que son mas fiables que el nombre.
    """
    if row.cliente_id:
        return str(row.cliente_id)

    candidates = []
    if row.user_id:
        candidates.append(clientes.c.user_id == str(row.user_id))
    if row.email:
        candidates.append(func.lower(clientes.c.email) == row.email.strip().lower())
    if row.telefono:
        candidates.append(clientes.c.telefono == row.telefono.strip())
    if row.nombre:
        candidates.append(func.lower(clientes.c.nombre) == row.nombre.strip().lower())

    for condition in candidates:
        found = connection.execute(select(clientes.c.id).where(condition).limit(1)).first()
        if found:
            client_id = str(found.id)
            # Rellenamos los huecos del cliente sin pisar lo que ya tuviera.
            values: dict[str, Any] = {"actualizado_en": now}
            if row.email:
                values["email"] = func.coalesce(func.nullif(clientes.c.email, ""), row.email)
            if row.telefono:
                values["telefono"] = func.coalesce(func.nullif(clientes.c.telefono, ""), row.telefono)
            if row.user_id:
                values["user_id"] = func.coalesce(clientes.c.user_id, str(row.user_id))
            connection.execute(
                update(clientes).where(clientes.c.id == client_id).values(**values)
            )
            return client_id

    client_id = _new_id()
    connection.execute(
        insert(clientes).values(
            id=client_id,
            nombre=row.nombre or "Cliente web",
            telefono=row.telefono or "",
            notas=f"Alta automatica desde el pedido {row.numero}",
            email=row.email or "",
            user_id=str(row.user_id) if row.user_id else None,
            creado_en=now,
            actualizado_en=now,
        )
    )
    return client_id


def confirm_order(
    order_id: str,
    usuario: str = "admin",
    registrar_pago: bool = True,
    cobro_efectivo: bool = False,
) -> dict[str, Any]:
    """Convierte el pedido en venta real. Aqui es donde baja el stock.

    Todo ocurre en una sola transaccion: si el stock ya no da, no se crea ni la
    venta ni el cliente ni el abono.
    """
    with get_engine().begin() as connection:
        row = _load_order(connection, order_id=order_id, lock=True)
        if not row:
            raise ValueError("Pedido no encontrado")
        if row.estado == "confirmado":
            raise ValueError("Este pedido ya esta confirmado")
        if row.estado == "cancelado":
            raise ValueError("Este pedido esta cancelado")

        item_rows = connection.execute(
            select(pedido_items).where(pedido_items.c.pedido_id == str(row.id))
        ).all()
        if not item_rows:
            raise ValueError("El pedido no tiene prendas")

        now = _now()
        client_id = _resolve_client(connection, row, now)

        sale = create_sale_tx(
            connection,
            client_id,
            [
                {
                    "producto_id": item.producto_id,
                    "variante_id": str(item.variante_id),
                    "talla": item.talla,
                    "cantidad": int(item.cantidad),
                    "precio_unitario": item.precio_unitario,
                }
                for item in item_rows
            ],
            usuario,
            nota=f"Pedido web {row.numero}",
            strict_stock=stock_estricto(),
        )

        pagos: list[Any] = []
        if registrar_pago:
            pagos = connection.execute(
                select(pedido_pagos).where(
                    and_(
                        pedido_pagos.c.pedido_id == str(row.id),
                        pedido_pagos.c.estado != "rechazado",
                    )
                )
            ).all()
            for pago in pagos:
                create_payment_tx(
                    connection,
                    client_id,
                    {
                        "monto": pago.monto,
                        "metodo": pago.metodo,
                        "moneda": pago.moneda,
                        "tasa": pago.tasa,
                        "monto_usd": pago.monto_usd,
                        "usuario": usuario,
                        "nota": f"Pedido web {row.numero}"
                        + (f" · ref {pago.referencia}" if pago.referencia else ""),
                    },
                    venta_id=sale["id"],
                )
                connection.execute(
                    update(pedido_pagos)
                    .where(pedido_pagos.c.id == pago.id)
                    .values(estado="verificado", verificado_en=now, verificado_por=usuario)
                )

        if cobro_efectivo:
            # Cobro en persona, en dolares. Solo se cobra lo que falte: si ya
            # habia pagos verificados por otra via no se cuenta dos veces.
            already = Decimal("0")
            if registrar_pago:
                already = sum(
                    (Decimal(str(p.monto_usd)) for p in pagos if p.estado != "rechazado"),
                    Decimal("0"),
                )
            remaining = Decimal(str(row.total_usd)) - already
            if remaining > 0:
                create_payment_tx(
                    connection,
                    client_id,
                    {
                        "monto": remaining,
                        "metodo": "efectivo",
                        "moneda": "usd",
                        "usuario": usuario,
                        "nota": f"Pedido web {row.numero} · efectivo en persona",
                    },
                    venta_id=sale["id"],
                )
                connection.execute(
                    insert(pedido_pagos).values(
                        id=_new_id(),
                        pedido_id=str(row.id),
                        metodo="efectivo",
                        moneda="usd",
                        monto=remaining,
                        monto_usd=remaining,
                        referencia="",
                        proveedor="manual",
                        estado="verificado",
                        comprobante_path="",
                        nota="Cobrado en persona",
                        creado_en=now,
                        verificado_en=now,
                        verificado_por=usuario,
                    )
                )

        updated = connection.execute(
            update(pedidos)
            .where(pedidos.c.id == row.id)
            .values(
                estado="confirmado",
                cliente_id=client_id,
                venta_id=sale["id"],
                actualizado_en=now,
            )
            .returning(pedidos)
        ).first()
        return _order_detail(connection, updated)


def set_order_status(order_id: str, estado: str, motivo: str = "") -> Optional[dict[str, Any]]:
    if estado not in ESTADOS:
        raise ValueError("Estado no valido")

    with get_engine().begin() as connection:
        row = _load_order(connection, order_id=order_id, lock=True)
        if not row:
            return None
        if row.estado == "confirmado":
            raise ValueError("Un pedido confirmado se corrige anulando su venta")

        updated = connection.execute(
            update(pedidos)
            .where(pedidos.c.id == row.id)
            .values(
                estado=estado,
                motivo_cancelacion=motivo or row.motivo_cancelacion,
                actualizado_en=_now(),
            )
            .returning(pedidos)
        ).first()
        return _order_detail(connection, updated)


def reject_payment(payment_id: str, usuario: str = "admin") -> bool:
    with get_engine().begin() as connection:
        result = connection.execute(
            update(pedido_pagos)
            .where(pedido_pagos.c.id == payment_id)
            .values(estado="rechazado", verificado_en=_now(), verificado_por=usuario)
        )
        return result.rowcount > 0
