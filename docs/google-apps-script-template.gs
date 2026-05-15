/**
 * Apps Script Web App template — Umai Sushi
 *
 * Pegá este código en el Apps Script de TU Google Sheet
 * (Extensiones → Apps Script). Ver docs/SHEETS_SETUP.md para
 * el paso a paso completo.
 *
 * Qué hace:
 *   - Recibe POST con un pedido (JSON).
 *   - Valida que el `secret` del body coincida con SECRET_TOKEN.
 *   - Hace appendRow() en la primera hoja del Sheet activo.
 *   - Devuelve JSON { ok: true } o { ok: false, error: '...' }
 *
 * Seguridad:
 *   - SECRET_TOKEN es un shared secret. Si alguien tiene la URL del
 *     Web App pero no el token, no puede escribir.
 *   - Cambiá SECRET_TOKEN por uno generado aleatoriamente.
 *
 * Notas:
 *   - Apps Script Web App soporta CORS automático para POSTs cuando
 *     "Quién tiene acceso" = "Cualquier persona". No hace falta
 *     setear headers manualmente.
 *   - Apps Script ignora headers custom en doPost (limitación de
 *     Google). Por eso el secret va en el body, no en un header.
 */

// ============================================================
// ⚠️ CAMBIAR ESTO POR UN TOKEN ALEATORIO (32+ caracteres)
// ============================================================
const SECRET_TOKEN = 'CAMBIAR_POR_TU_TOKEN_ALEATORIO';

// Orden EXACTO de columnas en el Sheet (debe matchear el header).
const COLUMNS = [
    'pedido_id',
    'fecha',
    'hora',
    'cliente',
    'telefono',
    'productos',
    'extras',
    'subtotal',
    'extras_total',
    'envio',
    'total',
    'metodo_pago',
    'monto_efectivo',
    'entrega',
    'direccion',
    'maps_url',
    'estado'
];

function doPost(e) {
    try {
        if (!e || !e.postData || !e.postData.contents) {
            return jsonResponse({ ok: false, error: 'no_body' }, 400);
        }
        const body = JSON.parse(e.postData.contents);

        // Validar shared secret
        if (!body.secret || body.secret !== SECRET_TOKEN) {
            return jsonResponse({ ok: false, error: 'invalid_secret' }, 403);
        }

        const row = body.row || {};

        // Construir fila respetando el orden de columnas
        const values = COLUMNS.map(col => {
            const v = row[col];
            return v == null ? '' : v;
        });

        // Insertar en la primera hoja del spreadsheet
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheets()[0];
        sheet.appendRow(values);

        return jsonResponse({ ok: true, syncedAt: new Date().toISOString() });
    } catch (err) {
        return jsonResponse({ ok: false, error: String(err && err.message || err) }, 500);
    }
}

function doGet(e) {
    // Endpoint de salud para que el dashboard pueda hacer "Test conexión"
    return jsonResponse({ ok: true, service: 'umai-sushi-sheets', version: '1.0' });
}

function jsonResponse(obj, statusCode) {
    const out = ContentService.createTextOutput(JSON.stringify(obj));
    out.setMimeType(ContentService.MimeType.JSON);
    // Apps Script Web App no permite setear status code custom — el
    // status real lo controla el motor. Por eso devolvemos `ok: false`
    // explícito en el body para que el cliente sepa.
    return out;
}
