import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  const { parceiroId, lat, lng } = await req.json()

  const { data: parceiro } = await admin
    .from('parceiros').select('ativo, horario_abertura, horario_fechamento').eq('id', parceiroId).single()

  if (!parceiro?.ativo) return NextResponse.json({ erro: 'Parceiro indisponível.' })

  const { count } = await admin.from('entregadores')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'online').eq('validado', true)

  if (!count || count === 0) return NextResponse.json({ semEntregador: true })

  return NextResponse.json({ ok: true })
}
