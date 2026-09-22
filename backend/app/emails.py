"""Avisos por correo al cliente.

Se envian cuando el pedido cambia de estado: recibido, pago verificado,
confirmado y cancelado. Si no hay transporte configurado o el pedido no tiene
email, no hace nada: es seguro dejarlo desplegado sin configurar.

Transporte: SMTP (por defecto Gmail con contrasena de aplicacion). No hace falta
dominio propio ni darse de alta en ningun servicio.

  SMTP_USER       tu direccion de Gmail (tambien es el remitente)
  SMTP_PASSWORD   la clave de aplicacion de 16 caracteres (los espacios se ignoran).
                  NO es la contrasena de la cuenta: se crea con la verificacion en
                  dos pasos activada, en Cuenta de Google > Seguridad > Contrasenas
                  de aplicaciones.
  SMTP_HOST       smtp.gmail.com por defecto
  SMTP_PORT       465 (SSL) por defecto; 587 usa STARTTLS
  MAIL_FROM       opcional: "Another NPC Shop <tucorreo@gmail.com>". Gmail solo deja
                  enviar desde la cuenta autenticada o un alias verificado suyo, asi
                  que si la direccion no coincide con SMTP_USER se usa SMTP_USER.
  MAIL_REPLY_TO   opcional: adonde llegan las respuestas del cliente
  SITE_URL        URL publica de la tienda, para el enlace de seguimiento

Alternativa: si en vez de SMTP se define RESEND_API_KEY (+ MAIL_FROM de un dominio
verificado) se usa la API de Resend. SMTP tiene prioridad.

Limite practico de Gmail: unos 500 correos al dia, de sobra para la tienda.

Los envios no bloquean la peticion (van en un hilo) y nunca lanzan: un fallo del
correo jamas debe impedir confirmar un pedido.
"""

from __future__ import annotations

import html
import logging
import os
import smtplib
import ssl
import threading
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from typing import Any, Optional

import httpx
from sqlalchemy import text

from app.checkout_repository import get_order
from app.database import get_engine

logger = logging.getLogger(__name__)

TIPOS = ("recibido", "verificado", "confirmado", "cancelado")

MARCA = "Another NPC Shop"
LEMA = "Solo ropa. Solo existir."


# ── Configuracion ─────────────────────────────────────────────────────────────

def _env(name: str, default: str = "") -> str:
    # Una variable definida pero vacia (p. ej. "SMTP_HOST=" en el .env) cae al
    # valor por defecto igual que si no existiera; os.getenv por si solo no lo hace.
    return os.getenv(name, "").strip() or default


def smtp_configured() -> bool:
    return bool(_env("SMTP_USER") and _env("SMTP_PASSWORD"))


def resend_configured() -> bool:
    return bool(_env("RESEND_API_KEY") and _env("MAIL_FROM"))


def configured() -> bool:
    return smtp_configured() or resend_configured()


def _remitente() -> str:
    """Remitente listo para la cabecera From."""
    crudo = _env("MAIL_FROM")
    nombre, direccion = parseaddr(crudo) if crudo else ("", "")
    if smtp_configured():
        cuenta = _env("SMTP_USER")
        # Gmail reescribe el From si no es la cuenta autenticada: mejor no mentir.
        if direccion.lower() != cuenta.lower():
            if direccion:
                logger.warning(
                    "MAIL_FROM (%s) no coincide con SMTP_USER (%s); se envia como SMTP_USER",
                    direccion, cuenta,
                )
            direccion = cuenta
        return formataddr((nombre or MARCA, direccion))
    return crudo


# ── Contenido ─────────────────────────────────────────────────────────────────

_MENSAJES = {
    "recibido": (
        "Recibimos tu pedido",
        "Ya tenemos tu pedido y la forma de pago que elegiste. Lo estamos revisando "
        "y te avisamos en cuanto haya novedades.",
    ),
    "verificado": (
        "Tu pago esta verificado",
        "Hemos localizado tu pago y cuadra con el pedido. Ya lo estamos preparando.",
    ),
    "confirmado": (
        "Pedido confirmado",
        "Tu pedido esta confirmado y apartado a tu nombre. Te escribimos para "
        "coordinar la entrega.",
    ),
    "cancelado": (
        "Pedido cancelado",
        "Tu pedido se ha cancelado y no se te cobrara nada. Si crees que es un "
        "error, responde a este correo con tu numero de pedido.",
    ),
}

_PASOS = ("recibido", "verificado", "confirmado")

_METODOS = {
    "binance": "Binance Pay",
    "efectivo": "Efectivo (USD)",
    "pago_movil": "Pago Movil",
    "paypal": "PayPal",
    "zelle": "Zelle",
    "transferencia": "Transferencia",
}


def _tracking_url(numero: str) -> str:
    site = _env("SITE_URL").rstrip("/")
    return f"{site}/pedido/{numero}" if site else ""


_ICONOS = {"cancelado": "cross", "recibido": "clock", "verificado": "check", "confirmado": "check"}


def _icono(tipo: str) -> str:
    """El mismo icono de estado del seguimiento web (check verde / reloj gris /
    aspa roja), en su posicion final y sin animar. Va como imagen (PNG servido
    desde la tienda) y no como SVG ni emoji: Gmail no siempre pinta SVG inline,
    y un emoji de reloj sale a todo color en Apple/Android, fuera del sitio en
    un correo monocromo."""
    site = os.getenv("SITE_URL", "").strip().rstrip("/")
    if not site:
        return ""  # sin SITE_URL no hay donde servir la imagen; se omite el icono
    nombre = _ICONOS[tipo]
    return (
        f'<img src="{html.escape(site, quote=True)}/mail-icons/{nombre}.png" width="40" height="40" '
        'alt="" style="display:block;width:40px;height:40px;margin:0 0 18px">'
    )


def _progreso(tipo: str) -> str:
    """Tres pasos con el actual marcado. En cancelado no se muestra."""
    if tipo not in _PASOS:
        return ""
    actual = _PASOS.index(tipo)
    celdas = []
    for i, paso in enumerate(("Recibido", "Pago verificado", "Confirmado")):
        hecho = i <= actual
        punto = "#0a0a0a" if hecho else "#d8d8d8"
        color = "#0a0a0a" if hecho else "#a3a3a3"
        celdas.append(
            f'<td width="33%" align="center" style="padding:0 4px">'
            f'<div style="width:9px;height:9px;border-radius:9px;background:{punto};margin:0 auto 7px"></div>'
            f'<div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:{color}">{paso}</div>'
            f'</td>'
        )
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="margin:0 0 28px"><tr>' + "".join(celdas) + "</tr></table>"
    )


def render(order: dict[str, Any], tipo: str) -> tuple[str, str, str]:
    """(asunto, html, texto plano). Todo lo que viene del cliente se escapa."""
    titulo, mensaje = _MENSAJES[tipo]
    numero = str(order["numero"])
    nombre = html.escape(str(order.get("nombre") or "").strip().split(" ")[0])
    url = _tracking_url(numero)
    total = f"${float(order['total']):.2f}"
    metodo = _METODOS.get(str(order.get("metodo_pago") or ""), "")
    entrega = str(order.get("entrega") or "").strip()
    cancelado = tipo == "cancelado"

    filas: list[str] = []
    lineas_texto: list[str] = []
    for item in order.get("items") or []:
        detalle = [f"Talla {item['talla']}"]
        if item.get("color"):
            detalle.append(str(item["color"]))
        if int(item["cantidad"]) > 1:
            detalle.append(f"{item['cantidad']} uds")
        sub = f"${float(item['subtotal']):.2f}"
        lineas_texto.append(f"  {item['cantidad']}x {item['producto_nombre']} ({' / '.join(detalle)})  {sub}")

        imagen = str(item.get("imagen") or "")
        miniatura = (
            f'<img src="{html.escape(imagen, quote=True)}" width="54" height="72" alt="" '
            'style="display:block;width:54px;height:72px;object-fit:cover;background:#f2f2f2;border:0">'
            if imagen.startswith("http")
            else '<div style="width:54px;height:72px;background:#f2f2f2"></div>'
        )
        filas.append(
            '<tr>'
            f'<td width="54" valign="top" style="padding:14px 14px 14px 0">{miniatura}</td>'
            '<td valign="top" style="padding:14px 0">'
            f'<div style="font-size:12px;letter-spacing:.09em;text-transform:uppercase;line-height:1.45;color:#0a0a0a">'
            f'{html.escape(str(item["producto_nombre"]))}</div>'
            f'<div style="font-size:12px;color:#8a8a8a;padding-top:5px">{html.escape(" · ".join(detalle))}</div>'
            '</td>'
            f'<td valign="top" align="right" style="padding:14px 0;font-size:13px;color:#0a0a0a;white-space:nowrap">{sub}</td>'
            '</tr>'
        )

    boton = (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0"><tr>'
        f'<td bgcolor="#0a0a0a" style="padding:14px 30px">'
        f'<a href="{html.escape(url, quote=True)}" style="color:#ffffff;text-decoration:none;'
        'font-size:11px;letter-spacing:.16em;text-transform:uppercase;display:inline-block">'
        'Ver el estado de mi pedido</a></td></tr></table>'
        if url and not cancelado else ""
    )

    extras = []
    if metodo and not cancelado:
        extras.append(("Forma de pago", metodo))
    if entrega:
        extras.append(("Entrega", entrega))
    if cancelado and order.get("motivo_cancelacion"):
        extras.append(("Motivo", str(order["motivo_cancelacion"])))
    bloque_extras = "".join(
        '<tr>'
        f'<td style="padding:4px 14px 4px 0;font-size:11px;letter-spacing:.12em;'
        f'text-transform:uppercase;color:#8a8a8a;white-space:nowrap">{html.escape(k)}</td>'
        f'<td style="padding:4px 0;font-size:13px;color:#0a0a0a">{html.escape(v)}</td>'
        '</tr>'
        for k, v in extras
    )
    if bloque_extras:
        bloque_extras = (
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            'style="margin:26px 0 0;border-top:1px solid #ededed;padding-top:18px">'
            + bloque_extras + '</table>'
        )

    saludo = f"Hola {nombre}," if nombre else "Hola,"
    responder = _env("MAIL_REPLY_TO") or _env("SMTP_USER")

    cuerpo = f"""<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(titulo)}</title></head>
<body style="margin:0;padding:0;background:#f6f6f4;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{html.escape(titulo)} · {html.escape(numero)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4">
<tr><td align="center" style="padding:36px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:544px;background:#ffffff">

<tr><td style="padding:26px 34px;border-bottom:1px solid #ededed;font-family:Inter,Helvetica,Arial,sans-serif;
  font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:#0a0a0a">{MARCA}</td></tr>

<tr><td style="padding:34px 34px 0;font-family:Inter,Helvetica,Arial,sans-serif">
  {_icono(tipo)}
  <div style="font-size:25px;line-height:1.25;letter-spacing:.04em;color:#0a0a0a">{html.escape(titulo)}</div>
  <div style="font-size:14px;line-height:1.7;color:#55534f;padding:14px 0 26px">
    {saludo}<br>{html.escape(mensaje)}
  </div>
  {_progreso(tipo)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4">
    <tr><td style="padding:16px 18px">
      <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#8a8a8a">Numero de seguimiento</div>
      <div style="font-size:19px;letter-spacing:.22em;color:#0a0a0a;padding-top:6px">{html.escape(numero)}</div>
    </td></tr>
  </table>
</td></tr>

<tr><td style="padding:28px 34px 0;font-family:Inter,Helvetica,Arial,sans-serif">
  <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#8a8a8a;
    border-bottom:1px solid #ededed;padding-bottom:10px">Tu pedido</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{''.join(filas)}</table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #0a0a0a">
    <tr>
      <td style="padding:14px 0;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#0a0a0a">Total</td>
      <td align="right" style="padding:14px 0;font-size:16px;color:#0a0a0a">{total}</td>
    </tr>
  </table>
  {bloque_extras}
  {boton}
</td></tr>

<tr><td style="padding:34px;font-family:Inter,Helvetica,Arial,sans-serif">
  <div style="border-top:1px solid #ededed;padding-top:18px;font-size:11px;line-height:1.8;color:#a3a3a3">
    {html.escape(LEMA)}<br>
    Responde a este correo{f' ({html.escape(responder)})' if responder else ''} si necesitas cualquier cosa.
  </div>
</td></tr>

</table></td></tr></table></body></html>"""

    lineas = [
        MARCA.upper(), "", saludo, "", f"{titulo}.", mensaje, "",
        f"Numero de seguimiento: {numero}", "", "TU PEDIDO", *lineas_texto,
        f"  Total  {total}",
    ]
    for k, v in extras:
        lineas.append(f"  {k}: {v}")
    if url and not cancelado:
        lineas += ["", f"Sigue tu pedido aqui: {url}"]
    lineas += ["", LEMA]
    return f"{titulo} · {numero}", cuerpo, "\n".join(lineas).strip()


# ── Transportes ───────────────────────────────────────────────────────────────

def _send_smtp(destinatario: str, asunto: str, cuerpo: str, texto: str, clave: str) -> tuple[str, str]:
    host = _env("SMTP_HOST", "smtp.gmail.com")
    port = int(_env("SMTP_PORT", "465") or 465)
    usuario = _env("SMTP_USER")
    # Google muestra la clave de aplicacion en grupos de cuatro: "abcd efgh ijkl mnop".
    password = _env("SMTP_PASSWORD").replace(" ", "")

    mensaje = EmailMessage()
    mensaje["From"] = _remitente()
    mensaje["To"] = destinatario
    mensaje["Subject"] = asunto
    mensaje["Message-ID"] = f"<{clave}@anothernpcshop>"
    reply_to = _env("MAIL_REPLY_TO")
    if reply_to:
        mensaje["Reply-To"] = reply_to
    mensaje.set_content(texto)
    mensaje.add_alternative(cuerpo, subtype="html")

    contexto = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=contexto, timeout=20) as servidor:
            servidor.login(usuario, password)
            servidor.send_message(mensaje)
    else:
        with smtplib.SMTP(host, port, timeout=20) as servidor:
            servidor.starttls(context=contexto)
            servidor.login(usuario, password)
            servidor.send_message(mensaje)
    return "enviado", f"smtp {host}"


def _send_resend(destinatario: str, asunto: str, cuerpo: str, texto: str, clave: str) -> tuple[str, str]:
    base = _env("RESEND_API_BASE", "https://api.resend.com").rstrip("/")
    payload: dict[str, Any] = {
        "from": _env("MAIL_FROM"),
        "to": [destinatario],
        "subject": asunto,
        "html": cuerpo,
        "text": texto,
    }
    reply_to = _env("MAIL_REPLY_TO")
    if reply_to:
        payload["reply_to"] = reply_to
    with httpx.Client(timeout=15) as client:
        response = client.post(
            f"{base}/emails",
            json=payload,
            headers={
                "Authorization": f"Bearer {_env('RESEND_API_KEY')}",
                # Si el mismo evento se dispara dos veces, Resend no duplica el correo.
                "Idempotency-Key": clave,
            },
        )
    if response.status_code < 300:
        return "enviado", str((response.json() or {}).get("id", ""))
    return "error", f"HTTP {response.status_code}: {response.text[:160]}"


# ── Envio ─────────────────────────────────────────────────────────────────────

def send_order_email(numero: str, tipo: str) -> str:
    """Envia (una sola vez) el aviso `tipo` del pedido. Devuelve que ocurrio; nunca lanza."""
    try:
        if tipo not in TIPOS:
            return "tipo_invalido"
        if not configured():
            return "sin_configurar"

        order = get_order(numero)
        if not order:
            return "sin_pedido"
        destinatario = str(order.get("email") or "").strip()
        if "@" not in destinatario:
            return "sin_email"

        with get_engine().connect() as connection:
            previo = connection.execute(
                text("select pe.estado from crm.pedido_emails pe join crm.pedidos p on p.id = pe.pedido_id "
                     "where p.numero = :n and pe.tipo = :t"),
                {"n": numero, "t": tipo},
            ).first()
        if previo and previo.estado == "enviado":
            return "ya_enviado"

        asunto, cuerpo, texto = render(order, tipo)
        clave = f"{numero}-{tipo}"
        enviar = _send_smtp if smtp_configured() else _send_resend
        try:
            estado, detalle = enviar(destinatario, asunto, cuerpo, texto, clave)
        except Exception as error:  # noqa: BLE001
            estado, detalle = "error", f"{type(error).__name__}: {str(error)[:140]}"

        with get_engine().begin() as connection:
            connection.execute(
                text(
                    "insert into crm.pedido_emails (pedido_id, tipo, destinatario, estado, detalle) "
                    "select id, :t, :d, :e, :x from crm.pedidos where numero = :n "
                    "on conflict (pedido_id, tipo) do update set estado = excluded.estado, "
                    "detalle = excluded.detalle, destinatario = excluded.destinatario, creado_en = now()"
                ),
                {"n": numero, "t": tipo, "d": destinatario, "e": estado, "x": detalle},
            )
        if estado != "enviado":
            logger.warning("Correo '%s' de %s no enviado: %s", tipo, numero, detalle)
        return estado
    except Exception:  # noqa: BLE001 - un correo jamas debe romper una peticion
        logger.exception("Fallo inesperado enviando correo '%s' de %s", tipo, numero)
        return "error_interno"


def notify(numero: str, tipo: str, *, wait: bool = False) -> Optional[str]:
    """Dispara el aviso en segundo plano (o espera el resultado si `wait`)."""
    if not configured():
        return "sin_configurar" if wait else None
    if wait:
        return send_order_email(numero, tipo)
    threading.Thread(target=send_order_email, args=(numero, tipo), daemon=True).start()
    return None
