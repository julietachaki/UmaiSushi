/**
 * AUTH-GUARD — UmaiSushi
 *
 * Helper para proteger páginas: al tope de un HTML privado, llamar
 *   const session = await mountAuthGuard();
 * Si no hay sesión, redirige a /login/?redirect=<current-path>.
 * Si hay sesión, devuelve el objeto session para que la página lo
 * use (ej. mostrar email, obtener user.id, etc).
 *
 * Defensa en profundidad: el guard es UX, la seguridad real está en
 * las RLS policies de Supabase. Un cliente malicioso podría saltar
 * este check, pero las queries fallarían igual sin sesión válida.
 */

async function mountAuthGuard() {
    if (typeof waitForSupabase !== 'function') {
        console.error('[auth-guard] auth.service.js no cargado');
        location.replace('/login/');
        return null;
    }
    const ready = await waitForSupabase();
    if (!ready) {
        console.error('[auth-guard] Supabase no inicializó');
        location.replace('/login/');
        return null;
    }
    const session = await getCurrentSession();
    if (!session) {
        const redirect = encodeURIComponent(location.pathname + location.search);
        console.log('[auth-guard] sin sesión, redirigiendo a /login/');
        location.replace('/login/?redirect=' + redirect);
        return null;
    }
    // Escuchar cambios: si el user hace logout en otra tab, redirigir
    onAuthStateChange((event, newSession) => {
        if (event === 'SIGNED_OUT' || !newSession) {
            console.log('[auth-guard] sesión perdida, redirigiendo a /login/');
            location.replace('/login/');
        }
    });
    return session;
}
