import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const LIMITE_PEDIDOS_PARCEIRO = 10 // máximo de pedidos ativos simultâneos por parceiro

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

    if (error || !pedido) return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 })

    // Melhoria 5: verificar limite de pedidos ativos do parceiro
    if (pedido.parceiro_id) {
      const { count } = await supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('parceiro_id', pedido.parceiro_id)
        .not('status', 'in', '(entregue,cancelado,reembolsado,aguardando_pagamento)')

      if ((count ?? 0) >= LIMITE_PEDIDOS_PARCEIRO) {
        return NextResponse.json({
          erro: 'Parceiro com muitos pedidos em andamento. Tente novamente em alguns minutos.',
          codigo: 'LIMITE_PARCEIRO',
        }, { status: 429 })
      }
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
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // Melhoria 8: expira em 30min
      }),
    })

    const mpData = await mpRes.json()
    if (!mpData.id) {
      console.error('MP erro:', mpData)
      return NextResponse.json({ erro: mpData.message ?? 'Erro ao gerar PIX.' }, { status: 400 })
    }

    await supabase.from('pedidos').update({
      pagamento_id:       String(mpData.id),
      pagamento_status:   'pending',
      pagamento_expira_em: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }).eq('id', pedido_id)

    const txData = mpData.point_of_interaction?.transaction_data ?? {}

    return NextResponse.json({
      payment_id: String(mpData.id),
      qr_code:    txData.qr_code        ?? '',
      qr_base64:  txData.qr_code_base64 ?? '',
      expira_em:  new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })

  } catch (err) {
    console.error('Erro gerar-pix:', err)
    return NextResponse.json({ erro: 'Erro interno ao gerar PIX.' }, { status: 500 })
  }
}
