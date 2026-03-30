import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET() {
  const { data, error } = await admin
    .from('entregadores')
    .select(`
      id, cpf, tipo_veiculo, status, validado, lat_atual, lng_atual, usuario_id, criado_em,
      perfis:usuario_id ( id, nome, telefone, bloqueado, total_recusas, motivo_bloqueio )
    `)
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
