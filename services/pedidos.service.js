import { getSupabase, isSupabaseReady } from './supabase.js'

const PEDIDO_ESTADOS_VALIDOS = ['nuevo', 'preparando', 'listo', 'entregado', 'cancelado']

function pedidoToRow(p) {
    if (!p || typeof p !== 'object') return null

    const productos = Array.isArray(p.productos) ? p.productos : []
    const extras = p.extras && typeof p.extras === 'object' ? p.extras : {}
    const subtotal = Number(p.subtotal ?? p.subtotalMenu ?? 0) || 0
    const extras_total = Number(p.extras_total ?? p.extrasMonto ?? 0) || 0
    const envio = Number(p.envio ?? p.costoEnvio ?? 0) || 0
    const total = Number(p.total ?? p.totalFinal ?? subtotal + extras_total + envio) || 0

    const row = {
        cliente: String(p.cliente || 'Cliente'),
        telefono: p.telefono ? String(p.telefono) : null,
        direccion_texto: p.direccion_texto || null,
        maps_url: p.maps_url || null,
        coords: p.coords || null,
        productos,
        extras,
        subtotal,
        extras_total,
        envio,
        total,
        metodo_pago: p.metodo_pago || p.pago || null,
        monto_efectivo: p.monto_efectivo ?? p.montoPagaraCon ?? null,
        entrega: p.entrega || null,
        estado: p.estado || 'nuevo',
        indicaciones_cliente: p.indicaciones_cliente || null
    }
    if (p.negocio_id) row.negocio_id = p.negocio_id
    return row
}

export async function crearPedido(pedidoData) {
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) {
        console.error('[pedidos] Supabase no disponible — no se puede crear pedido')
        return null
    }

    const row = pedidoToRow(pedidoData)
    if (!row) {
        console.error('[pedidos] pedidoData inválido')
        return null
    }

    try {
        const { data, error } = await supabase.from('pedidos').insert([row]).select().single()
        if (error) {
            console.error('[pedidos] Error INSERT:', error.message)
            return null
        }
        console.log('[pedidos] ✓ Pedido creado:', data.id)
        return data
    } catch (e) {
        console.error('[pedidos] Excepción INSERT:', e.message)
        return null
    }
}

export async function obtenerPedidos(opciones = {}) {
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) {
        console.error('[pedidos] Supabase no disponible')
        return []
    }

    const limite = Number(opciones.limite) > 0 ? Number(opciones.limite) : 50
    const offset = Number(opciones.offset) >= 0 ? Number(opciones.offset) : 0
    const estado = opciones.estado || null
    const negocioId = opciones.negocioId || null

    try {
        let query = supabase.from('pedidos').select('*').order('fecha', { ascending: false })
        if (estado) query = query.eq('estado', estado)
        if (negocioId) query = query.eq('negocio_id', negocioId)
        const { data, error } = await query.range(offset, offset + limite - 1)
        if (error) {
            console.error('[pedidos] Error SELECT:', error.message)
            return []
        }
        return Array.isArray(data) ? data : []
    } catch (e) {
        console.error('[pedidos] Excepción SELECT:', e.message)
        return []
    }
}

export async function obtenerPedidoPorId(id) {
    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) {
        console.error('[pedidos] Supabase no disponible')
        return null
    }
    if (!id) return null

    try {
        const { data, error } = await supabase.from('pedidos').select('*').eq('id', id).single()
        if (error) {
            console.error('[pedidos] Error obtenerPedidoPorId:', error.message)
            return null
        }
        return data
    } catch (e) {
        console.error('[pedidos] Excepción obtenerPedidoPorId:', e.message)
        return null
    }
}

export async function actualizarEstadoPedido(id, nuevoEstado) {
    if (!PEDIDO_ESTADOS_VALIDOS.includes(nuevoEstado)) {
        console.error('[pedidos] Estado inválido:', nuevoEstado)
        return null
    }

    const supabase = getSupabase()
    if (!supabase || !isSupabaseReady()) {
        console.error('[pedidos] Supabase no disponible')
        return null
    }

    try {
        const { data, error } = await supabase
            .from('pedidos')
            .update({ estado: nuevoEstado })
            .eq('id', id)
            .select()
            .single()
        if (error) {
            console.error('[pedidos] Error UPDATE estado:', error.message)
            return null
        }
        console.log('[pedidos] ✓ Estado:', id, '→', nuevoEstado)
        return data
    } catch (e) {
        console.error('[pedidos] Excepción UPDATE estado:', e.message)
        return null
    }
}
