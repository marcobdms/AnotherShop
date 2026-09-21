"""Tasa oficial BCV (USD/EUR -> VES) para el checkout.

Cadena de fuentes, en este orden:
  1. TasaVzla-API propia (TASA_API_URL). Cualquier fallo -- 4xx, 5xx, timeout,
     JSON raro, tasa <= 0 -- pasa a la siguiente.
  2. DolarApi (ve.dolarapi.com): publica, sin clave, misma tasa oficial BCV.
  3. El BCV directamente (misma tecnica que TasaVzla: div#dolar / div#euro).
  4. La ultima tasa cacheada, marcada como `stale`.

Si todo falla devuelve None y el checkout simplemente oculta la tasa.
"""

from __future__ import annotations

import logging
import os
import re
from threading import Lock
import time
from typing import Any, Callable, Optional

import httpx

logger = logging.getLogger(__name__)

_BCV_URL = "https://www.bcv.org.ve/"
_DOLARAPI_URL = "https://ve.dolarapi.com/v1"
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-VE,es;q=0.9,en;q=0.8",
}

# Si la fuente principal responde se cachea mucho; si hubo que tirar de
# respaldo se reintenta pronto la principal.
CACHE_PRIMARY_SECONDS = 15 * 60
CACHE_FALLBACK_SECONDS = 3 * 60

_cache: dict[str, Any] = {"data": None, "at": 0.0, "ttl": CACHE_PRIMARY_SECONDS}
_lock = Lock()


def _to_float(raw: str) -> float:
    # Formato venezolano: "849,56400000" / "1.234,56"
    return float(raw.strip().replace(".", "").replace(",", "."))


def _from_tasavzla(base_url: str) -> dict[str, Any]:
    out: dict[str, Any] = {"fuente": "tasavzla", "stale": False}
    with httpx.Client(timeout=6) as client:
        for currency in ("usd", "eur"):
            response = client.get(f"{base_url.rstrip('/')}/rate/{currency}")
            response.raise_for_status()  # un 400/500 salta al respaldo
            body = response.json()
            out[currency] = float(body["rate"])
            out["fecha"] = body.get("rate_date") or out.get("fecha")
            out["stale"] = bool(body.get("stale")) or out["stale"]
    return out


def _from_dolarapi() -> dict[str, Any]:
    out: dict[str, Any] = {"fuente": "dolarapi", "stale": False}
    with httpx.Client(timeout=8) as client:
        for currency, path in (("usd", "dolares"), ("eur", "euros")):
            response = client.get(f"{_DOLARAPI_URL}/{path}/oficial")
            response.raise_for_status()
            body = response.json()
            out[currency] = float(body["promedio"])
            updated = str(body.get("fechaActualizacion") or "")[:10]
            out["fecha"] = updated or out.get("fecha")
    return out


def _from_bcv() -> dict[str, Any]:
    with httpx.Client(
        timeout=15,
        verify=False,  # los certificados del BCV suelen estar mal configurados
        follow_redirects=True,
    ) as client:
        response = client.get(_BCV_URL, headers=_HEADERS)
        response.raise_for_status()
        html = response.text

    out: dict[str, Any] = {"fuente": "bcv", "stale": False}
    for currency, element_id in (("usd", "dolar"), ("eur", "euro")):
        match = re.search(
            rf'id="{element_id}".*?<strong[^>]*>\s*([\d\.,]+)\s*</strong>', html, re.S
        )
        if not match:
            raise ValueError(f"No se encontro div#{element_id} en el HTML del BCV")
        out[currency] = _to_float(match.group(1))

    date = re.search(r'Fecha Valor:.*?content="(\d{4}-\d{2}-\d{2})', html, re.S)
    out["fecha"] = date.group(1) if date else None
    return out


def _sources() -> list[tuple[str, Callable[[], dict[str, Any]]]]:
    sources: list[tuple[str, Callable[[], dict[str, Any]]]] = []
    api_url = os.getenv("TASA_API_URL", "").strip()
    if api_url:
        sources.append(("tasavzla", lambda: _from_tasavzla(api_url)))
    sources.append(("dolarapi", _from_dolarapi))
    sources.append(("bcv", _from_bcv))
    return sources


def get_rates() -> Optional[dict[str, Any]]:
    """Tasas cacheadas. None si no hay ninguna fuente disponible."""
    with _lock:
        if _cache["data"] and time.monotonic() - _cache["at"] < _cache["ttl"]:
            return _cache["data"]

    data: Optional[dict[str, Any]] = None
    failed: list[str] = []
    for name, fetch in _sources():
        try:
            candidate = fetch()
            if candidate.get("usd", 0) > 0 and candidate.get("eur", 0) > 0:
                data = candidate
                break
            raise ValueError("tasa no valida (<= 0)")
        except Exception as error:  # noqa: BLE001 - probamos la siguiente fuente
            failed.append(name)
            logger.warning("Fuente de tasa '%s' fallo: %s", name, error)

    with _lock:
        if data:
            data["fallaron"] = failed  # que fuentes se saltaron antes de esta
            _cache["data"] = data
            _cache["at"] = time.monotonic()
            _cache["ttl"] = CACHE_FALLBACK_SECONDS if failed else CACHE_PRIMARY_SECONDS
            return data
        if _cache["data"]:
            return {**_cache["data"], "stale": True}
    return None


def effective_bs_rate(manual: float = 0) -> float:
    """La tasa fijada a mano en Ajustes manda; si es 0 se usa la oficial."""
    if manual and manual > 0:
        return float(manual)
    rates = get_rates()
    return float(rates["usd"]) if rates else 0.0
