"""Identifica al usuario de la tienda a partir de su sesion de Supabase.

El navegador manda `Authorization: Bearer <access_token>`. El servidor NO se fia
de un `user_id` que venga en el cuerpo de la peticion (cualquiera podria mandar
el de otra persona): se lo pregunta a Supabase con el token.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import HTTPException

from app.storage import StorageConfigurationError, get_storage_client

logger = logging.getLogger(__name__)


def _token(authorization: Optional[str]) -> str:
    value = (authorization or "").strip()
    return value[7:].strip() if value.lower().startswith("bearer ") else ""


def user_id_from_authorization(authorization: Optional[str], *, required: bool = False) -> Optional[str]:
    """Devuelve el id del usuario o None. Con `required` lanza 401 si no hay sesion valida."""
    token = _token(authorization)
    if not token:
        if required:
            raise HTTPException(status_code=401, detail="Inicia sesion para ver tus pedidos")
        return None

    try:
        response = get_storage_client().auth.get_user(token)
        user = getattr(response, "user", None)
    except StorageConfigurationError as error:
        if required:
            raise HTTPException(status_code=503, detail=str(error)) from error
        return None
    except Exception as error:  # noqa: BLE001 - token caducado o invalido
        logger.info("Token de usuario rechazado: %s", type(error).__name__)
        user = None

    if not user or not getattr(user, "id", None):
        if required:
            raise HTTPException(status_code=401, detail="Sesion no valida o caducada")
        return None
    return str(user.id)
