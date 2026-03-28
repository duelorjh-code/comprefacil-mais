import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET() {
  const { data, error } = await admin
    .from('estoque')
    .select(`
      id, preco, quantidade,
      produtos ( id, nome, categoria, imagem_url, unidade_medida, ativo ),
      parceiros ( id, lat, lng, ativo, nome_fantasia )
    `)
    .eq('ativo', true)
    .gt('preco', 0)
    .gt('quantidade', 0)
    .eq('status_aprovacao', 'aprovado')

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  const filtrado = (data ?? []).filter((e: any) => e.produtos?.ativo && e.parceiros?.ativo)

  return NextResponse.json({ data: filtrado })
}
