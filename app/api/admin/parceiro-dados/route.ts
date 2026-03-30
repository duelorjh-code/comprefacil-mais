import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest) {
  const usuario_id = req.nextUrl.searchParams.get('usuario_id')
  if (!usuario_id) return NextResponse.json({ erro: 'usuario_id obrigatório' }, { status: 400 })

  const { data, error } = await admin
    .from('parceiros')
    .select('nome_fantasia, saldo, ativo')
    .eq('usuario_id', usuario_id)
    .single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
