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

    // Verifica se o usuário existe e é parceiro
    const { data: perfil } = await admin
      .from('perfis')
      .select('role, nome')
      .eq('id', usuario_id)
      .single()

    if (!perfil || perfil.role !== 'parceiro') {
      return NextResponse.json({ erro: 'Usuário não é parceiro' }, { status: 400 })
    }

    const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.comprefacilmais.com'}/parceiro?as=${usuario_id}`
    return NextResponse.json({ url })
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
