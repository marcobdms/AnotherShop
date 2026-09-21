"""Endpoints publicos del checkout de la tienda.

Deliberadamente SIN X-Admin-Token: ese token viaja dentro del bundle del
navegador, asi que no sirve como credencial para nada. La proteccion aqui es
que estos endpoints no pueden mover dinero ni stock: solo crean un pedido que
el admin tiene que confirmar despues en el CRM.
"""

from __future__ import annotations

from collections import deque
from threading import Lock
import time
from typing import Any, Optional

from fastapi import APIRouter, File, Form, Header, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from app import checkout_repository as repository
from app.catalog_repository import get_meta
from app.storage import StorageConfigurationError, upload_order_receipt
from app import binance, conciliacion, emails, tasas
from app.auth_user import user_id_from_authorization


router = APIRouter(prefix="/api/checkout", tags=["checkout"])

MAX_COMPROBANTE_BYTES = 8 * 1024 * 1024


class ItemIn(BaseModel):
    producto_id: str = Field(min_length=1)
    talla: str = Field(min_length=1)
    cantidad: int = Field(gt=0, le=10)
    color: str = ""


class PedidoIn(BaseModel):
    items: list[ItemIn] = Field(min_length=1, max_length=40)
    nombre: str = Field(min_length=1, max_length=120)
    telefono: str = Field(default="", max_length=40)
    email: str = Field(default="", max_length=180)
    nota: str = Field(default="", max_length=500)
    entrega: str = Field(default="", max_length=300)
    user_id: Optional[str] = None


class PagoIn(BaseModel):
    metodo: str
    moneda: str = "usd"
    monto: Optional[float] = Field(default=None, gt=0)
    tasa: Optional[float] = Field(default=None, gt=0)
    referencia: str = Field(default="", max_length=120)
    nota: str = Field(default="", max_length=300)


# ── Rate limit ────────────────────────────────────────────────────────────────
# En memoria y por proceso: suficiente para frenar un script tonto, no pretende
# ser proteccion seria.
_HITS: dict[str, deque] = {}
_HITS_LOCK = Lock()


def _rate_limit(request: Request, *, limit: int = 12, window: int = 300, bucket: str = "crear") -> None:
    """Un contador por IP y por tipo de accion (crear pedidos no gasta el de consultas)."""
    client = f"{bucket}:{request.client.host if request.client else 'desconocido'}"
    now = time.monotonic()
    with _HITS_LOCK:
        hits = _HITS.setdefault(client, deque())
        while hits and now - hits[0] > window:
            hits.popleft()
        if len(hits) >= limit:
            raise HTTPException(
                status_code=429,
                detail="Demasiados pedidos seguidos. Espera unos minutos.",
            )
        hits.append(now)
        if len(_HITS) > 2000:
            for key in [k for k, v in _HITS.items() if not v]:
                _HITS.pop(key, None)


def _payment_config() -> dict[str, Any]:
    pagos = get_meta().get("pagos") or {}
    if not isinstance(pagos, dict):
        return {"tasa_bs": 0, "metodos": []}
    return pagos


def _applied_rate() -> float:
    """Tasa Bs/USD que usa el checkout: la manual de Ajustes o la del BCV."""
    return tasas.effective_bs_rate(float(_payment_config().get("tasa_bs") or 0))


@router.get("/metodos", summary="Metodos de pago activos y sus instrucciones")
def checkout_methods():
    config = _payment_config()
    metodos = [
        metodo
        for metodo in (config.get("metodos") or [])
        if isinstance(metodo, dict) and metodo.get("activo")
    ]
    return {"tasa_bs": _applied_rate(), "metodos": metodos}


@router.get("/tasas", summary="Tasa oficial BCV del dia")
def checkout_rates():
    rates = tasas.get_rates()
    if not rates:
        raise HTTPException(status_code=503, detail="Tasa no disponible")
    manual = float(_payment_config().get("tasa_bs") or 0)
    return {
        "usd": rates["usd"],
        "eur": rates["eur"],
        "fecha": rates.get("fecha"),
        "fuente": rates.get("fuente"),
        "stale": bool(rates.get("stale")),
        "aplicada": manual if manual > 0 else rates["usd"],
        "manual": manual > 0,
    }


def _first_name(full_name: str) -> str:
    return (full_name or "").strip().split(" ")[0]


def _timeline(order: dict[str, Any]) -> list[dict[str, Any]]:
    """Hitos del pedido para la pantalla de seguimiento."""
    events = [{"id": "recibido", "at": order["creado_en"]}]
    pagos = [p for p in order["pagos"] if p["estado"] != "rechazado"]
    estado = order["estado"]

    if pagos:
        events.append({"id": "pago", "at": pagos[0]["creado_en"]})
    elif order["metodo_pago"] == "efectivo" and estado != "borrador":
        events.append({"id": "pago", "at": order["actualizado_en"]})

    verified = [p["verificado_en"] for p in pagos if p["estado"] == "verificado" and p["verificado_en"]]
    if verified:
        events.append({"id": "verificado", "at": max(verified)})
    elif estado in ("verificado", "confirmado"):
        events.append({"id": "verificado", "at": order["actualizado_en"]})

    if estado == "confirmado":
        events.append({"id": "confirmado", "at": order["actualizado_en"]})
    if estado == "cancelado":
        events.append({"id": "cancelado", "at": order["actualizado_en"]})
    return events


def _public_order(order: dict[str, Any]) -> dict[str, Any]:
    """Lo que puede ver quien tenga el numero de pedido.

    El numero es la unica llave de consulta, asi que la respuesta NO incluye
    telefono, email, ids internos, referencias de pago ni comprobantes.
    """
    return {
        "numero": order["numero"],
        "estado": order["estado"],
        "nombre": _first_name(order["nombre"]),
        "metodo_pago": order["metodo_pago"],
        "total": order["total"],
        "declarado": order["declarado"],
        "pendiente": order["pendiente"],
        "creado_en": order["creado_en"],
        "actualizado_en": order["actualizado_en"],
        "items": [
            {
                "id": i["id"],
                "producto_id": i["producto_id"],
                "producto_nombre": i["producto_nombre"],
                "color": i["color"],
                "color_hex": i["color_hex"],
                "talla": i["talla"],
                "cantidad": i["cantidad"],
                "precio_unitario": i["precio_unitario"],
                "subtotal": i["subtotal"],
                "imagen": i["imagen"],
            }
            for i in order["items"]
        ],
        "pagos": [
            {
                "metodo": p["metodo"],
                "moneda": p["moneda"],
                "monto": p["monto"],
                "monto_usd": p["monto_usd"],
                "estado": p["estado"],
                "creado_en": p["creado_en"],
                "verificado_en": p["verificado_en"],
            }
            for p in order["pagos"]
        ],
        "eventos": _timeline(order),
    }


def _waiting_on_binance(order: dict[str, Any]) -> bool:
    return any(p["metodo"] == "binance" and p["estado"] == "declarado" for p in order["pagos"])


def _refresh_if_binance(order: dict[str, Any]) -> dict[str, Any]:
    """Si el pedido espera un pago de Binance, intenta conciliarlo ahora.

    La consulta esta frenada (ver binance.MIN_SYNC_INTERVAL), asi que un cliente
    recargando la pagina no puede agotar el limite de la API de Binance.
    """
    if not (binance.configured() and _waiting_on_binance(order)):
        return order
    conciliacion.sync_binance()
    return repository.get_order(order["numero"]) or order


@router.post("/pedidos", status_code=201, summary="Crear un pedido")
def checkout_create_order(
    body: PedidoIn,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    _rate_limit(request)
    fields = body.model_dump()
    # El dueño del pedido lo dice la sesion, no un campo que cualquiera podria falsear.
    fields["user_id"] = user_id_from_authorization(authorization)
    try:
        return _public_order(repository.create_order(fields))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/mis-pedidos", summary="Pedidos de la cuenta con sesion iniciada")
def checkout_my_orders(request: Request, authorization: Optional[str] = Header(None)):
    _rate_limit(request, limit=60, bucket="mis-pedidos")
    user_id = user_id_from_authorization(authorization, required=True)
    return [_public_order(o) for o in repository.list_orders(user_id=user_id)]


@router.get("/pedidos/{numero}", summary="Estado de un pedido")
def checkout_get_order(numero: str, request: Request):
    # El numero es la unica llave de consulta: se frena para que nadie pueda
    # probar combinaciones. 120 cada 5 min sobra para el refresco automatico.
    _rate_limit(request, limit=120, bucket="consulta")
    order = repository.get_order(numero)
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return _public_order(_refresh_if_binance(order))


@router.post("/pedidos/{numero}/pago", summary="Declarar como se ha pagado")
def checkout_declare_payment(numero: str, body: PagoIn, request: Request):
    _rate_limit(request, limit=20, bucket="pago")
    fields = body.model_dump()
    # Nunca se confia en la tasa que manda el navegador.
    fields["tasa"] = _applied_rate() if fields["moneda"].lower() == "bs" else None
    try:
        order = repository.declare_payment(numero, fields)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    emails.notify(order["numero"], "recibido")
    return _public_order(_refresh_if_binance(order))


@router.post("/pedidos/{numero}/comprobante", summary="Adjuntar comprobante de pago")
async def checkout_upload_receipt(
    numero: str,
    request: Request,
    file: UploadFile = File(...),
    metodo: str = Form(...),
    moneda: str = Form("usd"),
    monto: Optional[float] = Form(None),
    tasa: Optional[float] = Form(None),
    referencia: str = Form(""),
    nota: str = Form(""),
):
    _rate_limit(request, limit=20, bucket="pago")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El comprobante debe ser una imagen")

    order = repository.get_order(numero)
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    try:
        contents = await file.read()
        if len(contents) > MAX_COMPROBANTE_BYTES:
            raise HTTPException(status_code=413, detail="La imagen pesa demasiado (max 8 MB)")
        storage_path, _ = upload_order_receipt(
            numero=order["numero"],
            original_name=file.filename or "comprobante.jpg",
            contents=contents,
            content_type=file.content_type,
        )
        declared = repository.declare_payment(
            numero,
            {
                "metodo": metodo,
                "moneda": moneda,
                "monto": monto,
                "tasa": _applied_rate() if moneda.lower() == "bs" else None,
                "referencia": referencia,
                "nota": nota,
                "comprobante_path": storage_path,
            },
        )
        if declared:
            emails.notify(declared["numero"], "recibido")
        return _public_order(_refresh_if_binance(declared))
    except HTTPException:
        raise
    except StorageConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail="No se pudo subir el comprobante") from error
    finally:
        await file.close()
