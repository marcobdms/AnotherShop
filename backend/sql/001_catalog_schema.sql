-- Another NPC Shop — catálogo en Supabase/PostgreSQL
--
-- Revisar y ejecutar manualmente en Supabase SQL Editor antes de lanzar
-- backend/scripts/migrate_json_to_supabase.py.
--
-- El backend se conecta directamente a Postgres. Las tablas no necesitan
-- políticas públicas: profiles/favorites continúan usando su configuración
-- actual y el catálogo sigue expuesto únicamente por FastAPI.

create extension if not exists pgcrypto;

create table if not exists public.configuracion_catalogo (
    id boolean primary key default true check (id),
    meta jsonb not null default '{}'::jsonb,
    filtros jsonb not null default '{}'::jsonb,
    actualizado_en timestamptz not null default now()
);

create table if not exists public.productos (
    id text primary key,
    sync_key text not null unique,
    meta_id text not null default '',
    ref text not null,
    nombre text not null,
    precio numeric(12, 2) not null default 0,
    precio_coste numeric(12, 2) not null default 0,
    categoria text not null default 'sin_categoria',
    genero text not null default 'unisex',
    tallas jsonb not null default '[]'::jsonb,
    imagen_principal text not null default '',
    imagenes jsonb not null default '[]'::jsonb,
    descripcion text not null default '',
    disponible boolean not null default true,
    marca text not null default '',
    drop_nombre text not null default 'Drop 1',
    orden integer not null default 0,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now()
);

create table if not exists public.variantes (
    id uuid primary key default gen_random_uuid(),
    producto_id text not null references public.productos(id) on delete cascade,
    color text not null,
    color_hex text not null default '#000000',
    imagen text not null default '',
    orden integer not null default 0,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now(),
    unique (producto_id, orden)
);

create table if not exists public.inventario (
    variante_id uuid not null references public.variantes(id) on delete cascade,
    talla text not null,
    stock integer not null default 0 check (stock >= 0),
    disponible boolean not null default false,
    actualizado_en timestamptz not null default now(),
    primary key (variante_id, talla)
);

create table if not exists public.historial_catalogo (
    id uuid primary key default gen_random_uuid(),
    producto_id text not null,
    nombre text not null,
    tipo text,
    estado_anterior boolean not null default false,
    nuevo_estado boolean not null default false,
    usuario text not null default 'admin',
    fecha_hora text not null,
    mensaje text not null
);

create index if not exists idx_productos_ref
    on public.productos (ref);

create index if not exists idx_productos_disponible
    on public.productos (disponible);

create index if not exists idx_variantes_producto
    on public.variantes (producto_id, orden);

create index if not exists idx_historial_fecha
    on public.historial_catalogo (fecha_hora desc);

-- La anon key y los usuarios autenticados no acceden directamente al catálogo.
-- FastAPI es la única API pública y usa SUPABASE_DATABASE_URL en el backend.
alter table public.configuracion_catalogo enable row level security;
alter table public.productos enable row level security;
alter table public.variantes enable row level security;
alter table public.inventario enable row level security;
alter table public.historial_catalogo enable row level security;

revoke all on table public.configuracion_catalogo from anon, authenticated;
revoke all on table public.productos from anon, authenticated;
revoke all on table public.variantes from anon, authenticated;
revoke all on table public.inventario from anon, authenticated;
revoke all on table public.historial_catalogo from anon, authenticated;
