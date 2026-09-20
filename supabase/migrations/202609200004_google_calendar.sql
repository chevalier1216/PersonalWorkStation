-- M3 Google Calendar selections, cached events, task relations and failure isolation.
create table public.google_calendars (
  owner_id uuid not null references auth.users(id) on delete cascade,
  calendar_id text not null check (length(calendar_id) between 1 and 1024),
  summary text not null check (length(summary) between 1 and 500),
  color text not null default '#7895b2' check (length(color) <= 32),
  time_zone text not null default '' check (length(time_zone) <= 100),
  is_primary boolean not null default false,
  selected boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(owner_id,calendar_id)
);

create table public.google_calendar_events (
  owner_id uuid not null references auth.users(id) on delete cascade,
  calendar_id text not null,
  event_id text not null check (length(event_id) between 1 and 1024),
  title text not null check (length(title) between 1 and 2000),
  start_at timestamptz,
  end_at timestamptz,
  start_date date,
  end_date date,
  all_day boolean not null,
  html_link text not null default '' check (length(html_link) <= 5000 and (html_link='' or html_link like 'https://%')),
  status text not null default 'confirmed' check (status in ('confirmed','tentative')),
  updated_at timestamptz not null default now(),
  primary key(owner_id,calendar_id,event_id),
  foreign key(owner_id,calendar_id) references public.google_calendars(owner_id,calendar_id) on delete cascade,
  check ((all_day and start_date is not null and end_date is not null and start_at is null and end_at is null)
    or (not all_day and start_at is not null and end_at is not null and start_date is null and end_date is null))
);

create table public.task_calendar_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  calendar_id text not null check (length(calendar_id) between 1 and 1024),
  event_id text check (event_id is null or length(event_id) between 1 and 1024),
  html_link text not null default '' check (length(html_link) <= 5000 and (html_link='' or html_link like 'https://%')),
  sync_status text not null check (sync_status in ('synced','failed')),
  sync_error text not null default '' check (length(sync_error) <= 2000),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(owner_id,task_id) references public.tasks(owner_id,id) on delete cascade,
  unique(owner_id,task_id)
);

create table public.google_calendar_sync_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text not null default '' check (length(last_error) <= 2000)
);

create index on public.google_calendar_events(owner_id,start_at,start_date);
create index on public.task_calendar_links(owner_id,calendar_id,event_id);

alter table public.google_calendars enable row level security;
alter table public.google_calendar_events enable row level security;
alter table public.task_calendar_links enable row level security;
alter table public.google_calendar_sync_state enable row level security;

create policy own_google_calendars on public.google_calendars for select to authenticated
  using (owner_id=auth.uid() and public.is_allowed());
create policy own_google_calendar_events on public.google_calendar_events for select to authenticated
  using (owner_id=auth.uid() and public.is_allowed());
create policy own_task_calendar_links on public.task_calendar_links for select to authenticated
  using (owner_id=auth.uid() and public.is_allowed());
create policy own_google_calendar_sync_state on public.google_calendar_sync_state for select to authenticated
  using (owner_id=auth.uid() and public.is_allowed());

revoke all on public.google_calendars, public.google_calendar_events, public.task_calendar_links, public.google_calendar_sync_state from anon, authenticated;
grant select on public.google_calendars, public.google_calendar_events, public.task_calendar_links, public.google_calendar_sync_state to authenticated;

create or replace function public.workspace_command(action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); base jsonb; target uuid; item jsonb; local_day date:=(now() at time zone 'Asia/Taipei')::date;
begin
  if actor is null or not public.is_allowed() then raise exception '此帳號尚未獲准使用工作臺' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext(actor::text));
  insert into public.today_preferences(owner_id) values(actor) on conflict(owner_id) do nothing;
  insert into public.google_calendar_sync_state(owner_id) values(actor) on conflict(owner_id) do nothing;

  if action='mark_notification_read' then
    update public.notifications set read_at=coalesce(read_at,now()) where owner_id=actor and id=(payload->>'id')::uuid;
    base:=public.board_command('load','{}'::jsonb);
  elsif action='mark_all_notifications_read' then
    update public.notifications set read_at=coalesce(read_at,now()) where owner_id=actor and read_at is null;
    base:=public.board_command('load','{}'::jsonb);
  elsif action='save_today_preferences' then
    update public.today_preferences set module_order=array(select jsonb_array_elements_text(payload->'module_order')),
      hidden_modules=array(select jsonb_array_elements_text(payload->'hidden_modules')),updated_at=now() where owner_id=actor;
    base:=public.board_command('load','{}'::jsonb);
  elsif action='calendar_set_selections' then
    update public.google_calendars set selected=calendar_id in (select jsonb_array_elements_text(coalesce(payload->'calendar_ids','[]'::jsonb))),updated_at=now()
      where owner_id=actor;
    base:=public.board_command('load','{}'::jsonb);
  elsif action='calendar_sync_success' then
    for item in select value from jsonb_array_elements(coalesce(payload->'calendars','[]'::jsonb)) loop
      insert into public.google_calendars(owner_id,calendar_id,summary,color,time_zone,is_primary,selected,updated_at)
      values(actor,item->>'id',left(coalesce(nullif(item->>'summary',''),'未命名 Calendar'),500),left(coalesce(item->>'color','#7895b2'),32),
        left(coalesce(item->>'time_zone',''),100),coalesce((item->>'is_primary')::boolean,false),coalesce((item->>'selected')::boolean,false),now())
      on conflict(owner_id,calendar_id) do update set summary=excluded.summary,color=excluded.color,time_zone=excluded.time_zone,
        is_primary=excluded.is_primary,selected=excluded.selected,updated_at=now();
    end loop;
    delete from public.google_calendar_events where owner_id=actor;
    for item in select value from jsonb_array_elements(coalesce(payload->'events','[]'::jsonb)) loop
      insert into public.google_calendar_events(owner_id,calendar_id,event_id,title,start_at,end_at,start_date,end_date,all_day,html_link,status,updated_at)
      values(actor,item->>'calendar_id',item->>'event_id',left(coalesce(nullif(item->>'title',''),'(無標題)'),2000),
        nullif(item->>'start_at','')::timestamptz,nullif(item->>'end_at','')::timestamptz,nullif(item->>'start_date','')::date,
        nullif(item->>'end_date','')::date,(item->>'all_day')::boolean,left(coalesce(item->>'html_link',''),5000),
        case when item->>'status'='tentative' then 'tentative' else 'confirmed' end,now());
    end loop;
    update public.google_calendar_sync_state set last_attempt_at=now(),last_success_at=now(),last_error='' where owner_id=actor;
    base:=public.board_command('load','{}'::jsonb);
  elsif action='calendar_sync_failure' then
    update public.google_calendar_sync_state set last_attempt_at=now(),last_error=left(coalesce(payload->>'message','同步失敗'),2000) where owner_id=actor;
    insert into public.notifications(owner_id,type,title,body,dedupe_key)
      values(actor,'calendar_failure','Google Calendar 同步失敗',left(coalesce(payload->>'message','請稍後重試'),5000),'google-calendar-sync:'||local_day::text)
      on conflict(owner_id,dedupe_key) do update set body=excluded.body,read_at=null,created_at=now();
    base:=public.board_command('load','{}'::jsonb);
  elsif action='calendar_link_success' then
    target:=(payload->>'task_id')::uuid;
    if not exists(select 1 from public.tasks where owner_id=actor and id=target) then raise exception '找不到任務'; end if;
    insert into public.task_calendar_links(owner_id,task_id,calendar_id,event_id,html_link,sync_status,sync_error,last_synced_at)
      values(actor,target,payload->>'calendar_id',payload->>'event_id',left(coalesce(payload->>'html_link',''),5000),'synced','',now())
      on conflict(owner_id,task_id) do update set calendar_id=excluded.calendar_id,event_id=excluded.event_id,html_link=excluded.html_link,
        sync_status='synced',sync_error='',last_synced_at=now();
    base:=public.board_command('load','{}'::jsonb);
  elsif action='calendar_link_failure' then
    target:=(payload->>'task_id')::uuid;
    if not exists(select 1 from public.tasks where owner_id=actor and id=target) then raise exception '找不到任務'; end if;
    insert into public.task_calendar_links(owner_id,task_id,calendar_id,event_id,html_link,sync_status,sync_error,last_synced_at)
      values(actor,target,payload->>'calendar_id',null,'','failed',left(coalesce(payload->>'message','建立事件失敗'),2000),null)
      on conflict(owner_id,task_id) do update set calendar_id=excluded.calendar_id,sync_status='failed',sync_error=excluded.sync_error;
    insert into public.notifications(owner_id,type,title,body,task_id,dedupe_key)
      values(actor,'calendar_failure','Task 行事曆同步失敗',left(coalesce(payload->>'message','請稍後重試'),5000),target,
        'google-calendar-task:'||target::text||':'||local_day::text)
      on conflict(owner_id,dedupe_key) do update set body=excluded.body,read_at=null,created_at=now();
    base:=public.board_command('load','{}'::jsonb);
  elsif action='edit_task' then
    base:=public.board_command(action,payload);
    target:=(payload->>'id')::uuid;
    update public.tasks set recurrence_type=nullif(payload->>'recurrence_type',''),
      recurrence_interval=case when nullif(payload->>'recurrence_type','') is null then null else greatest(coalesce(nullif(payload->>'recurrence_interval','')::integer,1),1) end,
      recurrence_unit=case when payload->>'recurrence_type'='custom' then nullif(payload->>'recurrence_unit','') else null end
      where owner_id=actor and id=target;
    base:=public.board_command('load','{}'::jsonb);
  else
    base:=public.board_command(action,payload);
  end if;

  perform public.create_unscheduled_reminder(actor,now());
  return base || jsonb_build_object(
    'notifications',coalesce((select jsonb_agg(to_jsonb(n)-'owner_id' order by created_at desc) from public.notifications n where owner_id=actor),'[]'::jsonb),
    'preferences',(select to_jsonb(p)-'owner_id' from public.today_preferences p where owner_id=actor),
    'calendar_days',coalesce((select jsonb_agg(to_jsonb(d) order by day) from public.calendar_days d where day between local_day-30 and local_day+400),'[]'::jsonb),
    'google_calendars',coalesce((select jsonb_agg(to_jsonb(c)-'owner_id' order by is_primary desc,summary) from public.google_calendars c where owner_id=actor),'[]'::jsonb),
    'google_events',coalesce((select jsonb_agg(to_jsonb(e)-'owner_id' order by coalesce(start_at,start_date::timestamptz)) from public.google_calendar_events e where owner_id=actor),'[]'::jsonb),
    'task_calendar_links',coalesce((select jsonb_agg(to_jsonb(l)-'owner_id' order by created_at) from public.task_calendar_links l where owner_id=actor),'[]'::jsonb),
    'google_calendar_sync',(select to_jsonb(s)-'owner_id' from public.google_calendar_sync_state s where owner_id=actor)
  );
end $$;

revoke all on function public.workspace_command(text,jsonb) from public;
grant execute on function public.workspace_command(text,jsonb) to authenticated;

update public.today_preferences
set module_order=array_append(module_order,'calendar'),updated_at=now()
where not ('calendar'=any(module_order));
