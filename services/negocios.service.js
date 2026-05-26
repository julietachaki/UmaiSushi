import { getSupabase, isSupabaseReady } from './supabase.js'
import { getCurrentSession } from './auth.service.js'

export async function obtenerNegocioPorSlug(slug) {
    if (!slug || typeof slug !== 'string') return null
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) return null

    const { data, error } = await supabase
        .from('negocios_public')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
    if (error) {
        console.error('[negocios] obtenerNegocioPorSlug:', error.message)
        return null
    }
    return data
}

export async function obtenerMiNegocio() {
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) return null

    const session = await getCurrentSession()
    if (!session) {
        console.warn('[negocios] obtenerMiNegocio: sin sesión')
        return null
    }

    const { data, error } = await supabase
        .from('negocios')
        .select('*')
        .eq('owner_id', session.user.id)
        .eq('activo', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
    if (error) {
        console.error('[negocios] obtenerMiNegocio:', error.message)
        return null
    }
    return data
}

export async function obtenerMisNegocios() {
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) return []

    const session = await getCurrentSession()
    if (!session) return []

    const { data, error } = await supabase
        .from('negocios')
        .select('*')
        .eq('owner_id', session.user.id)
        .eq('activo', true)
        .order('created_at', { ascending: true })
    if (error) {
        console.error('[negocios] obtenerMisNegocios:', error.message)
        return []
    }
    return Array.isArray(data) ? data : []
}

export async function actualizarNegocio(id, updates) {
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) return null
    if (!id) return null

    const allowed = [
        'nombre_negocio',
        'telefono_negocio',
        'google_sheet_url',
        'google_sheet_id',
        'google_apps_script_url',
        'google_apps_script_secret',
        'google_sync_enabled',
        'google_sync_status',
        'google_last_sync_at',
        'google_last_sync_error'
    ]
    const safe = {}
    for (const k of allowed) {
        if (k in updates) safe[k] = updates[k]
    }
    if (Object.keys(safe).length === 0) {
        console.warn('[negocios] actualizarNegocio: sin campos válidos')
        return null
    }

    const { data, error } = await supabase
        .from('negocios')
        .update(safe)
        .eq('id', id)
        .select()
        .single()
    if (error) {
        console.error('[negocios] actualizarNegocio:', error.message)
        return null
    }
    return data
}
