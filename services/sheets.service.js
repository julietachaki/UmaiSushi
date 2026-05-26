import { getSupabase, isSupabaseReady } from './supabase.js'

export function parseGoogleSheetUrl(url) {
    if (!url || typeof url !== 'string') return null
    const trimmed = url.trim()
    const m = trimmed.match(
        /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})(?:[/?#].*)?$/
    )
    if (!m) return null
    return { url: trimmed, id: m[1] }
}

export function parseAppsScriptUrl(url) {
    if (!url || typeof url !== 'string') return null
    const trimmed = url.trim()
    const m = trimmed.match(
        /^https:\/\/script\.google\.com\/(?:macros|a\/macros\/[^/]+)\/s\/([A-Za-z0-9_-]{20,})\/exec(?:\?.*)?$/
    )
    if (!m) return null
    return { url: trimmed, deployId: m[1] }
}

export function pedidoToSheetsRow(pedido) {
    if (!pedido || typeof pedido !== 'object') return {}

    let fecha = ''
    let hora = ''
    if (pedido.fecha) {
        try {
            const d = new Date(pedido.fecha)
            const tz = 'America/Argentina/Mendoza'
            const parts = new Intl.DateTimeFormat('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false,
                timeZone: tz
            }).formatToParts(d).reduce((acc, p) => {
                acc[p.type] = p.value
                return acc
            }, {})
            fecha = `${parts.day}/${parts.month}/${parts.year}`
            hora = `${parts.hour}:${parts.minute}`
        } catch (e) { /* ignore */ }
    }

    const productosStr = Array.isArray(pedido.productos)
        ? pedido.productos
            .filter(p => p && (p.cantidad || 0) > 0)
            .map(p => `${p.cantidad}x ${p.nombre || ''}`)
            .join(' | ')
        : ''

    let extrasStr = ''
    if (Array.isArray(pedido.extras)) {
        extrasStr = pedido.extras
            .filter(e => e && (e.cantidad || 0) > 0)
            .map(e => {
                const nombre = (e.label || e.nombre || '').replace(/^Extra\s/, '')
                return `${e.cantidad}x ${nombre}`
            })
            .join(' | ')
    } else if (pedido.extras && typeof pedido.extras === 'object') {
        const t = parseInt(pedido.extras.teriyaki, 10) || 0
        const s = parseInt(pedido.extras.soja, 10) || 0
        const ex = []
        if (t) ex.push(`${t}x salsa teriyaki`)
        if (s) ex.push(`${s}x salsa de soja`)
        extrasStr = ex.join(' | ')
    }

    return {
        pedido_id: pedido.id || '',
        fecha,
        hora,
        cliente: pedido.cliente || '',
        telefono: pedido.telefono || '',
        productos: productosStr,
        extras: extrasStr,
        subtotal: Number(pedido.subtotal) || 0,
        extras_total: Number(pedido.extras_total) || 0,
        envio: Number(pedido.envio) || 0,
        total: Number(pedido.total) || 0,
        metodo_pago: pedido.metodo_pago || '',
        monto_efectivo: pedido.monto_efectivo ? Number(pedido.monto_efectivo) : '',
        entrega: pedido.entrega || '',
        direccion: pedido.direccion_texto || '',
        maps_url: pedido.maps_url && pedido.maps_url !== 'No especificada' ? pedido.maps_url : '',
        estado: pedido.estado || 'nuevo'
    }
}

export async function enviarPedidoASheets(pedido, negocio) {

    if (!negocio || !negocio.google_sync_enabled) {
        return { ok: false, error: 'sync_disabled' }
    }

    const supabase = getSupabase()

    try {

        const { data, error } = await supabase.functions.invoke(
            'sync-pedido-to-sheet',
            {
                body: {
                    pedido_id: pedido.id
                }
            }
        )

        if (error) {
            console.error('[sheets] edge function error:', error)
            return {
                ok: false,
                error: error.message || 'edge_function_error'
            }
        }

        return {
            ok: true,
            data
        }

    } catch (e) {

        console.error('[sheets] invoke exception:', e)

        return {
            ok: false,
            error: e.message || String(e)
        }

    }
}

export async function marcarPedidoSincronizado(pedidoId, result) {
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) return false
    if (!pedidoId || !result) return false

    const updates = {}
    if (result.ok) {
        updates.synced_to_sheets_at = result.syncedAt || new Date().toISOString()
        updates.sync_error = null
    } else {
        updates.sync_error = String(result.error || 'unknown').slice(0, 500)
    }

    const { data: current } = await supabase
        .from('pedidos').select('sync_attempts').eq('id', pedidoId).maybeSingle()
    updates.sync_attempts = ((current && current.sync_attempts) || 0) + 1

    const { error } = await supabase
        .from('pedidos').update(updates).eq('id', pedidoId)
    if (error) {
        console.error('[sheets] marcarPedidoSincronizado:', error.message)
        return false
    }
    return true
}
