/**
 * NEGOCIOS SERVICE — UmaiSushi
 *
 * Operaciones sobre la tabla `negocios` (ver supabase/migrations/
 * 20260515120000_multi_tenant_schema.sql).
 *
 * Reglas:
 *  - obtenerNegocioPorSlug: público, lo usa el cliente público para
 *    resolver `/u/<slug>/` → negocio_id.
 *  - obtenerMiNegocio: requiere sesión, devuelve el primer (único)
 *    negocio cuyo owner_id es el user actual.
 *  - actualizarNegocio: requiere sesión y RLS valida que sea owner.
 */

/**
 * Resolver un slug a un negocio (público, sin auth).
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
async function obtenerNegocioPorSlug(slug) {
    if (!slug || typeof slug !== 'string') return null;
    const supabase = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!supabase || !isSupabaseReady()) return null;

    const { data, error } = await supabase
        .from('negocios')
        .select('*')
        .eq('slug', slug)
        .eq('activo', true)
        .maybeSingle();
    if (error) {
        console.error('[negocios] obtenerNegocioPorSlug:', error.message);
        return null;
    }
    return data;
}

/**
 * Devuelve el negocio del usuario logueado actual. Si tiene varios,
 * devuelve el primero (en el futuro habrá switcher). Si no hay sesión,
 * null.
 * @returns {Promise<object|null>}
 */
async function obtenerMiNegocio() {
    const supabase = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!supabase || !isSupabaseReady()) return null;

    const session = typeof getCurrentSession === 'function' ? await getCurrentSession() : null;
    if (!session) {
        console.warn('[negocios] obtenerMiNegocio: sin sesión');
        return null;
    }

    const { data, error } = await supabase
        .from('negocios')
        .select('*')
        .eq('owner_id', session.user.id)
        .eq('activo', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
    if (error) {
        console.error('[negocios] obtenerMiNegocio:', error.message);
        return null;
    }
    return data;
}

/**
 * Devuelve TODOS los negocios del usuario logueado (cuando haya
 * switcher en el dashboard).
 * @returns {Promise<Array>}
 */
async function obtenerMisNegocios() {
    const supabase = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!supabase || !isSupabaseReady()) return [];

    const session = typeof getCurrentSession === 'function' ? await getCurrentSession() : null;
    if (!session) return [];

    const { data, error } = await supabase
        .from('negocios')
        .select('*')
        .eq('owner_id', session.user.id)
        .eq('activo', true)
        .order('created_at', { ascending: true });
    if (error) {
        console.error('[negocios] obtenerMisNegocios:', error.message);
        return [];
    }
    return Array.isArray(data) ? data : [];
}

/**
 * Actualiza datos del negocio (RLS verifica que sea owner).
 * @param {string} id
 * @param {object} updates - { nombre_negocio?, telefono_negocio?, google_sheet_url? }
 * @returns {Promise<object|null>}
 */
async function actualizarNegocio(id, updates) {
    const supabase = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!supabase || !isSupabaseReady()) return null;
    if (!id) return null;

    // Whitelist de campos editables
    const allowed = ['nombre_negocio', 'telefono_negocio', 'google_sheet_url'];
    const safe = {};
    for (const k of allowed) {
        if (k in updates) safe[k] = updates[k];
    }
    if (Object.keys(safe).length === 0) {
        console.warn('[negocios] actualizarNegocio: sin campos válidos');
        return null;
    }

    const { data, error } = await supabase
        .from('negocios')
        .update(safe)
        .eq('id', id)
        .select()
        .single();
    if (error) {
        console.error('[negocios] actualizarNegocio:', error.message);
        return null;
    }
    return data;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        obtenerNegocioPorSlug,
        obtenerMiNegocio,
        obtenerMisNegocios,
        actualizarNegocio
    };
}
