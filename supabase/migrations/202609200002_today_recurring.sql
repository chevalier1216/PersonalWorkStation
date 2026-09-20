-- M2 Today, notifications and recurring tasks. Apply after task_details.
alter table public.tasks
  add column recurrence_type text check (recurrence_type is null or recurrence_type in ('daily','weekly','monthly','custom')),
  add column recurrence_interval integer check (recurrence_interval is null or recurrence_interval between 1 and 365),
  add column recurrence_unit text check (recurrence_unit is null or recurrence_unit in ('day','week','month')),
  add column recurrence_source_id uuid,
  add foreign key(owner_id,recurrence_source_id) references public.tasks(owner_id,id) on delete set null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('recurring_created','task_unblocked','unscheduled_reminder','calendar_failure','archive_failure','holiday_reminder','system')),
  title text not null check (length(trim(title)) between 1 and 300),
  body text not null default '' check (length(body) <= 5000),
  task_id uuid,
  dedupe_key text not null check (length(dedupe_key) between 1 and 500),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(owner_id,task_id) references public.tasks(owner_id,id) on delete cascade,
  unique(owner_id,dedupe_key)
);

create table public.today_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  module_order text[] not null default array['tasks','notifications','holidays'],
  hidden_modules text[] not null default array[]::text[],
  updated_at timestamptz not null default now(),
  check (module_order <@ array['tasks','calendar','ai_chat','notifications','holidays']::text[]),
  check (hidden_modules <@ array['tasks','calendar','ai_chat','notifications','holidays']::text[])
);

create table public.calendar_days (
  region text not null check (region in ('CN','TW')),
  day date not null,
  day_type text not null check (day_type in ('holiday','workday')),
  name text not null,
  source_url text not null,
  fetched_at timestamptz not null default now(),
  primary key(region,day)
);

create table public.calendar_sync_runs (
  id bigint generated always as identity primary key,
  status text not null check (status in ('succeeded','failed')),
  row_count integer not null default 0,
  message text not null default '' check (length(message) <= 2000),
  created_at timestamptz not null default now()
);

create index on public.notifications(owner_id,created_at desc);
create index on public.tasks(owner_id,recurrence_source_id);
alter table public.notifications enable row level security;
alter table public.today_preferences enable row level security;
alter table public.calendar_days enable row level security;
alter table public.calendar_sync_runs enable row level security;
create policy own_notifications on public.notifications for select to authenticated using (owner_id=auth.uid() and public.is_allowed());
create policy own_today_preferences on public.today_preferences for select to authenticated using (owner_id=auth.uid() and public.is_allowed());
create policy calendar_days_read on public.calendar_days for select to authenticated using (public.is_allowed());
revoke all on public.notifications, public.today_preferences, public.calendar_days, public.calendar_sync_runs from anon, authenticated;
grant select on public.notifications, public.today_preferences, public.calendar_days to authenticated;

insert into public.calendar_days(region,day,day_type,name,source_url) values
  ('CN','2026-01-01','holiday','元旦','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-01-02','holiday','元旦','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-01-03','holiday','元旦','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-01-04','workday','元旦補班','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-02-14','workday','春節補班','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-02-15','holiday','春節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-02-16','holiday','春節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-02-17','holiday','春節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-02-18','holiday','春節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-02-19','holiday','春節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-02-20','holiday','春節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-02-21','holiday','春節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-02-22','holiday','春節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-02-23','holiday','春節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-02-28','workday','春節補班','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-04-04','holiday','清明節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-04-05','holiday','清明節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-04-06','holiday','清明節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-05-01','holiday','勞動節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-05-02','holiday','勞動節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-05-03','holiday','勞動節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-05-04','holiday','勞動節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-05-05','holiday','勞動節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-05-09','workday','勞動節補班','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-06-19','holiday','端午節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-06-20','holiday','端午節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-06-21','holiday','端午節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-09-20','workday','國慶節補班','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-09-25','holiday','中秋節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-09-26','holiday','中秋節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-09-27','holiday','中秋節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-10-01','holiday','國慶節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-10-02','holiday','國慶節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-10-03','holiday','國慶節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-10-04','holiday','國慶節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-10-05','holiday','國慶節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-10-06','holiday','國慶節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-10-07','holiday','國慶節','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('CN','2026-10-10','workday','國慶節補班','https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'),
  ('TW','2026-01-01','holiday','開國紀念日','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-02-14','holiday','農曆春節假期','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-02-15','holiday','農曆春節假期','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-02-16','holiday','農曆春節假期','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-02-17','holiday','農曆春節假期','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-02-18','holiday','農曆春節假期','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-02-19','holiday','農曆春節假期','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-02-20','holiday','農曆春節假期','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-02-21','holiday','農曆春節假期','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-02-22','holiday','農曆春節假期','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-02-27','holiday','和平紀念日補假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-02-28','holiday','和平紀念日','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-03-01','holiday','和平紀念日連假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-04-03','holiday','兒童節及清明節連假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-04-04','holiday','兒童節','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-04-05','holiday','清明節','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-04-06','holiday','清明節補假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-05-01','holiday','勞動節','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-05-02','holiday','勞動節連假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-05-03','holiday','勞動節連假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-06-19','holiday','端午節','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-06-20','holiday','端午節連假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-06-21','holiday','端午節連假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-09-25','holiday','中秋節','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-09-26','holiday','中秋節連假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-09-27','holiday','中秋節連假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-09-28','holiday','教師節','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-10-09','holiday','國慶日補假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-10-10','holiday','國慶日','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-10-11','holiday','國慶日連假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-10-24','holiday','臺灣光復紀念日連假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-10-25','holiday','臺灣光復紀念日','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-10-26','holiday','臺灣光復紀念日補假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-12-25','holiday','行憲紀念日','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-12-26','holiday','行憲紀念日連假','https://www.dgpa.gov.tw/information?pid=12685&uid=55'),
  ('TW','2026-12-27','holiday','行憲紀念日連假','https://www.dgpa.gov.tw/information?pid=12685&uid=55')
on conflict(region,day) do update set day_type=excluded.day_type,name=excluded.name,source_url=excluded.source_url,fetched_at=now();

create function public.replace_calendar_days(target_year integer, new_days jsonb) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; inserted_count integer:=0; region_count integer;
begin
  if jsonb_typeof(new_days)<>'array' then raise exception 'new_days must be an array'; end if;
  select count(distinct value->>'region') into region_count from jsonb_array_elements(new_days);
  if region_count<>2 or jsonb_array_length(new_days)<45 then raise exception 'calendar payload is incomplete'; end if;
  if exists(select 1 from jsonb_array_elements(new_days) value where (value->>'day')::date < make_date(target_year,1,1)
    or (value->>'day')::date > make_date(target_year,12,31) or value->>'region' not in ('CN','TW')
    or value->>'day_type' not in ('holiday','workday')) then raise exception 'calendar payload is invalid'; end if;
  delete from public.calendar_days where extract(year from day)=target_year and region in ('CN','TW');
  for item in select value from jsonb_array_elements(new_days) loop
    insert into public.calendar_days(region,day,day_type,name,source_url,fetched_at)
    values(item->>'region',(item->>'day')::date,item->>'day_type',item->>'name',item->>'source_url',now());
    inserted_count:=inserted_count+1;
  end loop;
  insert into public.calendar_sync_runs(status,row_count,message) values('succeeded',inserted_count,'Official sources refreshed');
  return inserted_count;
end $$;

create function public.record_calendar_sync_failure(failure_message text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.calendar_sync_runs(status,message) values('failed',left(failure_message,2000));
  insert into public.notifications(owner_id,type,title,body,dedupe_key)
    select user_id,'calendar_failure','官方行事曆同步失敗',left(failure_message,5000),'calendar-failure:'||to_char(now() at time zone 'Asia/Taipei','YYYY-MM-DD')
    from public.allowed_users on conflict(owner_id,dedupe_key) do nothing;
end $$;

revoke all on function public.replace_calendar_days(integer,jsonb), public.record_calendar_sync_failure(text) from public;
grant execute on function public.replace_calendar_days(integer,jsonb), public.record_calendar_sync_failure(text) to service_role;

create function public.next_recurrence_date(rule_type text, rule_interval integer, rule_unit text, base_date date) returns date
language plpgsql immutable set search_path=public,pg_temp as $$
declare amount integer := greatest(coalesce(rule_interval,1),1);
begin
  if rule_type='daily' then return base_date + amount;
  elsif rule_type='weekly' then return base_date + (7*amount);
  elsif rule_type='monthly' then return (base_date + make_interval(months=>amount))::date;
  elsif rule_type='custom' and rule_unit='day' then return base_date + amount;
  elsif rule_type='custom' and rule_unit='week' then return base_date + (7*amount);
  elsif rule_type='custom' and rule_unit='month' then return (base_date + make_interval(months=>amount))::date;
  end if;
  return null;
end $$;

create function public.create_next_recurring_task() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare todo_column uuid; next_id uuid; base_date date; next_date date; day_delta integer;
begin
  if old.completed_at is null and new.completed_at is not null and new.recurrence_type is not null
     and not exists(select 1 from public.tasks where recurrence_source_id=new.id) then
    base_date := coalesce(new.due_at::date,new.start_date,(new.completed_at at time zone 'Asia/Taipei')::date);
    next_date := public.next_recurrence_date(new.recurrence_type,new.recurrence_interval,new.recurrence_unit,base_date);
    day_delta := next_date-base_date;
    select id into todo_column from public.board_columns where owner_id=new.owner_id and kind='todo' order by position limit 1;
    insert into public.tasks(owner_id,column_id,title,description,priority,due_at,start_date,estimated_minutes,position,recurrence_type,recurrence_interval,recurrence_unit,recurrence_source_id)
    values(new.owner_id,todo_column,new.title,new.description,new.priority,
      case when new.due_at is null then null else new.due_at + make_interval(days=>day_delta) end,
      case when new.start_date is null then null else new.start_date + day_delta end,new.estimated_minutes,
      (select coalesce(max(position),-1)+1 from public.tasks where owner_id=new.owner_id and column_id=todo_column),
      new.recurrence_type,new.recurrence_interval,new.recurrence_unit,new.id)
    returning id into next_id;
    insert into public.task_tags(owner_id,task_id,name,color)
      select owner_id,next_id,name,color from public.task_tags where owner_id=new.owner_id and task_id=new.id;
    insert into public.checklist_items(owner_id,task_id,title,due_date,completed,position)
      select owner_id,next_id,title,case when due_date is null then null else due_date+day_delta end,false,position
      from public.checklist_items where owner_id=new.owner_id and task_id=new.id;
    insert into public.notifications(owner_id,type,title,body,task_id,dedupe_key)
      values(new.owner_id,'recurring_created','已建立下一周期任務',new.title,next_id,'recurring:'||new.id::text);
  end if;
  if old.completed_at is null and new.completed_at is not null then
    insert into public.notifications(owner_id,type,title,body,task_id,dedupe_key)
      select r.owner_id,'task_unblocked','前置任務已完成',new.title,r.task_id,'unblocked:'||r.id::text||':'||new.id::text
      from public.task_relations r join public.tasks t on t.id=r.task_id and t.owner_id=r.owner_id
      where r.owner_id=new.owner_id and r.related_task_id=new.id and r.relation_type='prerequisite' and t.completed_at is null
      on conflict(owner_id,dedupe_key) do nothing;
  end if;
  return new;
end $$;
create trigger task_recurring_and_unblocked after update of column_id on public.tasks for each row execute function public.create_next_recurring_task();

create function public.create_unscheduled_reminder(target_owner uuid, moment timestamptz) returns void
language plpgsql set search_path=public,pg_temp as $$
declare local_day date:=(moment at time zone 'Asia/Taipei')::date;
begin
  if extract(hour from moment at time zone 'Asia/Taipei')>=15 and exists(
    select 1 from public.tasks t join public.board_columns c on c.id=t.column_id and c.owner_id=t.owner_id
    where t.owner_id=target_owner and c.kind<>'done' and t.due_at is null and t.priority in ('High','Urgent')) then
    insert into public.notifications(owner_id,type,title,body,dedupe_key)
      values(target_owner,'unscheduled_reminder','仍有重要任務未排程','請為 High／Urgent 任務設定日期。','unscheduled:'||local_day::text)
      on conflict(owner_id,dedupe_key) do nothing;
  end if;
end $$;

create function public.workspace_command(action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); base jsonb; target uuid; local_day date:=(now() at time zone 'Asia/Taipei')::date;
begin
  if actor is null or not public.is_allowed() then raise exception '此帳號尚未獲准使用工作臺' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext(actor::text));
  insert into public.today_preferences(owner_id) values(actor) on conflict(owner_id) do nothing;
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
    'calendar_days',coalesce((select jsonb_agg(to_jsonb(d) order by day) from public.calendar_days d where day between local_day-30 and local_day+400),'[]'::jsonb)
  );
end $$;
revoke all on function public.workspace_command(text,jsonb), public.next_recurrence_date(text,integer,text,date), public.create_next_recurring_task(), public.create_unscheduled_reminder(uuid,timestamptz) from public;
grant execute on function public.workspace_command(text,jsonb) to authenticated;
