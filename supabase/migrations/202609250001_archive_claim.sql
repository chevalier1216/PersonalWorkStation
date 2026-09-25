-- Claim an attachment once before any external Drive request. A second click
-- cannot start another upload while the first request is in progress.
create function public.attachment_archive_claim(target uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); claimed boolean;
begin
  if actor is null or not public.is_allowed() then
    raise exception '此帳號尚未獲准使用工作臺' using errcode='42501';
  end if;
  update public.task_attachments
    set archive_status='archiving',archive_error=''
    where owner_id=actor and id=target and archive_status in ('active','failed')
      and source_deleted_at is null and drive_file_id is null
    returning true into claimed;
  return coalesce(claimed,false);
end $$;

revoke all on function public.attachment_archive_claim(uuid) from public;
grant execute on function public.attachment_archive_claim(uuid) to authenticated;
