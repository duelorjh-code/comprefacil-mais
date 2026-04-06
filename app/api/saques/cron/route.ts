import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  // Chama a função do banco que já tem a lógica correta e atômica
  const { error } = await supabase.rpc('fn_processar_saques_automaticos')

  if (error) {
    console.error('Erro cron saques:', error)
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
