import { bootstrapDashPage } from '../../shared/dashboard-shell.js'
import { obtenerProductos, guardarProducto, eliminarProductoDeSupabase } from '../../services/productos.service.js'

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatPrecio(n) { return '$' + (Number(n) || 0).toLocaleString('es-AR'); }
function newUuid() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : ('p-' + Math.random().toString(36).slice(2, 11));
}
function showFeedback(el, msg, ok) {
    el.hidden = false;
    el.textContent = msg;
    el.className = 'dash-feedback ' + (ok ? 'ok' : 'error');
    setTimeout(() => { el.hidden = true; }, 4000);
}
function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

let state = { negocioId: null, productos: [], editando: false };

function proximoOrden(categoria) {
    const existentes = state.productos.filter(p => (p.categoria || 'Productos') === categoria);
    if (!existentes.length) return 1;
    return Math.max(...existentes.map(p => p.orden || 0)) + 1;
}

function productoCardHtml(p) {
    const tags = [];
    if (p.es_extra) tags.push('<span class="dash-menu-tag tag-extra">Extra</span>');
    if (p.tags?.veggi) tags.push('<span class="dash-menu-tag">Veggie</span>');
    if (p.tags?.glutenfree) tags.push('<span class="dash-menu-tag">Gluten free</span>');
    return `
        <div class="dash-menu-card" data-prod-id="${escapeHtml(p.id)}">
            <img src="${escapeHtml(p.imagen || '/static/producto.jpeg')}" alt="">
            <div class="dash-menu-card-body">
                <h4>${escapeHtml(p.nombre || '')}</h4>
                <p class="dash-menu-card-desc">${escapeHtml(p.descripcion || '')}</p>
                <div class="dash-menu-card-tags">${tags.join('')}</div>
                <div class="dash-menu-card-meta">
                    <span>${escapeHtml(p.categoria || 'Productos')}</span>
                    <span class="price">${formatPrecio(p.precio)}</span>
                </div>
                <div class="dash-menu-card-actions">
                    <button data-action="edit" data-id="${escapeHtml(p.id)}">Editar</button>
                    <button data-action="del" data-id="${escapeHtml(p.id)}" class="btn-del">Eliminar</button>
                </div>
            </div>
        </div>`;
}
function renderGrid() {
    const host = document.getElementById('menu-grid');
    const sorted = state.productos.slice().sort((a, b) => {
        if ((a.categoria || '') !== (b.categoria || '')) return (a.categoria || '').localeCompare(b.categoria || '');
        if ((a.orden || 0) !== (b.orden || 0)) return (a.orden || 0) - (b.orden || 0);
        return (a.nombre || '').localeCompare(b.nombre || '');
    });
    if (!sorted.length) {
        host.innerHTML = '<div class="dash-empty">Aún no hay productos. Agregá el primero con "+ Agregar producto".</div>';
        return;
    }
    host.innerHTML = sorted.map(productoCardHtml).join('');
}

const modal = document.getElementById('modal');
const modalFb = document.getElementById('modal-feedback');
function openModal(producto) {
    modalFb.hidden = true;
    state.editando = !!producto;
    const isEdit = state.editando;
    document.getElementById('modal-title').textContent = isEdit ? 'Editar producto' : 'Nuevo producto';
    document.getElementById('prod-id').value = isEdit ? producto.id : '';
    document.getElementById('prod-nombre').value = isEdit ? (producto.nombre || '') : '';
    document.getElementById('prod-desc').value = isEdit ? (producto.descripcion || '') : '';
    document.getElementById('prod-precio').value = isEdit ? (producto.precio || 0) : '';
    const cat = isEdit ? (producto.categoria || 'Productos') : 'Productos';
    document.getElementById('prod-categoria').value = cat;
    if (isEdit) {
        document.getElementById('prod-orden').value = producto.orden || 1;
    } else {
        document.getElementById('prod-orden').value = proximoOrden(cat);
    }
    document.getElementById('prod-veggi').checked = !!producto?.tags?.veggi;
    document.getElementById('prod-glutenfree').checked = producto?.tags ? !!producto.tags.glutenfree : true;
    document.getElementById('prod-es-extra').checked = !!producto?.es_extra;
    document.getElementById('prod-imagen-preview').src = isEdit && producto.imagen ? producto.imagen : '/static/producto.jpeg';
    document.getElementById('prod-imagen-file').value = '';
    modal.hidden = false;
}
function closeModal() { modal.hidden = true; }

async function saveProducto() {
    const id = document.getElementById('prod-id').value || newUuid();
    const nombre = document.getElementById('prod-nombre').value.trim();
    const desc = document.getElementById('prod-desc').value.trim();
    const precio = Number(document.getElementById('prod-precio').value);
    const categoria = document.getElementById('prod-categoria').value;
    const imagen = document.getElementById('prod-imagen-preview').src || '/static/producto.jpeg';
    const veggi = document.getElementById('prod-veggi').checked;
    const glutenfree = document.getElementById('prod-glutenfree').checked;
    const es_extra = document.getElementById('prod-es-extra').checked;
    const orden = Number(document.getElementById('prod-orden').value) || 1;

    if (!nombre) { showFeedback(modalFb, 'El nombre es obligatorio', false); return; }
    if (!(precio >= 0)) { showFeedback(modalFb, 'Precio inválido', false); return; }

    const producto = {
        id,
        nombre,
        descripcion: desc,
        precio,
        categoria,
        imagen,
        orden,
        activo: true,
        es_extra,
        tags: { veggi, glutenfree },
        negocio_id: state.negocioId
    };

    const saveBtn = document.getElementById('modal-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando…';
    const guardado = await guardarProducto(producto);
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';

    if (!guardado) {
        showFeedback(modalFb, 'Error guardando producto', false);
        return;
    }
    state.productos = await obtenerProductos({ negocioId: state.negocioId });
    renderGrid();
    closeModal();
    showFeedback(document.getElementById('feedback'), '✓ Producto guardado', true);
}

async function delProducto(id) {
    if (!confirm('¿Eliminar este producto? Se marca como inactivo.')) return;
    const ok = await eliminarProductoDeSupabase(id);
    if (!ok) {
        showFeedback(document.getElementById('feedback'), 'Error eliminando', false);
        return;
    }
    state.productos = state.productos.filter(p => p.id !== id);
    renderGrid();
    showFeedback(document.getElementById('feedback'), '✓ Producto eliminado', true);
}

;(async () => {
    const ctx = await bootstrapDashPage('menu');
    if (!ctx) return;
    const { negocio } = ctx;
    if (!negocio) {
        document.getElementById('menu-grid').innerHTML = '<div class="dash-error">No se encontró tu negocio.</div>';
        return;
    }
    state.negocioId = negocio.id;
    state.productos = await obtenerProductos({ negocioId: negocio.id });
    renderGrid();

    document.getElementById('btn-nuevo').addEventListener('click', () => openModal(null));

    document.getElementById('menu-grid').addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        const producto = state.productos.find(p => p.id === id);
        if (!producto) return;
        if (btn.dataset.action === 'edit') openModal(producto);
        else if (btn.dataset.action === 'del') delProducto(id);
    });

    document.getElementById('modal-save').addEventListener('click', saveProducto);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', e => {
        if (e.target === modal) closeModal();
    });

    document.getElementById('prod-imagen-file').addEventListener('change', async e => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 500 * 1024) {
            showFeedback(modalFb, 'Imagen muy grande (máx 500KB). Usá una más chica.', false);
            e.target.value = '';
            return;
        }
        const dataUrl = await readFileAsDataUrl(f);
        document.getElementById('prod-imagen-preview').src = dataUrl;
    });

    document.getElementById('prod-categoria').addEventListener('change', () => {
        if (state.editando) return;
        document.getElementById('prod-orden').value = proximoOrden(document.getElementById('prod-categoria').value);
    });
})();
