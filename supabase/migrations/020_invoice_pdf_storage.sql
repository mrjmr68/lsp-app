insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoice-pdfs',
  'invoice-pdfs',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners can read invoice pdfs" on storage.objects;
create policy "Owners can read invoice pdfs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'invoice-pdfs'
  and public.is_owner()
);

drop policy if exists "Owners can upload invoice pdfs" on storage.objects;
create policy "Owners can upload invoice pdfs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'invoice-pdfs'
  and public.is_owner()
);

drop policy if exists "Owners can update invoice pdfs" on storage.objects;
create policy "Owners can update invoice pdfs"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'invoice-pdfs'
  and public.is_owner()
)
with check (
  bucket_id = 'invoice-pdfs'
  and public.is_owner()
);

drop policy if exists "Owners can delete invoice pdfs" on storage.objects;
create policy "Owners can delete invoice pdfs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'invoice-pdfs'
  and public.is_owner()
);
