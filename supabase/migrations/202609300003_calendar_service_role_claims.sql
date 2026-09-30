-- PostgREST now exposes JWT claims through request.jwt.claims JSON.
-- Keep the legacy role GUC as a fallback for local tooling and older gateways.
create or replace function private.is_service_role_request() returns boolean
language sql stable security invoker set search_path=pg_catalog as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), ''),
    ''
  ) = 'service_role'
$$;

revoke all on function private.is_service_role_request() from public, anon, authenticated;
grant execute on function private.is_service_role_request() to service_role;

create or replace function public.calendar_oauth_store(
  target uuid,
  access_cipher text,
  access_expires_at timestamptz,
  refresh_cipher text default null
) returns void
language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if not private.is_service_role_request() then
    raise exception 'service role required' using errcode='42501';
  end if;
  if not exists(select 1 from public.allowed_users where user_id=target) then
    raise exception '此帳號尚未獲准使用工作臺' using errcode='42501';
  end if;
  insert into private.google_oauth_credentials(owner_id,access_token_cipher,access_token_expires_at,refresh_token_cipher)
  values(target,nullif(access_cipher,''),access_expires_at,nullif(refresh_cipher,''))
  on conflict(owner_id) do update set
    access_token_cipher=coalesce(excluded.access_token_cipher,private.google_oauth_credentials.access_token_cipher),
    access_token_expires_at=coalesce(excluded.access_token_expires_at,private.google_oauth_credentials.access_token_expires_at),
    refresh_token_cipher=coalesce(excluded.refresh_token_cipher,private.google_oauth_credentials.refresh_token_cipher),
    needs_reconnect=false,last_error='',updated_at=now();
end $$;

create or replace function public.calendar_oauth_read(target uuid) returns jsonb
language plpgsql stable security definer set search_path=public,private,pg_temp as $$
begin
  if not private.is_service_role_request() then
    raise exception 'service role required' using errcode='42501';
  end if;
  return (
    select jsonb_build_object(
      'access_token_cipher',access_token_cipher,
      'access_token_expires_at',access_token_expires_at,
      'refresh_token_cipher',refresh_token_cipher,
      'needs_reconnect',needs_reconnect,
      'last_error',last_error
    )
    from private.google_oauth_credentials where owner_id=target
  );
end $$;

create or replace function public.calendar_oauth_mark_error(
  target uuid,
  message text,
  reconnect boolean default false
) returns void
language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if not private.is_service_role_request() then
    raise exception 'service role required' using errcode='42501';
  end if;
  update private.google_oauth_credentials set
    needs_reconnect=reconnect,
    last_error=left(coalesce(message,'Google 授權錯誤'),2000),
    updated_at=now()
  where owner_id=target;
end $$;

create or replace function public.calendar_site_tool_claim(
  target uuid,
  key text,
  request_input jsonb
) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare prior private.calendar_site_tool_requests%rowtype;
begin
  if not private.is_service_role_request() then
    raise exception 'service role required' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtext(target::text||':'||key));
  select * into prior from private.calendar_site_tool_requests
    where owner_id=target and request_key=key for update;
  if prior.status='succeeded' then
    return jsonb_build_object('state','succeeded','result',prior.result);
  end if;
  if prior.status='pending' and prior.updated_at > now()-interval '5 minutes' then
    return jsonb_build_object('state','pending');
  end if;
  insert into private.calendar_site_tool_requests(owner_id,request_key,input,status,result,error)
  values(target,key,request_input,'pending',null,'')
  on conflict(owner_id,request_key) do update set
    input=excluded.input,status='pending',result=null,error='',updated_at=now();
  return jsonb_build_object('state','claimed');
end $$;

create or replace function public.calendar_site_tool_complete(
  target uuid,
  key text,
  request_result jsonb
) returns void
language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if not private.is_service_role_request() then
    raise exception 'service role required' using errcode='42501';
  end if;
  update private.calendar_site_tool_requests set
    status='succeeded',result=request_result,error='',updated_at=now()
  where owner_id=target and request_key=key;
  if not found then raise exception '找不到 Calendar Site Tool 請求'; end if;
end $$;

create or replace function public.calendar_site_tool_fail(
  target uuid,
  key text,
  message text
) returns void
language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if not private.is_service_role_request() then
    raise exception 'service role required' using errcode='42501';
  end if;
  update private.calendar_site_tool_requests set
    status='failed',result=null,error=left(coalesce(message,'建立行程失敗'),2000),updated_at=now()
  where owner_id=target and request_key=key;
end $$;

create or replace function public.calendar_cache_event(target uuid,payload jsonb) returns void
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare calendar jsonb:=payload->'calendar'; event jsonb:=payload->'event';
begin
  if not private.is_service_role_request() then
    raise exception 'service role required' using errcode='42501';
  end if;
  if not exists(select 1 from public.allowed_users where user_id=target) then
    raise exception '此帳號尚未獲准使用工作臺' using errcode='42501';
  end if;
  insert into public.google_calendars(owner_id,calendar_id,summary,color,time_zone,is_primary,selected,updated_at)
  values(target,calendar->>'id',left(coalesce(nullif(calendar->>'summary',''),'主要行事曆'),500),
    left(coalesce(calendar->>'color','#7895b2'),32),left(coalesce(calendar->>'time_zone',''),100),
    coalesce((calendar->>'is_primary')::boolean,true),coalesce((calendar->>'selected')::boolean,true),now())
  on conflict(owner_id,calendar_id) do update set
    summary=excluded.summary,color=public.google_calendars.color,time_zone=excluded.time_zone,
    is_primary=public.google_calendars.is_primary or excluded.is_primary,
    selected=public.google_calendars.selected or excluded.selected,updated_at=now();

  insert into public.google_calendar_events(owner_id,calendar_id,event_id,title,start_at,end_at,start_date,end_date,all_day,html_link,status,updated_at)
  values(target,event->>'calendar_id',event->>'event_id',left(coalesce(nullif(event->>'title',''),'(無標題)'),2000),
    nullif(event->>'start_at','')::timestamptz,nullif(event->>'end_at','')::timestamptz,
    nullif(event->>'start_date','')::date,nullif(event->>'end_date','')::date,
    coalesce((event->>'all_day')::boolean,false),left(coalesce(event->>'html_link',''),5000),
    case when event->>'status'='tentative' then 'tentative' else 'confirmed' end,now())
  on conflict(owner_id,calendar_id,event_id) do update set
    title=excluded.title,start_at=excluded.start_at,end_at=excluded.end_at,start_date=excluded.start_date,
    end_date=excluded.end_date,all_day=excluded.all_day,html_link=excluded.html_link,status=excluded.status,updated_at=now();

  insert into public.google_calendar_sync_state(owner_id,last_attempt_at,last_success_at,last_error)
  values(target,now(),now(),'')
  on conflict(owner_id) do update set last_attempt_at=now(),last_success_at=now(),last_error='';
end $$;

-- CREATE OR REPLACE preserves existing ACLs; restate them to keep the intended
-- Production boundary explicit if defaults change in a future environment.
revoke all on function public.calendar_oauth_store(uuid,text,timestamptz,text),
  public.calendar_oauth_read(uuid),
  public.calendar_oauth_mark_error(uuid,text,boolean),
  public.calendar_site_tool_claim(uuid,text,jsonb),
  public.calendar_site_tool_complete(uuid,text,jsonb),
  public.calendar_site_tool_fail(uuid,text,text),
  public.calendar_cache_event(uuid,jsonb)
from public, anon, authenticated;

grant execute on function public.calendar_oauth_store(uuid,text,timestamptz,text),
  public.calendar_oauth_read(uuid),
  public.calendar_oauth_mark_error(uuid,text,boolean),
  public.calendar_site_tool_claim(uuid,text,jsonb),
  public.calendar_site_tool_complete(uuid,text,jsonb),
  public.calendar_site_tool_fail(uuid,text,text),
  public.calendar_cache_event(uuid,jsonb)
to service_role;
