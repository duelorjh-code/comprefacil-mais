import { createServerClient } from '@supabase/ssr'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'

const PUBLICAS = ['/', '/login', '/cadastro', '/parceiro/primeiro-acesso', '/bloqueado']

const ROTAS_ROLE: Record<string, string> = {
  '/admin':      'admin',
  '/parceiro':   'parceiro',
  '/entregador': 'entregador',
  '/vitrine':    'cliente',
  '/carrinho':   'cliente',
  '/pedido':     'cliente',
  '/perfil':     'cliente',
}

const API_ADMIN_PREFIXO   = '/api/admin/'
const API_ENTREGADOR_ACAO = '/api/entregador/acao'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLICAS.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string)                         { return request.cookies.get(name)?.value },
        set(name: string, val: string, opt: any)  { response.cookies.set({ name, value: val, ...opt }) },
        remove(name: string, opt: any)            { response.cookies.set({ name, value: '', ...opt }) },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // ── Proteção das rotas de API /api/admin/* ───────────────────
  if (pathname.startsWith(API_ADMIN_PREFIXO)) {
    if (!session) {
      return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
    }
    const { data: perfil } = await supabase
      .from('perfis')
      .select('role')
      .eq('id', session.user.id)
      .single()
    if (!perfil || perfil.role !== 'admin') {
      return NextResponse.json({ erro: 'Acesso negado.' }, { status: 403 })
    }
    return response
  }

  // ── Proteção da rota /api/entregador/acao ────────────────────
  if (pathname === API_ENTREGADOR_ACAO) {
    if (!session) {
      return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
    }
    const { data: perfil } = await supabase
      .from('perfis')
      .select('role')
      .eq('id', session.user.id)
      .single()
    if (!perfil || perfil.role !== 'entregador') {
      return NextResponse.json({ erro: 'Acesso negado.' }, { status: 403 })
    }
    return response
  }

  // ── Demais rotas de API: RLS do Supabase protege ─────────────
  if (pathname.startsWith('/api/')) {
    return response
  }

  // ── Rotas de página: exigem sessão ───────────────────────────
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: perfil } = await supabase
    .from('perfis')
    .select('role, bloqueado')
    .eq('id', session.user.id)
    .single()

  if (!perfil) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (perfil.bloqueado) {
    return NextResponse.redirect(new URL('/bloqueado', request.url))
  }

  const roleEsperado = Object.entries(ROTAS_ROLE).find(([rota]) =>
    pathname.startsWith(rota)
  )?.[1]

  if (roleEsperado && perfil.role !== roleEsperado && perfil.role !== 'admin') {
    const destinos: Record<string, string> = {
      admin:      '/admin',
      parceiro:   '/parceiro',
      entregador: '/entregador',
      cliente:    '/vitrine',
    }
    return NextResponse.redirect(new URL(destinos[perfil.role] ?? '/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|icons|sons).*)'],
}
