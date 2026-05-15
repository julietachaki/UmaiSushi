/**
 * SHEETS SERVICE — UmaiSushi
 *
 * Helpers para la integración Google Sheets por negocio.
 *
 * Arquitectura:
 *   - Cada negocio guarda en Supabase:
 *       google_sheet_url        (URL completa del Sheet, lo que ve el dueño)
 *       google_sheet_id         (spreadsheet_id extraído, para queries rápidas)
 *       google_apps_script_url  (URL del Web App de Apps Script, para escribir)
 *       google_apps_script_secret (token compartido para validar el POST)
 *       google_sync_enabled     (bool, on/off)
 *       google_sync_status      ('disconnected' | 'pending' | 'connected' | 'error')
 *       google_last_sync_at     (timestamptz)
 *       google_last_sync_error  (text)
 *
 *   - El flujo:
 *       1. Dueño pega la URL del Sheet en /dashboard/configuracion.
 *          → parseGoogleSheetUrl() valida + extrae id.
 *       2. Dueño deployea un Apps Script Web App (docs/SHEETS_SETUP.md).
 *          → pega la URL del Web App en el dashboard.
 *       3. (Stage 2) Edge Function o botón manual llama
 *          enviarPedidoASheets(pedido, negocio) que POST al Apps Script.
 *
 * Esta etapa (Stage 1.5): solo validación + parser + builder de
 * payload. La sync real se implementa en Stage 2.
 */

// ===== PARSER / VALIDATOR =====

/**
 * Valida y parsea una URL de Google Sheets.
 * Acepta:
 *   https://docs.google.com/spreadsheets/d/<ID>/edit
 *   https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0
 *   https://docs.google.com/spreadsheets/d/<ID>/
 *   https://docs.google.com/spreadsheets/d/<ID>
 * @param {string} url
 * @returns {{ url: string, id: string }|null}
 */
function parseGoogleSheetUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    const m = trimmed.match(
        /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})(?:[/?#].*)?$/
    );
    if (!m) return null;
    return { url: trimmed, id: m[1] };
}

/**
 * Valida la URL del Apps Script Web App.
 *   https://script.google.com/macros/s/<DEPLOY_ID>/exec
 * @param {string} url
 * @returns {{ url: string, deployId: string }|null}
 */
function parseAppsScriptUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    const m = trimmed.match(
        /^https:\/\/script\.google\.com\/(?:macros|a\/macros\/[^/]+)\/s\/([A-Za-z0-9_-]{20,})\/exec(?:\?.*)?$/
    );
    if (!m) return null;
    return { url: trimmed, deployId: m[1] };
}

// ===== PAYLOAD BUILDER =====

/**
 * Convierte un pedido (shape Supabase post-refactor) a un objeto plano
 * listo para enviar al Apps Script.
 *
 * Schema esperado del pedido:
 *   { id, cliente, telefono, fecha, productos:[{id,nombre,precio,cantidad}],
 *     extras:[{nombre|label,precio,cantidad,sub}], subtotal, extras_total,
 *     envio, total, metodo_pago, monto_efectivo, entrega, direccion_texto,
 *     maps_url, estado, negocio_id, coords:{lat,lng} }
 *
 * @param {object} pedido
 * @returns {object}
 */
function pedidoToSheetsRow(pedido) {
    if (!pedido || typeof pedido !== 'object') return {};

    // Fecha/hora desde el timestamp Postgres del pedido
    let fecha = '';
    let hora = '';
    if (pedido.fecha) {
        try {
            const d = new Date(pedido.fecha);
            const tz = 'America/Argentina/Mendoza';
            const parts = new Intl.DateTimeFormat('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false,
                timeZone: tz
            }).formatToParts(d).reduce((acc, p) => {
                acc[p.type] = p.value;
                return acc;
            }, {});
            fecha = `${parts.day}/${parts.month}/${parts.year}`;
            hora = `${parts.hour}:${parts.minute}`;
        } catch (e) { /* ignore */ }
    }

    // Productos: "2x Roll Clásico | 1x Hot Maki"
    const productosStr = Array.isArray(pedido.productos)
        ? pedido.productos
            .filter(p => p && (p.cantidad || 0) > 0)
            .map(p => `${p.cantidad}x ${p.nombre || ''}`)
            .join(' | ')
        : '';

    // Extras (shape post-refactor: array de line items)
    let extrasStr = '';
    if (Array.isArray(pedido.extras)) {
        extrasStr = pedido.extras
            .filter(e => e && (e.cantidad || 0) > 0)
            .map(e => {
                const nombre = (e.label || e.nombre || '').replace(/^Extra\s/, '');
                return `${e.cantidad}x ${nombre}`;
            })
            .join(' | ');
    } else if (pedido.extras && typeof pedido.extras === 'object') {
        // Legacy shape (teriyaki/soja) por si quedan pedidos viejos
        const t = parseInt(pedido.extras.teriyaki, 10) || 0;
        const s = parseInt(pedido.extras.soja, 10) || 0;
        const ex = [];
        if (t) ex.push(`${t}x salsa teriyaki`);
        if (s) ex.push(`${s}x salsa de soja`);
        extrasStr = ex.join(' | ');
    }

    return {
        pedido_id: pedido.id || '',
        fecha,
        hora,
        cliente: pedido.cliente || '',
        telefono: pedido.telefono || '',
        productos: productosStr,
        extras: extrasStr,
        subtotal: Number(pedido.subtotal) || 0,
        extras_total: Number(pedido.extras_total) || 0,
        envio: Number(pedido.envio) || 0,
        total: Number(pedido.total) || 0,
        metodo_pago: pedido.metodo_pago || '',
        monto_efectivo: pedido.monto_efectivo ? Number(pedido.monto_efectivo) : '',
        entrega: pedido.entrega || '',
        direccion: pedido.direccion_texto || '',
        maps_url: pedido.maps_url && pedido.maps_url !== 'No especificada' ? pedido.maps_url : '',
        estado: pedido.estado || 'nuevo'
    };
}

// ===== ENVÍO AL APPS SCRIPT (placeholder Stage 1.5) =====

/**
 * Envía UN pedido al Apps Script Web App del negocio.
 *
 * STAGE 1.5: implementación básica, pero NO se llama desde ningún
 * lado todavía. Está aquí para que Stage 2 (Edge Function o botón
 * manual) lo invoque cuando corresponda.
 *
 * El Apps Script debe validar el header X-Secret == negocio.google_apps_script_secret
 * antes de aceptar el POST (ver docs/google-apps-script-template.gs).
 *
 * @param {object} pedido
 * @param {object} negocio - debe tener google_apps_script_url y
 *                           google_apps_script_secret y sync_enabled
 * @returns {Promise<{ok:boolean, error?:string, syncedAt?:string}>}
 */
async function enviarPedidoASheets(pedido, negocio) {
    if (!negocio || !negocio.google_sync_enabled) {
        return { ok: false, error: 'sync_disabled' };
    }
    if (!negocio.google_apps_script_url) {
        return { ok: false, error: 'apps_script_url_missing' };
    }

    const row = pedidoToSheetsRow(pedido);

    try {
        const res = await fetch(negocio.google_apps_script_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // X-Secret va en el body porque Apps Script ignora headers
                // custom en doPost (limitación de Google).
            },
            body: JSON.stringify({
                secret: negocio.google_apps_script_secret || '',
                row
            }),
            // mode: 'cors' por default
        });
        if (!res.ok) {
            return { ok: false, error: `HTTP ${res.status}` };
        }
        return { ok: true, syncedAt: new Date().toISOString() };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
}

/**
 * Marca un pedido como sincronizado (o con error) en Supabase.
 * Requiere auth (RLS valida owner).
 *
 * @param {string} pedidoId
 * @param {{ ok:boolean, error?:string, syncedAt?:string }} result
 * @returns {Promise<boolean>}
 */
async function marcarPedidoSincronizado(pedidoId, result) {
    const supabase = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!supabase || !isSupabaseReady()) return false;
    if (!pedidoId || !result) return false;

    const updates = {};
    if (result.ok) {
        updates.synced_to_sheets_at = result.syncedAt || new Date().toISOString();
        updates.sync_error = null;
    } else {
        updates.sync_error = String(result.error || 'unknown').slice(0, 500);
    }
    // sync_attempts se incrementa siempre
    const { data: current } = await supabase
        .from('pedidos').select('sync_attempts').eq('id', pedidoId).maybeSingle();
    updates.sync_attempts = ((current && current.sync_attempts) || 0) + 1;

    const { error } = await supabase
        .from('pedidos').update(updates).eq('id', pedidoId);
    if (error) {
        console.error('[sheets] marcarPedidoSincronizado:', error.message);
        return false;
    }
    return true;
}

// ===== Exports =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseGoogleSheetUrl,
        parseAppsScriptUrl,
        pedidoToSheetsRow,
        enviarPedidoASheets,
        marcarPedidoSincronizado
    };
}
