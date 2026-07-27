create schema if not exists crm;

create table if not exists crm.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text not null default '',
  notas text not null default '',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists crm.ventas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references crm.clientes(id) on delete restrict,
  estado text not null default 'activa' check (estado in ('activa', 'anulada')),
  total numeric(12, 2) not null default 0,
  usuario text not null default 'admin',
  nota text not null default '',
  creada_en timestamptz not null default now(),
  anulada_en timestamptz,
  motivo_anulacion text not null default ''
);

create table if not exists crm.venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references crm.ventas(id) on delete cascade,
  producto_id text not null,
  variante_id uuid not null,
  talla text not null,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(12, 2) not null check (precio_unitario >= 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  producto_nombre text not null,
  producto_ref text not null default '',
  color text not null,
  color_hex text not null default '#000000',
  imagen text not null default ''
);

create table if not exists crm.abonos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references crm.clientes(id) on delete restrict,
  monto numeric(12, 2) not null check (monto > 0),
  metodo text not null check (metodo in ('desconocido', 'efectivo', 'transferencia', 'zelle', 'binance', 'paypal')),
  moneda text not null default 'usd' check (moneda in ('usd', 'bs', 'eur', 'usdt')),
  usuario text not null default 'admin',
  nota text not null default '',
  creado_en timestamptz not null default now()
);

create table if not exists crm.abono_asignaciones (
  id uuid primary key default gen_random_uuid(),
  abono_id uuid not null references crm.abonos(id) on delete cascade,
  venta_id uuid not null references crm.ventas(id) on delete cascade,
  monto numeric(12, 2) not null check (monto > 0),
  creado_en timestamptz not null default now()
);

create table if not exists crm.comprobantes_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references crm.clientes(id) on delete cascade,
  abono_id uuid references crm.abonos(id) on delete set null,
  storage_path text not null,
  url_publica text not null default '',
  nombre_archivo text not null default '',
  content_type text not null default '',
  usuario text not null default 'admin',
  creado_en timestamptz not null default now()
);

create index if not exists idx_crm_clientes_nombre on crm.clientes using gin (to_tsvector('simple', nombre));
create index if not exists idx_crm_ventas_cliente on crm.ventas (cliente_id, creada_en desc);
create index if not exists idx_crm_venta_items_venta on crm.venta_items (venta_id);
create index if not exists idx_crm_abonos_cliente on crm.abonos (cliente_id, creado_en desc);
create index if not exists idx_crm_asignaciones_venta on crm.abono_asignaciones (venta_id);
create index if not exists idx_crm_comprobantes_cliente on crm.comprobantes_cliente (cliente_id, creado_en desc);

alter table crm.clientes enable row level security;
alter table crm.ventas enable row level security;
alter table crm.venta_items enable row level security;
alter table crm.abonos enable row level security;
alter table crm.abono_asignaciones enable row level security;
alter table crm.comprobantes_cliente enable row level security;

create or replace view crm.clientes_balance as
select
  c.id as cliente_id,
  coalesce(v.total_comprado, 0)::numeric(12, 2) as total_comprado,
  coalesce(a.total_abonado, 0)::numeric(12, 2) as total_abonado,
  (coalesce(v.total_comprado, 0) - coalesce(a.total_abonado, 0))::numeric(12, 2) as deuda
from crm.clientes c
left join (
  select cliente_id, sum(total) as total_comprado
  from crm.ventas
  where estado = 'activa'
  group by cliente_id
) v on v.cliente_id = c.id
left join (
  select cliente_id, sum(monto) as total_abonado
  from crm.abonos
  group by cliente_id
) a on a.cliente_id = c.id;
