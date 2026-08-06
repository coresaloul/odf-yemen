-- أدوار قاعدة البيانات المطلوبة للمصادقة و REST و التخزين
-- يعمل تلقائياً عند أول إنشاء للقاعدة فقط
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute format('create role authenticator login noinherit password %L', current_setting('POSTGRES_PASSWORD', true));
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute format('create role supabase_auth_admin login createrole password %L', current_setting('POSTGRES_PASSWORD', true));
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_storage_admin') then
    execute format('create role supabase_storage_admin login createrole password %L', current_setting('POSTGRES_PASSWORD', true));
  end if;
end $$;

grant anon, authenticated, service_role to authenticator;

create schema if not exists auth authorization supabase_auth_admin;
create schema if not exists storage authorization supabase_storage_admin;
create schema if not exists private;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to supabase_auth_admin, service_role, authenticated, anon;
grant usage on schema storage to supabase_storage_admin, service_role, authenticated, anon;

-- دوال مساعدة يعتمد عليها التطبيق في سياسات الحماية
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')::text
$$;

create or replace function auth.email() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.email', true), '')::text
$$;
