import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validarTokenImpersonar } from '../impersonar/route'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ erro: 'Token obrigatório.' }, { status: 400 })

  const usuario_id = validarTokenImpersonar(token)
  if (!usuario_id) return NextResponse.json({ erro: 'Token inválido ou expirado.' }, { status: 401 })

  const { data, error } = await admin
    .from('parceiros')
    .select('id')
    .eq('usuario_id', usuario_id)
    .single()

  if (error || !data) return NextResponse.json({ erro: 'Parceiro não encontrado.' }, { status: 404 })
  return NextResponse.json({ parceiro_id: data.id })
}
