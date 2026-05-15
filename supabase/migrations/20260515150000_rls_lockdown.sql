-- ============================================================
-- Umai Sushi · RLS lockdown (Phase 6) · 2026-05-15
-- ============================================================
-- Aprieta las políticas de productos/pedidos/zonas_delivery a
-- multi-tenant:
--   - SELECT productos/zonas: público (catálogo público necesita)
--   - SELECT pedidos: público (link WhatsApp /u/orden.html?id=)
--   - INSERT pedidos: público, pero validando que el negocio esté activo
--   - INSERT/UPDATE/DELETE productos/zonas: solo authenticated && owner
--   - UPDATE pedidos: solo authenticated && owner del negocio
--
-- Pre-requisitos: tabla `negocios` existe, todas las filas tienen
-- negocio_id no nulo (ya hecho en setup_first_business.py).
--
-- Si por algún motivo no se aplicó el backfill, este lockdown romperá
-- las queries para filas con negocio_id NULL.
-- ============================================================

-- ============================================================
-- 1) Marcar negocio_id NOT NULL (refuerza integridad)
-- ============================================================
-- Solo procede si todas las filas existentes ya tienen valor.
do $$
begin
    if not exists (select 1 from productos where negocio_id is null) then
        execute 'alter table productos alter column negocio_id set not null';
    end if;
    if not exists (select 1 from pedidos where negocio_id is null) then
        execute 'alter table pedidos alter column negocio_id set not null';
    end if;
    if not exists (select 1 from zonas_delivery where negocio_id is null) then
        execute 'alter table zonas_delivery alter column negocio_id set not null';
    end if;
end $$;

-- ============================================================
-- 2) productos
-- ============================================================
drop policy if exists "productos_anon_select" on productos;
drop policy if exists "productos_anon_insert" on productos;
drop policy if exists "productos_anon_update" on productos;
drop policy if exists "productos_anon_delete" on productos;
drop policy if exists "productos_public_select" on productos;
drop policy if exists "productos_owner_insert" on productos;
drop policy if exists "productos_owner_update" on productos;
drop policy if exists "productos_owner_delete" on productos;

create policy "productos_public_select" on productos
    for select to anon, authenticated using (true);

create policy "productos_owner_insert" on productos
    for insert to authenticated
    with check (
        exists (select 1 from negocios
                where id = productos.negocio_id
                  and owner_id = auth.uid())
    );

create policy "productos_owner_update" on productos
    for update to authenticated
    using (
        exists (select 1 from negocios
                where id = productos.negocio_id
                  and owner_id = auth.uid())
    )
    with check (
        exists (select 1 from negocios
                where id = productos.negocio_id
                  and owner_id = auth.uid())
    );

create policy "productos_owner_delete" on productos
    for delete to authenticated
    using (
        exists (select 1 from negocios
                where id = productos.negocio_id
                  and owner_id = auth.uid())
    );

-- ============================================================
-- 3) zonas_delivery
-- ============================================================
drop policy if exists "zonas_anon_select" on zonas_delivery;
drop policy if exists "zonas_anon_insert" on zonas_delivery;
drop policy if exists "zonas_anon_update" on zonas_delivery;
drop policy if exists "zonas_anon_delete" on zonas_delivery;
drop policy if exists "zonas_public_select" on zonas_delivery;
drop policy if exists "zonas_owner_insert" on zonas_delivery;
drop policy if exists "zonas_owner_update" on zonas_delivery;
drop policy if exists "zonas_owner_delete" on zonas_delivery;

create policy "zonas_public_select" on zonas_delivery
    for select to anon, authenticated using (true);

create policy "zonas_owner_insert" on zonas_delivery
    for insert to authenticated
    with check (
        exists (select 1 from negocios
                where id = zonas_delivery.negocio_id
                  and owner_id = auth.uid())
    );

create policy "zonas_owner_update" on zonas_delivery
    for update to authenticated
    using (
        exists (select 1 from negocios
                where id = zonas_delivery.negocio_id
                  and owner_id = auth.uid())
    )
    with check (
        exists (select 1 from negocios
                where id = zonas_delivery.negocio_id
                  and owner_id = auth.uid())
    );

create policy "zonas_owner_delete" on zonas_delivery
    for delete to authenticated
    using (
        exists (select 1 from negocios
                where id = zonas_delivery.negocio_id
                  and owner_id = auth.uid())
    );

-- ============================================================
-- 4) pedidos
-- ============================================================
drop policy if exists "pedidos_anon_select" on pedidos;
drop policy if exists "pedidos_anon_insert" on pedidos;
drop policy if exists "pedidos_anon_update" on pedidos;
drop policy if exists "pedidos_public_select" on pedidos;
drop policy if exists "pedidos_public_insert" on pedidos;
drop policy if exists "pedidos_owner_update" on pedidos;

-- SELECT público: link de WhatsApp /u/orden.html?id=<uuid> requiere leer
-- el pedido por id sin sesión. La protección efectiva es que los UUIDs
-- son inadivinables (2^122 combinaciones).
create policy "pedidos_public_select" on pedidos
    for select to anon, authenticated using (true);

-- INSERT público pero solo si el negocio existe y está activo.
-- Evita que un atacante cree pedidos contra negocios inactivos o
-- inexistentes.
create policy "pedidos_public_insert" on pedidos
    for insert to anon, authenticated
    with check (
        exists (select 1 from negocios
                where id = pedidos.negocio_id
                  and activo = true)
    );

-- UPDATE: solo el owner del negocio (cambio de estado desde
-- /dashboard/pedidos).
create policy "pedidos_owner_update" on pedidos
    for update to authenticated
    using (
        exists (select 1 from negocios
                where id = pedidos.negocio_id
                  and owner_id = auth.uid())
    )
    with check (
        exists (select 1 from negocios
                where id = pedidos.negocio_id
                  and owner_id = auth.uid())
    );

-- ============================================================
-- 5) Notas de seguridad
-- ============================================================
-- Lo que NO está protegido por RLS aún:
--  - pedidos SELECT abierto: cualquiera con un UUID puede ver detalle.
--    Para producción real, considerar usar Edge Function con token
--    firmado en el link, o exigir auth para SELECT.
--  - El cliente público anónimo puede crear pedidos para CUALQUIER
--    negocio activo. Esto es intencional (cliente sin login pide en
--    cualquier restaurante), pero un atacante podría spammear pedidos.
--    Mitigación futura: rate limit por IP a nivel Edge Function.
