import { getSupabase, isSupabaseReady } from './supabase.js'

export async function obtenerProductos(opciones = {}) {
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) {
        console.error('[productos] Supabase no disponible')
        return []
    }
    const negocioId = opciones && opciones.negocioId ? opciones.negocioId : null
    const soloActivos = opciones && opciones.soloActivos === false ? false : true

    try {
        let query = supabase.from('productos').select('id, nombre, descripcion, precio, categoria, imagen, activo, es_extra, tags, orden')
        if (soloActivos) query = query.eq('activo', true)
        if (negocioId) query = query.eq('negocio_id', negocioId)
        query = query.order('categoria', { ascending: true }).order('orden', { ascending: true })

        const { data, error } = await query
        if (error) {
            console.error('[productos] Error obteniendo productos:', error.message)
            return []
        }
        return Array.isArray(data) ? data : []
    } catch (e) {
        console.error('[productos] Excepción obteniendo productos:', e.message)
        return []
    }
}

export async function guardarProductoEnSupabase(producto) {
    console.log('[productos] UPSERT en Supabase:', producto && producto.nombre)

    const supabase = getSupabase()

    if (!supabase || !isSupabaseReady()) {
        console.error('[productos] Supabase no disponible')
        return null
    }

    try {
        const { data, error } = await supabase.from('productos').upsert([producto], { onConflict: 'id' }).select()

        if (error) {
            console.error('[productos] Error en UPSERT:', error.message)
            return null
        }

        if (data && data.length > 0) {
            console.log('[productos] ✓ Producto guardado en Supabase:', data[0].id)
            return data[0]
        }

        console.warn('[productos] UPSERT no retornó datos')
        return null
    } catch (e) {
        console.error('[productos] Excepción en UPSERT:', e.message)
        return null
    }
}

export async function guardarProducto(producto) {
    return guardarProductoEnSupabase(producto)
}

export async function actualizarProducto(id, updates) {
    console.log('[productos] Actualizando producto:', id)

    const supabase = getSupabase()

    if (!supabase || !isSupabaseReady()) {
        console.log('[productos] Supabase no disponible')
        return null
    }

    try {
        const { data, error } = await supabase.from('productos').update(updates).eq('id', id).select()

        if (error) {
            console.error('[productos] Error actualizando:', error.message)
            return null
        }

        if (data && data.length > 0) {
            console.log('[productos] ✓ Producto actualizado:', data[0].id)
            return data[0]
        }

        console.warn('[productos] Producto no encontrado para actualizar')
        return null
    } catch (e) {
        console.error('[productos] Excepción actualizando:', e.message)
        return null
    }
}

export async function eliminarProductoDeSupabase(id) {
    console.log('[productos] Eliminando producto de Supabase:', id)

    const supabase = getSupabase()

    if (!supabase || !isSupabaseReady()) {
        console.error('[productos] Supabase no disponible')
        return false
    }

    try {
        const { error } = await supabase.from('productos').update({ activo: false }).eq('id', id)

        if (error) {
            console.error('[productos] Error eliminando producto:', error.message)
            return false
        }

        console.log('[productos] ✓ Producto marcado como inactivo:', id)
        return true
    } catch (e) {
        console.error('[productos] Excepción eliminando producto:', e.message)
        return false
    }
}

