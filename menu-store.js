/**
 * Menú en cliente: vista y helpers sobre productos cargados desde Supabase.
 * La persistencia de productos vive únicamente en Supabase (services/productos.service.js).
 * `productosCache` es espejo en memoria rellenado por cargarProductosConSupabase / sincronizarProductos.
 */
/* global localStorage */

var UMASUSHI_MENU_CATEGORIAS = ['Productos', 'Tablas', 'Vinos'];

/** @type {Array} filas tal como vienen de Supabase (o normalizadas al asignar) */
var productosCache = [];

function umasushiUid(prefix) {
    return (
        String(prefix || 'id') +
        '-' +
        Math.random().toString(36).slice(2, 7) +
        '-' +
        Date.now().toString(36)
    );
}

function umasushiClampInt(n, min) {
    var x = parseInt(n, 10);
    if (isNaN(x)) x = 0;
    return Math.max(typeof min === 'number' ? min : 0, x);
}

function umasushiSafeText(s) {
    return String(s == null ? '' : s).trim();
}

function umasushiNormalizeCategory(cat) {
    var c = umasushiSafeText(cat);
    if (UMASUSHI_MENU_CATEGORIAS.indexOf(c) !== -1) return c;
    return 'Productos';
}

/** Claves legacy de menú en localStorage (solo limpieza one-shot). */
function removeLegacyMenuStorageKeys() {
    try {
        localStorage.removeItem('umasushiMenu');
        localStorage.removeItem('menuProductos');
    } catch (e) {
        /* ignore */
    }
}

function defaultMenuSeed() {
    var placeholder = '/static/producto.jpeg';
    return [
        {
            id: 'p-clasico',
            nombre: 'Clasico',
            descripcion: 'Roll frío clásico. Arroz koshi, queso crema, palta y salmón crudo (opcional cocido)',
            precio: 7500,
            imagen: placeholder,
            categoria: 'Productos',
            tags: { veggi: false, glutenfree: true }
        },
        {
            id: 'p-hot-maki',
            nombre: 'Hot Maki',
            descripcion: 'Roll caliente rebozado. De arroz koshi, queso crema, palta y langostinos',
            precio: 8000,
            imagen: placeholder,
            categoria: 'Productos',
            tags: { veggi: false, glutenfree: true }
        },
        {
            id: 'p-abokado-roll',
            nombre: 'Abokado Roll',
            descripcion:
                'Roll picante caliente rebozado. Arroz koshi, queso crema, palta y salmón cocido. Con una bocha de lactonesa de palta y perejil',
            precio: 8200,
            imagen: placeholder,
            categoria: 'Productos',
            tags: { veggi: false, glutenfree: true }
        },
        {
            id: 'p-ikazumi-roll',
            nombre: 'Ikazumi Roll',
            descripcion:
                'Roll frío. Arroz koshi con tinta de calamar, queso crema, palta y langostinos rebozados bañados en salsa honey y crocante',
            precio: 8600,
            imagen: placeholder,
            categoria: 'Productos',
            tags: { veggi: false, glutenfree: true }
        },
        {
            id: 'p-mori-roll',
            nombre: 'Mori Roll',
            descripcion:
                'Roll caliente veggie. Arroz koshi, queso crema, palta y salteado de champiñones frescos, cebolla y pimientos con lluvia de perejil fresco',
            precio: 8000,
            imagen: placeholder,
            categoria: 'Productos',
            tags: { veggi: true, glutenfree: true }
        },
        {
            id: 'p-shiro-maki',
            nombre: 'Shiro Maki',
            descripcion:
                'Roll frío veggie. Arroz koshi, queso crema, palta, zanahoria, palmitos y golf. Acompañados de yogur y batata frita',
            precio: 8600,
            imagen: placeholder,
            categoria: 'Productos',
            tags: { veggi: true, glutenfree: true }
        },
        {
            id: 't-clasico-ikazumi',
            nombre: 'Tabla Clasico Ikazumi',
            descripcion: '20 piezas',
            precio: 34500,
            imagen: placeholder,
            categoria: 'Tablas',
            tags: { veggi: false, glutenfree: true }
        },
        {
            id: 't-hot-abokado',
            nombre: 'Tabla Hot Abokado',
            descripcion: '20 piezas',
            precio: 35500,
            imagen: placeholder,
            categoria: 'Tablas',
            tags: { veggi: false, glutenfree: true }
        },
        {
            id: 't-surtida',
            nombre: 'Tabla Surtida',
            descripcion: '4 variedades, 20 piezas',
            precio: 35000,
            imagen: placeholder,
            categoria: 'Tablas',
            tags: { veggi: false, glutenfree: true }
        },
        {
            id: 't-veggie',
            nombre: 'Tabla Veggie',
            descripcion: '20 piezas veggie',
            precio: 35500,
            imagen: placeholder,
            categoria: 'Tablas',
            tags: { veggi: true, glutenfree: true }
        },
        {
            id: 'v-sauvignon',
            nombre: 'Goyenechea Sauvignon Blanc',
            descripcion: '750cc',
            precio: 5600,
            imagen: placeholder,
            categoria: 'Vinos',
            tags: { veggi: false, glutenfree: false }
        },
        {
            id: 'v-tocai',
            nombre: 'Goyenechea Tocai Dulce Natural',
            descripcion: '750cc',
            precio: 7300,
            imagen: placeholder,
            categoria: 'Vinos',
            tags: { veggi: false, glutenfree: false }
        }
    ];
}

function normalizeMenuItem(raw) {
    var nombre = umasushiSafeText(raw && raw.nombre);
    var descripcion = umasushiSafeText(raw && (raw.descripcion != null ? raw.descripcion : raw.desc));
    var precio = umasushiClampInt(raw && raw.precio, 0);
    var categoria = umasushiNormalizeCategory(raw && raw.categoria);
    var imagen = umasushiSafeText(raw && raw.imagen) || '/static/producto.jpeg';
    var id = umasushiSafeText(raw && raw.id) || umasushiUid('p');

    var tags = raw && typeof raw.tags === 'object' && raw.tags ? raw.tags : {};
    return {
        id: id,
        nombre: nombre,
        descripcion: descripcion,
        precio: precio,
        imagen: imagen,
        categoria: categoria,
        tags: {
            veggi: !!tags.veggi,
            glutenfree: tags.glutenfree == null ? true : !!tags.glutenfree
        }
    };
}

/** Construye payload para upsert en Supabase. Incluye `tags` si el ítem los tiene (tabla opcional). */
function productoToSupabaseRow(item) {
    var row = {
        id: item.id,
        nombre: item.nombre,
        descripcion: item.descripcion,
        precio: item.precio,
        categoria: item.categoria,
        imagen: item.imagen,
        activo: true
    };
    if (item.tags && typeof item.tags === 'object') {
        row.tags = item.tags;
    }
    return row;
}

function obtenerMenu() {
    if (!productosCache || !productosCache.length) return [];
    return productosCache
        .map(function (p) {
            return normalizeMenuItem(p);
        })
        .filter(function (x) {
            return x.nombre && x.precio >= 0;
        });
}

function initializeMenu() {
    removeLegacyMenuStorageKeys();
    return loadMenu();
}

function loadMenu() {
    return obtenerMenu();
}

function buscarProductoPorNombre(nombre) {
    var n = umasushiSafeText(nombre);
    var menu = obtenerMenu();
    for (var i = 0; i < menu.length; i++) {
        if (menu[i].nombre === n) return menu[i];
    }
    return null;
}

function buscarProductoPorId(id) {
    var rid = umasushiSafeText(id);
    var menu = obtenerMenu();
    for (var i = 0; i < menu.length; i++) {
        if (menu[i].id === rid) return menu[i];
    }
    return null;
}

function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
        if (!file) return resolve('');
        var reader = new FileReader();
        reader.onload = function () {
            resolve(String(reader.result || ''));
        };
        reader.onerror = function (e) {
            reject(e);
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Insertar o actualizar un producto en Supabase y refrescar cache en memoria.
 * @returns {Promise<Array>}
 */
async function upsertProductoAsync(rawItem) {
    console.log('[menu] Upsert producto:', rawItem && rawItem.nombre);

    if (typeof guardarProducto !== 'function' || typeof isSupabaseReady !== 'function' || !isSupabaseReady()) {
        console.error('[menu] Supabase no disponible para guardar producto');
        throw new Error('Supabase no disponible');
    }

    var item = normalizeMenuItem(rawItem);
    var row = productoToSupabaseRow(item);
    var resultado = await guardarProducto(row);
    if (!resultado || !resultado.id) {
        console.warn('[menu] Error guardando en Supabase:', item.nombre);
        throw new Error('Error guardando producto en Supabase');
    }

    if (typeof obtenerProductos !== 'function') {
        throw new Error('obtenerProductos no disponible');
    }
    var productosActualizados = await obtenerProductos();
    productosCache = productosActualizados.slice();
    console.log('[menu] ✓ Lista refrescada:', productosActualizados.length, 'productos');
    return productosActualizados;
}

/**
 * Soft delete en Supabase y refrescar cache.
 * @returns {Promise<Array>}
 */
async function eliminarProductoAsync(productId) {
    console.log('[menu] Eliminando producto:', productId);

    if (typeof eliminarProductoDeSupabase !== 'function') {
        console.error('[menu] eliminarProductoDeSupabase no disponible');
        throw new Error('eliminarProductoDeSupabase no disponible');
    }

    var eliminado = await eliminarProductoDeSupabase(productId);
    if (!eliminado) {
        console.warn('[menu] Error eliminando en Supabase:', productId);
        throw new Error('Error eliminando producto');
    }

    if (typeof obtenerProductos !== 'function') {
        productosCache = [];
        return [];
    }
    var productosActualizados = await obtenerProductos();
    productosCache = productosActualizados.slice();
    console.log('[menu] ✓ Lista refrescada:', productosActualizados.length, 'productos');
    return productosActualizados;
}

/**
 * Restaurar menú de ejemplo en Supabase (UPSERT de cada ítem del seed).
 * @returns {Promise<Array>}
 */
async function seedMenuEjemploEnSupabase() {
    if (typeof guardarProducto !== 'function' || typeof obtenerProductos !== 'function') {
        throw new Error('Servicio de productos no disponible');
    }
    if (typeof isSupabaseReady !== 'function' || !isSupabaseReady()) {
        throw new Error('Supabase no disponible');
    }
    var seed = defaultMenuSeed();
    for (var i = 0; i < seed.length; i++) {
        var item = normalizeMenuItem(seed[i]);
        var row = productoToSupabaseRow(item);
        var resultado = await guardarProducto(row);
        if (!resultado || !resultado.id) {
            throw new Error('No se pudo guardar: ' + (item.nombre || item.id));
        }
    }
    var list = await obtenerProductos();
    productosCache = Array.isArray(list) ? list.slice() : [];
    return productosCache.slice();
}
