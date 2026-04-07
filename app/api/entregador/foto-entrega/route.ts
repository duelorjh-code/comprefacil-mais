import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = createSupabaseServer()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

    const { data: entregador } = await admin
      .from('entregadores').select('id').eq('usuario_id', user.id).single()
    if (!entregador) return NextResponse.json({ erro: 'Entregador não encontrado.' }, { status: 403 })

    const form    = await req.formData()
    const foto    = form.get('foto') as File
    const pedidoId = form.get('pedido_id') as string

    if (!foto || !pedidoId) return NextResponse.json({ erro: 'Dados incompletos.' }, { status: 400 })

    // Verifica que o pedido pertence ao entregador
    const { data: pedido } = await admin
      .from('pedidos')
      .select('id, entregador_id, status')
      .eq('id', pedidoId)
      .eq('entregador_id', entregador.id)
      .single()

    if (!pedido) return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 })
    if (pedido.status !== 'a_caminho') return NextResponse.json({ erro: 'Pedido não está em entrega.' }, { status: 400 })

    const ext  = foto.name.split('.').pop() ?? 'jpg'
    const path = `${pedidoId}/comprovante.${ext}`

    const { error: errUpload } = await admin.storage
      .from('entregas')
      .upload(path, foto, { upsert: true, contentType: foto.type })

    if (errUpload) return NextResponse.json({ erro: errUpload.message }, { status: 500 })

    const { data: urlData } = admin.storage.from('entregas').getPublicUrl(path)

    await admin.from('pedidos')
      .update({ foto_entrega_url: urlData.publicUrl })
      .eq('id', pedidoId)

    return NextResponse.json({ ok: true, url: urlData.publicUrl })
  } catch (err) {
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
