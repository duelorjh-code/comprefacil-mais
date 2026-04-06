import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { gerarTokenImpersonar } from '@/lib/impersonar'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { usuario_id } = await req.json()
    if (!usuario_id) return NextResponse.json({ erro: 'usuario_id obrigatório' }, { status: 400 })

    const { data: perfil } = await admin
      .from('perfis')
      .select('role, nome')
      .eq('id', usuario_id)
      .single()

    if (!perfil || perfil.role !== 'parceiro') {
      return NextResponse.json({ erro: 'Usuário não é parceiro' }, { status: 400 })
    }

    const token = gerarTokenImpersonar(usuario_id)
    const base  = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.comprefacilmais.com'
    const url   = `${base}/parceiro?impersonar=${token}`
    return NextResponse.json({ url })
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
