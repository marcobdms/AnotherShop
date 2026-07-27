-- Sincroniza la constraint de PostgreSQL con los metodos aceptados por el CRM.
-- El bloque previo evita sustituirla si existen metodos historicos no contemplados.
do $$
declare
  metodos_no_contemplados text;
begin
  select string_agg(distinct metodo, ', ' order by metodo)
    into metodos_no_contemplados
  from crm.abonos
  where metodo not in (
    'desconocido',
    'efectivo',
    'transferencia',
    'zelle',
    'binance',
    'paypal'
  );

  if metodos_no_contemplados is not null then
    raise exception using
      message = 'Hay metodos existentes que deben conservarse antes de actualizar la constraint: '
        || metodos_no_contemplados;
  end if;
end
$$;

alter table crm.abonos
  drop constraint if exists abonos_metodo_check;

alter table crm.abonos
  add constraint abonos_metodo_check
  check (
    metodo in (
      'desconocido',
      'efectivo',
      'transferencia',
      'zelle',
      'binance',
      'paypal'
    )
  );
