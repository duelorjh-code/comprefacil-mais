'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

const STATUS: Record<string, { cor: string; label: string; bg: string }> = {
  aguardando_pagamento: { cor: '#B45309', bg: '#FEF3C7', label: 'Aguardando PIX' },
  pago:                 { cor: '#1D4ED8', bg: '#DBEAFE', label: 'Pago'           },
  em_separacao:         { cor: '#6D28D9', bg: '#EDE9FE', label: 'Separando'      },
  pronto:               { cor: '#0E7490', bg: '#CFFAFE', label: 'Pronto'         },
  a_caminho:            { cor: '#92400E', bg: '#FEF3C7', label: 'A caminho'       },
  entregue:             { cor: '#065F46', bg: '#D1FAE5', label: 'Entregue'        },
  cancelado:            { cor: '#991B1B', bg: '#FEE2E2', label: 'Cancelado'       },
  reembolsado:          { cor: '#374151', bg: '#F3F4F6', label: 'Reembolsado'    },
}

export default function AdminPedidos() {
  const [pedidos, setPedidos]         = useState<any[]>([])
  const [filtro, setFiltro]           = useState('todos')
  const [busca, setBusca]             = useState('')
  const [loading, setLoading]         = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)
  const [tick, setTick]               = useState(0)
  const audioRef                      = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    carregar()
    const canal = supabase.channel('admin-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, carregar)
      .subscribe()
    const timer = setInterval(() => setTick(v => v + 1), 1000)
    return () => { supabase.removeChannel(canal); clearInterval(timer) }
  }, [])

  async function carregar() {
    const res  = await fetch('/api/admin/pedidos', { cache: 'no-store' })
    const json = await res.json()
    if (json.data) setPedidos(json.data)
    setLoading(false)
  }

  async function atualizarStatus(id: string, status: string) {
    setAtualizando(id + status)
    await fetch('/api/admin/pedidos/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: id, status }),
    })
    await carregar()
    setAtualizando(null)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este pedido permanentemente?')) return
    await supabase.from('pedido_itens').delete().eq('pedido_id', id)
    await supabase.from('pedidos').delete().eq('id', id)
    carregar()
  }

  const filtrados = pedidos.filter(p => {
    if (filtro !== 'todos' && p.status !== filtro) return false
    if (busca) {
      const b = busca.toLowerCase()
      return p.id.toLowerCase().includes(b) ||
        (p.clientes?.perfis?.nome ?? '').toLowerCase().includes(b) ||
        (p.parceiros?.nome_fantasia ?? '').toLowerCase().includes(b)
    }
    return true
  })

  return (
    <div style={s.wrap}>
      <audio ref={audioRef} src="/sons/alerta.mp3" preload="auto" />

      <div style={s.cabecalho}>
        <h1 style={s.titulo}>Pedidos</h1>
        <span style={s.badge}>{pedidos.filter(p => !['entregue','cancelado','reembolsado'].includes(p.status)).length} ativos</span>
      </div>

      <input style={s.busca} placeholder="🔍 Buscar por ID, cliente ou parceiro…"
        value={busca} onChange={e => setBusca(e.target.value)} />

      <div style={s.tabs}>
        {['todos', ...Object.keys(STATUS)].map(st => (
          <button key={st} onClick={() => setFiltro(st)}
            style={{ ...s.tab, ...(filtro === st ? s.tabAtivo : {}) }}>
            {st === 'todos' ? 'Todos' : STATUS[st]?.label ?? st}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: TEXTO_MEIO }}>Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: TEXTO_MEIO }}>Nenhum pedido encontrado.</div>
      ) : (
        <div style={s.grid}>
          {filtrados.map(p => {
            const st = STATUS[p.status] ?? { cor: '#999', bg: '#F3F4F6', label: p.status }
            return (
              <div key={p.id} style={{ ...s.card, borderLeft: `4px solid ${st.cor}` }}>
                {/* Header do card */}
                <div style={s.cardTop}>
                  <span style={s.cardId}>#{p.id.slice(0, 8).toUpperCase()}</span>
                  <span style={{ ...s.pill, background: st.bg, color: st.cor }}>{st.label}</span>
                  <button onClick={() => excluir(p.id)} style={s.btnExcluir} title="Excluir pedido">🗑</button>
                </div>

                {/* Infos */}
                <div style={s.infos}>
                  <div style={s.infoLinha}>
                    <span style={s.infoL}>Cliente</span>
                    <span style={s.infoV}>{p.clientes?.perfis?.nome ?? '—'}</span>
                  </div>
                  <div style={s.infoLinha}>
                    <span style={s.infoL}>Parceiro</span>
                    <span style={s.infoV}>{p.parceiros?.nome_fantasia ?? '—'}</span>
                  </div>
                  <div style={s.infoLinha}>
                    <span style={s.infoL}>Entregador</span>
                    <span style={s.infoV}>{p.entregadores?.perfis?.nome ?? '—'}</span>
                  </div>
                  <div style={s.infoLinha}>
                    <span style={s.infoL}>Total</span>
                    <span style={{ ...s.infoV, fontWeight: 800, color: AZUL }}>{formatBRL(p.total)}</span>
                  </div>
                </div>

                {p.endereco_entrega && (
                  <div style={s.endereco}>📍 {p.endereco_entrega}</div>
                )}

                {/* Ações */}
                {!['entregue','cancelado','reembolsado'].includes(p.status) && (
                  <div style={s.acoes}>
                    {p.status === 'aguardando_pagamento' && (
                      <BtnAcao label="✓ Marcar pago" cor="#1D4ED8"
                        loading={atualizando === p.id + 'pago'}
                        onClick={() => atualizarStatus(p.id, 'pago')} />
                    )}
                    {p.status === 'pago' && (
                      <BtnAcao label="📦 Separação" cor="#6D28D9"
                        loading={atualizando === p.id + 'em_separacao'}
                        onClick={() => atualizarStatus(p.id, 'em_separacao')} />
                    )}
                    {p.status === 'em_separacao' && (
                      <BtnAcao label="✓ Pronto" cor="#0E7490"
                        loading={atualizando === p.id + 'pronto'}
                        onClick={() => atualizarStatus(p.id, 'pronto')} />
                    )}
                    <BtnAcao label="✕ Cancelar" cor="#991B1B"
                      loading={atualizando === p.id + 'cancelado'}
                      onClick={() => atualizarStatus(p.id, 'cancelado')} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BtnAcao({ label, cor, onClick, loading }: { label: string; cor: string; onClick: () => void; loading: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ padding: '6px 10px', background: cor + '15', border: `1.5px solid ${cor}`, borderRadius: 7, color: loading ? cor + '60' : cor, fontSize: 11, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
      {loading ? '...' : label}
    </button>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:      { display: 'flex', flexDirection: 'column', gap: 16 },
  cabecalho: { display: 'flex', alignItems: 'center', gap: 12 },
  titulo:    { fontSize: 22, fontWeight: 800, color: '#1A2340', margin: 0 },
  badge:     { background: '#FEE2E2', color: '#991B1B', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  busca:     { border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#1A2340', background: '#fff', outline: 'none', fontFamily: 'inherit', width: '100%' },
  tabs:      { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
  tab:       { padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${CINZA_BORDA}`, background: '#fff', fontSize: 11, fontWeight: 700, color: TEXTO_MEIO, cursor: 'pointer', fontFamily: 'inherit' },
  tabAtivo:  { background: AZUL, color: '#fff', borderColor: AZUL },
  grid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 },
  card:      { background: '#fff', borderRadius: 12, padding: '14px', boxShadow: '0 1px 6px rgba(27,47,94,0.08)', display: 'flex', flexDirection: 'column', gap: 10 },
  cardTop:   { display: 'flex', alignItems: 'center', gap: 8 },
  cardId:    { fontSize: 12, fontWeight: 800, color: '#1A2340', fontFamily: 'monospace', flex: 1 },
  pill:      { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' as const },
  btnExcluir:{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', opacity: 0.5, lineHeight: 1 },
  infos:     { display: 'flex', flexDirection: 'column', gap: 4 },
  infoLinha: { display: 'flex', gap: 6, alignItems: 'baseline' },
  infoL:     { fontSize: 10, fontWeight: 700, color: TEXTO_MEIO, textTransform: 'uppercase' as const, width: 68, flexShrink: 0 },
  infoV:     { fontSize: 12, fontWeight: 600, color: '#1A2340' },
  endereco:  { fontSize: 11, color: TEXTO_MEIO, background: '#F8FAFC', borderRadius: 6, padding: '6px 8px' },
  acoes:     { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
}
