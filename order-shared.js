/**
 * Lógica compartida entre pedido y cocina: totales de extras,
 * zonas de envío, formato de marca de tiempo y utilidades HTML.
 */

var UMASUSHI_LS_ZONAS = 'umasushiDeliveryZones';
var UMASUSHI_LS_EXTRAS = 'umasushiPedidoExtras';
var UMASUSHI_EXTRA_PRECIO_UNIT = 500;

function umasushiEscapeHtml(text) {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatPedidoTimestamp(date) {
    var d = date instanceof Date ? date : new Date();
    var tz = 'America/Argentina/Mendoza';
    var fmt = new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: tz
    });
    var parts = fmt.formatToParts(d);
    var map = {};
    for (var i = 0; i < parts.length; i++) {
        map[parts[i].type] = parts[i].value;
    }
    var day = map.day || '00';
    var month = map.month || '00';
    var year = map.year || '0000';
    var hour = map.hour || '00';
    var minute = map.minute || '00';
    return day + '/' + month + '/' + year + ' - ' + hour + ':' + minute + ' hs';
}

function obtenerZonasDelivery() {
    try {
        var raw = localStorage.getItem(UMASUSHI_LS_ZONAS);
        if (raw === null) return [];
        var z = JSON.parse(raw);
        return Array.isArray(z) ? z.filter(function (zona) {
            return zona && zona.center && zona.radiusM != null;
        }) : [];
    } catch (e) {
        return [];
    }
}

function obtenerExtrasStored() {
    try {
        var raw = localStorage.getItem(UMASUSHI_LS_EXTRAS);
        if (!raw) return { teriyaki: 0, soja: 0 };
        var j = JSON.parse(raw);
        return {
            teriyaki: Math.max(0, parseInt(j.teriyaki, 10) || 0),
            soja: Math.max(0, parseInt(j.soja, 10) || 0)
        };
    } catch (e) {
        return { teriyaki: 0, soja: 0 };
    }
}

function calcularExtrasMonto(extras) {
    var t = Math.max(0, extras.teriyaki || 0) + Math.max(0, extras.soja || 0);
    return t * UMASUSHI_EXTRA_PRECIO_UNIT;
}

function obtenerSubtotalProductos(productos) {
    if (!productos || !productos.length) return 0;
    var sum = 0;
    for (var i = 0; i < productos.length; i++) {
        var item = productos[i];
        sum += (item.precio || 0) * (item.cantidad || 0);
    }
    return sum;
}

function obtenerTotalPedidoNumerico(productos, extras, costoEnvioDelivery) {
    var subProd = obtenerSubtotalProductos(productos);
    var ex = calcularExtrasMonto(extras);
    var envio =
        typeof costoEnvioDelivery === 'number' && !isNaN(costoEnvioDelivery) ? Math.max(0, costoEnvioDelivery) : 0;
    return subProd + ex + envio;
}

function extrasLineItems(extras, precioUnit) {
    var p = typeof precioUnit === 'number' ? precioUnit : UMASUSHI_EXTRA_PRECIO_UNIT;
    var lines = [];
    if (extras.teriyaki > 0) {
        lines.push({ label: 'Extra salsa teriyaki', cantidad: extras.teriyaki, sub: extras.teriyaki * p });
    }
    if (extras.soja > 0) {
        lines.push({ label: 'Extra salsa de soja', cantidad: extras.soja, sub: extras.soja * p });
    }
    return lines;
}

function ubicacionKitchenHtml(url) {
    if (!url || typeof url !== 'string') return 'No especificada';
    if (url.indexOf('http') === 0) {
        return '<a href="' + umasushiEscapeHtml(url) + '" target="_blank" rel="noopener">Ver ubicación</a>';
    }
    return umasushiEscapeHtml(url);
}

/**
 * Cocina/listado: marca de tiempo legible compatible con pedidos viejos (horario)
 */
function formatoMarcaTemporalPedido(pedido) {
    if (pedido && pedido.fechaHoraPedido) return pedido.fechaHoraPedido;
    if (pedido && pedido.horario) return pedido.horario;
    return '—';
}

function construirMensajeWhatsApp(params) {
    var nombre = params.cliente || '';
    var telefono = params.telefono || '';
    var pedido = params.productos || [];
    var extras = params.extras || { teriyaki: 0, soja: 0 };
    var subProd = obtenerSubtotalProductos(pedido);
    var montoExtras = calcularExtrasMonto(extras);
    var zonaNombre = params.zonaNombre || '';
    var costoEnvio = params.costoEnvio || 0;
    var entrega = params.entrega || '';
    var pago = params.pago || '';
    var fechaHora = params.fechaHoraPedido || '';
    var ubicacionTxt = params.direccion_texto || '';
    var ubicacionLink = params.maps_url || '';
    var montoPagara = params.montoPagaraCon;
    var total = params.totalFinal;

    var lineas = [];
    lineas.push('Hola! Quiero hacer un pedido en Umai Sushi 🍣');
    lineas.push('');
    lineas.push('━━━━━━━━━━━━━━━━━━━━');
    lineas.push('📋 DETALLE');
    lineas.push('━━━━━━━━━━━━━━━━━━━━');
    lineas.push('Nombre: ' + nombre);
    if (telefono) lineas.push('Teléfono: ' + telefono);
    lineas.push('');
    lineas.push('Productos:');
    for (var i = 0; i < pedido.length; i++) {
        var item = pedido[i];
        lineas.push('- ' + item.cantidad + 'x ' + item.nombre + '  ($' + (item.precio * item.cantidad) + ')');
    }
    lineas.push('');
    var exLines = extrasLineItems(extras);
    lineas.push('Extras:');
    if (exLines.length === 0) {
        lineas.push('- (ninguno extra)');
    } else {
        for (var e = 0; e < exLines.length; e++) {
            var el = exLines[e];
            lineas.push('- ' + el.label + ' x' + el.cantidad + '  ($' + el.sub + ')');
        }
    }
    lineas.push('');
    lineas.push('Subtotal menú: $' + subProd);
    lineas.push('Extras: $' + montoExtras);
    if (entrega.indexOf('domicilio') !== -1) {
        lineas.push('Envío (' + (zonaNombre ? zonaNombre : 'Sin categoría') + '): $' + costoEnvio);
    }
    lineas.push('TOTAL: $' + total);
    lineas.push('');
    lineas.push('Forma de pago: ' + pago);
    if (pago === 'Efectivo' && montoPagara != null && String(montoPagara).trim() !== '') {
        lineas.push('¿Con cuánto pagás?: $' + montoPagara);
    }
    lineas.push('Entrega: ' + entrega);
    lineas.push('');
    lineas.push('Fecha y hora del pedido: ' + fechaHora);
    if (entrega.indexOf('domicilio') !== -1) {
        lineas.push('Dirección: ' + (ubicacionTxt || '—'));
        lineas.push('Google Maps: ' + (ubicacionLink || '—'));
    }
    lineas.push('');
    lineas.push('Link pedido (cocina):');
    lineas.push(params.linkPedido || '');
    return lineas.join('\n');
}
