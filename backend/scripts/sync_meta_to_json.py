import requests
import json
import os
import re

# ── Credenciales Meta ──────────────────────────────────────────────────────────
CATALOG_ID   = '1194041306232036'
ACCESS_TOKEN = 'EAAeCpZAbbStIBRHb4EtmZCWk75QWqP8CqI1hT8F1hZAuwmSvt1WMC5FrPGlZBt9Gkg3MSVlhdR7P7VEUMQKviHBNHSOnJOSVZB7yxiDZA6IQULSBXD3Hkx4EtnFJyGGYuvZC8psU683xHyZA6VPWMeeMin07kZAn8NcXJJR4i686KbwBuHZC3kdc7EaKAyHGoFuwx1IgZDZD'

# ── Config del sitio ───────────────────────────────────────────────────────────
SITE_META = {
    "marca":           "ANOTHER NPC SHOP",
    "moneda":          "EUR",
    "whatsapp":        "+34600000000",      # <── cambia por tu número real
    "whatsapp_mensaje": "Hola, me interesa: ",
    "paypal":          "tu@paypal.com",     # <── cambia por tu email PayPal
    "recargo_paypal":  "Los pagos vía PayPal incluyen una comisión del 3,4% aplicada directamente por PayPal."
}

FILTROS = {
    "tallas":  ["XS", "S", "M", "L", "XL", "XXL"],
    "generos": ["hombre", "mujer", "unisex"]
}

FIELDS = 'id,name,description,price,image_url,availability'
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'catalog.json')

# ── Helpers ────────────────────────────────────────────────────────────────────

def parse_price(raw_price: str) -> float:
    """Convierte '49.00 EUR' o '49,00' a float."""
    clean = re.sub(r'[^\d.,]', '', raw_price)
    clean = clean.replace(',', '.')
    # Si hay varios puntos, solo el último es el decimal
    parts = clean.split('.')
    if len(parts) > 2:
        clean = ''.join(parts[:-1]) + '.' + parts[-1]
    try:
        return float(clean)
    except ValueError:
        return 0.0


def map_availability(raw: str) -> bool:
    """Meta devuelve 'in stock' / 'out of stock'."""
    return raw.lower() in ('in stock', 'available', 'instock')


def zero_pad(n: int) -> str:
    return str(n).zfill(3)


def fetch_all_products() -> list:
    """Pagina automáticamente por todos los productos del catálogo."""
    url = f"https://graph.facebook.com/v19.0/{CATALOG_ID}/products"
    params = {
        'fields':       FIELDS,
        'access_token': ACCESS_TOKEN,
        'limit':        100,
    }
    all_items = []

    while url:
        print(f"  → Petición: {url.split('?')[0]} ...")
        resp = requests.get(url, params=params if '?' not in url else {})
        resp.raise_for_status()
        data = resp.json()

        if 'error' in data:
            raise RuntimeError(f"Error de Meta API: {data['error']}")

        items = data.get('data', [])
        all_items.extend(items)
        print(f"    Obtenidos {len(items)} productos (total: {len(all_items)})")

        # Paginación cursor
        paging = data.get('paging', {})
        url    = paging.get('next')   # None si no hay más páginas
        params = {}                   # next ya lleva los params en la URL

    return all_items


def transform(raw_items: list) -> list:
    """
    Transforma los productos de Meta al schema del sitio.
    Campos que Meta no tiene (genero, tallas) se dejan como placeholders
    para rellenar manualmente en catalog.json.
    """
    productos = []
    for i, item in enumerate(raw_items, start=1):
        raw_price = item.get('price', '0 EUR')
        # Meta devuelve image_url como URL completa (CDN).
        # El frontend usa src={producto.imagen} directamente — funciona con URLs y rutas locales.
        imagen = item.get('image_url', '')
        producto = {
            "id":          zero_pad(i),
            "meta_id":     item.get('id', ''),
            "nombre":      item.get('name', '').upper(),
            "precio":      parse_price(raw_price),
            "categoria":   "sin_categoria",
            "genero":      "unisex",
            "tallas":      ["S", "M", "L"],
            "imagen":      imagen,           # URL directa de Meta CDN
            "descripcion": item.get('description', ''),
            "disponible":  map_availability(item.get('availability', 'out of stock'))
        }
        productos.append(producto)
    return productos


def save_catalog(productos: list):
    catalog = {
        "meta":      SITE_META,
        "filtros":   FILTROS,
        "productos": productos
    }
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
    print(f"\n✓ catalog.json guardado en: {OUTPUT_PATH}")
    print(f"  Total productos: {len(productos)}")


# ── Main ───────────────────────────────────────────────────────────────────────

def run():
    print("── ANOTHER NPC SHOP ─ Sync catálogo Meta ──────────────────")
    try:
        raw = fetch_all_products()
        productos = transform(raw)
        save_catalog(productos)
        print("\n⚠  Recuerda revisar manualmente en catalog.json:")
        print("   → categoria, genero y tallas de cada producto")
    except Exception as e:
        print(f"\n✗ Error: {e}")


if __name__ == '__main__':
    run()