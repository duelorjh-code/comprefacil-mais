import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { telefone, nova_senha } = await req.json()
    if (!telefone || !nova_senha || nova_senha.length < 6) {
      return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
    }

    const tel   = telefone.replace(/\D/g, '')
    const email = `${tel}@cfm.app`

    const { data: users } = await supabase.auth.admin.listUsers()
    const user = users?.users?.find(u => u.email === email)

    if (!user) {
      return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
    }

    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: nova_senha,
    })

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
