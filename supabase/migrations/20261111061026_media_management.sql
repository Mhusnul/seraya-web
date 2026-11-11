-- Media Management. Create the website-media bucket through the Storage API
-- before applying: public, 5242880 bytes, image/jpeg, image/png, image/webp.
begin;

do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'website-media' and public and file_size_limit = 5242880
      and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']::text[]
      and allowed_mime_types <@ array['image/jpeg', 'image/png', 'image/webp']::text[]
  ) then
    raise exception 'website-media bucket configuration is missing or incorrect';
  end if;
end;
$$;

create table public.media_assets (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  object_path text not null unique,
  original_file_name text not null check (char_length(original_file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size bigint not null check (file_size between 1 and 5242880),
  media_type text not null check (media_type in ('product', 'article', 'service', 'website', 'general')),
  alt_text text not null default '' check (char_length(alt_text) <= 500),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  state text not null default 'pending' check (state in ('pending', 'ready', 'deleting')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_assets_created_at_idx on public.media_assets (created_at desc, id desc);
create index media_assets_media_type_idx on public.media_assets (media_type, created_at desc);
alter table public.media_assets enable row level security;
revoke all on public.media_assets from public, anon, authenticated;
grant select on public.media_assets to authenticated;

create function cms_private.is_active_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admin_profiles where id = (select auth.uid()) and is_active);
$$;
revoke all on function cms_private.is_active_admin() from public, anon, authenticated;
grant execute on function cms_private.is_active_admin() to authenticated;

create policy media_assets_admin_read on public.media_assets for select to authenticated
using ((select cms_private.is_active_admin()));

create function cms_private.media_storage_allowed(path text, action text)
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
declare asset public.media_assets;
begin
  if not cms_private.is_active_admin() then return false; end if;
  select * into asset from public.media_assets where object_path = path for update;
  if not found then return false; end if;
  return (action = 'insert' and asset.state = 'pending' and asset.uploaded_by = auth.uid())
    or (action = 'delete' and asset.state = 'deleting'
      and not exists (select 1 from pg_catalog.pg_constraint c
        where c.contype = 'f' and c.confrelid = 'public.media_assets'::regclass));
end;
$$;
revoke all on function cms_private.media_storage_allowed(text, text) from public, anon, authenticated;
grant execute on function cms_private.media_storage_allowed(text, text) to authenticated;

create policy media_objects_admin_select on storage.objects for select to authenticated
using (bucket_id = 'website-media' and (select cms_private.is_active_admin()));
create policy media_objects_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'website-media' and cms_private.media_storage_allowed(name, 'insert'));
create policy media_objects_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'website-media' and cms_private.media_storage_allowed(name, 'delete'));

create function public.media_prepare_upload(filename text, mime text, bytes bigint, category text, alt text)
returns public.media_assets language plpgsql security definer set search_path = ''
as $$
declare
  asset public.media_assets;
  extension text;
begin
  if not cms_private.is_active_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  extension := case mime when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' end;
  if extension is null or filename is null or filename !~* '\.(jpe?g|png|webp)$'
    or (mime = 'image/jpeg' and filename !~* '\.jpe?g$')
    or (mime = 'image/png' and filename !~* '\.png$')
    or (mime = 'image/webp' and filename !~* '\.webp$')
  then raise exception 'invalid file type'; end if;
  asset.id := pg_catalog.gen_random_uuid();
  insert into public.media_assets (id, object_path, original_file_name, mime_type, file_size, media_type, alt_text, uploaded_by)
  values (asset.id, 'media/' || asset.id::text || '.' || extension, filename, mime, bytes, category, coalesce(alt, ''), auth.uid())
  returning * into asset;
  return asset;
end;
$$;

create function public.media_complete_upload(asset_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare asset public.media_assets;
begin
  if not cms_private.is_active_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into asset from public.media_assets where id = asset_id for update;
  if not found or asset.uploaded_by <> auth.uid() or asset.state <> 'pending' then raise exception 'upload unavailable'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'website-media' and o.name = asset.object_path
      and o.metadata->>'mimetype' = asset.mime_type and (o.metadata->>'size')::bigint = asset.file_size) then
    raise exception 'uploaded object not found or metadata mismatch';
  end if;
  update public.media_assets set state = 'ready', updated_at = now() where id = asset_id;
end;
$$;

create function public.media_update_metadata(asset_id uuid, category text, alt text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not cms_private.is_active_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.media_assets set media_type = category, alt_text = coalesce(alt, ''), updated_at = now()
  where id = asset_id and state = 'ready';
  if not found then raise exception 'media unavailable'; end if;
end;
$$;

create function public.media_begin_delete(asset_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare asset public.media_assets;
begin
  if not cms_private.is_active_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if exists (select 1 from pg_catalog.pg_constraint c
      where c.contype = 'f' and c.confrelid = 'public.media_assets'::regclass) then
    raise exception 'media deletion disabled until reference checks are integrated';
  end if;
  select * into asset from public.media_assets where id = asset_id for update;
  if not found then raise exception 'media unavailable'; end if;
  update public.media_assets set state = 'deleting', updated_at = now() where id = asset_id;
  return asset.object_path;
end;
$$;

create function public.media_finish_delete(asset_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare asset public.media_assets;
begin
  if not cms_private.is_active_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into asset from public.media_assets where id = asset_id for update;
  if not found or asset.state <> 'deleting' then raise exception 'media deletion not started'; end if;
  if exists (select 1 from storage.objects where bucket_id = 'website-media' and name = asset.object_path) then
    raise exception 'storage object still exists';
  end if;
  delete from public.media_assets where id = asset_id;
end;
$$;

revoke all on function public.media_prepare_upload(text, text, bigint, text, text),
  public.media_complete_upload(uuid), public.media_update_metadata(uuid, text, text),
  public.media_begin_delete(uuid), public.media_finish_delete(uuid) from public, anon, authenticated;
grant execute on function public.media_prepare_upload(text, text, bigint, text, text),
  public.media_complete_upload(uuid), public.media_update_metadata(uuid, text, text),
  public.media_begin_delete(uuid), public.media_finish_delete(uuid) to authenticated;
commit;
