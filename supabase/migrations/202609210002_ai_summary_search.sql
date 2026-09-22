create table public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  previous_summary_id uuid references public.ai_summaries(id) on delete set null,
  latest_summary_id uuid references public.ai_summaries(id) on delete set null,
  version_label text not null,
  title text not null check (length(trim(title)) between 1 and 300),
  decisions text[] not null default '{}',
  completed text[] not null default '{}',
  cancelled text[] not null default '{}',
  superseded text[] not null default '{}',
  content text not null check (length(content) between 1 and 50000),
  created_at timestamptz not null default now(),
  unique(owner_id,task_id,version_label)
);
create index ai_summaries_owner_task_created_idx on public.ai_summaries(owner_id,task_id,created_at desc);
alter table public.ai_summaries enable row level security;
create policy own_ai_summaries on public.ai_summaries for select to authenticated
  using (owner_id=auth.uid() and public.is_allowed());
revoke all on public.ai_summaries from anon,authenticated;
grant select on public.ai_summaries to authenticated;

create function public.summary_state() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('summaries',coalesce(jsonb_agg(to_jsonb(s)-'owner_id' order by s.created_at desc),'[]'::jsonb))
  from public.ai_summaries s where s.owner_id=auth.uid()
$$;

create function public.summary_context(target_task uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
  if actor is null or not public.is_allowed() then raise exception '此帳號尚未獲准使用工作臺' using errcode='42501'; end if;
  if not exists(select 1 from public.tasks where owner_id=actor and id=target_task) then raise exception '找不到任務'; end if;
  select jsonb_build_object(
    'task',to_jsonb(t)-'owner_id',
    'notes',coalesce((select jsonb_agg(to_jsonb(n)-'owner_id' order by n.created_at) from public.task_notes n where n.owner_id=actor and n.task_id=t.id),'[]'::jsonb),
    'checklist',coalesce((select jsonb_agg(to_jsonb(c)-'owner_id' order by c.position) from public.checklist_items c where c.owner_id=actor and c.task_id=t.id),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h)-'owner_id' order by h.changed_at) from public.task_status_history h where h.owner_id=actor and h.task_id=t.id),'[]'::jsonb),
    'previous_summary',(select to_jsonb(s)-'owner_id' from public.ai_summaries s where s.owner_id=actor and s.task_id=t.id order by s.created_at desc limit 1)
  ) into result from public.tasks t where t.owner_id=actor and t.id=target_task;
  return result;
end $$;

create function public.summary_command(action text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); target_task uuid; previous uuid; created uuid; base_label text; next_label text; suffix integer;
begin
  if actor is null or not public.is_allowed() then raise exception '此帳號尚未獲准使用工作臺' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext(actor::text));
  if action='create' then
    target_task:=(payload->>'task_id')::uuid;
    if not exists(select 1 from public.tasks where owner_id=actor and id=target_task) then raise exception '找不到任務'; end if;
    select id into previous from public.ai_summaries where owner_id=actor and task_id=target_task order by created_at desc limit 1;
    base_label:='v.'||to_char(clock_timestamp() at time zone 'Asia/Taipei','YY.MM.DD.HH24MI');
    select count(*)::integer into suffix from public.ai_summaries where owner_id=actor and task_id=target_task and version_label like base_label||'%';
    next_label:=base_label||case when suffix=0 then '' else '-'||(suffix+1)::text end;
    insert into public.ai_summaries(owner_id,task_id,previous_summary_id,version_label,title,decisions,completed,cancelled,superseded,content)
    values(actor,target_task,previous,next_label,left(trim(payload->>'title'),300),
      coalesce(array(select jsonb_array_elements_text(coalesce(payload->'decisions','[]'::jsonb))),'{}'),
      coalesce(array(select jsonb_array_elements_text(coalesce(payload->'completed','[]'::jsonb))),'{}'),
      coalesce(array(select jsonb_array_elements_text(coalesce(payload->'cancelled','[]'::jsonb))),'{}'),
      coalesce(array(select jsonb_array_elements_text(coalesce(payload->'superseded','[]'::jsonb))),'{}'),
      left(payload->>'content',50000)) returning id into created;
    update public.ai_summaries set latest_summary_id=created where owner_id=actor and task_id=target_task and id<>created;
  elsif action='record_failure' then
    target_task:=(payload->>'task_id')::uuid;
    insert into public.notifications(owner_id,type,title,body,task_id,dedupe_key)
    values(actor,'system','AI Summary 暫時失敗',left(coalesce(payload->>'message','請稍後重試'),5000),target_task,
      'summary-failure:'||target_task::text||':'||to_char(now(),'YYYY-MM-DD-HH24'))
    on conflict(owner_id,dedupe_key) do update set body=excluded.body,read_at=null,created_at=now();
  elsif action<>'load' then
    raise exception '未知 Summary 操作';
  end if;
  return public.summary_state();
end $$;

create function public.history_search(search_text text,search_field text default 'all') returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
with params as (
  select '%'||lower(trim(coalesce(search_text,'')))||'%' pattern,
    case when search_field in ('all','title','description','notes','deliverable','tags','priority','status','date','calendar','summary') then search_field else 'all' end field
), sources as (
  select 'task'::text result_type,'title'::text matched_field,t.id::text result_id,t.title result_title,t.title snippet,t.id task_id,null::uuid note_id,null::uuid conversation_id,null::uuid summary_id,t.created_at occurred_at
  from public.tasks t,params p where t.owner_id=auth.uid() and p.field in ('all','title') and lower(t.title) like p.pattern
  union all select 'task','description',t.id::text,t.title,left(t.description,500),t.id,null,null,null,t.created_at from public.tasks t,params p where t.owner_id=auth.uid() and p.field in ('all','description') and lower(t.description) like p.pattern
  union all select 'note','notes',n.id::text,t.title,left(n.content,500),t.id,n.id,null,null,n.created_at from public.task_notes n join public.tasks t on t.id=n.task_id and t.owner_id=n.owner_id,params p where n.owner_id=auth.uid() and p.field in ('all','notes') and lower(n.content) like p.pattern
  union all select 'task','deliverable',t.id::text,t.title,left(coalesce(t.deliverable_type||' ','')||coalesce(t.deliverable_value,''),500),t.id,null,null,null,t.created_at from public.tasks t,params p where t.owner_id=auth.uid() and p.field in ('all','deliverable') and lower(coalesce(t.deliverable_type||' ','')||coalesce(t.deliverable_value,'')) like p.pattern
  union all select 'task','tags',t.id::text,t.title,g.name,t.id,null,null,null,t.created_at from public.task_tags g join public.tasks t on t.id=g.task_id and t.owner_id=g.owner_id,params p where g.owner_id=auth.uid() and p.field in ('all','tags') and lower(g.name) like p.pattern
  union all select 'task','priority',t.id::text,t.title,t.priority,t.id,null,null,null,t.created_at from public.tasks t,params p where t.owner_id=auth.uid() and p.field in ('all','priority') and lower(t.priority) like p.pattern
  union all select 'task','status',t.id::text,t.title,c.title||' / '||c.kind,t.id,null,null,null,t.created_at from public.tasks t join public.board_columns c on c.id=t.column_id and c.owner_id=t.owner_id,params p where t.owner_id=auth.uid() and p.field in ('all','status') and lower(c.title||' '||c.kind) like p.pattern
  union all select 'task','date',t.id::text,t.title,concat_ws(' · ',t.start_date::text,t.due_at::text,t.completed_at::text),t.id,null,null,null,t.created_at from public.tasks t,params p where t.owner_id=auth.uid() and p.field in ('all','date') and lower(concat_ws(' ',t.start_date::text,t.due_at::text,t.completed_at::text)) like p.pattern
  union all select 'task','calendar',t.id::text,t.title,coalesce(c.summary,l.calendar_id)||case when l.html_link<>'' then ' · '||l.html_link else '' end,t.id,null,null,null,l.created_at from public.task_calendar_links l join public.tasks t on t.id=l.task_id and t.owner_id=l.owner_id left join public.google_calendars c on c.owner_id=l.owner_id and c.calendar_id=l.calendar_id,params p where l.owner_id=auth.uid() and p.field in ('all','calendar') and lower(coalesce(c.summary,'')||' '||l.calendar_id||' '||coalesce(l.html_link,'')) like p.pattern
  union all select 'summary','summary',s.id::text,s.title,left(s.version_label||' · '||s.content,500),s.task_id,null,null,s.id,s.created_at from public.ai_summaries s,params p where s.owner_id=auth.uid() and p.field in ('all','summary') and lower(s.title||' '||s.content||' '||array_to_string(s.decisions,' ')||' '||array_to_string(s.completed,' ')) like p.pattern
)
select coalesce(jsonb_agg(to_jsonb(s) order by occurred_at desc),'[]'::jsonb) from (select * from sources order by occurred_at desc limit 100) s
$$;

revoke all on function public.summary_state(),public.summary_context(uuid),public.summary_command(text,jsonb),public.history_search(text,text) from public;
grant execute on function public.summary_context(uuid),public.summary_command(text,jsonb),public.history_search(text,text) to authenticated;
