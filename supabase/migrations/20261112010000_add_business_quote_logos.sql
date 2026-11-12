alter table public.businesses
  add column logo_path text,
  add constraint businesses_logo_path_owned
    check (logo_path is null or split_part(logo_path, '/', 1) = id::text);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-logos',
  'business-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Business owners can upload their own logos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'business-logos'
  and (storage.foldername(name))[1] = (select public.current_business_id())::text
);

create policy "Business owners can remove their own logos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'business-logos'
  and (storage.foldername(name))[1] = (select public.current_business_id())::text
);
