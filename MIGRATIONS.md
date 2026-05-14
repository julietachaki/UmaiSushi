# Migraciones Supabase · Umai Sushi

Schema canónico de la DB. Las tablas se crean/sincronizan corriendo migraciones SQL versionadas en `supabase/migrations/`. **Nunca** editar la DB a mano desde Studio (excepto para inspección): cualquier cambio de schema vive como una migración nueva.

---

## Estructura

```
supabase/
  config.toml                                 # Config local del CLI
  migrations/
    20260514120000_init.sql                   # 3 tablas + RLS
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

## RLS (Row Level Security)

**MVP**: todas las tablas tienen RLS habilitado con políticas **permisivas para `anon`** (read+write). La única protección del panel admin es la clave en frontend (`umai123`).

**Esto NO es seguro para producción.** Cualquiera con la anon key puede leer/escribir pedidos y modificar el menú. Cuando esté listo para producción real:

1. Agregar Supabase Auth (email/password).
2. Reemplazar las políticas `for ... to anon` por `for ... to authenticated using (auth.uid() is not null)`.
3. Pedidos: permitir INSERT a anon (cliente sin login), pero UPDATE/DELETE solo a authenticated.

---

## Recuperación / rollback

No hay rollback automático. Si una migración rompe algo:
1. Crear una nueva migración que revierta los cambios (ej. `DROP COLUMN`, etc.).
2. Aplicarla con `supabase db push`.

**Nunca** editar una migración ya commiteada/aplicada.
