# ANOTHER NPC SHOP — Monorepo (React + FastAPI)

Tienda online minimalista. Frontend en **React/Vite** desplegado en Vercel, backend en **FastAPI** desplegado en Coolify. El catálogo vive en un `catalog.json` que el propio panel de admin edita en tiempo real.

---

## Estructura del proyecto

```
anothershop/
├── package.json            ← Script raíz: npm run dev (lanza back + front en paralelo)
├── init.sql                ← Volcado SQL generado por update_and_sql.py (referencia, no se usa en prod)
├── .gitignore
│
├── backend/
│   ├── app/
│   │   ├── main.py         ← FastAPI: endpoints públicos (/api/products, /api/meta, etc.)
│   │   └── admin_router.py ← CRUD protegido (/admin/*), requiere X-Admin-Token
│   ├── data/
│   │   └── catalog.json    ← Fuente de verdad (meta + filtros + productos + historial)
│   ├── scripts/            ← Utilidades de mantenimiento (no forman parte del servidor)
│   │   ├── sync_meta_to_json.py  ← Importa productos desde el catálogo de Meta/Facebook
│   │   ├── backup_catalog.py     ← Descarga imágenes y genera CSV de respaldo
│   │   ├── setup_local.py        ← Migra URLs de Meta a rutas locales (/images/...)
│   │   └── update_and_sql.py     ← Asigna marcas/géneros y regenera init.sql
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx         ← Router principal (BrowserRouter + rutas)
│   │   ├── main.jsx        ← Entry point de Vite
│   │   ├── index.css       ← Design system completo (variables, layout, componentes)
│   │   ├── api/
│   │   │   └── catalog.js  ← Toda la lógica de fetch (público + admin) + helpers
│   │   ├── hooks/
│   │   │   └── useCatalog.js ← Hook con caché en memoria para el catálogo completo
│   │   ├── components/
│   │   │   ├── Nav.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── ProductCard.jsx
│   │   │   ├── FilterChips.jsx
│   │   │   ├── TopBanner.jsx   ← Banner animado de métodos de pago
│   │   │   └── TopBanner.css   ← Estilos del banner (animación scroll)
│   │   └── pages/
│   │       ├── Home.jsx
│   │       ├── Catalog.jsx
│   │       ├── Product.jsx
│   │       ├── About.jsx
│   │       ├── Admin.jsx        ← Panel admin (login + grid editable + historial)
│   │       └── AdminCambios.jsx ← Vista de historial completo
│   ├── public/
│   │   └── images/         ← Imágenes locales (si se usa setup_local.py)
│   ├── index.html
│   ├── vite.config.js      ← Proxy /api y /admin → localhost:8000 en dev
│   ├── vercel.json         ← SPA rewrite para React Router
│   └── package.json
│
└── backup/
    ├── catalog_backup.csv  ← CSV generado por backup_catalog.py
    └── images/             ← Imágenes descargadas de Meta CDN
```

---

## Setup de desarrollo (local)

**Requisitos:** Node.js, Python 3.11+, pip.

```powershell
# 1. Instalar dependencias raíz (solo concurrently)
npm install

# 2. Instalar dependencias del frontend
cd frontend && npm install && cd ..

# 3. Instalar dependencias del backend
pip install -r backend/requirements.txt

# 4. Levantar todo de un golpe
npm run dev
```

Esto arranca:
- **Backend** FastAPI en `http://localhost:8000` (con `--reload`)
- **Frontend** Vite en `http://localhost:5173` (con proxy hacia el backend)

---

## Variables de entorno

### Frontend (`frontend/.env.local`)

| Variable          | Descripción                                              | Ejemplo                          |
|-------------------|----------------------------------------------------------|----------------------------------|
| `VITE_API_URL`    | URL base del backend en producción. Vacía = usa proxy.   | `https://api.midominio.com`      |
| `VITE_ADMIN_TOKEN`| Token del panel admin. Debe coincidir con el backend.    | `mi-token-secreto`               |

### Backend (variable de entorno del servidor)

| Variable      | Descripción                        | Default              |
|---------------|------------------------------------|----------------------|
| `ADMIN_TOKEN` | Token que valida el header admin.  | `change-me-in-env`   |

---

## Despliegue

### Backend — Coolify
- **Directorio raíz:** `/backend`
- **Build:** `pip install -r requirements.txt`
- **Start:** `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- **Ports Exposes:** `8000` (sin Port Mappings; Coolify gestiona el proxy inverso)
- **Env:** Añade `ADMIN_TOKEN` con el valor secreto

### Frontend — Vercel
- **Directorio raíz:** `/frontend`
- **Framework:** Vite (Vercel lo detecta automáticamente)
- **Env en Vercel:** `VITE_API_URL` y `VITE_ADMIN_TOKEN`

---

## Scripts de mantenimiento (`backend/scripts/`)

Estos scripts se ejecutan manualmente desde la raíz del proyecto. No son parte del servidor.

| Script                  | Cuándo usarlo                                                         |
|-------------------------|-----------------------------------------------------------------------|
| `sync_meta_to_json.py`  | Para importar/actualizar productos desde el catálogo de Meta/Facebook |
| `backup_catalog.py`     | Para hacer un respaldo local en CSV + descargar imágenes de Meta CDN  |
| `setup_local.py`        | Tras el backup, para migrar las URLs de imagen a rutas locales        |
| `update_and_sql.py`     | Para reasignar géneros/marcas y regenerar `init.sql`                  |

```powershell
python backend/scripts/sync_meta_to_json.py
python backend/scripts/backup_catalog.py
python backend/scripts/setup_local.py
python backend/scripts/update_and_sql.py
```

---

## Flujo de datos

```
catalog.json  ←→  FastAPI (backend)  ←→  React (frontend)
                      ↑
                 Panel /admin (escribe directamente al JSON)
```

El `catalog.json` es la única base de datos. El panel de admin (ruta `/admin`) lee y escribe sobre él vía los endpoints protegidos.

---

## Notas de código

- **Redundancia identificada:** `Catalog.jsx` y `Admin.jsx` comparten lógica de filtrado/ordenación (disponible al final) y markup de tarjeta de producto. Si el proyecto crece, considera extraer esa lógica a un hook `useProductFilter`.
- **Doble `load_catalog()`:** La función está duplicada en `main.py` y `admin_router.py`. Se puede mover a un módulo `utils.py` compartido si se quiere limpiar.
- **CSS en componente:** `Admin.jsx` inyecta un bloque `<style>` con ~330 líneas. Si la app crece, conviene moverlo a `admin.css`.
- **`fetchProducts()` vs `fetchCatalog()`:** En `catalog.js`, `fetchProducts()` llama a `/api/catalog` (el endpoint completo) y luego extrae `.productos`, mientras que existe un endpoint dedicado `/api/products`. Usar el endpoint específico sería más eficiente.
