import { waitForSupabase } from '../../services/auth.service.js'
import { obtenerPedidoPorId } from '../../services/pedidos.service.js'
import { obtenerNegocioPorSlug } from '../../services/negocios.service.js'

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatPrecio(n) { return '$' + (Number(n) || 0).toLocaleString('es-AR'); }
function formatFecha(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch (e) { return iso; }
}
function showError(msg) {
    document.getElementById('orden-loading').hidden = true;
    const err = document.getElementById('orden-error');
    err.hidden = false;
    err.textContent = msg;
}
function getParam(name) {
    return new URLSearchParams(location.search).get(name);
}

(async () => {
    await waitForSupabase();

    const id = getParam('id');
    const slug = getParam('slug') || 'umai';
    if (!id) { showError('Link inválido (falta id).'); return; }

    const [pedido, negocio] = await Promise.all([
        obtenerPedidoPorId(id),
        obtenerNegocioPorSlug(slug)
    ]);

    if (!pedido) { showError('Pedido no encontrado. El link puede estar caducado.'); return; }

    if (negocio && pedido.negocio_id && pedido.negocio_id !== negocio.id) {
        showError('Este pedido no corresponde al negocio del link.');
        return;
    }

    document.title = `Pedido de ${pedido.cliente} - ${negocio?.nombre_negocio || 'Umai Sushi'}`;
    document.getElementById('orden-loading').hidden = true;
    document.getElementById('orden-card').hidden = false;

    const estado = pedido.estado || 'nuevo';
    const estadoEl = document.getElementById('orden-estado');
    estadoEl.textContent = estado;
    estadoEl.className = 'orden-estado-badge estado-' + estado;

    document.getElementById('orden-fecha').textContent = formatFecha(pedido.fecha);
    document.getElementById('orden-negocio').textContent = negocio?.nombre_negocio || '—';
    document.getElementById('orden-cliente').textContent = pedido.cliente || '—';
    document.getElementById('orden-telefono').textContent = pedido.telefono ? '☎ ' + pedido.telefono : '';

    const prods = Array.isArray(pedido.productos) ? pedido.productos : [];
    document.getElementById('orden-productos').innerHTML = prods.length
        ? prods.map(p => `<li>${p.cantidad}× ${escapeHtml(p.nombre || '')} — ${formatPrecio((p.precio || 0) * (p.cantidad || 0))}</li>`).join('')
        : '<li>Sin productos</li>';

    let extrasLines = [];
    const ex = pedido.extras;
    if (Array.isArray(ex)) {
        extrasLines = ex.filter(x => (x.cantidad || 0) > 0).map(x => ({
            label: (x.label || x.nombre || 'extra').replace(/^Extra\s/, ''),
            cantidad: x.cantidad,
            sub: (Number(x.precio) || 0) * (Number(x.cantidad) || 0)
        }));
    } else if (ex && typeof ex === 'object') {
        if (ex.teriyaki > 0) extrasLines.push({ label: 'salsa teriyaki', cantidad: ex.teriyaki, sub: ex.teriyaki * 500 });
        if (ex.soja > 0) extrasLines.push({ label: 'salsa de soja', cantidad: ex.soja, sub: ex.soja * 500 });
    }
    if (extrasLines.length) {
        document.getElementById('orden-extras-section').hidden = false;
        document.getElementById('orden-extras').innerHTML = extrasLines.map(l =>
            `<li>${l.cantidad}× ${escapeHtml(l.label)} — ${formatPrecio(l.sub)}</li>`
        ).join('');
    }

    document.getElementById('orden-subtotal').textContent = formatPrecio(pedido.subtotal);
    if (Number(pedido.extras_total) > 0) {
        document.getElementById('row-extras').hidden = false;
        document.getElementById('orden-extras-total').textContent = formatPrecio(pedido.extras_total);
    }
    const esDom = String(pedido.entrega || '').toLowerCase().includes('domicilio');
    if (esDom) {
        document.getElementById('row-envio').hidden = false;
        document.getElementById('orden-envio').textContent = formatPrecio(pedido.envio);
    }
    document.getElementById('orden-total').textContent = formatPrecio(pedido.total);

    document.getElementById('orden-pago').textContent = pedido.metodo_pago || '—';
    if (pedido.metodo_pago === 'Efectivo' && pedido.monto_efectivo) {
        const m = document.getElementById('orden-monto-efectivo');
        m.hidden = false;
        m.innerHTML = `<strong>Paga con:</strong> ${formatPrecio(pedido.monto_efectivo)}`;
    }
    document.getElementById('orden-entrega').textContent = pedido.entrega || '—';
    if (esDom && pedido.direccion_texto) {
        document.getElementById('orden-direccion-wrap').hidden = false;
        document.getElementById('orden-direccion').textContent = pedido.direccion_texto;
    }
    if (esDom && pedido.maps_url && pedido.maps_url !== 'No especificada') {
        document.getElementById('orden-maps-wrap').hidden = false;
        document.getElementById('orden-maps-link').href = pedido.maps_url;
    }

    document.getElementById('back-link').href = `/u/${encodeURIComponent(slug)}/`;
})()
