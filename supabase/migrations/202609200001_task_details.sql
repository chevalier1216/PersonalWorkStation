-- M1 task details. Apply after 202609190001_board.sql.
alter table public.tasks
  add column start_date date,
  add column estimated_minutes integer check (estimated_minutes between 1 and 525600),
  add column deliverable_type text check (deliverable_type is null or length(deliverable_type) <= 40),
  add column deliverable_value text check (deliverable_value is null or length(deliverable_value) <= 5000);

create table public.task_tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  task_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 40),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  foreign key(owner_id,task_id) references public.tasks(owner_id,id) on delete cascade,
  unique(owner_id,task_id,name)
);
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  task_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 300),
  completed boolean not null default false,
  due_date date,
  position integer not null,
  foreign key(owner_id,task_id) references public.tasks(owner_id,id) on delete cascade
);
create table public.task_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  task_id uuid not null,
  content text not null check (length(trim(content)) between 1 and 20000),
  created_at timestamptz not null default now(),
  foreign key(owner_id,task_id) references public.tasks(owner_id,id) on delete cascade
);
create table public.task_relations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  task_id uuid not null,
  related_task_id uuid not null,
  relation_type text not null check (relation_type in ('prerequisite','follow_up','related')),
  check (task_id <> related_task_id),
  foreign key(owner_id,task_id) references public.tasks(owner_id,id) on delete cascade,
  foreign key(owner_id,related_task_id) references public.tasks(owner_id,id) on delete cascade,
  unique(owner_id,task_id,related_task_id,relation_type)
);
create index on public.task_tags(owner_id,task_id);
create index on public.checklist_items(owner_id,task_id,position);
create index on public.task_notes(owner_id,task_id,created_at);
create index on public.task_relations(owner_id,task_id);
alter table public.task_tags enable row level security;
alter table public.checklist_items enable row level security;
alter table public.task_notes enable row level security;
alter table public.task_relations enable row level security;
create policy own_tags on public.task_tags for select to authenticated using (owner_id = auth.uid() and public.is_allowed());
create policy own_checklist on public.checklist_items for select to authenticated using (owner_id = auth.uid() and public.is_allowed());
create policy own_notes on public.task_notes for select to authenticated using (owner_id = auth.uid() and public.is_allowed());
create policy own_relations on public.task_relations for select to authenticated using (owner_id = auth.uid() and public.is_allowed());
revoke all on public.task_tags, public.checklist_items, public.task_notes, public.task_relations from anon, authenticated;
grant select on public.task_tags, public.checklist_items, public.task_notes, public.task_relations to authenticated;

create or replace function public.board_command(action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid(); target uuid; replacement uuid; target_kind text; replacement_kind text;
  task_column uuid; desired integer; total integer; old_position integer; result jsonb; relation text;
begin
  if actor is null or not public.is_allowed() then raise exception '此帳號尚未獲准使用工作臺' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext(actor::text));
  if not exists(select 1 from public.board_columns where owner_id = actor) then
    insert into public.board_columns(owner_id,title,kind,position) values (actor,'待辦','todo',0),(actor,'進行中','doing',1),(actor,'已完成','done',2);
  end if;
  if action = 'load' then null;
  elsif action = 'create_task' then
    select id into task_column from public.board_columns where owner_id = actor and kind = 'todo' order by position limit 1;
    insert into public.tasks(owner_id,column_id,title,description,priority,due_at,start_date,estimated_minutes,deliverable_type,deliverable_value,position)
    values(actor,task_column,trim(payload->>'title'),coalesce(payload->>'description',''),coalesce(payload->>'priority','Regular'),
      nullif(payload->>'due_at','')::timestamptz,nullif(payload->>'start_date','')::date,nullif(payload->>'estimated_minutes','')::integer,
      nullif(trim(payload->>'deliverable_type'),''),nullif(trim(payload->>'deliverable_value'),''),
      (select coalesce(max(position),-1)+1 from public.tasks where owner_id = actor and column_id = task_column));
  elsif action in ('edit_task','delete_task','move_task') then
    target := (payload->>'id')::uuid;
    select column_id,position into task_column,old_position from public.tasks where id = target and owner_id = actor;
    if not found then raise exception '找不到任務，請重新整理'; end if;
    if action = 'delete_task' then delete from public.tasks where id = target and owner_id = actor;
    elsif action = 'edit_task' then
      update public.tasks set title=trim(payload->>'title'),description=coalesce(payload->>'description',''),priority=payload->>'priority',
        due_at=nullif(payload->>'due_at','')::timestamptz,start_date=nullif(payload->>'start_date','')::date,
        estimated_minutes=nullif(payload->>'estimated_minutes','')::integer,
        deliverable_type=nullif(trim(payload->>'deliverable_type'),''),deliverable_value=nullif(trim(payload->>'deliverable_value'),'')
      where id=target and owner_id=actor;
    else
      replacement := (payload->>'column_id')::uuid;
      if not exists(select 1 from public.board_columns where id=replacement and owner_id=actor) then raise exception '找不到目標欄位'; end if;
      select count(*) into total from public.tasks where column_id=replacement and owner_id=actor and id<>target;
      desired := greatest(0,least(coalesce((payload->>'position')::integer,total),total));
      with ranked as (select id,row_number() over(order by position,created_at)-1 as p from public.tasks where column_id=replacement and owner_id=actor and id<>target)
      update public.tasks t set position=case when r.p>=desired then r.p+1 else r.p end from ranked r where t.id=r.id;
      update public.tasks set column_id=replacement,position=desired where id=target and owner_id=actor;
    end if;
    if action='delete_task' or (action='move_task' and task_column<>replacement) then
      with ranked as (select id,row_number() over(order by position,created_at)-1 as p from public.tasks where column_id=task_column and owner_id=actor)
      update public.tasks t set position=r.p from ranked r where t.id=r.id;
    end if;
  elsif action='create_column' then
    insert into public.board_columns(owner_id,title,kind,position) values(actor,trim(payload->>'title'),payload->>'kind',(select coalesce(max(position),-1)+1 from public.board_columns where owner_id=actor));
  elsif action in ('rename_column','move_column','delete_column') then
    target := (payload->>'id')::uuid;
    select kind,position into target_kind,old_position from public.board_columns where id=target and owner_id=actor;
    if not found then raise exception '找不到欄位，請重新整理'; end if;
    if action='rename_column' then update public.board_columns set title=trim(payload->>'title') where id=target and owner_id=actor;
    elsif action='move_column' then
      select count(*)-1 into total from public.board_columns where owner_id=actor;
      desired := greatest(0,least((payload->>'position')::integer,total));
      with ranked as (select id,row_number() over(order by position)-1 as p from public.board_columns where owner_id=actor and id<>target)
      update public.board_columns c set position=case when r.p>=desired then r.p+1 else r.p end from ranked r where c.id=r.id;
      update public.board_columns set position=desired where id=target and owner_id=actor;
    else
      replacement := (payload->>'replacement_id')::uuid;
      select kind into replacement_kind from public.board_columns where id=replacement and owner_id=actor and id<>target;
      if replacement_kind is null or replacement_kind<>target_kind then raise exception '請先選擇相同狀態的替代欄位，以保留任務語意'; end if;
      select coalesce(max(position),-1)+1 into total from public.tasks where column_id=replacement and owner_id=actor;
      update public.tasks set column_id=replacement,position=position+total where column_id=target and owner_id=actor;
      delete from public.board_columns where id=target and owner_id=actor;
      with ranked as (select id,row_number() over(order by position)-1 as p from public.board_columns where owner_id=actor)
      update public.board_columns c set position=r.p from ranked r where c.id=r.id;
    end if;
  elsif action in ('add_tag','remove_tag','add_checklist','toggle_checklist','delete_checklist','add_note','add_relation','remove_relation') then
    if action in ('remove_tag','toggle_checklist','delete_checklist','remove_relation') then target := (payload->>'id')::uuid;
    else target := (payload->>'task_id')::uuid; end if;
    if action in ('add_tag','add_checklist','add_note','add_relation') and not exists(select 1 from public.tasks where id=target and owner_id=actor) then
      raise exception '找不到任務，請重新整理';
    end if;
    if action='add_tag' then
      insert into public.task_tags(owner_id,task_id,name,color) values(actor,target,trim(payload->>'name'),payload->>'color');
    elsif action='remove_tag' then delete from public.task_tags where id=target and owner_id=actor;
    elsif action='add_checklist' then
      insert into public.checklist_items(owner_id,task_id,title,due_date,position) values(actor,target,trim(payload->>'title'),nullif(payload->>'due_date','')::date,
        (select coalesce(max(position),-1)+1 from public.checklist_items where owner_id=actor and task_id=target));
    elsif action='toggle_checklist' then update public.checklist_items set completed=(payload->>'completed')::boolean where id=target and owner_id=actor;
    elsif action='delete_checklist' then delete from public.checklist_items where id=target and owner_id=actor;
    elsif action='add_note' then insert into public.task_notes(owner_id,task_id,content) values(actor,target,trim(payload->>'content'));
    elsif action='add_relation' then
      replacement := (payload->>'related_task_id')::uuid; relation := payload->>'relation_type';
      if not exists(select 1 from public.tasks where id=replacement and owner_id=actor) then raise exception '找不到關聯任務'; end if;
      insert into public.task_relations(owner_id,task_id,related_task_id,relation_type) values(actor,target,replacement,relation);
    else delete from public.task_relations where id=target and owner_id=actor;
    end if;
  else raise exception '不支援的操作'; end if;
  select jsonb_build_object(
    'columns',coalesce((select jsonb_agg(to_jsonb(c)-'owner_id' order by position) from public.board_columns c where owner_id=actor),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(to_jsonb(t)-'owner_id' order by position,created_at) from public.tasks t where owner_id=actor),'[]'::jsonb),
    'tags',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by name) from public.task_tags x where owner_id=actor),'[]'::jsonb),
    'checklist',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by position) from public.checklist_items x where owner_id=actor),'[]'::jsonb),
    'notes',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by created_at desc) from public.task_notes x where owner_id=actor),'[]'::jsonb),
    'relations',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id') from public.task_relations x where owner_id=actor),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by changed_at) from public.task_status_history x where owner_id=actor),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.board_command(text,jsonb) from public;
grant execute on function public.board_command(text,jsonb) to authenticated;
