import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest) {
  const periodo = req.nextUrl.searchParams.get('periodo') ?? 'hoje'

  // Calcula o início do período em UTC considerando BRT (UTC-4)
  const agora = new Date()
  let desde: Date

  if (periodo === 'hoje') {
    desde = new Date(agora)
    desde.setUTCHours(4, 0, 0, 0) // 00:00 BRT = 04:00 UTC
    if (agora.getUTCHours() < 4) desde.setUTCDate(desde.getUTCDate() - 1)
  } else if (periodo === 'semana') {
    desde = new Date(agora)
    desde.setUTCDate(desde.getUTCDate() - 7)
  } else {
    desde = new Date(agora)
    desde.setUTCDate(desde.getUTCDate() - 30)
  }

  const { data: pedidos } = await admin
    .from('pedidos')
    .select('status, total, taxa_conveniencia, valor_produtos, taxa_entrega, criado_em, parceiro_id, entregador_id, parceiros(nome_fantasia), entregadores(perfis:usuario_id(nome))')
    .gte('criado_em', desde.toISOString())
    .order('criado_em', { ascending: false })

  const entregues   = (pedidos ?? []).filter((p: any) => p.status === 'entregue')
  const cancelados  = (pedidos ?? []).filter((p: any) => p.status === 'cancelado')

  const faturamento       = entregues.reduce((a: number, p: any) => a + (p.total ?? 0), 0)
  const receita_app       = entregues.reduce((a: number, p: any) => a + (p.taxa_conveniencia ?? 0), 0)
  const faturamento_parc  = entregues.reduce((a: number, p: any) => a + (p.valor_produtos ?? 0), 0)
  const faturamento_ent   = entregues.reduce((a: number, p: any) => a + (p.taxa_entrega ?? 0), 0)
  const ticket_medio      = entregues.length > 0 ? faturamento / entregues.length : 0

  // Top parceiros
  const mapParc: Record<string, { nome: string; total: number; pedidos: number }> = {}
  entregues.forEach((p: any) => {
    const id = p.parceiro_id
    if (!mapParc[id]) mapParc[id] = { nome: p.parceiros?.nome_fantasia ?? '—', total: 0, pedidos: 0 }
    mapParc[id].total   += p.valor_produtos ?? 0
    mapParc[id].pedidos += 1
  })
  const top_parceiros = Object.values(mapParc).sort((a, b) => b.total - a.total).slice(0, 5)

  // Top entregadores
  const mapEnt: Record<string, { nome: string; total: number; entregas: number }> = {}
  entregues.forEach((p: any) => {
    const id = p.entregador_id
    if (!id) return
    if (!mapEnt[id]) mapEnt[id] = { nome: (p.entregadores as any)?.perfis?.nome ?? '—', total: 0, entregas: 0 }
    mapEnt[id].total   += p.taxa_entrega ?? 0
    mapEnt[id].entregas += 1
  })
  const top_entregadores = Object.values(mapEnt).sort((a, b) => b.entregas - a.entregas).slice(0, 5)

  // Evolução diária (só para semana/mês)
  const evolucao: Record<string, number> = {}
  entregues.forEach((p: any) => {
    const dia = new Date(p.criado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Campo_Grande', day: '2-digit', month: '2-digit' })
    evolucao[dia] = (evolucao[dia] ?? 0) + (p.total ?? 0)
  })

  return NextResponse.json({
    periodo,
    desde: desde.toISOString(),
    totais: {
      pedidos:         (pedidos ?? []).length,
      entregues:       entregues.length,
      cancelados:      cancelados.length,
      faturamento,
      receita_app,
      faturamento_parc,
      faturamento_ent,
      ticket_medio,
      taxa_cancelamento: (pedidos ?? []).length > 0
        ? ((cancelados.length / (pedidos ?? []).length) * 100).toFixed(1)
        : '0',
    },
    top_parceiros,
    top_entregadores,
    evolucao: Object.entries(evolucao).map(([dia, total]) => ({ dia, total })),
  })
}
