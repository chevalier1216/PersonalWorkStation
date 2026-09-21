insert into storage.buckets(id,name,public)
values('pws-attachments','pws-attachments',false)
on conflict(id) do update set public=false;

create policy pws_attachment_insert on storage.objects for insert to authenticated
  with check(bucket_id='pws-attachments' and (storage.foldername(name))[1]=auth.uid()::text and public.is_allowed());
create policy pws_attachment_select on storage.objects for select to authenticated
  using(bucket_id='pws-attachments' and (storage.foldername(name))[1]=auth.uid()::text and public.is_allowed());
create policy pws_attachment_delete on storage.objects for delete to authenticated
  using(bucket_id='pws-attachments' and (storage.foldername(name))[1]=auth.uid()::text and public.is_allowed());
