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
    // Verifica sessão do usuário
    const supabase = createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

    // Verifica se é parceiro
    const { data: perfil } = await admin.from('perfis').select('role').eq('id', user.id).single()
    if (!perfil || !['parceiro', 'admin'].includes(perfil.role)) {
      return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
    }

    // Busca o parceiro_id
    let parceiro_id: string
    const body = await req.json()

    if (perfil.role === 'admin') {
      parceiro_id = body.parceiro_id
    } else {
      const { data: p } = await admin.from('parceiros').select('id').eq('usuario_id', user.id).single()
      if (!p) return NextResponse.json({ erro: 'Parceiro não encontrado.' }, { status: 404 })
      parceiro_id = p.id
    }

    const { alterados } = body
    const status = perfil.role === 'admin' ? 'aprovado' : 'pendente'

    // Busca estoque atual do parceiro
    const { data: estoqueAtual } = await admin.from('estoque')
      .select('id, produto_id')
      .eq('parceiro_id', parceiro_id)

    const mapaEstoque: Record<string, string> = {}
    ;(estoqueAtual ?? []).forEach((e: any) => { mapaEstoque[e.produto_id] = e.id })

    // Salva cada item alterado
    const resultados = await Promise.all(
      Object.entries(alterados).map(async ([prodId, vals]: [string, any]) => {
        const estoqueId = mapaEstoque[prodId]
        if (estoqueId) {
          const { error } = await admin.from('estoque').update({
            preco: vals.preco,
            quantidade: vals.quantidade,
            status_aprovacao: status,
          }).eq('id', estoqueId)
          return { prodId, ok: !error, erro: error?.message }
        } else if (vals.preco > 0 || vals.quantidade > 0) {
          const { error } = await admin.from('estoque').insert({
            parceiro_id,
            produto_id: prodId,
            preco: vals.preco,
            quantidade: vals.quantidade,
            ativo: true,
            status_aprovacao: status,
          })
          return { prodId, ok: !error, erro: error?.message }
        }
        return { prodId, ok: true }
      })
    )

    const erros = resultados.filter(r => !r.ok)
    if (erros.length > 0) {
      return NextResponse.json({ erro: 'Alguns itens falharam.', detalhes: erros }, { status: 207 })
    }

    return NextResponse.json({ ok: true, salvos: resultados.length, status })
  } catch (e: any) {
    return NextResponse.json({ erro: e.message }, { status: 500 })
  }
}
