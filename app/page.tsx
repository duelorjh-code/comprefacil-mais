'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase }  from '@/lib/supabase'
import { redirecionarPorRole } from '@/lib/auth'
import { AZUL, DOURADO, RODAPE } from '@/lib/constants'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: perfil } = await supabase
        .from('perfis').select('role').eq('id', session.user.id).single()
      if (perfil) router.replace(redirecionarPorRole(perfil.role))
    })
  }, [])

  return (
    <div style={s.page}>
      {/* Fundo com gradiente sutil */}
      <div style={s.bg} />
      <div style={s.orb1} />
      <div style={s.orb2} />

      <div style={s.card}>
        <img src="/logo.png" alt="CompreFácil+" style={s.logo} />

        <p style={s.slogan}>
          Sua conveniência,{' '}
          <span style={s.destaque}>à um clique de distância.</span>
        </p>

        <div style={s.acoes}>
          <button onClick={() => router.push('/login')} style={s.btnPrincipal}>
            Entrar
          </button>
          <button onClick={() => router.push('/cadastro')} style={s.btnSecundario}>
            Criar conta
          </button>
        </div>
      </div>

      <p style={s.rodape}>{RODAPE}</p>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: AZUL,
    fontFamily: "'Nunito', sans-serif",
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
  },
  bg: {
    position: 'fixed',
    inset: 0,
    background: `linear-gradient(160deg, ${AZUL} 0%, #dfa916 100%)`,
    zIndex: 0,
  },
  orb1: {
    position: 'fixed',
    width: 360,
    height: 360,
    borderRadius: '50%',
    background: `${DOURADO}12`,
    top: -80,
    right: -80,
    zIndex: 0,
    filter: 'blur(40px)',
  },
  orb2: {
    position: 'fixed',
    width: 280,
    height: 280,
    borderRadius: '50%',
    background: `${DOURADO}0A`,
    bottom: -60,
    left: -60,
    zIndex: 0,
    filter: 'blur(30px)',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 36,
    width: '100%',
    maxWidth: 360,
    animation: 'fadeUp 0.4s ease both',
  },
  logo: {
    width: '100%',
    maxWidth: 220,
    objectFit: 'contain',
  },
  slogan: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 17,
    fontWeight: 600,
    textAlign: 'center',
    lineHeight: 1.6,
    letterSpacing: '0.01em',
  },
  destaque: {
    color: DOURADO,
    fontWeight: 800,
  },
  acoes: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  btnPrincipal: {
    width: '100%',
    padding: '16px',
    background: DOURADO,
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: '0.02em',
    transition: 'opacity 0.2s, transform 0.1s',
  },
  btnSecundario: {
    width: '100%',
    padding: '16px',
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.9)',
    border: '1.5px solid rgba(255,255,255,0.2)',
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: '0.02em',
    transition: 'background 0.2s',
  },
  rodape: {
    position: 'fixed',
    bottom: 20,
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    zIndex: 1,
    textAlign: 'center',
    letterSpacing: '0.02em',
  },
}
