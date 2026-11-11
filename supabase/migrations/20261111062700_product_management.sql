begin;

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.product_categories(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 150),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_description text not null default '' check (char_length(short_description) <= 300),
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  display_order integer not null default 0,
  seo_title text not null default '',
  seo_description text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published') = (published_at is not null))
);

create table public.product_images (
  product_id uuid not null references public.products(id) on delete cascade,
  media_id uuid not null references public.media_assets(id) on delete restrict,
  display_order integer not null check (display_order >= 0),
  primary key (product_id, media_id),
  unique (product_id, display_order)
);

create table public.product_benefits (
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  display_order integer not null check (display_order >= 0),
  primary key (product_id, display_order)
);
create table public.product_applications (
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  display_order integer not null check (display_order >= 0),
  primary key (product_id, display_order)
);
create index products_category_idx on public.products (category_id);
create index products_public_order_idx on public.products (display_order, id) where status = 'published';
create index product_images_media_idx on public.product_images (media_id);

create function cms_private.media_has_references(asset_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.product_images where media_id = asset_id)
    or exists (select 1 from pg_catalog.pg_constraint c
      where c.contype = 'f' and c.confrelid = 'public.media_assets'::regclass
        and c.conrelid <> 'public.product_images'::regclass);
$$;
revoke all on function cms_private.media_has_references(uuid) from public, anon, authenticated;

create or replace function cms_private.media_storage_allowed(path text, action text)
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
declare asset public.media_assets;
begin
  if not cms_private.is_active_admin() then return false; end if;
  select * into asset from public.media_assets where object_path = path for update;
  if not found then return false; end if;
  return (action = 'insert' and asset.state = 'pending' and asset.uploaded_by = auth.uid())
    or (action = 'delete' and asset.state = 'deleting' and not cms_private.media_has_references(asset.id));
end;
$$;

create or replace function public.media_begin_delete(asset_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare asset public.media_assets;
begin
  if not cms_private.is_active_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into asset from public.media_assets where id = asset_id for update;
  if not found then raise exception 'media unavailable'; end if;
  if cms_private.media_has_references(asset_id) then raise exception 'media is in use or reference checks require integration'; end if;
  update public.media_assets set state = 'deleting', updated_at = now() where id = asset_id;
  return asset.object_path;
end;
$$;

alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_benefits enable row level security;
alter table public.product_applications enable row level security;
revoke all on public.product_categories, public.products, public.product_images, public.product_benefits, public.product_applications from public, anon, authenticated;
grant select on public.product_categories, public.products, public.product_images, public.product_benefits, public.product_applications to authenticated;
create policy product_categories_admin_read on public.product_categories for select to authenticated using ((select cms_private.is_active_admin()));
create policy products_admin_read on public.products for select to authenticated using ((select cms_private.is_active_admin()));
create policy product_images_admin_read on public.product_images for select to authenticated using ((select cms_private.is_active_admin()));
create policy product_benefits_admin_read on public.product_benefits for select to authenticated using ((select cms_private.is_active_admin()));
create policy product_applications_admin_read on public.product_applications for select to authenticated using ((select cms_private.is_active_admin()));

create function public.save_product_category(category_id uuid, category_name text, category_slug text, category_active boolean, category_order integer)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare saved_id uuid;
begin
  if not cms_private.is_active_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if category_id is null then
    insert into public.product_categories (name, slug, is_active, display_order)
    values (btrim(category_name), category_slug, category_active, category_order) returning id into saved_id;
  else
    perform 1 from public.product_categories where id = category_id for update;
    if not found then raise exception 'category not found'; end if;
    if not category_active and exists (select 1 from public.products p where p.category_id = save_product_category.category_id and p.status = 'published') then
      raise exception 'unpublish products before deactivating this category';
    end if;
    update public.product_categories set name = btrim(category_name), slug = category_slug, is_active = category_active,
      display_order = category_order, updated_at = clock_timestamp() where id = category_id returning id into saved_id;
  end if;
  return saved_id;
end;
$$;

create function public.save_product(payload jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_product_id uuid := nullif(payload->>'id', '')::uuid;
  cat_id uuid := (payload->>'category_id')::uuid;
  target_status text := payload->>'status';
  old_product public.products;
  chosen_media uuid;
  item jsonb;
  position integer;
begin
  if not cms_private.is_active_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if target_status not in ('draft', 'published', 'archived') or target_status is null then raise exception 'invalid status'; end if;
  if jsonb_typeof(payload->'images') is distinct from 'array' or jsonb_typeof(payload->'benefits') is distinct from 'array'
     or jsonb_typeof(payload->'applications') is distinct from 'array' then raise exception 'invalid product lists'; end if;
  if jsonb_array_length(payload->'images') > 10 or jsonb_array_length(payload->'benefits') > 30 or jsonb_array_length(payload->'applications') > 30 then
    raise exception 'product list limit exceeded';
  end if;
  if v_product_id is not null then
    select * into old_product from public.products where id = v_product_id for update;
    if not found then raise exception 'product not found'; end if;
    if (payload->>'updated_at')::timestamptz is distinct from old_product.updated_at then raise exception 'product has changed; reload before saving'; end if;
  end if;
  perform 1 from public.product_categories where id = cat_id and (is_active or (v_product_id is not null and old_product.category_id = cat_id and target_status <> 'published')) for share;
  if not found then raise exception 'select an active category'; end if;
  for item in select value from jsonb_array_elements(payload->'images') loop
    chosen_media := (item #>> '{}')::uuid;
    perform 1 from public.media_assets where id = chosen_media and state = 'ready' for share;
    if not found then raise exception 'media unavailable'; end if;
  end loop;
  if target_status = 'published' and (btrim(coalesce(payload->>'short_description', '')) = ''
     or btrim(coalesce(payload->>'description', '')) = '' or jsonb_array_length(payload->'images') = 0) then
    raise exception 'published products require descriptions and a main image';
  end if;
  if v_product_id is null then
    insert into public.products (category_id, name, slug, short_description, description, status, display_order, seo_title, seo_description, published_at)
    values (cat_id, btrim(payload->>'name'), payload->>'slug', coalesce(payload->>'short_description', ''), coalesce(payload->>'description', ''),
      target_status, coalesce((payload->>'display_order')::integer, 0), coalesce(payload->>'seo_title', ''), coalesce(payload->>'seo_description', ''),
      case when target_status = 'published' then clock_timestamp() else null end) returning id into v_product_id;
  else
    update public.products set category_id = cat_id, name = btrim(payload->>'name'), slug = payload->>'slug',
      short_description = coalesce(payload->>'short_description', ''), description = coalesce(payload->>'description', ''),
      status = target_status, display_order = coalesce((payload->>'display_order')::integer, 0),
      seo_title = coalesce(payload->>'seo_title', ''), seo_description = coalesce(payload->>'seo_description', ''),
      published_at = case when target_status = 'published' then coalesce(old_product.published_at, clock_timestamp()) else null end,
      updated_at = clock_timestamp() where id = v_product_id;
    delete from public.product_images where product_images.product_id = v_product_id;
    delete from public.product_benefits where product_benefits.product_id = v_product_id;
    delete from public.product_applications where product_applications.product_id = v_product_id;
  end if;
  position := 0;
  for item in select value from jsonb_array_elements(payload->'images') loop
    insert into public.product_images values (v_product_id, (item #>> '{}')::uuid, position);
    position := position + 1;
  end loop;
  position := 0;
  for item in select value from jsonb_array_elements(payload->'benefits') loop
    insert into public.product_benefits values (v_product_id, btrim(item #>> '{}'), position);
    position := position + 1;
  end loop;
  position := 0;
  for item in select value from jsonb_array_elements(payload->'applications') loop
    insert into public.product_applications values (v_product_id, btrim(item #>> '{}'), position);
    position := position + 1;
  end loop;
  return v_product_id;
end;
$$;

create function public.public_products(product_slug text default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'slug', p.slug, 'short_description', p.short_description,
    'description', p.description, 'category', c.name, 'category_slug', c.slug,
    'seo_title', p.seo_title, 'seo_description', p.seo_description,
    'images', coalesce((select jsonb_agg(jsonb_build_object('path', m.object_path, 'alt', m.alt_text) order by i.display_order)
      from public.product_images i join public.media_assets m on m.id = i.media_id and m.state = 'ready' where i.product_id = p.id), '[]'::jsonb),
    'benefits', coalesce((select jsonb_agg(b.title order by b.display_order) from public.product_benefits b where b.product_id = p.id), '[]'::jsonb),
    'applications', coalesce((select jsonb_agg(a.title order by a.display_order) from public.product_applications a where a.product_id = p.id), '[]'::jsonb)
  ) order by p.display_order, p.id), '[]'::jsonb)
  from public.products p join public.product_categories c on c.id = p.category_id and c.is_active
  where p.status = 'published' and (product_slug is null or p.slug = product_slug);
$$;

revoke all on function public.save_product(jsonb), public.save_product_category(uuid, text, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.save_product(jsonb), public.save_product_category(uuid, text, text, boolean, integer) to authenticated;
revoke all on function public.public_products(text) from public, anon, authenticated;
grant execute on function public.public_products(text) to anon, authenticated;

insert into public.product_categories (name, slug, display_order) values
('Stabilisasi', 'stabilisasi', 0), ('Suhu & kelembapan', 'suhu-kelembapan', 1),
('Keamanan', 'keamanan', 2), ('Kemasan curah', 'kemasan-curah', 3);
insert into public.products (category_id, name, slug, short_description, display_order)
select c.id, p.name, p.slug, p.short_description, p.display_order
from (values
 ('Dunnage Bag', 'dunnage-bag', 'stabilisasi', 'Menahan muatan agar tidak bergeser di dalam kontainer.', 0),
 ('Thermal Liner', 'thermal-liner', 'suhu-kelembapan', 'Melindungi barang dari suhu dan kelembapan ekstrem.', 1),
 ('Security Seal', 'security-seal', 'keamanan', 'Menjaga integritas kiriman dan mencegah tampering.', 2),
 ('Jumbo Bag', 'jumbo-bag', 'kemasan-curah', 'Mengangkut muatan curah volume besar dengan efisien.', 3),
 ('Desiccant', 'desiccant', 'suhu-kelembapan', 'Menyerap uap air untuk mencegah kondensasi.', 4),
 ('Bag in Box', 'bag-in-box', 'kemasan-curah', 'Kemasan cair yang efisien dan higienis.', 5)
) as p(name, slug, category_slug, short_description, display_order)
join public.product_categories c on c.slug = p.category_slug;
commit;
