# Another NPC Shop

Monorepo privado de la tienda. Contiene:

- `frontend/`: storefront publico en React/Vite.
- `crm-frontend/`: panel privado CRM/admin general.
- `backend/`: API FastAPI para catalogo, admin, CRM y Storage.
- `ios/`: cliente iOS en desarrollo.

## Desarrollo local

Instalar dependencias:

```powershell
npm install
npm install --prefix frontend
npm install --prefix crm-frontend
pip install -r backend/requirements.txt
```

Levantar todo:

```powershell
npm run dev
```

Servicios locales:

- Backend: `http://localhost:8010`
- Storefront: `http://localhost:5173`
- CRM: `http://localhost:5174`

El backend carga primero `.env.local` y despues `.env`. Usa `.env.local` para desarrollo local o staging, asi reduces el riesgo de probar contra datos de produccion.

## Env

Ejemplos agnosticos:

- Backend: `backend/.env.example`
- Storefront: `frontend/.env.example`
- CRM: `crm-frontend/.env.example`

Variables clave:

- `SUPABASE_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TOKEN` para backend.
- `VITE_API_URL`, `VITE_LOCAL_API_URL`, `VITE_ADMIN_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` para frontends Vite.
- `VITE_CRM_URL` en `frontend/` para enviar `/admin/import` al CRM desplegado.

Nota: cualquier `VITE_*` queda visible en el bundle del navegador. El CRM debe estar protegido por el proveedor de hosting o por una capa de acceso adicional.

## Rutas

Storefront:

- `/`, `/catalogo`, `/producto/:id`, `/nosotros`, `/login`, `/cuenta`
- `/admin`: panel antiguo de disponibilidad/inventario.
- `/admin/cambios`: historial admin antiguo.
- `/admin/import`: redirige al CRM.

CRM:

- `/clientes`
- `/dashboard`
- `/import`: importacion y sincronizacion masiva de catalogo.
- `/admin/import`: alias interno hacia `/import`.

## Deploy

Backend en Coolify:

- Root: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Puerto: `8000`

Storefront en Vercel:

- Root: `frontend`
- Build: `npm install && npm run build`
- Output: `dist`
- Env: `VITE_API_URL`, `VITE_CRM_URL`, `VITE_ADMIN_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

CRM en Vercel o Coolify:

- Root: `crm-frontend`
- Build: `npm install && npm run build`
- Output: `dist`
- Env: `VITE_API_URL`, `VITE_ADMIN_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Tareas Pendientes

1. Backup real del catalogo: exportar `GET /admin/export-full` desde produccion, guardarlo fuera del repo y compararlo con `backend/data/catalog.json`, `backend/data/inventory.json` y `frontend/public/images`.
2. Despues del backup real, decidir si se archivan o eliminan imagenes locales antiguas. No borrar `frontend/public/images` ni los JSON viejos sin esa exportacion.
3. Mover el resto del admin antiguo (`/admin`, `/admin/cambios`) al CRM para que el storefront no cargue codigo admin.
4. Revisar la pantalla publica vieja `/clientes` y eliminarla cuando el CRM separado sea la unica fuente.
5. Recortar CSS duplicado del CRM solo despues de verificar visualmente las pantallas.
