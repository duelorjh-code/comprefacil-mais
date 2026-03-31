import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchParams } = new URL(req.url)
  const entregador_id = searchParams.get('entregador_id')
  const status        = searchParams.get('status')

  if (!entregador_id) {
    return NextResponse.json({ erro: 'entregador_id obrigatório.' }, { status: 400 })
  }

  let query = supabase
    .from('pedidos')
    .select(`
      id, status, total, taxa_entrega, distancia_km, endereco_entrega, codigo_confirmacao,
      lat_entrega, lng_entrega,
      pedido_itens ( quantidade, produtos ( nome ) ),
      parceiros ( nome_fantasia, endereco, numero, lat, lng ),
      clientes ( nome, telefone )
    `)
    .order('criado_em', { ascending: false })

  if (status) {
    query = query.eq('status', status).eq('entregador_id', entregador_id)
  } else {
    query = query.or(`status.eq.pronto,and(entregador_id.eq.${entregador_id},status.eq.a_caminho)`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro pedidos entregador:', error)
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
