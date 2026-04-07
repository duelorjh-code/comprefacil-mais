import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = createSupabaseServer()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

    const { data: entregadorAuth } = await supabase
      .from('entregadores').select('id').eq('usuario_id', user.id).single()
    if (!entregadorAuth) return NextResponse.json({ erro: 'Entregador não encontrado.' }, { status: 403 })

    const { acao, pedido_id, codigo, lat, lng, justificativa } = await req.json()
    const entregador_id = entregadorAuth.id

    if (!acao || !pedido_id) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })

    const { data: pedido } = await supabase
      .from('pedidos')
      .select(`
        id, status, codigo_confirmacao, entregador_id,
        clientes ( perfis:usuario_id ( nome, telefone ) )
      `)
      .eq('id', pedido_id)
      .single()

    if (!pedido) return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 })

    if (acao === 'aceitar') {
      if (pedido.status !== 'pronto') {
        return NextResponse.json({ erro: 'Pedido não está pronto.' }, { status: 400 })
      }
      if (lat && lng) {
        await supabase.from('entregadores')
          .update({ lat_atual: lat, lng_atual: lng }).eq('id', entregador_id)
      }
      await supabase.from('pedidos')
        .update({ entregador_id, status: 'a_caminho' }).eq('id', pedido_id)

      // Melhoria 4: link WhatsApp para o cliente com o código de confirmação
      const tel    = (pedido.clientes as any)?.perfis?.telefone?.replace(/\D/g, '')
      const codigo = pedido.codigo_confirmacao
      if (tel) {
        const msg = encodeURIComponent(
          `🛵 *CompreFácil+* — Seu pedido está a caminho!\n\n` +
          `O entregador já saiu para te entregar.\n\n` +
          `Ao receber, informe o código de confirmação:\n\n` +
          `*${codigo}*\n\n` +
          `Obrigado por comprar com a gente! 🛒`
        )
        // Salva o link no pedido para exibição futura (não abre automaticamente — LGPD)
        await supabase.from('pedidos')
          .update({ observacoes: `whatsapp_notificado:https://wa.me/55${tel}?text=${msg}` })
          .eq('id', pedido_id)
      }

      return NextResponse.json({ ok: true })
    }

    if (acao === 'recusar') {
      if (justificativa === null || justificativa === undefined || justificativa === '') {
        try {
          await supabase.rpc('fn_incrementar_recusas_entregador', { p_entregador_id: entregador_id })
        } catch {}
      }
      return NextResponse.json({ ok: true })
    }

    if (acao === 'confirmar') {
      if (pedido.status !== 'a_caminho') {
        return NextResponse.json({ erro: 'Pedido não está a caminho.' }, { status: 400 })
      }
      if (pedido.entregador_id !== entregador_id) {
        return NextResponse.json({ erro: 'Pedido não pertence a este entregador.' }, { status: 403 })
      }
      if (codigo !== pedido.codigo_confirmacao) {
        return NextResponse.json({ erro: 'Código incorreto.' }, { status: 400 })
      }
      await supabase.from('pedidos').update({ status: 'entregue' }).eq('id', pedido_id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 })
  } catch (err) {
    console.error('Erro entregador/acao:', err)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
