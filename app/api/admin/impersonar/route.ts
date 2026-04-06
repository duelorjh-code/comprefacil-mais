import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Gera token assinado HMAC-SHA256 com expiração de 15 minutos
function gerarToken(usuario_id: string): string {
  const exp     = Date.now() + 15 * 60 * 1000
  const payload = `${usuario_id}:${exp}`
  const secret  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const sig     = createHmac('sha256', secret).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function validarTokenImpersonar(token: string): string | null {
  try {
    const decoded  = Buffer.from(token, 'base64url').toString('utf8')
    const partes   = decoded.split(':')
    if (partes.length !== 3) return null
    const [usuario_id, expStr, sig] = partes
    const exp      = parseInt(expStr, 10)
    if (Date.now() > exp) return null
    const payload  = `${usuario_id}:${expStr}`
    const secret   = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const expected = createHmac('sha256', secret).update(payload).digest('hex')
    const a = Buffer.from(sig,      'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    return usuario_id
  } catch {
    return null
  }
}

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

    const token = gerarToken(usuario_id)
    const base  = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.comprefacilmais.com'
    const url   = `${base}/parceiro?impersonar=${token}`
    return NextResponse.json({ url })
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
