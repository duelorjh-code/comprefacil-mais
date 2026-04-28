import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  const body = await req.json()
  const {
    nome_completo, nome_fantasia, telefone, cnpj_cpf,
    cep, endereco, numero, complemento, bairro, cidade, estado,
    pix_chave, pix_tipo, categorias,
    horario_abertura, horario_fechamento,
  } = body

  // Validação básica
  if (!nome_completo || !telefone || !cnpj_cpf || !categorias?.length) {
    return NextResponse.json({ erro: 'Campos obrigatórios não preenchidos.' }, { status: 400 })
  }

  const tel = telefone.replace(/\D/g, '')

  // Salvar pré-cadastro na tabela parceiros_pre_cadastro
  const { data, error } = await admin
    .from('parceiros_pre_cadastro')
    .insert({
      nome_completo,
      nome_fantasia,
      telefone: tel,
      cnpj_cpf: cnpj_cpf.replace(/\D/g, ''),
      cep: cep?.replace(/\D/g, '') || '',
      endereco,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      pix_chave,
      pix_tipo,
      categorias,
      horario_abertura: horario_abertura || '08:00',
      horario_fechamento: horario_fechamento || '22:00',
      status: 'pendente',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  // Montar mensagem para o Admin via WhatsApp
  const whatsAdmin = process.env.NEXT_PUBLIC_WHATS_ADMIN ?? '5567991709363'
  const ramos = categorias.join(', ')
  const msgAdmin = `🔔 *NOVO PARCEIRO AGUARDA ANÁLISE*\n\n👤 *${nome_fantasia || nome_completo}*\n📞 ${tel}\n🏷️ Ramos: ${ramos}\n📍 ${cidade} - ${estado}\n\nAcesse o painel Admin para analisar e ativar o cadastro.`
  const linkAdmin = `https://wa.me/${whatsAdmin}?text=${encodeURIComponent(msgAdmin)}`

  return NextResponse.json({ sucesso: true, id: data.id, linkAdmin })
}
