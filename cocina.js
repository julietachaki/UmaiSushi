function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

function togglePedido(header) {
    const body = header.nextElementSibling;
    const icon = header.querySelector('.toggle-icon');
    body.classList.toggle('hidden');
    icon.style.transform = body.classList.contains('hidden') ? 'rotate(-90deg)' : 'rotate(0deg)';
}

/**function decodePedidoPayload(dataParam) {
    try {
        return JSON.parse(decodeURIComponent(escape(atob(dataParam))));
    } catch (e1) {
        try {
            return JSON.parse(atob(dataParam));
        } catch (e2) {
            throw e1;
        }
    }
}*/

function subtotalMenuPedido(p) {
    if (typeof p.subtotalMenu === 'number') return p.subtotalMenu;
    return typeof obtenerSubtotalProductos === 'function'
        ? obtenerSubtotalProductos(p.productos || [])
        : 0;
}

/**
 * Devuelve los extras de un pedido en un shape que `extrasLineItems`
 * pueda interpretar. Soporta:
 *  - array snapshot (nueva shape, vive en pedidos.extras como jsonb)
 *  - map { <id>: cantidad } (live cart)
 *  - legacy { teriyaki, soja } (pedidos viejos)
 */
function extrasDesdePedido(p) {
    if (!p || !p.extras) return [];
    if (Array.isArray(p.extras)) return p.extras;
    if (typeof p.extras === 'object') {
        // ¿Tiene keys legacy? Reconstruir como array placeholder.
        var isLegacy = ('teriyaki' in p.extras) || ('soja' in p.extras);
        if (isLegacy) {
            var lines = [];
            var t = Math.max(0, parseInt(p.extras.teriyaki, 10) || 0);
            var s = Math.max(0, parseInt(p.extras.soja, 10) || 0);
            if (t > 0) lines.push({ id: 'legacy-teriyaki', label: 'Extra salsa teriyaki', cantidad: t, precio: 500, sub: t * 500 });
            if (s > 0) lines.push({ id: 'legacy-soja', label: 'Extra salsa de soja', cantidad: s, precio: 500, sub: s * 500 });
            return lines;
        }
        // Map por id (no debería pasar en pedidos guardados, pero por las dudas)
        return p.extras;
    }
    return [];
}

function listaProductosUlHtml(productos) {
    const items = Array.isArray(productos) ? productos : [];
    if (!items.length) return '<ul><li>No hay productos</li></ul>';
    return `<ul>${items
        .map(
            item =>
                `<li>${item.cantidad}x ${umasushiEscapeHtml(item.nombre)} - $${(item.precio || 0) * (item.cantidad || 0)}</li>`
        )
        .join('')}</ul>`;
}

function bloqueExtrasHtml(p) {
    const ex = extrasDesdePedido(p);
    const lines = extrasLineItems(ex);
    if (!lines.length) return '';
    let h = '<p><strong>Extras:</strong></p><ul>';
    for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        h += `<li>${umasushiEscapeHtml(ln.label)} x${ln.cantidad} - $${ln.sub}</li>`;
    }
    h += '</ul>';
    return h;
}

function bloqueUbicacionHtml(p) {
    const rawTxt = typeof p.direccion_texto === 'string' ? p.direccion_texto.trim() : '';
    const txt = rawTxt ? umasushiEscapeHtml(rawTxt) : '';
    let h = '';
    if (txt) h += `<p><strong>Dirección:</strong> ${txt}</p>`;

    const u = typeof p.maps_url === 'string' ? p.ubicacion_texto.trim() : '';
    if (u && u !== 'No especificada') {
        h += `<p><strong>Google Maps:</strong> ${ubicacionKitchenHtml(u)}</p>`;
        return h;
    }
    if (!txt) return '<p><strong>Dirección / Maps:</strong> —</p>';
    return h;
}

function crearFilaZonaHtml(zona) {
    const nombre = zona && zona.nombre != null ? String(zona.nombre) : '';
    const envio = Number(zona && zona.envio) || 0;
    const keys = zona && zona.palabrasClave != null ? String(zona.palabrasClave) : '';
    const idRaw = zona?.id ? String(zona.id) : '';;
    const idAttr = umasushiEscapeHtml(idRaw);
    return `<tr data-zone-id="${idAttr}">
      <td><input class="inp-modern zona-nombre" type="text" value="${umasushiEscapeHtml(nombre)}"></td>
      <td><input class="inp-modern zona-envio" type="number" min="0" step="50" value="${envio}"></td>
      <td><input class="inp-modern zona-keys" type="text" placeholder="centro, barrio norte…" value="${umasushiEscapeHtml(keys)}"></td>
      <td><button type="button" class="btn-ghost zona-eliminar" title="Quitar">✕</button></td>
    </tr>`;
}

function tablaZonasHtml(zonas) {
    let body = zonas.map(crearFilaZonaHtml).join('');
    if (!body) body = '<tr class="muted"><td colspan="4">Sin zonas. Agregá al menos una o restaurá ejemplo.</td></tr>';
    return `
    <section class="zonas-admin-card pedido-card-shell">
      <div class="zonas-admin-head">
        <h3>Zonas de envío</h3>
        <p class="muted small">Configurable en cocina · palabras separadas por comas · se buscan dentro de la dirección elegida del cliente.</p>
      </div>
      <div class="table-wrap">
      <table class="zonas-table">
        <thead><tr><th>Nombre zona</th><th>Costo envío ($)</th><th>Palabras clave</th><th></th></tr></thead>
        <tbody id="zonas-tbody">${body}</tbody>
      </table>
      </div>
      <div class="zonas-admin-actions">
        <button type="button" id="zona-agregar" class="btn-secondary">Agregar zona</button>
        <button type="button" id="zona-guardar" class="btn-primary">Guardar zonas</button>
        <button type="button" id="zona-ejemplo" class="btn-secondary">Restaurar ejemplo</button>
      </div>
      <p id="zonas-feedback" class="muted small zonas-feedback" hidden></p>
    </section>`;
}

function htmlDetalleCompletoPedido(p) {
    const subProd = subtotalMenuPedido(p);
    const ex = extrasDesdePedido(p);
    const montoExtras = typeof calcularExtrasMonto === 'function' ? calcularExtrasMonto(ex) : 0;
    const esDom = typeof p.entrega === 'string' && p.entrega.indexOf('domicilio') !== -1;
    const marca = formatoMarcaTemporalPedido(p);

    let h = `
        <p><strong>Nombre:</strong> ${umasushiEscapeHtml(p.cliente || '')}</p>
        <p><strong>Teléfono:</strong> ${umasushiEscapeHtml(p.telefono || '—')}</p>
        <p><strong>Fecha y hora del pedido:</strong> ${umasushiEscapeHtml(marca)}</p>
        <p><strong>Productos:</strong></p>
        ${listaProductosUlHtml(p.productos)}
        ${bloqueExtrasHtml(p)}
        <p><strong>Subtotal menú:</strong> $${subProd}</p>
        <p><strong>Extras:</strong> $${montoExtras}</p>`;

    const envValor = typeof p.costoEnvio === 'number' ? p.costoEnvio : null;
    if (esDom) {
        if (envValor != null && !Number.isNaN(envValor)) {
            const zn = typeof p.zonaNombre === 'string' && p.zonaNombre ? umasushiEscapeHtml(p.zonaNombre) : '—';
            h += `<p><strong>Envío (${zn}):</strong> $${envValor}</p>`;
        } else {
            h += '<p><strong>Envío:</strong> sin dato registrado para este pedido</p>';
        }
    }

    const totalCalculado =
        typeof p.total === 'number'
            ? p.total
            : subProd +
              montoExtras +
              (esDom && typeof envValor === 'number' && !Number.isNaN(envValor) ? envValor : 0);

    h += `<p><strong>Total:</strong> $${totalCalculado}</p>`;
    h += `<p><strong>Pago:</strong> ${umasushiEscapeHtml(p.pago || '')}</p>`;
    if ((p.pago || '') === 'Efectivo' && p.montoPagaraCon != null && String(p.montoPagaraCon).trim() !== '')
        h += `<p><strong>¿Con cuánto pagás?:</strong> $${umasushiEscapeHtml(String(p.montoPagaraCon))}</p>`;

    h += `<p><strong>Entrega:</strong> ${umasushiEscapeHtml(p.entrega || '')}</p>`;
    if (esDom) h += bloqueUbicacionHtml(p);
    return h;
}

function configurarHandlersZonaAdmin(container) {
    console.log('[cocina] configurarHandlersZonaAdmin container', container);
    const tbody = container.querySelector('#zonas-tbody');
    if (!container || !tbody) {
        console.error('[cocina] configurarHandlersZonaAdmin: elementos faltantes.');
        return;
    }
    function showFb(msg, ok) {
        const fb = container.querySelector('#zonas-feedback');
        if (!fb) return;
        fb.hidden = false;
        fb.textContent = msg;
        fb.style.color = ok ? '#0f490f' : '#c0392b';
        setTimeout(() => {
            fb.hidden = true;
        }, 4000);
    }

    tbody.addEventListener('click', e => {
        if (e.target.closest('.zona-eliminar')) {
            const tr = e.target.closest('tr');
            if (tr) tr.remove();
        }
    });

    container.querySelector('#zona-agregar').addEventListener('click', () => {
        tbody.querySelectorAll('tr.muted').forEach(r => r.remove());
        tbody.insertAdjacentHTML(
            'beforeend',
            crearFilaZonaHtml({
                id: 'z-' + Math.random().toString(36).slice(2, 11),
                nombre: 'Nueva zona',
                envio: 1500,
                palabrasClave: ''
            })
        );
    });

    container.querySelector('#zona-guardar').addEventListener('click', () => {
        const filas = Array.from(tbody.querySelectorAll('tr'));
        const zonas = [];
        for (let i = 0; i < filas.length; i++) {
            const tr = filas[i];
            if (tr.classList.contains('muted')) continue;
            const nombre = tr.querySelector('.zona-nombre')?.value?.trim();
            const envStr = tr.querySelector('.zona-envio')?.value;
            const palabrasClave = tr.querySelector('.zona-keys')?.value ?? '';
            if (!nombre) continue;
            const id = tr.getAttribute('data-zone-id') || 'z-' + Math.random().toString(36).slice(2, 11);
            zonas.push({
                id,
                nombre,
                envio: parseInt(envStr, 10) >= 0 ? parseInt(envStr, 10) : 0,
                palabrasClave
            });
        }
        // Admin simple legacy: ya no se usa (la versión activa es la de
        // Leaflet en zonas-leaflet.js, que persiste en Supabase). Si por
        // algún motivo cae acá, no escribimos a localStorage.
        showFb('Usá el admin de zonas en el panel cocina (con mapa).', false);
    });

    container.querySelector('#zona-ejemplo').addEventListener('click', () => {
        const z = typeof defaultDeliveryZones === 'function' ? defaultDeliveryZones() : [];
        tbody.innerHTML = z.map(crearFilaZonaHtml).join('');
        showFb('Vista previa de ejemplo (no se guarda — usá el admin con mapa).', false);
    });
}

function cocinaTabsHtml(active) {
    var a = active || 'pedidos';
    function btn(id, label) {
        var cls = a === id ? 'option-btn active' : 'option-btn';
        return '<button type="button" class="' + cls + '" data-tab="' + id + '">' + label + '</button>';
    }
    return `
      <div class="cocina-toolbar pedido-card-shell">
        <div class="cocina-toolbar-row">
          <div class="option-buttons modern-options cocina-tabs">
            ${btn('pedidos', 'Pedidos')}
            ${btn('menu', 'Menú')}
            ${btn('zonas', 'Zonas')}
          </div>
          <div class="cocina-toolbar-right muted small">
            Panel admin (localStorage)
          </div>
        </div>
        <div id="cocina-tab-content"></div>
      </div>`;
}

function menuAdminHtml(menu) {
    var items = Array.isArray(menu) ? menu : [];
    var cats = typeof UMASUSHI_MENU_CATEGORIAS !== 'undefined' ? UMASUSHI_MENU_CATEGORIAS : ['Productos', 'Tablas', 'Vinos'];
    var byCat = {};
    cats.forEach(function (c) {
        byCat[c] = [];
    });
    items.forEach(function (p) {
        var cat = p.categoria || 'Productos';
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push(p);
    });

    function productCard(p) {
        var gluten = p.tags && p.tags.glutenfree !== false;
        var veg = p.tags && p.tags.veggi;
        var img = umasushiEscapeHtml(p.imagen || '/static/producto.jpeg');
        return `
          <div class="admin-product-card" data-prod-id="${umasushiEscapeHtml(p.id)}">
            <div class="admin-product-preview">
              <img src="${img}" alt="${umasushiEscapeHtml(p.nombre)}" class="admin-prod-thumb">
              <div class="admin-prod-content">
                <strong>${umasushiEscapeHtml(p.nombre || '')}</strong>
                <p>${umasushiEscapeHtml(p.descripcion || '')}</p>
                <div class="admin-prod-meta">
                  <span class="admin-prod-category">${umasushiEscapeHtml(p.categoria || 'Productos')}</span>
                  ${veg ? '<span class="tag-chip">Veggie</span>' : ''}
                  ${gluten ? '<span class="tag-chip">Gluten free</span>' : ''}
                </div>
              </div>
            </div>
            <div class="admin-product-actions">
              <span class="admin-prod-price">$${Number(p.precio) || 0}</span>
              <div>
                <button type="button" class="btn-secondary admin-edit-prod" data-prod-id="${umasushiEscapeHtml(p.id)}">Editar</button>
                <button type="button" class="btn-ghost admin-del-prod" data-prod-id="${umasushiEscapeHtml(p.id)}">Eliminar</button>
              </div>
            </div>
          </div>`;
    }

    var sections = cats
        .map(function (cat) {
            var products = byCat[cat] || [];
            if (!products.length) return '';
            return `
          <div class="admin-category-section">
            <div class="admin-category-header">
              <h4>${umasushiEscapeHtml(cat)}</h4>
              <span>${products.length} productos</span>
            </div>
            <div class="admin-menu-grid">
              ${products.map(productCard).join('')}
            </div>
          </div>`;
        })
        .join('');

    if (!sections) {
        sections = '<div class="muted">No hay productos. Agregá uno con el botón "Agregar producto".</div>';
    }

    return `
      <section class="pedido-card-shell admin-menu-card">
        <div class="admin-head">
          <h3>Editor de menú</h3>
          <p class="muted small">Edición completa del menú. No se eliminan los productos seed existentes.</p>
        </div>
        <div class="admin-menu-actions">
          <button type="button" id="admin-menu-add" class="btn-secondary">Agregar producto</button>
          <button type="button" id="admin-menu-save" class="btn-primary">Guardar menú</button>
          <button type="button" id="admin-menu-reset" class="btn-secondary">Restaurar menú ejemplo</button>
        </div>
        <div id="admin-menu-grid">${sections}</div>
        <p id="admin-menu-feedback" class="muted small zonas-feedback" hidden></p>

        <div id="admin-menu-modal" class="umai-modal" hidden>
          <div class="umai-modal-overlay" data-close="1"></div>
          <div class="umai-modal-card">
            <div class="umai-modal-head">
              <strong>Producto</strong>
              <button type="button" class="btn-ghost" data-close="1">✕</button>
            </div>
            <div class="umai-modal-body">
              <input type="hidden" id="admin-prod-id">
              <div class="form-row">
                <label for="admin-prod-name">Nombre</label>
                <input id="admin-prod-name" class="inp-modern" type="text" placeholder="Nombre del producto">
              </div>
              <div class="form-row">
                <label for="admin-prod-desc">Descripción</label>
                <textarea id="admin-prod-desc" class="inp-modern" rows="3" placeholder="Descripción breve"></textarea>
              </div>
              <div class="form-row form-row-split">
                <div>
                  <label for="admin-prod-price">Precio</label>
                  <input id="admin-prod-price" class="inp-modern" type="number" min="0" step="50" placeholder="Precio">
                </div>
                <div>
                  <label for="admin-prod-cat">Categoría</label>
                  <select id="admin-prod-cat" class="inp-modern">
                    ${(typeof UMASUSHI_MENU_CATEGORIAS !== 'undefined' ? UMASUSHI_MENU_CATEGORIAS : ['Productos', 'Tablas', 'Vinos'])
                        .map(function (c) {
                            return `<option value="${umasushiEscapeHtml(c)}">${umasushiEscapeHtml(c)}</option>`;
                        })
                        .join('')}
                  </select>
                </div>
              </div>
              <div class="form-row form-row-split">
                <label class="checkbox-label"><input id="admin-prod-veggi" type="checkbox"> Veggie</label>
                <label class="checkbox-label"><input id="admin-prod-glutenfree" type="checkbox"> Gluten free</label>
              </div>
              <div class="form-row">
                <label class="checkbox-label">
                  <input id="admin-prod-es-extra" type="checkbox">
                  Es extra (no aparece en el menú del index, sí en pedido y cocina)
                </label>
              </div>
              <div class="form-row">
                <label>Imagen</label>
                <div class="admin-image-picker">
                  <img id="admin-prod-image-preview" class="admin-prod-thumb admin-preview-thumb" src="/static/producto.jpeg" alt="Vista previa">
                  <label class="btn-secondary btn-file">
                    Cambiar imagen
                    <input id="admin-prod-image-file" type="file" accept="image/*" hidden>
                  </label>
                </div>
              </div>
              <div class="form-row">
                <div id="admin-modal-row-msg" class="muted small" hidden></div>
              </div>
            </div>
            <div class="umai-modal-foot">
              <button type="button" class="btn-secondary" data-close="1">Cancelar</button>
              <button type="button" class="btn-primary" id="admin-menu-modal-save">Guardar producto</button>
            </div>
          </div>
        </div>
      </section>`;
}

function configurarHandlersMenuAdmin(container) {
    console.log('[cocina] configurarHandlersMenuAdmin container', container);
    var feedback = container.querySelector('#admin-menu-feedback');
    var modal = container.querySelector('#admin-menu-modal');
    var modalOverlay = container.querySelector('.umai-modal-overlay');
    var modalSave = container.querySelector('#admin-menu-modal-save');
    var modalMsg = container.querySelector('#admin-modal-row-msg');
    var grid = container.querySelector('#admin-menu-grid');
    var inputId = container.querySelector('#admin-prod-id');
    var inputName = container.querySelector('#admin-prod-name');
    var inputDesc = container.querySelector('#admin-prod-desc');
    var inputPrice = container.querySelector('#admin-prod-price');
    var inputCat = container.querySelector('#admin-prod-cat');
    var inputVeggi = container.querySelector('#admin-prod-veggi');
    var inputGlutenfree = container.querySelector('#admin-prod-glutenfree');
    var inputEsExtra = container.querySelector('#admin-prod-es-extra');
    var imagePreview = container.querySelector('#admin-prod-image-preview');
    var imageFile = container.querySelector('#admin-prod-image-file');
    var currentEditId = null;

    if (!container || !grid) {
        console.error('[cocina] configurarHandlersMenuAdmin no encontró el grid de menú o el contenedor.');
        if (feedback) {
            feedback.hidden = false;
            feedback.textContent = 'No se puede inicializar el editor de menú. Revisa la consola.';
            feedback.style.color = '#c0392b';
        }
        return;
    }

    function show(msg, ok) {
        if (!feedback) return;
        feedback.hidden = false;
        feedback.textContent = msg;
        feedback.style.color = ok ? '#0f490f' : '#c0392b';
        setTimeout(function () {
            if (feedback) feedback.hidden = true;
        }, 4000);
    }

    function showModalMessage(msg, ok) {
        if (!modalMsg) return;
        modalMsg.hidden = false;
        modalMsg.textContent = msg;
        modalMsg.style.color = ok ? '#0f490f' : '#c0392b';
    }

    function resetForm() {
        currentEditId = null;
        if (inputId) inputId.value = '';
        if (inputName) inputName.value = '';
        if (inputDesc) inputDesc.value = '';
        if (inputPrice) inputPrice.value = '';
        if (inputCat) inputCat.value = typeof UMASUSHI_MENU_CATEGORIAS !== 'undefined' ? UMASUSHI_MENU_CATEGORIAS[0] : 'Productos';
        if (inputVeggi) inputVeggi.checked = false;
        if (inputGlutenfree) inputGlutenfree.checked = false;
        if (inputEsExtra) inputEsExtra.checked = false;
        if (imagePreview) imagePreview.src = '/static/producto.jpeg';
        if (modalMsg) modalMsg.hidden = true;
    }

    function openModal(item) {
        if (item) {
            currentEditId = item.id;
            if (inputId) inputId.value = item.id;
            if (inputName) inputName.value = item.nombre || '';
            if (inputDesc) inputDesc.value = item.descripcion || '';
            if (inputPrice) inputPrice.value = Number(item.precio) || 0;
            if (inputCat) inputCat.value = item.categoria || 'Productos';
            if (inputVeggi) inputVeggi.checked = !!(item.tags && item.tags.veggi);
            if (inputGlutenfree) inputGlutenfree.checked = item.tags ? !!item.tags.glutenfree : true;
            if (inputEsExtra) inputEsExtra.checked = !!item.es_extra;
            if (imagePreview) imagePreview.src = item.imagen || '/static/producto.jpeg';
        } else {
            resetForm();
        }
        if (modal) modal.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (!modal) return;
        modal.hidden = true;
        document.body.style.overflow = '';
    }

    function getMenuItemById(id) {
        var menu = typeof loadMenu === 'function' ? loadMenu() : typeof obtenerMenu === 'function' ? obtenerMenu() : [];
        return menu.find(function (p) {
            return p.id === id;
        });
    }

    function renderCards() {
        var menu = typeof loadMenu === 'function' ? loadMenu() : typeof obtenerMenu === 'function' ? obtenerMenu() : [];
        var cats = typeof UMASUSHI_MENU_CATEGORIAS !== 'undefined' ? UMASUSHI_MENU_CATEGORIAS : ['Productos', 'Tablas', 'Vinos'];
        var byCat = {};
        cats.forEach(function (c) {
            byCat[c] = [];
        });
        menu.forEach(function (p) {
            var cat = p.categoria || 'Productos';
            if (!byCat[cat]) byCat[cat] = [];
            byCat[cat].push(p);
        });

        function renderProduct(p) {
            var gluten = p.tags && p.tags.glutenfree !== false;
            var veg = p.tags && p.tags.veggi;
            var esExtra = !!p.es_extra;
            return `
              <div class="admin-product-card" data-prod-id="${umasushiEscapeHtml(p.id)}">
                <div class="admin-product-preview">
                  <img src="${umasushiEscapeHtml(p.imagen || '/static/producto.jpeg')}" alt="${umasushiEscapeHtml(p.nombre)}" class="admin-prod-thumb">
                  <div class="admin-prod-content">
                    <strong>${umasushiEscapeHtml(p.nombre || '')}</strong>
                    <p>${umasushiEscapeHtml(p.descripcion || '')}</p>
                    <div class="admin-prod-meta">
                      <span class="admin-prod-category">${umasushiEscapeHtml(p.categoria || 'Productos')}</span>
                      ${esExtra ? '<span class="tag-chip" style="background:#ffd966;color:#7a5a00">Extra</span>' : ''}
                      ${veg ? '<span class="tag-chip">Veggie</span>' : ''}
                      ${gluten ? '<span class="tag-chip">Gluten free</span>' : ''}
                    </div>
                  </div>
                </div>
                <div class="admin-product-actions">
                  <span class="admin-prod-price">$${Number(p.precio) || 0}</span>
                  <div>
                    <button type="button" class="btn-secondary admin-edit-prod" data-prod-id="${umasushiEscapeHtml(p.id)}">Editar</button>
                    <button type="button" class="btn-ghost admin-del-prod" data-prod-id="${umasushiEscapeHtml(p.id)}">Eliminar</button>
                  </div>
                </div>
              </div>`;
        }

        if (!grid) return;
        var html = cats
            .map(function (cat) {
                var products = byCat[cat] || [];
                if (!products.length) return '';
                return `
                  <div class="admin-category-section">
                    <div class="admin-category-header">
                      <h4>${umasushiEscapeHtml(cat)}</h4>
                      <span>${products.length} productos</span>
                    </div>
                    <div class="admin-menu-grid">
                      ${products.map(renderProduct).join('')}
                    </div>
                  </div>`;
            })
            .join('');
        if (!html.trim()) {
            html = '<div class="muted">No hay productos. Agregá uno con el botón "Agregar producto".</div>';
        }
        grid.innerHTML = html;
    }

    function saveProduct() {
        var nombre = inputName ? inputName.value.trim() : '';
        var precio = inputPrice ? Number(inputPrice.value) : 0;
        var descripcion = inputDesc ? inputDesc.value.trim() : '';
        var categoria = inputCat ? inputCat.value : 'Productos';
        var veggi = inputVeggi ? inputVeggi.checked : false;
        var glutenfree = inputGlutenfree ? inputGlutenfree.checked : true;
        var esExtra = inputEsExtra ? inputEsExtra.checked : false;
        var imagen = imagePreview ? imagePreview.src : '/static/producto.jpeg';
        // Para producto nuevo: generar UUID v4 (requerido por la columna uuid de Supabase).
        // Si ya existe (edición), preservar su id.
        var id = inputId && inputId.value
            ? inputId.value
            : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : 'p-' + Math.random().toString(36).slice(2, 11));

        if (!nombre) {
            showModalMessage('El nombre es obligatorio.', false);
            return;
        }

        if (!(precio >= 0)) {
            showModalMessage('Ingresá un precio válido.', false);
            return;
        }

        var producto = {
            id: id,
            nombre: nombre,
            descripcion: descripcion,
            precio: precio,
            categoria: categoria,
            imagen: imagen,
            es_extra: esExtra,
            tags: { veggi: veggi, glutenfree: glutenfree }
        };

        // Usar la función async para guardar
        if (typeof upsertProductoAsync !== 'function') {
            showModalMessage('No se puede guardar el producto.', false);
            return;
        }
        showModalMessage('Guardando producto...', true);
        upsertProductoAsync(producto)
            .then(function (productosActualizados) {
                console.log('[cocina] ✓ Producto guardado, refrescando UI...');
                if (typeof productosCache !== 'undefined') {
                    productosCache = productosActualizados.slice();
                }
                show('Producto guardado.', true);
                closeModal();
                renderCards();
            })
            .catch(function (e) {
                console.error('[cocina] Error guardando producto:', e);
                showModalMessage('Error guardando: ' + e.message, false);
            });
    }

    function handleFileInput() {
        var file = imageFile && imageFile.files && imageFile.files[0];
        if (!file || typeof fileToDataUrl !== 'function') return;
        showModalMessage('Cargando imagen…', true);
        fileToDataUrl(file)
            .then(function (dataUrl) {
                if (imagePreview) imagePreview.src = dataUrl;
                showModalMessage('Imagen cargada.', true);
            })
            .catch(function () {
                showModalMessage('No se pudo leer la imagen.', false);
            });
    }

    container.querySelector('#admin-menu-add').addEventListener('click', function () {
        resetForm();
        openModal(null);
    });

    container.querySelector('#admin-menu-save').addEventListener('click', function () {
        if (typeof sincronizarProductos !== 'function') {
            show('No se puede sincronizar: servicio de productos no disponible.', false);
            return;
        }
        show('Actualizando desde Supabase…', true);
        sincronizarProductos()
            .then(function () {
                show('Menú actualizado desde Supabase.', true);
                renderCards();
            })
            .catch(function (e) {
                console.error('[cocina] Error sincronizando:', e);
                show('Error al actualizar: ' + (e && e.message ? e.message : String(e)), false);
            });
    });

    container.querySelector('#admin-menu-reset').addEventListener('click', function () {
        if (typeof seedMenuEjemploEnSupabase !== 'function') {
            show('Restaurar ejemplo no disponible.', false);
            return;
        }
        show('Publicando menú de ejemplo en Supabase…', true);
        seedMenuEjemploEnSupabase()
            .then(function () {
                renderCards();
                show('Menú de ejemplo publicado en Supabase.', true);
            })
            .catch(function (err) {
                console.error('[cocina] Error en reset:', err);
                show('No se pudo restaurar: ' + (err && err.message ? err.message : String(err)), false);
            });
    });

    grid.addEventListener('click', function (e) {
        var edit = e.target.closest('.admin-edit-prod');
        if (edit) {
            var id = edit.dataset.prodId;
            var item = getMenuItemById(id);
            if (item) openModal(item);
            return;
        }
        var del = e.target.closest('.admin-del-prod');
        if (del) {
            var id = del.dataset.prodId;
            if (typeof eliminarProductoAsync !== 'function') {
                show('No se puede eliminar el producto.', false);
                return;
            }
            console.log('[cocina] Eliminando producto async:', id);
            eliminarProductoAsync(id)
                .then(function (productosActualizados) {
                    if (typeof productosCache !== 'undefined') {
                        productosCache = productosActualizados.slice();
                    }
                    show('Producto eliminado.', true);
                    renderCards();
                })
                .catch(function (e) {
                    console.error('[cocina] Error eliminando producto:', e);
                    show('Error eliminando: ' + e.message, false);
                });
        }
    });

    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeModal);
    }

    container.querySelectorAll('[data-close="1"]').forEach(function (btn) {
        btn.addEventListener('click', closeModal);
    });

    if (imageFile) {
        imageFile.addEventListener('change', handleFileInput);
    }

    if (modalSave) {
        modalSave.addEventListener('click', saveProduct);
    }

    renderCards();
}

// Alias solicitado (API pública/refactor)
function renderAdminMenu(container) {
    console.log('[cocina] renderAdminMenu container', container);
    if (typeof initializeMenu === 'function') initializeMenu();
    var menu = typeof loadMenu === 'function' ? loadMenu() : typeof obtenerMenu === 'function' ? obtenerMenu() : [];
    if (!Array.isArray(menu)) menu = [];
    console.log('[cocina] renderAdminMenu menu length=', menu.length);
    container.innerHTML = menuAdminHtml(menu);
    configurarHandlersMenuAdmin(container);
}

function renderCocina(activeTab) {
    console.log('[cocina] renderCocina activeTab=', activeTab);
    var content = document.getElementById('cocina-content');
    if (!content) {
        console.error('[cocina] No se encontró el contenedor cocina-content.');
        return;
    }
    var active = activeTab || 'pedidos';
    content.innerHTML = cocinaTabsHtml(active);
    var tabHost = content.querySelector('#cocina-tab-content');
    if (!tabHost) {
        console.error('[cocina] No se encontró el contenedor interno de tabs.');
        return;
    }

    if (active === 'zonas') {
        tabHost.innerHTML = '<p class="muted">Cargando zonas desde Supabase…</p>';
        (typeof obtenerZonas === 'function' ? obtenerZonas() : Promise.resolve([]))
            .then(function (zonas) {
                var lista = Array.isArray(zonas) ? zonas : [];
                console.log('[cocina] renderCocina zonas count=', lista.length);
                if (typeof zonasTableHtmlCircle === 'function' && typeof configurarZonasCircleAdmin === 'function') {
                    tabHost.innerHTML = zonasTableHtmlCircle(lista);
                    configurarZonasCircleAdmin(tabHost);
                } else {
                    tabHost.innerHTML = tablaZonasHtml(lista);
                    configurarHandlersZonaAdmin(tabHost);
                }
            })
            .catch(function (err) {
                console.error('[cocina] error render zonas', err);
                tabHost.innerHTML = '<div class="muted">No se pudo cargar las zonas. Revisa la consola.</div>';
            });
        return;
    }

    if (active === 'menu') {
        try {
            renderAdminMenu(tabHost);
        } catch (err) {
            console.error('[cocina] error render admin menu', err);
            tabHost.innerHTML = '<div class="muted">No se pudo cargar el editor de menú. Revisa la consola.</div>';
        }
        return;
    }

    // pedidos: listado con filtros + búsqueda
    tabHost.innerHTML = `
      <section class="pedido-card-shell cocina-pedidos-tools">
        <div class="cocina-tools-row">
          <div class="option-buttons modern-options cocina-filter">
            <button type="button" class="option-btn active" data-filter="pendientes">Pendientes</button>
            <button type="button" class="option-btn" data-filter="entregados">Entregados</button>
            <button type="button" class="option-btn" data-filter="todos">Todos</button>
          </div>
          <div class="cocina-search">
            <input id="cocina-search-input" class="inp-modern" type="search" placeholder="Buscar por nombre…" autocomplete="off">
          </div>
        </div>
      </section>
      <div id="cocina-pedidos-lista" class="cocina-pedidos-lista"></div>`;
    var listHost = tabHost.querySelector('#cocina-pedidos-lista');
    var filtro = 'pendientes';
    var search = '';

    function setActiveFilter(next) {
        filtro = next;
        tabHost.querySelectorAll('.cocina-filter .option-btn').forEach(function (b) {
            b.classList.toggle('active', b.dataset.filter === filtro);
        });
        renderLista();
    }

    tabHost.querySelectorAll('.cocina-filter .option-btn').forEach(function (b) {
        b.addEventListener('click', function () {
            setActiveFilter(this.dataset.filter);
        });
    });

    tabHost.querySelector('#cocina-search-input').addEventListener('input', function () {
        search = String(this.value || '').trim();
        renderLista();
    });

    async function renderLista() {
        try {
            const pedidos = await obtenerPedidos();
            // Orden: pendientes arriba (más nuevos primero), entregados abajo
            var sorted = pedidos.slice().sort(function (a, b) {
                var aEntregado = a.estado === 'entregado';
                var bEntregado = b.estado === 'entregado';
        
                if (aEntregado !== bEntregado) {
                    return aEntregado ? 1 : -1;
                }
                // best-effort: si vino fechaHoraPedido en formato legible, dejamos el orden natural (unshift ya mete nuevos arriba)
                return new Date(b.fecha) - new Date(a.fecha);
            });

            // Filtrado
            var filtered = sorted.filter(function (p) {
                if (filtro === 'pendientes') {
                    return p.estado !== 'entregado'
                        && p.estado !== 'cancelado';
                }

                if (filtro === 'entregados') {
                    return p.estado === 'entregado';
                }

                return true;
            });

            // Búsqueda por nombre
            if (search) {
                var q = typeof normalizeSearchText === 'function' ? normalizeSearchText(search) : search.toLowerCase();
                filtered = filtered.filter(function (p) {
                    var n = typeof normalizeSearchText === 'function' ? normalizeSearchText(p && p.nombre) : String(p && p.nombre || '').toLowerCase();
                    return n.indexOf(q) !== -1;
                });
            }

            if (filtered.length === 0) {
                listHost.innerHTML =
                    '<div class="pedido-card"><div class="pedido-body-modern"><p>Sin pedidos para este filtro.</p></div></div>';
                return;
            }
            listHost.innerHTML = filtered.map(function (pedido){

                var entregado = pedido.estado === 'entregado';
        
                return `
                <div class="pedido-card ${entregado ? 'entregado' : 'pendiente'}">
        
                    <div class="pedido-header" onclick="togglePedido(this)">
                        <div>
                            <h3>
                                ${umasushiEscapeHtml(pedido.cliente || '')}
                                ·
                                ${umasushiEscapeHtml(formatoMarcaTemporalPedido(pedido))}
                            </h3>
        
                            <p class="muted small">
                                ${umasushiEscapeHtml(pedido.entrega || '')}
                            </p>
                        </div>
        
                        <span class="toggle-icon">▼</span>
                    </div>
        
                    <div class="pedido-body">
        
                        ${htmlDetalleCompletoPedido(pedido)}
        
                        <button
                            type="button"
                            class="btn-secondary estado-btn"
                            data-id="${pedido.id}"
                        >
                            ${entregado
                                ? 'Entregado ✔'
                                : 'Marcar como entregado'}
                        </button>
        
                    </div>
        
                </div>`;
            }).join('');
        
            listHost.querySelectorAll('.estado-btn').forEach(function(btn){

                btn.addEventListener('click', async function () {
                    var id = this.dataset.id;
                    const actualizado = await actualizarEstadoPedido(id, 'entregado');
                    if (!actualizado) {
                        console.error('No se pudo actualizar el pedido');
                        return;
                    }

                    await renderLista();
                });

            });
        }catch (err) {
            console.error('[cocina] error render lista', err);
            listHost.innerHTML = `<div class="pedido-body-modern"><p>No se pudo cargar la lista de pedidos.</p></div>`;
        }
    }
}

// Alias solicitado (API pública/refactor)
function renderPedido() {

    // En cocina, "renderPedido" refiere a render del panel.
    return renderCocina('pedidos');
}

// ===== VISTA INDIVIDUAL DE PEDIDO (link enviado por WhatsApp) =====
// El pedido YA está en Supabase (lo guardó el cliente al confirmar).
// Cocina solo consulta y transiciona estado. NUNCA re-crea ni duplica.
const PEDIDO_ESTADO_TRANSICIONES = {
    nuevo: { siguiente: 'preparando', label: 'Empezar a preparar' },
    preparando: { siguiente: 'listo', label: 'Marcar listo' },
    listo: { siguiente: 'entregado', label: 'Marcar entregado' },
    entregado: null,
    cancelado: null
};

function pedidoEstadoBadgeHtml(estado) {
    var e = String(estado || 'nuevo');
    return '<span class="estado-badge estado-' + umasushiEscapeHtml(e) + '">' + umasushiEscapeHtml(e) + '</span>';
}

async function renderPedidoIndividual(pedidoId, host) {
    host.innerHTML = '<div class="pedido-card"><div class="pedido-body-modern"><p>Cargando pedido…</p></div></div>';

    let pedido;
    try {
        pedido = await obtenerPedidoPorId(pedidoId);
    } catch (err) {
        console.error('[cocina] error obtenerPedidoPorId:', err);
        pedido = null;
    }

    if (!pedido) {
        host.innerHTML = `
            <div class="pedido-card">
              <div class="pedido-body-modern">
                <h3>Pedido no encontrado</h3>
                <p>El link puede estar incompleto, dañado, o el pedido fue eliminado.</p>
                <p class="muted small">ID buscado: ${umasushiEscapeHtml(pedidoId)}</p>
                <a href="cocina.html" class="btn-secondary">Volver al panel</a>
              </div>
            </div>`;
        return;
    }

    // Render con clave gate. El detalle del pedido se muestra siempre
    // (no es información ultra-sensible), pero las acciones de estado
    // requieren clave.
    function renderInterno() {
        const transicion = PEDIDO_ESTADO_TRANSICIONES[pedido.estado] || null;
        const esFinal = !transicion;
        const claveBlock = esFinal
            ? ''
            : `
              <div class="clave-section">
                <input type="password" id="clave-cocina" placeholder="Clave cocina" autocomplete="off">
                <button type="button" id="estado-btn" class="btn-primary" disabled>
                  ${umasushiEscapeHtml(transicion.label)}
                </button>
              </div>`;

        host.innerHTML = `
            <div class="pedido-card">
              <div class="pedido-body-modern">
                <div class="pedido-individual-head">
                  <h3>Pedido de ${umasushiEscapeHtml(pedido.cliente || 'Cliente')}</h3>
                  ${pedidoEstadoBadgeHtml(pedido.estado)}
                </div>
                ${htmlDetalleCompletoPedido(pedido)}
                ${claveBlock}
                <p class="muted small">ID: ${umasushiEscapeHtml(pedido.id)}</p>
                <p><a href="cocina.html" class="btn-secondary">Ver todos los pedidos</a></p>
              </div>
            </div>`;

        if (esFinal) return;

        const CLAVE = (window.UMASUSHI_CONFIG && window.UMASUSHI_CONFIG.claveCocina) || '';
        const claveInput = document.getElementById('clave-cocina');
        const estadoBtn = document.getElementById('estado-btn');

        claveInput.addEventListener('input', () => {
            estadoBtn.disabled = claveInput.value !== CLAVE;
        });

        estadoBtn.addEventListener('click', async () => {
            if (claveInput.value !== CLAVE) return;
            estadoBtn.disabled = true;
            estadoBtn.textContent = 'Actualizando…';
            try {
                const actualizado = await actualizarEstadoPedido(pedido.id, transicion.siguiente);
                if (!actualizado) {
                    alert('No se pudo actualizar el estado. Revisá la conexión.');
                    estadoBtn.disabled = false;
                    estadoBtn.textContent = transicion.label;
                    return;
                }
                pedido = actualizado;
                renderInterno();
            } catch (err) {
                console.error('[cocina] error actualizando estado:', err);
                alert('Error actualizando estado.');
                estadoBtn.disabled = false;
                estadoBtn.textContent = transicion.label;
            }
        });
    }

    renderInterno();
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[cocina] DOMContentLoaded init');
    document.getElementById('cocina').classList.add('fade-in');

    const params = new URLSearchParams(window.location.search);
    const pedidoId = params.get('id');

    const content = document.getElementById('cocina-content');

    if (pedidoId) {
        await renderPedidoIndividual(pedidoId, content);
        return;
    }

    // Default tab
    renderCocina('pedidos');

    // Tab switching (event delegation)
    content.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-tab]');
        if (!btn) return;
        renderCocina(btn.dataset.tab);
    });
});
