create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  note_id uuid references public.task_notes(id) on delete set null,
  filename text not null check (length(trim(filename)) between 1 and 500),
  mime_type text not null default 'application/octet-stream' check (length(mime_type)<=255),
  size_bytes bigint not null check (size_bytes>=0),
  source_storage_path text not null check (length(source_storage_path) between 1 and 2000),
  source_deleted_at timestamptz,
  archive_status text not null default 'active' check (archive_status in ('active','archiving','archived','failed')),
  archive_error text not null default '' check (length(archive_error)<=2000),
  drive_file_id text check (drive_file_id is null or length(drive_file_id)<=1024),
  drive_web_view_link text check (drive_web_view_link is null or drive_web_view_link like 'https://%'),
  drive_path text check (drive_path is null or length(drive_path)<=2000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  last_accessed_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(owner_id,task_id) references public.tasks(owner_id,id) on delete cascade
);
create index task_attachments_owner_task_created_idx on public.task_attachments(owner_id,task_id,created_at desc);
create index task_attachments_owner_archive_idx on public.task_attachments(owner_id,archive_status,last_accessed_at);

create table public.capacity_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  service text not null check (service in ('supabase_database','supabase_storage','google_drive')),
  used_bytes bigint not null check (used_bytes>=0),
  limit_bytes bigint check (limit_bytes is null or limit_bytes>0),
  used_percent numeric(6,3) check (used_percent is null or used_percent>=0),
  measured_at timestamptz not null default now()
);
create index capacity_snapshots_owner_service_idx on public.capacity_snapshots(owner_id,service,measured_at desc);

create table public.metadata_backups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  drive_file_id text,
  drive_web_view_link text,
  drive_path text,
  record_count integer not null default 0 check (record_count>=0),
  status text not null check (status in ('completed','failed')),
  error text not null default '' check (length(error)<=2000),
  created_at timestamptz not null default now()
);

alter table public.task_attachments enable row level security;
alter table public.capacity_snapshots enable row level security;
alter table public.metadata_backups enable row level security;
create policy own_task_attachments on public.task_attachments for select to authenticated using (owner_id=auth.uid() and public.is_allowed());
create policy own_capacity_snapshots on public.capacity_snapshots for select to authenticated using (owner_id=auth.uid() and public.is_allowed());
create policy own_metadata_backups on public.metadata_backups for select to authenticated using (owner_id=auth.uid() and public.is_allowed());
revoke all on public.task_attachments,public.capacity_snapshots,public.metadata_backups from anon,authenticated;
grant select on public.task_attachments,public.capacity_snapshots,public.metadata_backups to authenticated;

create function public.attachment_state() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'attachments',coalesce((select jsonb_agg(to_jsonb(a)-'owner_id' order by a.created_at desc) from public.task_attachments a where a.owner_id=auth.uid()),'[]'::jsonb),
    'capacity',coalesce((select jsonb_agg(to_jsonb(c)-'owner_id' order by c.measured_at desc) from (select distinct on(service) * from public.capacity_snapshots where owner_id=auth.uid() order by service,measured_at desc) c),'[]'::jsonb),
    'backups',coalesce((select jsonb_agg(to_jsonb(b)-'owner_id' order by b.created_at desc) from public.metadata_backups b where b.owner_id=auth.uid() limit 20),'[]'::jsonb)
  )
$$;

create function public.attachment_command(action text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); target uuid; target_task uuid; target_note uuid; attachment public.task_attachments%rowtype;
  service_name text; percent numeric; backup_status text;
begin
  if actor is null or not public.is_allowed() then raise exception '此帳號尚未獲准使用工作臺' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext(actor::text));
  if action='record_upload' then
    target_task:=(payload->>'task_id')::uuid;
    target_note:=nullif(payload->>'note_id','')::uuid;
    if not exists(select 1 from public.tasks where owner_id=actor and id=target_task) then raise exception '找不到任務'; end if;
    if target_note is not null and not exists(select 1 from public.task_notes where owner_id=actor and id=target_note and task_id=target_task) then raise exception 'Activity attachment 必須屬於同一 Task'; end if;
    insert into public.task_attachments(owner_id,task_id,note_id,filename,mime_type,size_bytes,source_storage_path,metadata)
    values(actor,target_task,target_note,left(trim(payload->>'filename'),500),left(coalesce(nullif(payload->>'mime_type',''),'application/octet-stream'),255),
      greatest(0,(payload->>'size_bytes')::bigint),left(payload->>'source_storage_path',2000),coalesce(payload->'metadata','{}'::jsonb));
  elsif action='mark_accessed' then
    target:=(payload->>'id')::uuid;
    update public.task_attachments set last_accessed_at=now() where owner_id=actor and id=target;
  elsif action='archive_start' then
    target:=(payload->>'id')::uuid;
    update public.task_attachments set archive_status='archiving',archive_error='' where owner_id=actor and id=target and source_deleted_at is null;
    if not found then raise exception '找不到可封存附件'; end if;
  elsif action='archive_success' then
    target:=(payload->>'id')::uuid;
    if coalesce(payload->>'drive_file_id','')='' or coalesce(payload->>'drive_web_view_link','') not like 'https://%' or coalesce(payload->>'drive_path','')='' then
      raise exception 'Drive 驗證資料不完整，已保留原件';
    end if;
    update public.task_attachments set archive_status='archived',archive_error='',
      drive_file_id=left(payload->>'drive_file_id',1024),drive_web_view_link=left(payload->>'drive_web_view_link',5000),
      drive_path=left(payload->>'drive_path',2000),archived_at=now(),last_accessed_at=now()
    where owner_id=actor and id=target;
    if not found then raise exception '找不到附件'; end if;
  elsif action='archive_source_deleted' then
    target:=(payload->>'id')::uuid;
    update public.task_attachments set source_deleted_at=now() where owner_id=actor and id=target and archive_status='archived' and drive_file_id is not null;
    if not found then raise exception 'Drive 尚未驗證，不能刪除原件'; end if;
  elsif action='archive_failure' then
    target:=(payload->>'id')::uuid;
    update public.task_attachments set archive_status='failed',archive_error=left(coalesce(payload->>'message','封存失敗'),2000) where owner_id=actor and id=target returning * into attachment;
    if attachment.id is null then raise exception '找不到附件'; end if;
    insert into public.notifications(owner_id,type,title,body,task_id,dedupe_key)
    values(actor,'archive_failure','附件封存失敗',attachment.filename||'：'||attachment.archive_error,attachment.task_id,'archive-failure:'||attachment.id::text||':'||to_char(now(),'YYYY-MM-DD-HH24'))
    on conflict(owner_id,dedupe_key) do update set body=excluded.body,read_at=null,created_at=now();
  elsif action='record_capacity' then
    service_name:=payload->>'service';
    insert into public.capacity_snapshots(owner_id,service,used_bytes,limit_bytes,used_percent)
    values(actor,service_name,(payload->>'used_bytes')::bigint,nullif(payload->>'limit_bytes','')::bigint,nullif(payload->>'used_percent','')::numeric);
    percent:=nullif(payload->>'used_percent','')::numeric;
    if percent is not null and percent>=70 then
      insert into public.notifications(owner_id,type,title,body,dedupe_key)
      values(actor,'system','儲存空間接近上限',service_name||' 已使用 '||round(percent,1)||'%，請檢查封存與清理。','capacity:'||service_name||':'||to_char(now(),'YYYY-MM-DD'))
      on conflict(owner_id,dedupe_key) do update set body=excluded.body,read_at=null,created_at=now();
    end if;
  elsif action='record_backup' then
    backup_status:=case when payload->>'status'='completed' then 'completed' else 'failed' end;
    insert into public.metadata_backups(owner_id,drive_file_id,drive_web_view_link,drive_path,record_count,status,error)
    values(actor,nullif(payload->>'drive_file_id',''),nullif(payload->>'drive_web_view_link',''),nullif(payload->>'drive_path',''),
      greatest(0,coalesce((payload->>'record_count')::integer,0)),backup_status,left(coalesce(payload->>'error',''),2000));
    if backup_status='failed' then
      insert into public.notifications(owner_id,type,title,body,dedupe_key)
      values(actor,'archive_failure','Metadata backup 失敗',left(coalesce(payload->>'error','請稍後重試'),5000),'backup-failure:'||to_char(now(),'YYYY-MM-DD'))
      on conflict(owner_id,dedupe_key) do update set body=excluded.body,read_at=null,created_at=now();
    end if;
  elsif action<>'load' then
    raise exception '未知附件操作';
  end if;
  return public.attachment_state();
end $$;

create function public.archive_search(search_text text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'result_type','attachment','matched_field','attachments','result_id',a.id,'result_title',a.filename,
    'snippet',t.title||' · '||coalesce(a.drive_path,a.source_storage_path)||' · '||a.created_at::date,
    'task_id',a.task_id,'note_id',a.note_id,'conversation_id',null,'summary_id',null,'attachment_id',a.id,'occurred_at',a.created_at
  ) order by a.created_at desc),'[]'::jsonb)
  from public.task_attachments a join public.tasks t on t.id=a.task_id and t.owner_id=a.owner_id
  where a.owner_id=auth.uid() and lower(a.filename||' '||t.title||' '||a.created_at::text||' '||a.metadata::text||' '||coalesce(a.drive_path,'')) like '%'||lower(trim(coalesce(search_text,'')))||'%'
$$;

create function public.maintenance_metrics() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'database_bytes',pg_database_size(current_database()),
    'attachment_bytes',coalesce((select sum(size_bytes) from public.task_attachments where owner_id=auth.uid() and source_deleted_at is null),0),
    'attachment_count',(select count(*) from public.task_attachments where owner_id=auth.uid()),
    'record_count',
      (select count(*) from public.tasks where owner_id=auth.uid())+
      (select count(*) from public.task_notes where owner_id=auth.uid())+
      (select count(*) from public.ai_summaries where owner_id=auth.uid())+
      (select count(*) from public.task_attachments where owner_id=auth.uid())
  )
$$;

create function public.maintenance_export() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'schema_version','PersonalWorkStation-V1',
    'exported_at',now(),
    'tasks',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by created_at) from public.tasks x where owner_id=auth.uid()),'[]'::jsonb),
    'tags',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id') from public.task_tags x where owner_id=auth.uid()),'[]'::jsonb),
    'checklist',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by task_id,position) from public.checklist_items x where owner_id=auth.uid()),'[]'::jsonb),
    'notes',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by created_at) from public.task_notes x where owner_id=auth.uid()),'[]'::jsonb),
    'relations',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id') from public.task_relations x where owner_id=auth.uid()),'[]'::jsonb),
    'status_history',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by changed_at) from public.task_status_history x where owner_id=auth.uid()),'[]'::jsonb),
    'notifications',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by created_at) from public.notifications x where owner_id=auth.uid()),'[]'::jsonb),
    'summaries',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by created_at) from public.ai_summaries x where owner_id=auth.uid()),'[]'::jsonb),
    'attachments',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by created_at) from public.task_attachments x where owner_id=auth.uid()),'[]'::jsonb)
  )
$$;

revoke all on function public.attachment_state(),public.attachment_command(text,jsonb),public.archive_search(text),public.maintenance_metrics(),public.maintenance_export() from public;
grant execute on function public.attachment_command(text,jsonb),public.archive_search(text),public.maintenance_metrics(),public.maintenance_export() to authenticated;
