import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest) {
  const cidade = req.nextUrl.searchParams.get('cidade') ?? 'tl'
  const suffix = cidade === 'b' ? '_b' : ''
  const { data, error } = await admin
    .from(`perfis${suffix}`)
    .select(`
id, nome, telefone, bloqueado, role, criado_em
    `)
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Filtra apenas perfis com role = 'cliente'
  const filtrado = (data ?? []).filter((c: any) => c.role === 'cliente')

  return NextResponse.json({ data: filtrado })
}
