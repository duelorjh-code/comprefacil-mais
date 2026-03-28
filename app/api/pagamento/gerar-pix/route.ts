import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { pedido_id } = await req.json()

    const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!MP_TOKEN) {
      return NextResponse.json({ erro: 'Configuração de pagamento ausente.' }, { status: 500 })
    }

    const { data: pedido, error } = await supabase
      .from('pedidos')
      .select('id, total, status, parceiro_id, clientes ( perfis ( nome, telefone ) )')
      .eq('id', pedido_id)
      .single()

    if (error || !pedido) {
      return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 })
    }

    const telefone = (pedido.clientes as any)?.perfis?.telefone?.replace(/\D/g, '') ?? '00000000000'
    const email    = `${telefone}@cfm.app`

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'Authorization':     `Bearer ${MP_TOKEN}`,
        'X-Idempotency-Key': pedido_id,
      },
      body: JSON.stringify({
        transaction_amount: Number(pedido.total),
        description:        `CompreFácil+ Pedido #${pedido_id.slice(0, 8).toUpperCase()}`,
        payment_method_id:  'pix',
        payer:              { email },
        notification_url:   `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/pagamento`,
        external_reference: pedido_id,
      }),
    })

    const mpData = await mpRes.json()

    if (!mpData.id) {
      console.error('MP erro:', mpData)
      return NextResponse.json({ erro: mpData.message ?? 'Erro ao gerar PIX.' }, { status: 400 })
    }

    // Salva payment_id no pedido
    await supabase.from('pedidos').update({
      pagamento_id:     String(mpData.id),
      pagamento_status: 'pending',
    }).eq('id', pedido_id)

    const txData = mpData.point_of_interaction?.transaction_data ?? {}

    return NextResponse.json({
      payment_id: String(mpData.id),
      qr_code:    txData.qr_code       ?? '',
      qr_base64:  txData.qr_code_base64 ?? '',
    })

  } catch (err) {
    console.error('Erro gerar-pix:', err)
    return NextResponse.json({ erro: 'Erro interno ao gerar PIX.' }, { status: 500 })
  }
}
