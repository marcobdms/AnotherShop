-- Registro de correos enviados por pedido. La restriccion UNIQUE (pedido_id, tipo)
-- garantiza que el mismo aviso ("confirmado", "pago verificado"...) no se envie
-- dos veces aunque el evento se dispare varias veces.

create table if not exists crm.pedido_emails (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references crm.pedidos(id) on delete cascade,
  tipo text not null check (tipo in ('recibido', 'verificado', 'confirmado', 'cancelado')),
  destinatario text not null default '',
  estado text not null check (estado in ('enviado', 'error')),
  detalle text not null default '',
  creado_en timestamptz not null default now(),
  unique (pedido_id, tipo)
);

create index if not exists idx_crm_pedido_emails_pedido on crm.pedido_emails (pedido_id);

alter table crm.pedido_emails enable row level security;
