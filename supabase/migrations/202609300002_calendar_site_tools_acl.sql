-- Supabase default privileges can grant EXECUTE directly to anon/authenticated.
-- Keep the status probe available to signed-in users and reserve all mutation/
-- credential RPCs for the Edge Function service role.
revoke all on function public.calendar_oauth_status(),
  public.calendar_oauth_store(uuid,text,timestamptz,text),
  public.calendar_oauth_read(uuid),
  public.calendar_oauth_mark_error(uuid,text,boolean),
  public.calendar_site_tool_claim(uuid,text,jsonb),
  public.calendar_site_tool_complete(uuid,text,jsonb),
  public.calendar_site_tool_fail(uuid,text,text),
  public.calendar_cache_event(uuid,jsonb)
from public, anon, authenticated;

grant execute on function public.calendar_oauth_status() to authenticated;
grant execute on function public.calendar_oauth_store(uuid,text,timestamptz,text),
  public.calendar_oauth_read(uuid),
  public.calendar_oauth_mark_error(uuid,text,boolean),
  public.calendar_site_tool_claim(uuid,text,jsonb),
  public.calendar_site_tool_complete(uuid,text,jsonb),
  public.calendar_site_tool_fail(uuid,text,text),
  public.calendar_cache_event(uuid,jsonb)
to service_role;
