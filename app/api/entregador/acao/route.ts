import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { acao, pedido_id, entregador_id, codigo, lat, lng, justificativa } = await req.json()

    if (!acao || !pedido_id) {
      return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
    }

    const { data: pedido } = await supabase
      .from('pedidos')
      .select('id, status, codigo_confirmacao, entregador_id')
      .eq('id', pedido_id)
      .single()

    if (!pedido) {
      return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 })
    }

    if (acao === 'aceitar') {
      if (pedido.status !== 'pronto') {
        return NextResponse.json({ erro: 'Pedido não está pronto.' }, { status: 400 })
      }

      if (lat && lng) {
        await supabase.from('entregadores')
          .update({ lat_atual: lat, lng_atual: lng })
          .eq('id', entregador_id)
      }

      await supabase.from('pedidos')
        .update({ entregador_id, status: 'a_caminho' })
        .eq('id', pedido_id)

      return NextResponse.json({ ok: true })
    }

    if (acao === 'recusar') {
      if (justificativa === null || justificativa === undefined || justificativa === '') {
        // Sem justificativa — incrementa contador
        try {
          await supabase.rpc('fn_incrementar_recusas_entregador', {
            p_entregador_id: entregador_id,
          })
        } catch {}
      }
      return NextResponse.json({ ok: true })
    }

    if (acao === 'confirmar') {
      if (pedido.status !== 'a_caminho') {
        return NextResponse.json({ erro: 'Pedido não está a caminho.' }, { status: 400 })
      }
      if (codigo !== pedido.codigo_confirmacao) {
        return NextResponse.json({ erro: 'Código incorreto.' }, { status: 400 })
      }
      await supabase.from('pedidos')
        .update({ status: 'entregue' })
        .eq('id', pedido_id)

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 })

  } catch (err) {
    console.error('Erro entregador/acao:', err)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
