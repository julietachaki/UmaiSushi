import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {

  // ===== CORS PREFLIGHT =====

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    })
  }

  try {

    // ===== BODY =====

    const body = await req.json()
    const pedidoId = body.pedido_id

    if (!pedidoId) {

      return new Response(
        JSON.stringify({
          ok: false,
          error: 'pedido_id_required'
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      )

    }

    // ===== SUPABASE ADMIN CLIENT =====

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ===== PEDIDO =====

    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .single()

    if (pedidoError || !pedido) {

      return new Response(
        JSON.stringify({
          ok: false,
          error: 'pedido_not_found'
        }),
        {
          status: 404,
          headers: corsHeaders
        }
      )

    }

    // ===== NEGOCIO =====

    const { data: negocio, error: negocioError } = await supabase
      .from('negocios')
      .select(`
        google_apps_script_url,
        google_apps_script_secret,
        google_sync_enabled
      `)
      .eq('id', pedido.negocio_id)
      .single()

    if (negocioError || !negocio) {

      return new Response(
        JSON.stringify({
          ok: false,
          error: 'negocio_not_found'
        }),
        {
          status: 404,
          headers: corsHeaders
        }
      )

    }

    // ===== SYNC DISABLED =====

    if (!negocio.google_sync_enabled) {

      return new Response(
        JSON.stringify({
          ok: true,
          skipped: 'sync_disabled'
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      )

    }

    // ===== CONFIG INCOMPLETA =====

    if (
      !negocio.google_apps_script_url ||
      !negocio.google_apps_script_secret
    ) {

      return new Response(
        JSON.stringify({
          ok: false,
          error: 'google_config_missing'
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      )

    }

    // ===== BUILD ROW =====

    const row = {
      pedido_id: pedido.id || '',
      fecha: pedido.fecha || '',
      cliente: pedido.cliente || '',
      telefono: pedido.telefono || '',
      productos: JSON.stringify(pedido.productos || []),
      extras: JSON.stringify(pedido.extras || []),
      subtotal: Number(pedido.subtotal || 0),
      extras_total: Number(pedido.extras_total || 0),
      envio: Number(pedido.envio || 0),
      total: Number(pedido.total || 0),
      metodo_pago: pedido.metodo_pago || '',
      monto_efectivo: pedido.monto_efectivo || '',
      entrega: pedido.entrega || '',
      direccion: pedido.direccion_texto || '',
      maps_url: pedido.maps_url || '',
      estado: pedido.estado || 'nuevo'
    }

    // ===== POST TO GOOGLE =====

    const googleRes = await fetch(
      negocio.google_apps_script_url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          secret: negocio.google_apps_script_secret,
          row
        })
      }
    )

    const googleJson = await googleRes.json()

    // ===== GOOGLE ERROR =====

    if (!googleJson.ok) {

      await supabase
        .from('pedidos')
        .update({
          sync_error: JSON.stringify(googleJson).slice(0, 500),
          sync_attempts: (pedido.sync_attempts || 0) + 1
        })
        .eq('id', pedido.id)

      return new Response(
        JSON.stringify({
          ok: false,
          google: googleJson
        }),
        {
          status: 500,
          headers: corsHeaders
        }
      )

    }

    // ===== UPDATE PEDIDO =====

    await supabase
      .from('pedidos')
      .update({
        synced_to_sheets_at: new Date().toISOString(),
        sync_error: null,
        sync_attempts: (pedido.sync_attempts || 0) + 1
      })
      .eq('id', pedido.id)

    // ===== SUCCESS =====

    return new Response(
      JSON.stringify({
        ok: true,
        google: googleJson
      }),
      {
        status: 200,
        headers: corsHeaders
      }
    )

  } catch (err) {

    return new Response(
      JSON.stringify({
        ok: false,
        error: String(err)
      }),
      {
        status: 500,
        headers: corsHeaders
      }
    )

  }

})