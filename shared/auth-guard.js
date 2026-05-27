import { waitForSupabase, getCurrentSession, onAuthStateChange } from '../services/auth.service.js'

export async function mountAuthGuard() {
    if (typeof waitForSupabase !== 'function') {
        console.error('[auth-guard] auth.service.js no cargado')
        location.replace('/login/index.html')
        return null
    }
    const ready = await waitForSupabase()
    if (!ready) {
        console.error('[auth-guard] Supabase no inicializó')
        location.replace('/login/index.html')
        return null
    }
    const session = await getCurrentSession()
    if (!session) {
        const redirect = encodeURIComponent(location.pathname + location.search)
        console.log('[auth-guard] sin sesión, redirigiendo a /login/index.html')
        location.replace('/login/index.html?redirect=' + redirect)
        return null
    }
    onAuthStateChange((event, newSession) => {
        if (event === 'SIGNED_OUT' || !newSession) {
            console.log('[auth-guard] sesión perdida, redirigiendo a /login/index.html')
            location.replace('/login/index.html')
        }
    })
    return session
}
