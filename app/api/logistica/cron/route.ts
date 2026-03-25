import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  // Vercel envia o CRON_SECRET no header Authorization
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  // Verifica SLA de pedidos ativos
  await supabase.rpc('fn_verificar_sla')

  // Alerta pedidos prontos há mais de 20 min sem entregador
  const { data: pedidosProntos } = await supabase
    .from('pedidos')
    .select('id, parceiros ( nome_fantasia )')
    .eq('status', 'pronto')
    .lt('atualizado_em', new Date(Date.now() - 20 * 60_000).toISOString())

  for (const p of (pedidosProntos ?? [])) {
    const { count } = await supabase
      .from('alertas_admin')
      .select('id', { count: 'exact', head: true })
      .eq('pedido_id', p.id)
      .eq('tipo', 'pedido_sem_entregador')
      .eq('resolvido', false)

    if (!count) {
      await supabase.from('alertas_admin').insert({
        tipo: 'pedido_sem_entregador',
        descricao: `Pedido pronto há +20min sem entregador — ${(p.parceiros as any)?.nome_fantasia}`,
        pedido_id: p.id,
      })
    }
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
}
