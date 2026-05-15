-- ============================================================
-- Umai Sushi · Migración multi-tenant (Phase 1) · 2026-05-15
-- ============================================================
-- Agrega:
--   1. Tabla `negocios` (owner_id → auth.users) con RLS estricto
--   2. Columna `negocio_id` en productos/pedidos/zonas_delivery (NULLABLE)
--      con FK + índice
-- NO toca el RLS permisivo de productos/pedidos/zonas — eso se aprieta
-- en Phase 6 (cleanup), una vez que el dashboard con auth reemplazó a
-- cocina.html. Si lo cerráramos ahora, cocina dejaría de funcionar
-- porque todavía corre con anon key.
--
-- POST-MIGRACIÓN MANUAL (ver MIGRATIONS.md):
--   1. Crear user en Supabase Studio → Authentication → Users → Add user
--   2. Correr el SQL del "Setup primer negocio" que está en MIGRATIONS.md
--      (inserta row en negocios + backfill de negocio_id en datos
--      existentes)
-- ============================================================

-- ============================================================
-- 1) Tabla `negocios`
-- ============================================================
create table if not exists negocios (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid references auth.users(id) on delete cascade,
    slug text unique not null,
    nombre_negocio text not null,
    telefono_negocio text,
    google_sheet_url text,
    activo boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists negocios_slug_idx on negocios (slug);
create index if not exists negocios_owner_idx on negocios (owner_id);
create index if not exists negocios_activo_idx on negocios (activo);

-- ============================================================
-- 2) FK negocio_id en tablas existentes (NULLABLE durante transición)
-- ============================================================
alter table productos      add column if not exists negocio_id uuid references negocios(id) on delete cascade;
alter table pedidos        add column if not exists negocio_id uuid references negocios(id) on delete cascade;
alter table zonas_delivery add column if not exists negocio_id uuid references negocios(id) on delete cascade;

create index if not exists productos_negocio_idx on productos (negocio_id);
create index if not exists pedidos_negocio_idx   on pedidos (negocio_id);
create index if not exists zonas_negocio_idx     on zonas_delivery (negocio_id);

-- ============================================================
-- 3) RLS estricto en `negocios`
-- ============================================================
alter table negocios enable row level security;

-- SELECT: público — necesario para resolver slug → id en cliente
-- público (el catálogo) sin login.
drop policy if exists "negocios_public_select" on negocios;
create policy "negocios_public_select" on negocios
    for select to anon, authenticated using (true);

-- UPDATE: solo el owner puede modificar su negocio
drop policy if exists "negocios_owner_update" on negocios;
create policy "negocios_owner_update" on negocios
    for update to authenticated
    using (owner_id = auth.uid())
    with check (owner_id = auth.uid());

-- DELETE: solo el owner puede borrar su negocio
drop policy if exists "negocios_owner_delete" on negocios;
create policy "negocios_owner_delete" on negocios
    for delete to authenticated
    using (owner_id = auth.uid());

-- INSERT: sin política → bloqueado para anon y authenticated.
-- Solo se puede insertar via service_role (desde Supabase Studio).
-- Cuando habilitemos /register público en el futuro, agregar:
--   create policy "negocios_self_insert" on negocios
--       for insert to authenticated
--       with check (owner_id = auth.uid());

-- ============================================================
-- 4) Trigger para mantener `updated_at` actualizado
-- ============================================================
create or replace function set_updated_at_now()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists negocios_set_updated_at on negocios;
create trigger negocios_set_updated_at
    before update on negocios
    for each row execute function set_updated_at_now();
