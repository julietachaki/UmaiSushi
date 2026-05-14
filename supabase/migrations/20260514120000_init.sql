-- ============================================================
-- Umai Sushi · Migración inicial · 2026-05-14
-- ============================================================
-- Crea las 3 tablas canónicas: productos, zonas_delivery, pedidos.
-- Idempotente: usa CREATE TABLE IF NOT EXISTS + ALTER ADD COLUMN
-- IF NOT EXISTS para que se pueda correr sobre una DB nueva o
-- sobre una existente sin romper datos.
--
-- Convención: RLS habilitado, políticas permisivas para `anon`
-- (MVP: la única protección admin es la clave de cocina en
-- frontend). NO usar este schema tal cual en producción real.
-- ============================================================

-- ============================================================
-- 1) productos
-- ============================================================
create table if not exists productos (
    id uuid primary key default gen_random_uuid(),
    nombre text not null,
    descripcion text,
    precio numeric not null default 0,
    categoria text default 'Productos',
    imagen text,
    activo boolean default true,
    es_extra boolean default false,
    tags jsonb default '{}'::jsonb,
    orden int default 0,
    created_at timestamptz default now()
);

-- Asegurar columnas en tablas pre-existentes
alter table productos add column if not exists descripcion text;
alter table productos add column if not exists categoria text default 'Productos';
alter table productos add column if not exists imagen text;
alter table productos add column if not exists activo boolean default true;
alter table productos add column if not exists es_extra boolean default false;
alter table productos add column if not exists tags jsonb default '{}'::jsonb;
alter table productos add column if not exists orden int default 0;
alter table productos add column if not exists created_at timestamptz default now();

create index if not exists productos_categoria_idx on productos (categoria);
create index if not exists productos_activo_idx on productos (activo);
create index if not exists productos_es_extra_idx on productos (es_extra);

-- ============================================================
-- 2) zonas_delivery
-- ============================================================
create table if not exists zonas_delivery (
    id uuid primary key default gen_random_uuid(),
    nombre text not null,
    center_lat numeric not null default 0,
    center_lng numeric not null default 0,
    radius_m int not null default 1500,
    envio numeric not null default 0,
    activo boolean default true,
    created_at timestamptz default now()
);

alter table zonas_delivery add column if not exists center_lat numeric not null default 0;
alter table zonas_delivery add column if not exists center_lng numeric not null default 0;
alter table zonas_delivery add column if not exists radius_m int not null default 1500;
alter table zonas_delivery add column if not exists envio numeric not null default 0;
alter table zonas_delivery add column if not exists activo boolean default true;
alter table zonas_delivery add column if not exists created_at timestamptz default now();

create index if not exists zonas_activo_idx on zonas_delivery (activo);

-- ============================================================
-- 3) pedidos
-- ============================================================
-- Diseño: snapshot completo del pedido. Los `productos` y `extras`
-- van como jsonb con su precio/cantidad ya congelados, así si
-- cambia el menú mañana el pedido viejo NO cambia.
create table if not exists pedidos (
    id uuid primary key default gen_random_uuid(),
    cliente text not null,
    telefono text,
    direccion_texto text,
    maps_url text,
    coords jsonb,
    productos jsonb not null default '[]'::jsonb,
    extras jsonb default '{}'::jsonb,
    subtotal numeric default 0,
    extras_total numeric default 0,
    envio numeric default 0,
    total numeric not null default 0,
    metodo_pago text,
    monto_efectivo numeric,
    entrega text,
    estado text default 'nuevo',
    fecha timestamptz default now()
);

alter table pedidos add column if not exists telefono text;
alter table pedidos add column if not exists direccion_texto text;
alter table pedidos add column if not exists maps_url text;
alter table pedidos add column if not exists coords jsonb;
alter table pedidos add column if not exists productos jsonb not null default '[]'::jsonb;
alter table pedidos add column if not exists extras jsonb default '{}'::jsonb;
alter table pedidos add column if not exists subtotal numeric default 0;
alter table pedidos add column if not exists extras_total numeric default 0;
alter table pedidos add column if not exists envio numeric default 0;
alter table pedidos add column if not exists total numeric not null default 0;
alter table pedidos add column if not exists metodo_pago text;
alter table pedidos add column if not exists monto_efectivo numeric;
alter table pedidos add column if not exists entrega text;
alter table pedidos add column if not exists estado text default 'nuevo';
alter table pedidos add column if not exists fecha timestamptz default now();

create index if not exists pedidos_estado_idx on pedidos (estado);
create index if not exists pedidos_fecha_idx on pedidos (fecha desc);

-- ============================================================
-- 4) Row Level Security (MVP)
-- ============================================================
-- Política: lectura/escritura abierta a `anon`. La protección real
-- del panel cocina vive en el frontend (clave). Cuando agregues
-- Supabase Auth, reemplazar estas políticas por unas que validen
-- `auth.uid()` para INSERT/UPDATE en pedidos y CRUD en productos/
-- zonas_delivery.

alter table productos enable row level security;
alter table zonas_delivery enable row level security;
alter table pedidos enable row level security;

-- productos
drop policy if exists "productos_anon_select" on productos;
create policy "productos_anon_select" on productos
    for select to anon, authenticated using (true);

drop policy if exists "productos_anon_insert" on productos;
create policy "productos_anon_insert" on productos
    for insert to anon, authenticated with check (true);

drop policy if exists "productos_anon_update" on productos;
create policy "productos_anon_update" on productos
    for update to anon, authenticated using (true) with check (true);

drop policy if exists "productos_anon_delete" on productos;
create policy "productos_anon_delete" on productos
    for delete to anon, authenticated using (true);

-- zonas_delivery
drop policy if exists "zonas_anon_select" on zonas_delivery;
create policy "zonas_anon_select" on zonas_delivery
    for select to anon, authenticated using (true);

drop policy if exists "zonas_anon_insert" on zonas_delivery;
create policy "zonas_anon_insert" on zonas_delivery
    for insert to anon, authenticated with check (true);

drop policy if exists "zonas_anon_update" on zonas_delivery;
create policy "zonas_anon_update" on zonas_delivery
    for update to anon, authenticated using (true) with check (true);

drop policy if exists "zonas_anon_delete" on zonas_delivery;
create policy "zonas_anon_delete" on zonas_delivery
    for delete to anon, authenticated using (true);

-- pedidos
drop policy if exists "pedidos_anon_select" on pedidos;
create policy "pedidos_anon_select" on pedidos
    for select to anon, authenticated using (true);

drop policy if exists "pedidos_anon_insert" on pedidos;
create policy "pedidos_anon_insert" on pedidos
    for insert to anon, authenticated with check (true);

drop policy if exists "pedidos_anon_update" on pedidos;
create policy "pedidos_anon_update" on pedidos
    for update to anon, authenticated using (true) with check (true);
