-- Pedidos online: la tienda pública crea pedidos que NO tocan inventario ni
-- crm.ventas. El admin los verifica en el CRM y solo entonces se convierten en
-- venta + abono (que es donde baja el stock).

create table if not exists crm.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'pago_declarado', 'verificado', 'confirmado', 'cancelado')),
  nombre text not null default '',
  telefono text not null default '',
  email text not null default '',
  user_id uuid,
  cliente_id uuid references crm.clientes(id) on delete set null,
  venta_id uuid references crm.ventas(id) on delete set null,
  metodo_pago text not null default '',
  total_usd numeric(12, 2) not null default 0 check (total_usd >= 0),
  nota text not null default '',
  entrega text not null default '',
  motivo_cancelacion text not null default '',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Mismo snapshot desnormalizado que crm.venta_items: el pedido histórico
-- sobrevive a cambios del catálogo.
create table if not exists crm.pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references crm.pedidos(id) on delete cascade,
  producto_id text not null,
  variante_id uuid not null,
  talla text not null,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(12, 2) not null check (precio_unitario >= 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  producto_nombre text not null,
  producto_ref text not null default '',
  color text not null default '',
  color_hex text not null default '#000000',
  imagen text not null default ''
);

-- Lo que el cliente declara haber pagado. Todavía no es dinero contable: pasa a
-- crm.abonos cuando el admin confirma el pedido.
create table if not exists crm.pedido_pagos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references crm.pedidos(id) on delete cascade,
  metodo text not null,
  moneda text not null default 'usd' check (moneda in ('usd', 'bs', 'eur', 'usdt')),
  monto numeric(12, 2) not null check (monto > 0),
  tasa numeric(18, 6),
  monto_usd numeric(12, 2) not null check (monto_usd >= 0),
  referencia text not null default '',
  -- UNIQUE = idempotencia: un webhook reintentado no duplica el pago.
  id_externo text unique,
  proveedor text not null default 'manual',
  estado text not null default 'declarado'
    check (estado in ('declarado', 'verificado', 'rechazado')),
  payload_raw jsonb,
  comprobante_path text not null default '',
  nota text not null default '',
  creado_en timestamptz not null default now(),
  verificado_en timestamptz,
  verificado_por text not null default ''
);

-- El comprador web y el cliente del CRM eran dos mundos sin puente.
alter table crm.clientes add column if not exists email text not null default '';
alter table crm.clientes add column if not exists user_id uuid;

-- Pago móvil faltaba como método y es el principal en Bs.
alter table crm.abonos drop constraint if exists abonos_metodo_check;
alter table crm.abonos
  add constraint abonos_metodo_check
  check (metodo in ('desconocido', 'efectivo', 'transferencia', 'zelle', 'binance', 'paypal', 'pago_movil'));

-- Sin tasa, un pago en Bs era dinero invisible: todos los cálculos de deuda y
-- del dashboard filtran por moneda = 'usd' y lo descartaban.
alter table crm.abonos add column if not exists tasa numeric(18, 6);
alter table crm.abonos add column if not exists monto_usd numeric(12, 2);
update crm.abonos set monto_usd = monto where monto_usd is null and moneda = 'usd';

create index if not exists idx_crm_pedidos_estado on crm.pedidos (estado, creado_en desc);
create index if not exists idx_crm_pedidos_numero on crm.pedidos (numero);
create index if not exists idx_crm_pedidos_user on crm.pedidos (user_id, creado_en desc);
create index if not exists idx_crm_pedido_items_pedido on crm.pedido_items (pedido_id);
create index if not exists idx_crm_pedido_pagos_pedido on crm.pedido_pagos (pedido_id, creado_en desc);
create index if not exists idx_crm_clientes_email on crm.clientes (lower(email)) where email <> '';

alter table crm.pedidos enable row level security;
alter table crm.pedido_items enable row level security;
alter table crm.pedido_pagos enable row level security;
