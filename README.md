# ═══════════════════════════════════════════════════════════
# ANOTHER NPC SHOP — MONOREPO (React + FastAPI)
# ═══════════════════════════════════════════════════════════

## Estructura actual

```
anothershop/
├── package.json          ← Scripts raíz (npm run dev)
├── init.sql              ← Base de datos SQL lista para Supabase/Coolify
│
├── backend/
│   ├── app/
│   │   └── main.py       ← FastAPI (API)
│   ├── data/
│   │   └── catalog.json  ← Fuente de verdad (Local)
│   ├── scripts/          ← Utilísimos (SQL Generator, Meta Sync)
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── api/           ← Capa de conexión
    │   ├── components/    ← Nav, ProductCard, FilterChips (Listos para Stitch)
    │   └── pages/         ← Vistas (Home, Catalog, Product, About)
    ├── public/images/     ← Físicos de las fotos
    └── vite.config.js     ← Proxy de dev
```

## Setup de Desarrollo (Local)

1. Abre la raíz del proyecto.
2. Levanta TODO de un solo golpe corriendo:
```powershell
npm run dev
```
*(Este comando usa `concurrently` para correr el backend en el puerto 8000 y el frontend de Vite en el 5173).*

El sitio web cargará directamente en: `http://localhost:5173` o `http://localhost:3000` dependiendo de tu puerto local.

## Guía de Despliegue (Coolify + Vercel)

### Backend (Coolify)
- **Directorio:** `/backend`
- **Build:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- **Puertos:** `8000` (Pon esto en "Ports Exposes"). No pongas "Port Mappings" (déjalo vacío). Coolify conectará su proxy inverso (internivel) y no chocarás con ningún puerto tuyo ni crearás conflictos.

### Frontend (Vercel)
- **Directorio:** `/frontend`
- **Variables de Entorno:** Añade en Vercel -> `VITE_API_URL = https://api.tu-dominio-coolify.com`
El código React ya está programado para ignorar el proxy local si consigue leer esa variable y atacar directo a Coolify de una.
