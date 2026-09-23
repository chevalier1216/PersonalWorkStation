create table if not exists public.exchange_rates (
  currency text primary key check (currency in ('USD','CNY','JPY','EUR','AUD')),
  spot_buy numeric not null,
  spot_sell numeric not null,
  cash_buy numeric not null,
  cash_sell numeric not null,
  quoted_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  source_url text not null
);

create table if not exists public.exchange_rate_sync (
  singleton boolean primary key default true check (singleton),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text not null default ''
);
insert into public.exchange_rate_sync(singleton) values(true) on conflict do nothing;

alter table public.exchange_rates enable row level security;
alter table public.exchange_rate_sync enable row level security;
revoke all on public.exchange_rates, public.exchange_rate_sync from anon, authenticated;

create or replace function public.exchange_rate_state()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_allowed() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'rates', coalesce((select jsonb_agg(to_jsonb(r) order by array_position(array['USD','CNY','JPY','EUR','AUD'], r.currency)) from public.exchange_rates r), '[]'::jsonb),
    'last_attempt_at', (select last_attempt_at from public.exchange_rate_sync where singleton),
    'last_success_at', (select last_success_at from public.exchange_rate_sync where singleton),
    'last_error', coalesce((select last_error from public.exchange_rate_sync where singleton), '')
  );
end $$;
revoke all on function public.exchange_rate_state() from public;
grant execute on function public.exchange_rate_state() to authenticated;
