import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // MP envia type='payment' com data.id = payment_id
    if (body.type !== 'payment') return NextResponse.json({ ok: true })

    const payId = body.data?.id
    if (!payId) return NextResponse.json({ ok: true })

    // Consulta o status real no MP
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${payId}`, {
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
    })
    const mp = await r.json()

    if (mp.status === 'approved') {
      // Busca pelo external_reference (pedido_id)
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('id, total, parceiro_id, pedido_itens ( quantidade, preco_unitario )')
        .eq('id', mp.external_reference)
        .single()

      if (!pedido) return NextResponse.json({ ok: true })

      // Atualiza status para 'pago' — parceiro verá o pedido
      await supabase.from('pedidos').update({
        status:           'pago',
        pagamento_status: 'approved',
        pagamento_id:     String(payId),
      }).eq('id', pedido.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook erro:', err)
    return NextResponse.json({ ok: true }) // sempre 200 pro MP não retentar infinito
  }
}
