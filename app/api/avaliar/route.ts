import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = createSupabaseServer()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

    const { pedido_id, nota, comentario } = await req.json()
    if (!pedido_id || !nota || nota < 1 || nota > 5) {
      return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
    }

    // Verifica que o pedido pertence ao cliente e foi entregue
    const { data: cliente } = await admin
      .from('clientes').select('id').eq('usuario_id', user.id).single()
    if (!cliente) return NextResponse.json({ erro: 'Cliente não encontrado.' }, { status: 404 })

    const { data: pedido } = await admin
      .from('pedidos')
      .select('id, status, entregador_id, avaliado')
      .eq('id', pedido_id)
      .eq('cliente_id', cliente.id)
      .single()

    if (!pedido) return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 })
    if (pedido.status !== 'entregue') return NextResponse.json({ erro: 'Pedido ainda não foi entregue.' }, { status: 400 })
    if (pedido.avaliado) return NextResponse.json({ erro: 'Pedido já foi avaliado.' }, { status: 400 })
    if (!pedido.entregador_id) return NextResponse.json({ erro: 'Entregador não encontrado.' }, { status: 400 })

    const { error } = await admin.from('avaliacoes').insert({
      pedido_id,
      cliente_id:    cliente.id,
      entregador_id: pedido.entregador_id,
      nota,
      comentario: comentario?.trim() || null,
    })

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

    // Marca pedido como avaliado
    await admin.from('pedidos').update({ avaliado: true }).eq('id', pedido_id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
