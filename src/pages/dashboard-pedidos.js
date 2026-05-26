import { bootstrapDashPage } from '../../shared/dashboard-shell.js'
import { obtenerPedidos, actualizarEstadoPedido } from '../../services/pedidos.service.js'
import { getSupabase } from '../../services/supabase.js'

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatFecha(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch (e) { return iso; }
}
function formatPrecio(n) { return '$' + (Number(n) || 0).toLocaleString('es-AR'); }
function normalizeText(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const TRANSITIONS = {
    nuevo:      { next: 'preparando', label: 'Empezar a preparar' },
    preparando: { next: 'listo',      label: 'Marcar listo' },
    listo:      { next: 'entregado',  label: 'Marcar entregado' },
    entregado:  null,
    cancelado:  null
};

let state = {
    pedidos: [],
    negocioId: null,
    filtro: 'activos',
    search: '',
    newPedidoIds: new Set()
};

function listaProductosHtml(productos) {
    const items = Array.isArray(productos) ? productos : [];
    if (!items.length) return '<li class="muted">Sin productos</li>';
    return items.map(p =>
        `<li>${p.cantidad}× ${escapeHtml(p.nombre || '')} — ${formatPrecio((p.precio || 0) * (p.cantidad || 0))}</li>`
    ).join('');
}
function listaExtrasHtml(extras) {
    if (!extras) return '';
    let lines = [];
    if (Array.isArray(extras)) {
        lines = extras.filter(x => (x.cantidad || 0) > 0).map(x => ({
            label: (x.label || x.nombre || 'extra').replace(/^Extra\s/, ''),
            cantidad: x.cantidad,
            sub: (Number(x.precio) || 0) * (Number(x.cantidad) || 0)
        }));
    } else if (typeof extras === 'object') {
        if ('teriyaki' in extras || 'soja' in extras) {
            if (extras.teriyaki > 0) lines.push({ label: 'salsa teriyaki', cantidad: extras.teriyaki, sub: extras.teriyaki * 500 });
            if (extras.soja > 0)     lines.push({ label: 'salsa de soja',  cantidad: extras.soja,     sub: extras.soja * 500 });
        }
    }
    if (!lines.length) return '';
    return '<p><strong>Extras:</strong></p><ul>' +
        lines.map(l => `<li>${l.cantidad}× ${escapeHtml(l.label)} — ${formatPrecio(l.sub)}</li>`).join('') +
        '</ul>';
}
function pedidoBodyHtml(p) {
    const esDom = typeof p.entrega === 'string' && p.entrega.toLowerCase().includes('domicilio');
    let h = `
        <p><strong>Teléfono:</strong> ${escapeHtml(p.telefono || '—')}</p>
        <p><strong>Productos:</strong></p>
        <ul>${listaProductosHtml(p.productos)}</ul>
        ${listaExtrasHtml(p.extras)}
        <p><strong>Subtotal:</strong> ${formatPrecio(p.subtotal)}</p>
        ${(Number(p.extras_total) || 0) > 0 ? `<p><strong>Extras:</strong> ${formatPrecio(p.extras_total)}</p>` : ''}
        ${esDom ? `<p><strong>Envío:</strong> ${formatPrecio(p.envio)}</p>` : ''}
        <p><strong>Total:</strong> <strong>${formatPrecio(p.total)}</strong></p>
        <p><strong>Pago:</strong> ${escapeHtml(p.metodo_pago || '—')}</p>
        ${p.monto_efectivo ? `<p><strong>Paga con:</strong> ${formatPrecio(p.monto_efectivo)}</p>` : ''}
        <p><strong>Entrega:</strong> ${escapeHtml(p.entrega || '—')}</p>
        ${p.indicaciones_cliente
            ? `<p><strong>Indicaciones:</strong> ${escapeHtml(p.indicaciones_cliente)}</p>`
            : ''
        }
    `;
    if (esDom) {
        if (p.direccion_texto) h += `<p><strong>Dirección:</strong> ${escapeHtml(p.direccion_texto)}</p>`;
        if (p.maps_url && p.maps_url !== 'No especificada') h += `<p><strong>Maps:</strong> <a href="${escapeHtml(p.maps_url)}" target="_blank" rel="noopener">ver ubicación</a></p>`;
    }

    const t = TRANSITIONS[p.estado];
    let actionsHtml = '';
    if (t) {
        actionsHtml += `<button class="dash-action-btn" data-action="next" data-id="${escapeHtml(p.id)}" data-next="${t.next}">${escapeHtml(t.label)}</button>`;
    }
    if (p.estado !== 'cancelado' && p.estado !== 'entregado') {
        actionsHtml += `<button class="dash-action-btn dash-action-secondary" data-action="cancel" data-id="${escapeHtml(p.id)}">Cancelar</button>`;
    }
    if (actionsHtml) {
        h += `<div class="dash-pedido-actions">${actionsHtml}</div>`;
    }
    return h;
}
function pedidoCardHtml(p) {
    const estado = p.estado || 'nuevo';
    const isNew = state.newPedidoIds.has(p.id);
    return `
        <div class="dash-pedido-item dash-estado-${escapeHtml(estado)} ${isNew ? 'dash-is-new' : ''}" data-pedido-id="${escapeHtml(p.id)}">
            <div class="dash-pedido-head" data-toggle="1">
                <div>
                    <h4>${escapeHtml(p.cliente || 'Cliente')}</h4>
                    <p class="dash-pedido-meta">${formatFecha(p.fecha)} · ${formatPrecio(p.total)} · ${escapeHtml(p.entrega || '')}</p>
                </div>
                <span class="dash-pedido-estado dash-estado-${escapeHtml(estado)}">${escapeHtml(estado)}</span>
            </div>
            <div class="dash-pedido-body" hidden>${pedidoBodyHtml(p)}</div>
        </div>`;
}

function filtrarPedidos() {
    const q = normalizeText(state.search);
    return state.pedidos.filter(p => {
        if (state.filtro === 'activos') {
            if (p.estado === 'entregado' || p.estado === 'cancelado') return false;
        } else if (state.filtro === 'entregados') {
            if (p.estado !== 'entregado') return false;
        }
        if (q) {
            const blob = normalizeText(p.cliente + ' ' + (p.telefono || ''));
            if (!blob.includes(q)) return false;
        }
        return true;
    });
}
function renderLista() {
    const host = document.getElementById('lista-pedidos');
    const filtrados = filtrarPedidos();
    document.getElementById('pedidos-count').textContent = `${filtrados.length} pedidos`;
    if (!filtrados.length) {
        host.innerHTML = '<div class="dash-empty">Sin pedidos para este filtro.</div>';
        return;
    }
    host.innerHTML = filtrados.map(pedidoCardHtml).join('');
    setTimeout(() => state.newPedidoIds.clear(), 200);
}

async function transicionarEstado(pedidoId, nuevoEstado, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Actualizando…'; }
    const actualizado = await actualizarEstadoPedido(pedidoId, nuevoEstado);
    if (!actualizado) {
        alert('No se pudo actualizar el estado.');
        if (btn) { btn.disabled = false; btn.textContent = TRANSITIONS[state.pedidos.find(p => p.id === pedidoId)?.estado]?.label || 'Reintentar'; }
        return;
    }
    const idx = state.pedidos.findIndex(p => p.id === pedidoId);
    if (idx >= 0) state.pedidos[idx] = actualizado;
    renderLista();
}

let realtimeChannel = null;
function subscribirRealtime(negocioId) {
    const supabase = getSupabase();
    if (!supabase || !negocioId) return;
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    realtimeChannel = supabase
        .channel('pedidos-' + negocioId)
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'pedidos', filter: `negocio_id=eq.${negocioId}` },
            payload => {
                state.pedidos.unshift(payload.new);
                state.newPedidoIds.add(payload.new.id);
                renderLista();
            }
        )
        .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `negocio_id=eq.${negocioId}` },
            payload => {
                const idx = state.pedidos.findIndex(p => p.id === payload.new.id);
                if (idx >= 0) {
                    state.pedidos[idx] = payload.new;
                    renderLista();
                }
            }
        )
        .subscribe(status => {
            console.log('[realtime] status:', status);
        });
}

;(async () => {
    const ctx = await bootstrapDashPage('pedidos');
    if (!ctx) return;
    const { negocio } = ctx;
    if (!negocio) {
        document.getElementById('lista-pedidos').innerHTML = '<div class="dash-error">No se encontró tu negocio.</div>';
        return;
    }
    state.negocioId = negocio.id;
    state.pedidos = await obtenerPedidos({ negocioId: negocio.id, limite: 100 });
    renderLista();
    subscribirRealtime(negocio.id);

    document.querySelectorAll('.dash-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.dash-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.filtro = btn.dataset.filter;
            renderLista();
        });
    });

    document.getElementById('search-input').addEventListener('input', e => {
        state.search = e.target.value;
        renderLista();
    });

    document.getElementById('lista-pedidos').addEventListener('click', async e => {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            e.stopPropagation();
            const action = actionBtn.dataset.action;
            const id = actionBtn.dataset.id;
            if (action === 'next') {
                await transicionarEstado(id, actionBtn.dataset.next, actionBtn);
            } else if (action === 'cancel') {
                if (confirm('¿Cancelar este pedido?')) {
                    await transicionarEstado(id, 'cancelado', actionBtn);
                }
            }
            return;
        }
        const head = e.target.closest('[data-toggle]');
        if (head) {
            const body = head.parentElement.querySelector('.dash-pedido-body');
            if (body) body.hidden = !body.hidden;
        }
    });
})();
