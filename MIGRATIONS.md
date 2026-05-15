# Migraciones Supabase · Umai Sushi

Schema canónico de la DB. Las tablas se crean/sincronizan corriendo migraciones SQL versionadas en `supabase/migrations/`. **Nunca** editar la DB a mano desde Studio (excepto para inspección): cualquier cambio de schema vive como una migración nueva.

---

## Estructura

```
supabase/
  config.toml                                          # Config local del CLI
  migrations/
    20260514120000_init.sql                            # 3 tablas + RLS permisivo
    20260515120000_multi_tenant_schema.sql             # tabla negocios + FK negocio_id
    20260515150000_rls_lockdown.sql                    # RLS estricto multi-tenant
    20260515160000_drop_legacy_public_policies.sql     # cleanup policies legacy
    20260515170000_enable_realtime_pedidos.sql         # habilitar realtime
    20260515180000_sheets_integration_schema.sql       # google_sheet_*, vista negocios_public
```

---

## Aplicar migraciones (dos caminos)

### Opción A — Supabase CLI (recomendado, sincroniza entre PCs)

Requiere instalar el CLI una vez por máquina.

**1. Instalar CLI**

```powershell
# Windows (scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Windows (npm — alternativa, más lento)
npm install -g supabase
```

```bash
# macOS / Linux (brew)
brew install supabase/tap/supabase
```

**2. Login + linkear proyecto** (una vez por PC)

```bash
supabase login
supabase link --project-ref eqawmvmaohpsxydyepab
# Te va a pedir el DB password (Settings → Database → Connection string en Supabase)
```

**3. Aplicar migraciones**

```bash
# Push: aplicar todas las migraciones pendientes al remoto
supabase db push

# Pull: traer el schema remoto como nueva migración (cuando alguien editó en Studio)
supabase db pull
```

### Opción B — Manual (Studio SQL Editor)

Si no querés instalar el CLI: copiar el contenido de cada archivo `.sql` de `supabase/migrations/` y pegarlo en **Studio → SQL Editor → New query → Run**. Hacerlo en orden alfabético (timestamps).

Como la migración es idempotente (`CREATE TABLE IF NOT EXISTS` + `ALTER ADD COLUMN IF NOT EXISTS`), se puede correr varias veces sin romper datos.

---

## Crear una nueva migración

```bash
supabase migration new nombre_descriptivo
# Crea supabase/migrations/<timestamp>_nombre_descriptivo.sql vacío
# Editar y commitear
```

Regla: **una migración = un cambio atómico de schema**. No agrupar varios cambios no relacionados en el mismo archivo.

---

## Schema actual (resumen)

### `productos`
Catálogo. Los items con `es_extra=true` se ocultan del menú del index pero aparecen en el formulario de pedido y en el admin de cocina.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| nombre | text | |
| descripcion | text | |
| precio | numeric | |
| categoria | text | "Productos", "Tablas", "Vinos", etc. |
| imagen | text | URL o path |
| activo | boolean | soft delete |
| es_extra | boolean | true = no aparece en menú index |
| tags | jsonb | `{ veggi: bool, glutenfree: bool }` |
| orden | int | sort order dentro de categoría |
| created_at | timestamptz | |

### `zonas_delivery`
Zonas circulares para calcular costo de envío.

| Campo | Tipo |
|---|---|
| id | uuid pk |
| nombre | text |
| center_lat | numeric |
| center_lng | numeric |
| radius_m | int |
| envio | numeric |
| activo | boolean |
| created_at | timestamptz |

### `pedidos`
**Snapshot completo del pedido.** Productos y extras se guardan como `jsonb` con precio/cantidad **congelados** — si mañana cambia el menú, el pedido viejo NO cambia.

| Campo | Tipo |
|---|---|
| id | uuid pk |
| cliente | text |
| telefono | text |
| direccion_texto | text |
| maps_url | text |
| coords | jsonb `{ lat, lng }` |
| productos | jsonb `[{ id, nombre, precio, cantidad }]` |
| extras | jsonb `{ <id>: cantidad }` o `[{ id, nombre, precio, cantidad }]` |
| subtotal | numeric |
| extras_total | numeric |
| envio | numeric |
| total | numeric |
| metodo_pago | text |
| monto_efectivo | numeric |
| entrega | text |
| estado | text | `nuevo` \| `preparando` \| `listo` \| `entregado` \| `cancelado` |
| fecha | timestamptz |

---

## Multi-tenant (`negocios`)

A partir de la migración `20260515120000_multi_tenant_schema.sql` el schema soporta múltiples negocios. Cada producto/pedido/zona se asocia a un `negocio_id` (FK a `negocios.id`). Cada `negocio` se asocia a un `auth.users` (FK `owner_id`).

| Campo `negocios` | Tipo |
|---|---|
| id | uuid pk |
| owner_id | uuid → `auth.users(id)` |
| slug | text unique (`umai`, `pizzaroma`...) |
| nombre_negocio | text |
| telefono_negocio | text |
| activo | boolean |
| created_at, updated_at | timestamptz |
| **Integración Google Sheets** | |
| google_sheet_url | text — URL completa del Sheet (input del dueño) |
| google_sheet_id | text — spreadsheet_id extraído de la URL |
| google_apps_script_url | text — URL del Web App deployado |
| google_apps_script_secret | text — shared token para validar POSTs |
| google_sync_enabled | boolean — toggle on/off |
| google_sync_status | text — `disconnected` \| `pending` \| `connected` \| `error` |
| google_last_sync_at | timestamptz — última sync OK |
| google_last_sync_error | text — último mensaje de error |

### Vista `negocios_public`

Expone solo columnas no sensibles (id, slug, nombre, teléfono, activo, created_at). El cliente público anon usa esta vista (`obtenerNegocioPorSlug`). Las columnas `google_*` solo accesibles vía SELECT autenticado del owner sobre la tabla `negocios`.

### Setup primer negocio (post-migración manual)

1. **Crear usuario admin en Supabase Studio**
   - Studio → **Authentication** → **Users** → **Add user** (botón verde).
   - Email + password. Marcar "Auto Confirm User" para saltearse la verificación.
   - Copiar el `id` (UUID) del user recién creado.

2. **Crear el negocio y backfill de datos existentes** — pegar en SQL Editor:

```sql
-- Reemplazar <UUID-DEL-USER> con el UUID del paso 1
insert into negocios (slug, nombre_negocio, telefono_negocio, owner_id)
values ('umai', 'Umai Sushi', '542604539727', '<UUID-DEL-USER>');

-- Backfill: asignar los datos existentes al primer negocio
update productos      set negocio_id = (select id from negocios where slug='umai') where negocio_id is null;
update pedidos        set negocio_id = (select id from negocios where slug='umai') where negocio_id is null;
update zonas_delivery set negocio_id = (select id from negocios where slug='umai') where negocio_id is null;
```

3. **Verificar**:

```sql
select count(*) from productos      where negocio_id is null; -- esperado: 0
select count(*) from pedidos        where negocio_id is null; -- esperado: 0
select count(*) from zonas_delivery where negocio_id is null; -- esperado: 0
```

---

## RLS (Row Level Security)

**Estado actual (Phase 1)**: durante la transición a auth, mantenemos las políticas permisivas (anon SELECT/INSERT/UPDATE/DELETE) en `productos`, `pedidos` y `zonas_delivery`. La razón: cocina.html todavía corre con anon key. Si las cerráramos ya, la admin actual dejaría de funcionar antes de que el dashboard con login esté listo.

**Tabla `negocios`** ya tiene RLS estricto:
- SELECT: público (clientes necesitan resolver slug → id)
- UPDATE / DELETE: solo el owner (`owner_id = auth.uid()`)
- INSERT: bloqueado para anon y authenticated (solo via service_role en Studio)

**Phase 6 (cleanup)** apretará el RLS de las 3 tablas legacy:
- SELECT: público (cliente sigue viendo el catálogo)
- INSERT (productos/zonas): solo owner del negocio. INSERT pedidos: público pero validando `negocios.activo = true`
- UPDATE / DELETE: solo owner del negocio

---

## Recuperación / rollback

No hay rollback automático. Si una migración rompe algo:
1. Crear una nueva migración que revierta los cambios (ej. `DROP COLUMN`, etc.).
2. Aplicarla con `supabase db push`.

**Nunca** editar una migración ya commiteada/aplicada.
