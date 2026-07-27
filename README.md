# ANOTHER NPC SHOP

Monorepo de la tienda Another NPC Shop. Incluye un frontend web en React/Vite, un backend en FastAPI, datos locales en JSON y un cliente iOS en desarrollo.

La app web publica un catalogo de ropa, fichas de producto, favoritos con Supabase y un panel administrativo para disponibilidad, inventario, historial e importacion masiva.

## Stack

| Capa | Tecnologia |
| --- | --- |
| Frontend web | React 18, Vite, React Router |
| Estilos | CSS propio en `frontend/src/index.css` + estilos puntuales inline en pantallas admin/cuenta |
| Backend | FastAPI, Uvicorn |
| Datos catalogo | `backend/data/catalog.json` |
| Datos inventario | `backend/data/inventory.json` |
| Auth/favoritos | Supabase desde el frontend |
| Cliente nativo | Swift/iOS en `ios/` |

## Estructura actual

```text
anothershop/
|-- package.json                  # scripts raiz para levantar back + front
|-- README.md
|-- design.md                     # referencia visual vigente
|-- backend/
|   |-- app/
|   |   |-- main.py               # API publica: /api/catalog, /api/products, /api/meta, /api/filters
|   |   `-- admin_router.py       # API admin: /admin/*
|   |-- data/
|   |   |-- catalog.json          # meta, filtros, productos e historial
|   |   `-- inventory.json        # variantes de color y stock por talla
|   `-- requirements.txt
|-- frontend/
|   |-- public/
|   |   |-- another.mp4           # video hero del Home
|   |   |-- logo.png
|   |   |-- npc.png
|   |   `-- images/               # imagenes de producto servidas por Vite
|   |-- src/
|   |   |-- App.jsx               # layout global y rutas
|   |   |-- api/catalog.js        # cliente HTTP publico/admin
|   |   |-- hooks/                # catalogo cacheado, auth y favoritos
|   |   |-- components/           # Nav, ProductCard, filtros, Footer, TopBanner, InventoryModal
|   |   `-- pages/                # Home, Catalog, Product, About, Login, Account, Admin...
|   |-- vite.config.js            # dev server en :3000 y proxy a :8000
|   `-- vercel.json               # rewrite SPA para React Router
`-- ios/                          # app iOS Swift en desarrollo
```

No existen actualmente `init.sql`, `backend/scripts/` ni `backup/`; cualquier referencia antigua a esos paths estaba obsoleta.

## Desarrollo local

Requisitos:

- Node.js
- Python 3.11+ recomendado
- `pip`

Instalacion:

```powershell
npm install
npm install --prefix frontend
pip install -r backend/requirements.txt
```

Levantar todo:

```powershell
npm run dev
```

Esto arranca:

- Backend FastAPI: `http://localhost:8000`
- Frontend Vite: `http://localhost:3000`

Si el puerto `3000` esta ocupado, Vite usara el siguiente puerto disponible, por ejemplo `3001`.

## Scripts

| Comando | Descripcion |
| --- | --- |
| `npm run dev` | Lanza backend y frontend en paralelo |
| `npm run backend` | Lanza FastAPI con reload en `:8000` |
| `npm run frontend` | Lanza Vite desde `frontend/` |
| `npm run build --prefix frontend` | Compila el frontend para produccion |
| `npm run preview --prefix frontend` | Previsualiza el build de Vite |

## Variables de entorno

### Frontend

Crear `frontend/.env.local` cuando haga falta:

| Variable | Uso |
| --- | --- |
| `VITE_API_URL` | URL base del backend en produccion. Vacio usa el proxy local de Vite |
| `VITE_ADMIN_TOKEN` | Token enviado como `X-Admin-Token` a endpoints `/admin/*` |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key publica de Supabase |

### Backend

| Variable | Uso | Default |
| --- | --- | --- |
| `ADMIN_TOKEN` | Token que protege endpoints admin | `change-me-in-env` |

## Rutas web

| Ruta | Vista |
| --- | --- |
| `/` | Landing con video hero, logo/nav glass y CTA al catalogo |
| `/catalogo` | Catalogo con TopBanner, filtros, busqueda, favoritos y restauracion de scroll |
| `/producto/:id` | Detalle con carrusel, tallas, favoritos, WhatsApp y PayPal |
| `/nosotros` | Pagina editorial de marca |
| `/login` | Login/registro Supabase, sin nav global |
| `/cuenta` | Favoritos del usuario; redirige a login si no hay sesion |
| `/admin` | Panel protegido de disponibilidad, inventario e historial |
| `/admin/cambios` | Historial completo de cambios |
| `/admin/import` | Importacion/sincronizacion masiva de drops |

## API publica

| Endpoint | Descripcion |
| --- | --- |
| `GET /api/catalog` | Catalogo completo: `meta`, `filtros`, `productos`; el backend expande variantes desde `inventory.json` |
| `GET /api/products` | Lista de productos para tarjetas |
| `GET /api/products/{id}` | Detalle de producto con variantes y SKUs |
| `GET /api/meta` | Datos de marca, WhatsApp y PayPal |
| `GET /api/filters` | Tallas y generos disponibles |

## API admin

Todos los endpoints `/admin/*` requieren header `X-Admin-Token`.

| Endpoint | Uso |
| --- | --- |
| `GET/POST/PUT/DELETE /admin/products` | CRUD de productos |
| `PATCH /admin/products/{id}/disponible` | Cambio rapido de disponibilidad con historial |
| `GET /admin/history` | Historial reciente |
| `POST /admin/publish` | Publicar borradores del panel |
| `GET/PUT /admin/meta` | Leer/editar meta de tienda |
| `GET/PUT /admin/inventory/{id}` | Leer/guardar inventario por producto |
| `GET /admin/export-full` | Exportar catalogo + inventario |
| `PUT /admin/sync-all` | Sincronizacion masiva de catalogo e inventario |
| `POST /admin/upload-image` | Subir imagen a `frontend/public/images` |

## Datos

`catalog.json` contiene:

- `meta`: marca, moneda, WhatsApp, PayPal y recargo PayPal
- `filtros`: tallas y generos
- `productos`: productos base
- `historial`: ultimos cambios administrativos

`inventory.json` contiene variantes por producto:

- color
- hex
- stock por talla

El backend combina ambos archivos para publicar variantes en catalogo y detalle. El toggle `disponible` sigue siendo el control manual principal de visibilidad comercial; el stock informa tallas/colores disponibles.

## Supabase

El frontend usa Supabase para auth y favoritos. La configuracion esperada es:

- `profiles`: perfil basico por usuario
- `favorites`: favoritos por `user_id` y `product_id`
- RLS activado para que cada usuario lea/escriba solo sus propios registros

SQL base:

```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Solo el propio usuario"
  on public.profiles for all using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.favorites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  product_id text not null,
  created_at timestamptz default now(),
  unique(user_id, product_id)
);
alter table public.favorites enable row level security;
create policy "Solo el propio usuario"
  on public.favorites for all using (auth.uid() = user_id);
```

## Despliegue

### Backend en Coolify

- Directorio raiz: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Puerto expuesto: `8000`
- Env: `ADMIN_TOKEN`

### Frontend en Vercel

- Directorio raiz: `frontend`
- Framework: Vite
- Env: `VITE_API_URL`, `VITE_ADMIN_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Notas de mantenimiento

- `README.md` describe arquitectura y operacion.
- `design.md` describe identidad visual y reglas para tocar frontend.
- El catalogo se consume principalmente con `useCatalog()`, que cachea `GET /api/catalog` en memoria.
- El retorno desde producto a catalogo restaura scroll antes de revelar nav, cinta y grid para evitar saltos visuales.
- Varias pantallas admin y cuenta aun tienen estilos inline dentro del componente. Si crecen, conviene extraerlos a CSS dedicado.
- No editar `backend/data/catalog.json` o `backend/data/inventory.json` manualmente salvo para mantenimiento controlado; el flujo normal debe pasar por `/admin`.
