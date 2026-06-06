import { getSupabase, isSupabaseReady } from './supabase.js'

const BUCKET = 'productos'

export async function asegurarBucket() {
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) return false
    try {
        const { data: buckets } = await supabase.storage.listBuckets()
        if (buckets && buckets.some(b => b.name === BUCKET)) return true
        const { error } = await supabase.storage.createBucket(BUCKET, {
            public: true
        })
        if (error) {
            console.error('[storage] Error creando bucket:', error.message)
            return false
        }
        console.log('[storage] ✓ Bucket creado:', BUCKET)
        return true
    } catch (e) {
        console.error('[storage] Excepción asegurando bucket:', e.message)
        return false
    }
}

export async function subirImagen(file, productId) {
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) {
        console.error('[storage] Supabase no disponible')
        return null
    }

    await asegurarBucket()

    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = productId + '.' + ext
    const filePath = fileName

    try {
        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            })

        if (uploadError) {
            console.error('[storage] Error subiendo imagen:', uploadError.message)
            return null
        }

        const { data: urlData } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(filePath)

        const publicUrl = urlData?.publicUrl
        if (!publicUrl) {
            console.error('[storage] No se pudo obtener URL pública')
            return null
        }

        console.log('[storage] ✓ Imagen subida:', publicUrl)
        return publicUrl
    } catch (e) {
        console.error('[storage] Excepción subiendo imagen:', e.message)
        return null
    }
}

export async function subirBase64ComoImagen(base64Data, productId, mimeType) {
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) return null

    await asegurarBucket()

    const base64Str = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
    const binaryStr = atob(base64Str)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: mimeType || 'image/jpeg' })
    const file = new File([blob], productId + '.jpg', { type: mimeType || 'image/jpeg' })

    return subirImagen(file, productId)
}

export async function eliminarImagen(productId) {
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) return false

    try {
        const { data: files, error: listError } = await supabase.storage
            .from(BUCKET)
            .list('', { search: productId })

        if (listError) {
            console.error('[storage] Error listando archivos:', listError.message)
            return false
        }

        if (!files || files.length === 0) return true

        const paths = files.map(f => f.name)
        const { error: removeError } = await supabase.storage
            .from(BUCKET)
            .remove(paths)

        if (removeError) {
            console.error('[storage] Error eliminando imagen:', removeError.message)
            return false
        }

        console.log('[storage] ✓ Imagen(es) eliminada(s):', paths.join(', '))
        return true
    } catch (e) {
        console.error('[storage] Excepción eliminando imagen:', e.message)
        return false
    }
}
