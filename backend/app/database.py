"""Conexión privada del backend a PostgreSQL/Supabase."""

import os
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


def _normalize_database_url(url: str) -> str:
    """Fuerza el driver psycopg 3 sin alterar el resto de la URL."""
    if url.startswith("postgresql+psycopg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    return url


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    database_url = os.getenv("SUPABASE_DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError(
            "Falta SUPABASE_DATABASE_URL. Añade la conexión PostgreSQL de "
            "Supabase únicamente al servicio backend."
        )

    return create_engine(
        _normalize_database_url(database_url),
        # Compatible con el Transaction Pooler de Supabase (puerto 6543).
        connect_args={"prepare_threshold": None},
        pool_pre_ping=True,
        pool_recycle=300,
    )
