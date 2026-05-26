/**
 * SUPABASE CLIENT - UmaiSushi
 * 
 * Inicialización del cliente Supabase para centralizar datos
 * - Productos
 * - Pedidos
 * - Zonas de delivery
 * - Configuración
 * 
 * IMPORTANTE:
 * Reemplazar SUPABASE_URL y SUPABASE_ANON_KEY con los valores reales
 * desde https://app.supabase.com/project/[ID]/settings/api
 */

// ===== CONFIGURACIÓN =====
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ===== INICIALIZACIÓN =====
let supabaseClient = null;
let supabaseInitialized = false;
let supabaseError = null;

/**
 * Inicializar cliente Supabase
 * Se llama automáticamente al cargar este script
 */
async function initSupabase() {
    console.log('[supabase] Inicializando cliente...');
    
    if (supabaseInitialized) {
        console.log('[supabase] Cliente ya inicializado');
        return supabaseClient;
    }

    try {
        // Validar que las credenciales estén configuradas
        if (!SUPABASE_URL || SUPABASE_URL.includes('REEMPLAZAR')) {
            throw new Error('SUPABASE_URL no configurada.');
        }
        if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('REEMPLAZAR')) {
            throw new Error('SUPABASE_ANON_KEY no configurada.');
        }

        // Crear cliente usando la librería CDN
        const { createClient } = window.supabase || {};
        if (!createClient) {
            throw new Error('Supabase no cargado. Asegúrate de incluir: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
        }

        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        supabaseInitialized = true;
        supabaseError = null;

        console.log('[supabase] ✓ Cliente inicializado exitosamente');
        console.log('[supabase] URL:', SUPABASE_URL);
        
        return supabaseClient;
    } catch (error) {
        supabaseError = error.message;
        console.error('[supabase] ✗ Error al inicializar:', error.message);
        return null;
    }
}

/**
 * Obtener el cliente Supabase
 * Retorna null si no está inicializado
 */
function getSupabase() {
    if (!supabaseInitialized) {
        console.warn('[supabase] Cliente no inicializado. Llamar a initSupabase() primero');
        return null;
    }
    return supabaseClient;
}

/**
 * Verificar estado de Supabase
 */
function isSupabaseReady() {
    return supabaseInitialized && supabaseClient !== null;
}

/**
 * Obtener mensaje de error (si existe)
 */
function getSupabaseError() {
    return supabaseError;
}

// ===== HELPER: Manejo de errores =====
/**
 * Wrapper para queries con manejo de error estándar
 * Retorna { data, error }
 */
async function executeSupabaseQuery(fn, fallbackData = null) {
    try {
        const result = await fn();
        if (result.error) {
            console.error('[supabase-query] Error:', result.error.message);
            return { data: fallbackData, error: result.error };
        }
        return { data: result.data, error: null };
    } catch (e) {
        console.error('[supabase-query] Excepción:', e.message);
        return { data: fallbackData, error: e };
    }
}

// ===== INICIALIZACIÓN AUTOMÁTICA =====
// Inicializar Supabase cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
} else {
    initSupabase();
}

// ===== EXPORTACIÓN (para módulos ES6) =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initSupabase,
        getSupabase,
        isSupabaseReady,
        getSupabaseError,
        executeSupabaseQuery
    };
}
