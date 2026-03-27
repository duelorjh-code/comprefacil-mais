import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Usa service role para criar usuários sem fazer logout do admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { email, password, role, nome, telefone } = await req.json()

    // Cria o usuário via Admin API — não faz logout do usuário atual
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? 'Erro ao criar usuário.' }, { status: 400 })
    }

    // Cria o perfil
    const { error: errPerfil } = await supabaseAdmin.from('perfis').insert({
      id:             data.user.id,
      telefone,
      nome,
      role,
      primeiro_acesso: true,
    })

    if (errPerfil) {
      return NextResponse.json({ error: errPerfil.message }, { status: 400 })
    }

    return NextResponse.json({ data: { user: data.user } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
