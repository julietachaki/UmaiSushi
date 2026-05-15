-- ============================================================
-- Umai Sushi · Drop legacy "public_*" policies · 2026-05-15
-- ============================================================
-- Detectado en E2E verification: existen policies con prefijo
-- public_* (creadas en Supabase Studio antes del refactor — probable
-- "Allow public access" toggle) que dan SELECT/INSERT/UPDATE/DELETE
-- abierto a TODO el rol `public` (incluye anon + authenticated).
--
-- Estas policies sobrescriben las políticas multi-tenant estrictas de
-- la migración 20260515150000 (RLS evalúa como OR de policies → si
-- una pasa, la operación se permite).
--
-- Esta migración las elimina para que SOLO valgan las políticas
-- definidas en la migración 20260515150000_rls_lockdown.sql.
-- ============================================================

-- productos
drop policy if exists "public_read_productos" on productos;
drop policy if exists "public_insert_productos" on productos;
drop policy if exists "public_update_productos" on productos;
drop policy if exists "public_delete_productos" on productos;

-- pedidos
drop policy if exists "public_read_pedidos" on pedidos;
drop policy if exists "public_insert_pedidos" on pedidos;
drop policy if exists "public_update_pedidos" on pedidos;
drop policy if exists "public_delete_pedidos" on pedidos;

-- zonas_delivery
drop policy if exists "public_read_zonas" on zonas_delivery;
drop policy if exists "public_insert_zonas" on zonas_delivery;
drop policy if exists "public_update_zonas" on zonas_delivery;
drop policy if exists "public_delete_zonas" on zonas_delivery;

-- negocios (por si tambien hay)
drop policy if exists "public_read_negocios" on negocios;
drop policy if exists "public_insert_negocios" on negocios;
drop policy if exists "public_update_negocios" on negocios;
drop policy if exists "public_delete_negocios" on negocios;
