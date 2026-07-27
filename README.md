# ANOTHER NPC SHOP

Monorepo de la tienda Another NPC Shop. Incluye un frontend web en React/Vite, un backend en FastAPI, catálogo e inventario en Supabase/PostgreSQL y un cliente iOS en desarrollo.

La app web publica un catalogo de ropa, fichas de producto, favoritos con Supabase, un panel administrativo para disponibilidad, inventario, historial e importacion masiva, y un CRM interno para clientes, compras, abonos y comprobantes.

## Stack

| Capa | Tecnologia |
| --- | --- |
| Frontend web | React 18, Vite, React Router |
| Estilos | CSS propio en `frontend/src/index.css` + estilos puntuales inline en pantallas admin/cuenta |
| Backend | FastAPI, Uvicorn, SQLAlchemy 2, psycopg 3 |
| CRM interno | Clientes, ventas, abonos y comprobantes sobre Supabase/PostgreSQL |
| Catálogo e inventario | Supabase/PostgreSQL desde FastAPI |
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
|   |   |-- admin_router.py       # API admin: /admin/*
|   |   |-- catalog_repository.py # lecturas/escrituras SQL y transacciones
|   |   |-- crm_router.py         # API CRM: /crm/*
|   |   |-- crm_repository.py     # clientes, ventas, abonos y stock atomico
|   |   |-- database.py           # conexión privada a PostgreSQL
|   |   `-- storage.py            # subida y URLs públicas de Supabase Storage
|   |-- data/
|   |   |-- catalog.json          # backup y fuente de la migración inicial
|   |   `-- inventory.json        # backup y fuente de la migración inicial
|   |-- scripts/
|   |   `-- migrate_json_to_supabase.py
|   |-- sql/
|   |   |-- 001_catalog_schema.sql
|   |   |-- 002_catalog_images_storage.sql
|   |   |-- 003_crm_schema.sql
|   |   `-- 004_crm_receipts_storage.sql
|   `-- requirements.txt
|-- frontend/
|   |-- public/
|   |   |-- another.mp4           # video hero del Home
|   |   |-- logo.png
|   |   |-- npc.png
|   |   `-- images/               # imagenes de producto servidas por Vite
|   |-- src/
|   |   |-- App.jsx               # layout global y rutas
|   |   |-- api/catalog.js        # cliente HTTP publico/admin/CRM
|   |   |-- hooks/                # catalogo cacheado, auth y favoritos
|   |   |-- components/           # Nav, ProductCard, filtros, Footer, TopBanner, InventoryModal
|   |   `-- pages/                # Home, Catalog, Product, About, Login, Account, Admin...
|   |-- vite.config.js            # dev server en :3000 y proxy a :8000
|   `-- vercel.json               # rewrite SPA para React Router
|-- crm-frontend/                 # app Vite separada para despliegue privado del CRM
|   |-- src/main.jsx              # reutiliza la pantalla /clientes del frontend
|   `-- vite.config.js            # dev server en :3002 y proxy a :8000
`-- ios/                          # app iOS Swift en desarrollo
```

## Desarrollo local

Requisitos:

- Node.js
- Python 3.11+ recomendado
- `pip`
- Un proyecto Supabase con el esquema del catálogo aplicado

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
| `npm run crm-frontend` | Lanza el CRM separado desde `crm-frontend/` |
| `npm run build --prefix frontend` | Compila el frontend para produccion |
| `npm run build --prefix crm-frontend` | Compila el frontend privado del CRM |
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

`crm-frontend/` usa las mismas variables `VITE_API_URL`, `VITE_ADMIN_TOKEN`,
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, pero deben configurarse en su
propio servicio si lo despliegas separado.

### Backend

| Variable | Uso | Default |
| --- | --- | --- |
| `SUPABASE_DATABASE_URL` | URI privada del Transaction Pooler de Supabase | Obligatoria |
| `SUPABASE_URL` | URL pública del proyecto, usada por Storage en el backend | Obligatoria |
| `SUPABASE_STORAGE_BUCKET` | Bucket de imágenes públicas | `catalog-images` |
| `SUPABASE_CRM_RECEIPTS_BUCKET` | Bucket privado de comprobantes del CRM | `crm-receipts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Credencial de Storage exclusiva del backend | Obligatoria |
| `ADMIN_TOKEN` | Token que protege endpoints admin | Obligatoria |

Usa [backend/.env.example](backend/.env.example) como referencia. La URI y la
contraseña de Postgres son secretos exclusivos del backend: nunca deben llevar
prefijo `VITE_` ni aparecer en el frontend. La service role se usa solo para
subir imágenes desde FastAPI; rótala de inmediato si alguna vez se expone.

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
| `/clientes` | CRM interno protegido por la misma sesion admin |

## API publica

| Endpoint | Descripcion |
| --- | --- |
| `GET /api/catalog` | Catalogo completo: `meta`, `filtros`, `productos`; el backend expande variantes desde PostgreSQL |
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
| `POST /admin/upload-image` | Subir imagen a Supabase Storage |

## API CRM

Todos los endpoints `/crm/*` requieren header `X-Admin-Token`.

| Endpoint | Uso |
| --- | --- |
| `GET/POST /crm/clientes` | Listar y crear clientes |
| `GET/PUT /crm/clientes/{id}` | Leer y editar ficha de cliente |
| `GET /crm/catalogo` | Buscar catalogo real disponible para registrar compras |
| `GET/POST /crm/clientes/{id}/ventas` | Ver historial y registrar compras |
| `DELETE /crm/ventas/{id}` | Anular compra y reponer stock |
| `GET/POST /crm/clientes/{id}/abonos` | Ver y registrar abonos |
| `GET/POST /crm/clientes/{id}/comprobantes` | Ver/subir imagenes privadas de comprobantes |

## Datos del catálogo

El esquema está en `backend/sql/001_catalog_schema.sql`:

- `productos`: identidad y datos comerciales. `id` conserva valores como
  `"004"`; `ref` puede repetirse y `sync_key` diferencia internamente cada fila.
- `variantes`: colores e imagen opcional por producto.
- `inventario`: stock y disponibilidad por variante/talla.
- `configuracion_catalogo`: `meta` y `filtros`.
- `historial_catalogo`: últimos cambios administrativos.

FastAPI recompone la misma estructura JSON anterior. El toggle `disponible`
sigue siendo el control manual principal; el stock informa tallas y colores.
`catalog.json` e `inventory.json` quedan como backup de solo lectura y el
backend ya no los modifica.

Cuando el CRM ya tiene ventas historicas, `/admin/import` y los borrados admin
evitan eliminar fisicamente productos vendidos: los dejan no disponibles para
conservar la posibilidad de anular una venta y reponer inventario.

## CRM

El esquema esta en `backend/sql/003_crm_schema.sql` y el bucket privado en
`backend/sql/004_crm_receipts_storage.sql`.

- `crm.clientes`: nombre, telefono y notas.
- `crm.ventas`: compra individual, total, estado y usuario.
- `crm.venta_items`: prendas compradas con snapshot historico de producto,
  color, talla, imagen y precio.
- `crm.abonos`: pagos parciales por efectivo o transferencia.
- `crm.abono_asignaciones`: reparto automatico del abono entre compras activas
  mas antiguas.
- `crm.comprobantes_cliente`: imagenes privadas asociadas a la ficha del cliente.

Registrar una compra valida el stock real y descuenta inventario dentro de una
misma transaccion del backend. Anular una compra repone el stock y deja la venta
como `anulada` para conservar trazabilidad.

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

### Migración inicial del catálogo

1. Haz backup del proyecto Supabase y de `backend/data/`.
2. Revisa y ejecuta `backend/sql/001_catalog_schema.sql` en Supabase SQL Editor.
3. Ejecuta `backend/sql/002_catalog_images_storage.sql` para marcar
   `catalog-images` como público.
4. En el backend configura `SUPABASE_DATABASE_URL` con la URI del
   **Transaction pooler**, además de `SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY`.
5. Valida los JSON sin escribir:

   ```powershell
   python backend/scripts/migrate_json_to_supabase.py
   ```

6. Ejecuta la carga única:

   ```powershell
   python backend/scripts/migrate_json_to_supabase.py --apply
   ```

La carga con `--apply` sube las imágenes locales a
`catalog-images/products/<id>/`, reemplaza sus URLs en la carga a PostgreSQL,
y compara los conteos migrados. No modifica ni elimina los JSON ni las
imágenes locales.

### Activacion del CRM

1. Ejecuta `backend/sql/003_crm_schema.sql` en Supabase SQL Editor.
2. Ejecuta `backend/sql/004_crm_receipts_storage.sql` para crear el bucket
   privado `crm-receipts`.
3. Configura `SUPABASE_CRM_RECEIPTS_BUCKET=crm-receipts` en el backend.
4. Entra primero a `/admin` para crear la sesion interna y luego abre
   `/clientes`.

### Verificación posterior

- `GET /api/catalog` debe conservar las claves `meta`, `filtros`, `productos`
  e `historial`.
- `GET /admin/export-full` debe mostrar todos los productos y variantes.
- En `/admin`, edita disponibilidad e inventario y confirma el historial.
- En `/admin/import`, sincroniza sin modificar el formato del JSON de entrada.
- Confirma que los timestamps de `catalog.json` e `inventory.json` no cambian.

## Despliegue

### Backend en Coolify

- Directorio raiz: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Puerto expuesto: `8000`
- Env: `SUPABASE_DATABASE_URL`, `SUPABASE_URL`,
  `SUPABASE_STORAGE_BUCKET=catalog-images`,
  `SUPABASE_CRM_RECEIPTS_BUCKET=crm-receipts`,
  `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TOKEN`

En Supabase, copia la conexión desde **Project Settings → Database → Connect →
Transaction pooler**. Sustituye la contraseña, conserva `sslmode=require` y
añade la URI completa como variable secreta en el servicio backend de Coolify.
No añadas la contraseña de Postgres ni una service role key a Vercel.

### Frontend en Vercel

- Directorio raiz: `frontend`
- Framework: Vite
- Env: `VITE_API_URL`, `VITE_ADMIN_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### CRM privado en Vercel o Coolify

- Directorio raiz: `crm-frontend`
- Framework: Vite
- Build: `npm install && npm run build`
- Output: `dist`
- Env: `VITE_API_URL`, `VITE_ADMIN_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Las imágenes del catálogo se sirven desde el bucket público
`catalog-images`. La migración conserva `frontend/public/images` como backup.
Las nuevas subidas reciben una ruta UUID en Storage, por lo que referencias
repetidas no pueden solaparse. Vercel puede cargar estas URLs CDN sin compartir
filesystem con Coolify.

## Notas de mantenimiento

- `README.md` describe arquitectura y operacion.
- `design.md` describe identidad visual y reglas para tocar frontend.
- El catalogo se consume principalmente con `useCatalog()`, que cachea `GET /api/catalog` en memoria.
- El retorno desde producto a catalogo restaura scroll antes de revelar nav, cinta y grid para evitar saltos visuales.
- Varias pantallas admin y cuenta aun tienen estilos inline dentro del componente. Si crecen, conviene extraerlos a CSS dedicado.
- No editar `backend/data/catalog.json` o `backend/data/inventory.json`: son
  backups de solo lectura después de la migración.
