"""Endpoints protegidos del CRM interno."""

import hmac
import os
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app import crm_repository as repository
from app.storage import (
    StorageConfigurationError,
    create_signed_receipt_url,
    upload_private_receipt,
)


ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "").strip()


def verify_token(x_admin_token: str = Header(...)):
    if not ADMIN_TOKEN:
        raise HTTPException(status_code=503, detail="ADMIN_TOKEN no esta configurado")
    if not hmac.compare_digest(x_admin_token, ADMIN_TOKEN):
        raise HTTPException(status_code=401, detail="Token invalido")


class ClienteIn(BaseModel):
    nombre: str = Field(min_length=1)
    telefono: str = ""
    notas: str = ""


class VentaItemIn(BaseModel):
    producto_id: str
    variante_id: str
    talla: str
    cantidad: int = Field(gt=0)
    precio_unitario: float = Field(ge=0)


class VentaIn(BaseModel):
    items: list[VentaItemIn]
    usuario: str = "admin"
    nota: str = ""


class AbonoIn(BaseModel):
    monto: float = Field(gt=0)
    metodo: str
    usuario: str = "admin"
    nota: str = ""


class AnularVentaIn(BaseModel):
    motivo: str = "Correccion manual"


class ImportarJsonIn(BaseModel):
    datos: Any
    usuario: str = "admin"


router = APIRouter(prefix="/crm", tags=["crm"], dependencies=[Depends(verify_token)])


@router.get("/clientes")
def crm_list_clients(q: str = ""):
    return repository.list_clients(q.strip())


@router.post("/clientes", status_code=201)
def crm_create_client(body: ClienteIn):
    return repository.create_client(body.model_dump())


@router.get("/clientes/{client_id}")
def crm_get_client(client_id: str):
    client = repository.get_client(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return client


@router.put("/clientes/{client_id}")
def crm_update_client(client_id: str, body: ClienteIn):
    client = repository.update_client(client_id, body.model_dump())
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return client


@router.delete("/clientes/{client_id}")
def crm_delete_client(client_id: str):
    try:
        client = repository.delete_client(client_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return client


@router.post("/importar-json", status_code=201)
def crm_import_json(body: ImportarJsonIn):
    try:
        return repository.import_history_from_json(body.datos, usuario=body.usuario)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/catalogo")
def crm_catalog_options(q: str = ""):
    return repository.list_catalog_options(q.strip())


@router.get("/clientes/{client_id}/ventas")
def crm_list_sales(client_id: str):
    if not repository.get_client(client_id):
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return repository.list_client_sales(client_id)


@router.post("/clientes/{client_id}/ventas", status_code=201)
def crm_create_sale(client_id: str, body: VentaIn):
    try:
        return repository.create_sale(
            client_id,
            [item.model_dump() for item in body.items],
            usuario=body.usuario,
            nota=body.nota,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete("/ventas/{sale_id}")
def crm_cancel_sale(sale_id: str, body: Optional[AnularVentaIn] = None):
    sale = repository.cancel_sale(sale_id, (body.motivo if body else "Correccion manual"))
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return sale


@router.get("/clientes/{client_id}/abonos")
def crm_list_payments(client_id: str):
    if not repository.get_client(client_id):
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return repository.list_client_payments(client_id)


@router.post("/clientes/{client_id}/abonos", status_code=201)
def crm_create_payment(client_id: str, body: AbonoIn):
    try:
        return repository.create_payment(client_id, body.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/clientes/{client_id}/comprobantes")
def crm_list_receipts(client_id: str):
    if not repository.get_client(client_id):
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    receipts = repository.list_client_receipts(client_id)
    try:
        for receipt in receipts:
            receipt["url"] = create_signed_receipt_url(receipt["storage_path"])
    except StorageConfigurationError:
        pass
    return receipts


@router.post("/clientes/{client_id}/comprobantes", status_code=201)
async def crm_upload_receipt(
    client_id: str,
    file: UploadFile = File(...),
    usuario: str = "admin",
    abono_id: Optional[str] = None,
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")
    try:
        contents = await file.read()
        storage_path, signed_url = upload_private_receipt(
            client_id=client_id,
            original_name=file.filename or "comprobante.jpg",
            contents=contents,
            content_type=file.content_type,
        )
        return repository.add_receipt(
            client_id=client_id,
            storage_path=storage_path,
            public_url=signed_url,
            original_name=file.filename or "comprobante.jpg",
            content_type=file.content_type,
            usuario=usuario,
            abono_id=abono_id,
        )
    except StorageConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail="No se pudo subir el comprobante") from error
    finally:
        await file.close()
