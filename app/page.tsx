'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { redirecionarPorRole } from '@/lib/auth'

const DATA_INAUGURACAO = new Date('2026-05-08T03:00:00Z')

export default function HomePage() {
  const router   = useRouter()
  const [pwaEvento, setPwaEvento] = useState<any>(null)
  const [isIOS, setIsIOS]         = useState(false)
  const [instalado, setInstalado] = useState(false)
  const [showIOS, setShowIOS]     = useState(false)

  useEffect(() => {
    // Detecta se já está instalado como PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalado(true)
    }
    // iOS
    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    setIsIOS(ios)
    // Android — captura evento de instalação
    const handler = (e: any) => { e.preventDefault(); setPwaEvento(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function instalarPWA() {
    if (!pwaEvento) return
    pwaEvento.prompt()
    const { outcome } = await pwaEvento.userChoice
    if (outcome === 'accepted') { setPwaEvento(null); setInstalado(true) }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: perfil } = await supabase
        .from('perfis').select('role').eq('id', session.user.id).single()
      if (!perfil) return

      const agora = new Date()
      const rolesLivres = ['admin', 'parceiro']
      if (!rolesLivres.includes(perfil.role) && agora < DATA_INAUGURACAO) return

      router.replace(redirecionarPorRole(perfil.role))
    })
  }, [])

  return (
    <div style={s.page}>
      <div style={s.bg} />
      <div style={s.orb1} />
      <div style={s.orb2} />

      <div style={s.card}>
        <img src="/logo.png" alt="CompreFácil+" style={s.logo} />

        <p style={s.slogan}>
          Sua conveniência,{' '}
          <span style={{ color: '#D4A017', fontWeight: 800 }}>
            à um clique de distância.
          </span>
        </p>

        <div style={s.bannerInauguracao}>
          <div style={s.bannerTop}>
            <span style={s.dot} />
            <span style={s.bannerLabel}>INAUGURAÇÃO · TRÊS LAGOAS</span>
          </div>
          <p style={s.bannerData}>🎉 08 de Maio de 2026</p>
          <p style={s.bannerSub}>
            Cadastre-se agora e seja um dos primeiros a usar!
          </p>
        </div>

        {/* Banner PWA — Android */}
        {pwaEvento && !instalado && (
          <div style={s.pwaBanner}>
            <div style={s.pwaLeft}>
              <img src="/icons/icon-192.png" alt="" style={s.pwaIcon} />
              <div>
                <div style={s.pwaTitulo}>Instalar CompreFácil+</div>
                <div style={s.pwaSub}>Adicione à tela inicial</div>
              </div>
            </div>
            <button onClick={instalarPWA} style={s.pwaBtnInstalar}>Instalar</button>
          </div>
        )}

        {/* Banner PWA — iOS */}
        {isIOS && !instalado && (
          <button onClick={() => setShowIOS(v => !v)} style={s.pwaIOSBtn}>
            📲 Instalar no iPhone
          </button>
        )}
        {showIOS && (
          <div style={s.pwaIOSCard}>
            <div style={s.pwaIOSPasso}>1. Toque em <strong>Compartilhar</strong> <span style={{fontSize:16}}>⬆️</span></div>
            <div style={s.pwaIOSPasso}>2. Role e toque em <strong>"Adicionar à Tela de Início"</strong></div>
            <div style={s.pwaIOSPasso}>3. Toque em <strong>Adicionar</strong> ✅</div>
          </div>
        )}

        <div style={s.botoes}>
          <button onClick={() => router.push('/login')} style={s.btnEntrar}>
            Entrar
          </button>
          <button onClick={() => router.push('/cadastro')} style={s.btnCadastro}>
            🎉 Criar conta — É grátis!
          </button>
        </div>
      </div>

      <p style={s.rodape}>© 2026 CompreFácil+ · Sua conveniência à um clique de distância.</p>

      <style>{`
        @keyframes pulsar {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Nunito', sans-serif", padding: '24px',
    position: 'relative', overflow: 'hidden',
  },
  bg: {
    position: 'fixed', inset: 0,
    background: 'linear-gradient(160deg, #1B2F5E 0%, #dfa916 100%)',
    zIndex: 0,
  },
  orb1: {
    position: 'fixed', width: 360, height: 360, borderRadius: '50%',
    background: '#D4A01712', top: -80, right: -80, zIndex: 0, filter: 'blur(40px)',
  },
  orb2: {
    position: 'fixed', width: 280, height: 280, borderRadius: '50%',
    background: '#D4A0170A', bottom: -60, left: -60, zIndex: 0, filter: 'blur(30px)',
  },
  card: {
    position: 'relative', zIndex: 1,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
    width: '100%', maxWidth: 360,
    animation: 'fadeUp 0.4s ease both',
  },
  logo:   { width: '100%', maxWidth: 220, objectFit: 'contain' },
  slogan: {
    color: 'rgba(255,255,255,0.75)', fontSize: 17, fontWeight: 600,
    textAlign: 'center', lineHeight: 1.6, letterSpacing: '0.01em',
  },
  bannerInauguracao: {
    width: '100%',
    background: 'rgba(0,0,0,0.25)',
    border: '1.5px solid rgba(212,160,23,0.4)',
    borderRadius: 16, padding: 16,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    backdropFilter: 'blur(8px)',
  },
  bannerTop:   { display: 'flex', alignItems: 'center', gap: 7 },
  dot: {
    width: 7, height: 7, background: '#D4A017', borderRadius: '50%',
    display: 'inline-block', animation: 'pulsar 1.6s infinite',
  },
  bannerLabel: { color: '#D4A017', fontSize: 10, fontWeight: 800, letterSpacing: '2.5px', textTransform: 'uppercase' as const },
  bannerData:  { color: '#fff', fontSize: 18, fontWeight: 800, textAlign: 'center', margin: 0 },
  bannerSub:   { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600, textAlign: 'center', lineHeight: 1.5, margin: 0 },
  botoes:      { display: 'flex', flexDirection: 'column', gap: 12, width: '100%' },
  btnEntrar: {
    width: '100%', padding: 16, background: '#D4A017', color: '#fff',
    border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800,
    letterSpacing: '0.02em', cursor: 'pointer', fontFamily: 'inherit',
  },
  btnCadastro: {
    width: '100%', padding: 16,
    background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)',
    border: '1.5px solid rgba(255,255,255,0.2)',
    borderRadius: 14, fontSize: 16, fontWeight: 700,
    letterSpacing: '0.02em', cursor: 'pointer', fontFamily: 'inherit',
  },
  pwaBanner:      { display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.12)', border:'1.5px solid rgba(255,255,255,0.2)', borderRadius:14, padding:'12px 16px', width:'100%', backdropFilter:'blur(8px)' },
  pwaLeft:        { display:'flex', alignItems:'center', gap:10 },
  pwaIcon:        { width:40, height:40, borderRadius:10 },
  pwaTitulo:      { color:'#fff', fontSize:13, fontWeight:800 },
  pwaSub:         { color:'rgba(255,255,255,0.6)', fontSize:11 },
  pwaBtnInstalar: { background:'#D4A017', color:'#fff', border:'none', borderRadius:10, padding:'8px 16px', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'inherit', flexShrink:0 },
  pwaIOSBtn:      { background:'rgba(255,255,255,0.12)', border:'1.5px solid rgba(255,255,255,0.25)', borderRadius:14, padding:'12px', fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.9)', cursor:'pointer', fontFamily:'inherit', width:'100%' },
  pwaIOSCard:     { background:'rgba(0,0,0,0.3)', borderRadius:14, padding:'16px', width:'100%', display:'flex', flexDirection:'column' as const, gap:10, backdropFilter:'blur(8px)' },
  pwaIOSPasso:    { color:'rgba(255,255,255,0.85)', fontSize:13, lineHeight:1.5 },
  rodape: {
    position: 'fixed', bottom: 20,
    color: 'rgba(255,255,255,0.2)', fontSize: 11,
    zIndex: 1, textAlign: 'center', letterSpacing: '0.02em',
  },
}
