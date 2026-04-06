import { supabase } from './supabase'

export type UserRole = 'cliente' | 'entregador' | 'parceiro' | 'admin'

export interface Perfil {
  id: string
  telefone: string
  nome: string
  role: UserRole
  primeiro_acesso: boolean
  bloqueado: boolean
  motivo_bloqueio?: string
}

// ── helpers ────────────────────────────────────────────────────
export function limparTelefone(v: string) { return v.replace(/\D/g, '') }

export function formatTelefone(v: string): string {
  const nums = limparTelefone(v)
  if (nums.length <= 10) {
    return nums.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return nums.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
}

export function redirecionarPorRole(role: UserRole): string {
  const mapa: Record<UserRole, string> = {
    admin:      '/admin',
    parceiro:   '/parceiro',
    entregador: '/entregador',
    cliente:    '/vitrine',
  }
  return mapa[role] ?? '/login'
}

function telefoneParaEmail(tel: string) {
  return `${limparTelefone(tel)}@cfm.app`
}

// ── login ──────────────────────────────────────────────────────
export async function login(telefone: string, senha: string) {
  const email = telefoneParaEmail(telefone)

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })

  if (error || !data.user) {
    return { sucesso: false, erro: error?.message || 'Telefone ou senha incorretos.' }
  }

  const { data: perfil, error: errPerfil } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', data.user.id)
    .single()

  if (errPerfil || !perfil) {
    await supabase.auth.signOut()
    return { sucesso: false, erro: 'Perfil não encontrado. Contate o suporte.' }
  }

  if (perfil.bloqueado) {
    await supabase.auth.signOut()
    return { sucesso: false, erro: 'BLOQUEADO', motivo: perfil.motivo_bloqueio }
  }

  if (!perfil.ativo) {
    await supabase.auth.signOut()
    return { sucesso: false, erro: 'Conta desativada. Contate o suporte.' }
  }

  return { sucesso: true, perfil: perfil as Perfil }
}

// ── cadastro cliente ───────────────────────────────────────────
export async function cadastrarCliente(dados: {
  nome: string
  telefone: string
  senha: string
}) {
  const tel   = limparTelefone(dados.telefone)
  const email = telefoneParaEmail(tel)

  const { data, error } = await supabase.auth.signUp({
    email,
    password: dados.senha,
    options: {
      emailRedirectTo: undefined
    }
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { sucesso: false, erro: 'Este telefone já está cadastrado.' }
    }
    return { sucesso: false, erro: error.message }
  }

  if (!data.user) return { sucesso: false, erro: 'Erro inesperado. Tente novamente.' }

  const { error: errPerfil } = await supabase.from('perfis').insert({
    id: data.user.id,
    telefone: tel,
    nome: dados.nome.trim(),
    role: 'cliente',
  })

  if (errPerfil) return { sucesso: false, erro: errPerfil.message }

  const { error: errCliente } = await supabase.from('clientes').insert({
    usuario_id: data.user.id
  })

  if (errCliente) return { sucesso: false, erro: errCliente.message }

  return { sucesso: true }
}

// ── cadastro entregador ────────────────────────────────────────
export async function cadastrarEntregador(dados: {
  nome: string
  telefone: string
  cpf: string
  tipo_veiculo: 'moto' | 'ebike'
  senha: string
  documento_file: File
}) {
  const tel   = limparTelefone(dados.telefone)
  const cpf   = dados.cpf.replace(/\D/g, '')
  const email = telefoneParaEmail(tel)

  const { data, error } = await supabase.auth.signUp({
    email,
    password: dados.senha,
    options: {
      emailRedirectTo: undefined
    }
  })

  if (error) return { sucesso: false, erro: error.message }
  if (!data.user) return { sucesso: false, erro: 'Erro inesperado.' }

  const ext  = dados.documento_file.name.split('.').pop()
  const path = `${data.user.id}/documento.${ext}`

  const { error: errUpload } = await supabase.storage
    .from('documentos')
    .upload(path, dados.documento_file, { upsert: true })

  if (errUpload) return { sucesso: false, erro: errUpload.message }

  const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)

  const { error: errPerfil } = await supabase.from('perfis').insert({
    id: data.user.id,
    telefone: tel,
    nome: dados.nome.trim(),
    role: 'entregador',
  })

  if (errPerfil) return { sucesso: false, erro: errPerfil.message }

  const { error: errEnt } = await supabase.from('entregadores').insert({
    usuario_id: data.user.id,
    cpf,
    tipo_veiculo: dados.tipo_veiculo,
    documento_url: urlData.publicUrl,
    validado: false,
    status: 'offline',
  })

  if (errEnt) return { sucesso: false, erro: errEnt.message }

  return { sucesso: true }
}

// ── primeiro acesso parceiro ───────────────────────────────────
// Usa a API route /api/auth/primeiro-acesso (service_role) para evitar
// senha hardcoded no cliente. Esta função é mantida apenas como wrapper.
export async function primeiroAcessoParceiro(telefone: string, senha: string) {
  const res = await fetch('/api/auth/primeiro-acesso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefone, senha }),
  })
  const json = await res.json()
  if (!res.ok) return { sucesso: false, erro: json.erro ?? 'Erro ao definir senha.' }
  return { sucesso: true }
}

// ── logout ─────────────────────────────────────────────────────
export async function logout() {
  await supabase.auth.signOut()
}

// ── perfil atual ───────────────────────────────────────────────
export async function getPerfil(): Promise<Perfil | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', user.id)
    .single()

  return data as Perfil | null
}
