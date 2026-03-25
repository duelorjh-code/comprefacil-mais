import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { pedido_id } = await req.json()
  const supabase = createSupabaseServer()

  const { data: pedido } = await supabase.from('pedidos')
    .select('id, total, status, clientes ( perfis ( nome, telefone ) )')
    .eq('id', pedido_id).single()

  if (!pedido) return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 })
  if (pedido.status !== 'aguardando_pagamento') return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 })

  const clienteNome = (pedido.clientes as any)?.perfis?.nome ?? 'Cliente'

  try {
    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        'X-Idempotency-Key': pedido_id,
      },
      body: JSON.stringify({
        transaction_amount: pedido.total,
        description: `CompreFácil+ Pedido #${pedido_id.slice(0,8).toUpperCase()}`,
        payment_method_id: 'pix',
        payer: { email: `${(pedido.clientes as any)?.perfis?.telefone?.replace(/\D/g,'')}@cfm.app` },
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/pagamento`,
      }),
    })

    const mpData = await mpRes.json()
    if (!mpData.id) throw new Error('MP sem ID')

    await supabase.from('pedidos').update({
      pagamento_id: String(mpData.id),
      pagamento_status: 'pending',
    }).eq('id', pedido_id)

    return NextResponse.json({
      payment_id: mpData.id,
      qr_code:    mpData.point_of_interaction?.transaction_data?.qr_code ?? '',
      qr_base64:  mpData.point_of_interaction?.transaction_data?.qr_code_base64 ?? '',
    })
  } catch (e) {
    return NextResponse.json({ erro: 'Erro ao gerar PIX.' }, { status: 500 })
  }
}
