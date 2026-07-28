-- Indices de lectura para los filtros y agregaciones del dashboard CRM.

create index if not exists idx_crm_ventas_estado_fecha
  on crm.ventas (estado, creada_en desc);

create index if not exists idx_crm_abonos_moneda_fecha
  on crm.abonos (moneda, creado_en desc);

create index if not exists idx_crm_abonos_metodo_fecha
  on crm.abonos (metodo, creado_en desc);

create index if not exists idx_crm_venta_items_producto
  on crm.venta_items (producto_id, venta_id);
