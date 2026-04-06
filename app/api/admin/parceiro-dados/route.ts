import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validarTokenImpersonar } from '../impersonar/route'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest) {
  // Suporta dois modos: token assinado (impersonação) ou usuario_id direto (admin autenticado via middleware)
  const token      = req.nextUrl.searchParams.get('token')
  const usuario_id_param = req.nextUrl.searchParams.get('usuario_id')

  let usuario_id: string | null = null

  if (token) {
    // Valida o token HMAC — qualquer token inválido ou expirado é rejeitado
    usuario_id = validarTokenImpersonar(token)
    if (!usuario_id) {
      return NextResponse.json({ erro: 'Token inválido ou expirado.' }, { status: 401 })
    }
  } else if (usuario_id_param) {
    // Chamada direta do admin autenticado (middleware já verificou role=admin)
    usuario_id = usuario_id_param
  } else {
    return NextResponse.json({ erro: 'Parâmetro obrigatório ausente.' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('parceiros')
    .select('nome_fantasia, saldo, ativo')
    .eq('usuario_id', usuario_id)
    .single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
