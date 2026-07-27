alter table crm.abonos
  add column if not exists moneda text not null default 'usd';

alter table crm.abonos
  drop constraint if exists abonos_metodo_check;

update crm.abonos
set moneda = metodo,
    metodo = 'desconocido'
where metodo in ('usd', 'bs', 'eur', 'usdt');

alter table crm.abonos
  add constraint abonos_metodo_check
  check (metodo in ('desconocido', 'efectivo', 'transferencia', 'zelle', 'binance', 'paypal'));

alter table crm.abonos
  drop constraint if exists abonos_moneda_check;

alter table crm.abonos
  add constraint abonos_moneda_check
  check (moneda in ('usd', 'bs', 'eur', 'usdt'));
