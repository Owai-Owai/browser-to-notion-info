-- Read-only deployment checks. This reports permissions and job metadata, never stored credentials.
select jsonb_build_object(
  'private_tables', (
    select jsonb_agg(jsonb_build_object(
      'name', c.relname,
      'row_security_enabled', c.relrowsecurity,
      'anon_access', has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE'),
      'signed_in_access', has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
    ) order by c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='bns_private' and c.relkind='r'
  ),
  'privileges', jsonb_build_object(
    'anon_schema_access', has_schema_privilege('anon','bns_private','USAGE'),
    'signed_in_schema_access', has_schema_privilege('authenticated','bns_private','USAGE'),
    'anon_rpc_access', has_function_privilege('anon','public.bns_service(text,jsonb)','EXECUTE'),
    'signed_in_rpc_access', has_function_privilege('authenticated','public.bns_service(text,jsonb)','EXECUTE'),
    'service_rpc_access', has_function_privilege('service_role','public.bns_service(text,jsonb)','EXECUTE'),
    'anon_cleanup_access', has_function_privilege('anon','public.bns_cleanup()','EXECUTE'),
    'signed_in_cleanup_access', has_function_privilege('authenticated','public.bns_cleanup()','EXECUTE')
  ),
  'cleanup_jobs', (
    select jsonb_agg(jsonb_build_object('name',jobname,'schedule',schedule,'command',command,'active',active))
    from cron.job where jobname='bns-hourly-cleanup'
  )
) as verification;
