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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Deixa rotas públicas passarem
  if (PUBLICAS.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name)           { return request.cookies.get(name)?.value },
        set(name, val, opt) { response.cookies.set({ name, value: val, ...opt }) },
        remove(name, opt)   { response.cookies.set({ name, value: '', ...opt }) },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Sem sessão → login
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Busca role do perfil
  const { data: perfil } = await supabase
    .from('perfis')
    .select('role, bloqueado')
    .eq('id', session.user.id)
    .single()

  // Sem perfil → logout e login
  if (!perfil) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Bloqueado
  if (perfil.bloqueado) {
    return NextResponse.redirect(new URL('/bloqueado', request.url))
  }

  // Verifica se a rota bate com o role
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|icons|sons|api).*)'],
}
