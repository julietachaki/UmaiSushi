/**
 * Lógica compartida entre pedido y cocina: totales de extras,
 * zonas de envío, formato de marca de tiempo y utilidades HTML.
 */

// El carrito y la selección de extras siguen en localStorage (estado UI
// efímero). El menú, las zonas y los pedidos NUNCA — esos van a Supabase.
// Shape nueva del LS (extras-as-products): { <product_id>: <cantidad> }.
// Productos elegibles como extras son los que tienen es_extra=true en Supabase.
var UMASUSHI_LS_EXTRAS = 'umasushiPedidoExtras';

// Cache en memoria de zonas de delivery. Fuente: Supabase. Se rellena en el
// init de cada página (ver `cargarZonasConSupabase()` en script.js).
// `obtenerZonasDelivery()` lo lee síncrono.
var umasushiZonasCache = [];

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

/**
 * Devuelve las zonas en memoria (formato local: { id, nombre, envio,
 * center:{lat,lng}, radiusM }). Si todavía no se cargaron desde
 * Supabase, devuelve []. Es responsabilidad del init llamar a
 * `cargarZonasConSupabase()` antes de que el usuario confirme pedido.
 */
function obtenerZonasDelivery() {
    if (!Array.isArray(umasushiZonasCache)) return [];
    return umasushiZonasCache.filter(function (zona) {
        return zona && zona.center && zona.radiusM != null;
    });
}

/**
 * Devuelve los extras del carrito como mapa { <product_id>: <cantidad> }.
 * Las versiones legacy con `teriyaki`/`soja` se descartan silenciosamente.
 */
function obtenerExtrasStored() {
    try {
        var raw = localStorage.getItem(UMASUSHI_LS_EXTRAS);
        if (!raw) return {};
        var j = JSON.parse(raw);
        if (!j || typeof j !== 'object') return {};
        var clean = {};
        for (var k in j) {
            if (k === 'teriyaki' || k === 'soja') continue; // legacy
            var v = parseInt(j[k], 10);
            if (v > 0) clean[k] = v;
        }
        return clean;
    } catch (e) {
        return {};
    }
}

/**
 * Suma precio*cantidad de cada extra. Soporta dos shapes:
 *  - mapa { <id>: cantidad } (estado en vivo): resuelve precio desde
 *    `productosCache` (productos con `es_extra=true`).
 *  - array de line items [{ precio, cantidad }] (snapshot guardado):
 *    suma directo.
 */
function calcularExtrasMonto(extras) {
    if (!extras) return 0;
    if (Array.isArray(extras)) {
        return extras.reduce(function (acc, x) {
            var precio = Number(x && x.precio) || 0;
            var cant = Math.max(0, parseInt(x && x.cantidad, 10) || 0);
            return acc + precio * cant;
        }, 0);
    }
    if (typeof extras !== 'object') return 0;
    if (typeof productosCache === 'undefined' || !Array.isArray(productosCache)) return 0;
    var total = 0;
    var ids = Object.keys(extras);
    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var cant = Math.max(0, parseInt(extras[id], 10) || 0);
        if (cant === 0) continue;
        var p = productosCache.find(function (x) { return x.id === id; });
        if (p) total += (Number(p.precio) || 0) * cant;
    }
    return total;
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

/**
 * Convierte el mapa de extras `{ <id>: cantidad }` en líneas listas para
 * mostrar/serializar: `[{ id, label, cantidad, precio, sub }]`. Si recibe
 * un array ya en ese formato (snapshot), lo devuelve tal cual.
 */
function extrasLineItems(extras) {
    if (Array.isArray(extras)) {
        return extras
            .filter(function (x) { return x && (x.cantidad || 0) > 0; })
            .map(function (x) {
                var nombre = x.nombre || x.label || '';
                var precio = Number(x.precio) || 0;
                var cantidad = Math.max(0, parseInt(x.cantidad, 10) || 0);
                return {
                    id: x.id || null,
                    label: 'Extra ' + nombre,
                    cantidad: cantidad,
                    precio: precio,
                    sub: precio * cantidad
                };
            });
    }
    if (!extras || typeof extras !== 'object') return [];
    if (typeof productosCache === 'undefined' || !Array.isArray(productosCache)) return [];
    var lines = [];
    var ids = Object.keys(extras);
    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var cant = Math.max(0, parseInt(extras[id], 10) || 0);
        if (cant === 0) continue;
        var p = productosCache.find(function (x) { return x.id === id; });
        if (!p) continue;
        var precio = Number(p.precio) || 0;
        lines.push({
            id: id,
            label: 'Extra ' + (p.nombre || ''),
            cantidad: cant,
            precio: precio,
            sub: precio * cant
        });
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
    if (!pedido) return '—';

    // Nueva estructura Supabase
    if (pedido.fecha) {
        try {
            return new Date(pedido.fecha).toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            console.error('[fecha] Error formateando fecha:', e);
        }
    }

    // Compatibilidad pedidos viejos
    if (pedido.fechaHoraPedido) return pedido.fechaHoraPedido;
    if (pedido.horario) return pedido.horario;

    return '—';
}
function construirMensajeWhatsApp(params) {
    var nombre = params.cliente || '';
    var telefono = params.telefono || '';
    var pedido = params.productos || [];
    // `params.extras` puede ser:
    //  - mapa { <id>: cantidad } (estado en vivo)
    //  - array de line items [{ id, nombre, precio, cantidad, sub }] (snapshot)
    // `extrasLineItems` y `calcularExtrasMonto` aceptan ambos.
    var extras = params.extras || {};
    var subProd = obtenerSubtotalProductos(pedido);
    var montoExtras = Array.isArray(extras)
        ? extras.reduce(function (acc, x) { return acc + (Number(x.precio) || 0) * (Number(x.cantidad) || 0); }, 0)
        : calcularExtrasMonto(extras);
    var zonaNombre = params.zonaNombre || '';
    var costoEnvio = params.costoEnvio || 0;
    var entrega = params.entrega || '';
    var pago = params.pago || '';
    var fechaHora = params.fecha
        ? formatoMarcaTemporalPedido(params)
        : (params.fechaHoraPedido || '');
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

    if (entrega.indexOf('domicilio') !== -1) {
        lineas.push('Envío (' + (zonaNombre ? zonaNombre : 'Sin categoría') + '): $' + costoEnvio);
    }
    lineas.push('TOTAL: $' + total);
    lineas.push('');
    lineas.push('Forma de pago: ' + pago);
    if (pago === 'Efectivo' && montoPagara != null && String(montoPagara).trim() !== '') {
        lineas.push('¿Con cuánto pagás?: $' + montoPagara);
    }
    lineas.push('');
    lineas.push('Entrega: ' + entrega);
    lineas.push('');
    lineas.push('Fecha y hora del pedido: ' + fechaHora);
    if (entrega.indexOf('domicilio') !== -1) {
        lineas.push('Dirección: ' + (ubicacionTxt || '—'));
        lineas.push('Google Maps: ' + (ubicacionLink || '—'));
    }
    if (params.linkPedido) {
        lineas.push('');
        lineas.push('Ver detalle del pedido:');
        lineas.push(params.linkPedido);
    }
    // 👇 AGREGAR ESTO
    if (params.indicaciones_cliente && params.indicaciones_cliente.trim() !== '') {
        lineas.push('');
        lineas.push('📝 Indicaciones: ' + params.indicaciones_cliente);
    }
    return lineas.join('\n');
}
