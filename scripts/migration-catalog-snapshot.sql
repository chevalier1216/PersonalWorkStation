\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

select jsonb_pretty(jsonb_build_object(
  'tables', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'name', c.relname,
      'rls', c.relrowsecurity,
      'columns', (
        select jsonb_agg(jsonb_build_object(
          'name', a.attname,
          'type', format_type(a.atttypid, a.atttypmod),
          'not_null', a.attnotnull,
          'default', pg_get_expr(ad.adbin, ad.adrelid)
        ) order by a.attnum)
        from pg_attribute a
        left join pg_attrdef ad
          on ad.adrelid = a.attrelid and ad.adnum = a.attnum
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      ),
      'constraints', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', con.conname,
          'type', con.contype,
          'definition', pg_get_constraintdef(con.oid, true)
        ) order by con.conname), '[]'::jsonb)
        from pg_constraint con
        where con.conrelid = c.oid
      )
    ) order by n.nspname, c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  ), '[]'::jsonb),
  'policies', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', schemaname,
      'table', tablename,
      'name', policyname,
      'permissive', permissive,
      'roles', roles,
      'command', cmd,
      'using', qual,
      'check', with_check
    ) order by schemaname, tablename, policyname)
    from pg_policies
    where schemaname = 'public'
       or (schemaname = 'storage' and policyname like 'pws_attachment_%')
  ), '[]'::jsonb),
  'functions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'name', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'result', pg_get_function_result(p.oid),
      'language', l.lanname,
      'volatility', p.provolatile,
      'security_definer', p.prosecdef,
      'config', coalesce(to_jsonb(p.proconfig), '[]'::jsonb),
      'definition', pg_get_functiondef(p.oid)
    ) order by p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
  ), '[]'::jsonb),
  'triggers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'name', t.tgname,
      'definition', pg_get_triggerdef(t.oid, true)
    ) order by n.nspname, c.relname, t.tgname)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
  ), '[]'::jsonb),
  'attachment_bucket', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'public', public
    ) order by id)
    from storage.buckets
    where id = 'pws-attachments'
  ), '[]'::jsonb)
));
