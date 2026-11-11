-- Inquiry management.
begin;

create table public.inquiries (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 150),
  company_name text not null default '' check (char_length(company_name) <= 200),
  email text not null check (
    char_length(email) <= 254
    and email = lower(email)
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  phone text not null default '' check (char_length(phone) <= 40),
  inquiry_type text not null check (inquiry_type in ('product', 'general', 'partnership', 'other')),
  message text not null check (char_length(btrim(message)) between 10 and 5000),
  product_id uuid references public.products(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed', 'spam')),
  admin_notes text not null default '' check (char_length(admin_notes) <= 5000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index inquiries_created_at_idx on public.inquiries (created_at desc, id desc);
create index inquiries_status_created_at_idx on public.inquiries (status, created_at desc, id desc);

alter table public.inquiries enable row level security;
revoke all on public.inquiries from public, anon, authenticated;
grant select on public.inquiries to authenticated;

create policy inquiries_super_admin_read
on public.inquiries for select to authenticated
using ((select cms_private.is_active_super_admin()));

create function public.submit_inquiry(
  p_full_name text,
  p_company_name text,
  p_email text,
  p_phone text,
  p_inquiry_type text,
  p_message text,
  p_product_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
  normalized_email text := lower(btrim(coalesce(p_email, '')));
begin
  if char_length(btrim(coalesce(p_full_name, ''))) not between 2 and 150 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_company_name, ''))) > 200 then
    raise exception 'company name is too long' using errcode = '22023';
  end if;
  if char_length(normalized_email) > 254
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid email address' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_phone, ''))) > 40 then
    raise exception 'phone number is too long' using errcode = '22023';
  end if;
  if p_inquiry_type is null or p_inquiry_type not in ('product', 'general', 'partnership', 'other') then
    raise exception 'invalid inquiry type' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_message, ''))) not between 10 and 5000 then
    raise exception 'message must be between 10 and 5000 characters' using errcode = '22023';
  end if;
  if p_product_id is not null and not exists (
    select 1
    from public.products p
    join public.product_categories c on c.id = p.category_id
    where p.id = p_product_id and p.status = 'published' and c.is_active
  ) then
    raise exception 'product unavailable' using errcode = '22023';
  end if;

  insert into public.inquiries (full_name, company_name, email, phone, inquiry_type, message, product_id)
  values (
    btrim(p_full_name),
    btrim(coalesce(p_company_name, '')),
    normalized_email,
    btrim(coalesce(p_phone, '')),
    p_inquiry_type,
    btrim(p_message),
    p_product_id
  )
  returning id into saved_id;

  return saved_id;
end;
$$;

revoke all on function public.submit_inquiry(text, text, text, text, text, text, uuid)
from public, anon, authenticated;
grant execute on function public.submit_inquiry(text, text, text, text, text, text, uuid)
to anon, authenticated;

create function public.update_inquiry(
  p_inquiry_id uuid,
  p_status text,
  p_admin_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not cms_private.is_active_super_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('new', 'contacted', 'qualified', 'closed', 'spam') then
    raise exception 'invalid inquiry status' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_admin_notes, ''))) > 5000 then
    raise exception 'admin notes are too long' using errcode = '22023';
  end if;

  update public.inquiries
  set status = p_status,
      admin_notes = btrim(coalesce(p_admin_notes, '')),
      updated_at = pg_catalog.clock_timestamp()
  where id = p_inquiry_id;

  if not found then
    raise exception 'inquiry not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.update_inquiry(uuid, text, text) from public, anon, authenticated;
grant execute on function public.update_inquiry(uuid, text, text) to authenticated;

commit;
