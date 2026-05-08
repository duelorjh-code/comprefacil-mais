'use client'

import { useEffect, useState } from 'react'
import { AZUL, DOURADO } from '@/lib/constants'

interface TimeLeft { days: number; hours: number; minutes: number; seconds: number }

const DATA_INAUGURACAO = new Date('2026-05-15T03:00:00Z')

function calcularTempo(): TimeLeft {
  const diff = DATA_INAUGURACAO.getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000)  / 60000),
    seconds: Math.floor((diff % 60000)    / 1000),
  }
}

export default function PaginaInauguracao() {
  const [tempo, setTempo]     = useState<TimeLeft>(calcularTempo())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const id = setInterval(() => setTempo(calcularTempo()), 1000)
    return () => clearInterval(id)
  }, [])

  const blocos = [
    { label: 'DIAS',     valor: tempo.days },
    { label: 'HORAS',    valor: tempo.hours },
    { label: 'MINUTOS',  valor: tempo.minutes },
    { label: 'SEGUNDOS', valor: tempo.seconds },
  ]

  const beneficios = [
    { ico: '🛒', txt: 'Compre sem sair de casa' },
    { ico: '⚡', txt: 'Entrega rápida na porta' },
    { ico: '🏪', txt: 'Seja nosso parceiro' },
    { ico: '🛵', txt: 'Trabalhe como entregador' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Nunito:wght@400;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:${AZUL}}
        @keyframes fadeDown{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:none}}
        @keyframes expandir{from{width:0;opacity:0}to{width:56px;opacity:1}}
        @keyframes pulsar{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
      `}</style>

      <div style={s.page}>
        <div style={s.grid} />
        <div style={s.glow} />

        <div style={s.badge}>
          <span style={s.dot} />
          NOVO APP EM TRÊS LAGOAS
        </div>

        <div style={s.logoWrap}>
          <img src="/logo.png" alt="CompreFácil+" style={s.logo} />
        </div>

        <div style={s.divider} />

        <h1 style={s.headline}>
          <span style={{ color: '#fff' }}>Estamos chegando</span><br />
          em Três Lagoas!
        </h1>

        <p style={s.sub}>Sua conveniência à um clique de distância.</p>

        {mounted && (
          <div style={s.countdown}>
            {blocos.map((b, i) => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                <div style={s.bloco}>
                  <div style={s.blocoNum}>
                    <span style={s.blocoNumSpan}>{String(b.valor).padStart(2, '0')}</span>
                  </div>
                  <span style={s.blocoLabel}>{b.label}</span>
                </div>
                {i < blocos.length - 1 && <span style={s.sep}>:</span>}
              </div>
            ))}
          </div>
        )}

        <div style={s.cidade}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DOURADO} strokeWidth="2.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          Três Lagoas, MS — 15 de Maio de 2026
        </div>

        <div style={s.bens}>
          {beneficios.map(b => (
            <div key={b.txt} style={s.ben}>
              <div style={s.benIco}>{b.ico}</div>
              <span style={s.benTxt}>{b.txt}</span>
            </div>
          ))}
        </div>

        <div style={s.ctaBox}>
          <div style={s.ctaBtn}>🎉 &nbsp;Cadastro realizado com sucesso!</div>
          <span style={s.siteLink}>comprefacilmais.com</span>
        </div>

        <div style={s.linha} />
        <p style={s.hash}>#CompreFácil &nbsp;#TrêsLagoas &nbsp;#Delivery &nbsp;#App</p>
      </div>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', background: AZUL,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Nunito', sans-serif", padding: '40px 20px',
    position: 'relative', overflow: 'hidden',
  },
  grid: {
    position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
    backgroundImage: 'linear-gradient(rgba(212,160,23,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(212,160,23,.05) 1px,transparent 1px)',
    backgroundSize: '56px 56px',
  },
  glow: {
    position: 'fixed', top: -240, left: '50%', transform: 'translateX(-50%)',
    width: 700, height: 700, borderRadius: '50%', pointerEvents: 'none',
    background: 'radial-gradient(circle,rgba(212,160,23,.1) 0%,transparent 70%)', zIndex: 0,
  },
  badge: {
    position: 'relative', zIndex: 1,
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: 'rgba(212,160,23,.12)', border: '1px solid rgba(212,160,23,.35)',
    borderRadius: 50, padding: '8px 20px',
    color: DOURADO, fontSize: 11, fontWeight: 800, letterSpacing: 2.5,
    textTransform: 'uppercase' as const, marginBottom: 28,
    animation: 'fadeDown .6s ease both',
  },
  dot: { width: 7, height: 7, background: DOURADO, borderRadius: '50%', animation: 'pulsar 1.6s infinite', display: 'inline-block' },
  logoWrap: {
    position: 'relative', zIndex: 1,
    background: '#e8edf5', borderRadius: 14, padding: '20px 36px', marginBottom: 24,
    boxShadow: '0 16px 48px rgba(0,0,0,.35),0 0 0 1px rgba(212,160,23,.2)',
    animation: 'fadeDown .6s ease .08s both',
  },
  logo: { display: 'block', width: 240, height: 'auto', objectFit: 'contain' as const },
  divider: {
    position: 'relative', zIndex: 1,
    height: 3, background: DOURADO, borderRadius: 2, marginBottom: 22,
    animation: 'expandir .8s ease .2s both',
  },
  headline: {
    position: 'relative', zIndex: 1,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 'clamp(28px,6vw,52px)', fontWeight: 900,
    color: DOURADO, textAlign: 'center' as const, lineHeight: 1.1,
    textTransform: 'uppercase' as const, marginBottom: 10,
    animation: 'fadeDown .6s ease .12s both',
  },
  sub: {
    position: 'relative', zIndex: 1,
    fontSize: 'clamp(13px,2.5vw,16px)', color: 'rgba(255,255,255,.52)',
    textAlign: 'center' as const, marginBottom: 36,
    animation: 'fadeDown .6s ease .18s both',
  },
  countdown: {
    position: 'relative', zIndex: 1,
    display: 'flex', gap: 8, marginBottom: 36,
    flexWrap: 'wrap' as const, justifyContent: 'center',
    animation: 'fadeDown .6s ease .26s both',
  },
  bloco: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', minWidth: 78 },
  blocoNum: {
    background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(212,160,23,.3)',
    borderRadius: 10, width: 78, height: 78,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 6px 24px rgba(0,0,0,.25)',
  },
  blocoNumSpan: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 36, fontWeight: 900, color: DOURADO, lineHeight: 1,
  },
  blocoLabel: {
    marginTop: 7, fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.38)',
    letterSpacing: 2, textTransform: 'uppercase' as const,
  },
  sep: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 36, fontWeight: 900, color: DOURADO, opacity: .4, marginTop: 16,
  },
  cidade: {
    position: 'relative', zIndex: 1,
    display: 'flex', alignItems: 'center', gap: 7,
    color: 'rgba(255,255,255,.4)', fontSize: 13, fontWeight: 600,
    marginBottom: 32, animation: 'fadeDown .6s ease .34s both',
  },
  bens: {
    position: 'relative', zIndex: 1,
    display: 'flex', flexDirection: 'column' as const, gap: 10,
    width: '100%', maxWidth: 420, marginBottom: 30,
    animation: 'fadeDown .6s ease .4s both',
  },
  ben: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'rgba(212,160,23,.08)', border: '1px solid rgba(212,160,23,.16)',
    borderRadius: 10, padding: '12px 16px',
  },
  benIco: {
    fontSize: 17, width: 34, height: 34, background: 'rgba(212,160,23,.12)',
    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  benTxt: { color: 'rgba(255,255,255,.82)', fontSize: 14, fontWeight: 600 },
  ctaBox: {
    position: 'relative', zIndex: 1,
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 10,
    animation: 'fadeDown .6s ease .46s both',
  },
  ctaBtn: {
    background: DOURADO, color: AZUL,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 17, fontWeight: 900, letterSpacing: 1.5,
    textTransform: 'uppercase' as const, padding: '15px 40px', borderRadius: 50,
    boxShadow: '0 8px 32px rgba(212,160,23,.3)',
    display: 'inline-flex', alignItems: 'center', gap: 8,
  },
  siteLink: { color: 'rgba(255,255,255,.35)', fontSize: 12, fontWeight: 500 },
  linha: {
    position: 'relative', zIndex: 1,
    width: '100%', maxWidth: 420, height: 1,
    background: 'rgba(212,160,23,.15)', margin: '28px auto 20px',
  },
  hash: {
    position: 'relative', zIndex: 1,
    color: 'rgba(255,255,255,.28)', fontSize: 12, textAlign: 'center' as const,
    animation: 'fadeDown .6s ease .52s both',
  },
}
