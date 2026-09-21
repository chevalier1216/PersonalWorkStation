-- Read-only M4-M6 production postflight. Every returned row must be true.
with table_targets(name) as (
  values
    ('ai_conversations'),
    ('ai_messages'),
    ('ai_pending_actions'),
    ('ai_summaries'),
    ('task_attachments'),
    ('capacity_snapshots'),
    ('metadata_backups')
), function_targets(name,signature) as (
  values
    ('ai_command','public.ai_command(text,jsonb)'),
    ('summary_command','public.summary_command(text,jsonb)'),
    ('history_search','public.history_search(text,text)'),
    ('attachment_command','public.attachment_command(text,jsonb)')
), policy_targets(name) as (
  values
    ('pws_attachment_insert'),
    ('pws_attachment_select'),
    ('pws_attachment_delete')
), checks as (
  select 'table_exists' kind,name,
    to_regclass('public.'||name) is not null passed
  from table_targets

  union all
  select 'rls_enabled',t.name,coalesce(c.relrowsecurity,false)
  from table_targets t
  left join pg_class c on c.oid=to_regclass('public.'||t.name)

  union all
  select 'anon_table_access_revoked',name,
    not has_table_privilege('anon','public.'||name,'select,insert,update,delete')
  from table_targets

  union all
  select 'function_exists',name,to_regprocedure(signature) is not null
  from function_targets

  union all
  select 'authenticated_execute',name,
    has_function_privilege('authenticated',signature,'execute')
  from function_targets

  union all
  select 'bucket_private','pws-attachments',exists(
    select 1 from storage.buckets
    where id='pws-attachments' and public=false
  )

  union all
  select 'storage_policy',p.name,exists(
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname=p.name
  )
  from policy_targets p
)
select kind,name,passed
from checks
order by kind,name;
