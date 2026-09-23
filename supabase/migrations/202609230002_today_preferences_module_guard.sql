-- Keep the database allowlist aligned with every Today module shipped by V1.
-- This migration is intentionally safe on databases that already received the
-- 202609220002 constraint update and on databases with older saved layouts.

alter table public.today_preferences
  drop constraint if exists today_preferences_module_order_check,
  drop constraint if exists today_preferences_hidden_modules_check;

with allowed_modules(module_key) as (
  values
    ('tasks'),
    ('calendar'),
    ('ai_chat'),
    ('ai_execution'),
    ('notifications'),
    ('holidays'),
    ('exchange_rates')
), normalized as (
  select
    preferences.owner_id,
    coalesce(
      (
        select array_agg(item.module_key order by item.ordinality)
        from unnest(preferences.module_order) with ordinality as item(module_key, ordinality)
        where item.module_key in (select module_key from allowed_modules)
      ),
      '{}'::text[]
    ) as module_order,
    coalesce(
      (
        select array_agg(item.module_key order by item.ordinality)
        from unnest(preferences.hidden_modules) with ordinality as item(module_key, ordinality)
        where item.module_key in (select module_key from allowed_modules)
      ),
      '{}'::text[]
    ) as hidden_modules
  from public.today_preferences preferences
)
update public.today_preferences preferences
set
  module_order = normalized.module_order,
  hidden_modules = normalized.hidden_modules,
  updated_at = now()
from normalized
where preferences.owner_id = normalized.owner_id
  and (preferences.module_order is distinct from normalized.module_order
   or preferences.hidden_modules is distinct from normalized.hidden_modules);

alter table public.today_preferences
  add constraint today_preferences_module_order_check check (
    module_order <@ array[
      'tasks',
      'calendar',
      'ai_chat',
      'ai_execution',
      'notifications',
      'holidays',
      'exchange_rates'
    ]::text[]
  ),
  add constraint today_preferences_hidden_modules_check check (
    hidden_modules <@ array[
      'tasks',
      'calendar',
      'ai_chat',
      'ai_execution',
      'notifications',
      'holidays',
      'exchange_rates'
    ]::text[]
  );
