-- Run once with the Supabase migration owner, never with a browser key.
create table public.allowed_users (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.allowed_users enable row level security;
revoke all on public.allowed_users from anon, authenticated;

create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 80),
  kind text not null check (kind in ('todo','doing','done')),
  position integer not null,
  unique(owner_id,id)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  column_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 300),
  description text not null default '' check (length(description) <= 20000),
  priority text not null default 'Regular' check (priority in ('Regular','High','Urgent')),
  due_at timestamptz,
  position integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(owner_id,column_id) references public.board_columns(owner_id,id),
  unique(owner_id,id)
);
create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  task_id uuid not null,
  from_kind text,
  to_kind text not null,
  changed_at timestamptz not null default now(),
  foreign key(owner_id,task_id) references public.tasks(owner_id,id) on delete cascade
);
create index on public.tasks(owner_id,column_id,position);
create index on public.task_status_history(owner_id,task_id,changed_at);
alter table public.board_columns enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

create function public.is_allowed() returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.allowed_users where user_id = auth.uid());
$$;
revoke all on function public.is_allowed() from public;
grant execute on function public.is_allowed() to authenticated;
create policy own_columns on public.board_columns for select to authenticated using (owner_id = auth.uid() and public.is_allowed());
create policy own_tasks on public.tasks for select to authenticated using (owner_id = auth.uid() and public.is_allowed());
create policy own_history on public.task_status_history for select to authenticated using (owner_id = auth.uid() and public.is_allowed());
revoke all on public.board_columns, public.tasks, public.task_status_history from anon, authenticated;
grant select on public.board_columns, public.tasks, public.task_status_history to authenticated;

create function public.track_task_status() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare previous_kind text; next_kind text;
begin
  select kind into next_kind from public.board_columns where id = new.column_id;
  if tg_op = 'UPDATE' then
    select kind into previous_kind from public.board_columns where id = old.column_id;
  end if;
  if previous_kind is distinct from next_kind then
    new.completed_at := case when next_kind = 'done' then now() else null end;
  end if;
  return new;
end $$;
create trigger task_completion before insert or update on public.tasks for each row execute function public.track_task_status();
create function public.record_task_status() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare previous_kind text; next_kind text;
begin
  select kind into next_kind from public.board_columns where id = new.column_id;
  if tg_op = 'UPDATE' then select kind into previous_kind from public.board_columns where id = old.column_id; end if;
  if previous_kind is distinct from next_kind then
    insert into public.task_status_history(owner_id,task_id,from_kind,to_kind) values(new.owner_id,new.id,previous_kind,next_kind);
  end if;
  return new;
end $$;
create trigger task_history after insert or update on public.tasks for each row execute function public.record_task_status();

create function public.board_command(action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid(); target uuid; replacement uuid; target_kind text; replacement_kind text;
  task_column uuid; desired integer; total integer; old_position integer; result jsonb;
begin
  if actor is null or not public.is_allowed() then raise exception '此帳號尚未獲准使用工作臺' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext(actor::text));
  if not exists(select 1 from public.board_columns where owner_id = actor) then
    insert into public.board_columns(owner_id,title,kind,position) values (actor,'待辦','todo',0),(actor,'進行中','doing',1),(actor,'已完成','done',2);
  end if;
  if action = 'load' then null;
  elsif action = 'create_task' then
    select id into task_column from public.board_columns where owner_id = actor and kind = 'todo' order by position limit 1;
    insert into public.tasks(owner_id,column_id,title,description,priority,due_at,position)
    values(actor,task_column,trim(payload->>'title'),coalesce(payload->>'description',''),coalesce(payload->>'priority','Regular'),(payload->>'due_at')::timestamptz,
      (select coalesce(max(position),-1)+1 from public.tasks where owner_id = actor and column_id = task_column));
  elsif action in ('edit_task','delete_task','move_task') then
    target := (payload->>'id')::uuid;
    select column_id,position into task_column,old_position from public.tasks where id = target and owner_id = actor;
    if not found then raise exception '找不到任務，請重新整理'; end if;
    if action = 'delete_task' then delete from public.tasks where id = target and owner_id = actor;
    elsif action = 'edit_task' then
      update public.tasks set title=trim(payload->>'title'),description=coalesce(payload->>'description',''),priority=payload->>'priority',due_at=(payload->>'due_at')::timestamptz where id=target and owner_id=actor;
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
  else raise exception '不支援的操作'; end if;
  select jsonb_build_object(
    'columns',coalesce((select jsonb_agg(to_jsonb(c)-'owner_id' order by position) from public.board_columns c where owner_id=actor),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(to_jsonb(t)-'owner_id' order by position,created_at) from public.tasks t where owner_id=actor),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.board_command(text,jsonb) from public;
grant execute on function public.board_command(text,jsonb) to authenticated;
revoke all on function public.track_task_status(), public.record_task_status() from public;
