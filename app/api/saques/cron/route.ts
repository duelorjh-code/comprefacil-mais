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

  const { data: parceiros } = await supabase
    .from('parceiros')
    .select('usuario_id, saldo, pix_chave')
    .gt('saldo', 0)

  const { data: entregadores } = await supabase
    .from('entregadores')
    .select('usuario_id, saldo, pix_chave')
    .gt('saldo', 0)

  let processados = 0
  for (const u of [...(parceiros ?? []), ...(entregadores ?? [])]) {
    if (!u.pix_chave) continue
    await supabase.from('saques').insert({
      usuario_id: u.usuario_id,
      valor:      u.saldo,
      pix_chave:  u.pix_chave,
      status:     'processado',
    })
    await supabase.from('parceiros').update({ saldo: 0 }).eq('usuario_id', u.usuario_id)
    await supabase.from('entregadores').update({ saldo: 0 }).eq('usuario_id', u.usuario_id)
    processados++
  }

  return NextResponse.json({ ok: true, processados })
}
