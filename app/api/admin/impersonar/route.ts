import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { usuario_id } = await req.json()
    if (!usuario_id) return NextResponse.json({ erro: 'usuario_id obrigatório' }, { status: 400 })

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: `${usuario_id}@cfm.app`,
    })

    // Busca o email real do usuário
    const { data: userData } = await admin.auth.admin.getUserById(usuario_id)
    const email = userData?.user?.email

    if (!email) return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 404 })

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json({ erro: linkError?.message ?? 'Erro ao gerar link' }, { status: 500 })
    }

    return NextResponse.json({ url: linkData.properties.action_link })
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
