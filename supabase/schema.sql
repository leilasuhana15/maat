-- MAAT Firma Legal — esquema de base de datos
-- Ejecutar completo en Supabase: Dashboard > SQL Editor > New query > Run

-- ── Tabla properties ─────────────────────────────────────────────
create table if not exists public.properties (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  location     text not null,
  price        text not null,
  area         text not null,
  rooms        text not null,
  baths        text not null,
  description  text not null default '',
  photos       text[] not null default '{}',
  whatsapp     text, -- número de contacto específico de la propiedad; si es NULL, el landing usa el número general de la firma
  sort_order   integer not null default 0,
  status       text not null default 'available' check (status in ('available', 'sold')),
  created_at   timestamptz not null default now()
);

-- Si la tabla ya existía de una versión anterior del esquema, agrega la columna nueva.
alter table public.properties add column if not exists whatsapp text;

create index if not exists properties_sort_order_idx on public.properties (sort_order);
create index if not exists properties_status_idx on public.properties (status);

alter table public.properties enable row level security;

-- El landing público solo puede leer propiedades disponibles
drop policy if exists "public can read available properties" on public.properties;
create policy "public can read available properties"
  on public.properties for select
  to anon
  using (status = 'available');

-- Los administradores autenticados pueden leer todo (disponibles + vendidas)
drop policy if exists "authenticated can read all properties" on public.properties;
create policy "authenticated can read all properties"
  on public.properties for select
  to authenticated
  using (true);

-- Solo administradores autenticados pueden crear, editar y borrar
drop policy if exists "authenticated can insert properties" on public.properties;
create policy "authenticated can insert properties"
  on public.properties for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated can update properties" on public.properties;
create policy "authenticated can update properties"
  on public.properties for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated can delete properties" on public.properties;
create policy "authenticated can delete properties"
  on public.properties for delete
  to authenticated
  using (true);

-- ── Storage: bucket de fotos de propiedades ─────────────────────
insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', true)
on conflict (id) do nothing;

drop policy if exists "public can view property photos" on storage.objects;
create policy "public can view property photos"
  on storage.objects for select
  to public
  using (bucket_id = 'property-photos');

drop policy if exists "authenticated can upload property photos" on storage.objects;
create policy "authenticated can upload property photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'property-photos');

drop policy if exists "authenticated can update property photos" on storage.objects;
create policy "authenticated can update property photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'property-photos');

drop policy if exists "authenticated can delete property photos" on storage.objects;
create policy "authenticated can delete property photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'property-photos');
