/**
 * PRODUCTOS SERVICE - UmaiSushi
 *
 * Única fuente de verdad para productos: Supabase.
 * NO usa localStorage para productos.
 *
 * Tabla Supabase: productos
 * Campos: id, nombre, descripcion, precio, categoria, activo, imagen
 */

// ===== OBTENER PRODUCTOS =====
/**
 * Obtener productos activos desde Supabase.
 * @returns {Promise<Array>}
 */
/**
 * Obtener productos activos.
 * @param {{ negocioId?: string, soloActivos?: boolean }=} opciones
 *   - negocioId: si está presente, filtra por ese negocio. Sin él, devuelve todo.
 *   - soloActivos: default true.
 * @returns {Promise<Array>}
 */
async function obtenerProductos(opciones = {}) {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseReady()) {
        console.error('[productos] Supabase no disponible');
        return [];
    }
    const negocioId = opciones && opciones.negocioId ? opciones.negocioId : null;
    const soloActivos = opciones && opciones.soloActivos === false ? false : true;

    try {
        let query = supabase.from('productos').select('*');
        if (soloActivos) query = query.eq('activo', true);
        if (negocioId) query = query.eq('negocio_id', negocioId);
        query = query.order('categoria', { ascending: true }).order('orden', { ascending: true });

        const { data, error } = await query;
        if (error) {
            console.error('[productos] Error obteniendo productos:', error.message);
            return [];
        }
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.error('[productos] Excepción obteniendo productos:', e.message);
        return [];
    }
}

// ===== GUARDAR (UPSERT) =====
/**
 * @param {Object} producto - fila compatible con tabla productos
 * @returns {Promise<Object|null>}
 */
async function guardarProductoEnSupabase(producto) {
    console.log('[productos] UPSERT en Supabase:', producto && producto.nombre);

    const supabase = getSupabase();

    if (!supabase || !isSupabaseReady()) {
        console.error('[productos] Supabase no disponible');
        return null;
    }

    try {
        const { data, error } = await supabase.from('productos').upsert([producto], { onConflict: 'id' }).select();

        if (error) {
            console.error('[productos] Error en UPSERT:', error.message);
            return null;
        }

        if (data && data.length > 0) {
            console.log('[productos] ✓ Producto guardado en Supabase:', data[0].id);
            return data[0];
        }

        console.warn('[productos] UPSERT no retornó datos');
        return null;
    } catch (e) {
        console.error('[productos] Excepción en UPSERT:', e.message);
        return null;
    }
}

/**
 * Guardar (UPSERT) un producto — API pública.
 * @param {Object} producto
 * @returns {Promise<Object|null>}
 */
async function guardarProducto(producto) {
    return guardarProductoEnSupabase(producto);
}

// ===== ACTUALIZAR =====
/**
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
async function actualizarProducto(id, updates) {
    console.log('[productos] Actualizando producto:', id);

    const supabase = getSupabase();

    if (!supabase || !isSupabaseReady()) {
        console.log('[productos] Supabase no disponible');
        return null;
    }

    try {
        const { data, error } = await supabase.from('productos').update(updates).eq('id', id).select();

        if (error) {
            console.error('[productos] Error actualizando:', error.message);
            return null;
        }

        if (data && data.length > 0) {
            console.log('[productos] ✓ Producto actualizado:', data[0].id);
            return data[0];
        }

        console.warn('[productos] Producto no encontrado para actualizar');
        return null;
    } catch (e) {
        console.error('[productos] Excepción actualizando:', e.message);
        return null;
    }
}

// ===== ELIMINAR (soft delete) =====
/**
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function eliminarProductoDeSupabase(id) {
    console.log('[productos] Eliminando producto de Supabase:', id);

    const supabase = getSupabase();

    if (!supabase || !isSupabaseReady()) {
        console.error('[productos] Supabase no disponible');
        return false;
    }

    try {
        const { error } = await supabase.from('productos').update({ activo: false }).eq('id', id);

        if (error) {
            console.error('[productos] Error eliminando producto:', error.message);
            return false;
        }

        console.log('[productos] ✓ Producto marcado como inactivo:', id);
        return true;
    } catch (e) {
        console.error('[productos] Excepción eliminando producto:', e.message);
        return false;
    }
}

// ===== SINCRONIZAR CACHE EN MEMORIA =====
/**
 * Vuelve a leer productos desde Supabase y actualiza `productosCache` (menu-store.js) si existe.
 * @returns {Promise<boolean>}
 */
async function sincronizarProductos() {
    console.log('[productos] Sincronizando cache con Supabase...');

    const list = await obtenerProductos();

    if (typeof productosCache !== 'undefined') {
        productosCache = Array.isArray(list) ? list.slice() : [];
    }

    console.log('[productos] ✓ Cache actualizado:', list.length, 'productos');
    return true;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        obtenerProductos,
        guardarProducto,
        guardarProductoEnSupabase,
        actualizarProducto,
        eliminarProductoDeSupabase,
        sincronizarProductos
    };
}
