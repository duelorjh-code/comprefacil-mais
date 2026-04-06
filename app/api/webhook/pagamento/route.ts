import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Valida assinatura HMAC-SHA256 do Mercado Pago
// Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
function validarAssinaturaMercadoPago(req: NextRequest, body: string): boolean {
  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')
  const { searchParams } = new URL(req.url)
  const dataId = searchParams.get('data.id')

  if (!xSignature || !xRequestId) return false

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    // Se o secret não estiver configurado, loga aviso mas não bloqueia em desenvolvimento
    console.warn('MERCADOPAGO_WEBHOOK_SECRET não configurado — validação de assinatura ignorada.')
    return true
  }

  // Monta o manifesto conforme especificação do MP
  const partes = xSignature.split(',')
  const ts = partes.find(p => p.startsWith('ts='))?.split('=')[1]
  const v1 = partes.find(p => p.startsWith('v1='))?.split('=')[1]

  if (!ts || !v1) return false

  const manifesto = `id:${dataId ?? ''};request-id:${xRequestId};ts:${ts};`
  const hmac = createHmac('sha256', secret).update(manifesto).digest('hex')

  return hmac === v1
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    if (!validarAssinaturaMercadoPago(req, rawBody)) {
      return NextResponse.json({ erro: 'Assinatura inválida.' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)

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
