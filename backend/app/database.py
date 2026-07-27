"""Conexion SQLAlchemy compartida por backend, admin y CRM."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


def _load_local_env() -> None:
    """Carga .env en desarrollo sin obligar a instalar python-dotenv."""
    candidates = [
        Path(__file__).resolve().parents[2] / ".env",
        Path(__file__).resolve().parents[1] / ".env",
    ]
    for path in candidates:
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip().removeprefix("export ").strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_local_env()


def _database_url() -> str:
    for key in (
        "SUPABASE_DATABASE_URL",
        "DATABASE_URL",
        "POSTGRES_URL",
        "POSTGRES_PRISMA_URL",
        "POSTGRES_URL_NON_POOLING",
    ):
        value = os.getenv(key, "").strip()
        if value:
            return value
    raise RuntimeError(
        "Falta SUPABASE_DATABASE_URL. En local pon la conexion PostgreSQL de Supabase en el .env de la raiz."
    )


def _normalize_url(url: str) -> str:
    if url.startswith("postgresql+psycopg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    return url


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    return create_engine(_normalize_url(_database_url()), pool_pre_ping=True)
