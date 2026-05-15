/**
 * AUTH SERVICE — UmaiSushi
 *
 * Wrapper sobre supabase.auth.* para centralizar signIn / signOut /
 * session helpers. Las páginas no llaman a window.supabaseClient.auth
 * directamente, usan estas funciones.
 *
 * Persistencia: Supabase Auth guarda la sesión en localStorage por
 * default (clave `sb-eqawmvmaohpsxydyepab-auth-token`). Sobrevive
 * recargas y tabs.
 */

/**
 * Iniciar sesión con email + password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: object|null, session: object|null, error: Error|null }>}
 */
async function signIn(email, password) {
    const supabase = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!supabase) {
        return { user: null, session: null, error: new Error('Supabase no inicializado') };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        console.error('[auth] signIn:', error.message);
        return { user: null, session: null, error };
    }
    console.log('[auth] ✓ signIn OK:', data.user?.email);
    return { user: data.user, session: data.session, error: null };
}

/**
 * Cerrar sesión.
 * @returns {Promise<{ error: Error|null }>}
 */
async function signOut() {
    const supabase = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!supabase) return { error: new Error('Supabase no inicializado') };
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('[auth] signOut:', error.message);
        return { error };
    }
    console.log('[auth] ✓ signOut OK');
    return { error: null };
}

/**
 * Obtener la sesión actual (sincrónica desde cache de Supabase).
 * @returns {Promise<object|null>}
 */
async function getCurrentSession() {
    const supabase = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!supabase) return null;
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
        console.error('[auth] getCurrentSession:', error.message);
        return null;
    }
    return session;
}

/**
 * Obtener el usuario logueado o null.
 * @returns {Promise<object|null>}
 */
async function getCurrentUser() {
    const session = await getCurrentSession();
    return session?.user || null;
}

/**
 * Suscribirse a cambios de auth state (login/logout/refresh).
 * @param {(event: string, session: object|null) => void} callback
 * @returns {{ data: { subscription: { unsubscribe: () => void } } }}
 */
function onAuthStateChange(callback) {
    const supabase = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!supabase) {
        return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabase.auth.onAuthStateChange(callback);
}

/**
 * Esperar a que Supabase esté listo. Útil al tope de páginas que
 * dependen de auth antes de render.
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function waitForSupabase(timeoutMs = 5000) {
    const interval = 50;
    let waited = 0;
    while (waited < timeoutMs) {
        if (typeof isSupabaseReady === 'function' && isSupabaseReady()) return true;
        await new Promise(r => setTimeout(r, interval));
        waited += interval;
    }
    return typeof isSupabaseReady === 'function' && isSupabaseReady();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        signIn,
        signOut,
        getCurrentSession,
        getCurrentUser,
        onAuthStateChange,
        waitForSupabase
    };
}
