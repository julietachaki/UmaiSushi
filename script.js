// ============================================================
// Multi-tenant: el cliente público resuelve qué negocio carga
// según el slug en la URL (path `/u/<slug>/...` o query `?slug=`).
// Cuando no se especifica (legacy / paths viejos), default 'umai'.
// ============================================================
var DEFAULT_SLUG = 'umai';
var currentNegocio = null;

function getSlugFromUrl() {
    try {
        // Prioridad 1: query string ?slug=... (camino actual sin rewrites de Vercel).
        // Esto evita que /u/pedido.html?slug=umai resuelva el slug como
        // 'pedido.html' por error.
        var params = new URLSearchParams(location.search);
        var fromQuery = params.get('slug');
        if (fromQuery) return fromQuery;
        // Prioridad 2: path /u/<slug>/... (cuando Vercel reescribe).
        // Solo aceptamos como slug si NO tiene extensión (no es un .html).
        var parts = location.pathname.split('/').filter(Boolean);
        if (parts[0] === 'u' && parts[1] && parts[1].indexOf('.') === -1) return parts[1];
    } catch (e) {}
    return DEFAULT_SLUG;
}

/**
 * Recorre los <a> de la página y añade `?slug=<slug>` a los que apuntan
 * a páginas internas del cliente público (index.html, pedido.html,
 * orden.html). Necesario en dev sin rewrites de Vercel.
 */
function propagarSlugEnLinks(slug) {
    var sluggables = ['index.html', 'pedido.html', 'orden.html'];
    document.querySelectorAll('a[href]').forEach(function (a) {
        var href = a.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
        // Solo paths relativos del cliente (no /dashboard/, /login/, etc)
        var lastSegment = href.split('?')[0].split('/').pop();
        if (sluggables.indexOf(lastSegment) === -1) return;
        if (href.indexOf('slug=') !== -1) return;
        var sep = href.indexOf('?') !== -1 ? '&' : '?';
        a.setAttribute('href', href + sep + 'slug=' + encodeURIComponent(slug));
    });
}

async function resolverNegocioActual() {
    if (currentNegocio) return currentNegocio;
    const slug = getSlugFromUrl();
    if (typeof obtenerNegocioPorSlug !== 'function') {
        console.warn('[app] negocios.service no cargado, sigo sin negocio');
        return null;
    }
    // Esperar a Supabase ready
    let intentos = 0;
    while ((typeof isSupabaseReady !== 'function' || !isSupabaseReady()) && intentos < 30) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }
    currentNegocio = await obtenerNegocioPorSlug(slug);
    if (!currentNegocio) {
        console.warn('[app] No se encontró negocio para slug:', slug);
    } else {
        console.log('[app] ✓ Negocio actual:', currentNegocio.slug, currentNegocio.id);
    }
    return currentNegocio;
}

// Animación de fade-in al hacer scroll
document.addEventListener('DOMContentLoaded', async function () {
    const sections = document.querySelectorAll('section');

    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('fade-in');
            });
        },
        { threshold: 0.1 }
    );

    sections.forEach(section => observer.observe(section));

    // ===== CARGA DE DATOS (solo Supabase) =====
    // 1. Resolver negocio por slug
    // 2. Productos del negocio → productosCache (menu-store.js)
    // 3. Zonas del negocio    → umasushiZonasCache (order-shared.js)
    console.log('[app] Inicializando carga de datos...');
    await resolverNegocioActual();

    // Propagar el slug a links internos de /u/* para que la navegación
    // mantenga el negocio activo (workaround sin rewrites de Vercel).
    if (location.pathname.startsWith('/u/') && currentNegocio && currentNegocio.slug) {
        propagarSlugEnLinks(currentNegocio.slug);
    }

    await Promise.all([
        cargarProductosConSupabase(),
        typeof cargarZonasConSupabase === 'function' ? cargarZonasConSupabase() : Promise.resolve()
    ]);

    if (window.location.pathname.includes('pedido.html')) {
        renderPedido();
        inicializarPedidoUI();
    } else {
        renderMenu();
        actualizarContadores();
        actualizarStickyBar();
    }
});

/**
 * Cargar zonas desde Supabase y poblar `umasushiZonasCache` (order-shared.js).
 * Después de esto, `obtenerZonasDelivery()` lee síncrono desde el cache.
 */
async function cargarZonasConSupabase() {
    try {
        let intentos = 0;
        while (!isSupabaseReady() && intentos < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            intentos++;
        }
        if (!isSupabaseReady()) {
            console.warn('[app] Supabase no listo — zonas vacías');
            return;
        }
        if (typeof obtenerZonas !== 'function') {
            console.warn('[app] obtenerZonas no disponible');
            return;
        }
        const opts = currentNegocio ? { negocioId: currentNegocio.id } : {};
        const zonas = await obtenerZonas(opts);
        if (typeof umasushiZonasCache !== 'undefined') {
            // eslint-disable-next-line no-global-assign
            umasushiZonasCache = Array.isArray(zonas) ? zonas.slice() : [];
            console.log('[app] ✓ Zonas cargadas:', umasushiZonasCache.length);
        }
    } catch (e) {
        console.error('[app] Error cargando zonas:', e.message);
    }
}

// ===== SUPABASE INTEGRATION - Carga de Productos =====
/**
 * Cargar productos desde Supabase y actualizar productosCache (menu-store.js).
 */
async function cargarProductosConSupabase() {
    try {
        // Esperar a que Supabase esté inicializado
        let intentos = 0;
        while (!isSupabaseReady() && intentos < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            intentos++;
        }
        
        if (isSupabaseReady()) {
            console.log('[app] Cargando productos desde Supabase...');
            const opts = currentNegocio ? { negocioId: currentNegocio.id } : {};
            const productos = await obtenerProductos(opts);

            if (productos && productos.length > 0) {
                if (typeof productosCache !== 'undefined') {
                    productosCache = productos.slice();
                    console.log('[app] ✓ Cache global actualizado:', productos.length, 'productos');
                }
                
                // NO guardar en localStorage (productos solo en Supabase)
                console.log('[app] ✓ Productos cargados desde Supabase');
                return;
            } else {
                console.warn('[app] No hay productos en Supabase');
            }
        } else {
            console.warn('[app] Supabase no está listo');
        }
    } catch (e) {
        console.error('[app] Error cargando productos:', e.message);
    }

    // Supabase es la única fuente de verdad. Si falla, no inventamos datos.
    console.error('[app] No se pudieron cargar productos. Verificar conexión a Supabase.');
}

function toggleMenu() {
    const sidebar = getEl('sidebar');
    sidebar.classList.toggle('active');
}

// ===== PEDIDO (carrito) =====

function obtenerPedido() {
    const pedido = localStorage.getItem('pedido');
    return pedido ? JSON.parse(pedido) : [];
}

function guardarPedido(pedido) {
    localStorage.setItem('pedido', JSON.stringify(pedido));
    actualizarContadores();
    actualizarStickyBar();
}

// Alias solicitado (API pública/refactor)
function savePedido(pedido) {
    return guardarPedido(pedido);
}

// ----- helpers DOM (FASE 2A) -----
function getEl(id) {
    return document['getElementById'](id);
}

function showError(elOrId, message) {
    var el = typeof elOrId === 'string' ? getEl(elOrId) : elOrId;
    if (!el) return;
    el.style.display = 'block';
    el.textContent = message == null ? '' : String(message);
}

function hideError(elOrId) {
    var el = typeof elOrId === 'string' ? getEl(elOrId) : elOrId;
    if (!el) return;
    el.style.display = 'none';
}

function setText(elOrId, value) {
    var el = typeof elOrId === 'string' ? getEl(elOrId) : elOrId;
    if (!el) return;
    el.textContent = value == null ? '' : String(value);
}

// ----- helpers localStorage (FASE 2B) -----
function getLS(key, fallback) {
    var v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v;
}

function setLS(key, value) {
    localStorage.setItem(key, value);
}

function removeLS(key) {
    localStorage.removeItem(key);
}

var LS_EXTRAS = 'umasushiPedidoExtras';
var LS_DELIVERY_TEXTO = 'deliveryAddressText';
var LS_DELIVERY_MAPS = 'deliveryMapsUrl';
var LS_DELIVERY_OK = 'deliveryAddressSeleccionOk';
var LS_DELIVERY_COORDS = 'deliveryCoords';
var LS_DELIVERY_GUARDADA = 'deliveryLocationGuardada';
var LS_MONTO_EFECTIVO = 'umasushiMontoCuantoPaga';
var LS_TELEFONO = 'umasushiTelefonoCliente';

var deliveryMap = null;
var deliveryMarker = null;
var deliveryZoneLayers = [];
var addressSearchTimeout = null;

function getDeliveryCoordsStored() {
    try {
        var raw = getLS(LS_DELIVERY_COORDS, null);
        if (!raw) return null;
        var j = JSON.parse(raw);
        if (!j || typeof j !== 'object') return null;
        var lat = Number(j.lat);
        var lng = Number(j.lng);
        if (!isFinite(lat) || !isFinite(lng)) return null;
        return { lat: lat, lng: lng };
    } catch (e) {
        return null;
    }
}

/**
 * Generar URL pública de OpenStreetMap a partir de coordenadas
 * Solo es una URL pública, no requiere API key
 */
function generateGoogleMapsUrl(coords) {
    if (!coords || typeof coords !== 'object') return '';

    const lat = Number(coords.lat);
    const lng = Number(coords.lng);

    if (!isFinite(lat) || !isFinite(lng)) return '';

    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function calculateDeliveryCompat(zonas) {
    // Solo usar calculateDelivery con coords obligatorias
    var coords = getDeliveryCoordsStored();
    if (coords && typeof calculateDelivery === 'function') {
        var res = calculateDelivery(coords, zonas);
        return {
            coincide: res.ok,
            nombre: res.ok ? res.zone.nombre : '',
            envio: res.ok ? res.costoEnvio : 0,
            mode: 'circle',
            distanceM: res.distanceM,
            reason: res.reason
        };
    }
    return { coincide: false, nombre: '', envio: 0, mode: 'circle', reason: 'no_coords' };
}

function menuByName(nombreProducto) {
    if (typeof buscarProductoPorNombre === 'function') return buscarProductoPorNombre(nombreProducto);
    return null;
}
function umasushiEscapeHtml(text = "") {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function renderMenu() {
    const host = getEl('menu-dynamic');
    if (!host) return;
    if (typeof initializeMenu === 'function') initializeMenu();

    // Productos del menú principal: excluir extras (es_extra=true).
    // Los extras se muestran solo en la sección Extras del formulario de pedido.
    const menuCompleto = typeof loadMenu === 'function' ? loadMenu() : typeof obtenerMenu === 'function' ? obtenerMenu() : [];
    const menu = menuCompleto.filter(p => !p.es_extra);
    const cats = typeof UMASUSHI_MENU_CATEGORIAS !== 'undefined' ? UMASUSHI_MENU_CATEGORIAS : [];

    function cardHtml(p) {
        const nombre = p.nombre || '';
        const precio = Number(p.precio) || 0;
        const desc = p.descripcion || '';
        const img = p.imagen || '/static/producto.jpeg';
        const gluten = p.tags && p.tags.glutenfree !== false ? '/static/glutenfree.png' : '';
        const veg = p.tags && p.tags.veggi ? '/static/veggi.png' : '';
        return `
          <div class="product-card product-card--compact" data-product-id="${umasushiEscapeHtml(p.id)}" data-product-name="${umasushiEscapeHtml(nombre)}" data-product-price="${precio}">
            <div class="product-main">
              <div class="product-header">
                <h4>${umasushiEscapeHtml(nombre)}</h4>
                <div class="product-icons">
                  ${gluten ? `<img src="${gluten}" class="icon-gluten" alt="Sin gluten">` : ''}
                  ${veg ? `<img src="${veg}" class="icon-veggi" alt="Veggie">` : ''}
                </div>
              </div>
              <p class="product-desc">${umasushiEscapeHtml(desc)}</p>
              <p class="price">$${precio}</p>
            </div>
            <div class="product-side">
              <img src="${umasushiEscapeHtml(img)}" alt="${umasushiEscapeHtml(nombre)}" class="product-img">
              <div class="product-actions">
                <div class="counter counter--mini">
                  <button class="counter-btn counter-btn--mini" type="button" data-action="dec" data-name="${umasushiEscapeHtml(nombre)}">−</button>
                  <span class="counter-qty counter-qty--mini" data-qty-for="${umasushiEscapeHtml(nombre)}">0</span>
                  <button class="counter-btn counter-btn--mini" type="button" data-action="inc" data-name="${umasushiEscapeHtml(nombre)}">+</button>
                </div>
              </div>
            </div>
          </div>`;
    }

    const byCat = {};
    menu.forEach(p => {
        const c = p.categoria || 'Productos';
        if (!byCat[c]) byCat[c] = [];
        byCat[c].push(p);
    });

    host.innerHTML = (cats.length ? cats : Object.keys(byCat)).map(cat => {
        const items = byCat[cat] || [];
        if (!items.length) return '';
        return `
          <div class="menu-section">
            <h3>${umasushiEscapeHtml(cat)}</h3>
            <div class="products-grid">
              ${items.map(cardHtml).join('')}
            </div>
          </div>`;
    }).join('');

    host.querySelectorAll('.counter-btn[data-action]').forEach(btn => {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function () {
            const name = this.dataset.name || '';
            if (this.dataset.action === 'inc') incrementarProducto(name);
            else decrementarProducto(name);
        });
    });
    actualizarContadores();
}

function incrementarProducto(nombreProducto) {
    const producto = menuByName(nombreProducto);
    if (!producto) return;

    let pedido = obtenerPedido();
    const existente = pedido.find(item => item.nombre === nombreProducto);

    if (existente) {
        existente.cantidad += 1;
    } else {
        pedido.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            desc: producto.descripcion || producto.desc || '',
            imagen: producto.imagen || '/static/producto.jpeg',
            categoria: producto.categoria || 'Productos',
            veggi: !!(producto.tags && producto.tags.veggi),
            cantidad: 1
        });
    }

    guardarPedido(pedido);
}

function decrementarProducto(nombreProducto) {
    let pedido = obtenerPedido();
    const existente = pedido.find(item => item.nombre === nombreProducto);

    if (existente) {
        existente.cantidad -= 1;
        if (existente.cantidad <= 0) {
            pedido = pedido.filter(item => item.nombre !== nombreProducto);
        }
    }

    guardarPedido(pedido);
}

function actualizarContadores() {
    const pedido = obtenerPedido();

    document.querySelectorAll('.counter-qty').forEach(el => (el.textContent = '0'));

    pedido.forEach(item => {
        const selector = `.counter-qty[data-qty-for="${CSS.escape(item.nombre)}"]`;
        const contador = document.querySelector(selector);
        if (contador) contador.textContent = String(item.cantidad || 0);
    });
}

function calcularTotalSoloProductos(pedido) {
    return pedido.reduce((total, item) => total + item.precio * item.cantidad, 0);
}

function actualizarStickyBar() {
    const pedido = obtenerPedido();
    const stickyBar = getEl('sticky-bar');
    if (!stickyBar) return;

    const totalProductos = pedido.reduce((sum, item) => sum + item.cantidad, 0);
    const totalMonto = calcularTotalSoloProductos(pedido);

    const sq = getEl('sticky-qty-num');
    const st = getEl('sticky-total');
    if (sq) sq.textContent = totalProductos;
    if (st) st.textContent = `$${totalMonto}`;

    if (totalProductos > 0) stickyBar.classList.add('active');
    else stickyBar.classList.remove('active');
}

// Alias solicitado (API pública/refactor)
function updateCartBar() {
    return actualizarStickyBar();
}

function agregarAlPedido(nombreProducto) {
    incrementarProducto(nombreProducto);
}

function renderPedido() {
    const pedido = obtenerPedido();
    const lista = getEl('pedido-lista');
    const vacio = getEl('pedido-vacio');

    lista.innerHTML = '';

    if (pedido.length === 0) {
        if (vacio) vacio.style.display = 'block';
        actualizarTotal();
        return;
    }

    if (vacio) vacio.style.display = 'none';

    pedido.forEach((item, idx) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'pedido-item pedido-item-card';
        const img = item.imagen || '/static/producto.jpeg';
        itemEl.innerHTML = `
            <img src="${umasushiEscapeHtml(img)}" alt="${umasushiEscapeHtml(item.nombre)}">
            <div class="item-details">
                <div class="item-name">${umasushiEscapeHtml(item.nombre)}</div>
                <div class="item-desc">${umasushiEscapeHtml(item.desc || '')}</div>
            </div>
            <div class="item-meta">
                <div class="item-qty">${item.cantidad}×</div>
                <div class="item-price">$${item.precio * item.cantidad}</div>
            </div>
            <button type="button" class="eliminar-btn" title="Eliminar producto" data-idx="${idx}">
                <svg viewBox="0 0 20 20" aria-hidden="true"><line x1="5" y1="5" x2="15" y2="15"/><line x1="15" y1="5" x2="5" y2="15"/></svg>
            </button>
        `;
        lista.appendChild(itemEl);
    });

    lista.querySelectorAll('.eliminar-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const idx = parseInt(this.dataset.idx);
            let p = obtenerPedido();
            p.splice(idx, 1);
            guardarPedido(p);
            renderPedido();
            actualizarTotal();
        });
    });

    actualizarTotal();
}

function getEntregaActiva() {
    const btn = document.querySelector('.option-btn[data-name="entrega"].active');
    return btn ? btn.dataset.value : 'A domicilio';
}

function actualizarTotal() {
    const pedido = obtenerPedido();
    const subProd = typeof obtenerSubtotalProductos === 'function' ? obtenerSubtotalProductos(pedido) : calcularTotalSoloProductos(pedido);

    const extrasMap = typeof obtenerExtrasStored === 'function' ? obtenerExtrasStored() : {};
    const extrasLines = typeof extrasLineItems === 'function' ? extrasLineItems(extrasMap) : [];

    const montoExtras = typeof calcularExtrasMonto === 'function' ? calcularExtrasMonto(extrasMap) : 0;
    const entregaActual = getEntregaActiva();
    const zonasLista = obtenerZonasDelivery();
    const envioDet = calculateDeliveryCompat(zonasLista);

    let envCost = 0;
    let totalFinal = subProd + montoExtras + envCost;

    const host = getEl('pedido-desglose');
    if (host) {
        host.querySelector('[data-slot="submenu"]').textContent = `$${subProd}`;
        host.querySelector('[data-slot="extras"]').textContent = `$${montoExtras}`;
        const lineExtras = host.querySelector('[data-line="extras"]');

        lineExtras.hidden = montoExtras <= 0;
        // Detalle: "Nx Nombre extra, Mx Otro extra"
        host.querySelector('[data-slot="extras-detalle"]').textContent =
            extrasLines.map(function (l) {
                return l.cantidad + 'x ' + (l.label || '').replace(/^Extra\s/, '');
            }).join(', ');

        const lineEnvio = host.querySelector('[data-line="envio"]');
        lineEnvio.hidden = entregaActual !== 'A domicilio';
        if (entregaActual !== 'A domicilio') {
            host.querySelector('[data-slot="envio"]').textContent = '$0';
            host.querySelector('[data-slot="envio-zona"]').textContent = '';
        } else if (!getLS(LS_DELIVERY_OK, null)) {
            host.querySelector('[data-slot="envio"]').textContent = '—';
            host.querySelector('[data-slot="envio-zona"]').textContent = '(seleccioná dirección)';
        } else if (envioDet.coincide && envioDet.nombre) {
            envCost = envioDet.envio;
            totalFinal = subProd + montoExtras + envCost;
            host.querySelector('[data-slot="envio"]').textContent = `$${envioDet.envio}`;
            host.querySelector('[data-slot="envio-zona"]').textContent = `(${envioDet.nombre}, ${envioDet.distanceM ? envioDet.distanceM.toFixed(0) + 'm' : ''})`;
        } else {
            host.querySelector('[data-slot="envio"]').textContent = '—';
            host.querySelector('[data-slot="envio-zona"]').textContent = '(fuera de zona)';
        }

        host.querySelector('[data-slot="total"]').textContent = `$${totalFinal}`;
    }
}

// Alias solicitado (API pública/refactor)
function updateTotals() {
    return actualizarTotal();
}

/**
 * Ajustar cantidad de un extra por su product_id.
 * El extra es un producto de Supabase con es_extra=true.
 */
function setExtraQtyById(productId, delta) {
    if (!productId) return;
    const cur = obtenerExtrasStored();
    const nueva = Math.max(0, (cur[productId] || 0) + delta);
    if (nueva === 0) delete cur[productId];
    else cur[productId] = nueva;
    setLS(LS_EXTRAS, JSON.stringify(cur));
    syncExtrasUI();
    actualizarTotal();
}

/**
 * Render dinámico de extras en pedido.html. Lista los productos con
 * es_extra=true, cada uno con su +/-. Si no hay, muestra el mensaje vacío.
 */
function renderExtrasDinamicos() {
    const host = getEl('extras-dynamic');
    const empty = getEl('extras-empty');
    if (!host) return;

    const extrasProductos = typeof obtenerExtrasProductos === 'function' ? obtenerExtrasProductos() : [];
    if (!extrasProductos.length) {
        host.innerHTML = '';
        if (empty) empty.hidden = false;
        return;
    }
    if (empty) empty.hidden = true;

    const cur = obtenerExtrasStored();
    host.innerHTML = extrasProductos
        .map(function (p) {
            const cantidad = cur[p.id] || 0;
            return `
              <div class="extra-row" data-extra-id="${umasushiEscapeHtml(p.id)}">
                <div class="extra-row-info">
                  <span class="extra-row-label">${umasushiEscapeHtml(p.nombre)}</span>
                  <span class="extra-row-price muted small">$${Number(p.precio) || 0} c/u</span>
                </div>
                <div class="counter counter-pill">
                  <button type="button" class="counter-btn extra-less" aria-label="Menos">−</button>
                  <span class="counter-qty extra-qty">${cantidad}</span>
                  <button type="button" class="counter-btn extra-more" aria-label="Más">+</button>
                </div>
              </div>`;
        })
        .join('');
}

/**
 * Refresca solo los contadores numéricos de cada extra dinámico (no
 * vuelve a montar el HTML).
 */
function syncExtrasUI() {
    const host = getEl('extras-dynamic');
    if (!host) return;
    const cur = obtenerExtrasStored();
    host.querySelectorAll('[data-extra-id]').forEach(function (row) {
        const id = row.getAttribute('data-extra-id');
        const qtyEl = row.querySelector('.extra-qty');
        if (qtyEl) qtyEl.textContent = String(cur[id] || 0);
    });
}

function renderMontoEfectivoUI() {
    const wrap = getEl('monto-efectivo-wrap');
    if (!wrap) return;
    const pago = document.querySelector('.option-btn[data-name="pago"].active');
    const esEfectivo = pago && pago.dataset.value === 'Efectivo';
    wrap.hidden = !esEfectivo;
    const inp = getEl('monto-paga-input');
    if (inp && esEfectivo) {
        inp.value = getLS(LS_MONTO_EFECTIVO, '') || '';
    }
}

function setDeliveryError(message) {
    var errAddr = getEl('error-direccion');
    if (!errAddr) return;
    if (message) {
        showError(errAddr, message);
    } else {
        hideError(errAddr);
        errAddr.textContent = '';
    }
}

function updateDeliveryStatusText(text) {
    setText('direccion-estado', text);
}

function updateDeliveryZoneStatus(text) {
    setText('delivery-zone-status', text);
}

function setDeliveryMarker(coords, save) {
    if (!coords || typeof coords !== 'object') return;
    var lat = Number(coords.lat);
    var lng = Number(coords.lng);
    if (!isFinite(lat) || !isFinite(lng)) return;

    if (!deliveryMap) return;

    if (!deliveryMarker) {
        deliveryMarker = L.marker([lat, lng], { draggable: true }).addTo(deliveryMap);
        deliveryMarker.on('dragend', function () {
            var position = deliveryMarker.getLatLng();
            setDeliveryMarker({ lat: position.lat, lng: position.lng }, true);
        });
    } else {
        deliveryMarker.setLatLng([lat, lng]);
    }

    deliveryMap.setView([lat, lng], Math.max(deliveryMap.getZoom(), 15));
    deliveryMap.invalidateSize();

    if (save) {
        setLS(LS_DELIVERY_COORDS, JSON.stringify({ lat: lat, lng: lng }));
        setLS(LS_DELIVERY_OK, '1');

        setLS(
            LS_DELIVERY_MAPS,
            generateGoogleMapsUrl({ lat: lat, lng: lng })
        );

        var addressText =
            getEl('direccion-input')?.value.trim() || '';

        if (!addressText) {
            addressText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }

        setLS(LS_DELIVERY_TEXTO, addressText);
    }

    setDeliveryError('');
    updateDeliveryStatusText('Ubicación seleccionada. Ahora confirma tu pedido.');
    var zoneInfo = calculateDeliveryCompat(obtenerZonasDelivery());
    if (zoneInfo.coincide) {
        updateDeliveryZoneStatus(`Zona: ${zoneInfo.nombre} · Envío $${zoneInfo.envio}`);
    } else {
        updateDeliveryZoneStatus('Ubicación fuera de zona de entrega.');
    }
    actualizarTotal();
}

function searchAddressAndCenterMap(query) {
    if (!query || !query.trim()) {
        setDeliveryError('Escribí calle y número para centrar el mapa.');
        return;
    }

    removeLS(LS_DELIVERY_GUARDADA);
    updateDeliveryStatusText('Buscando dirección...');
    setDeliveryError('');
    console.log('[nominatim] Buscando dirección:', query);

    if (typeof searchAddressCoordinates !== 'function') {
        console.error('[nominatim] searchAddressCoordinates no disponible');
        setDeliveryError('No se puede buscar la dirección en este momento.');
        return;
    }

    searchAddressCoordinates(query)
        .then(function (result) {
            if (!result || !result.coords) {
                throw new Error('No se encontró la dirección');
            }
            var input = getEl('direccion-input');
            if (input) {
                input.value = result.address_text || query;
            }
            setDeliveryMarker(result.coords, true);
            updateDeliveryStatusText('Dirección actualizada. Ajustá manualmente si hace falta y guardá ubicación.');
            console.log('[nominatim] Dirección encontrada:', result.address_text, result.coords);
        })
        .catch(function (err) {
            console.error('[nominatim] Error buscando dirección:', err);
            updateDeliveryStatusText('Tocá el mapa para marcar tu ubicación exacta.');
            setDeliveryError('No se encontró la dirección. Usa el mapa para marcar tu ubicación exacta.');
        });
}

function reverseGeocodeAndFillInput(coords) {
    if (!coords || typeof reverseGeocodeCoords !== 'function') {
        removeLS(LS_DELIVERY_GUARDADA);
        setDeliveryMarker(coords, true);
        return;
    }

    removeLS(LS_DELIVERY_GUARDADA);
    updateDeliveryStatusText('Obteniendo dirección...');
    var input = getEl('direccion-input');
    var previousText = input ? input.value.trim() : '';
    reverseGeocodeCoords(coords, previousText)
        .then(function (result) {
            var input = getEl('direccion-input');
            if (input) {
                input.value = result.address_text || previousText || '';
            }
            setDeliveryMarker(result.coords, true);
            updateDeliveryStatusText('Dirección detectada. Corre el número si es necesario, luego guardá ubicación.');
        })
        .catch(function (err) {
            console.error('[nominatim] Error de reverse geocode:', err);
            setDeliveryMarker(coords, true);
            updateDeliveryStatusText('Ubicación marcada. Ajustá manualmente la dirección si es necesario.');
            setDeliveryError('No se pudo recuperar la dirección exacta.');
        });
}

function debounceAddressSearch() {
    if (addressSearchTimeout) {
        clearTimeout(addressSearchTimeout);
    }
    addressSearchTimeout = setTimeout(function () {
        var input = getEl('direccion-input');
        if (input) {
            var query = input.value.trim();
            if (query.length >= 3) {
                searchAddressAndCenterMap(query);
            }
        }
    }, 800);
}

function saveDeliveryLocation() {
    if (!deliveryMarker) {
        setDeliveryError('Primero seleccioná tu ubicación en el mapa.');
        return;
    }

    setLS(LS_DELIVERY_GUARDADA, '1');
    var position = deliveryMarker.getLatLng();
    var input = getEl('direccion-input');
    var addressText = input ? input.value.trim() : '';

    if (!addressText && typeof reverseGeocodeCoords === 'function') {
        reverseGeocodeCoords({ lat: position.lat, lng: position.lng })
            .then(function (result) {
                if (input) {
                    input.value = result.display_name;
                }
                setDeliveryMarker(result.coords, true);
                updateDeliveryStatusText('Ubicación guardada. Revisa tu pedido.');
                renderSavedLocationSummary();
                toggleDeliveryMapVisibility(false);
            })
            .catch(function () {
                setDeliveryMarker({ lat: position.lat, lng: position.lng }, true);
                updateDeliveryStatusText('Ubicación guardada. Revisa tu pedido.');
                renderSavedLocationSummary();
                toggleDeliveryMapVisibility(false);
            });
        return;
    }

    setDeliveryMarker({ lat: position.lat, lng: position.lng }, true);
    updateDeliveryStatusText('Ubicación guardada. Revisa tu pedido.');
    renderSavedLocationSummary();
    toggleDeliveryMapVisibility(false);
}

function editDeliveryLocation() {
    removeLS(LS_DELIVERY_GUARDADA);
    toggleDeliveryMapVisibility(true);
    updateDeliveryStatusText('Editá tu ubicación tocando el mapa o buscando una dirección.');
    renderSavedLocationSummary();
}

function renderSavedLocationSummary() {
    var summary = getEl('ubicacion-guardada-summary');
    var saveBtn = getEl('guardar-ubicacion-btn');
    var editBtn = getEl('editar-ubicacion-btn');
    var saved = getLS(LS_DELIVERY_OK, null) === '1';
    var guardada = getLS(LS_DELIVERY_GUARDADA, null) === '1';
    var addressText = getLS(LS_DELIVERY_TEXTO, '') || '';
    var mapsUrl = getLS(LS_DELIVERY_MAPS, '') || '';

    if (saved && guardada && addressText) {
        if (summary) {
            summary.hidden = false;
            summary.innerHTML = `Ubicación guardada: <strong>${umasushiEscapeHtml(addressText)}</strong>${mapsUrl ? ` · <a href="${umasushiEscapeHtml(mapsUrl)}" target="_blank" rel="noopener">Ver en Maps</a>` : ''}`;
        }
        if (saveBtn) saveBtn.hidden = true;
        if (editBtn) editBtn.hidden = false;
        toggleDeliveryMapVisibility(false);
    } else {
        if (summary) {
            summary.hidden = true;
            summary.textContent = '';
        }
        if (saveBtn) saveBtn.hidden = false;
        if (editBtn) editBtn.hidden = true;
        toggleDeliveryMapVisibility(true);
    }
}

function toggleDeliveryMapVisibility(show) {
    var mapEl = getEl('delivery-map');
    var searchBtn = getEl('direccion-buscar');
    var saveBtn = getEl('guardar-ubicacion-btn');
    var editBtn = getEl('editar-ubicacion-btn');

    if (mapEl) {
        mapEl.style.display = show ? 'block' : 'none';
    }
    if (searchBtn) searchBtn.hidden = !show;
    if (saveBtn) saveBtn.hidden = !show;
    if (editBtn) editBtn.hidden = show;
    if (deliveryMap && show) {
        deliveryMap.invalidateSize();
    }
}

function renderDeliveryZonesOnMap(map, zones) {
    if (!map) return;
    deliveryZoneLayers.forEach(function (layer) {
        map.removeLayer(layer);
    });
    deliveryZoneLayers = [];

    var zs = Array.isArray(zones) ? zones : [];
    var palette = ['#2d9cdb', '#27ae60', '#f2c94c', '#9b51e0', '#eb5757'];

    zs.forEach(function (zone, index) {
        if (!zone || !zone.center || zone.radiusM == null) return;
        var color = palette[index % palette.length];
        try {
            var circle = createLeafletCircle(map, zone.center, Number(zone.radiusM) || 0, {
                color: color,
                fillColor: color,
                fillOpacity: 0.12,
                weight: 2,
                opacity: 0.7
            });
            circle.bindTooltip(`${umasushiEscapeHtml(zone.nombre || 'Zona')} · $${Number(zone.envio) || 0}`, {
                permanent: false,
                direction: 'top',
                offset: [0, -10]
            });
            deliveryZoneLayers.push(circle);
        } catch (err) {
            console.error('[zones] Error renderizando zona:', err, zone);
        }
    });
}

function initDeliveryMap() {
    if (deliveryMap || !getEl('delivery-map') || !window.L) return;

    deliveryMap = initLeafletMap('delivery-map', { lat: -34.6177, lng: -68.3301 }, 13);
    if (!deliveryMap) return;

    deliveryMap.on('click', function (e) {
        reverseGeocodeAndFillInput({ lat: e.latlng.lat, lng: e.latlng.lng });
        console.log('[delivery-map] Click en mapa:', e.latlng.lat, e.latlng.lng);
    });

    var savedCoords = getDeliveryCoordsStored();
    if (savedCoords) {
        setDeliveryMarker(savedCoords, false);
        deliveryMap.setView([savedCoords.lat, savedCoords.lng], 15);
        updateDeliveryStatusText('Ubicación restaurada. Toca el mapa para ajustar tu punto exacto.');
    }

    var zones = obtenerZonasDelivery();
    renderDeliveryZonesOnMap(deliveryMap, zones);
    renderSavedLocationSummary();

    var btn = getEl('direccion-buscar');
    if (btn) {
        btn.addEventListener('click', function () {
            var query = getEl('direccion-input')?.value || '';
            searchAddressAndCenterMap(query);
        });
    }

    var saveBtn = getEl('guardar-ubicacion-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveDeliveryLocation);
    }

    var editBtn = getEl('editar-ubicacion-btn');
    if (editBtn) {
        editBtn.addEventListener('click', editDeliveryLocation);
    }

    var input = getEl('direccion-input');
    if (input) {
        input.addEventListener('input', function () {
            setDeliveryError('');
            if (getLS(LS_DELIVERY_OK, null) === '1') {
                removeLS(LS_DELIVERY_OK);
                removeLS(LS_DELIVERY_COORDS);
                removeLS(LS_DELIVERY_MAPS);
                removeLS(LS_DELIVERY_TEXTO);
                updateDeliveryStatusText('Tocá el mapa para marcar tu ubicación exacta.');
                updateDeliveryZoneStatus('');
                actualizarTotal();
                console.log('[delivery-map] Texto modificado, invalidando selección');
            }
            debounceAddressSearch();
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                var query = input.value.trim();
                if (query.length >= 3) {
                    searchAddressAndCenterMap(query);
                }
            }
        });
    }
}


function renderSeccionUbicacion() {
    const entrega = document.querySelector('.option-btn[data-name="entrega"].active');
    const mode = entrega ? entrega.dataset.value : 'A domicilio';
    const wrap = getEl('ubicacion-section');
    if (!wrap) return;

    wrap.style.display = mode === 'A domicilio' ? '' : 'none';
    if (mode === 'A domicilio') {
        initDeliveryMap();
        renderSavedLocationSummary();
    }
}

// Inicialización de UI pedido.html
function inicializarPedidoUI() {
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const name = this.dataset.name;
            document.querySelectorAll(`[data-name="${name}"]`).forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderSeccionUbicacion();
            renderMontoEfectivoUI();
            actualizarTotal();
            if (name === 'entrega') {
                const errFin = getEl('error-final');
                if (errFin) errFin.style.display = 'none';
            }
        });
    });

    const nombreInput = getEl('nombre-cliente');
    if (nombreInput) {
        nombreInput.value = getLS('nombreCliente', '') || '';
        nombreInput.addEventListener('input', function () {
            setLS('nombreCliente', this.value.trim());
            hideError('error-nombre');
        });
    }

    const telInput = getEl('telefono-cliente');
    if (telInput) {
        telInput.value = getLS(LS_TELEFONO, '') || '';
        telInput.addEventListener('input', function () {
            setLS(LS_TELEFONO, this.value.trim());
            hideError('error-telefono');
        });
    }

    // Extras dinámicos (productos con es_extra=true desde Supabase)
    renderExtrasDinamicos();
    const extrasHost = getEl('extras-dynamic');
    if (extrasHost) {
        extrasHost.addEventListener('click', function (e) {
            const btnLess = e.target.closest('.extra-less');
            const btnMore = e.target.closest('.extra-more');
            if (!btnLess && !btnMore) return;
            const row = e.target.closest('[data-extra-id]');
            if (!row) return;
            const id = row.getAttribute('data-extra-id');
            setExtraQtyById(id, btnLess ? -1 : 1);
        });
    }

    const montoInput = getEl('monto-paga-input');
    if (montoInput) {
        montoInput.value = getLS(LS_MONTO_EFECTIVO, '') || '';
        montoInput.addEventListener('input', function () {
            setLS(LS_MONTO_EFECTIVO, this.value.trim());
            hideError('error-monto-efectivo');
        });
    }

    renderMontoEfectivoUI();
    renderSeccionUbicacion();
    actualizarTotal();

    getEl('confirmar-btn')?.addEventListener('click', confirmarPedido);
}

function confirmarPedido() {
    const errorNombre = getEl('error-nombre');
    const errorTelefono = getEl('error-telefono');
    const errorFinal = getEl('error-final');
    const errAddr = getEl('error-direccion');
    const errMonto = getEl('error-monto-efectivo');

    ;[errorNombre, errorTelefono, errorFinal, errAddr, errMonto].forEach(el => {
        hideError(el);
    });

    const nombreEl = getEl('nombre-cliente');
    const nombre = (nombreEl && nombreEl.value ? nombreEl.value : '').trim();
    if (!nombre) {
        showError(errorNombre, 'Por favor ingresá tu nombre');
        if (nombreEl) nombreEl.focus();
        return;
    }
    setLS('nombreCliente', nombre);

    const telEl = getEl('telefono-cliente');
    const telefono = (telEl && telEl.value ? telEl.value : '').trim();
    if (!telefono) {
        showError(errorTelefono, 'Por favor ingresá tu teléfono');
        if (telEl) telEl.focus();
        return;
    }
    const telDigits = telefono.replace(/[^\d+]/g, '');
    if (telDigits.replace(/\D/g, '').length < 8) {
        showError(errorTelefono, 'Ingresá un teléfono válido.');
        if (telEl) telEl.focus();
        return;
    }
    setLS(LS_TELEFONO, telefono);

    const pedido = obtenerPedido();
    if (pedido.length === 0) {
        showError(errorFinal, 'Tu pedido está vacío');
        return;
    }

    const pagoBtn = document.querySelector('.option-btn[data-name="pago"].active');
    const entregaBtn = document.querySelector('.option-btn[data-name="entrega"].active');
    const pago = pagoBtn ? pagoBtn.dataset.value : 'Efectivo';
    const entrega = entregaBtn ? entregaBtn.dataset.value : 'A domicilio';

    if (entrega === 'A domicilio') {
        const okSel = getLS(LS_DELIVERY_OK, null) === '1';
        const coords = getDeliveryCoordsStored();
        if (!okSel || !coords) {
            console.log('[confirmar] Dirección no válida:', { okSel, coords });
            showError(errAddr, 'Seleccioná una dirección válida de Google Places.');
            getEl('ubicacion-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const zonas = obtenerZonasDelivery();
        const det = calculateDeliveryCompat(zonas);
        if (!det.coincide) {
            console.log('[confirmar] Fuera de zona:', det.reason);
            showError(errAddr, 'La dirección está fuera de las zonas de envío configuradas.');
            getEl('ubicacion-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }

    var montoPagaraTxt = '';
    if (pago === 'Efectivo') {
        var rawMont = (getEl('monto-paga-input')?.value || '').trim();
        setLS(LS_MONTO_EFECTIVO, rawMont);
        if (!rawMont) {
            showError(errMonto, 'Indicá con cuánto vas a pagar.');
            getEl('monto-paga-input')?.focus();
            return;
        }
        const numNorm = Number(String(rawMont).replace(/\./g, '').replace(',', '.'));
        if (!(numNorm >= 0) || !isFinite(numNorm)) {
            showError(errMonto, 'Ingresá un monto válido.');
            getEl('monto-paga-input')?.focus();
            return;
        }
        montoPagaraTxt = String(rawMont);
    }

    // Extras: estado en vivo (map) + snapshot congelado para guardar
    const extrasMap = obtenerExtrasStored();
    const extrasSnapshot = typeof extrasLineItems === 'function' ? extrasLineItems(extrasMap) : [];
    let ubicacionLink = '';
    let direccionTexto = '';

    let zonaNombre = '';
    let costoEnvio = 0;
    let zonaCoincidio = false;

    if (entrega === 'A domicilio') {
        ubicacionLink = getLS(LS_DELIVERY_MAPS, '') || '';
        direccionTexto = getLS(LS_DELIVERY_TEXTO, '') || '';
        const zonas = obtenerZonasDelivery();
        const det = calculateDeliveryCompat(zonas);
        zonaCoincidio = det.coincide;
        zonaNombre = det.nombre;
        costoEnvio = det.coincide ? det.envio : 0;
        console.log('[confirmar] Delivery:', { zonaNombre, costoEnvio, distanceM: det.distanceM, reason: det.reason });
    }

    const subProd = obtenerSubtotalProductos(pedido);
    const montExt = calcularExtrasMonto(extrasMap);

    let totalNumerico = obtenerTotalPedidoNumerico(
        pedido,
        extrasMap,
        entrega === 'A domicilio' && zonaCoincidio ? costoEnvio : 0
    );

    const pedidoCompleto = {
        cliente: nombre,
        telefono,
        productos: pedido,
        subtotalMenu: subProd,
        // Snapshot congelado de extras: array de line items con precio y nombre
        // al momento de la compra. Sobrevive a borrar/renombrar el producto.
        extras: extrasSnapshot,
        extrasMonto: montExt,
        costoEnvio: entrega === 'A domicilio' && zonaCoincidio ? costoEnvio : 0,
        zonaNombre,
        zonaCoincidio,
        total: totalNumerico,
        pago,
        entrega,
        direccion_texto: direccionTexto,
        maps_url: ubicacionLink || 'No especificada'
    };

    if (pago === 'Efectivo') pedidoCompleto.montoPagaraCon = montoPagaraTxt;
    else delete pedidoCompleto.montoPagaraCon;

    // ===== GUARDAR EN SUPABASE =====
    pedidoCompleto.coords = getDeliveryCoordsStored();
    // Multi-tenant: estampar negocio_id (RLS de Phase 6 lo requiere)
    if (currentNegocio && currentNegocio.id) pedidoCompleto.negocio_id = currentNegocio.id;

    crearPedido(pedidoCompleto)
        .then(function(pedidoGuardado) {
            if (!pedidoGuardado) {
                showError(errorFinal, 'No se pudo guardar el pedido.');
                return;
            }

            console.log('[confirmar] Pedido guardado:', pedidoGuardado.id);

            // ===== LIMPIAR CARRITO =====
            guardarPedido([]);
            removeLS(LS_EXTRAS);
            removeLS(LS_MONTO_EFECTIVO);

            // ===== LINK PÚBLICO READ-ONLY DEL PEDIDO (para WhatsApp) =====
            // Apunta a /u/orden.html (vista read-only sin acciones admin).
            // El dueño abre /dashboard/pedidos para gestionar.
            const baseUrl = window.location.origin;
            const slug = (currentNegocio && currentNegocio.slug) || DEFAULT_SLUG;
            const linkPedido = `${baseUrl}/u/orden.html?slug=${encodeURIComponent(slug)}&id=${pedidoGuardado.id}`;

            // ===== MENSAJE FINAL =====
            const mensajeFinal = construirMensajeWhatsApp({
                ...pedidoCompleto,
                totalFinal: totalNumerico,
                linkPedido
            });

            // ===== ABRIR WHATSAPP =====
            // El número viene del negocio (cada negocio recibe pedidos en su propio WA).
            // Fallback al hardcoded por compat — debería desaparecer cuando todos los
            // negocios tengan telefono_negocio cargado.
            const telefono = (currentNegocio && currentNegocio.telefono_negocio) ||
                             (window.UMASUSHI_CONFIG && window.UMASUSHI_CONFIG.whatsappNumero) ||
                             '542604539727';
            const urlWa = `https://wa.me/${telefono}?text=${encodeURIComponent(mensajeFinal)}`;

            window.open(urlWa, '_blank');

            // ===== REDIRECCIÓN al catálogo del negocio =====
            const homeUrl = location.pathname.startsWith('/u/')
                ? `/u/?slug=${encodeURIComponent(slug)}`
                : 'index.html';
            window.location.href = homeUrl;
        })
        .catch(function(err) {
            console.error('[confirmar] Error creando pedido:', err);
            showError(errorFinal, 'Error guardando el pedido.');
        });

}
