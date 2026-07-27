-- El bucket catalog-images ya fue creado desde Supabase Dashboard.
-- Ejecuta esto en Supabase SQL Editor para servir las imágenes del catálogo
-- directamente por CDN mediante URLs públicas.

update storage.buckets
set public = true
where id = 'catalog-images';
