-- SmartStock AI — function privileges
-- Internal functions (prefixed `_`) can never be called through the API. Public RPCs require a signed-in user.

alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

revoke execute on all functions in schema public from public, anon, authenticated;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname not like '\_%' and p.prokind = 'f'
  loop
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

grant execute on all functions in schema public to service_role;
