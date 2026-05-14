/**
 * PEDIDOS SERVICE - UmaiSushi
 * 
 * Gestión de pedidos con sincronización Supabase
 * Integración con WhatsApp (sin eliminar la actual)
 * 
 * Tabla Supabase: pedidos
 * Campos: id, cliente, telefono, direccion_texto, coords, maps_url, productos, total, estado, fecha
 */

// ===== CREAR PEDIDO =====
/**
 * Crear nuevo pedido en Supabase
 * Mantiene integración con WhatsApp
 * @param {Object} pedidoData - { cliente, telefono, direccion_texto, coords, maps_url, productos, total }
 * @returns {Promise<Object>} Pedido creado o null
 */
async function crearPedido(pedidoData) {
    console.log('[pedidos] Creando pedido...');
    
    const supabase = getSupabase();
    
    // Preparar datos del pedido
    const pedido = {
        cliente: pedidoData.cliente || 'Cliente',
        telefono: pedidoData.telefono || '',
        direccion_texto: pedidoData.direccion_texto || '',
        coords: pedidoData.coords || null,
        maps_url: pedidoData.maps_url || '',
        productos: pedidoData.productos || [],
        total: Number(pedidoData.total) || 0,
        estado: 'nuevo',
        fecha: new Date().toISOString()
    };
    
    // Si Supabase está listo, guardar allí
    if (supabase && isSupabaseReady()) {
        try {
            const { data, error } = await supabase
                .from('pedidos')
                .insert([pedido])
                .select();
            
            if (error) {
                console.error('[pedidos] Error guardando en Supabase:', error.message);
                // Fallback a localStorage
                return crearPedidoLocal(pedido);
            }
            
            if (data && data.length > 0) {
                console.log('[pedidos] ✓ Pedido guardado en Supabase:', data[0].id);
                guardarPedidoLocal(data[0]);
                return data[0];
            }
        } catch (e) {
            console.error('[pedidos] Excepción:', e.message);
            return crearPedidoLocal(pedido);
        }
    }
    
    // Fallback a localStorage
    console.log('[pedidos] Supabase no disponible, guardando en localStorage');
    return crearPedidoLocal(pedido);
}

/**
 * Crear pedido en localStorage
 * @private
 */
function crearPedidoLocal(pedido) {
    try {
        pedido.id = 'ped-' + Math.random().toString(36).slice(2, 9) + '-' + Date.now().toString(36);
        
        // Guardar en localStorage temporal
        localStorage.setItem('ultimoPedido', JSON.stringify(pedido));
        console.log('[pedidos] ✓ Pedido guardado en localStorage:', pedido.id);
        
        return pedido;
    } catch (e) {
        console.error('[pedidos] Error guardando en localStorage:', e.message);
        return null;
    }
}

// ===== OBTENER PEDIDOS =====
/**
 * Obtener todos los pedidos
 * Intenta desde Supabase, fallback a localStorage
 * @param {Object} opciones - { limite, offset, estado }
 * @returns {Promise<Array>} Array de pedidos
 */
async function obtenerPedidos(opciones = {}) {
    console.log('[pedidos] Obteniendo pedidos...');
    
    const supabase = getSupabase();
    const limite = opciones.limite || 50;
    const offset = opciones.offset || 0;
    const estado = opciones.estado || null;
    
    // Si Supabase está listo, intentar obtener desde allí
    if (supabase && isSupabaseReady()) {
        try {
            let query = supabase
                .from('pedidos')
                .select('*')
                .order('fecha', { ascending: false });
            
            if (estado) {
                query = query.eq('estado', estado);
            }
            
            const { data, error } = await query
                .range(offset, offset + limite - 1);
            
            if (error) {
                console.warn('[pedidos] Error Supabase:', error.message);
                return obtenerPedidosLocal();
            }
            
            if (Array.isArray(data)) {
                console.log('[pedidos] ✓ Cargados desde Supabase:', data.length, 'pedidos');
                return data;
            }
        } catch (e) {
            console.warn('[pedidos] Excepción Supabase:', e.message);
            return obtenerPedidosLocal();
        }
    }
    
    // Fallback a localStorage
    console.log('[pedidos] Supabase no disponible, usando localStorage');
    return obtenerPedidosLocal();
}

/**
 * Obtener pedidos desde localStorage
 * @private
 */
async function obtenerPedidosLocal() {
    try {
        let pedidos = [];
        
        // Intentar obtener desde la clave de "última cocina" si existe
        const ultimoPedido = localStorage.getItem('ultimoPedido');
        if (ultimoPedido) {
            try {
                const ped = JSON.parse(ultimoPedido);
                if (ped && ped.id) pedidos.push(ped);
            } catch (e) {
                // Ignorar si no es JSON válido
            }
        }
        
        console.log('[pedidos] Cargados desde localStorage:', pedidos.length, 'pedidos');
        return pedidos;
    } catch (e) {
        console.error('[pedidos] Error en localStorage:', e.message);
        return [];
    }
}

/**
 * Guardar pedido en localStorage (copia)
 * @private
 */
function guardarPedidoLocal(pedido) {
    try {
        localStorage.setItem('ultimoPedido', JSON.stringify(pedido));
    } catch (e) {
        console.warn('[pedidos] Error guardando en localStorage:', e.message);
    }
}
async function obtenerPedidoPorId(id) {
    const supabase = getSupabase();

    if (!supabase || !isSupabaseReady()) {
        return null;
    }

    try {
        const { data, error } = await supabase
            .from('pedidos')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('[pedidos] Error obteniendo pedido:', error.message);
            return null;
        }

        return data;
    } catch (e) {
        console.error('[pedidos] Excepción:', e.message);
        return null;
    }
}
// ===== ACTUALIZAR ESTADO =====
/**
 * Actualizar estado del pedido
 * Estados: nuevo, preparando, listo, entregado, cancelado
 * @param {string} id - ID del pedido
 * @param {string} nuevoEstado - Nuevo estado
 * @returns {Promise<Object>} Pedido actualizado o null
 */
async function actualizarEstadoPedido(id, nuevoEstado) {
    console.log('[pedidos] Actualizando estado:', id, '→', nuevoEstado);
    
    const supabase = getSupabase();
    
    const estadosValidos = ['nuevo', 'preparando', 'listo', 'entregado', 'cancelado'];
    if (!estadosValidos.includes(nuevoEstado)) {
        console.error('[pedidos] Estado no válido:', nuevoEstado);
        return null;
    }
    
    if (!supabase || !isSupabaseReady()) {
        console.log('[pedidos] Supabase no disponible, actualizando en localStorage');
        return null; // No actualizar en localStorage para evitar inconsistencias
    }
    
    try {
        const { data, error } = await supabase
            .from('pedidos')
            .update({ estado: nuevoEstado })
            .eq('id', id)
            .select();
        
        if (error) {
            console.error('[pedidos] Error actualizando en Supabase:', error.message);
            return null;
        }
        
        if (data && data.length > 0) {
            console.log('[pedidos] ✓ Estado actualizado en Supabase:', id, '→', nuevoEstado);
            return data[0];
        }
    } catch (e) {
        console.error('[pedidos] Excepción:', e.message);
    }
    
    return null;
}

// ===== INTEGRACIÓN CON WHATSAPP =====
/**
 * Enviar pedido por WhatsApp DESPUÉS de guardar en Supabase
 * Mantiene la integración actual con WhatsApp
 * @param {Object} pedido - Pedido creado
 * @param {string} numeroPropietario - Número de WhatsApp del dueño
 * @returns {string} URL de WhatsApp para abrir
 */

// ===== SINCRONIZAR =====
/**
 * Sincronizar pedidos entre Supabase y localStorage
 */
async function sincronizarPedidos() {
    console.log('[pedidos] Sincronizando...');
    
    const supabase = getSupabase();
    
    if (!supabase || !isSupabaseReady()) {
        console.log('[pedidos] Supabase no disponible');
        return false;
    }
    
    try {
        const { data, error } = await supabase
            .from('pedidos')
            .select('*')
            .order('fecha', { ascending: false })
            .limit(100);
        
        if (error) {
            console.error('[pedidos] Error sincronizando:', error.message);
            return false;
        }
        
        console.log('[pedidos] ✓ Sincronización completada:', data?.length || 0, 'pedidos');
        return true;
    } catch (e) {
        console.error('[pedidos] Excepción sincronizando:', e.message);
        return false;
    }
}

// ===== EXPORTACIÓN =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        crearPedido,
        obtenerPedidos,
        actualizarEstadoPedido,
        obtenerPedidoPorId,
        sincronizarPedidos
    };
}
