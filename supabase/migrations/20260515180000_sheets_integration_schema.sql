-- ============================================================
-- Umai Sushi · Sheets integration schema (Stage 1.5) · 2026-05-15
-- ============================================================
-- Agrega columnas a `negocios` y `pedidos` para soportar la
-- integración con Google Sheets + Apps Script. NO implementa sync —
-- solo prepara el schema para Stage 2 (auto-sync via Edge Function).
--
-- Decisiones tomadas en la auditoría:
--   1) Sheet URL y Apps Script Web App URL son DOS URLs distintas,
--      guardadas separadamente. La primera es del Sheet (lo que ve
--      el dueño), la segunda es del webhook (lo que el sistema usa
--      para escribir).
--   2) Sync manual desde dashboard (Stage 1.5). Auto en Stage 2.
--   3) RLS restrictivo: las columnas sensibles (google_apps_script_*)
--      solo accesibles via SELECT autenticado del owner. Para el
--      cliente público se expone una VIEW `negocios_public` con solo
--      los campos no sensibles.
-- ============================================================

-- ============================================================
-- 1) Nuevas columnas en `negocios`
-- ============================================================
alter table negocios add column if not exists google_sheet_id text;
alter table negocios add column if not exists google_apps_script_url text;
alter table negocios add column if not exists google_apps_script_secret text;
alter table negocios add column if not exists google_sync_enabled boolean default false;
alter table negocios add column if not exists google_sync_status text default 'disconnected';
alter table negocios add column if not exists google_last_sync_at timestamptz;
alter table negocios add column if not exists google_last_sync_error text;

-- Valores válidos de google_sync_status: 'disconnected', 'pending', 'connected', 'error'
-- (no usamos CHECK constraint por flexibilidad futura)

-- ============================================================
-- 2) Nuevas columnas en `pedidos` (para tracking de sync)
-- ============================================================
alter table pedidos add column if not exists synced_to_sheets_at timestamptz;
alter table pedidos add column if not exists sync_attempts int default 0;
alter table pedidos add column if not exists sync_error text;

create index if not exists pedidos_pending_sync_idx
    on pedidos (negocio_id, synced_to_sheets_at)
    where synced_to_sheets_at is null;

-- ============================================================
-- 3) Vista pública `negocios_public` — RLS-bypassing pero
--    SOLO expone columnas no sensibles
-- ============================================================
-- IMPORTANTE: esta vista corre con SECURITY DEFINER (default),
-- bypaseando RLS del table `negocios`. Por eso restringimos las
-- columnas en el SELECT — anon solo ve lo que el cliente público
-- necesita para mostrar el catálogo.
drop view if exists negocios_public;
create view negocios_public
with (security_invoker = false) as
select
    id,
    slug,
    nombre_negocio,
    telefono_negocio,
    activo,
    created_at
from negocios
where activo = true;

grant select on negocios_public to anon, authenticated;

-- ============================================================
-- 4) RLS estricto en `negocios` (table) — solo owner SELECT
-- ============================================================
-- Antes: SELECT abierto a anon, authenticated using (true).
-- Ahora: SELECT solo al owner autenticado. Anon usa la VIEW.
drop policy if exists "negocios_public_select" on negocios;
drop policy if exists "negocios_owner_select" on negocios;

create policy "negocios_owner_select" on negocios
    for select to authenticated
    using (owner_id = auth.uid());

-- Las políticas UPDATE/DELETE de owner ya estaban en la migración
-- 20260515120000_multi_tenant_schema.sql — no se tocan acá.

-- ============================================================
-- 5) Notas para Stage 2
-- ============================================================
-- En Stage 2 vamos a:
--   1. Crear Edge Function `sync-pedido-to-sheets` que recibe
--      pedido_id, busca el pedido + negocio, hace POST al
--      apps_script_url con el shared_secret, actualiza
--      synced_to_sheets_at o sync_error.
--   2. Trigger en `pedidos` AFTER INSERT que llama a la Edge
--      Function via http extension de Supabase (o NOTIFY +
--      worker externo).
--   3. Botón en /dashboard/pedidos "Sincronizar pendientes" que
--      busca pedidos con synced_to_sheets_at IS NULL y los procesa
--      uno por uno.
-- Para Stage 1.5 solo dejamos el schema listo y un botón
-- placeholder en /dashboard/configuracion.
