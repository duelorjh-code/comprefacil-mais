import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { pedido_id } = await req.json()

    const { data: pedido, error: errPedido } = await admin
      .from('pedidos')
      .select('id, total, status, clientes ( perfis ( nome, telefone ) )')
      .eq('id', pedido_id)
      .single()

    if (errPedido || !pedido) {
      return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 })
    }

    if (pedido.status !== 'aguardando_pagamento') {
      return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 })
    }

    const clienteTel = (pedido.clientes as any)?.perfis?.telefone?.replace(/\D/g, '') ?? '00000000000'
    const total = Number(pedido.total)

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        'X-Idempotency-Key': pedido_id,
      },
      body: JSON.stringify({
        transaction_amount: total,
        description: `CompreFacil Pedido #${pedido_id.slice(0, 8).toUpperCase()}`,
        payment_method_id: 'pix',
        payer: {
          email: `${clienteTel}@cfm.app`,
          first_name: 'Cliente',
          last_name: 'CFM',
        },
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/pagamento`,
      }),
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok || !mpData.id) {
      return NextResponse.json({
        erro: mpData.message ?? mpData.error ?? 'Erro MP',
        detalhe: mpData,
      }, { status: 500 })
    }

    await admin.from('pedidos').update({
      pagamento_id: String(mpData.id),
      pagamento_status: 'pending',
    }).eq('id', pedido_id)

    return NextResponse.json({
      payment_id: mpData.id,
      qr_code:   mpData.point_of_interaction?.transaction_data?.qr_code ?? '',
      qr_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64 ?? '',
    })

  } catch (e: any) {
    return NextResponse.json({ erro: 'Erro interno: ' + e.message }, { status: 500 })
  }
}
