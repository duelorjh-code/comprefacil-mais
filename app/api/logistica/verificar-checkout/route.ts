// app/api/logistica/verificar-checkout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { parceiroId, lat, lng } = await req.json()
  const supabase = createSupabaseServer()

  // Verifica se parceiro está ativo e dentro do horário
  const { data: parceiro } = await supabase
    .from('parceiros').select('ativo, horario_abertura, horario_fechamento').eq('id', parceiroId).single()

  if (!parceiro?.ativo) return NextResponse.json({ erro: 'Parceiro indisponível.' })

  // Verifica entregadores disponíveis
  const { count } = await supabase.from('entregadores')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'online').eq('validado', true)

  if (!count || count === 0) return NextResponse.json({ semEntregador: true })

  return NextResponse.json({ ok: true })
}
