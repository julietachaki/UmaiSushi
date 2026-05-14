/**
 * Google Sheets (Apps Script Webhook) — preparado, no configurado.
 * IMPORTANTE: No hardcodea IDs privados. Sólo necesita una URL pública de Web App.
 *
 * Cómo usar:
 * - Publicá un Apps Script como Web App (Deploy -> Web app) y copiá la URL.
 * - En `sheetsConfig.webhookUrl` ponés esa URL.
 * - Llamá `enviarPedidoASheets(pedidoCompleto, sheetsConfig)` cuando guardás un pedido en cocina.
 */

function defaultSheetsConfig() {
    return {
        enabled: false,
        webhookUrl: '' // pegar aquí la URL del Web App (Apps Script)
    };
}

function pedidoToSheetsPayload(p) {
    // Formato solicitado: fecha, hora, nombre, teléfono, productos, extras, subtotal, envío, total, pago, dirección
    var marca = typeof formatoMarcaTemporalPedido === 'function' ? formatoMarcaTemporalPedido(p) : (p && p.fechaHoraPedido) || '';
    var fecha = '';
    var hora = '';
    var m = String(marca || '');
    // Esperado: "dd/mm/yyyy - hh:mm hs"
    var parts = m.split('-').map(function (x) {
        return String(x || '').trim();
    });
    if (parts.length >= 2) {
        fecha = parts[0];
        hora = parts[1].replace('hs', '').trim();
    } else {
        fecha = m;
    }

    var productos = Array.isArray(p && p.productos)
        ? p.productos
              .map(function (it) {
                  var qty = it && it.cantidad != null ? it.cantidad : 0;
                  var nom = it && it.nombre != null ? it.nombre : '';
                  return qty + 'x ' + nom;
              })
              .join(' | ')
        : '';

    var extras = '';
    if (p && p.extras) {
        var t = parseInt(p.extras.teriyaki, 10) || 0;
        var s = parseInt(p.extras.soja, 10) || 0;
        var ex = [];
        if (t) ex.push('Teriyaki x' + t);
        if (s) ex.push('Soja x' + s);
        extras = ex.join(' | ');
    }

    var telefono = (p && p.telefono) || '';
    var direccion = (p && p.direccionTexto) || '';
    var envio = typeof p.costoEnvio === 'number' ? p.costoEnvio : 0;
    var subtotal = typeof p.subtotalMenu === 'number' ? p.subtotalMenu : 0;
    var total = typeof p.total === 'number' ? p.total : subtotal + envio;

    return {
        fecha: fecha,
        hora: hora,
        nombre: (p && p.nombre) || '',
        telefono: telefono,
        productos: productos,
        extras: extras,
        subtotal: subtotal,
        envio: envio,
        total: total,
        pago: (p && p.pago) || '',
        direccion: direccion
    };
}

function enviarPedidoASheets(pedidoCompleto, sheetsConfig) {
    var cfg = sheetsConfig || defaultSheetsConfig();
    if (!cfg.enabled) return Promise.resolve({ skipped: true });
    if (!cfg.webhookUrl || typeof cfg.webhookUrl !== 'string') return Promise.reject(new Error('Webhook URL faltante.'));

    var payload = pedidoToSheetsPayload(pedidoCompleto);

    return fetch(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(function (r) {
        if (!r.ok) throw new Error('Webhook respondió ' + r.status);
        return r.json().catch(function () {
            return { ok: true };
        });
    });
}

