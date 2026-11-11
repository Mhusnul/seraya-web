-- Website settings.
begin;

create table public.website_settings (
  singleton boolean primary key default true check (singleton),
  company_display_name text not null check (char_length(btrim(company_display_name)) between 2 and 150),
  logo_media_id uuid references public.media_assets(id) on delete restrict,
  whatsapp_number text not null check (whatsapp_number ~ '^[1-9][0-9]{7,14}$'),
  sales_email text not null check (
    char_length(sales_email) <= 254
    and sales_email = lower(sales_email)
    and sales_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  general_email text not null check (
    char_length(general_email) <= 254
    and general_email = lower(general_email)
    and general_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  copyright_text text not null default '' check (char_length(copyright_text) <= 200),
  default_seo_title text not null default '' check (char_length(default_seo_title) <= 120),
  default_seo_description text not null default '' check (char_length(default_seo_description) <= 320),
  default_og_image_media_id uuid references public.media_assets(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

alter table public.website_settings enable row level security;
revoke all on public.website_settings from public, anon, authenticated;
grant select on public.website_settings to authenticated;

create policy website_settings_super_admin_read
on public.website_settings for select to authenticated
using ((select cms_private.is_active_super_admin()));

insert into public.website_settings (
  company_display_name, whatsapp_number, sales_email, general_email, copyright_text
) values (
  'PT. Seraya Semesta Indonesia',
  '628111611177',
  'sales@serayasemesta.com',
  'info@serayasemesta.com',
  '© 2026 PT. Seraya Semesta Indonesia'
);

create or replace function cms_private.media_has_references(asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.product_images where media_id = asset_id)
    or exists (select 1 from public.article_media where media_id = asset_id)
    or exists (select 1 from public.articles where cover_media_id = asset_id)
    or exists (
      select 1 from public.website_settings
      where logo_media_id = asset_id or default_og_image_media_id = asset_id
    )
    or exists (
      select 1 from pg_catalog.pg_constraint c
      where c.contype = 'f'
        and c.confrelid = 'public.media_assets'::regclass
        and c.conrelid not in (
          'public.product_images'::regclass,
          'public.article_media'::regclass,
          'public.articles'::regclass,
          'public.website_settings'::regclass
        )
    );
$$;
revoke all on function cms_private.media_has_references(uuid)
from public, anon, authenticated, service_role;

create function public.save_website_settings(payload jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  company_name text := btrim(coalesce(payload->>'company_display_name', ''));
  whatsapp text := pg_catalog.regexp_replace(coalesce(payload->>'whatsapp_number', ''), '[^0-9]', '', 'g');
  sales text := pg_catalog.lower(btrim(coalesce(payload->>'sales_email', '')));
  general text := pg_catalog.lower(btrim(coalesce(payload->>'general_email', '')));
  copyright text := btrim(coalesce(payload->>'copyright_text', ''));
  seo_title text := btrim(coalesce(payload->>'default_seo_title', ''));
  seo_description text := btrim(coalesce(payload->>'default_seo_description', ''));
  logo_id uuid;
  og_id uuid;
  saved_at timestamptz;
begin
  if not cms_private.is_active_super_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'invalid settings payload' using errcode = '22023';
  end if;
  if char_length(company_name) not between 2 and 150 then
    raise exception 'company name must be between 2 and 150 characters' using errcode = '22023';
  end if;
  if whatsapp !~ '^[1-9][0-9]{7,14}$' then
    raise exception 'invalid WhatsApp number' using errcode = '22023';
  end if;
  if char_length(sales) > 254 or sales !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid sales email' using errcode = '22023';
  end if;
  if char_length(general) > 254 or general !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid general email' using errcode = '22023';
  end if;
  if char_length(copyright) > 200 or char_length(seo_title) > 120 or char_length(seo_description) > 320 then
    raise exception 'settings field exceeds the maximum length' using errcode = '22023';
  end if;

  if nullif(payload->>'logo_media_id', '') is not null then
    if payload->>'logo_media_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'invalid logo media reference' using errcode = '22023';
    end if;
    logo_id := (payload->>'logo_media_id')::uuid;
    if not exists (select 1 from public.media_assets where id = logo_id and state = 'ready') then
      raise exception 'logo media unavailable' using errcode = '22023';
    end if;
  end if;

  if nullif(payload->>'default_og_image_media_id', '') is not null then
    if payload->>'default_og_image_media_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'invalid Open Graph media reference' using errcode = '22023';
    end if;
    og_id := (payload->>'default_og_image_media_id')::uuid;
    if not exists (select 1 from public.media_assets where id = og_id and state = 'ready') then
      raise exception 'Open Graph media unavailable' using errcode = '22023';
    end if;
  end if;

  insert into public.website_settings (
    singleton, company_display_name, logo_media_id, whatsapp_number,
    sales_email, general_email, copyright_text, default_seo_title,
    default_seo_description, default_og_image_media_id, updated_by, updated_at
  ) values (
    true, company_name, logo_id, whatsapp, sales, general, copyright,
    seo_title, seo_description, og_id, auth.uid(), pg_catalog.clock_timestamp()
  )
  on conflict (singleton) do update set
    company_display_name = excluded.company_display_name,
    logo_media_id = excluded.logo_media_id,
    whatsapp_number = excluded.whatsapp_number,
    sales_email = excluded.sales_email,
    general_email = excluded.general_email,
    copyright_text = excluded.copyright_text,
    default_seo_title = excluded.default_seo_title,
    default_seo_description = excluded.default_seo_description,
    default_og_image_media_id = excluded.default_og_image_media_id,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning updated_at into saved_at;
  return saved_at;
end;
$$;
revoke all on function public.save_website_settings(jsonb)
from public, anon, authenticated;
grant execute on function public.save_website_settings(jsonb) to authenticated;

create function public.public_website_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'company_display_name', s.company_display_name,
    'logo_path', logo.object_path,
    'logo_alt', coalesce(logo.alt_text, ''),
    'whatsapp_number', s.whatsapp_number,
    'sales_email', s.sales_email,
    'general_email', s.general_email,
    'copyright_text', s.copyright_text,
    'default_seo_title', s.default_seo_title,
    'default_seo_description', s.default_seo_description,
    'default_og_image_path', og.object_path,
    'default_og_image_alt', coalesce(og.alt_text, '')
  )
  from public.website_settings s
  left join public.media_assets logo on logo.id = s.logo_media_id and logo.state = 'ready'
  left join public.media_assets og on og.id = s.default_og_image_media_id and og.state = 'ready'
  where s.singleton;
$$;
revoke all on function public.public_website_settings() from public, anon, authenticated;
grant execute on function public.public_website_settings() to anon, authenticated;

commit;
