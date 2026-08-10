"""Conexion SQLAlchemy compartida por backend, admin y CRM."""

from __future__ import annotations

import os
import logging
from functools import lru_cache
from pathlib import Path

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine, make_url


logger = logging.getLogger(__name__)


def _load_local_env() -> None:
    """Carga .env local en desarrollo sin obligar a instalar python-dotenv."""
    root_dir = Path(__file__).resolve().parents[2]
    backend_dir = Path(__file__).resolve().parents[1]
    candidates = [
        root_dir / ".env.local",
        backend_dir / ".env.local",
        root_dir / ".env",
        backend_dir / ".env",
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


def _database_config() -> tuple[str, str]:
    for key in (
        "SUPABASE_DATABASE_URL",
        "DATABASE_URL",
        "POSTGRES_URL",
        "POSTGRES_PRISMA_URL",
        "POSTGRES_URL_NON_POOLING",
    ):
        value = os.getenv(key, "").strip()
        if value:
            return key, value
    raise RuntimeError(
        "Falta SUPABASE_DATABASE_URL. En local pon una conexion PostgreSQL local o staging en .env.local."
    )


def _database_url() -> str:
    return _database_config()[1]


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
    source, raw_url = _database_config()
    normalized_url = _normalize_url(raw_url)
    parsed_url = make_url(normalized_url)
    engine = create_engine(
        normalized_url,
        pool_pre_ping=True,
        pool_recycle=1800,
        connect_args={"options": "-csearch_path=crm,public"},
    )

    # Supabase usa PgBouncer en modo transaction, que es incompatible con los
    # prepared statements de servidor que psycopg3 activa por defecto.
    # Desactivarlos evita el error DuplicatePreparedStatement (_pg3_0).
    @event.listens_for(engine, "connect")
    def disable_prepared_statements(dbapi_connection, connection_record):
        dbapi_connection.prepare_threshold = None
    with engine.connect() as connection:
        diagnostics = connection.execute(
            text(
                """
                select
                    current_database() as database_name,
                    current_schema() as current_schema,
                    current_setting('search_path') as search_path,
                    to_regclass('crm.abonos') is not null as has_abonos,
                    exists (
                        select 1
                        from information_schema.columns
                        where table_schema = 'crm'
                          and table_name = 'abonos'
                          and column_name = 'moneda'
                    ) as has_moneda
                """
            )
        ).mappings().one()

    logger.warning(
        "Database seleccionada: variable=%s host=%s puerto=%s usuario=%s database=%s "
        "schema=%s search_path=%s crm.abonos=%s moneda=%s",
        source,
        parsed_url.host,
        parsed_url.port,
        parsed_url.username,
        diagnostics["database_name"],
        diagnostics["current_schema"],
        diagnostics["search_path"],
        diagnostics["has_abonos"],
        diagnostics["has_moneda"],
    )
    if not diagnostics["has_abonos"] or not diagnostics["has_moneda"]:
        raise RuntimeError(
            "La conexion PostgreSQL seleccionada no contiene crm.abonos.moneda. "
            f"Variable={source}, host={parsed_url.host}, usuario={parsed_url.username}, "
            f"database={diagnostics['database_name']}, search_path={diagnostics['search_path']}."
        )
    return engine
