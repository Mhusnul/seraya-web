begin;

create table public.article_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.article_categories(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 5 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text not null default '' check (char_length(excerpt) <= 300),
  content jsonb not null,
  cover_media_id uuid references public.media_assets(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  author_name text not null default '',
  published_at timestamptz,
  reading_time integer not null default 1 check (reading_time > 0),
  seo_title text not null default '',
  seo_description text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_featured or status = 'published'),
  check (status <> 'published' or published_at is not null)
);
create unique index articles_one_featured_idx on public.articles (is_featured) where is_featured and status = 'published';
create index articles_public_order_idx on public.articles (published_at desc, id desc) where status = 'published';
create index articles_category_idx on public.articles (category_id);
create index articles_cover_idx on public.articles (cover_media_id);

create table public.article_media (
  article_id uuid not null references public.articles(id) on delete cascade,
  media_id uuid not null references public.media_assets(id) on delete restrict,
  primary key (article_id, media_id)
);
create index article_media_media_idx on public.article_media (media_id);
create table public.article_related_products (
  article_id uuid not null references public.articles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  display_order integer not null check (display_order >= 0),
  primary key (article_id, product_id),
  unique (article_id, display_order)
);
create index article_related_products_product_idx on public.article_related_products (product_id);

alter table public.article_categories enable row level security;
alter table public.articles enable row level security;
alter table public.article_media enable row level security;
alter table public.article_related_products enable row level security;
revoke all on public.article_categories, public.articles, public.article_media, public.article_related_products from public, anon, authenticated;
grant select on public.article_categories, public.articles, public.article_media, public.article_related_products to authenticated;
create policy article_categories_admin_read on public.article_categories for select to authenticated using ((select cms_private.is_active_admin()));
create policy articles_admin_read on public.articles for select to authenticated using ((select cms_private.is_active_admin()));
create policy article_media_admin_read on public.article_media for select to authenticated using ((select cms_private.is_active_admin()));
create policy article_products_admin_read on public.article_related_products for select to authenticated using ((select cms_private.is_active_admin()));

create or replace function cms_private.media_has_references(asset_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.product_images where media_id = asset_id)
    or exists (select 1 from public.article_media where media_id = asset_id)
    or exists (select 1 from public.articles where cover_media_id = asset_id)
    or exists (select 1 from pg_catalog.pg_constraint c
      where c.contype = 'f' and c.confrelid = 'public.media_assets'::regclass
        and c.conrelid not in ('public.product_images'::regclass, 'public.article_media'::regclass, 'public.articles'::regclass));
$$;

create function cms_private.valid_article_node(node jsonb, depth integer default 0)
returns boolean language plpgsql immutable set search_path = ''
as $$
declare kind text; child jsonb; mark jsonb;
begin
  if depth > 16 or jsonb_typeof(node) <> 'object' then return false; end if;
  kind := node->>'type';
  if kind is null or kind not in ('doc', 'paragraph', 'heading', 'text', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'hardBreak', 'image') then return false; end if;
  if kind = 'heading' and coalesce(node->'attrs'->>'level', '') not in ('2', '3') then return false; end if;
  if kind = 'doc' and depth <> 0 then return false; end if;
  if kind = 'text' and (jsonb_typeof(node->'text') is distinct from 'string' or length(node->>'text') not between 1 and 20000) then return false; end if;
  if kind = 'image' and (coalesce(node->'attrs'->>'mediaId', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or length(coalesce(node->'attrs'->>'alt', '')) > 500 or length(coalesce(node->'attrs'->>'caption', '')) > 500) then return false; end if;
  if node ? 'marks' then
    if kind <> 'text' or jsonb_typeof(node->'marks') <> 'array' then return false; end if;
    for mark in select value from jsonb_array_elements(node->'marks') loop
      if coalesce(mark->>'type','') not in ('bold','italic','link') then return false; end if;
      if mark->>'type' = 'link' and coalesce(mark->'attrs'->>'href','') !~* '^https?://[^[:space:]]+$' then return false; end if;
    end loop;
  end if;
  if node ? 'content' then
    if kind in ('text', 'image', 'hardBreak') or jsonb_typeof(node->'content') <> 'array' then return false; end if;
    for child in select value from jsonb_array_elements(node->'content') loop
      if (kind in ('doc', 'blockquote', 'listItem') and coalesce(child->>'type','') not in ('paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'image'))
        or (kind in ('paragraph', 'heading') and coalesce(child->>'type','') not in ('text', 'hardBreak'))
        or (kind in ('bulletList', 'orderedList') and coalesce(child->>'type','') <> 'listItem') then return false; end if;
      if not cms_private.valid_article_node(child, depth + 1) then return false; end if;
    end loop;
  end if;
  return true;
end;
$$;
revoke all on function cms_private.valid_article_node(jsonb, integer) from public, anon, authenticated;

create function public.save_article_category(category_id uuid, category_name text, category_slug text, category_active boolean, category_order integer)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare saved_id uuid;
begin
  if not cms_private.is_active_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if category_id is null then
    insert into public.article_categories (name, slug, is_active, display_order) values (btrim(category_name), category_slug, category_active, category_order) returning id into saved_id;
  else
    perform 1 from public.article_categories where id = category_id for update;
    if not found then raise exception 'category not found'; end if;
    if not category_active and exists (select 1 from public.articles a where a.category_id = save_article_category.category_id and a.status = 'published') then
      raise exception 'unpublish articles before deactivating this category';
    end if;
    update public.article_categories set name = btrim(category_name), slug = category_slug, is_active = category_active, display_order = category_order, updated_at = clock_timestamp()
    where id = category_id returning id into saved_id;
  end if;
  return saved_id;
end;
$$;

create function public.save_article(payload jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := nullif(payload->>'id','')::uuid;
  cat_id uuid := (payload->>'category_id')::uuid;
  cover_id uuid := nullif(payload->>'cover_media_id','')::uuid;
  target_status text := payload->>'status';
  old_article public.articles;
  image_id uuid;
  product_id uuid;
  item jsonb;
  position integer := 0;
  words text;
begin
  if not cms_private.is_active_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if target_status is null or target_status not in ('draft','published','archived') then raise exception 'invalid status'; end if;
  if payload->'content'->>'type' is distinct from 'doc' or not cms_private.valid_article_node(payload->'content')
      or octet_length((payload->'content')::text) > 500000 then raise exception 'invalid article content'; end if;
  if jsonb_typeof(payload->'related_products') is distinct from 'array' or jsonb_array_length(payload->'related_products') > 10 then raise exception 'invalid related products'; end if;
  if v_id is not null then
    select * into old_article from public.articles where id = v_id for update;
    if not found then raise exception 'article not found'; end if;
    if (payload->>'updated_at')::timestamptz is distinct from old_article.updated_at then raise exception 'article has changed; reload before saving'; end if;
  end if;
  perform 1 from public.article_categories where id = cat_id and (is_active or (v_id is not null and old_article.category_id = cat_id and target_status <> 'published')) for share;
  if not found then raise exception 'select an active category'; end if;
  if cover_id is not null then
    perform 1 from public.media_assets where id = cover_id and state = 'ready' for share;
    if not found then raise exception 'media unavailable'; end if;
  end if;
  for item in select value from jsonb_path_query(payload->'content', 'strict $.** ? (@.type == "image")') as value loop
    image_id := (item->'attrs'->>'mediaId')::uuid;
    perform 1 from public.media_assets where id = image_id and state = 'ready' for share;
    if not found then raise exception 'media unavailable'; end if;
  end loop;
  select string_agg(value #>> '{}', ' ') into words from jsonb_path_query(payload->'content', 'strict $.** ? (@.type == "text").text') as value;
  if target_status = 'published' and (btrim(coalesce(payload->>'excerpt','')) = '' or btrim(coalesce(words,'')) = '' or cover_id is null) then raise exception 'published articles require excerpt, content and cover'; end if;
  if v_id is null then
    insert into public.articles (category_id, title, slug, excerpt, content, cover_media_id, status, is_featured, author_name, seo_title, seo_description, published_at, reading_time, created_by, updated_by)
    values (cat_id, btrim(payload->>'title'), payload->>'slug', coalesce(payload->>'excerpt',''), payload->'content', cover_id, target_status,
      target_status = 'published' and coalesce((payload->>'is_featured')::boolean,false), coalesce(payload->>'author_name',''),
      coalesce(payload->>'seo_title',''), coalesce(payload->>'seo_description',''), case when target_status = 'published' then clock_timestamp() end,
      greatest(1, ceil(coalesce(array_length(regexp_split_to_array(btrim(coalesce(words,'')), '\s+'),1),0) / 200.0)::integer), auth.uid(), auth.uid()) returning id into v_id;
  else
    update public.articles set category_id = cat_id, title = btrim(payload->>'title'), slug = payload->>'slug',
      excerpt = coalesce(payload->>'excerpt',''), content = payload->'content', cover_media_id = cover_id, status = target_status,
      is_featured = target_status = 'published' and coalesce((payload->>'is_featured')::boolean,false),
      author_name = coalesce(payload->>'author_name',''), seo_title = coalesce(payload->>'seo_title',''), seo_description = coalesce(payload->>'seo_description',''),
      published_at = case when target_status = 'published' then coalesce(old_article.published_at, clock_timestamp()) else old_article.published_at end,
      reading_time = greatest(1, ceil(coalesce(array_length(regexp_split_to_array(btrim(coalesce(words,'')), '\s+'),1),0) / 200.0)::integer),
      updated_by = auth.uid(), updated_at = clock_timestamp() where id = v_id;
    delete from public.article_media where article_id = v_id;
    delete from public.article_related_products where article_id = v_id;
  end if;
  for item in select value from jsonb_path_query(payload->'content', 'strict $.** ? (@.type == "image")') as value loop
    insert into public.article_media values (v_id, (item->'attrs'->>'mediaId')::uuid) on conflict do nothing;
  end loop;
  for item in select value from jsonb_array_elements(payload->'related_products') loop
    product_id := (item #>> '{}')::uuid;
    perform 1 from public.products where id = product_id and status = 'published' for share;
    if not found then raise exception 'related product unavailable'; end if;
    insert into public.article_related_products values (v_id, product_id, position);
    position := position + 1;
  end loop;
  return v_id;
end;
$$;

create function public.public_articles(article_slug text default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'title', a.title, 'slug', a.slug, 'excerpt', a.excerpt, 'content', a.content,
    'category', c.name, 'category_slug', c.slug, 'published_at', a.published_at, 'is_featured', a.is_featured,
    'reading_time', a.reading_time, 'author_name', a.author_name, 'seo_title', a.seo_title, 'seo_description', a.seo_description,
    'cover', (select jsonb_build_object('path', m.object_path, 'alt', m.alt_text) from public.media_assets m where m.id = a.cover_media_id and m.state = 'ready'),
    'media', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'path', m.object_path) order by m.id) from public.article_media am join public.media_assets m on m.id = am.media_id and m.state = 'ready' where am.article_id = a.id), '[]'::jsonb),
    'related_products', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'slug', p.slug) order by rp.display_order) from public.article_related_products rp join public.products p on p.id = rp.product_id and p.status = 'published' join public.product_categories pc on pc.id = p.category_id and pc.is_active where rp.article_id = a.id), '[]'::jsonb)
  ) order by a.published_at desc, a.id desc), '[]'::jsonb)
  from public.articles a join public.article_categories c on c.id = a.category_id and c.is_active
  where a.status = 'published' and a.published_at <= now() and article_slug is not null and a.slug = article_slug;
$$;

create function public.public_article_listing(search_text text default '', category_filter text default '', page_number integer default 0, exclude_article uuid default null, show_featured boolean default true)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with eligible as materialized (
    select a.id, a.title, a.slug, a.excerpt, a.published_at, a.is_featured, a.reading_time,
      c.name as category, c.slug as category_slug, m.object_path, m.alt_text
    from public.articles a
    join public.article_categories c on c.id = a.category_id and c.is_active
    left join public.media_assets m on m.id = a.cover_media_id and m.state = 'ready'
    where a.status = 'published' and a.published_at <= now()
      and (exclude_article is null or a.id <> exclude_article)
      and (coalesce(category_filter, '') = '' or c.slug = category_filter)
      and (coalesce(search_text, '') = '' or strpos(lower(a.title), lower(left(search_text, 180))) > 0)
  ), cards as (
    select e.*, jsonb_build_object('id', e.id, 'title', e.title, 'slug', e.slug, 'excerpt', e.excerpt,
      'published_at', e.published_at, 'is_featured', e.is_featured, 'reading_time', e.reading_time,
      'category', e.category, 'category_slug', e.category_slug,
      'cover', case when e.object_path is null then null else jsonb_build_object('path', e.object_path, 'alt', e.alt_text) end) as card
    from eligible e
  )
  select jsonb_build_object(
    'featured', (select card from cards where show_featured and is_featured limit 1),
    'items', coalesce((select jsonb_agg(card order by published_at desc, id desc) from
      (select * from cards where not (show_featured and is_featured) order by published_at desc, id desc
       limit 9 offset (greatest(0, least(coalesce(page_number, 0), 100000)) * 9)) page), '[]'::jsonb),
    'count', (select count(*) from cards where not (show_featured and is_featured)),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug) order by c.display_order, c.name)
      from public.article_categories c where c.is_active and exists
      (select 1 from public.articles a where a.category_id = c.id and a.status = 'published' and a.published_at <= now())), '[]'::jsonb)
  );
$$;

revoke all on function public.save_article(jsonb), public.save_article_category(uuid, text, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.save_article(jsonb), public.save_article_category(uuid, text, text, boolean, integer) to authenticated;
revoke all on function public.public_articles(text) from public, anon, authenticated;
grant execute on function public.public_articles(text) to anon, authenticated;
revoke all on function public.public_article_listing(text, text, integer, uuid, boolean) from public, anon, authenticated;
grant execute on function public.public_article_listing(text, text, integer, uuid, boolean) to anon, authenticated;

insert into public.article_categories (name, slug, display_order) values
('Cargo Protection', 'cargo-protection', 0), ('Packaging', 'packaging', 1),
('Logistics', 'logistics', 2), ('Industrial Insights', 'industrial-insights', 3);
commit;
