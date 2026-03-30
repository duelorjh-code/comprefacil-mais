import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  // Cria client novo a cada request para evitar réplica cacheada
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await admin
    .from('pedidos')
    .select(`
      id, status, total, distancia_km, codigo_confirmacao, criado_em, endereco_entrega,
      clientes (
        perfis:usuario_id ( nome, telefone )
      ),
      parceiros ( nome_fantasia ),
      entregadores (
        perfis:usuario_id ( nome )
      )
    `)
    .order('criado_em', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return new NextResponse(JSON.stringify({ data, ts: Date.now() }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    }
  })
}
