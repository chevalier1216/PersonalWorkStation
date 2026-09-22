alter table public.today_preferences
  drop constraint today_preferences_module_order_check,
  drop constraint today_preferences_hidden_modules_check,
  add constraint today_preferences_module_order_check check (
    module_order <@ array['tasks','calendar','ai_chat','ai_execution','notifications','holidays','exchange_rates']::text[]
  ),
  add constraint today_preferences_hidden_modules_check check (
    hidden_modules <@ array['tasks','calendar','ai_chat','ai_execution','notifications','holidays','exchange_rates']::text[]
  );

update public.today_preferences
set module_order=array_append(module_order,'ai_execution'),updated_at=now()
where not ('ai_execution'=any(module_order));

alter table public.task_relations
  add column reason text not null default '' check(length(reason)<=2000);

create function public.is_cn_workday(target_day date) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(
    (select day_type='workday' from public.calendar_days where region='CN' and day=target_day),
    extract(isodow from target_day) between 1 and 5
  )
$$;

create function public.create_priority_due_reminders(target_owner uuid,moment timestamptz) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare local_day date:=(moment at time zone 'Asia/Taipei')::date; item record; stage text; workday_count integer;
begin
  for item in
    select t.id,t.title,t.priority,(t.due_at at time zone 'Asia/Taipei')::date due_day
    from public.tasks t
    join public.board_columns c on c.owner_id=t.owner_id and c.id=t.column_id
    where t.owner_id=target_owner and c.kind<>'done' and t.priority in ('High','Urgent') and t.due_at is not null
      and (t.due_at at time zone 'Asia/Taipei')::date>local_day
  loop
    stage:=null;
    if item.due_day=local_day+1 then
      stage:='1-day';
    elsif item.due_day=local_day+3 then
      stage:='3-days';
    else
      select count(*)::integer into workday_count
      from generate_series(local_day+1,item.due_day,'1 day'::interval) d
      where public.is_cn_workday(d::date);
      if workday_count=5 and public.is_cn_workday(item.due_day) then stage:='5-workdays'; end if;
    end if;
    if stage is not null then
      insert into public.notifications(owner_id,type,title,body,task_id,dedupe_key)
      values(target_owner,'system','重要任務即將到期',item.title||'（'||item.priority||'）將於 '||item.due_day::text||' 到期。',item.id,
        'priority-due:'||item.id::text||':'||stage||':'||local_day::text)
      on conflict(owner_id,dedupe_key) do nothing;
    end if;
  end loop;
end $$;

alter function public.workspace_command(text,jsonb) rename to workspace_command_core_priority_reminders;

create function public.workspace_command(action text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor uuid:=auth.uid(); result jsonb; source_task public.tasks%rowtype;
  summary_task uuid; todo_column uuid; summary_description text; source_description text;
begin
  if actor is null or not public.is_allowed() then
    raise exception '此帳號尚未獲准使用工作臺' using errcode='42501';
  end if;
  if action='create_summary_task' then
    select * into source_task from public.tasks
    where owner_id=actor and id=(payload->>'task_id')::uuid;
    if not found then raise exception '找不到來源任務，請重新整理'; end if;
    if length(trim(coalesce(payload->>'title',''))) between 1 and 300 is not true
      or lower(trim(payload->>'title')) in ('summary','task summary')
      or trim(payload->>'title') in ('摘要','進度整理','工作摘要') then
      raise exception 'Summary 標題必須具體且有意義';
    end if;
    if length(trim(coalesce(payload->>'content',''))) < 1 then
      raise exception '完整摘要不得為空';
    end if;
    select id into todo_column from public.board_columns
    where owner_id=actor and kind='todo' order by position limit 1;
    summary_description:=left(
      '與上一版不同的決策'||E'\n'||coalesce(nullif(trim(payload->>'decisions'),''),'（無）')||E'\n\n'||
      '已完成'||E'\n'||coalesce(nullif(trim(payload->>'completed'),''),'（無）')||E'\n\n'||
      case when nullif(trim(payload->>'cancelled'),'') is null then '' else '已取消'||E'\n'||trim(payload->>'cancelled')||E'\n\n' end||
      case when nullif(trim(payload->>'superseded'),'') is null then '' else '已取代'||E'\n'||trim(payload->>'superseded')||E'\n\n' end||
      '完整摘要'||E'\n'||trim(payload->>'content')||E'\n\n'||
      '來源 Task：task:'||source_task.id::text||' · '||source_task.title,
      20000
    );
    insert into public.tasks(owner_id,column_id,title,description,priority,position)
    values(actor,todo_column,trim(payload->>'title'),summary_description,source_task.priority,
      (select coalesce(max(position),-1)+1 from public.tasks where owner_id=actor and column_id=todo_column))
    returning id into summary_task;
    insert into public.task_relations(owner_id,task_id,related_task_id,relation_type,reason)
    values
      (actor,source_task.id,summary_task,'follow_up','AI 摘要卡'),
      (actor,summary_task,source_task.id,'related','來源 Task');
    source_description:='AI 摘要卡：task:'||summary_task::text||' · '||trim(payload->>'title');
    if source_task.description<>'' then source_description:=source_description||E'\n'||source_task.description; end if;
    update public.tasks set description=left(source_description,20000)
    where owner_id=actor and id=source_task.id;
    result:=public.workspace_command_core_priority_reminders('load','{}'::jsonb);
  else
    result:=public.workspace_command_core_priority_reminders(action,payload);
  end if;
  if action='add_relation' then
    update public.task_relations set reason=left(coalesce(payload->>'reason',''),2000)
    where owner_id=actor and task_id=(payload->>'task_id')::uuid
      and related_task_id=(payload->>'related_task_id')::uuid
      and relation_type=payload->>'relation_type';
    result:=public.workspace_command_core_priority_reminders('load','{}'::jsonb);
  end if;
  perform public.create_priority_due_reminders(actor,now());
  if action='load' then result:=public.workspace_command_core_priority_reminders('load','{}'::jsonb); end if;
  return result;
end $$;

revoke all on function public.is_cn_workday(date),public.create_priority_due_reminders(uuid,timestamptz),public.workspace_command_core_priority_reminders(text,jsonb),public.workspace_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.workspace_command(text,jsonb) to authenticated;
