-- MAAT Firma Legal — esquema de base de datos
-- Ejecutar completo en Supabase: Dashboard > SQL Editor > New query > Run
-- Es seguro volver a ejecutar este archivo completo las veces que haga falta.

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
  owner_id     uuid references auth.users(id) on delete set null, -- quién creó/es dueño de la propiedad
  featured     boolean not null default false, -- solo un administrador puede marcarla (ver trigger más abajo); aparece más veces en el carrusel
  sort_order   integer not null default 0,
  status       text not null default 'available' check (status in ('available', 'sold')),
  created_at   timestamptz not null default now()
);

-- Si la tabla ya existía de una versión anterior del esquema, agrega las columnas nuevas.
alter table public.properties add column if not exists whatsapp text;
alter table public.properties add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.properties add column if not exists featured boolean not null default false;

create index if not exists properties_sort_order_idx on public.properties (sort_order);
create index if not exists properties_status_idx on public.properties (status);
create index if not exists properties_owner_id_idx on public.properties (owner_id);

-- ── Tabla profiles (rol y estado de cada usuario) ────────────────
-- Todo usuario de Supabase Auth (admin creado a mano, o agente invitado)
-- obtiene automáticamente una fila aquí vía el trigger de abajo.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  role        text not null default 'agent' check (role in ('admin', 'agent')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Crea automáticamente el profile de cualquier usuario nuevo (admin o agente).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'agent')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Crea el profile de cualquier usuario que ya existiera antes de correr esto.
insert into public.profiles (id, email, role)
select id, email, 'agent' from auth.users
on conflict (id) do nothing;

-- ⚠️ IMPORTANTE: ajusta esta lista con los correos que deben ser administradores
-- (acceso total: todas las propiedades, Marcas, Administradores). Cualquier
-- otro usuario queda como 'agent' (solo ve/edita sus propias propiedades).
update public.profiles set role = 'admin'
where email in ('kunabox14@gmail.com', 'laboratoriovisnity@gmail.com');

-- ── Funciones helper de permisos (usadas en las políticas RLS) ───
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false);
$$;

-- Evita que un agente marque sus propias propiedades como "destacadas".
create or replace function public.protect_featured_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and new.featured is distinct from old.featured then
    new.featured := old.featured;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_featured on public.properties;
create trigger protect_featured
  before update on public.properties
  for each row execute function public.protect_featured_column();

-- ── RLS: properties ───────────────────────────────────────────────
alter table public.properties enable row level security;

-- El landing público solo puede leer propiedades disponibles
drop policy if exists "public can read available properties" on public.properties;
create policy "public can read available properties"
  on public.properties for select
  to anon
  using (status = 'available');

-- Cualquier usuario autenticado (admin o agente) puede leer todo
drop policy if exists "authenticated can read all properties" on public.properties;
create policy "authenticated can read all properties"
  on public.properties for select
  to authenticated
  using (true);

-- Un agente activo solo puede crear propiedades a su propio nombre; un admin también
drop policy if exists "authenticated can insert properties" on public.properties;
drop policy if exists "authenticated can insert own properties" on public.properties;
create policy "owner can insert own properties"
  on public.properties for insert
  to authenticated
  with check (owner_id = auth.uid() and public.is_active_user());

-- Solo el dueño (si está activo) o un admin pueden editar
drop policy if exists "authenticated can update properties" on public.properties;
drop policy if exists "owner or admin can update properties" on public.properties;
create policy "owner or admin can update properties"
  on public.properties for update
  to authenticated
  using ((owner_id = auth.uid() and public.is_active_user()) or public.is_admin())
  with check ((owner_id = auth.uid() and public.is_active_user()) or public.is_admin());

-- Solo el dueño (si está activo) o un admin pueden borrar
drop policy if exists "authenticated can delete properties" on public.properties;
drop policy if exists "owner or admin can delete properties" on public.properties;
create policy "owner or admin can delete properties"
  on public.properties for delete
  to authenticated
  using ((owner_id = auth.uid() and public.is_active_user()) or public.is_admin());

-- ── RLS: profiles ─────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "admin can read all profiles" on public.profiles;
create policy "admin can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admin can update profiles" on public.profiles;
create policy "admin can update profiles"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Storage: bucket de fotos de propiedades ─────────────────────
-- Cualquier autenticado activo puede subir/editar fotos (la propiedad a la que
-- se asocian ya está protegida por su propia política de owner_id arriba).
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
  with check (bucket_id = 'property-photos' and public.is_active_user());

drop policy if exists "authenticated can update property photos" on storage.objects;
create policy "authenticated can update property photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'property-photos' and public.is_active_user());

drop policy if exists "authenticated can delete property photos" on storage.objects;
create policy "authenticated can delete property photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'property-photos' and public.is_active_user());

-- ── Tabla partners (logos de empresas aliadas, franja del landing) ──
-- Solo administradores gestionan las marcas de la firma (los agentes no).
create table if not exists public.partners (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default '',
  logo_url     text not null,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists partners_sort_order_idx on public.partners (sort_order);

alter table public.partners enable row level security;

drop policy if exists "public can read partners" on public.partners;
create policy "public can read partners"
  on public.partners for select
  to anon
  using (true);

drop policy if exists "authenticated can read all partners" on public.partners;
create policy "authenticated can read all partners"
  on public.partners for select
  to authenticated
  using (true);

drop policy if exists "authenticated can insert partners" on public.partners;
drop policy if exists "admin can insert partners" on public.partners;
create policy "admin can insert partners"
  on public.partners for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "authenticated can update partners" on public.partners;
drop policy if exists "admin can update partners" on public.partners;
create policy "admin can update partners"
  on public.partners for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "authenticated can delete partners" on public.partners;
drop policy if exists "admin can delete partners" on public.partners;
create policy "admin can delete partners"
  on public.partners for delete
  to authenticated
  using (public.is_admin());

-- ── Storage: bucket de logos de empresas aliadas ─────────────────
insert into storage.buckets (id, name, public)
values ('partner-logos', 'partner-logos', true)
on conflict (id) do nothing;

drop policy if exists "public can view partner logos" on storage.objects;
create policy "public can view partner logos"
  on storage.objects for select
  to public
  using (bucket_id = 'partner-logos');

drop policy if exists "authenticated can upload partner logos" on storage.objects;
drop policy if exists "admin can upload partner logos" on storage.objects;
create policy "admin can upload partner logos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'partner-logos' and public.is_admin());

drop policy if exists "authenticated can update partner logos" on storage.objects;
drop policy if exists "admin can update partner logos" on storage.objects;
create policy "admin can update partner logos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'partner-logos' and public.is_admin());

drop policy if exists "authenticated can delete partner logos" on storage.objects;
drop policy if exists "admin can delete partner logos" on storage.objects;
create policy "admin can delete partner logos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'partner-logos' and public.is_admin());
