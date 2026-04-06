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
    .from('parceiros')
    .select('ativo, horario_abertura, horario_fechamento')
    .eq('id', parceiroId)
    .single()

  if (!parceiro?.ativo) return NextResponse.json({ erro: 'Parceiro indisponível.' })

  // Valida horário de funcionamento (fuso: America/Campo_Grande = UTC-4)
  const agora = new Date()
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Campo_Grande',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const partes       = formatter.formatToParts(agora)
  const horaAtual    = parseInt(partes.find(p => p.type === 'hour')!.value,   10)
  const minutoAtual  = parseInt(partes.find(p => p.type === 'minute')!.value, 10)
  const minutosDia   = horaAtual * 60 + minutoAtual

  // horario_abertura / horario_fechamento vêm como "HH:MM:SS"
  const [hAbr, mAbr] = (parceiro.horario_abertura  as string).split(':').map(Number)
  const [hFec, mFec] = (parceiro.horario_fechamento as string).split(':').map(Number)
  const abertura     = hAbr * 60 + mAbr
  const fechamento   = hFec * 60 + mFec

  if (minutosDia < abertura || minutosDia >= fechamento) {
    return NextResponse.json({ erro: 'Parceiro fora do horário de atendimento.' })
  }

  const { count } = await admin.from('entregadores')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'online').eq('validado', true)

  if (!count || count === 0) return NextResponse.json({ semEntregador: true })

  return NextResponse.json({ ok: true })
}
