"""Conciliacion de pagos con Binance Pay (solo lectura).

Usa GET /sapi/v1/pay/transactions con una API key de SOLO LECTURA. Nunca mueve
dinero: solo lee el historial de Binance Pay para comprobar que un pago que el
cliente declaro (metodo = binance) realmente entro en la cuenta.

Configuracion (solo backend, nunca en el bundle del navegador):
  BINANCE_API_KEY, BINANCE_API_SECRET   clave de solo lectura
  BINANCE_API_BASE                      opcional (por defecto api.binance.com)

Como se verifica un pago (ver match_transaction): el Binance ID o el numero de
pedido en la nota solo LOCALIZAN la transaccion; despues se compara importe,
moneda y receptor contra lo que dice el CRM. Solo un pago exacto se verifica;
cualquier diferencia queda marcada para revision humana.

La API real devuelve `note` (comprobado), pero `payerInfo.binanceId` llega vacio
en algunas transacciones, asi que ninguna de las dos senales basta por si sola.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
from threading import Lock
import time
from typing import Any, Optional
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)

PAY_TRANSACTIONS_PATH = "/sapi/v1/pay/transactions"

# Monedas que valen 1 dolar: el resto no se concilia automaticamente.
STABLECOINS = {"USDT", "USDC", "FDUSD", "BUSD", "USD1", "TUSD"}

# Margen para pedidos creados justo antes de que el pago aparezca con otra hora.
CLOCK_SLACK_MS = 5 * 60 * 1000
AMOUNT_TOLERANCE = 0.01
MIN_SYNC_INTERVAL = 30  # segundos entre consultas automaticas


class BinanceError(RuntimeError):
    """Error al hablar con Binance (sin datos sensibles en el mensaje)."""


def configured() -> bool:
    return bool(os.getenv("BINANCE_API_KEY", "").strip() and os.getenv("BINANCE_API_SECRET", "").strip())


def _base_url() -> str:
    return os.getenv("BINANCE_API_BASE", "https://api.binance.com").strip().rstrip("/")


def sign(query: str, secret: str) -> str:
    return hmac.new(secret.encode(), query.encode(), hashlib.sha256).hexdigest()


def fetch_pay_transactions(
    start_ms: Optional[int] = None,
    end_ms: Optional[int] = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Historial de Binance Pay. Lanza BinanceError si algo falla."""
    key = os.getenv("BINANCE_API_KEY", "").strip()
    secret = os.getenv("BINANCE_API_SECRET", "").strip()
    if not key or not secret:
        raise BinanceError("Binance no esta configurado (faltan BINANCE_API_KEY / BINANCE_API_SECRET)")

    params: dict[str, Any] = {"timestamp": int(time.time() * 1000), "recvWindow": 10000, "limit": limit}
    if start_ms:
        params["startTime"] = int(start_ms)
    if end_ms:
        params["endTime"] = int(end_ms)

    query = urlencode(params)
    url = f"{_base_url()}{PAY_TRANSACTIONS_PATH}?{query}&signature={sign(query, secret)}"

    try:
        with httpx.Client(timeout=15) as client:
            response = client.get(url, headers={"X-MBX-APIKEY": key})
    except httpx.HTTPError as error:
        raise BinanceError(f"No se pudo conectar con Binance: {type(error).__name__}") from error

    try:
        body = response.json()
    except ValueError as error:
        raise BinanceError(f"Respuesta no valida de Binance (HTTP {response.status_code})") from error

    if response.status_code != 200 or (
        isinstance(body, dict) and body.get("code") not in (None, "000000", 0, "0")
        and not body.get("success", False)
    ):
        code = body.get("code") if isinstance(body, dict) else None
        message = (body.get("msg") or body.get("message") or "") if isinstance(body, dict) else ""
        raise BinanceError(_explain(response.status_code, code, message))

    data = body.get("data") if isinstance(body, dict) else None
    return data if isinstance(data, list) else []


def _explain(status: int, code: Any, message: str) -> str:
    hints = {
        -2015: "La clave no es valida, no tiene permiso de lectura o la IP del servidor no esta en la lista blanca",
        -1022: "Firma invalida: revisa BINANCE_API_SECRET",
        -1021: "El reloj del servidor esta desincronizado con Binance",
        -2014: "Formato de la API key no valido",
    }
    try:
        hint = hints.get(int(code))
    except (TypeError, ValueError):
        hint = None
    return hint or f"Binance respondio HTTP {status} (codigo {code}): {message[:120]}"


def _norm(value: Any) -> str:
    return re.sub(r"[\s\-_]", "", str(value or "")).lower()


def normalize(tx: dict[str, Any]) -> dict[str, Any]:
    """Aplana una transaccion de Binance Pay a lo que necesita la conciliacion."""
    payer = tx.get("payerInfo") or {}
    currency = str(tx.get("currency") or "").upper()
    try:
        amount = float(tx.get("amount") or 0)
    except (TypeError, ValueError):
        amount = 0.0
    return {
        "id": str(tx.get("transactionId") or ""),
        "tipo": str(tx.get("orderType") or ""),
        "tiempo": int(tx.get("transactionTime") or 0),
        "moneda": currency,
        "importe": amount,
        # Solo cuenta como dolares lo que es 1:1; el resto queda como None.
        "usd": amount if currency in STABLECOINS else None,
        "entrante": amount > 0,
        "pagador_id": _norm(payer.get("binanceId")),
        # Algunas transacciones llegan sin payerInfo.binanceId: counterpartyId es
        # el identificador de la otra parte y sirve de segunda oportunidad.
        "contraparte_id": _norm(tx.get("counterpartyId")),
        "pagador_email": _norm(payer.get("email")),
        # A quien le llego el dinero: se compara con TU Pay ID configurado.
        "receptor_id": _norm((tx.get("receiverInfo") or {}).get("binanceId")),
        "pagador_nombre": str(payer.get("name") or ""),
        "nota": str(tx.get("note") or tx.get("remark") or ""),
        "raw": tx,
    }


def _fmt(value: float) -> str:
    return f"{value:.2f}"


def match_transaction(
    *,
    numero: str,
    total_usd: float,
    referencia: str,
    creado_ms: int,
    txs: list[dict[str, Any]],
    usados: set[str],
    receptor_id: str = "",
) -> dict[str, Any]:
    """Busca el pago de un pedido y lo COMPARA con lo que dice el CRM.

    El Binance ID o el numero de pedido en la nota solo sirven de FILTRO para
    encontrar la transaccion. Encontrarla no basta: despues se comprueba contra
    los datos del pedido y solo se verifica si todo cuadra:

      - importe:  igual al total del pedido en el CRM (tolerancia de 1 centimo)
      - moneda:   equivalente 1:1 a dolares (USDT, USDC...)
      - receptor: la cuenta que recibio es la tuya (si se conoce tu Pay ID)
      - momento:  posterior a la creacion del pedido
      - unica:    esa transaccion no se uso ya en otro pedido

    Si la transaccion es de este pedido pero algo no cuadra (paga de menos, de
    mas, otra moneda, otra cuenta) NO se verifica: se devuelve como discrepancia
    con el motivo, para que lo resuelva una persona.

    Devuelve {"verificada": tx | None, "discrepancias": [...], "candidatos": [...]}.
    Funcion pura: no toca base de datos ni red, asi se puede probar a fondo.
    """
    ref = _norm(referencia)
    numero_n = _norm(numero)
    # El cliente a veces escribe solo el codigo ("Y73LZQ") sin el prefijo ANPC.
    codigo_n = numero_n[4:] if numero_n.startswith("anpc") else numero_n
    receptor_n = _norm(receptor_id)

    discrepancias: list[dict[str, Any]] = []
    candidatos: list[dict[str, Any]] = []

    for tx in txs:
        if not tx["entrante"] or tx["id"] in usados:
            continue
        if tx["tiempo"] < creado_ms - CLOCK_SLACK_MS:
            continue

        # ── 1. FILTRO: ¿es de este pedido? ──
        razones = []
        nota_n = _norm(tx["nota"])
        if (numero_n and numero_n in nota_n) or (len(codigo_n) >= 6 and codigo_n in nota_n):
            razones.append("nota")
        if ref and ref in (
            tx["pagador_id"], tx["pagador_email"], tx["contraparte_id"], _norm(tx["id"]),
        ):
            razones.append("referencia")

        if not razones:
            # Sin identidad no se verifica jamas; solo se sugiere si el importe es exacto.
            if tx["usd"] is not None and abs(tx["usd"] - total_usd) <= AMOUNT_TOLERANCE:
                candidatos.append(tx)
            continue

        # ── 2. COMPARACION contra lo que dice el CRM ──
        problemas: list[str] = []
        if tx["usd"] is None:
            problemas.append(
                f"moneda no equivalente a dolares: entraron {_fmt(tx['importe'])} {tx['moneda']}"
            )
        else:
            diferencia = round(tx["usd"] - total_usd, 2)
            if diferencia < -AMOUNT_TOLERANCE:
                problemas.append(
                    f"pago incompleto: entraron {_fmt(tx['usd'])} {tx['moneda']} y el pedido vale "
                    f"{_fmt(total_usd)} USD (faltan {_fmt(-diferencia)})"
                )
            elif diferencia > AMOUNT_TOLERANCE:
                problemas.append(
                    f"excedente: entraron {_fmt(tx['usd'])} {tx['moneda']} y el pedido vale "
                    f"{_fmt(total_usd)} USD (sobran {_fmt(diferencia)})"
                )
        if receptor_n and tx["receptor_id"] and tx["receptor_id"] != receptor_n:
            problemas.append("el dinero entro en una cuenta distinta a tu Pay ID")

        tx = {**tx, "razones": razones}
        if problemas:
            discrepancias.append({"tx": tx, "problemas": problemas})
            continue
        return {"verificada": tx, "discrepancias": discrepancias, "candidatos": candidatos}

    return {"verificada": None, "discrepancias": discrepancias, "candidatos": candidatos}


# ── Consulta con freno ─────────────────────────────────────────────────────────
# Cada llamada pesa 3000 en el limite de Binance, asi que las consultas
# automaticas (disparadas por quien mira el estado de su pedido) se frenan.

_lock = Lock()
_state: dict[str, Any] = {"at": 0.0, "txs": [], "error": None}


def recent_transactions(since_ms: int, force: bool = False) -> tuple[list[dict[str, Any]], Optional[str]]:
    """Transacciones normalizadas (cache de MIN_SYNC_INTERVAL s) y error si lo hubo."""
    with _lock:
        cached_since = _state.get("since")
        # La cache sirve si es reciente y ya cubria desde una fecha igual o anterior.
        usable = (
            not force
            and cached_since is not None
            and cached_since <= since_ms
            and time.monotonic() - _state["at"] < MIN_SYNC_INTERVAL
        )
        if usable:
            return _state["txs"], _state["error"]

    try:
        raw = fetch_pay_transactions(start_ms=since_ms, end_ms=int(time.time() * 1000))
        txs = [normalize(t) for t in raw]
        error = None
    except BinanceError as exc:
        logger.warning("Binance: %s", exc)
        txs, error = [], str(exc)

    with _lock:
        _state.update({"at": time.monotonic(), "txs": txs, "error": error, "since": since_ms})
    return txs, error
