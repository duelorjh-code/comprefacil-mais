'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logout } from '@/lib/auth'
import Chat from '@/app/components/Chat'
import { AZUL, DOURADO, linkWhats } from '@/lib/constants'

const MENU = [
  { href: '/parceiro',            icon: '📦', label: 'Pedidos'    },
  { href: '/parceiro/estoque',    icon: '🛒', label: 'Estoque'    },
  { href: '/parceiro/financeiro', icon: '💰', label: 'Financeiro' },
  { href: '/parceiro/historico',  icon: '📋', label: 'Histórico'  },
]

export default function ParceiroLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [loja, setLoja]   = useState('')
  const [saldo, setSaldo] = useState(0)
  const [aberto, setAberto] = useState(false)
  const [online, setOnline] = useState(false)
  const [parcId, setParcId] = useState('')
  const [toggling, setToggling] = useState(false)
  const [adminId, setAdminId]   = useState('')
  const [meuId, setMeuId]       = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    async function carregar() {
      const params        = new URLSearchParams(window.location.search)
      const tokenParam    = params.get('impersonar')

      // Limpa params da URL sem recarregar a página
      if (tokenParam) {
        const url = new URL(window.location.href)
        url.searchParams.delete('impersonar')
        window.history.replaceState({}, '', url.toString())
      }

      // Persiste o token no sessionStorage para navegações internas
      if (tokenParam) sessionStorage.setItem('parceiro_impersonar', tokenParam)
      const token = tokenParam ?? sessionStorage.getItem('parceiro_impersonar')

      if (token) {
        // Valida o token via API antes de usar — a API verifica HMAC e expiração
        const res  = await fetch(`/api/admin/parceiro-dados?token=${encodeURIComponent(token)}`)
        if (!res.ok) {
          // Token inválido ou expirado — limpa e redireciona para o login do admin
          sessionStorage.removeItem('parceiro_impersonar')
          router.replace('/admin')
          return
        }
        const json = await res.json()
        if (json.data) { setLoja(json.data.nome_fantasia); setSaldo(json.data.saldo ?? 0) }
        return
      }

      // Fluxo normal do parceiro
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: p } = await supabase
        .from('parceiros')
        .select('id, nome_fantasia, saldo, ativo')
        .eq('usuario_id', user.id)
        .single()
      if (p) { setLoja(p.nome_fantasia); setSaldo(p.saldo ?? 0); setOnline(p.ativo ?? false); setParcId(p.id ?? '') }
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setMeuId(user.id)
      // Buscar admin da cidade do parceiro
      const { data: adm } = await supabase.from('perfis').select('id').eq('role', 'admin').single()
      if (adm) setAdminId(adm.id)
    }
    carregar()

    const canal = supabase.channel('parceiro-layout')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, () => {
        try { audioRef.current?.play().catch(() => {}) } catch {}
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  async function handleLogout() {
    sessionStorage.removeItem('parceiro_impersonar')
    await logout()
    router.replace('/')
  }

  async function toggleOnline() {
    if (!parcId) return
    setToggling(true)
    const novoStatus = !online
    await supabase.from('parceiros').update({ ativo: novoStatus }).eq('id', parcId)
    setOnline(novoStatus)
    setToggling(false)
  }

  const isAtivo = (href: string) =>
    href === '/parceiro' ? pathname === '/parceiro' : pathname.startsWith(href)

  return (
    <div style={s.shell}>
      <audio ref={audioRef} src="/sons/alerta.mp3" preload="auto" />

      <aside style={s.sidebar}>
        <div style={s.brand}>
          <img src="/logo.png" alt="CompreFácil+" style={s.logo} />
          <div style={s.divider} />
          <div style={s.lojaWrap}>
            <div style={s.lojaNome}>{loja || '...'}</div>
            <button onClick={toggleOnline} disabled={toggling} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: online ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              border: `1px solid ${online ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
              borderRadius: 20, padding: '5px 12px', cursor: 'pointer',
              fontFamily: 'inherit', marginTop: 6,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: online ? '#22C55E' : '#EF4444',
                boxShadow: online ? '0 0 6px #22C55E' : 'none',
              }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: online ? '#22C55E' : '#EF4444' }}>
                {toggling ? '...' : online ? 'ONLINE' : 'OFFLINE'}
              </span>
            </button>
          </div>
        </div>

        <div style={s.saldoBox}>
          <div style={s.saldoLabel}>Saldo disponível</div>
          <div style={s.saldoValor}>R$ {saldo.toFixed(2).replace('.', ',')}</div>
        </div>

        <nav style={s.nav}>
          {MENU.map(item => {
            const ativo = isAtivo(item.href)
            return (
              <button key={item.href} onClick={() => { router.push(item.href); setAberto(false) }}
                style={{ ...s.menuItem, ...(ativo ? s.menuAtivo : {}) }}>
                <span style={s.menuIcon}>{item.icon}</span>
                <span style={{ ...s.menuLabel, color: ativo ? DOURADO : 'rgba(255,255,255,0.75)' }}>{item.label}</span>
                {ativo && <div style={s.menuBarra} />}
              </button>
            )
          })}
        </nav>

        <div style={s.sideFooter}>
          <a href={linkWhats('Olá, sou parceiro CompreFácil+ e preciso de ajuda.')}
            target="_blank" rel="noreferrer" style={s.btnWhats}>
            💬 Falar com Admin
          </a>
          <button onClick={handleLogout} style={s.btnSair}>
            🚪 Sair da conta
          </button>
          <p style={s.copy}>© 2026 CompreFácil+</p>
        </div>
      </aside>

      {aberto && <div style={s.overlay} onClick={() => setAberto(false)} />}

      <div style={s.main}>
        <header style={s.topbar}>
          <button onClick={() => setAberto(!aberto)} style={s.burger}>☰</button>
          <img src="/logo.png" alt="CompreFácil+" style={s.topLogo} />
          <div style={{ flex: 1 }} />
          <div style={s.topLoja}>
            <span style={s.topLojaNome}>{loja}</span>
            <span style={s.topDot} />
          </div>
        </header>
        <div style={s.content}>{children}</div>
      </div>
    </div>
  )
}

const SIDEBAR_W = 220

const s: Record<string, React.CSSProperties> = {
  shell:      { display: 'flex', minHeight: '100vh', fontFamily: "'Nunito', sans-serif", background: '#F4F6FB' },
  sidebar:    { width: SIDEBAR_W, background: AZUL, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, overflowY: 'auto' },
  brand:      { padding: '20px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  logo:       { height: 32, objectFit: 'contain', display: 'block', marginBottom: 12 },
  divider:    { height: 1, background: 'rgba(255,255,255,0.1)', marginBottom: 12 },
  lojaWrap:   { display: 'flex', flexDirection: 'column', gap: 4 },
  lojaNome:   { fontSize: 16, fontWeight: 800, color: DOURADO, lineHeight: 1.2 },
  lojaBadge:  { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 },
  dot:        { width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 },
  saldoBox:   { margin: '12px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)' },
  saldoLabel: { fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  saldoValor: { fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 2 },
  nav:        { flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 },
  menuItem:   { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', textAlign: 'left' as const, fontFamily: 'inherit', position: 'relative', transition: 'background 0.15s' },
  menuAtivo:  { background: 'rgba(255,255,255,0.1)' },
  menuIcon:   { fontSize: 18, flexShrink: 0 },
  menuLabel:  { fontSize: 14, fontWeight: 700 },
  menuBarra:  { position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, borderRadius: 3, background: DOURADO },
  sideFooter: { padding: '12px 14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 },
  btnWhats:   { display: 'block', padding: '10px', background: 'rgba(37,211,102,0.15)', color: '#25D366', borderRadius: 10, textAlign: 'center' as const, fontSize: 13, fontWeight: 700, textDecoration: 'none', border: '1px solid rgba(37,211,102,0.25)' },
  btnSair:    { padding: '10px', background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' },
  copy:       { fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center' as const, marginTop: 4 },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 },
  main:       { flex: 1, marginLeft: SIDEBAR_W, display: 'flex', flexDirection: 'column', minHeight: '100vh' },
  topbar:     { background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 30, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' },
  burger:     { background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: AZUL, padding: 0 },
  topLogo:    { height: 26, objectFit: 'contain' },
  topLoja:    { display: 'flex', alignItems: 'center', gap: 8 },
  topLojaNome:{ fontSize: 13, fontWeight: 800, color: AZUL },
  topDot:     { width: 8, height: 8, borderRadius: '50%', background: '#22C55E' },
  content:    { flex: 1, padding: '24px 24px', overflowY: 'auto' as const },
}
