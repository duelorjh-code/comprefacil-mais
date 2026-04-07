import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Transições permitidas ao parceiro
const TRANSICOES: Record<string, string> = {
  pago:         'em_separacao',
  em_separacao: 'pronto',
}

export async function POST(req: NextRequest) {
  try {
    // Valida sessão
    const supabaseAuth = createSupabaseServer()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

    const { pedido_id } = await req.json()
    if (!pedido_id) return NextResponse.json({ erro: 'pedido_id obrigatório.' }, { status: 400 })

    // Busca o parceiro do usuário autenticado
    const { data: parceiro } = await admin
      .from('parceiros')
      .select('id')
      .eq('usuario_id', user.id)
      .single()

    if (!parceiro) return NextResponse.json({ erro: 'Parceiro não encontrado.' }, { status: 403 })

    // Busca o pedido garantindo que pertence ao parceiro
    const { data: pedido } = await admin
      .from('pedidos')
      .select('id, status, parceiro_id')
      .eq('id', pedido_id)
      .eq('parceiro_id', parceiro.id)
      .single()

    if (!pedido) return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 })

    const novoStatus = TRANSICOES[pedido.status]
    if (!novoStatus) {
      return NextResponse.json({
        erro: `Transição não permitida a partir do status '${pedido.status}'.`,
      }, { status: 400 })
    }

    // Usa service_role — contorna RLS e permite que o trigger fn_registrar_historico_status
    // insira em pedido_status_historico sem conflito de permissão
    const { error } = await admin
      .from('pedidos')
      .update({ status: novoStatus })
      .eq('id', pedido_id)

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, status_anterior: pedido.status, novo_status: novoStatus })
  } catch (err) {
    console.error('Erro parceiro/pedido-status:', err)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
