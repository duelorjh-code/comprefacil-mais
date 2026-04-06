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

    // Busca direta pelo email usando filtro — evita carregar todos os usuários
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

    // Busca paginada até encontrar o usuário
    let user = (data?.users ?? []).find((u: any) => u.email === email)

    if (!user) {
      // Segunda página caso haja mais de 1000 usuários
      let page = 2
      while (!user) {
        const { data: next } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
        if (!next?.users?.length) break
        user = next.users.find((u: any) => u.email === email)
        if (next.users.length < 1000) break
        page++
      }
    }

    if (!user) {
      return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
    }

    const { error: errSenha } = await supabase.auth.admin.updateUserById(user.id, {
      password: nova_senha,
    })

    if (errSenha) {
      return NextResponse.json({ erro: errSenha.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
