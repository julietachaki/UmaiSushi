import { getSupabase, isSupabaseReady } from './supabase.js'

export async function signIn(email, password) {
    const supabase = getSupabase()
    if (!supabase) {
        return { user: null, session: null, error: new Error('Supabase no inicializado') }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
        console.error('[auth] signIn:', error.message)
        return { user: null, session: null, error }
    }
    console.log('[auth] ✓ signIn OK:', data.user?.email)
    return { user: data.user, session: data.session, error: null }
}

export async function signOut() {
    const supabase = getSupabase()
    if (!supabase) return { error: new Error('Supabase no inicializado') }
    const { error } = await supabase.auth.signOut()
    if (error) {
        console.error('[auth] signOut:', error.message)
        return { error }
    }
    console.log('[auth] ✓ signOut OK')
    return { error: null }
}

export async function getCurrentSession() {
    const supabase = getSupabase()
    if (!supabase) return null
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
        console.error('[auth] getCurrentSession:', error.message)
        return null
    }
    return session
}

export async function getCurrentUser() {
    const session = await getCurrentSession()
    return session?.user || null
}

export function onAuthStateChange(callback) {
    const supabase = getSupabase()
    if (!supabase) {
        return { data: { subscription: { unsubscribe: () => {} } } }
    }
    return supabase.auth.onAuthStateChange(callback)
}

export async function waitForSupabase(timeoutMs = 5000) {
    const interval = 50
    let waited = 0
    while (waited < timeoutMs) {
        if (isSupabaseReady()) return true
        await new Promise(r => setTimeout(r, interval))
        waited += interval
    }
    return isSupabaseReady()
}
