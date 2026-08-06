#!/bin/bash
# تهيئة أدوار قاعدة البيانات وكلمات مرورها + المخططات الأساسية
# يعمل تلقائياً مرة واحدة عند أول إنشاء للقاعدة
set -e

psql -v ON_ERROR_STOP=1 --username "postgres" --dbname "$POSTGRES_DB" <<-EOSQL
  do \$\$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin login createrole; end if;
    if not exists (select 1 from pg_roles where rolname = 'supabase_storage_admin') then create role supabase_storage_admin login createrole; end if;
  end \$\$;

  alter role authenticator with password '${POSTGRES_PASSWORD}';
  alter role supabase_auth_admin with password '${POSTGRES_PASSWORD}';
  alter role supabase_storage_admin with password '${POSTGRES_PASSWORD}';

  grant anon, authenticated, service_role to authenticator;

  create schema if not exists auth authorization supabase_auth_admin;
  create schema if not exists storage authorization supabase_storage_admin;
  create schema if not exists private;

  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to supabase_auth_admin, service_role, authenticated, anon;
  grant usage on schema storage to supabase_storage_admin, service_role, authenticated, anon;
  grant all on schema private to postgres, service_role;

  -- دوال الهوية التي تعتمد عليها سياسات الحماية (RLS)
  create or replace function auth.uid() returns uuid language sql stable as
  \$f\$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid \$f\$;

  create or replace function auth.role() returns text language sql stable as
  \$f\$ select nullif(current_setting('request.jwt.claim.role', true), '')::text \$f\$;

  create or replace function auth.email() returns text language sql stable as
  \$f\$ select nullif(current_setting('request.jwt.claim.email', true), '')::text \$f\$;
EOSQL
