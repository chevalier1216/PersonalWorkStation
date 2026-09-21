-- M4 AI conversations, message history and confirmation-gated actions.
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 300),
  openai_conversation_id text check (openai_conversation_id is null or length(openai_conversation_id) between 1 and 300),
  last_error text not null default '' check (length(last_error) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,id),
  unique(owner_id,openai_conversation_id)
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user','assistant','system')),
  content text not null check (length(trim(content)) between 1 and 50000),
  created_at timestamptz not null default now(),
  foreign key(owner_id,conversation_id) references public.ai_conversations(owner_id,id) on delete cascade
);

create table public.ai_pending_actions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  action_type text not null check (action_type in ('edit_task','delete_task','calendar_relation')),
  label text not null check (length(trim(label)) between 1 and 500),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','failed')),
  error text not null default '' check (length(error) <= 2000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key(owner_id,conversation_id) references public.ai_conversations(owner_id,id) on delete cascade
);

create index on public.ai_conversations(owner_id,updated_at desc);
create index on public.ai_messages(owner_id,conversation_id,created_at);
create index on public.ai_pending_actions(owner_id,conversation_id,status,created_at);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_pending_actions enable row level security;
create policy own_ai_conversations on public.ai_conversations for select to authenticated using (owner_id=auth.uid() and public.is_allowed());
create policy own_ai_messages on public.ai_messages for select to authenticated using (owner_id=auth.uid() and public.is_allowed());
create policy own_ai_pending_actions on public.ai_pending_actions for select to authenticated using (owner_id=auth.uid() and public.is_allowed());
revoke all on public.ai_conversations, public.ai_messages, public.ai_pending_actions from anon, authenticated;
grant select on public.ai_conversations, public.ai_messages, public.ai_pending_actions to authenticated;

create function public.ai_relevant_context(search_text text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  with terms as (
    select lower(term) term from regexp_split_to_table(coalesce(search_text,''),'\s+') term where length(term)>=2 limit 12
  ), relevant_tasks as (
    select t.* from public.tasks t
    where t.owner_id=auth.uid() and (
      not exists(select 1 from terms)
      or exists(select 1 from terms where position(term in lower(t.title||' '||t.description))>0)
      or exists(select 1 from public.task_notes n,terms where n.owner_id=t.owner_id and n.task_id=t.id and position(term in lower(n.content))>0)
    )
    order by t.completed_at nulls first,t.due_at nulls last,t.created_at desc limit 20
  )
  select jsonb_build_object(
    'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'priority',priority,
      'due_at',due_at,'start_date',start_date,'completed_at',completed_at)) from relevant_tasks),'[]'::jsonb),
    'notes',coalesce((select jsonb_agg(item order by created_at desc) from (
      select jsonb_build_object('task_id',n.task_id,'content',n.content,'created_at',n.created_at) item,n.created_at
      from public.task_notes n where n.owner_id=auth.uid() and n.task_id in (select id from relevant_tasks)
      order by n.created_at desc limit 30
    ) limited_notes),'[]'::jsonb),
    'calendar',coalesce((select jsonb_agg(item order by event_time) from (
      select jsonb_build_object('calendar_id',e.calendar_id,'event_id',e.event_id,'title',e.title,
        'start_at',e.start_at,'start_date',e.start_date,'all_day',e.all_day) item,
        coalesce(e.start_at,e.start_date::timestamptz) event_time
      from public.google_calendar_events e
      where e.owner_id=auth.uid() and coalesce(e.start_at,e.start_date::timestamptz)>=now()-interval '1 day'
      order by event_time limit 30
    ) limited_calendar),'[]'::jsonb),
    'calendars',coalesce((select jsonb_agg(jsonb_build_object('calendar_id',c.calendar_id,'summary',c.summary,'selected',c.selected)
      order by c.is_primary desc,c.summary) from public.google_calendars c where c.owner_id=auth.uid()),'[]'::jsonb)
  )
$$;

create function public.ai_command(action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor uuid:=auth.uid(); target uuid; conversation uuid; pending public.ai_pending_actions%rowtype; workspace jsonb;
  changes jsonb; edit_payload jsonb; current_task public.tasks%rowtype;
begin
  if actor is null or not public.is_allowed() then raise exception '此帳號尚未獲准使用工作臺' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext(actor::text));

  if action='create_conversation' then
    insert into public.ai_conversations(owner_id,title) values(actor,left(coalesce(nullif(trim(payload->>'title'),''),'新對話'),300)) returning id into conversation;
  elsif action='append_message' then
    conversation:=(payload->>'conversation_id')::uuid;
    if not exists(select 1 from public.ai_conversations where owner_id=actor and id=conversation) then raise exception '找不到對話'; end if;
    insert into public.ai_messages(owner_id,conversation_id,role,content)
      values(actor,conversation,case when payload->>'role' in ('assistant','system') then payload->>'role' else 'user' end,left(payload->>'content',50000));
    update public.ai_conversations set updated_at=now(),last_error='' where owner_id=actor and id=conversation;
  elsif action='set_openai_conversation' then
    conversation:=(payload->>'conversation_id')::uuid;
    update public.ai_conversations set openai_conversation_id=left(payload->>'openai_conversation_id',300),updated_at=now()
      where owner_id=actor and id=conversation;
  elsif action='record_failure' then
    conversation:=(payload->>'conversation_id')::uuid;
    update public.ai_conversations set last_error=left(coalesce(payload->>'message','AI 暫時無法使用'),2000),updated_at=now()
      where owner_id=actor and id=conversation;
    insert into public.notifications(owner_id,type,title,body,dedupe_key)
      values(actor,'system','AI 對話暫時失敗',left(coalesce(payload->>'message','請稍後重試'),5000),'ai-failure:'||conversation::text||':'||to_char(now(),'YYYY-MM-DD-HH24'))
      on conflict(owner_id,dedupe_key) do update set body=excluded.body,read_at=null,created_at=now();
  elsif action='create_pending_action' then
    conversation:=(payload->>'conversation_id')::uuid;
    if not exists(select 1 from public.ai_conversations where owner_id=actor and id=conversation) then raise exception '找不到對話'; end if;
    insert into public.ai_pending_actions(owner_id,conversation_id,action_type,label,payload)
      values(actor,conversation,payload->>'action_type',left(payload->>'label',500),payload->'action_payload');
  elsif action='create_task' then
    workspace:=public.workspace_command('create_task',payload);
  elsif action='resolve_action' then
    target:=(payload->>'id')::uuid;
    select * into pending from public.ai_pending_actions where owner_id=actor and id=target for update;
    if pending.id is null or pending.status<>'pending' then raise exception '待確認動作不存在或已處理'; end if;
    if coalesce((payload->>'confirm')::boolean,false)=false then
      update public.ai_pending_actions set status='cancelled',resolved_at=now() where owner_id=actor and id=target;
    elsif pending.action_type='edit_task' then
      changes:=coalesce(pending.payload->'changes','{}'::jsonb);
      select * into current_task from public.tasks
        where owner_id=actor and id=(pending.payload->>'id')::uuid for update;
      if current_task.id is null then raise exception '找不到任務，請重新整理'; end if;
      edit_payload:=jsonb_build_object(
        'id',current_task.id,
        'title',case when changes ? 'title' then changes->>'title' else current_task.title end,
        'description',case when changes ? 'description' then changes->>'description' else current_task.description end,
        'priority',case when changes ? 'priority' then changes->>'priority' else current_task.priority end,
        'due_at',case when changes ? 'due_at' then changes->>'due_at' else current_task.due_at::text end,
        'start_date',case when changes ? 'start_date' then changes->>'start_date' else current_task.start_date::text end,
        'estimated_minutes',case when changes ? 'estimated_minutes' then changes->>'estimated_minutes' else current_task.estimated_minutes::text end,
        'deliverable_type',case when changes ? 'deliverable_type' then changes->>'deliverable_type' else current_task.deliverable_type end,
        'deliverable_value',case when changes ? 'deliverable_value' then changes->>'deliverable_value' else current_task.deliverable_value end,
        'recurrence_type',case when changes ? 'recurrence_type' then changes->>'recurrence_type' else current_task.recurrence_type end,
        'recurrence_interval',case when changes ? 'recurrence_interval' then changes->>'recurrence_interval' else current_task.recurrence_interval::text end,
        'recurrence_unit',case when changes ? 'recurrence_unit' then changes->>'recurrence_unit' else current_task.recurrence_unit end
      );
      workspace:=public.workspace_command('edit_task',edit_payload);
      update public.ai_pending_actions set status='confirmed',resolved_at=now() where owner_id=actor and id=target;
    elsif pending.action_type='delete_task' then
      workspace:=public.workspace_command('delete_task',pending.payload);
      update public.ai_pending_actions set status='confirmed',resolved_at=now() where owner_id=actor and id=target;
    else
      update public.ai_pending_actions set status='confirmed',resolved_at=now() where owner_id=actor and id=target;
    end if;
  elsif action='context' then
    return public.ai_relevant_context(payload->>'query');
  elsif action<>'load' then
    raise exception '未知 AI 操作';
  end if;

  return jsonb_build_object(
    'conversations',coalesce((select jsonb_agg(to_jsonb(c)-'owner_id' order by updated_at desc) from public.ai_conversations c where owner_id=actor),'[]'::jsonb),
    'messages',coalesce((select jsonb_agg(to_jsonb(m)-'owner_id' order by created_at) from public.ai_messages m where owner_id=actor),'[]'::jsonb),
    'pending_actions',coalesce((select jsonb_agg(to_jsonb(a)-'owner_id' order by created_at) from public.ai_pending_actions a where owner_id=actor),'[]'::jsonb)
  );
end $$;

revoke all on function public.ai_relevant_context(text), public.ai_command(text,jsonb) from public;
grant execute on function public.ai_command(text,jsonb) to authenticated;

update public.today_preferences set module_order=array_append(module_order,'ai_chat'),updated_at=now()
where not ('ai_chat'=any(module_order));
