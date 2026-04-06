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
  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
      if (e.status === 'online') iniciarHeartbeat(e.id)

      supabase.channel('ent-pedidos')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, p => {
          if (p.new.status === 'pronto') { setNovos(v => v + 1); tocarAlarme() }
        })
        .subscribe()
    }
    init()

    // O cron pg_cron 'force-offline-entregadores' (a cada minuto) garante
    // que entregadores sem atividade recente sejam marcados offline automaticamente.
    return () => {
      pararHeartbeat()
    }
  }, [tocarAlarme])

  function iniciarHeartbeat(id: string) {
    pararHeartbeat()
    // Ping imediato
    supabase.from('entregadores').update({ atualizado_em: new Date().toISOString() }).eq('id', id)
    // Ping a cada 5 minutos
    heartbeatRef.current = setInterval(() => {
      supabase.from('entregadores').update({ atualizado_em: new Date().toISOString() }).eq('id', id)
    }, 5 * 60 * 1000)
  }

  function pararHeartbeat() {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }

  async function toggleOnline() {
    if (!entId) return
    const novoStatus = online ? 'offline' : 'online'
    if (!online && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        await supabase.from('entregadores').update({
          status: novoStatus,
          lat_atual: pos.coords.latitude,
          lng_atual: pos.coords.longitude,
          atualizado_em: new Date().toISOString(),
        }).eq('id', entId)
        setOnline(true)
        iniciarHeartbeat(entId)
      })
    } else {
      await supabase.from('entregadores').update({ status: novoStatus }).eq('id', entId)
      setOnline(false)
      pararHeartbeat()
    }
  }

  async function handleLogout() {
    pararHeartbeat()
    if (entId) await supabase.from('entregadores').update({ status: 'offline' }).eq('id', entId)
    await logout()
    router.replace('/')
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <img src="/logo.png" alt="CompreFácil+" style={s.logo} />
        <button onClick={toggleOnline}
          style={{ ...s.toggle, background: online ? '#22C55E20' : '#EF444420', color: online ? VERDE : VERMELHO, borderColor: online ? '#22C55E40' : '#EF444440' }}>
          <span style={{ ...s.toggleDot, background: online ? VERDE : VERMELHO }} />
          {online ? '● Online' : '○ Offline'}
        </button>
        <button onClick={handleLogout} style={s.btnSair}>Sair</button>
      </header>

      {!online && (
        <div style={s.offlineBanner}>⚫ Você está offline. Ative o botão acima para receber entregas.</div>
      )}

      <main style={s.content}>{children}</main>

      <nav style={s.bottomNav}>
        {MENU.map(item => {
          const ativo = pathname === item.href || (item.href !== '/entregador' && pathname.startsWith(item.href))
          return (
            <button key={item.href} onClick={() => { router.push(item.href); if (item.href === '/entregador') setNovos(0) }}
              style={{ ...s.navBtn, color: ativo ? DOURADO : '#94A3B8' }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={s.navLabel}>
                {item.label}
                {item.href === '/entregador' && novos > 0 && (
                  <span style={s.badge}>{novos}</span>
                )}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:          { minHeight: '100vh', background: '#F4F6FB', fontFamily: "'Nunito', sans-serif", paddingBottom: 72 },
  header:        { background: AZUL, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 40 },
  logo:          { height: 28, objectFit: 'contain' },
  toggle:        { marginLeft: 'auto', padding: '6px 14px', borderRadius: 20, border: '1.5px solid', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' },
  toggleDot:     { width: 8, height: 8, borderRadius: '50%' },
  btnSair:       { background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 8 },
  offlineBanner: { background: '#1e293b', color: '#94A3B8', padding: '8px 16px', fontSize: 13, textAlign: 'center' },
  content:       { flex: 1 },
  bottomNav:     { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E2E8F0', display: 'flex', padding: '6px 0', zIndex: 40, boxShadow: '0 -4px 16px rgba(0,0,0,0.06)' },
  navBtn:        { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontFamily: 'inherit' },
  navLabel:      { fontSize: 10, fontWeight: 700, position: 'relative' },
  badge:         { position: 'absolute', top: -6, right: -10, background: VERMELHO, color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 },
}
