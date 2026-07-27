insert into storage.buckets (id, name, public)
values ('crm-receipts', 'crm-receipts', false)
on conflict (id) do nothing;
