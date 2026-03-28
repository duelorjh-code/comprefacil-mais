'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logout } from '@/lib/auth'
import { AZUL, DOURADO, RODAPE } from '@/lib/constants'

const MENU = [
  { href: '/admin',              icon: '📊', label: 'Dashboard'   },
  { href: '/admin/pedidos',      icon: '📦', label: 'Pedidos'     },
  { href: '/admin/parceiros',    icon: '🏪', label: 'Parceiros'   },
  { href: '/admin/produtos',     icon: '🛒', label: 'Produtos'    },
  { href: '/admin/estoque',      icon: '📦', label: 'Estoque'     },
  { href: '/admin/entregadores', icon: '🛵', label: 'Entregadores'},
  { href: '/admin/clientes',     icon: '👥', label: 'Clientes'    },
  { href: '/admin/alertas',      icon: '🔔', label: 'Alertas'     },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [sidebarAberta, setSidebarAberta] = useState(false)
  const [alertas, setAlertas]             = useState(0)
  const audioRef = useRef<HTMLAudioElement|null>(null)

  const tocarAlarme = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/sons/alerta.mp3')
    }
    audioRef.current.play().catch(() => {})
  }, [])

  useEffect(() => {
    // Busca alertas iniciais
    supabase.from('alertas_admin').select('id', { count: 'exact', head: true })
      .eq('resolvido', false).then(({ count }) => setAlertas(count ?? 0))

    // Realtime alertas
    const canal = supabase
      .channel('admin-alertas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertas_admin' }, () => {
        setAlertas(v => v + 1)
        tocarAlarme()
      })
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [tocarAlarme])

  async function handleLogout() {
    await logout()
    router.replace('/')
  }

  return (
    <div style={s.root}>
      {/* Overlay mobile */}
      {sidebarAberta && (
        <div style={s.overlay} onClick={() => setSidebarAberta(false)} />
      )}

      {/* Sidebar */}
      <aside style={{ ...s.sidebar, transform: sidebarAberta ? 'translateX(0)' : undefined }}>
        {/* Logo */}
        <div style={s.sidebarLogo}>
          <img src="/logo.png" alt="CompreFácil+" style={s.logo} />
          <span style={s.adminBadge}>ADMIN</span>
        </div>

        {/* Menu */}
        <nav style={s.nav}>
          {MENU.map(item => {
            const ativo = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <button key={item.href}
                onClick={() => { router.push(item.href); setSidebarAberta(false) }}
                style={{ ...s.navItem, ...(ativo ? s.navAtivo : {}) }}>
                <span style={s.navIcone}>{item.icon}</span>
                <span style={s.navLabel}>{item.label}</span>
                {item.href === '/admin/alertas' && alertas > 0 && (
                  <span style={s.badge} className="anim-blink">{alertas}</span>
                )}
              </button>
            )
          })}
        </nav>

        <button onClick={handleLogout} style={s.btnSair}>
          🚪 Sair
        </button>

        <p style={s.rodape}>{RODAPE}</p>
      </aside>

      {/* Conteúdo */}
      <div style={s.main}>
        {/* Topbar mobile */}
        <header style={s.topbar}>
          <button onClick={() => setSidebarAberta(v => !v)} style={s.menuBtn}>☰</button>
          <img src="/logo.png" alt="CompreFácil+" style={s.topLogo} />
          <div style={s.topRight}>
            {alertas > 0 && <span style={s.topBadge} className="anim-blink">{alertas} 🔔</span>}
          </div>
        </header>

        <div style={s.content}>
          {children}
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', minHeight: '100vh', fontFamily: "'Nunito', sans-serif" },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 },
  sidebar: {
    width: 240, background: AZUL,
    display: 'flex', flexDirection: 'column',
    position: 'fixed', top: 0, left: 0, bottom: 0,
    zIndex: 50, transition: 'transform 0.25s ease',
  },
  sidebarLogo: {
    padding: '24px 20px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  logo: { height: 36, objectFit: 'contain' },
  adminBadge: {
    alignSelf: 'flex-start', background: DOURADO,
    color: '#fff', fontSize: 10, fontWeight: 800,
    padding: '2px 8px', borderRadius: 6, letterSpacing: '0.08em',
  },
  nav: { flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '11px 14px', borderRadius: 10, border: 'none',
    background: 'transparent', color: 'rgba(255,255,255,0.65)',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    width: '100%', textAlign: 'left' as const,
    transition: 'background 0.15s, color 0.15s', fontFamily: 'inherit',
    position: 'relative',
  },
  navAtivo: { background: 'rgba(255,255,255,0.12)', color: '#fff' },
  navIcone: { fontSize: 16 },
  navLabel: { flex: 1 },
  badge: {
    background: '#EF4444', color: '#fff', fontSize: 11,
    fontWeight: 800, padding: '1px 7px', borderRadius: 20,
    minWidth: 20, textAlign: 'center' as const,
  },
  btnSair: {
    margin: '12px', padding: '12px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, color: 'rgba(255,255,255,0.5)',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'background 0.15s',
  },
  rodape: {
    padding: '0 16px 20px', fontSize: 10,
    color: 'rgba(255,255,255,0.2)', lineHeight: 1.5, textAlign: 'center' as const,
  },
  main: { flex: 1, marginLeft: 240, display: 'flex', flexDirection: 'column', minHeight: '100vh' },
  topbar: {
    background: '#fff', borderBottom: '1px solid #E2E8F0',
    padding: '0 20px', height: 56, display: 'flex',
    alignItems: 'center', gap: 12, position: 'sticky',
    top: 0, zIndex: 30, display: 'none' as any,
  },
  menuBtn: { background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: AZUL },
  topLogo: { height: 30, objectFit: 'contain' },
  topRight: { flex: 1, display: 'flex', justifyContent: 'flex-end' },
  topBadge: {
    background: '#EF4444', color: '#fff', fontSize: 12,
    fontWeight: 800, padding: '3px 10px', borderRadius: 20,
  },
  content: { flex: 1, padding: '28px 24px', background: '#F4F6FB' },
}
