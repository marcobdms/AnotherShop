# ═══════════════════════════════════════════════════════════
# ANOTHER NPC SHOP — Cómo arrancar el proyecto
# ═══════════════════════════════════════════════════════════

## Estructura final del monorepo

```
anothershop/
├── package.json          ← scripts raíz
├── catalog.py            ← sync Meta → genera backend/data/catalog.json
│
├── backend/
│   ├── app/
│   │   └── main.py       ← FastAPI (puerto 8000)
│   ├── data/
│   │   └── catalog.json  ← fuente de verdad
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── api/           ← capa de datos (catalog.js)
    │   ├── components/    ← Nav, Footer, ProductCard, FilterChips ← STITCH va aquí
    │   ├── hooks/         ← useCatalog.js
    │   └── pages/         ← Home, Catalog, Product, About
    ├── public/images/     ← fotos de productos
    ├── package.json
    └── vite.config.js     ← proxy /api → localhost:8000
```

## Primera vez — Instalar dependencias

### Terminal 1 (Python backend)
```powershell
cd C:\Users\Marco\Desktop\proyectos\anothershop
pip install -r backend/requirements.txt
```

### Terminal 2 (React frontend)
```powershell
cd C:\Users\Marco\Desktop\proyectos\anothershop\frontend
npm install
```

## Arrancar en desarrollo (dos terminales)

### Terminal 1 — Backend (FastAPI)
```powershell
cd C:\Users\Marco\Desktop\proyectos\anothershop
uvicorn backend.app.main:app --reload --port 8000
```
→ API disponible en: http://localhost:8000/api/catalog

### Terminal 2 — Frontend (Vite + React)
```powershell
cd C:\Users\Marco\Desktop\proyectos\anothershop\frontend
npm run dev
```
→ Sitio disponible en: http://localhost:3000

## Sincronizar catálogo desde Meta

```powershell
cd C:\Users\Marco\Desktop\proyectos\anothershop
python catalog.py
```
Genera `backend/data/catalog.json` automáticamente.

## Endpoints del backend

| Endpoint | Descripción |
|---|---|
| `GET /api/catalog` | Catálogo completo |
| `GET /api/products` | Lista de productos |
| `GET /api/products/{id}` | Producto por ID |
| `GET /api/meta` | Metadatos (WhatsApp, PayPal) |
| `GET /api/filters` | Opciones de filtros |
| Docs interactivas | http://localhost:8000/docs |

## Enchufar componentes de Stitch

Los archivos a reemplazar son:
- `frontend/src/components/ProductCard.jsx` ← el principal
- `frontend/src/components/FilterChips.jsx`
- `frontend/src/components/Nav.jsx`
- `frontend/src/components/Footer.jsx`

Cada componente tiene una cabecera con `// LISTO PARA STITCH` indicando qué props acepta.
