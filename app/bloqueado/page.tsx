'use client'

import { useRouter } from 'next/navigation'
import { logout } from '@/lib/auth'
import { AZUL, DOURADO, RODAPE, linkWhats } from '@/lib/constants'

export default function BloqueadoPage() {
  const router = useRouter()
  async function handleSair() { await logout(); router.replace('/') }

  return (
    <div style={s.page}>
      <div style={s.bg} />
      <div style={s.card} className="anim-fadeUp">
        <img src="/logo.png" alt="CompreFácil+" style={s.logo} />
        <div style={s.icone}>🚫</div>
        <h1 style={s.titulo}>Acesso bloqueado</h1>
        <p style={s.texto}>
          Sua conta foi bloqueada pelo sistema após 3 recusas sem justificativa.
          Para regularizar seu acesso, entre em contato com o suporte.
        </p>
        <a href={linkWhats('Olá, minha conta foi bloqueada no CompreFácil+. Preciso de ajuda.')}
          target="_blank" rel="noreferrer" style={s.btnWhats}>
          💬 Falar com o suporte
        </a>
        <button onClick={handleSair} style={s.btnSair}>Sair</button>
        <p style={s.rodape}>{RODAPE}</p>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: AZUL,
    fontFamily: "'Nunito', sans-serif", padding: 24,
    position: 'relative',
  },
  bg: { position: 'fixed', inset: 0, background: 'linear-gradient(160deg, #1B2F5E 0%, #0d1a36 100%)', zIndex: 0 },
  card: {
    position: 'relative', zIndex: 1, background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20,
    padding: '36px 28px', maxWidth: 380, width: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    backdropFilter: 'blur(12px)',
  },
  logo: { height: 40, objectFit: 'contain', filter: 'brightness(0) invert(1)' },
  icone: { fontSize: 48, lineHeight: 1 },
  titulo: { fontSize: 22, fontWeight: 800, color: '#fff', textAlign: 'center' as const },
  texto: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' as const, lineHeight: 1.7 },
  btnWhats: {
    display: 'block', width: '100%', padding: '15px',
    background: '#25D366', color: '#fff', borderRadius: 12,
    textAlign: 'center' as const, fontSize: 15, fontWeight: 800,
    textDecoration: 'none', marginTop: 8,
  },
  btnSair: {
    background: 'none', border: '1.5px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.6)', borderRadius: 12,
    padding: '12px 32px', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  rodape: { fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center' as const, marginTop: 8 },
}
