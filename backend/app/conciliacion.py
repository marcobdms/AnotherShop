"""Conciliacion de pagos declarados con Binance Pay.

Toma los pagos `binance` en estado `declarado`, los cruza con el historial de
Binance (ver app/binance.py) y marca como `verificado` los que coinciden.

Verificar un pago NO confirma el pedido: eso sigue siendo una decision humana en
el CRM (crea la venta y baja el stock). Aqui solo se acredita que el dinero
entro, para que el cliente vea "pago verificado" sin esperar.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

import re

from app import binance, emails
from app.catalog_repository import get_meta
from app.checkout_repository import _now, pedido_pagos, pedidos
from app.database import get_engine

logger = logging.getLogger(__name__)

MAX_LOOKBACK_DAYS = 89  # Binance solo permite 90 dias por consulta


def _pay_id_configurado() -> str:
    """Tu Pay ID de Binance, tal como esta en Ajustes (metodo binance, dato "Pay ID")."""
    try:
        pagos = get_meta().get("pagos") or {}
        for metodo in pagos.get("metodos") or []:
            if metodo.get("id") != "binance":
                continue
            for dato in metodo.get("datos") or []:
                if "pay id" in str(dato.get("label", "")).lower():
                    return re.sub(r"\D", "", str(dato.get("valor", "")))
    except Exception:  # noqa: BLE001 - sin el dato, simplemente no se comprueba el receptor
        logger.warning("No se pudo leer el Pay ID configurado")
    return ""


def _report(configurado: bool) -> dict[str, Any]:
    return {
        "configurado": configurado,
        "verificados": [],
        "candidatos": [],
        "discrepancias": [],
        "pendientes": 0,
        "error": None,
    }


def sync_binance(force: bool = False) -> dict[str, Any]:
    """Concilia todos los pagos de Binance pendientes. Nunca lanza."""
    report = _report(binance.configured())
    if not report["configurado"]:
        return report

    try:
        with get_engine().connect() as connection:
            rows = connection.execute(
                select(
                    pedido_pagos.c.id.label("pago_id"),
                    pedido_pagos.c.referencia,
                    pedido_pagos.c.pedido_id,
                    pedidos.c.numero,
                    pedidos.c.total_usd,
                    pedidos.c.estado.label("pedido_estado"),
                    pedidos.c.creado_en,
                )
                .select_from(pedido_pagos.join(pedidos, pedidos.c.id == pedido_pagos.c.pedido_id))
                .where(
                    pedido_pagos.c.metodo == "binance",
                    pedido_pagos.c.estado == "declarado",
                    pedidos.c.estado.in_(("borrador", "pago_declarado", "verificado")),
                )
            ).all()
            usados = {
                r[0]
                for r in connection.execute(
                    select(pedido_pagos.c.id_externo).where(pedido_pagos.c.id_externo.isnot(None))
                )
            }

        report["pendientes"] = len(rows)
        if not rows:
            return report

        oldest = min(r.creado_en for r in rows)
        floor = _now() - timedelta(days=MAX_LOOKBACK_DAYS)
        since_ms = int((max(oldest - timedelta(minutes=10), floor)).timestamp() * 1000)

        txs, error = binance.recent_transactions(since_ms, force=force)
        if error:
            report["error"] = error
            return report

        receptor = _pay_id_configurado()

        for row in rows:
            resultado = binance.match_transaction(
                numero=row.numero,
                total_usd=float(row.total_usd),
                referencia=row.referencia or "",
                creado_ms=int(row.creado_en.timestamp() * 1000),
                txs=txs,
                usados=usados,
                receptor_id=receptor,
            )
            tx = resultado["verificada"]

            if tx and _apply_match(row, tx):
                usados.add(tx["id"])
                report["verificados"].append(
                    {"numero": row.numero, "transaccion": tx["id"], "importe": tx["importe"], "razones": tx["razones"]}
                )
                report["pendientes"] -= 1
                continue

            # Es de este pedido pero algo no cuadra: no se verifica y se deja el motivo
            # anotado en el pago para quien lo revise en el CRM.
            for d in resultado["discrepancias"][:3]:
                dtx = d["tx"]
                report["discrepancias"].append(
                    {
                        "numero": row.numero,
                        "transaccion": dtx["id"],
                        "importe": dtx["importe"],
                        "moneda": dtx["moneda"],
                        "problemas": d["problemas"],
                    }
                )
            if resultado["discrepancias"]:
                _note_discrepancy(row.pago_id, resultado["discrepancias"][0])
                continue

            for c in resultado["candidatos"][:3]:
                report["candidatos"].append(
                    {
                        "numero": row.numero,
                        "transaccion": c["id"],
                        "importe": c["importe"],
                        "moneda": c["moneda"],
                        "pagador": c["pagador_nombre"] or c["pagador_id"],
                    }
                )
    except Exception as error:  # noqa: BLE001 - la conciliacion no debe tumbar nunca una peticion
        logger.exception("Conciliacion Binance fallo")
        report["error"] = f"Error interno al conciliar: {type(error).__name__}"
    return report


def _apply_match(row: Any, tx: dict[str, Any]) -> bool:
    """Marca el pago como verificado. False si otro proceso ya uso esa transaccion."""
    now = _now()
    emails_pendiente = False
    try:
        with get_engine().begin() as connection:
            result = connection.execute(
                update(pedido_pagos)
                .where(pedido_pagos.c.id == row.pago_id, pedido_pagos.c.estado == "declarado")
                .values(
                    estado="verificado",
                    verificado_en=now,
                    verificado_por="binance",
                    id_externo=tx["id"],  # UNIQUE: la misma transaccion no vale dos veces
                    proveedor="binance_pay",
                    moneda="usdt",
                    monto=Decimal(str(tx["importe"])),
                    monto_usd=Decimal(str(tx["usd"])),
                    payload_raw=tx["raw"],
                    nota=(
                        f"Conciliado automaticamente: entraron {tx['usd']:.2f} {tx['moneda']}, "
                        f"esperado {float(row.total_usd):.2f} USD. Localizado por "
                        + " + ".join(tx["razones"])
                        + "."
                    ),
                )
            )
            if result.rowcount == 0:
                return False

            verificado = connection.execute(
                select(pedido_pagos.c.monto_usd).where(
                    pedido_pagos.c.pedido_id == row.pedido_id,
                    pedido_pagos.c.estado == "verificado",
                )
            ).all()
            cubierto = sum((Decimal(str(v[0])) for v in verificado), Decimal("0"))
            if cubierto + Decimal("0.01") >= Decimal(str(row.total_usd)):
                emails_pendiente = True
                connection.execute(
                    update(pedidos)
                    .where(pedidos.c.id == row.pedido_id, pedidos.c.estado.in_(("borrador", "pago_declarado")))
                    .values(estado="verificado", actualizado_en=now)
                )
        if emails_pendiente:
            emails.notify(row.numero, "verificado")
        return True
    except IntegrityError:
        logger.warning("Transaccion %s ya estaba asociada a otro pago", tx["id"])
        return False


def _note_discrepancy(pago_id: str, discrepancia: dict[str, Any]) -> None:
    """Anota en el pago por que no se pudo verificar (solo si el texto cambia)."""
    tx = discrepancia["tx"]
    texto = (
        f"REVISAR - Binance {tx['id']}: " + "; ".join(discrepancia["problemas"]) + "."
    )
    with get_engine().begin() as connection:
        connection.execute(
            update(pedido_pagos)
            .where(
                pedido_pagos.c.id == pago_id,
                pedido_pagos.c.estado == "declarado",
                pedido_pagos.c.nota != texto,
            )
            .values(nota=texto)
        )
