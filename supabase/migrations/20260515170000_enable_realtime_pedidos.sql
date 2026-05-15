-- ============================================================
-- Umai Sushi · Enable Realtime en `pedidos` · 2026-05-15
-- ============================================================
-- Para que /dashboard/pedidos.html reciba INSERT/UPDATE en vivo via
-- subscripción WebSocket, la tabla `pedidos` debe estar en la
-- publication `supabase_realtime`.
--
-- Detectado en E2E test: la suscripción se conecta pero no recibe
-- eventos porque ninguna tabla está en la publication.
-- ============================================================

-- Agregar pedidos. ALTER PUBLICATION es idempotente respecto a la
-- existencia de la publication misma, pero falla si la tabla ya
-- estaba — chequeamos con DO block.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'pedidos'
    ) then
        execute 'alter publication supabase_realtime add table pedidos';
    end if;
end $$;
