-- REVISION 4: DESIGN DRAFT ONLY. Not an active migration.
begin;

create schema cms_private;
revoke all on schema cms_private from public, anon, authenticated, service_role;
grant usage on schema cms_private to authenticated;

create table public.admin_profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text,
  role text not null check (role in ('super_admin', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table public.admin_user_audit_logs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  event_type text not null check (event_type in ('bootstrap', 'access_changed')),
  target_user_id uuid not null references auth.users(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_operator text,
  approval_reference text,
  source text not null check (source in ('trusted_database_bootstrap', 'authenticated_admin')),
  old_role text check (old_role in ('super_admin', 'admin')),
  new_role text not null check (new_role in ('super_admin', 'admin')),
  old_is_active boolean,
  new_is_active boolean not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint admin_user_audit_event_shape check (
    (
      event_type = 'bootstrap'
      and source = 'trusted_database_bootstrap'
      and actor_user_id is null
      and actor_operator is not null and length(pg_catalog.btrim(actor_operator)) > 0
      and approval_reference is not null and length(pg_catalog.btrim(approval_reference)) > 0
      and old_role is null and old_is_active is null
      and new_role = 'super_admin' and new_is_active
    )
    or
    (
      event_type = 'access_changed'
      and source = 'authenticated_admin'
      and actor_user_id is not null
      and actor_operator is null and approval_reference is null
      and old_role is not null and old_is_active is not null
      and (old_role is distinct from new_role or old_is_active is distinct from new_is_active)
    )
  )
);

create index admin_user_audit_logs_target_time_idx
  on public.admin_user_audit_logs (target_user_id, created_at desc, id);

alter table public.admin_profiles enable row level security;
alter table public.admin_user_audit_logs enable row level security;
revoke all on public.admin_profiles, public.admin_user_audit_logs
  from public, anon, authenticated, service_role;
grant select on public.admin_profiles, public.admin_user_audit_logs to authenticated;

create function cms_private.is_active_super_admin()
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role = 'super_admin'
  );
$$;
revoke all on function cms_private.is_active_super_admin()
  from public, anon, authenticated, service_role;
grant execute on function cms_private.is_active_super_admin() to authenticated;

create policy admin_profiles_read
on public.admin_profiles for select to authenticated
using (
  (id = (select auth.uid()) and is_active)
  or (select cms_private.is_active_super_admin())
);

create policy admin_user_audit_logs_read
on public.admin_user_audit_logs for select to authenticated
using ((select cms_private.is_active_super_admin()));

create function cms_private.lock_admin_profile_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'admin profiles cannot be truncated';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'admin profile writes require read committed isolation';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(18021991, 1);
  return null;
end;
$$;
revoke all on function cms_private.lock_admin_profile_writes()
  from public, anon, authenticated, service_role;

create trigger admin_profiles_lock
before insert or update or delete or truncate on public.admin_profiles
for each statement execute function cms_private.lock_admin_profile_writes();

create function cms_private.guard_admin_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  if tg_op = 'DELETE' then
    raise exception 'admin profiles cannot be deleted; deactivate instead';
  end if;
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'admin profile id cannot be changed';
    end if;
    if new.role is distinct from old.role or new.is_active is distinct from old.is_active
       or new.display_name is distinct from old.display_name then
      actor_id := auth.uid();
      if actor_id is null or not cms_private.is_active_super_admin() then
        raise exception 'not authorized' using errcode = '42501';
      end if;
      if actor_id = old.id
         and (new.role is distinct from old.role or (old.is_active and not new.is_active)) then
        raise exception 'cannot change your own role or deactivate yourself' using errcode = '42501';
      end if;
      if old.role = 'super_admin' and old.is_active
         and (new.role <> 'super_admin' or not new.is_active)
         and not exists (
           select 1 from public.admin_profiles p
           where p.id <> old.id and p.role = 'super_admin' and p.is_active
         ) then
        raise exception 'cannot remove the last active super admin';
      end if;
      new.updated_by := actor_id;
      new.updated_at := pg_catalog.now();
    else
      new.updated_at := old.updated_at;
    end if;
    if new.created_by is distinct from old.created_by and new.created_by is not null then
      raise exception 'admin profile creator cannot be changed';
    end if;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
revoke all on function cms_private.guard_admin_profile()
  from public, anon, authenticated, service_role;

create trigger admin_profiles_guard
before insert or update or delete on public.admin_profiles
for each row execute function cms_private.guard_admin_profile();

create function cms_private.audit_admin_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role is distinct from new.role or old.is_active is distinct from new.is_active then
    insert into public.admin_user_audit_logs (
      event_type, target_user_id, actor_user_id, source,
      old_role, new_role, old_is_active, new_is_active
    ) values (
      'access_changed', new.id, auth.uid(), 'authenticated_admin',
      old.role, new.role, old.is_active, new.is_active
    );
  end if;
  return null;
end;
$$;
revoke all on function cms_private.audit_admin_access_change()
  from public, anon, authenticated, service_role;

create trigger admin_profiles_audit
after update on public.admin_profiles
for each row execute function cms_private.audit_admin_access_change();

create function cms_private.reject_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'admin audit logs are append-only';
end;
$$;
revoke all on function cms_private.reject_audit_mutation()
  from public, anon, authenticated, service_role;

create trigger admin_user_audit_logs_no_mutation
before update or delete or truncate on public.admin_user_audit_logs
for each statement execute function cms_private.reject_audit_mutation();

create function public.set_admin_access(target_id uuid, new_role text, new_is_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_role text;
  target_is_active boolean;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'admin profile writes require read committed isolation';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(18021991, 1);
  if actor_id is null or not cms_private.is_active_super_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if target_id is null or new_role is null or new_role not in ('super_admin', 'admin')
     or new_is_active is null then
    raise exception 'invalid admin access parameters' using errcode = '22023';
  end if;
  select p.role, p.is_active into target_role, target_is_active
  from public.admin_profiles p where p.id = target_id for update;
  if not found then
    raise exception 'admin profile not found' using errcode = 'P0002';
  end if;
  if target_id = actor_id
     and (target_role is distinct from new_role or (target_is_active and not new_is_active)) then
    raise exception 'cannot change your own role or deactivate yourself' using errcode = '42501';
  end if;
  update public.admin_profiles
  set role = new_role, is_active = new_is_active
  where id = target_id
    and (role is distinct from new_role or is_active is distinct from new_is_active);
end;
$$;
revoke all on function public.set_admin_access(uuid, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.set_admin_access(uuid, text, boolean) to authenticated;

-- This owner-only function records the external operator, not a fictional Auth actor.
create function cms_private.bootstrap_first_super_admin(
  target_id uuid,
  initial_display_name text,
  operator_identifier text,
  approval_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'bootstrap requires read committed isolation';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(18021991, 1);
  if target_id is null
     or operator_identifier is null or pg_catalog.btrim(operator_identifier) = ''
     or approval_id is null or pg_catalog.btrim(approval_id) = '' then
    raise exception 'bootstrap requires target, operator and approval reference' using errcode = '22023';
  end if;
  if exists (select 1 from public.admin_profiles)
     or exists (select 1 from public.admin_user_audit_logs) then
    raise exception 'bootstrap is only available for an uninitialized foundation';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = target_id
      and u.email is not null
      and pg_catalog.btrim(u.email) <> ''
      and u.email_confirmed_at is not null
  ) then
    raise exception 'bootstrap requires an existing Auth user with confirmed email';
  end if;
  insert into public.admin_profiles (id, display_name, role, is_active)
  values (target_id, initial_display_name, 'super_admin', true);
  insert into public.admin_user_audit_logs (
    event_type, target_user_id, actor_operator, approval_reference,
    source, new_role, new_is_active
  ) values (
    'bootstrap', target_id, operator_identifier, approval_id,
    'trusted_database_bootstrap', 'super_admin', true
  );
end;
$$;
revoke all on function cms_private.bootstrap_first_super_admin(uuid, text, text, text)
  from public, anon, authenticated, service_role;

commit;
