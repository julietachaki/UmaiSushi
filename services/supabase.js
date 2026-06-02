import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabaseClient = null
let supabaseInitialized = false
let supabaseError = null

let supabaseReadyResolve
const supabaseReadyPromise = new Promise(resolve => { supabaseReadyResolve = resolve })

initSupabase()

export async function initSupabase() {
    console.log('[supabase] Inicializando cliente...')

    if (supabaseInitialized) {
        console.log('[supabase] Cliente ya inicializado')
        return supabaseClient
    }

    try {
        if (!SUPABASE_URL || SUPABASE_URL.includes('REEMPLAZAR')) {
            throw new Error('SUPABASE_URL no configurada.')
        }
        if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('REEMPLAZAR')) {
            throw new Error('SUPABASE_ANON_KEY no configurada.')
        }

        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        supabaseInitialized = true
        supabaseError = null

        console.log('[supabase] ✓ Cliente inicializado exitosamente')
        console.log('[supabase] URL:', SUPABASE_URL)

        supabaseReadyResolve()
        return supabaseClient
    } catch (error) {
        supabaseError = error.message
        console.error('[supabase] ✗ Error al inicializar:', error.message)
        supabaseReadyResolve()
        return null
    }
}

export function getSupabase() {
    if (!supabaseInitialized) {
        console.warn('[supabase] Cliente no inicializado. Llamar a initSupabase() primero')
        return null
    }
    return supabaseClient
}

export function isSupabaseReady() {
    return supabaseInitialized && supabaseClient !== null
}

export async function awaitSupabaseReady() {
    await supabaseReadyPromise
    return supabaseClient
}

export function getSupabaseError() {
    return supabaseError
}

export async function executeSupabaseQuery(fn, fallbackData = null) {
    try {
        const result = await fn()
        if (result.error) {
            console.error('[supabase-query] Error:', result.error.message)
            return { data: fallbackData, error: result.error }
        }
        return { data: result.data, error: null }
    } catch (e) {
        console.error('[supabase-query] Excepción:', e.message)
        return { data: fallbackData, error: e }
    }
}
