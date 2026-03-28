import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Status permitidos pelo admin via esta rota
const STATUS_PERMITIDOS = ['pago', 'cancelado', 'reembolsado', 'em_separacao', 'pronto']

export async function POST(req: NextRequest) {
  try {
    const { pedido_id, status } = await req.json()

    if (!pedido_id || !status) {
      return NextResponse.json({ erro: 'pedido_id e status são obrigatórios.' }, { status: 400 })
    }

    if (!STATUS_PERMITIDOS.includes(status)) {
      return NextResponse.json({ erro: 'Status inválido.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('pedidos')
      .update({
        status,
        pagamento_status: status === 'pago' ? 'approved' : undefined,
      })
      .eq('id', pedido_id)

    if (error) {
      console.error('Erro ao atualizar status:', error)
      return NextResponse.json({ erro: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Erro admin/pedidos/status:', err)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
