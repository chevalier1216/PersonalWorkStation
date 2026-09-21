-- Preserve the deployed M3 command and wrap edit_task so every detail field is
-- persisted even when an older board_command definition is present.
do $$ begin
  if to_regprocedure('public.workspace_command_core_m3(text,jsonb)') is null then
    alter function public.workspace_command(text,jsonb) rename to workspace_command_core_m3;
  end if;
end $$;

create or replace function public.workspace_command(action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); result jsonb; target uuid;
begin
  result:=public.workspace_command_core_m3(action,payload);
  if action='edit_task' then
    target:=(payload->>'id')::uuid;
    update public.tasks set
      title=trim(payload->>'title'),
      description=coalesce(payload->>'description',''),
      priority=payload->>'priority',
      due_at=nullif(payload->>'due_at','')::timestamptz,
      start_date=nullif(payload->>'start_date','')::date,
      estimated_minutes=nullif(payload->>'estimated_minutes','')::integer,
      deliverable_type=nullif(trim(payload->>'deliverable_type'),''),
      deliverable_value=nullif(trim(payload->>'deliverable_value'),'')
    where owner_id=actor and id=target;
    result:=public.workspace_command_core_m3('load','{}'::jsonb);
  end if;
  return result;
end $$;

revoke all on function public.workspace_command_core_m3(text,jsonb) from public,authenticated;
revoke all on function public.workspace_command(text,jsonb) from public;
grant execute on function public.workspace_command(text,jsonb) to authenticated;
