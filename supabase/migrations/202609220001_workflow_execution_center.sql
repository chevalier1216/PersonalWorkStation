create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_code text not null,
  task_id uuid,
  title text not null check(length(trim(title)) between 1 and 300),
  source text not null check(length(trim(source)) between 1 and 100),
  project text not null default '' check(length(project)<=300),
  status text not null check(status in ('queued','running','waiting_external','waiting_human','retrying','paused','failed','success','cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  current_node_id uuid,
  executor text not null default '' check(length(executor)<=200),
  retry_count integer not null default 0 check(retry_count>=0),
  error text not null default '' check(length(error)<=10000),
  human_required boolean not null default false,
  output text not null default '' check(length(output)<=50000),
  pause_reason text not null default '' check(length(pause_reason)<=100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,run_code),
  foreign key(owner_id,task_id) references public.tasks(owner_id,id) on delete set null
);

create table public.workflow_nodes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  node_key text not null check(length(trim(node_key)) between 1 and 100),
  name text not null check(length(trim(name)) between 1 and 200),
  type text not null check(type in ('ai','tool','test','human','system')),
  status text not null check(status in ('queued','running','waiting_external','waiting_human','retrying','paused','failed','success','cancelled')),
  position integer not null check(position>=0),
  started_at timestamptz,
  finished_at timestamptz,
  input jsonb not null default '{}'::jsonb check(jsonb_typeof(input)='object'),
  output jsonb not null default '{}'::jsonb check(jsonb_typeof(output)='object'),
  error text not null default '' check(length(error)<=10000),
  retry_count integer not null default 0 check(retry_count>=0),
  tool text not null default '' check(length(tool)<=200),
  verification jsonb not null default '{}'::jsonb check(jsonb_typeof(verification)='object'),
  parent_node_id uuid references public.workflow_nodes(id) on delete set null,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,run_id,node_key)
);

alter table public.workflow_runs add constraint workflow_runs_current_node_fkey
  foreign key(current_node_id) references public.workflow_nodes(id) on delete set null;

create table public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  node_id uuid references public.workflow_nodes(id) on delete set null,
  event_type text not null check(length(event_type) between 1 and 100),
  title text not null check(length(title) between 1 and 300),
  details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object'),
  created_at timestamptz not null default now()
);

create table public.workflow_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  node_id uuid references public.workflow_nodes(id) on delete set null,
  level text not null check(level in ('info','warning','error')),
  summary text not null check(length(summary) between 1 and 2000),
  drive_file_id text,
  drive_web_view_link text check(drive_web_view_link is null or drive_web_view_link like 'https://%'),
  created_at timestamptz not null default now()
);

create table public.workflow_artifacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  node_id uuid references public.workflow_nodes(id) on delete set null,
  kind text not null check(kind in ('repository','issue','branch','commit','pull_request','test_result','document','file','link')),
  label text not null check(length(trim(label)) between 1 and 300),
  url text check(url is null or url like 'https://%'),
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);

create table public.workflow_human_gates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  node_id uuid references public.workflow_nodes(id) on delete set null,
  reason text not null check(reason in ('product_decision','oauth','permission','destructive','mutually_exclusive_choice')),
  prompt text not null check(length(prompt) between 1 and 5000),
  status text not null default 'open' check(status in ('open','resolved','cancelled')),
  response text not null default '' check(length(response)<=5000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index workflow_runs_owner_status_idx on public.workflow_runs(owner_id,status,updated_at desc);
create index workflow_runs_owner_task_idx on public.workflow_runs(owner_id,task_id,updated_at desc);
create index workflow_nodes_owner_run_idx on public.workflow_nodes(owner_id,run_id,position);
create index workflow_events_owner_run_idx on public.workflow_events(owner_id,run_id,created_at);
create index workflow_logs_owner_run_idx on public.workflow_logs(owner_id,run_id,created_at);
create index workflow_artifacts_owner_run_idx on public.workflow_artifacts(owner_id,run_id,created_at);
create index workflow_human_gates_owner_status_idx on public.workflow_human_gates(owner_id,status,created_at desc);

alter table public.workflow_runs enable row level security;
alter table public.workflow_nodes enable row level security;
alter table public.workflow_events enable row level security;
alter table public.workflow_logs enable row level security;
alter table public.workflow_artifacts enable row level security;
alter table public.workflow_human_gates enable row level security;

create policy own_workflow_runs on public.workflow_runs for select to authenticated using(owner_id=auth.uid() and public.is_allowed());
create policy own_workflow_nodes on public.workflow_nodes for select to authenticated using(owner_id=auth.uid() and public.is_allowed());
create policy own_workflow_events on public.workflow_events for select to authenticated using(owner_id=auth.uid() and public.is_allowed());
create policy own_workflow_logs on public.workflow_logs for select to authenticated using(owner_id=auth.uid() and public.is_allowed());
create policy own_workflow_artifacts on public.workflow_artifacts for select to authenticated using(owner_id=auth.uid() and public.is_allowed());
create policy own_workflow_human_gates on public.workflow_human_gates for select to authenticated using(owner_id=auth.uid() and public.is_allowed());

revoke all on public.workflow_runs,public.workflow_nodes,public.workflow_events,public.workflow_logs,public.workflow_artifacts,public.workflow_human_gates from anon,authenticated;
grant select on public.workflow_runs,public.workflow_nodes,public.workflow_events,public.workflow_logs,public.workflow_artifacts,public.workflow_human_gates to authenticated;

create function public.workflow_state() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'runs',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by updated_at desc) from public.workflow_runs x where owner_id=auth.uid()),'[]'::jsonb),
    'nodes',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by run_id,position) from public.workflow_nodes x where owner_id=auth.uid()),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by created_at desc) from public.workflow_events x where owner_id=auth.uid()),'[]'::jsonb),
    'logs',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by created_at desc) from public.workflow_logs x where owner_id=auth.uid()),'[]'::jsonb),
    'artifacts',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by created_at desc) from public.workflow_artifacts x where owner_id=auth.uid()),'[]'::jsonb),
    'human_gates',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by created_at desc) from public.workflow_human_gates x where owner_id=auth.uid()),'[]'::jsonb)
  )
$$;

create function public.workflow_command(action text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); target_run uuid; target_node uuid; target_task uuid; created_run uuid; created_node uuid;
  next_node uuid; code text; daily_count integer; next_status text; gate_reason text; current_retry integer; verification_ok boolean;
begin
  if actor is null or not public.is_allowed() then raise exception '此帳號尚未獲准使用工作臺' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext(actor::text));

  if action='create_run' then
    target_task:=nullif(payload->>'task_id','')::uuid;
    if target_task is not null and not exists(select 1 from public.tasks where owner_id=actor and id=target_task) then raise exception '找不到關聯 Task'; end if;
    if trim(coalesce(payload->>'title',''))='' then raise exception '請輸入 Run 標題'; end if;
    select count(*)::integer+1 into daily_count from public.workflow_runs where owner_id=actor and (created_at at time zone 'Asia/Taipei')::date=(now() at time zone 'Asia/Taipei')::date;
    code:='RUN-'||to_char(now() at time zone 'Asia/Taipei','YYYYMMDD')||'-'||lpad(daily_count::text,4,'0');
    insert into public.workflow_runs(owner_id,run_code,task_id,title,source,project,status,executor)
    values(actor,code,target_task,left(trim(payload->>'title'),300),left(coalesce(nullif(trim(payload->>'source'),''),'AI Chat'),100),
      left(coalesce(payload->>'project',''),300),'waiting_external',left(coalesce(payload->>'executor',''),200)) returning id into created_run;

    insert into public.workflow_nodes(owner_id,run_id,node_key,name,type,status,position,started_at,finished_at,input,output)
    values(actor,created_run,'trigger','Trigger','system','success',0,now(),now(),coalesce(payload->'input','{}'::jsonb),jsonb_build_object('source',coalesce(payload->>'source','AI Chat')))
    returning id into created_node;
    insert into public.workflow_nodes(owner_id,run_id,node_key,name,type,status,position) values
      (actor,created_run,'context','Context','system','queued',1),
      (actor,created_run,'execution','Execution','ai','queued',2),
      (actor,created_run,'verification','Verification','test','queued',3),
      (actor,created_run,'output','Output','system','queued',4);
    select id into next_node from public.workflow_nodes where owner_id=actor and run_id=created_run and node_key='context';
    update public.workflow_nodes n set parent_node_id=p.id
      from public.workflow_nodes p
      where n.owner_id=actor and n.run_id=created_run and p.owner_id=actor and p.run_id=created_run
        and ((n.node_key='context' and p.node_key='trigger')
          or (n.node_key='execution' and p.node_key='context')
          or (n.node_key='verification' and p.node_key='execution')
          or (n.node_key='output' and p.node_key='verification'));
    update public.workflow_runs set current_node_id=next_node,error='等待可用 executor bridge',updated_at=now() where id=created_run;
    insert into public.workflow_events(owner_id,run_id,node_id,event_type,title,details) values
      (actor,created_run,created_node,'run_created','Run created',jsonb_build_object('run_code',code)),
      (actor,created_run,next_node,'waiting_external','等待 executor bridge',jsonb_build_object('reason','EXECUTOR_BRIDGE_REQUIRED'));

  elsif action='update_node' then
    target_node:=(payload->>'node_id')::uuid;
    select run_id into target_run from public.workflow_nodes where owner_id=actor and id=target_node;
    if target_run is null then raise exception '找不到 Node'; end if;
    next_status:=payload->>'status';
    if next_status not in ('queued','running','waiting_external','waiting_human','paused','failed','success','cancelled') then raise exception '不支援的 Node 狀態'; end if;
    update public.workflow_nodes set status=next_status,
      started_at=case when next_status='running' then coalesce(started_at,now()) else started_at end,
      finished_at=case when next_status in ('failed','success','cancelled') then now() else null end,
      input=coalesce(payload->'input',input),output=coalesce(payload->'output',output),
      error=left(coalesce(payload->>'error',error),10000),tool=left(coalesce(payload->>'tool',tool),200),
      verification=coalesce(payload->'verification',verification),updated_at=now()
      where owner_id=actor and id=target_node;
    update public.workflow_runs set current_node_id=target_node,
      status=case when next_status='waiting_human' then 'waiting_human' when next_status='waiting_external' then 'waiting_external' when next_status='failed' then 'failed' when next_status='paused' then 'paused' when next_status='running' then 'running' else status end,
      started_at=case when next_status='running' then coalesce(started_at,now()) else started_at end,
      error=case when next_status='failed' then left(coalesce(payload->>'error','Node failed'),10000) else error end,
      human_required=(next_status='waiting_human'),updated_at=now() where owner_id=actor and id=target_run;
    insert into public.workflow_events(owner_id,run_id,node_id,event_type,title,details)
      values(actor,target_run,target_node,'node_status','Node status: '||next_status,jsonb_build_object('status',next_status,'error',coalesce(payload->>'error','')));

  elsif action='retry_node' then
    target_node:=(payload->>'node_id')::uuid;
    select run_id,retry_count into target_run,current_retry from public.workflow_nodes where owner_id=actor and id=target_node;
    if target_run is null then raise exception '找不到 Node'; end if;
    if current_retry>=3 then
      update public.workflow_nodes set status='paused',updated_at=now() where id=target_node;
      update public.workflow_runs set status='paused',pause_reason='SYSTEM_ERROR_PAUSED',updated_at=now() where id=target_run;
      insert into public.workflow_events(owner_id,run_id,node_id,event_type,title,details)
        values(actor,target_run,target_node,'retry_paused','Retry 已暫停',jsonb_build_object('retry_count',current_retry,'reason','SYSTEM_ERROR_PAUSED'));
    else
      update public.workflow_nodes set status='retrying',retry_count=retry_count+1,updated_at=now() where id=target_node;
      update public.workflow_runs set status='retrying',retry_count=retry_count+1,current_node_id=target_node,updated_at=now() where id=target_run;
      insert into public.workflow_events(owner_id,run_id,node_id,event_type,title,details)
        select actor,target_run,target_node,'retry','Retry #'||(current_retry+1),jsonb_build_object('retry_count',current_retry+1,'previous_error',error,'last_attempt_at',now(),'retry_reason',coalesce(payload->>'reason','manual retry'))
        from public.workflow_nodes where id=target_node;
    end if;

  elsif action='open_human_gate' then
    target_node:=(payload->>'node_id')::uuid;
    select run_id into target_run from public.workflow_nodes where owner_id=actor and id=target_node;
    if target_run is null then raise exception '找不到 Node'; end if;
    gate_reason:=payload->>'reason';
    if gate_reason not in ('product_decision','oauth','permission','destructive','mutually_exclusive_choice') then raise exception '不允許的 Human Gate 原因'; end if;
    insert into public.workflow_human_gates(owner_id,run_id,node_id,reason,prompt)
      values(actor,target_run,target_node,gate_reason,left(payload->>'prompt',5000));
    update public.workflow_nodes set status='waiting_human',updated_at=now() where id=target_node;
    update public.workflow_runs set status='waiting_human',human_required=true,current_node_id=target_node,updated_at=now() where id=target_run;
    insert into public.workflow_events(owner_id,run_id,node_id,event_type,title,details)
      values(actor,target_run,target_node,'human_gate_opened','Waiting Human',jsonb_build_object('reason',gate_reason));

  elsif action='resolve_human_gate' then
    select run_id,node_id into target_run,target_node from public.workflow_human_gates where owner_id=actor and id=(payload->>'gate_id')::uuid and status='open';
    if target_run is null then raise exception '找不到待處理 Human Gate'; end if;
    update public.workflow_human_gates set status='resolved',response=left(coalesce(payload->>'response',''),5000),resolved_at=now() where owner_id=actor and id=(payload->>'gate_id')::uuid;
    update public.workflow_nodes set status='queued',updated_at=now() where id=target_node;
    update public.workflow_runs set status='queued',human_required=false,error='',updated_at=now() where id=target_run;
    insert into public.workflow_events(owner_id,run_id,node_id,event_type,title,details)
      values(actor,target_run,target_node,'human_gate_resolved','Human Gate resolved',jsonb_build_object('response',coalesce(payload->>'response','')));

  elsif action='record_artifact' then
    target_run:=(payload->>'run_id')::uuid; target_node:=nullif(payload->>'node_id','')::uuid;
    if not exists(select 1 from public.workflow_runs where owner_id=actor and id=target_run) then raise exception '找不到 Run'; end if;
    if target_node is not null and not exists(select 1 from public.workflow_nodes where owner_id=actor and run_id=target_run and id=target_node) then raise exception '找不到隸屬此 Run 的 Node'; end if;
    insert into public.workflow_artifacts(owner_id,run_id,node_id,kind,label,url,metadata)
      values(actor,target_run,target_node,payload->>'kind',left(trim(payload->>'label'),300),nullif(payload->>'url',''),coalesce(payload->'metadata','{}'::jsonb));
    insert into public.workflow_events(owner_id,run_id,node_id,event_type,title,details)
      values(actor,target_run,target_node,'artifact','Artifact recorded',jsonb_build_object('kind',payload->>'kind','label',payload->>'label'));

  elsif action='record_log' then
    target_run:=(payload->>'run_id')::uuid; target_node:=nullif(payload->>'node_id','')::uuid;
    if not exists(select 1 from public.workflow_runs where owner_id=actor and id=target_run) then raise exception '找不到 Run'; end if;
    if target_node is not null and not exists(select 1 from public.workflow_nodes where owner_id=actor and run_id=target_run and id=target_node) then raise exception '找不到隸屬此 Run 的 Node'; end if;
    if payload->>'level' not in ('info','warning','error') then raise exception '不支援的 Log level'; end if;
    insert into public.workflow_logs(owner_id,run_id,node_id,level,summary,drive_file_id,drive_web_view_link)
      values(actor,target_run,target_node,payload->>'level',left(payload->>'summary',2000),nullif(payload->>'drive_file_id',''),nullif(payload->>'drive_web_view_link',''));

  elsif action='pause_run' then
    target_run:=(payload->>'run_id')::uuid;
    if payload->>'reason' not in ('QUOTA_PAUSED','SYSTEM_ERROR_PAUSED') then raise exception '不允許的 Pause 原因'; end if;
    update public.workflow_runs set status='paused',pause_reason=payload->>'reason',updated_at=now() where owner_id=actor and id=target_run;
    if not found then raise exception '找不到 Run'; end if;
    update public.workflow_nodes set status='paused',updated_at=now() where owner_id=actor and id=(select current_node_id from public.workflow_runs where id=target_run) and status not in ('success','failed','cancelled');
    insert into public.workflow_events(owner_id,run_id,event_type,title,details)
      values(actor,target_run,'run_paused','Run paused',jsonb_build_object('reason',payload->>'reason'));

  elsif action='resume_run' then
    target_run:=(payload->>'run_id')::uuid;
    update public.workflow_runs set status='queued',pause_reason='',updated_at=now() where owner_id=actor and id=target_run and status='paused';
    if not found then raise exception '找不到已暫停 Run'; end if;
    update public.workflow_nodes set status='queued',updated_at=now() where owner_id=actor and id=(select current_node_id from public.workflow_runs where id=target_run) and status='paused';
    insert into public.workflow_events(owner_id,run_id,event_type,title,details)
      values(actor,target_run,'run_resumed','Run resumed','{}'::jsonb);

  elsif action='complete_run' then
    target_run:=(payload->>'run_id')::uuid;
    if not exists(select 1 from public.workflow_runs where owner_id=actor and id=target_run) then raise exception '找不到 Run'; end if;
    if exists(select 1 from public.workflow_nodes where owner_id=actor and run_id=target_run and required and status<>'success') then raise exception '仍有必要 Node 未成功'; end if;
    select exists(select 1 from public.workflow_nodes where owner_id=actor and run_id=target_run and node_key='verification' and status='success' and verification->>'passed'='true') into verification_ok;
    if not verification_ok then raise exception 'Verification 尚未通過'; end if;
    update public.workflow_runs set status='success',finished_at=now(),human_required=false,error='',output=left(coalesce(payload->>'output',''),50000),updated_at=now() where id=target_run;
    insert into public.workflow_events(owner_id,run_id,event_type,title,details) values(actor,target_run,'run_success','Run success',jsonb_build_object('verified',true));

  elsif action='cancel_run' then
    target_run:=(payload->>'run_id')::uuid;
    update public.workflow_runs set status='cancelled',finished_at=now(),updated_at=now() where owner_id=actor and id=target_run;
    if not found then raise exception '找不到 Run'; end if;
    update public.workflow_nodes set status='cancelled',finished_at=now(),updated_at=now() where owner_id=actor and run_id=target_run and status not in ('success','failed','cancelled');
    insert into public.workflow_events(owner_id,run_id,event_type,title,details) values(actor,target_run,'run_cancelled','Run cancelled','{}'::jsonb);

  elsif action<>'load' then
    raise exception '未知 Workflow 操作';
  end if;
  return public.workflow_state();
end $$;

revoke all on function public.workflow_state(),public.workflow_command(text,jsonb) from public;
grant execute on function public.workflow_command(text,jsonb) to authenticated;
