'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logout } from '@/lib/auth'
import { AZUL, DOURADO, VERDE, VERMELHO, RODAPE, linkWhats } from '@/lib/constants'

const MENU = [
  { href:'/entregador',           icon:'📦', label:'Entregas'    },
  { href:'/entregador/mapa',      icon:'🗺️', label:'Mapa'        },
  { href:'/entregador/financeiro',icon:'💰', label:'Financeiro'  },
  { href:'/entregador/perfil',    icon:'👤', label:'Perfil'      },
]

export default function EntregadorLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [online, setOnline]   = useState(false)
  const [novos, setNovos]     = useState(0)
  const [entId, setEntId]     = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const tocarAlarme = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio('/sons/alerta.mp3')
    audioRef.current.play().catch(() => {})
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: e } = await supabase.from('entregadores').select('id, status').eq('usuario_id', user.id).single()
      if (!e) return
      setEntId(e.id)
      setOnline(e.status === 'online')

      supabase.channel('ent-pedidos')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, p => {
          if (p.new.status === 'pronto') { setNovos(v => v + 1); tocarAlarme() }
        })
        .subscribe()
    }
    init()
  }, [tocarAlarme])

  async function toggleOnline() {
    const novoStatus = online ? 'offline' : 'online'
    if (!entId) return
    if (!online && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        await supabase.from('entregadores').update({ status: novoStatus, lat_atual: pos.coords.latitude, lng_atual: pos.coords.longitude }).eq('id', entId)
        setOnline(!online)
      })
    } else {
      await supabase.from('entregadores').update({ status: novoStatus }).eq('id', entId)
      setOnline(!online)
    }
  }

  async function handleLogout() { await logout(); router.replace('/') }

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <img src="/logo.png" alt="CompreFácil+" style={s.logo} />
        <button onClick={toggleOnline}
          style={{ ...s.toggle, background: online ? '#22C55E20' : '#EF444420', color: online ? VERDE : VERMELHO, borderColor: online ? '#22C55E40' : '#EF444440' }}>
          <span style={{ ...s.toggleDot, background: online ? VERDE : VERMELHO }} className={online ? 'anim-blink' : ''} />
          {online ? 'Online' : 'Offline'}
        </button>
      </header>

      {/* Conteúdo */}
      <main style={s.main}>{children}</main>

      {/* Bottom nav */}
      <nav style={s.bottomNav}>
        {MENU.map(item => {
          const ativo = pathname === item.href || (item.href !== '/entregador' && pathname.startsWith(item.href))
          return (
            <button key={item.href} onClick={() => router.push(item.href)}
              style={{ ...s.navBtn, ...(ativo ? s.navAtivo : {}) }}>
              <span style={{ position:'relative', fontSize:22 }}>
                {item.icon}
                {item.href === '/entregador' && novos > 0 && (
                  <span style={s.navBadge} className="anim-blink">{novos}</span>
                )}
              </span>
              <span style={s.navLabel}>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight:'100vh', background:'#F4F6FB', fontFamily:"'Nunito', sans-serif", paddingBottom:72, display:'flex', flexDirection:'column' },
  header: { background:AZUL, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:40 },
  logo: { height:28, objectFit:'contain' },
  toggle: { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:20, border:'1.5px solid', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'inherit', background:'transparent' },
  toggleDot: { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  main: { flex:1, padding:'16px' },
  bottomNav: { position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'1px solid #E2E8F0', display:'flex', padding:'6px 0', zIndex:40, boxShadow:'0 -4px 16px rgba(0,0,0,0.06)' },
  navBtn: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', padding:'4px', fontFamily:'inherit', color:'#94A3B8' },
  navAtivo: { color:AZUL },
  navLabel: { fontSize:10, fontWeight:700 },
  navBadge: { position:'absolute', top:-4, right:-6, background:'#EF4444', color:'#fff', fontSize:9, fontWeight:800, padding:'1px 4px', borderRadius:10 },
}
