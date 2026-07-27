"""Supabase Storage para las imágenes públicas del catálogo."""

from __future__ import annotations

from functools import lru_cache
import mimetypes
import os
from pathlib import Path
import re
from typing import Any
from urllib.parse import quote, unquote, urlparse
import uuid

from supabase import Client, create_client


DEFAULT_BUCKET = "catalog-images"


class StorageConfigurationError(RuntimeError):
    """Falta una variable necesaria para acceder a Supabase Storage."""


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise StorageConfigurationError(f"Falta {name} en el backend")
    return value


def get_bucket_name() -> str:
    return os.getenv("SUPABASE_STORAGE_BUCKET", DEFAULT_BUCKET).strip() or DEFAULT_BUCKET


def get_public_url_base() -> str:
    url = _required_env("SUPABASE_URL").rstrip("/")
    return f"{url}/storage/v1/object/public/{get_bucket_name()}"


@lru_cache(maxsize=1)
def get_storage_client() -> Client:
    key = (
        os.getenv("SUPABASE_SECRET_KEY", "").strip()
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    )
    if not key:
        raise StorageConfigurationError(
            "Falta SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY en el backend"
        )
    return create_client(_required_env("SUPABASE_URL"), key)


def _safe_filename(name: str) -> str:
    raw_name = Path(unquote(name)).name
    stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", Path(raw_name).stem).strip("-")
    suffix = Path(raw_name).suffix.lower()
    if not stem or not suffix:
        raise ValueError(f"Nombre de imagen inválido: {name!r}")
    return f"{stem}{suffix}"


def _public_url(storage_path: str) -> str:
    return f"{get_public_url_base()}/{quote(storage_path, safe='/')}"


def _upload(
    *,
    storage_path: str,
    contents: bytes,
    content_type: str | None,
    upsert: bool,
) -> str:
    options: dict[str, Any] = {
        "cache-control": "31536000",
        "upsert": "true" if upsert else "false",
    }
    if content_type:
        options["content-type"] = content_type

    get_storage_client().storage.from_(get_bucket_name()).upload(
        path=storage_path,
        file=contents,
        file_options=options,
    )
    return _public_url(storage_path)


def upload_admin_image(
    *,
    original_name: str,
    contents: bytes,
    content_type: str | None,
) -> tuple[str, str]:
    """Sube una imagen nueva a una ruta imposible de solapar."""
    filename = _safe_filename(original_name)
    storage_path = f"products/uploads/{uuid.uuid4().hex}-{filename}"
    public_url = _upload(
        storage_path=storage_path,
        contents=contents,
        content_type=content_type,
        upsert=False,
    )
    return storage_path, public_url


def _is_local_catalog_image(value: str) -> bool:
    parsed = urlparse(value)
    return not parsed.scheme and parsed.path.startswith("/images/")


def _local_image_source(images_directory: Path, image_url: str) -> Path:
    filename = Path(unquote(urlparse(image_url).path)).name
    if not filename or filename in {'.', '..'}:
        raise ValueError(f"Nombre de imagen inválido: {image_url!r}")
    source = (images_directory / filename).resolve()
    root = images_directory.resolve()
    if not source.is_relative_to(root):
        raise ValueError(f"Ruta de imagen fuera de frontend/public/images: {image_url}")
    if not source.is_file():
        raise FileNotFoundError(f"No existe la imagen local: {source}")
    return source


def _migrate_image_value(
    *,
    product_id: str,
    value: str,
    images_directory: Path,
    cache: dict[tuple[str, str], str],
) -> str:
    if not value or not _is_local_catalog_image(value):
        return value

    cache_key = (product_id, value)
    if cache_key in cache:
        return cache[cache_key]

    source = _local_image_source(images_directory, value)
    storage_path = f"products/{product_id}/{_safe_filename(source.name)}"
    content_type = mimetypes.guess_type(source.name)[0] or "application/octet-stream"
    public_url = _upload(
        storage_path=storage_path,
        contents=source.read_bytes(),
        content_type=content_type,
        upsert=True,
    )
    cache[cache_key] = public_url
    return public_url


def migrate_catalog_images(
    catalog: dict[str, Any],
    inventory: dict[str, Any],
    *,
    images_directory: Path,
) -> int:
    """Sube imágenes y sustituye URLs solo en los diccionarios en memoria."""
    cache: dict[tuple[str, str], str] = {}

    for product in catalog.get("productos") or []:
        product_id = str(product["id"])
        original_image = str(product.get("imagen") or "")
        product["imagen"] = _migrate_image_value(
            product_id=product_id,
            value=original_image,
            images_directory=images_directory,
            cache=cache,
        )

        images = []
        for image in product.get("imagenes") or []:
            images.append(
                _migrate_image_value(
                    product_id=product_id,
                    value=str(image),
                    images_directory=images_directory,
                    cache=cache,
                )
            )
        product["imagenes"] = images or ([product["imagen"]] if product["imagen"] else [])

        for variant in (inventory.get(product_id) or {}).get("variantes") or []:
            if variant.get("imagen"):
                variant["imagen"] = _migrate_image_value(
                    product_id=product_id,
                    value=str(variant["imagen"]),
                    images_directory=images_directory,
                    cache=cache,
                )

    return len(cache)
