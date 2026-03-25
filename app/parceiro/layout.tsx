'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logout } from '@/lib/auth'
import { AZUL, DOURADO, RODAPE, linkWhats } from '@/lib/constants'

const MENU = [
  { href: '/parceiro',           icon: '📦', label: 'Pedidos'    },
  { href: '/parceiro/estoque',   icon: '🛒', label: 'Estoque'    },
  { href: '/parceiro/financeiro',icon: '💰', label: 'Financeiro' },
  { href: '/parceiro/historico', icon: '📋', label: 'Histórico'  },
]

export default function ParceiroLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [pedidosNovos, setPedidosNovos] = useState(0)
  const [sidebarAberta, setSidebarAberta] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const tocarAlarme = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio('/sons/alerta.mp3')
    audioRef.current.play().catch(() => {})
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('parceiros').select('id, nome_fantasia').eq('usuario_id', user.id).single()
      if (!p) return
      setNomeFantasia(p.nome_fantasia)

      // Contagem pedidos novos
      const { count } = await supabase.from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('parceiro_id', p.id)
        .eq('status', 'pago')
      setPedidosNovos(count ?? 0)

      // Realtime
      supabase.channel('parceiro-pedidos')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos', filter: `parceiro_id=eq.${p.id}` }, () => {
          setPedidosNovos(v => v + 1)
          tocarAlarme()
        })
        .subscribe()
    }
    init()
  }, [tocarAlarme])

  async function handleLogout() { await logout(); router.replace('/') }

  return (
    <div style={s.root}>
      {sidebarAberta && <div style={s.overlay} onClick={() => setSidebarAberta(false)} />}

      <aside style={{ ...s.sidebar, ...(sidebarAberta ? {} : s.sidebarHidden) }}>
        <div style={s.logoWrap}>
          <img src="/logo.png" alt="CompreFácil+" style={s.logo} />
          {nomeFantasia && <span style={s.nomeParceiro}>{nomeFantasia}</span>}
        </div>

        <nav style={s.nav}>
          {MENU.map(item => {
            const ativo = pathname === item.href || (item.href !== '/parceiro' && pathname.startsWith(item.href))
            return (
              <button key={item.href}
                onClick={() => { router.push(item.href); setSidebarAberta(false) }}
                style={{ ...s.navItem, ...(ativo ? s.navAtivo : {}) }}>
                <span>{item.icon}</span>
                <span style={s.navLabel}>{item.label}</span>
                {item.href === '/parceiro' && pedidosNovos > 0 && (
                  <span style={s.badge} className="anim-blink">{pedidosNovos}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div style={s.sidebarBottom}>
          <a href={linkWhats('Olá, sou parceiro CompreFácil+ e preciso de ajuda.')}
            target="_blank" rel="noreferrer" style={s.btnWhats}>
            💬 Falar com Admin
          </a>
          <button onClick={handleLogout} style={s.btnSair}>🚪 Sair</button>
        </div>

        <p style={s.rodape}>{RODAPE}</p>
      </aside>

      <div style={s.main}>
        <header style={s.topbar}>
          <button onClick={() => setSidebarAberta(v => !v)} style={s.menuBtn}>☰</button>
          <img src="/logo.png" alt="CompreFácil+" style={s.topLogo} />
          {pedidosNovos > 0 && (
            <span style={s.topBadge} className="anim-blink">{pedidosNovos} novo{pedidosNovos > 1 ? 's' : ''}</span>
          )}
        </header>
        <div style={s.content}>{children}</div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display:'flex', minHeight:'100vh', fontFamily:"'Nunito', sans-serif" },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:40 },
  sidebar: { width:230, background:AZUL, display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:50, transition:'transform 0.25s' },
  sidebarHidden: {},
  logoWrap: { padding:'22px 18px 16px', borderBottom:'1px solid rgba(255,255,255,0.1)', display:'flex', flexDirection:'column', gap:6 },
  logo: { height:34, objectFit:'contain', filter:'brightness(0) invert(1)' },
  nomeParceiro: { fontSize:12, color:DOURADO, fontWeight:700 },
  nav: { flex:1, padding:'14px 10px', display:'flex', flexDirection:'column', gap:3 },
  navItem: { display:'flex', alignItems:'center', gap:10, padding:'11px 12px', borderRadius:10, border:'none', background:'transparent', color:'rgba(255,255,255,0.6)', fontSize:14, fontWeight:600, cursor:'pointer', width:'100%', textAlign:'left' as const, fontFamily:'inherit', transition:'background 0.15s', position:'relative' },
  navAtivo: { background:'rgba(255,255,255,0.12)', color:'#fff' },
  navLabel: { flex:1 },
  badge: { background:'#EF4444', color:'#fff', fontSize:11, fontWeight:800, padding:'1px 7px', borderRadius:20 },
  sidebarBottom: { padding:'0 12px 12px', display:'flex', flexDirection:'column', gap:8 },
  btnWhats: { display:'block', padding:'11px', background:'#25D36620', color:'#25D366', borderRadius:10, textAlign:'center' as const, fontSize:13, fontWeight:700, textDecoration:'none', border:'1px solid #25D36630' },
  btnSair: { padding:'10px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color:'rgba(255,255,255,0.5)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  rodape: { padding:'0 14px 16px', fontSize:10, color:'rgba(255,255,255,0.2)', textAlign:'center' as const, lineHeight:1.5 },
  main: { flex:1, marginLeft:230, display:'flex', flexDirection:'column', minHeight:'100vh' },
  topbar: { background:'#fff', borderBottom:'1px solid #E2E8F0', padding:'0 18px', height:52, display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:30 },
  menuBtn: { background:'none', border:'none', fontSize:22, cursor:'pointer', color:AZUL },
  topLogo: { height:28, objectFit:'contain' },
  topBadge: { marginLeft:'auto', background:'#EF444420', color:'#EF4444', fontSize:12, fontWeight:800, padding:'3px 10px', borderRadius:20 },
  content: { flex:1, padding:'24px 20px', background:'#F4F6FB' },
}
