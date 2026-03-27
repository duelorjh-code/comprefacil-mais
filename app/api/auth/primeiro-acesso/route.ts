import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { telefone, senha } = await req.json()
    const tel   = telefone.replace(/\D/g, '')
    const email = `${tel}@cfm.app`

    // Verifica se é parceiro com primeiro_acesso = true
    const { data: perfil } = await supabaseAdmin
      .from('perfis')
      .select('id, role, primeiro_acesso')
      .eq('telefone', tel)
      .eq('role', 'parceiro')
      .single()

    if (!perfil) {
      return NextResponse.json({ erro: 'Telefone não encontrado ou não é parceiro.' }, { status: 400 })
    }

    if (!perfil.primeiro_acesso) {
      return NextResponse.json({ erro: 'Senha já foi definida. Use o login normal.' }, { status: 400 })
    }

    // Busca o usuário no Auth pelo email
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
    const user = (listData?.users ?? []).find((u: any) => u.email === email)

    if (!user) {
      return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 400 })
    }

    // Atualiza a senha via service role — sem autenticar antes
    const { error: errSenha } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: senha,
    })

    if (errSenha) {
      return NextResponse.json({ erro: 'Erro ao definir senha.' }, { status: 400 })
    }

    // Marca primeiro_acesso como false
    await supabaseAdmin.from('perfis').update({ primeiro_acesso: false }).eq('id', perfil.id)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ erro: e.message }, { status: 500 })
  }
}
