alter table crm.abonos
  drop constraint if exists abonos_metodo_check;

alter table crm.abonos
  add constraint abonos_metodo_check
  check (metodo in ('efectivo', 'transferencia', 'zelle', 'binance', 'paypal'));
