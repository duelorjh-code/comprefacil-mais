import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest) {
  const pedido_id = req.nextUrl.searchParams.get('pedido_id')
  if (!pedido_id) return NextResponse.json({ erro: 'pedido_id obrigatório.' }, { status: 400 })

  const { data, error } = await admin
    .from('pedido_status_historico')
    .select('status, criado_em')
    .eq('pedido_id', pedido_id)
    .order('criado_em', { ascending: true })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
