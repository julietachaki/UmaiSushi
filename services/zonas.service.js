import { getSupabase, isSupabaseReady } from './supabase.js'
import { calculateDelivery } from '../delivery-calc.js'

const _UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function normalizarZonasDesdeSupabase(zonas) {
    return zonas.map(z => ({
        id: z.id,
        nombre: z.nombre,
        envio: Number(z.envio) || 0,
        center: {
            lat: Number(z.center_lat) || 0,
            lng: Number(z.center_lng) || 0
        },
        radiusM: Number(z.radius_m) || 1500
    }))
}

function normalizarZonaDesdeSupabase(zona) {
    return {
        id: zona.id,
        nombre: zona.nombre,
        envio: Number(zona.envio) || 0,
        center: {
            lat: Number(zona.center_lat) || 0,
            lng: Number(zona.center_lng) || 0
        },
        radiusM: Number(zona.radius_m) || 1500
    }
}

function normalizarZonasParaSupabase(zonas) {
    return zonas.map(z => {
        const row = {
            nombre: z.nombre,
            envio: Number(z.envio) || 0,
            center_lat: Number(z.center?.lat || 0),
            center_lng: Number(z.center?.lng || 0),
            radius_m: Number(z.radiusM) || 1500
        }
        if (typeof z.id === 'string' && _UUID_REGEX.test(z.id)) {
            row.id = z.id
        }
        return row
    })
}

export async function obtenerZonas(opciones = {}) {
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) {
        console.error('[zonas] Supabase no disponible')
        return []
    }
    const negocioId = opciones && opciones.negocioId ? opciones.negocioId : null

    try {
        let query = supabase.from('zonas_delivery').select('id, nombre, envio, center_lat, center_lng, radius_m')
        if (negocioId) query = query.eq('negocio_id', negocioId)
        query = query.order('nombre', { ascending: true })

        const { data, error } = await query
        if (error) {
            console.error('[zonas] Error obteniendo zonas:', error.message)
            return []
        }
        if (Array.isArray(data)) {
            return normalizarZonasDesdeSupabase(data)
        }
        return []
    } catch (e) {
        console.error('[zonas] Excepción obteniendo zonas:', e.message)
        return []
    }
}

export async function guardarZonas(zonas, negocioId) {
    console.log('[zonas] Guardando', zonas?.length || 0, 'zonas en Supabase...')

    const supabase = getSupabase()
    const zonasArray = Array.isArray(zonas) ? zonas : []

    if (!supabase || !isSupabaseReady()) {
        console.error('[zonas] Supabase no disponible')
        return null
    }

    try {
        const zonasParaSupabase = normalizarZonasParaSupabase(zonasArray)
        if (negocioId) {
            zonasParaSupabase.forEach(z => { z.negocio_id = negocioId })
        }

        let existentesQ = supabase.from('zonas_delivery').select('id')
        if (negocioId) existentesQ = existentesQ.eq('negocio_id', negocioId)
        const { data: existentes, error: errorGet } = await existentesQ

        if (errorGet) {
            console.error('[zonas] Error obteniendo zonas existentes:', errorGet.message)
            return null
        }

        const idsExistentes = (existentes || []).map(z => z.id)
        const idsNuevos = zonasParaSupabase.map(z => z.id).filter(Boolean)
        const idsAEliminar = idsExistentes.filter(id => !idsNuevos.includes(id))

        if (idsAEliminar.length) {
            const { error: deleteError } = await supabase
                .from('zonas_delivery')
                .delete()
                .in('id', idsAEliminar)

            if (deleteError) {
                console.error('[zonas] Error eliminando zonas:', deleteError.message)
                return null
            }
        }

        const zonasExistentes = zonasParaSupabase.filter(
            z => typeof z.id === 'string' && _UUID_REGEX.test(z.id)
        )

        const zonasNuevas = zonasParaSupabase.filter(
            z => !z.id || !_UUID_REGEX.test(z.id)
        )

        if (zonasExistentes.length) {
            const { error: errorUpdate } = await supabase
                .from('zonas_delivery')
                .upsert(zonasExistentes, { onConflict: 'id' })

            if (errorUpdate) {
                console.error('[zonas] Error actualizando zonas:', errorUpdate.message)
                return null
            }
        }

        if (zonasNuevas.length) {
            const { error: errorInsert } = await supabase
                .from('zonas_delivery')
                .insert(zonasNuevas)

            if (errorInsert) {
                console.error('[zonas] Error insertando zonas:', errorInsert.message)
                return null
            }
        }

        let finalQ = supabase.from('zonas_delivery').select('*')
        if (negocioId) finalQ = finalQ.eq('negocio_id', negocioId)
        finalQ = finalQ.order('nombre', { ascending: true })
        const { data: finalData, error: finalError } = await finalQ

        if (finalError) {
            console.error('[zonas] Error obteniendo zonas finales:', finalError.message)
            return null
        }

        const zonasNormalizadas = normalizarZonasDesdeSupabase(finalData)

        console.log('[zonas] ✓ Guardadas en Supabase:', zonasNormalizadas.length, 'zonas')

        return zonasNormalizadas
    } catch (e) {
        console.error('[zonas] Excepción guardando zonas:', e.message)
        return null
    }
}

export async function crearZona(zona) {
    console.log('[zonas] Creando zona en Supabase:', zona.nombre)

    const supabase = getSupabase()

    if (!supabase || !isSupabaseReady()) {
        console.error('[zonas] Supabase no disponible')
        return null
    }

    try {
        const zonaParaSupabase = {
            nombre: zona.nombre,
            envio: Number(zona.envio) || 0,
            center_lat: Number(zona.center?.lat || 0),
            center_lng: Number(zona.center?.lng || 0),
            radius_m: Number(zona.radiusM) || 1500
        }
        if (typeof zona.id === 'string' && _UUID_REGEX.test(zona.id)) {
            zonaParaSupabase.id = zona.id
        }
        const { data, error } = await supabase
            .from('zonas_delivery')
            .insert(zonaParaSupabase)
            .select()
            .single()

        if (error) {
            console.error('[zonas] Error creando zona:', error.message)
            return null
        }

        const zonaNormalizada = normalizarZonaDesdeSupabase(data)
        console.log('[zonas] ✓ Zona creada:', zonaNormalizada.nombre)
        return zonaNormalizada

    } catch (e) {
        console.error('[zonas] Excepción creando zona:', e.message)
        return null
    }
}

export async function actualizarZona(id, updates) {
    console.log('[zonas] Actualizando zona en Supabase:', id)

    const supabase = getSupabase()

    if (!supabase || !isSupabaseReady()) {
        console.error('[zonas] Supabase no disponible')
        return null
    }

    try {
        const { data: zonaActual, error: errorGet } = await supabase
            .from('zonas_delivery')
            .select('*')
            .eq('id', id)
            .single()

        if (errorGet) {
            console.error('[zonas] Error obteniendo zona para actualizar:', errorGet.message)
            return null
        }

        const zonaActualizada = {
            id: zonaActual.id,
            nombre: updates.nombre !== undefined ? updates.nombre : zonaActual.nombre,
            envio: updates.envio !== undefined ? Number(updates.envio) : zonaActual.envio,
            center_lat: updates.center?.lat !== undefined ? Number(updates.center.lat) : zonaActual.center_lat,
            center_lng: updates.center?.lng !== undefined ? Number(updates.center.lng) : zonaActual.center_lng,
            radius_m: updates.radiusM !== undefined ? Number(updates.radiusM) : zonaActual.radius_m
        }

        const { data, error } = await supabase
            .from('zonas_delivery')
            .upsert(zonaActualizada, { onConflict: 'id' })
            .select()
            .single()

        if (error) {
            console.error('[zonas] Error actualizando zona:', error.message)
            return null
        }

        const zonaNormalizada = normalizarZonaDesdeSupabase(data)
        console.log('[zonas] ✓ Zona actualizada:', zonaNormalizada.nombre)
        return zonaNormalizada

    } catch (e) {
        console.error('[zonas] Excepción actualizando zona:', e.message)
        return null
    }
}

export async function eliminarZona(id) {
    console.log('[zonas] Eliminando zona de Supabase:', id)

    const supabase = getSupabase()

    if (!supabase || !isSupabaseReady()) {
        console.error('[zonas] Supabase no disponible')
        return false
    }

    try {
        const { error } = await supabase
            .from('zonas_delivery')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('[zonas] Error eliminando zona:', error.message)
            return false
        }

        console.log('[zonas] ✓ Zona eliminada:', id)
        return true

    } catch (e) {
        console.error('[zonas] Excepción eliminando zona:', e.message)
        return false
    }
}

export async function calcularDeliveryAsync(coords, zonas = null) {
    console.log('[zonas] Calculando delivery para coords:', coords)

    let zonasParaUsar = zonas

    if (!zonasParaUsar) {
        zonasParaUsar = await obtenerZonas()
    }

    const resultado = calculateDelivery(coords, zonasParaUsar)
    console.log('[zonas] ✓ Delivery calculado:', resultado.ok ? 'OK' : 'Fuera de zonas')
    return resultado
}
