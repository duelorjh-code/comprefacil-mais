import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (body.type !== 'payment') return NextResponse.json({ ok: true })

    const payId = body.data?.id
    if (!payId) return NextResponse.json({ ok: true })

    // Consulta status no MP
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${payId}`, {
      headers: { 'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
    })
    const mp = await r.json()

    if (mp.status === 'approved') {
      const { data: pedido } = await supabase.from('pedidos')
        .select('id, parceiro_id').eq('pagamento_id', String(payId)).single()

      if (pedido) {
        await supabase.from('pedidos').update({
          status: 'pago',
          pagamento_status: 'approved',
        }).eq('id', pedido.id)

        // Atribuir parceiro mais próximo se não definido
        if (!pedido.parceiro_id) {
          const { data: p } = await supabase.from('pedidos').select('lat_entrega, lng_entrega').eq('id', pedido.id).single()
          if (p) {
            const { data: parc } = await supabase.rpc('fn_parceiro_mais_proximo', {
              p_lat: p.lat_entrega, p_lng: p.lng_entrega, p_produtos: [],
            })
            if (parc?.[0]) {
              await supabase.from('pedidos').update({ parceiro_id: parc[0].parceiro_id, status: 'em_separacao' }).eq('id', pedido.id)
            }
          }
        } else {
          await supabase.from('pedidos').update({ status: 'em_separacao' }).eq('id', pedido.id)
        }
      }
    } else if (mp.status === 'cancelled' || mp.status === 'expired') {
      await supabase.from('pedidos').update({ status: 'cancelado', pagamento_status: mp.status })
        .eq('pagamento_id', String(payId))
    }

    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ ok: true }) }
}
