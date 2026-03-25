'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logout } from '@/lib/auth'
import { AZUL, DOURADO, TEXTO, TEXTO_MEIO, CINZA_BORDA, RODAPE, linkWhats } from '@/lib/constants'

export default function PerfilPage() {
  const router = useRouter()
  const [perfil, setPerfil]       = useState<any>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    const { data: p } = await supabase.from('perfis').select('*').eq('id', user.id).single()
    setPerfil(p)
    const { data: c } = await supabase.from('clientes').select('id').eq('usuario_id', user.id).single()
    if (c) {
      const { data: ped } = await supabase.from('pedidos')
        .select('id, status, total, criado_em')
        .eq('cliente_id', c.id)
        .order('criado_em', { ascending: false })
        .limit(10)
      setHistorico(ped ?? [])
    }
    setLoading(false)
  }

  async function handleLogout() {
    await logout()
    localStorage.removeItem('cfm_carrinho')
    router.replace('/')
  }

  return (
    <div style={s.page}>
      <header style={s.topbar}>
        <button onClick={() => router.back()} style={s.voltar}>← Voltar</button>
        <span style={s.topTitulo}>Meu perfil</span>
      </header>

      <div style={s.conteudo}>
        {/* Avatar e dados */}
        <div style={s.perfilCard}>
          <div style={s.avatar}>{perfil?.nome?.charAt(0).toUpperCase()}</div>
          <div style={s.perfilInfo}>
            <div style={s.perfilNome}>{perfil?.nome}</div>
            <div style={s.perfilTel}>{perfil?.telefone}</div>
          </div>
        </div>

        {/* Links rápidos */}
        <div style={s.card}>
          <a href={linkWhats('Olá, preciso de suporte no CompreFácil+.')} target="_blank" rel="noreferrer" style={s.linkItem}>
            <span>💬</span><span style={s.linkLabel}>Falar com suporte</span><span style={s.chevron}>›</span>
          </a>
          <button onClick={() => router.push('/pedido')} style={s.linkItem}>
            <span>📦</span><span style={s.linkLabel}>Meu pedido atual</span><span style={s.chevron}>›</span>
          </button>
        </div>

        {/* Histórico */}
        <div style={s.card}>
          <h3 style={s.cardTitulo}>Histórico de pedidos</h3>
          {loading ? (
            <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
          ) : historico.length === 0 ? (
            <p style={s.vazio}>Nenhum pedido realizado ainda.</p>
          ) : (
            historico.map(p => (
              <button key={p.id} onClick={() => router.push(`/pedido?id=${p.id}`)} style={s.pedidoRow}>
                <div>
                  <div style={s.pedidoId}>#{p.id.slice(0,8).toUpperCase()}</div>
                  <div style={s.pedidoData}>{new Date(p.criado_em).toLocaleString('pt-BR')}</div>
                </div>
                <div style={s.pedidoRight}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: AZUL }}>R$ {p.total?.toFixed(2)}</span>
                  <span style={{ ...s.pill, background: p.status === 'entregue' ? '#22C55E20' : '#EF444420', color: p.status === 'entregue' ? '#22C55E' : '#EF4444' }}>
                    {p.status}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <button onClick={handleLogout} style={s.btnSair}>🚪 Sair da conta</button>
      </div>

      {/* Bottom nav */}
      <nav style={s.bottomNav}>
        {[
          { icon: '🏠', label: 'Início', href: '/vitrine' },
          { icon: '🛒', label: 'Carrinho', href: '/carrinho' },
          { icon: '📦', label: 'Pedido', href: '/pedido' },
          { icon: '👤', label: 'Perfil', href: '/perfil' },
        ].map(item => (
          <button key={item.href} onClick={() => router.push(item.href)} style={s.navBtn}>
            <span style={{ fontSize: 22 }}>{item.icon}</span>
            <span style={s.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>

      <p style={s.rodape}>{RODAPE}</p>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F4F6FB', fontFamily: "'Nunito', sans-serif", paddingBottom: 80 },
  topbar: { background: AZUL, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 },
  voltar: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  topTitulo: { color: '#fff', fontSize: 16, fontWeight: 800 },
  conteudo: { padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, margin: '0 auto' },
  perfilCard: { background: AZUL, borderRadius: 16, padding: '20px', display: 'flex', alignItems: 'center', gap: 16 },
  avatar: { width: 56, height: 56, borderRadius: '50%', background: DOURADO, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, flexShrink: 0 },
  perfilInfo: { flex: 1 },
  perfilNome: { fontSize: 18, fontWeight: 800, color: '#fff' },
  perfilTel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  card: { background: '#fff', borderRadius: 14, padding: '4px 0', boxShadow: '0 1px 8px rgba(27,47,94,0.06)', overflow: 'hidden' },
  cardTitulo: { fontSize: 13, fontWeight: 800, color: TEXTO, padding: '14px 16px 8px' },
  linkItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', borderBottom: `1px solid ${CINZA_BORDA}`, width: '100%', textAlign: 'left' as const, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: TEXTO, fontWeight: 600, textDecoration: 'none' },
  linkLabel: { flex: 1 },
  chevron: { color: TEXTO_MEIO, fontSize: 18 },
  loading: { display: 'flex', justifyContent: 'center', padding: 24 },
  spinner: { width: 24, height: 24, borderRadius: '50%', border: `3px solid ${AZUL}30`, borderTopColor: AZUL, display: 'block' },
  vazio: { fontSize: 13, color: TEXTO_MEIO, textAlign: 'center' as const, padding: '16px' },
  pedidoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'none', border: 'none', borderBottom: `1px solid ${CINZA_BORDA}`, width: '100%', cursor: 'pointer', fontFamily: 'inherit' },
  pedidoId: { fontSize: 13, fontWeight: 800, color: AZUL, fontFamily: 'monospace' },
  pedidoData: { fontSize: 11, color: TEXTO_MEIO, marginTop: 2 },
  pedidoRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  pill: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
  btnSair: { padding: '14px', background: '#fff', border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 12, fontSize: 14, fontWeight: 700, color: TEXTO_MEIO, cursor: 'pointer', fontFamily: 'inherit' },
  bottomNav: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E2E8F0', display: 'flex', padding: '6px 0', zIndex: 40, boxShadow: '0 -4px 16px rgba(0,0,0,0.06)' },
  navBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontFamily: 'inherit', color: '#94A3B8' },
  navLabel: { fontSize: 10, fontWeight: 700 },
  rodape: { textAlign: 'center' as const, fontSize: 11, color: '#ccc', padding: '8px 16px' },
}
