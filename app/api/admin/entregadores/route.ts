import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest) {
  const cidade = req.nextUrl.searchParams.get('cidade') ?? 'tl'
  const suffix = cidade === 'b' ? '_b' : ''
  const { data, error } = await admin
    .from(`entregadores${suffix}`)
    .select(`
      id, cpf, tipo_veiculo, status, validado, lat_atual, lng_atual, usuario_id, criado_em,
      perfis:usuario_id ( id, nome, telefone, bloqueado, motivo_bloqueio )
    `)
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  try {
    const { acao, id, usuario_id, status, validado, bloqueado } = await req.json()

    if (acao === 'toggleOnline') {
      const novo = status === 'online' ? 'offline' : 'online'
      const { error } = await admin.from('entregadores').update({ status: novo }).eq('id', id)
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (acao === 'validar') {
      const { error } = await admin.from('entregadores').update({ validado }).eq('id', id)
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (acao === 'bloquear') {
      const { error } = await admin.from('perfis').update({
        bloqueado: !bloqueado,
        motivo_bloqueio: !bloqueado ? 'Bloqueado pelo Admin.' : null,
      }).eq('id', usuario_id)
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 })
  } catch (err) {
    console.error('Erro admin/entregadores POST:', err)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
