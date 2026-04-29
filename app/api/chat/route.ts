import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import * as nodemailer from 'nodemailer'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'comprefacilmais@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

// GET — buscar conversa entre dois usuários
export async function GET(req: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const para_id = req.nextUrl.searchParams.get('para_id')
  if (!para_id) return NextResponse.json({ erro: 'para_id obrigatório' }, { status: 400 })

  const meuId = session.user.id

  // Buscar mensagens da conversa
  const { data, error } = await admin
    .from('mensagens')
    .select('*')
    .or(`and(de_id.eq.${meuId},para_id.eq.${para_id}),and(de_id.eq.${para_id},para_id.eq.${meuId})`)
    .order('criado_em', { ascending: true })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Marcar como lidas as mensagens recebidas
  await admin.from('mensagens')
    .update({ lida: true })
    .eq('para_id', meuId)
    .eq('de_id', para_id)
    .eq('lida', false)

  return NextResponse.json({ data })
}

// POST — enviar mensagem
export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { para_id, texto } = await req.json()
  if (!para_id || !texto?.trim()) return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })

  const meuId = session.user.id

  // Buscar dados dos dois usuários
  const { data: perfis } = await admin
    .from('perfis')
    .select('id, nome, role')
    .in('id', [meuId, para_id])

  const eu   = perfis?.find(p => p.id === meuId)
  const para = perfis?.find(p => p.id === para_id)

  if (!eu || !para) return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 404 })

  // Salvar mensagem
  const { error } = await admin.from('mensagens').insert({
    de_id: meuId, para_id, texto: texto.trim(),
  })
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Enviar email de cópia
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Campo_Grande' })
  try {
    await transporter.sendMail({
      from: '"CompreFácil+ Chat" <comprefacilmais@gmail.com>',
      to: 'comprefacilmais@gmail.com',
      subject: `💬 Nova mensagem — ${eu.nome} → ${para.nome}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px">
          <h2 style="color:#1B2F5E">💬 Nova Mensagem — CompreFácil+</h2>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;color:#666;width:120px">De:</td>
                <td style="padding:8px;font-weight:bold">${eu.nome} <span style="color:#888;font-weight:normal">(${eu.role})</span></td></tr>
            <tr><td style="padding:8px;color:#666">Para:</td>
                <td style="padding:8px;font-weight:bold">${para.nome} <span style="color:#888;font-weight:normal">(${para.role})</span></td></tr>
            <tr><td style="padding:8px;color:#666">Data:</td>
                <td style="padding:8px">${agora}</td></tr>
          </table>
          <div style="background:#F4F6FB;border-left:4px solid #1B2F5E;padding:16px;border-radius:8px;font-size:15px">
            ${texto.trim()}
          </div>
          <p style="color:#aaa;font-size:12px;margin-top:20px">CompreFácil+ · Sistema de Chat Interno</p>
        </div>
      `,
    })
  } catch (e) {
    // Email falhou mas mensagem foi salva — não bloqueia
    console.error('Email erro:', e)
  }

  return NextResponse.json({ ok: true })
}
