-- La vista sumaba abonos.monto en crudo: un pago de 1200 Bs contaba como 1200
-- USD y dejaba al cliente con deuda negativa. Ahora usa la conversion explicita
-- (monto_usd) y descarta los pagos en otra moneda que no la traen, igual que
-- hace el backend en _usd_payments()/_usd_amount().

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
  select cliente_id, sum(coalesce(monto_usd, monto)) as total_abonado
  from crm.abonos
  where moneda = 'usd' or monto_usd is not null
  group by cliente_id
) a on a.cliente_id = c.id;
