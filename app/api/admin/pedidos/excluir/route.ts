import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function DELETE(req: NextRequest) {
  try {
    const { pedido_id } = await req.json()
    if (!pedido_id) return NextResponse.json({ erro: 'pedido_id obrigatório.' }, { status: 400 })

    await admin.from('pedido_itens').delete().eq('pedido_id', pedido_id)
    const { error } = await admin.from('pedidos').delete().eq('id', pedido_id)
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
